# Plan

## How I split the work into sessions

Seven sessions across three days. I worked backend-first and finished each layer before starting the next, so that every frontend screen I built was talking to an API I'd already tested by hand.

| # | When | What |
|---|---|---|
| 1 | Sep 11, evening | Scaffold, Prisma schema, auth with JWT + refresh rotation, reference modules (categories, locations, users, assignments) |
| 2 | Sep 12, small hours | The ledger — movements, lines, the `FOR UPDATE` lock, transfer arithmetic. Then item listing with server-side search/filter/sort/paging, then CSV import/export |
| 3 | Sep 12, morning | Dashboard aggregates, low-stock alerts and the dismiss/re-arm rule |
| 4 | Sep 12, afternoon | Frontend: layout, auth context, items list, item detail, dashboard |
| 5 | Sep 12, late afternoon | Frontend part two: admin screens, import/export page, error boundary, offline handling |
| 6 | Sep 13, small hours | UI redesign pass — spacing, density, colour, typography |
| 7 | Sep 13, afternoon–night | Deploy to Aiven + Railway + Vercel, fix what deployment broke, tighten password and name validation, rebuild unit of measure as a reference table, then test end to end |

## What order I built in, and why

**Schema first, and I spent longer on it than felt comfortable.** The whole brief hangs on one sentence — on-hand is derived, never stored — and if I got the ledger shape wrong, everything above it would inherit the mistake. Deciding on two tables with signed deltas before writing any endpoint meant the balance query was the same three lines for every feature that followed.

**Auth second**, because every other route needed `req.user` to exist before it could enforce anything, and because goal 1 says the role difference must be real on the server. Building it first meant I never had to retrofit a guard.

**The ledger third, as the centre of gravity.** Movements, the row lock, transfers as two lines. Once `recordMovement()` was correct, CSV receipt import was just "call it once per row", and the dashboard was just "sum the lines differently".

**Reads after writes.** The item list, dashboard and alerts are all different questions asked of the same ledger. Doing them after the ledger meant no query needed a schema change to answer.

**Frontend last, in one run.** By then the API was stable and documented by its own tests, so the UI work was layout and state rather than discovering backend gaps.

**Deployment second-to-last, which was a mistake.** See below.

## Estimated versus actual

The budget was ~12 hours. I spent closer to **16**, and the overrun was almost entirely in two places I'd underestimated.

| Area | Estimated | Actual | What happened |
|---|---|---|---|
| Schema + migrations | 1.5h | 2.5h | The triggers and CHECK constraints aren't Prisma features, so they're hand-written SQL. MySQL also refuses a CHECK on a column a foreign key might `SET NULL`, which forced the location FKs to `RESTRICT` — which turned out to be more correct anyway |
| Auth | 1.5h | 1.5h | On the nose |
| Ledger + movements | 2h | 2.5h | Proving the concurrency guard actually works took longer than writing it |
| Items, search, CSV | 2h | 2h | |
| Dashboard + alerts | 1.5h | 1.5h | The alert re-arm rule needed thought but not time |
| Frontend | 3h | 4h | |
| **Deployment** | **0.5h** | **2.5h** | The big miss |
| Unit-of-measure rebuild | 0h | 1.5h | Unplanned — a design flaw I found while reviewing |
| End-to-end testing | 1h | 2h | Found a real date bug, so worth it |

**Why deployment blew out 5x.** I'd budgeted for "push and set environment variables". What actually happened:

- Seeding against a remote database timed out — Prisma's default 5s transaction limit is generous locally and not remotely. Needed explicit `timeout`/`maxWait` options.
- Sign-in worked locally and failed on the deployed site. The refresh token is an httpOnly cookie, and Safari blocks third-party cookies, so cross-origin auth silently died on every reload. Fixed by proxying `/api/*` through Vercel so the cookie is first-party.
- The deployed app was ~10x slower than local. It wasn't the free tier — Railway was in a US region and the database was in Singapore, so every query paid a cross-region round trip. I isolated it by timing a route that returns 404 without touching the database, which gave me the pure network floor to subtract. Moving Railway next to the database took queries from ~250ms to ~5ms.

None of these were code problems, and none of them were visible locally. If I did this again I'd deploy a skeleton on day one — an empty Express app talking to the real managed database — so that the environment's problems surface while there's still time, rather than as a surprise at the end.

## What I cut when I ran short

**An automated test suite.** This is the real cut and the one I'm least happy about. I tested hard — roughly 750 checks across the API, the database and the browser, including cross-checking every item's on-hand against an independent SQL sum and attacking the triggers directly — but I wrote them as throwaway Node scripts and deleted them as I went. They found genuine bugs, including a date-rollover bug on the last day. None of it is committed as something a reviewer can re-run, which means from the outside it may as well not exist.

**All nine stretch ideas.** The brief is explicit that doing eight goals well beats ten badly, and stretch work never substitutes for a goal. All ten goals are done, so I stopped.

**Unit conversion**, specifically. It was tempting once I'd built the units table, but conversions mean every quantity in the ledger needs a unit attached and a conversion factor to normalise against. That's a different data model, not an addition. I did the honest small version instead — freeze the unit once stock exists, and tell the user to create a second SKU.

**Email digests, barcode lookup, supplier records.** Never started.

**Polish on duplicate-key error messages.** When you create a duplicate SKU or email, the message is Prisma's generic *"A record with that value already exists"* rather than something specific like the *"Unknown unit 'furlong' — create it first"* I wrote elsewhere. I know exactly where it is and it's a small fix; I ran out of time before it.
