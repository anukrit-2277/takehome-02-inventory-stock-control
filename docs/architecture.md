# Architecture

## What the moving pieces are

Four pieces, deliberately boring ones.

**A React single-page app.** Vite build, plain JavaScript, React Router for pages, Tailwind for styling. Its entire dependency list is `react`, `react-dom` and `react-router-dom` — no state library, no data-fetching library, no form library, and no chart library (the two dashboard charts are hand-written SVG in `components/charts/`). State is React context for the two things that are genuinely global — who is signed in (`AuthContext`) and the low-stock badge count (`AlertsContext`) — and a small `useFetch` hook everywhere else. Filters and paging live in the URL query string via `useQueryParams`, so a filtered list is a link you can share or reload.

**An Express 5 API.** One process. Every feature is a folder under `src/modules/` with the same four files: `routes` (paths and guards), `schemas` (Zod validation), `controller` (thin — unwrap request, call service, send JSON), and `service` (all the business rules and the only place Prisma is touched). If you want to know what a receipt actually does, you open `movements.service.js` and nothing else.

**MySQL, through Prisma.** Prisma gives me a typed client and migrations. What it does *not* give me is triggers or CHECK constraints, so those are written as raw SQL inside a migration file and live in the database itself.

**The browser's cookie jar**, which I'm counting as a moving piece because the refresh token lives there and nowhere else — never in `localStorage`, never in JavaScript's reach.

## Where each piece runs

| Piece | Runs on | Notes |
|---|---|---|
| React app | Vercel (static + edge rewrites) | `vercel.json` rewrites `/api/*` to the Railway URL |
| Express API | Railway, Singapore region | Region matters — see below |
| MySQL 8 | Aiven managed MySQL, free tier | Triggers and CHECKs verified working there |

The Vercel rewrite is the part worth explaining. The obvious setup is to give the frontend a `VITE_API_URL` pointing at Railway and let the browser call it cross-origin. I did that first and it broke in Safari: the refresh token is an httpOnly cookie, and Safari blocks third-party cookies by default, so every reload signed the user out. The fix was to stop making it third-party. Vercel rewrites `/api/*` server-side to Railway, so as far as the browser is concerned the API is on the same origin as the app, and the cookie is first-party. `VITE_API_URL` is now deliberately left **unset** in production — setting it would re-break Safari.

I also learned the hard way that region is not a detail. My first Railway deployment was in a US region while the database sat in Singapore. Every query paid ~250ms of round trip, and a dashboard that ran in 107ms locally took 1270ms deployed. I worked it out by hitting a route that returns 404 without touching the database — that gave me the pure network floor (262ms) — and subtracting. Moving Railway to Singapore next to the database took queries to ~5ms. Nothing about the code changed.

## One request, end to end: staff records a transfer of 5 units

1. **Browser.** Staff picks Transfer in the movement modal, enters quantity 5, a source and a destination. The submit handler calls `api.post('/movements', payload)`.

2. **`client.js`.** Attaches the in-memory access token as `Authorization: Bearer …`. The access token is never persisted — a refresh lands it in a module variable. If this request comes back 401, the client calls `/auth/refresh` once and retries. Concurrent 401s share one refresh via `refreshing ??= (...)`, so ten parallel requests don't fire ten refreshes.

3. **Vercel** rewrites `/api/movements` to the Railway origin, server-side.

4. **Express.** Helmet, CORS against an allow-list, `express.json({ limit: '1mb' })`, then the router. Login is additionally rate-limited — with `skipSuccessfulRequests`, so a person typing their password correctly is never counted against the limit and only repeated failures throttle.

5. **`requireAuth`** verifies the JWT and hangs `{ id, role, locationIds }` on `req.user`. No database hit — the claims are in the token.

6. **`validate(createMovementSchema)`.** Zod, a discriminated union on `kind`, so a TRANSFER is required to carry `sourceLocationId` and `destinationLocationId` and forbidden to carry `locationId`. A bad body dies here with a field-level message and never reaches the service.

7. **`recordMovement()`** opens a transaction and does this in order:
   - `buildLines()` turns the movement into signed deltas. A transfer becomes two lines: `-5` at source, `+5` at destination.
   - `lockItem()` runs `SELECT … FOR UPDATE` on the item row. This is the concurrency guard — two people issuing the same item at the same moment serialise here rather than both reading the same balance.
   - Archived check.
   - `assertCanActAtLocations()` — staff must be assigned to **both** ends of a transfer, not just one.
   - `assertLocationsAcceptStock()` — an inactive location can't receive.
   - `assertStockAvailable()` — sums existing lines at the source and refuses if the transfer would drive it negative.
   - Creates the movement with its lines nested, so both rows commit together or neither does.
   - `resolveDismissalIfRecovered()` — if this pushed the item back above its reorder level, stamp `resolvedAt` on any active dismissal so the alert can fire again later.

8. **The database** has the last word. Even if every check above were wrong, `chk_movement_shape` refuses a TRANSFER carrying a `locationId`, and the composite foreign key refuses a line whose `itemId` disagrees with its movement.

9. **Back up the stack.** 201 with the created movement. The item page refetches; the alerts badge refetches.

A failure anywhere from step 7 onward rolls the whole transaction back, so a transfer that debits the source but never credits the destination — the exact problem in the brief — cannot exist as a state.

## What I decided not to build

**A cached `onHand` column.** The tempting optimisation, and the one that would have quietly defeated the point of the assignment. On-hand is always `SUM(quantityDelta)`. There is no balance column anywhere, so there is nothing that can drift.

**Soft deletes on anything but items.** Categories, units and locations are either in use — in which case deleting them is refused with a message naming what's using them — or unused and genuinely deletable. Only items get an archive state, because only items have history worth preserving.

**A generic permissions system.** Two roles, a handful of rules, all expressed as plain functions in `lib/access.js`. A roles-and-permissions table would be more flexible and much harder to read, for a system with exactly two roles.

**Unit conversion.** It's on the stretch list. I made unit of measure a managed list and froze it once an item has ledger rows, which is the honest small version — see `decisions.md`. Conversions would mean every quantity needs a unit attached to it, and that's a different, bigger data model.

**A test framework.** I regret this one and say so in `SUBMISSION.md`. I tested by writing throwaway Node scripts that hammered the live API and asserted against independent SQL — that caught real bugs, including a date-rollover bug — but none of it is committed as a suite anyone can re-run.

**Server-side rendering, websockets, optimistic updates.** Nothing here needs them. It's an internal tool for a handful of people.
