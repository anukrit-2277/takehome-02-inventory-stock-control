# Inventory & Stock Control — Project Guide

A complete walkthrough of this application: what it is, why it exists, how every
part works, and why each decision was made.

This is a companion to the five documents in `docs/`. Those answer the
assignment's specific questions; this one explains the system end to end.

---

## Table of contents

1. [The problem](#1-the-problem)
2. [What the system does](#2-what-the-system-does)
3. [The tech stack, and why](#3-the-tech-stack-and-why)
4. [How the pieces fit together](#4-how-the-pieces-fit-together)
5. [The data model](#5-the-data-model)
6. [The ledger — the heart of the system](#6-the-ledger--the-heart-of-the-system)
7. [Who can do what](#7-who-can-do-what)
8. [The API, endpoint by endpoint](#8-the-api-endpoint-by-endpoint)
9. [The frontend](#9-the-frontend)
10. [A request, traced end to end](#10-a-request-traced-end-to-end)
11. [Decisions worth defending](#11-decisions-worth-defending)
12. [What was deliberately not built](#12-what-was-deliberately-not-built)
13. [Bugs found, and how](#13-bugs-found-and-how)
14. [Running it locally](#14-running-it-locally)
15. [How it is deployed](#15-how-it-is-deployed)

---

## 1. The problem

### In plain words

A small distributor moves physical goods between a few places — a main
warehouse, a couple of shop floors, a project site. Today, none of it is
recorded properly:

- Someone receives a delivery and updates a spreadsheet, *if they remember*.
- Stock moves between locations after a phone call, with nothing written down.
- Someone notices a miscount and just types a new number into the spreadsheet.

Two things go wrong, predictably:

1. **The number on the shelf and the number in the spreadsheet drift apart.** A
   transfer gets recorded at the sending end but not the receiving end, so one
   location reads permanently short and the other permanently long.
2. **Nobody can reconstruct what happened.** A month later, the missing stock is
   a mystery, because the only record was overwritten by whoever "fixed" it.

### The core insight

The fix is not a better spreadsheet. It is a change in what gets stored.

> **Never store the quantity. Store the events, and add them up.**

If the system records *"20 arrived"*, *"3 went out"*, *"5 moved to the shop"*,
then the quantity on hand is always the sum of those events. There is no number
anyone can type over, because there is no number stored in the first place.

This is the same idea as a bank statement. Your balance is not a field somebody
edits — it is the sum of every transaction. If it looks wrong, you read the
transactions and find out why.

That single decision shapes everything else in this codebase.

---

## 2. What the system does

Ten capabilities, each mapping to a requirement in the brief.

| # | Capability | What it means |
|---|---|---|
| 1 | **Accounts and roles** | Sign in with email and password. Two roles: managers and warehouse staff, with different powers, enforced by the server |
| 2 | **Items** | Products with a SKU, name, unit, reorder level and category. Can be archived and restored without losing history |
| 3 | **Stock movements** | Four kinds — receipt, issue, transfer, adjustment — each recording quantity, location(s), and who did it |
| 4 | **The ledger** | Movements can never be edited or deleted. On-hand is always derived. Transfers are atomic. Nothing may go negative |
| 5 | **Location assignment** | Staff can only record movements at the locations they are assigned to. Managers act everywhere |
| 6 | **Finding items** | Search, filters, sorting and pagination — all computed on the server, never in the browser |
| 7 | **Bulk import/export** | CSV import for items and receipts, with a per-row report. CSV export of the current stock position |
| 8 | **Dashboard** | Headline numbers, stock split by category and location, and an eight-week activity chart |
| 9 | **History you cannot rewrite** | Every item has a timeline: creation, each field change with old and new values, archive/restore, and notes |
| 10 | **Low-stock alerts** | Items at or below their reorder level, with a count badge. Managers can dismiss one; it comes back if stock recovers and falls again |

---

## 3. The tech stack, and why

| Layer | Choice | Why |
|---|---|---|
| Database | **MySQL 8** | The data is deeply relational and needs real transactions |
| ORM | **Prisma** | Type-safe queries, versioned migrations, and a clean escape hatch to raw SQL |
| API | **Node.js + Express 5** | Small, explicit, no framework magic to explain |
| Validation | **Zod** | Every request is parsed and typed at the boundary |
| Frontend | **React 19 + Vite** | Fast builds, standard tooling |
| Styling | **Tailwind CSS v4** | No separate config file; styles live next to the markup |
| Language | **JavaScript** | Chosen for speed of delivery |

### Why a relational database, specifically

The brief's fourth requirement is a transactional-integrity problem, not a
storage problem:

- A transfer must move stock from one place to another **as one indivisible
  operation** — both halves, or neither.
- The server must **refuse any movement that would drive a location negative**.

That second one is a race condition. Two people issuing the last 5 units at the
same moment must not both succeed. Preventing that needs a real transaction with
row-level locking — `SELECT ... FOR UPDATE` — which a relational database gives
you natively.

Requirement 6 reinforces it: sorting a list by **on-hand quantity**, when on-hand
is a `SUM` over another table, is a join and a `GROUP BY`. That is a natural SQL
query and an awkward pipeline in anything else.

### Why no data-fetching library on the frontend

There is no React Query or SWR. Instead there is a 30-line `useFetch` hook.

The reason is the token-refresh logic. When several requests hit a `401` at the
same moment, they must share **one** refresh attempt — otherwise the second one
replays an already-rotated refresh token and the backend's theft detection logs
the user out. That coordination lives in `api/client.js` where it is visible and
explainable, rather than inside a library's interceptor.

---

## 4. How the pieces fit together

```
   Browser
      │
      │  HTTPS
      ▼
   Vercel ──────────────────────────────┐
   • serves the built React app         │  /api/*  proxied server-side
   • rewrites /api/* to the API         │
                                        ▼
                                   Railway
                                   • Express API
                                   • all business rules
                                        │
                                        │  TLS
                                        ▼
                                     Aiven
                                     • MySQL 8
                                     • constraints + triggers
```

Three separate pieces:

1. **The browser** holds no business rules. It hides buttons a staff member
   cannot use, but every one of those rules is enforced again on the server.
2. **The API** owns every rule. It is the only thing that talks to the database.
3. **The database** is not a passive store. It enforces the rules that must
   never be broken — even by a script or someone at a SQL prompt.

### Why `/api` is proxied rather than called directly

The browser never talks to Railway directly. Vercel forwards `/api/*`
server-side.

This is about the refresh-token cookie. If the page is on `vercel.app` and the
cookie is set by `railway.app`, it is a **third-party cookie** — which Safari
blocks by default. Sign-in would appear to work and then silently drop the
session on the next page load.

Proxying makes the browser see a single origin, so the cookie is first-party.
It also mirrors exactly what `vite.config.js` does in development, so local and
production behave identically.

---

## 5. The data model

Eleven tables. Here is each one, in plain terms.

### People and access

**`users`** — everyone who can sign in. Holds a bcrypt password hash (never the
password), a role of `MANAGER` or `STAFF`, and an `isActive` flag so an account
can be switched off without deleting its history.

**`refresh_tokens`** — the long-lived sessions. Each row stores a **SHA-256 hash**
of the token, never the token itself, so a leaked database does not hand over
live sessions. Rows are revoked rather than deleted, which is what makes reuse
detection possible.

**`locations`** — warehouses and shop floors. A code (`WH-MAIN`), a name, and an
`isActive` flag. **There is no delete.** A location that appears anywhere in the
ledger must keep existing, or its movements lose meaning.

**`location_assignments`** — the many-to-many join between staff and locations.
Its primary key is the pair `(userId, locationId)`, which makes a duplicate
assignment impossible at the database level. Managers deliberately have **no
rows here** — they act everywhere, so listing every location against every
manager would mean fixing up rows each time a location is created.

### The catalogue

**`categories`** — a short list managers maintain. Items reference it rather than
typing free text, so the filter list stays clean.

**`items`** — SKU, name, description, unit of measure, reorder level, category.

Archiving is `archivedAt DateTime?` rather than a boolean. A nullable timestamp
records *when* as well as *whether*, and restoring is simply setting it back to
null.

### The ledger — two tables, not one

This is the most important design decision in the schema.

**`stock_movements`** — the *semantic* record: what a human did.

| Column | Meaning |
|---|---|
| `kind` | `RECEIPT`, `ISSUE`, `TRANSFER` or `ADJUSTMENT` |
| `quantity` | Always positive, except adjustments which may be negative |
| `locationId` | For receipt/issue/adjustment. Null for a transfer |
| `sourceLocationId`, `destinationLocationId` | Both set for a transfer. Null otherwise |
| `reason` | Required for adjustments |
| `recordedById`, `occurredAt` | Who, and when |

**`stock_movement_lines`** — the *arithmetic*: signed deltas.

| Column | Meaning |
|---|---|
| `itemId`, `locationId` | What moved, and where |
| `quantityDelta` | Signed: `+25` arrived, `-3` left |

The relationship:

| Movement | Lines written |
|---|---|
| Receipt of 50 at WH-MAIN | one: `+50 @ WH-MAIN` |
| Issue of 8 at WH-MAIN | one: `-8 @ WH-MAIN` |
| **Transfer of 15, WH-MAIN → RT-NORTH** | **two: `-15 @ WH-MAIN` and `+15 @ RT-NORTH`** |
| Adjustment of -3 at WH-MAIN | one: `-3 @ WH-MAIN` |

**Why split them?** Three payoffs:

1. **On-hand becomes one clean query.** `SUM(quantityDelta)` grouped by location,
   with no `CASE` logic for each movement kind.
2. **A transfer cannot half-apply.** It is one movement with two lines written in
   one transaction. The two lines sum to zero — an invariant that can be checked
   in SQL and is asserted in the tests.
3. **The movement row still reads the way the brief describes it** — one row per
   human action, with its kind, quantity and locations.

`itemId` and `occurredAt` are duplicated onto the lines table. That is a
**deliberate denormalisation** so that every balance, filter and dashboard query
reads the lines table alone without joining back. It is kept honest by a
composite foreign key — see the next section.

### History and alerts

**`item_events`** — the timeline. Creation, each tracked field change with old and
new values, archive/restore, and free-text notes. All on one list, never edited.

**`alert_dismissals`** — a dismissal suppresses an item's low-stock alert while
`resolvedAt` is null. When stock rises above the reorder level, `resolvedAt` is
stamped, which re-arms the alert for the next time stock falls.

---

## 6. The ledger — the heart of the system

Everything above describes the shape. This section is about the guarantees.

### Guarantee 1: on-hand is never stored

There is no `quantity` column on `items`. Anywhere the system needs a stock
level it sums the ledger:

```sql
SELECT SUM(quantityDelta) FROM stock_movement_lines WHERE itemId = ?
```

The practical proof: the dashboard computes total stock **three different ways**
— by category, by location, and by item — and all three agree, because all three
read the same source.

### Guarantee 2: nothing can be edited or deleted

The application has no update or delete route for movements or timeline
entries. But "we didn't build the endpoint" only holds until somebody builds one.

So the rule is enforced by the **database itself** — six triggers:

```sql
CREATE TRIGGER trg_stock_movements_no_update BEFORE UPDATE ON stock_movements
  FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'stock_movements is append-only: rows cannot be updated';
```

…and the same for deletes, on `stock_movements`, `stock_movement_lines` and
`item_events`. A stray `prisma.update()`, a data-fix script, or a person at a
MySQL prompt all fail identically. Verified against the live database.

### Guarantee 3: stock can never go negative

Recording a movement happens inside one transaction that starts by taking a
write lock on the item:

```sql
SELECT id, sku, archivedAt FROM items WHERE id = ? FOR UPDATE
```

Without that lock, two people issuing the last units would both read the same
balance, both decide there was enough, and both insert. Locking the **item**
serialises movements for that item while leaving every other item free to
proceed in parallel.

**Tested, not assumed.** Ten units in stock, ten simultaneous requests for two
units each:

```
10 concurrent issues of 2 units each   5 succeeded, 5 rejected with 409
final on-hand                          0
```

### Guarantee 4: rules the database refuses to break

Some rules are too important to live only in JavaScript, so they are also
`CHECK` constraints:

| Constraint | Refuses |
|---|---|
| `chk_movement_shape` | A transfer without both locations, a transfer to its own source, or a receipt carrying a source |
| `chk_movement_adjustment_reason` | An adjustment with a missing or whitespace-only reason |
| `chk_movement_positive_unless_adjustment` | A negative or zero receipt, issue or transfer |
| `chk_line_delta_nonzero` | A ledger line that moves nothing |
| `chk_item_reorder_level_nonnegative` | A negative reorder level |

And the denormalised columns are held in place by a composite foreign key:

```sql
stock_movements       UNIQUE (id, itemId, occurredAt)
stock_movement_lines  FOREIGN KEY (movementId, itemId, occurredAt)
                      REFERENCES stock_movements (id, itemId, occurredAt)
```

A line cannot claim a different item or timestamp than its parent movement. An
unexpected bonus: because those columns now belong to the relation, **Prisma will
not let you set them on a nested line at all** — it fills them from the parent.
The mismatch is not just rejected, it is inexpressible.

### The full order of checks

When a movement is recorded, in one transaction:

1. **Lock** the item row (`FOR UPDATE`)
2. **Reject** if the item is archived
3. **Load** every location the movement touches
4. **Check permission** — staff must be assigned to *every* location involved,
   which for a transfer means both ends
5. **Check the destination accepts stock** — a deactivated location takes no new
   stock, though stock can still be taken *out* of it
6. **Check availability** — for every line that removes stock, the current
   balance must cover it
7. **Insert** the movement and its lines
8. **Re-arm** any dismissed low-stock alert if the item recovered

If any step throws, the whole transaction rolls back and nothing is written.

---

## 7. Who can do what

### The two roles

| Action | Manager | Staff |
|---|---|---|
| Create, edit, archive items | ✅ | ❌ |
| Create categories and locations | ✅ | ❌ |
| Set reorder levels | ✅ | ❌ |
| Assign staff to locations | ✅ | ❌ |
| Record **adjustments** | ✅ | ❌ |
| Record receipts, issues, transfers | everywhere | **only at assigned locations** |
| Dismiss low-stock alerts | ✅ | ❌ |
| View items, movements, dashboard, alerts | ✅ | ✅ |
| Leave notes on an item | ✅ | ✅ |

Adjustments are manager-only because staff record **what physically happened**;
correcting a count against the ledger is a judgement, not an observation.

That rule is checked in the *service*, not the route, because it is a rule about
the request **body** (`kind: 'ADJUSTMENT'`) rather than the URL — both roles post
to the same endpoint.

### How authentication works

Two tokens with different jobs:

**Access token** — a JWT, 15 minutes, sent as `Authorization: Bearer`. Kept in a
JavaScript variable, never `localStorage`, so an injected script cannot read it.
It carries only `{ role, sub, iat, exp }` — no email or name, since anyone can
decode a JWT.

**Refresh token** — an opaque random string, 7 days, in an httpOnly cookie the
browser sends automatically. Deliberately *not* a JWT: the server has to look it
up in the database anyway to check it has not been revoked, so signing it would
add work without adding a guarantee. Only its SHA-256 hash is stored.

**Rotation.** Each refresh token is single-use. Using one revokes it and issues a
replacement.

**Reuse detection.** If an already-revoked token is presented, the system assumes
it was copied and revokes **every** session that user has. That is a deliberate
trade-off: a stolen token logs the real user out everywhere, which is safer than
letting a thief ride along.

**Why `requireAuth` re-reads the user on every request.** It costs one indexed
lookup and buys instant effect: deactivating an account or changing a role takes
effect on the very next request, rather than whenever the access token happens
to expire. Location assignments come from the same query, so those apply
immediately too — demonstrated by assigning a location in one browser and seeing
it appear in another without re-login.

---

## 8. The API, endpoint by endpoint

34 routes. Every response is JSON; every error has the shape
`{ error: { code, message, details? } }`.

### `/api/auth`

| Route | Who | Does |
|---|---|---|
| `POST /login` | anyone | Email + password → access token in body, refresh token in cookie |
| `POST /refresh` | cookie | Rotates the refresh token, returns a new access token |
| `POST /logout` | cookie | Revokes server-side **and** clears the cookie |
| `GET /me` | bearer | Current user and their assigned location ids |

Login is rate limited to 20 **failed** attempts per 15 minutes. Successes are not
counted — rate limiting exists to slow password guessing, and a successful
sign-in is not an attempt at that.

Every failure returns the same message (`Invalid email or password`), and an
unknown email is still compared against a dummy bcrypt hash so the response takes
the same time. Otherwise the endpoint would reveal which emails exist.

### `/api/items`

| Route | Who | Does |
|---|---|---|
| `GET /` | all | The searchable, filterable, sortable, paginated list |
| `GET /:id` | all | One item |
| `GET /:id/stock` | all | On-hand by location, plus the total |
| `GET /:id/timeline` | all | The append-only history |
| `POST /` | manager | Create |
| `PATCH /:id` | manager | Edit — writes a timeline entry per changed field |
| `POST /:id/archive`, `POST /:id/restore` | manager | Toggle archived state |
| `POST /:id/notes` | all | Add a note to the timeline |

`GET /api/items` is the one endpoint that drops to raw SQL. Sorting by `onHand`
means sorting by a `SUM` over a related table, which Prisma's query API cannot
express — you would have to fetch every item, sum in JavaScript, sort, then
slice, which is exactly what the brief forbids.

```sql
SELECT i.*, c.name AS categoryName,
       CAST(COALESCE(total.qty, 0) AS SIGNED) AS onHand
FROM items i
JOIN categories c ON c.id = i.categoryId
LEFT JOIN (SELECT itemId, SUM(quantityDelta) AS qty
           FROM stock_movement_lines GROUP BY itemId) total ON total.itemId = i.id
WHERE (i.name LIKE ? OR i.sku LIKE ?) AND i.categoryId = ?
      AND COALESCE(total.qty, 0) <= i.reorderLevel
ORDER BY onHand DESC, i.id ASC
LIMIT ? OFFSET ?
```

**Every user value is a bound `?` parameter.** The only interpolated piece is the
sort column, and it comes from a hardcoded map that a Zod enum selects the key
for — user input never reaches it.

### `/api/movements`

| Route | Who | Does |
|---|---|---|
| `GET /` | all | Filter by item, location or kind; paginated, newest first |
| `POST /` | all | Record a movement — the ledger write described above |

Filtering by location matches **both ends of a transfer**, so a transfer appears
in the history of its source and its destination.

There is no `PATCH` and no `DELETE`. That is the point.

### `/api/categories`, `/api/locations`, `/api/users`

Read access is open to both roles (you need category names to file an item, and
location names to read a movement). Writes are manager-only.

Two rules worth noting:

- **A category in use cannot be deleted**, and the error says how many items are
  blocking it.
- **A manager cannot change their own role or active status.** The last manager
  demoting themselves would lock everyone out of every manager route with no way
  back through the API. They can still rename themselves, and still demote *other*
  managers.

### `/api/imports` and `/api/exports`

| Route | Who | Does |
|---|---|---|
| `POST /imports/items` | manager | Bulk item import from CSV |
| `POST /imports/receipts` | all | Bulk receipt import from CSV |
| `GET /exports/stock-position` | all | CSV of on-hand by location |

**Per-row isolation** falls out of the design rather than needing machinery.
`createItem()` and `recordMovement()` each open their own transaction, so the
import loops and catches:

```js
for (const { line, row } of rows) {
  try { await handleRow(row); report.imported += 1; }
  catch (error) { report.failures.push({ line, sku: row.sku, error: describeFailure(error) }); }
}
```

A failed row rolls back only itself:

```
10 rows: 4 imported, 6 failed
   line 4   FST-1001   A record with that value already exists
   line 5   IMP-0003   Unknown category "Plumbing" — create it first
   line 6   IMP-0004   Reorder level must be a whole number
   line 9   -          SKU is required
```

`line` is the **real line number in the uploaded file**, taken from the CSV
parser, so blank lines do not shift it and the number matches what the user sees
in their editor.

Because imports go through the same services as the API, every rule still
applies per row — a staff member importing receipts is checked against their
assignments line by line, and archived items are still refused.

The export is sent with a `Content-Disposition` filename and a **UTF-8 byte order
mark**, so Excel opens it as UTF-8 instead of mangling non-ASCII names.

### `/api/dashboard` and `/api/alerts`

The dashboard returns everything the landing page needs in one request: four
headline figures, stock by category, stock by location, and eight weeks of
receipt and issue volume. Empty weeks are padded to zero so the chart always has
eight points.

Alerts list items at or below their reorder level, worst shortfall first.
Dismissing hides one until the item recovers.

---

## 9. The frontend

### Structure

```
src/
  api/         client.js (the only file that talks to the API), endpoints.js
  components/  layout, tables, dialogs, form modals, charts, UI primitives
  context/     AuthContext (who you are), AlertsContext (the nav badge count)
  hooks/       useFetch, useDebounced, useQueryParams, useMediaQuery
  pages/       Login, Dashboard, Items, ItemDetail, Movements, Alerts,
               DataTransfer, Admin
```

### The API client

`api/client.js` holds the whole token strategy in one readable file:

- The access token lives in a **module variable**, not `localStorage`.
- The refresh token is the **httpOnly cookie**, sent automatically by
  `credentials: 'include'`.
- On any `401`, refresh once and retry — which is what makes a 15-minute token
  invisible to the user.
- **Concurrent 401s share one refresh.** This is the subtle part:

```
401  GET   /api/auth/me          ← two calls fire together
401  GET   /api/auth/me
200  POST  /api/auth/refresh     ← only ONE refresh
200  GET   /api/auth/me          ← both retried
200  GET   /api/auth/me
```

Without that de-duplication the second call would replay an already-rotated
token and trip the backend's theft detection, logging the user out. The frontend
and backend had to be designed together here.

### List state lives in the URL

The items list keeps its search, filters, sort and page in the query string:

```
/items?search=a&sort=onHand&direction=desc&page=2
```

So a filtered view can be bookmarked or pasted to a colleague, survives a
reload, and the back button steps through filter history. Values equal to their
default are stripped, so a plain view stays `/items`.

### Route guards are convenience, not security

`RequireAuth` hides the Admin link from staff and redirects them if they type the
URL. Every rule it expresses is enforced again on the server — the 403 is the
real control; the hidden link is a courtesy.

### The interface

A collapsible sidebar (a drawer below 1024px), dense data tables with sticky
headers, pill badges using a semantic palette — **emerald** in stock, **amber**
low, **rose** out of stock — and `tabular-nums` on every figure so columns align
digit-for-digit.

The dashboard chart is hand-written inline SVG rather than a charting library:
about 40 lines, no dependency, with a custom tooltip and a table view so no value
is reachable only by hovering. Its two series colours were run through a
colour-blindness validator rather than eyeballed (ΔE 24.7 against a target of 8).

---

## 10. A request, traced end to end

**A staff member records a receipt of 25 units at WH-MAIN.**

1. **Browser.** They open an item, click *Record movement*, pick Receipt, choose a
   location and enter 25. The location dropdown only offers locations they are
   assigned to — read from `user.locationIds`.

2. **Client.** `api.post('/movements', {...})` attaches the access token and
   `credentials: 'include'`.

3. **Vercel.** The `/api/movements` request matches the rewrite and is forwarded
   server-side to Railway. The browser still believes it is a same-origin call.

4. **Express.** `helmet` → `cors` → `express.json()` → `cookieParser` → the
   movements router.

5. **`requireAuth`.** Verifies the JWT, then loads the user *from the database*
   along with their location assignments, and puts them on `req.user`.

6. **`validate(createMovementSchema)`.** A Zod discriminated union on `kind`
   means a receipt is checked for exactly the fields a receipt needs. The parsed,
   coerced result replaces `req.body`.

7. **`recordMovement()`** opens a transaction and runs the eight steps from
   section 6 — lock, archived check, load locations, permission, destination
   accepts stock, availability, insert, re-arm alerts.

8. **MySQL.** Beyond what the service checked, the `CHECK` constraints validate
   the row shape and the composite foreign key validates the lines. Commit.

9. **Response.** `201` with the created movement.

10. **Back in the browser.** The item page reloads its stock, its history and its
    header, and asks the alerts context to refresh — so the nav badge updates
    immediately if this receipt lifted the item above its reorder level.

If anything fails — say another user took the last units a moment earlier — the
transaction rolls back and the user sees the server's own message in the dialog:

```
Not enough stock at WH-MAIN: 24 on hand, 99999 requested
```

---

## 11. Decisions worth defending

**On-hand is derived on every read, not cached.** Correct, and fast at this scale
(~1ms over 293 ledger lines). It is also the honest answer to "what breaks first
at 100× the data?" — the item list re-sums the whole lines table on every
request. The fix is a `stock_balances` rollup maintained inside the same
transaction as each ledger write: still derived, just not re-derived per request.
Deliberately **not built**, because it is a real cost with no benefit at this
size, and a documented trade-off with a known remedy is worth more than a
premature optimisation.

**The ledger is two tables.** More tables, far less logic. Every balance query is
one `SUM` with no branching, and a transfer physically cannot half-apply.

**Refresh tokens are opaque, not JWTs.** The database is consulted anyway to
check revocation, so a signature would add work without adding a guarantee.

**A stolen refresh token logs the user out everywhere.** A deliberate choice:
disruptive, but safer than letting an attacker ride alongside the real user.

**Deactivated locations refuse incoming stock but allow outgoing.** One rule —
`quantityDelta > 0 && !isActive` — covers receipts, transfer destinations and
positive adjustments. If it blocked everything, stock would be stranded the
moment a location was deactivated. You retire a location by draining it.

**Locations have no DELETE.** The foreign keys are `RESTRICT`, so the database
would refuse once any movement referenced one. An endpoint that works only until
a location is used is worse than no endpoint; `isActive: false` retires one.

**`at or below reorder` always means the total across all locations**, even when
the list is filtered to one location — the same definition the alerts use.
Otherwise "low stock" would mean two different things in two places.

**The process is pinned to UTC.** Day and week boundaries have to mean the same
thing in JavaScript as in MySQL. Without it, a server west of UTC silently
produced an empty dashboard chart.

**The seed goes through the real services.** Demo data obeys the same rules as
anything a user records. This caught a genuine bug: the seed tried to have a
staff member record at a location they do not cover, and the access check
rejected it. The seed was fixed, not the rule.

---

## 12. What was deliberately not built

- **The `stock_balances` rollup table** — see above.
- **Any stretch goal** — barcode lookup, reorder suggestions, unit conversion,
  cycle counts, suppliers, email digests, batch tracking, pick lists. The brief is
  explicit that ten goals done well beats twelve done badly.
- **Self-registration.** The brief never asks for it; managers create accounts.
- **Password reset.** Out of scope for a demo.
- **Dark mode.** The app commits to one light theme consistently. The chart is
  written against CSS custom properties, so adding it later is a token swap.
- **A card layout for tables on phones.** Tables scroll horizontally instead.
  Column alignment is what makes stock levels scannable, and stacking loses it.

---

## 13. Bugs found, and how

Worth recording, because each was found by a different technique.

**The debounce race.** Clearing the search filters silently un-cleared itself — a
pending 300ms timer fired *after* the clear and wrote the old term back into the
URL. The first fix looked right and did not work: both effects run in the same
pass, so `setSearchInput('')` had not applied yet when the debounce effect read
it. A `useRef` updates synchronously and fixed it properly.

**Stale rows during a refetch.** After the first load there was no loading
indicator, so changing a filter left the old numbers on screen looking current.
Found because a test kept reading data one step behind — the test was right and
the UI was lying.

**The login and `/auth/me` shape mismatch.** `POST /auth/login` returned a user
without `locationIds`; `GET /auth/me` included it. So immediately after signing
in, `user.locationIds` was `undefined`, and the movement modal — which computes
allowed locations on every render, even while closed — crashed the whole item
page. It only happened "sometimes" because any page reload calls `/auth/me` and
repopulated the field.

The deeper lesson was in the *testing*: every suite did `signIn()` then
`page.goto()`, and that full page load masked the bug. The tests were navigating
in a way a real user never does. There is now a click-through suite that reaches
every route by clicking only.

**The transaction timeout.** Found by deploying. Seeding against a database
240ms away failed at 228 rows with `Transaction already closed: 5176ms passed,
timeout was 5000ms`. Prisma's default assumes the database is next door, but
recording a movement makes about eight round trips. Raised to 20 seconds across
all six interactive transactions. In production the API sits beside the database
and these finish in tens of milliseconds — the headroom is for when they do not.

**The native browser dialog.** Renaming a category used `window.prompt`, which
ignores the design entirely and — more importantly — cannot show a server error.
Replaced with real dialogs. Deleting a category now also asks first, and when the
server refuses, the reason appears *inside* the dialog rather than in a banner
after it has closed.

---

## 14. Running it locally

**Requirements:** Node 20+, MySQL 8.

```bash
# Backend
cd backend
npm install
cp .env.example .env          # fill in DATABASE_URL and JWT_ACCESS_SECRET
npx prisma migrate deploy     # create the schema
npm run seed                  # demo data
npm run dev                   # http://localhost:4000

# Frontend, in another terminal
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

No `frontend/.env` is needed. `vite.config.js` proxies `/api` to port 4000, so
the browser sees one origin — the same arrangement as production.

**Demo accounts** — all use the password `Inventory@2026`:

| Role | Email | Can act at |
|---|---|---|
| Manager | `manager@demo.test` | everywhere |
| Manager | `manager2@demo.test` | everywhere |
| Staff | `staff@demo.test` | WH-MAIN, RT-NORTH |
| Staff | `staff2@demo.test` | RT-SOUTH |
| Staff | `staff3@demo.test` | WH-MAIN, SITE-A, RT-NORTH |

**Useful scripts**

| Command | Does |
|---|---|
| `npm run dev` | API with auto-restart |
| `npm run seed` | Seed demo data (idempotent — skips movements if any exist) |
| `npm run db:reset` | Drop, re-migrate and reseed |
| `npm run studio` | Prisma's database browser |
| `LOG_QUERIES=true npm run dev` | Print every SQL statement |

The seed produces the same data every time — the random generator is seeded — so
the demo is reproducible: 5 users, 4 locations, 5 categories, 15 items and 263
movements across nine weeks.

---

## 15. How it is deployed

| Piece | Host | Notes |
|---|---|---|
| MySQL 8 | **Aiven** | Real MySQL — needed for foreign keys, `CHECK` constraints and triggers |
| API | **Railway** | Root directory `backend` |
| Frontend | **Vercel** | Root directory `frontend` |

### The database host matters

The schema relies on foreign keys, `CHECK` constraints and `CREATE TRIGGER`. That
rules out MySQL-*compatible* distributed databases: PlanetScale does not support
foreign keys by default, and TiDB Cloud does not support triggers at all — the
second migration would fail outright.

Verified on the live database: 11 tables, 18 foreign keys, 6 `CHECK` constraints,
6 triggers, and a reasonless adjustment genuinely rejected by
`chk_movement_adjustment_reason`.

### Build and start

**Railway** — root directory `backend`:

```
Build:  npm ci && npx prisma generate && npx prisma migrate deploy
Start:  npm start
Health: /api/health
```

Environment: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `NODE_ENV=production`,
`TZ=UTC`, `CORS_ORIGINS`. `PORT` is injected by Railway.

**Vercel** — root directory `frontend`, build `npm run build`, output `dist`.
**`VITE_API_URL` is deliberately left unset** so the client calls same-origin
`/api`, which `vercel.json` proxies.

### `vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<railway-domain>/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Two jobs: proxy the API so the refresh cookie stays first-party, and serve the
app shell for client-side routes like `/items/4` so a refresh does not 404. Order
matters — `/api` must come first.

### Region matters

Every screen makes several database queries. From a laptop, a round trip to
Aiven measured **240ms**; the same query in-region is under 5ms. Railway and
Aiven should be in the same region, and seeding should be run from Railway rather
than a laptop — it is the difference between seconds and ten minutes.

---

## In one paragraph

This is an inventory system built around a single idea: **never store the
quantity, store the events**. Every receipt, issue, transfer and adjustment is
written to an append-only ledger that nobody — not even a manager, not even
someone at a SQL prompt — can edit or delete, because the database itself
refuses. Stock on hand is always the sum of that ledger, so the number on screen
cannot drift from the record behind it. Around that core sit the things that make
it usable day to day: roles and per-location permissions enforced on the server,
server-side search and filtering, CSV import that reports exactly which rows
failed and why, a dashboard that reads the same ledger three different ways and
agrees with itself, and low-stock alerts that come back on their own when stock
recovers and falls again.
