# AI prompts

I used Claude Code inside my editor for this build. The method was the same throughout: **I wrote the specification, it produced the first draft, I reviewed the draft against the spec, and it changed until it matched.** Twice the review turned into a redesign — once after the system was already deployed and seeded.

Two rules I set at the start and held to:

- **One feature at a time, and features stay independent.** Each one had to work and be reviewable on its own before the next started. That's why the git history is 18 incremental commits rather than one drop.
- **I keep git.** Nothing was committed by the tool. Every commit is a point where I was actually satisfied with what was in front of me.

I wrote the prompts below to be specific rather than conversational, because vague prompts produce plausible code that misses the requirement. Each one carries the same four things: **context** (what exists already and what this depends on), **the requirement and why it's that and not the obvious alternative**, **explicit must / must-not pairs**, and **the edge cases I expected to be handled**. Where a decision hinged on how a specific technology behaves, I linked the documentation in the prompt so the answer would be grounded in it rather than in recollection.

Things I owned directly, outside the prompting: the local environment (both servers, ports, `CORS_ORIGINS` in `.env`), every database operation (migrations, resets, re-seeds), the entire deployment chain (Aiven, Railway region, Vercel rewrites, every production environment variable), and finding bugs by using the application — three of the four bad outputs below I hit as a user first and traced backwards.

---

# Phase 0 — Stack and skeleton

**Context.** Nothing exists yet. I wanted the reasoning on record before any code could anchor it.

### Prompt 0.1 — analysis only

> Read `README.md` and `SUBMISSION.md` in this repo. This is a take-home for an SDE role with a 12-hour budget and ten mandatory goals.
>
> Tell me what stack you'd pick and why. **Analysis only — do not write any code yet.**
>
> Specifically address: the brief says on-hand quantity must never be stored and always derived by summing a ledger. Which database choice makes that easier or harder, and does an ORM help or get in the way when the core read is an aggregate?

### Prompt 0.2 — my decision, and the working method

> I've decided: **Node, React, plain JavaScript, MySQL via Prisma.** Two top-level folders, `backend` and `frontend`.
>
> Plain JavaScript, not TypeScript — deliberately. The brief says no stack scores better than another and that time spent learning something new is time not spent on the ten goals. I'm fastest in JS and I'd rather spend the budget on the ledger design than on type gymnastics around Prisma's generated types.
>
> Set up the skeleton only: Express 5, Prisma, a health route, and the folder structure. Every feature module must have exactly four files — `routes` (paths and guards), `schemas` (validation), `controller` (thin: unwrap request, call service, return JSON), `service` (business rules). **Prisma may only be imported inside services.** If I have to read three files to find out what a receipt does, the structure is wrong.
>
> Rules for the whole project: build one feature at a time and stop after each so I can review. Mandatory goals only — I'll decide on stretch items later. **Do not run git commands; I'll handle commits myself.** Ask me if you need credentials or hit an ambiguity rather than guessing.

**What came back.** The module layout above, which held unchanged for all eleven modules.

---

# Feature 1 — Accounts and roles

*Large: split into two phases, because session handling and authorisation are independent problems and I wanted to review them separately.*

## Phase 1a — Sessions

**Context.** Goal 1 needs email/password sign-in. Everything after this depends on `req.user` existing, so it goes first.

### Prompt 1.1

> Build authentication. Email and password sign-in, with `users` having `email`, `passwordHash`, `name`, `role` (enum `MANAGER` / `STAFF`), `isActive`.
>
> **Design assumption: assume XSS is possible on the frontend, and assume the database can leak.** I don't want either failure to hand over a working session. Design against both, and explain the choice before writing it.
>
> Requirements, with reasoning:
> - Short-lived access token (15 min) as a JWT, carrying `id`, `role`, and the user's assigned location IDs, so route guards don't need a database round trip.
> - **The access token must never touch `localStorage`** — hold it in a module variable on the client. `localStorage` is readable by any script on the page, so one XSS is a stolen session.
> - Refresh token (7 days) in an **httpOnly, secure cookie**, so JavaScript can't read it at all. See the flags here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
> - Store the refresh token **hashed (SHA-256)**, never raw. A database leak should not yield usable sessions.
> - **Rotate on every use.** If an already-rotated token is presented, treat it as theft and revoke the entire family, not just that token. Reference: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
>
> Must / must not:
> - A deactivated user (`isActive = false`) **must not** be able to sign in, and **must not** be able to refresh an existing session either. Deactivation that only blocks the login form is theatre.
> - `/auth/login`, `/auth/refresh` and `/auth/me` **must return an identical user object shape.** If one omits a field the others include, the client will crash on whichever path it happens to take first.
> - A failed login **must not** reveal whether the email exists. Same message, and same response time — compare against a dummy hash when the user isn't found, or the timing difference leaks which addresses are real.
>
> Errors as JSON, consistently: `{ "error": { "code": "...", "message": "..." } }`. No stack traces or raw Prisma errors in responses.

**What came back.** The scheme as specified, plus a rate limiter on login I hadn't asked for. I kept it but had it changed to `skipSuccessfulRequests: true` — someone typing their password correctly should never be counted toward a lockout; only repeated failures should throttle.

**What I corrected later — bad output #1.** Login returned a user object *without* `locationIds` while `/auth/me` returned one *with* it. Signing in and using the app immediately crashed with `Cannot read properties of undefined (reading 'includes')`, but reloading fixed it — because a reload goes through `/auth/me`. I'd written the must-not above precisely to prevent this and it happened anyway, which is why I stopped trusting spec compliance and started checking it.

## Phase 1b — Authorisation

**Context.** Sessions exist. Now the role difference has to be real.

### Prompt 1.2

> Add role enforcement. Goal 1 is explicit: *"The difference must be enforced on the server, not just hidden in the interface."* Assume the frontend is hostile — someone will call these endpoints with curl and a staff token.
>
> Two guards: `requireAuth` (valid access token) and `requireRole('MANAGER')`. Put them on the routes, not inside services, so I can read one routes file and see the whole permission surface for a module.
>
> Manager-only: create/edit/archive items, create locations, create categories and units, create users, assign staff to locations, record **adjustments**, dismiss alerts, import items.
>
> Staff may: record receipts, issues and transfers **only at locations they're assigned to**, read everything, add timeline notes, import receipts, export.
>
> Why adjustments are manager-only even though staff record everything else: a receipt, issue or transfer is an observation of something that physically happened. An adjustment is a *decision* to overrule the ledger — it's how a miscount gets papered over, so it needs to sit with someone accountable.
>
> Must / must not:
> - Staff hitting a manager route **must** get `403`, not `404` and not a silently empty result.
> - No token **must** give `401`, and an expired token also `401`, so the client knows to refresh rather than to give up.
> - Location scope **must** be checked on **both ends of a transfer**. A staff member assigned only to WH-MAIN transferring WH-MAIN → RT-SOUTH must be refused. Checking only the source is the obvious bug here and I want it explicitly avoided.
> - The error **must** name the location: `"You are not assigned to RT-SOUTH"`, not `"Forbidden"`.

---

# Feature 2 — Items and categories

*Medium: two phases, because the reference data has to exist before items can point at it.*

## Phase 2a — Reference data

### Prompt 2.1

> Build `categories` as a managed reference table with CRUD, manager-only for writes.
>
> Goal 2 says categories are *"a short list that managers maintain, not free text typed per item."* So the item must hold a **foreign key**, not a string — a string means `Fasteners`, `fasteners` and `Fastners` become three categories, and the category filter in goal 6 silently breaks.
>
> Must / must not:
> - Name trimmed and unique, case-insensitively. Creating `"  Fasteners  "` when `Fasteners` exists **must** be rejected with `409`.
> - Deleting a category that items reference **must** be refused with a message naming the count: `"Fasteners" is used by 3 item(s) and cannot be deleted`. Don't cascade, and don't null the items' category — both silently damage data to make a delete succeed.
> - Response shape `{ "categories": [...] }`, each with `id`, `name`, and the item count.

## Phase 2b — Items

### Prompt 2.2

> Build items CRUD. Fields per goal 2: `sku`, `name`, `description`, unit of measure, `reorderLevel`, `categoryId`. Manager-only for writes.
>
> Archive is a **soft state** (`archivedAt` timestamp, nullable), not a delete. Goal 2: *"Archiving removes an item from day-to-day lists and blocks new movements against it, without destroying its movement history."* A hard delete would take the ledger with it, which contradicts goal 4 outright.
>
> Must / must not:
> - SKU unique, stored **upper-case**, trimmed. `fst-1001` and `FST-1001` are the same SKU.
> - `reorderLevel` **must** be a non-negative integer. Reject `-1`, `2.5` and `"abc"` with a message naming the field.
> - An archived item **must** reject new movements with `409` and a message saying so — but its existing movements and timeline **must** remain fully readable.
> - Archiving an already-archived item **must** be a no-op or a clear `409`, never a 500.
> - Default item list excludes archived; `?archived=all` includes them; `?archived=archived` shows only those. An invalid value **must** be `400`, not silently treated as the default.

---

# Features 3 & 4 — Stock movements and the ledger

*The largest piece, and the centre of the whole brief. Three phases: schema, then the write path, then database-level enforcement. I deliberately did the schema as its own reviewable phase, because everything above it inherits its mistakes.*

## Phase 4a — Ledger schema

### Prompt 4.1

> Design the ledger tables. Do not write the service yet — **schema and reasoning only**, I want to review the shape before anything depends on it.
>
> Hard constraints from goal 4:
> - On-hand is **never stored**, only derived. There must be no balance column anywhere in the schema. If you're tempted to add one "for performance", don't — that's the exact drift the brief describes as the problem.
> - A transfer moves stock as **a single indivisible operation**. It must be *impossible to represent* a transfer that debited the source but never credited the destination — not merely unlikely, impossible.
> - The server refuses any movement that would drive a location negative.
>
> Show me the table design and tell me what a balance query looks like under it. Specifically justify: if you propose more than one table, why isn't a single `stock_movements` table with a signed quantity and nullable source/destination enough? I want the trade-off stated, not assumed.
>
> Also tell me what you'd denormalise and what that costs.

**What came back.** Two tables. `stock_movements` holds the semantic record — what a person did — and `stock_movement_lines` holds signed arithmetic. A receipt writes one movement and one line; a transfer writes one movement and two lines summing to zero.

The argument that convinced me: with lines, on-hand at a location is `SUM(quantityDelta) WHERE locationId = ?` — **the same expression for every kind**, with no `CASE WHEN kind = 'TRANSFER'` anywhere. A transfer is one event to a human and two entries to arithmetic, and forcing one row to be both is where the bugs come from.

### Prompt 4.2 — challenging the denormalisation

> You've put `itemId` and `occurredAt` on `stock_movement_lines` as copies of the parent movement. I accept the reason — balance, filter, dashboard and alert queries then read one table instead of joining.
>
> But those copies can drift. What stops a line claiming an `itemId` its movement doesn't have?

**First answer, which I rejected:** the service layer always writes them together via a nested create, so they can't diverge. That's a convention, and conventions last exactly as long as the next developer who doesn't know about them. Not good enough for the core invariant of the system.

### Prompt 4.3

> Give me a structural guarantee instead of a procedural one. Can the database itself refuse a line whose `itemId` or `occurredAt` disagrees with its parent movement?
>
> Note that MySQL requires a foreign key to reference an indexed column list — see https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html — so this may need an extra unique index on the parent that looks redundant against its primary key. If so, add it and comment *why*, so it doesn't get "cleaned up" later.

**What came back — the piece of the schema I'd most want to be asked about:**

```prisma
movement StockMovement @relation(
  fields:     [movementId, itemId, occurredAt],
  references: [id,         itemId, occurredAt]
)
```

backed by `@@unique([id, itemId, occurredAt])` on the parent. A line that disagrees with its movement now has no parent row to point at, so the insert fails at the database. The denormalisation stopped being a risk I manage and became one that **can't be expressed.**

## Phase 4b — The write path

### Prompt 4.4

> Now build `recordMovement()`. One service function, all four kinds, everything in one transaction.
>
> Put the entire sign convention in **one function** I can read end to end — a receipt adds, an issue subtracts, an adjustment applies its own sign, a transfer produces two opposite lines. Don't spread signs across the service.
>
> **Concurrency — the case I care most about.** Two people issue the last 10 units of the same item simultaneously. Both read "10 available", both pass the check, the location goes to −10. Goal 4 says the server must refuse that, and "refuses it unless two people click at once" doesn't satisfy the goal. Do not tell me the transaction alone handles it — under InnoDB's default REPEATABLE READ, two concurrent reads both see 10.
>
> Use a locking read on the item row before any balance is read: https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html — and tell me why you chose that over optimistic concurrency with a version column and retries.
>
> Validate with Zod using a **discriminated union on `kind`**, so each kind carries exactly the fields it needs and the error names the kind that failed rather than listing every field on every kind.
>
> Must / must not, by kind:
> - `RECEIPT` / `ISSUE` / `ADJUSTMENT`: exactly one `locationId`, and **must not** accept `sourceLocationId` or `destinationLocationId`.
> - `TRANSFER`: **must** have both endpoints, **must not** have `locationId`, and the two **must differ**. Same-location transfer → `400`.
> - `ADJUSTMENT`: `reason` mandatory and non-blank. `" "` **must** be rejected. Goal 4 says the server rejects one submitted without it.
> - `ADJUSTMENT` is the **only** kind that may carry a negative quantity. Everything else is a positive magnitude, with direction coming from the kind.
> - Quantity `0` rejected for every kind, including adjustments — a zero-quantity movement is a no-op that pollutes history.
> - `occurredAt` optional (defaults to now) and backdatable, but **must not** be in the future. The ledger records what already happened.
> - Insufficient stock → `409` with a message naming the location and both numbers: `"Not enough stock at WH-MAIN: 12 on hand, 9999 requested"`. Not a bare "insufficient stock".
> - Archived item → `409`.
> - Inactive location **must** refuse an incoming receipt, but **must still allow stock to be issued out.** Closing a site shouldn't strand the stock sitting in it — that asymmetry is deliberate, implement it.
>
> Order of checks inside the transaction matters: lock first, then read balances. A permission check that runs after a balance read is a race.

**What I verified rather than accepted.** I had it tested with 10 simultaneous issues of 2 units against 10 in stock. **Exactly 5 succeeded, final balance 0**, and the 5 that lost got a clean `409` rather than a 500. That test is why I'm confident in the lock rather than hopeful about it.

## Phase 4c — Database-level enforcement

### Prompt 4.5

> Goal 4 says the ledger can never be changed or removed. Goal 9 says the same of the timeline, *"including by managers."*
>
> Not having an endpoint for it doesn't satisfy that — it's a promise about today's code, and one `prisma.update()` in six months breaks it silently. I want enforcement the application cannot bypass, so that a future migration, a script, or someone in a SQL console at 2am is refused the same as my own code.
>
> Add to the migration, as raw SQL:
> - `BEFORE UPDATE` and `BEFORE DELETE` triggers on `stock_movements`, `stock_movement_lines` and `item_events`, each raising `SIGNAL SQLSTATE '45000'` with a message naming the table. Reference: https://dev.mysql.com/doc/refman/8.0/en/signal.html
> - CHECK constraints for the shape rules so they're enforced even on a direct insert: transfer-shape vs single-location-shape, quantity non-zero, positive-unless-adjustment, adjustment-must-have-reason, line delta non-zero, reorder level non-negative. Reference: https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html
>
> Tell me what this costs, honestly — I'm aware triggers are invisible if you only read the Prisma schema, and that not every managed MySQL supports them. Flag anything that might not survive a hosted provider.

**What I corrected — bad output #2.** The first migration wouldn't apply. MySQL refuses a CHECK constraint on a column a foreign key might `SET NULL`, and the location columns on `stock_movements` were `SET NULL`. The proposed fix was to **drop the CHECK**. I rejected that and had the foreign keys changed to `RESTRICT` instead — which on reflection is more correct anyway: a location appearing anywhere in the ledger should never be deletable, because blanking it would silently rewrite history.

---

# Feature 5 — Location assignment

*Small: one prompt.*

### Prompt 5.1

> Build staff-to-location assignment. Goal 5: any staff member can be assigned to any number of locations, and a location can have any number of staff. Manager-only for writes.
>
> Model it as a **real join table with a composite primary key `(userId, locationId)`**, not an implicit many-to-many. Two reasons: the composite key makes a duplicate assignment impossible at the database level rather than needing a `findFirst` check first, and the assignment carries its own data — `assignedById` and `assignedAt` — because goal 5 cares who granted access.
>
> Must / must not:
> - Setting a user's locations **must be all-or-nothing.** If one location ID in the list is invalid, the whole request fails and nothing changes — a partial assignment silently grants the wrong access.
> - Assigning the same location twice **must not** create two rows.
> - Removing a location from a staff member **must not** touch any movement they already recorded there. History is history.
> - Assigning locations to a **manager** should be accepted but has no effect on their permissions — managers act everywhere. Don't special-case it into an error; just document it.

---

# Feature 6 — Finding items

*Medium: one prompt, but a detailed one, because this is where "do it in the browser" is tempting.*

### Prompt 6.1

> Build `GET /items` with search, filtering, sorting and pagination. Goal 6 is explicit: *"All of this must happen on the server — do not load every item into the browser and filter there."*
>
> Required: text search over **name and SKU**, filters for category, location, archived status and at-or-below-reorder, sorting by name / on-hand / reorder level, and pagination returning the **total number of matches**, not just the page.
>
> The hard part: sorting and filtering by on-hand, which is `SUM(quantityDelta)` and not a column. Write this as raw SQL with a `LEFT JOIN` onto the aggregated lines rather than fetching rows and sorting in JS — a JS sort over a page can only sort that page, which is wrong, and sorting after fetching everything is what the goal forbids.
>
> Must / must not:
> - Search **must** be case-insensitive and match partial strings in either field.
> - A search with no matches **must** return `200` with an empty array and `total: 0` — not `404`.
> - Sort and direction **must** come from an allow-list. Never interpolate them into SQL. `?sort=name; DROP TABLE items` **must** be `400`, and I want to see the allow-list.
> - `page` ≥ 1 and `pageSize` capped (100). `page=0` → `400`. `pageSize=1000` → `400`, not silently clamped, so the client learns it asked for something wrong.
> - Requesting a page past the end **must** return an empty array with the real `total`, not an error.
> - The `location` filter narrows the on-hand figure to that location while still reporting the item's total — a filtered list that hides the global total is misleading when someone is deciding what to reorder.
> - Response: `{ data, page, pageSize, total, totalPages }`. Every row carries its unit and category, so the table needs no follow-up requests.
> - Every filter must be combinable with every other one. Search + category + below-reorder + sort together must work.

---

# Feature 7 — Bulk import and export

*Large: three phases. Items import, receipts import and export are independent and I reviewed them separately.*

## Phase 7a — Item import

### Prompt 7.1

> Before writing anything: **enumerate the edge cases for CSV item import and tell me the intended behaviour for each.** I want the list first so I can check the implementation against it, rather than being told afterwards that everything is handled.
>
> Cover at minimum: unknown category, duplicate SKU within one file, duplicate SKU already in the database, blank required cells, non-numeric and negative reorder levels, over-length values, alternative header spellings, and a file that isn't really CSV.

**What came back.** The full list, which I then used as the acceptance criteria for the next prompt.

### Prompt 7.2

> Now implement it. Goal 7: *"Each import returns a per-row report naming exactly which rows failed and why, while still importing every row that was valid rather than rejecting the whole file over one bad line."*
>
> So: **one transaction per row, not one for the file.** A bad row rolls back only itself. All-or-nothing is the wrong shape here — someone uploads 400 rows from a spreadsheet, three have typos, and rejecting all 400 helps nobody.
>
> Rows must go through the **same `createItem()` service the UI uses**, not a separate insert path, so every rule applies identically and can't drift.
>
> Two behavioural calls I want implemented as stated:
> - An unknown category or unit is an **error, not something the import creates.** The brief says categories are a managed list; a spreadsheet can't offer a dropdown, so the import is exactly where that list gets enforced. Message: `Unknown category "Widgets" — create it first`.
> - Accept common header spellings — `uom` and `unit of measure` for unit, `reorder` for reorder level — because people write these files by hand. Normalise headers by lower-casing and stripping non-alphanumerics, so `Reorder Level`, `reorder_level` and `reorderLevel` all land.
>
> Report shape: `{ totalRows, imported, failed, failures: [{ line, sku, error }] }`. **`line` must be the line number in the uploaded file**, so the person fixing it can go straight there — not the row index, which is off by the header and by any blank lines.
>
> Must handle without a 500: UTF-8 BOM, CRLF endings, quoted fields containing commas, quoted fields containing escaped quotes, embedded newlines inside quoted fields, blank lines mid-file, trailing blank lines, and extra unknown columns (ignore them). Format reference: https://www.rfc-editor.org/rfc/rfc4180
>
> Must reject cleanly with `400` and a readable message, never a stack trace: empty file, header-only file, ragged rows, a file over 2MB, and more than 5000 rows.

## Phase 7b — Receipt import

### Prompt 7.3

> Same shape for bulk receipts, reusing `importRows()`. Each row goes through **`recordMovement()`**, the same service the UI calls.
>
> That reuse is the point: it means archived items, inactive locations and staff location assignments are all still enforced **row by row**, without a single extra line of permission code in the importer.
>
> Must / must not:
> - Staff **may** import receipts, unlike items. Rows at locations they're assigned to import; rows elsewhere fail with `"You are not assigned to RT-SOUTH"`, **in the same report**, alongside the successes. A mixed file must not be rejected wholesale.
> - Quantity must be a positive integer. `0`, `-5`, `2.5`, `"abc"`, `"1 000"` and `"5,000"` all rejected with a message naming the problem.
> - `occurredAt` optional (defaults to now), backdatable, **must not** be in the future.
> - **Identical repeated rows are additive, not deduplicated.** Two deliveries of the same item to the same place on the same day is a normal event, and silently merging them destroys a real record. I want this explicit, because dedupe looks like a helpful feature and isn't.
> - Unknown SKU and unknown location code each fail their own row with a message naming the offending value.
> - Codes matched case-insensitively — `wh-main` should find `WH-MAIN`.

## Phase 7c — Export

### Prompt 7.4

> Export the current stock position as CSV. Goal 7: *"every item's on-hand quantity by location."*
>
> Shape: one row per item, with **one column per location**, plus SKU, name, category, unit, reorder level, total on hand, an at-or-below-reorder flag, and archived status. Columns come from the locations table at request time, so adding a location doesn't need a code change.
>
> On-hand **must** be summed from the ledger using the same derivation as everywhere else. The export and the screen must never be able to disagree — if you find yourself writing a second way to calculate a balance, stop and reuse the first.
>
> Must / must not:
> - `Content-Type: text/csv` and `Content-Disposition: attachment` with a dated filename.
> - Values containing commas, quotes, semicolons or newlines **must** be correctly quoted — a name like `Widget, large` must survive a round trip back through our own importer.
> - `?archived=active|archived|all`, defaulting to `active`. An invalid value is `400`.
> - Archived items, when included, **must still show their real stock** rather than zero. Archiving doesn't vaporise inventory.
> - Staff may export. It's read-only information they can already see on screen.

---

# Feature 8 — Dashboard

*Medium: one prompt.*

### Prompt 8.1

> Build `GET /dashboard`, returning everything the landing view needs in **one request** — four round trips for one screen is the wrong shape.
>
> Per goal 8: headline numbers (active items, items at or below reorder level, movements recorded today, distinct items moved this week), on-hand broken down **by category** and **by location**, and receipt vs issue volume for the **last eight weeks**.
>
> Do the aggregation in SQL, not by pulling rows into JS. These are `GROUP BY` queries and the database is better at them than a loop.
>
> Must / must not:
> - "At or below reorder level" is `<=`, not `<`. An item sitting exactly at its reorder level **is** low — goal 10 words it "at or below" and the dashboard must agree with the alerts page, or the two contradict each other on screen.
> - "Distinct items moved this week" counts **items, not movements** — ten receipts of one SKU is one distinct item.
> - Weeks with no activity **must** appear in the chart series as zero, not be omitted. A sparse array makes the chart lie about the shape of the trend.
> - Archived items **must** be excluded from active counts but **must not** retroactively vanish from historical movement counts — they really did move.
> - Return numbers, never pre-formatted strings. Formatting is the frontend's job.
> - Both roles see the same figures. Whoever buys stock needs the picture, and staff seeing it costs nothing.
>
> Date handling: be careful that "today" and "this week" mean the same thing in SQL as in JS. If you compute boundaries in JS and pass them as parameters, say so; if you use MySQL date functions, make sure the server timezone can't shift a day.

**What I corrected — bad output #3.** The eight-week chart came back empty on my machine. MySQL's `DATE()` returns UTC midnight, and the keys were being formatted with local getters, so every bucket shifted a day west of UTC and matched nothing. Fixed by formatting the date key in SQL with `DATE_FORMAT(..., '%Y-%m-%d')` and pinning `process.env.TZ = 'UTC'`. This is exactly the failure the last paragraph of the prompt was trying to prevent, and it happened anyway — a good reminder that naming a risk isn't the same as closing it.

---

# Feature 9 — History you cannot rewrite

*Medium: one prompt.*

### Prompt 9.1

> Build the item timeline. Goal 9: creation, every field change with old and new value and who made it, plus notes staff leave — and *"nothing in it can be edited or deleted after the fact, including by managers."*
>
> **Notes and field changes go in one table**, not two. The goal says notes are part of this timeline "the same as field changes", and two tables would mean merging two ordered lists in application code on every read, with paging across both that's fiddly to get right.
>
> Schema: `type` enum (`CREATED`, `FIELD_CHANGED`, `ARCHIVED`, `RESTORED`, `NOTE`), plus `field` / `oldValue` / `newValue` for changes, `note` for notes, `actorId`, `createdAt`.
>
> Must / must not:
> - Tracked fields: `sku`, `name`, `description`, `unit`, `reorderLevel`, `category`. Only write an event when the value **actually changed** — submitting the edit form unchanged must not produce six noise entries.
> - Foreign keys **must** be logged as **human-readable values**, not IDs. `category: Fasteners → Power Tools`, not `categoryId: 3 → 7`. Nobody can read an audit trail of integers.
> - There **must be no update or delete route** for timeline entries, for any role. Combined with the triggers from 4c, this is enforced in two places.
> - Staff **may** add notes — they're the ones on the floor who notice things.
> - Empty or whitespace-only notes rejected with `400`.
> - Newest first, paginated, every entry naming its actor.
> - A timeline request for a non-existent item is `404`.

---

# Feature 10 — Low-stock alerts

*Medium: one prompt. The rule is small and the trap is specific, so it's worth stating precisely.*

### Prompt 10.1

> Build low-stock alerts. Goal 10: any item whose on-hand **summed across every location** falls at or below its reorder level appears in the alerts area, with a count badge in the navigation. A manager can dismiss one. Then the sentence that matters:
>
> *"If that item's on-hand quantity later rises above the reorder level and then falls back at or below it again, the alert reappears."*
>
> **Do not implement that with a cron job or a nightly sweep.** It should fall out of the ledger itself — the alert state must be correct the instant a movement is recorded, not at the next sweep.
>
> My proposed design, tell me if it's wrong: a `alert_dismissals` row with a nullable `resolvedAt`. A dismissal suppresses the alert only while `resolvedAt` is null. The movement path checks, in the same transaction, whether the item has recovered above its reorder level and stamps `resolvedAt` if so. Next time it falls, there's no active dismissal, so the alert fires again by itself — nothing to remember to clear.
>
> Must / must not:
> - Threshold is `<=` for raising the alert, but recovery **must** be strictly `>`. An item sitting exactly at its reorder level is still in alert territory and **must not** count as recovered. This boundary is the whole trick — get it wrong by one and dismissals become permanent.
> - Archived items **must not** appear in alerts at all.
> - Only a manager may dismiss or restore; staff get `403`.
> - Dismissing the same item twice **must not** create two active dismissals.
> - `?includeDismissed=true` shows dismissed ones flagged as such, so a manager can see what they've silenced.
> - The badge count **must** come from the same query as the list. If the badge says 50 and the page shows 37, the user trusts neither.

---

# Frontend

*Built after the API was stable, in two phases.*

### Prompt F.1 — foundation

> Now the frontend. React with Vite, plain JS, React Router, Tailwind.
>
> **Keep dependencies minimal** — no Redux, no React Query, no form library, no chart library. This app has two genuinely global pieces of state (who's signed in, the alert badge count); everything else is local. A state library here is ceremony, and I'd rather be able to explain every line than import a solution to a problem I don't have.
>
> Auth context holding the access token **in memory only**, refreshing on boot because a reload has no token. In `client.js`, on a `401`: refresh once and retry the original request. **Concurrent 401s must share a single refresh** — if five requests fail at once I want one refresh, not five. Deduplicate with a module-level promise.
>
> Filters and pagination **must live in the URL query string**, not component state, so a filtered list is a link I can share, bookmark and reload.
>
> Network failure **must not** blank the screen. If the API is unreachable the app still renders with a clear message and the navigation still works.

### Prompt F.2 — screens

> Build the screens: dashboard, items list, item detail, movements, alerts, import/export, admin.
>
> Must / must not:
> - Every list must be driven by the **server's** filtering and paging. No client-side array filtering of a full dataset.
> - Manager-only actions hidden for staff **and** already refused by the server. The hiding is convenience, not the enforcement.
> - **No native browser dialogs anywhere** — no `alert`, no `confirm`, no `prompt`. Build proper modal components.
> - Server validation errors must surface **in the form** with the modal staying open so the input can be corrected — not a toast that vanishes, and not a closed form that silently discarded the work.
> - The two dashboard charts as hand-written SVG.
> - Responsive to 320px. A wide table must scroll **inside its own container**; the page body must never scroll sideways.

**What I corrected — bad output #4.** Two lapses I found by using the app, not reading the code. A rename flow used `window.prompt()`, which I'd explicitly forbidden in F.2 — replaced with real dialog components and audited for others. And user creation had **no name validation at all**; I created a user called `demo1`. The first fix was *still wrong* — it only required the name to contain at least one letter, so `demo1` still passed. I sent it back and had digits rejected outright. That half-fix is the more instructive one: it looked like it addressed my complaint, and only re-testing the exact input I'd originally complained about caught that it hadn't.

---

# Mid-project redesign — unit of measure

**Context.** The system was built, deployed and seeded. This started as a clarifying question and ended as a migration.

### The prompts, in order

> Clarify two fields for me: what does reorder level mean in this model, and what does unit of measure actually represent?

> So unit of measure is free text — I could enter `abc` and it would be accepted? Is there any constraint on that field at all?

> If it's unconstrained, what happens when the same product is added again under a different unit? Walk me through the failure mode, then give me a realistic solution rather than the textbook one.

> You're proposing to lock the field. Define precisely what "lock" means here, and tell me what unit of measure *is* in this schema.

> I'm willing to reset the database — that's not a constraint. Give me the design you'd defend.

> Concretely: same physical product recorded in `each` instead of `box`. What does the app do today? Should those share a SKU or be two?

**What came back.** At first: yes, `abc` is accepted, it's free text exactly as the brief words it. Then, as I pushed: if some rows are recorded in boxes and others in each, `SUM(quantityDelta)` returns a number that isn't a quantity of anything.

**The call I made.** The unit of measure is **the denominator of every number in the ledger**, and I'd left that denominator as an unvalidated string anyone could edit at any time. That's not a validation gap — it's a correctness defect that produces confidently wrong totals. Worse, editing the unit after movements existed would silently re-denominate history recorded under the old one.

Two changes:

1. Units become a **reference table** managed like categories. The brief already insists categories aren't free text; the argument applies with more force to a unit, because a bad category mislabels a row while a bad unit corrupts a total.
2. The unit **freezes** once the item has any ledger rows: `FST-1001 has 12 recorded movement(s) in its current unit, so the unit can no longer be changed. Create a separate item to stock it in a different unit.`

Two SKUs, not one. The same product in boxes and in singles is two countable things — which is what real inventory systems do, and it's honest that I haven't built unit conversion, a stretch item.

**Cost:** a migration, a new module, and a full re-seed of both local and production, which I ran myself. Worth it — the alternative was shipping a system that produces a number that looks right and isn't.

---

# Deployment

### Prompt D.1

> I can't sign in on the deployed version. My local build talks to the **same** database and works fine. What differs between the two environments? Walk the auth flow and tell me what changes when the frontend and API are on different origins.

The refresh-token cookie was **third-party**, which Safari blocks by default, so every reload silently signed the user out. Fixed by routing `/api/*` through a Vercel rewrite (https://vercel.com/docs/edge-network/rewrites) so the cookie is first-party, and deliberately leaving `VITE_API_URL` **unset** in production — setting it would reintroduce the bug.

### Prompt D.2

> Local is fast, deployed is noticeably slower. Help me **isolate** whether that's the free tier, the database or the network — don't guess. Suggest a measurement that separates them.

Decomposition: timing a 404 route that never touches the database gave the pure network floor (262ms) against a 1270ms dashboard — roughly 250ms per query, the signature of a cross-region round trip. Railway was in a US region, the database in Singapore. I moved Railway to Singapore and queries dropped to ~5ms. No code changed.

### Prompt D.3

> *(with a screenshot of the Aiven Startup-8 plan)* Should I move to this plan to fix the latency?

I was ready to buy it and asked first. The advice was **no** — at $145/month it would have broken the brief's free-tier requirement *and* wouldn't have helped, because the problem was distance, not capacity. Asking before clicking upgrade saved both the money and the requirement.

Seeding against the remote database also hit Prisma's default 5s transaction timeout, which is generous locally and not remotely. Raised explicitly via `TRANSACTION_OPTIONS` rather than by shrinking the seed to fit.

---

# Testing

### Prompt T.1 — the exhaustive pass

> Before I call this done, test the whole application end to end against my local instance. **Be exhaustive rather than representative** — I'd rather find something now than in the interview.
>
> Cover, at minimum:
>
> **Every endpoint, every role.** Each manager-only route called with a staff token expecting `403`; each authenticated route with no token expecting `401`. Don't sample — walk the full matrix.
>
> **Auth lifecycle.** Login, refresh, rotation, reuse detection, logout, deactivated user. Confirm a rotated refresh token can't be replayed.
>
> **The ledger arithmetic.** Record a known sequence by hand and verify the resulting balance, per location and in total. Then cross-check **every item's on-hand against an independent `SUM(quantityDelta)` in raw SQL** — if the API and a direct query ever disagree, the core invariant is broken.
>
> **Concurrency.** Fire 10 simultaneous issues of 2 units against an item holding 10. Exactly 5 must succeed, the final balance must be 0, and the failures must be `409` not `500`.
>
> **The database defences.** Attack them directly in SQL, bypassing the API entirely: `UPDATE` and `DELETE` on both ledger tables and on `item_events`, a `DELETE ... WHERE 1=1`, a row violating each CHECK, and a line whose `itemId` disagrees with its movement. Every one must be refused, and I want the constraint name in each failure. **Run this against the deployed Aiven database too**, not just local — managed providers vary in trigger support and I'm not finding that out at demo time.
>
> **CSV imports, every edge case you can construct** — both items and receipts. BOM, CRLF, ragged rows, embedded newlines in quoted fields, escaped quotes, blank lines, header aliases, extra columns, duplicate SKU in-file and in-database, unknown category / unit / location / SKU, non-numeric and negative and decimal quantities, future dates, over-length values, empty file, header-only file, >5000 rows, >2MB. Verify partial success works: valid rows land, bad rows are reported, and **the line numbers point at the right lines in the file.**
>
> **Export.** Parse the downloaded CSV back and reconcile every cell against the database. Check quoting survives a value containing a comma and a value containing quotes. Feed the export back through our own importer.
>
> **Item list.** Every filter, alone and combined, plus sort in both directions, pagination boundaries (`page=0`, past the end), and injection attempts in `sort` and `search`.
>
> **Alerts.** The full cycle: fall below, dismiss, restock above, fall below again — and confirm a **fresh** alert appears rather than the old dismissal staying stuck. Check the badge count matches the list count.
>
> **The browser, driven for real.** Navigate **only by clicking**, never by calling `page.goto()` after sign-in — a reload re-fetches `/auth/me` and can silently repair broken state, which is exactly how an earlier crash got past testing. Check: no native dialogs anywhere, no console errors, no 5xx, validation errors visible in forms, responsive from 320px to 1440px with no horizontal page overflow, and the app still usable with the API unreachable.
>
> Report failures with evidence — the request, the response and the expected value. **If a test fails, tell me whether the bug is in the app or in the test**, and verify which rather than assuming.

**What it found.** Roughly 750 checks and **one real bug** — a good one. JavaScript silently rolls impossible dates forward: `new Date('2026-02-30')` is **2 March**, and `2026-02-29` is **1 March** because 2026 isn't a leap year (see the parsing notes at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse). Both the movements API and the receipt import accepted these, so a row dated 30 February was filed under a day nobody typed — and because the ledger is append-only with `UPDATE` and `DELETE` blocked by triggers, **that wrong date could never be corrected.**

Fixed by validating the raw string before parsing it, in one shared helper used by both the JSON and CSV paths. Real leap days still pass.

That bug is the justification for demanding an exhaustive pass rather than a representative one. It would never have surfaced in normal use, and the append-only design that makes the ledger trustworthy is precisely what would have made it permanent.

The last line of the prompt earned its place too: several "failures" in the first run were the **tests** being wrong, not the app — reading the wrong key out of the error envelope, asserting `totalOnHand` where the field is `onHand`, and asserting that no movement may carry a negative quantity when adjustments are *designed* to be the one signed kind. Each was verified individually rather than waved through. A suite that's wrong in your favour is worse than no suite at all.

---

# In short

The parts of this codebase I'd defend hardest came out of pushing back rather than accepting: the two-table ledger, the composite foreign key that makes denormalisation drift unrepresentable, integrity rules pushed into the database where no future code can bypass them, and the unit-of-measure redesign that came from asking what a field actually *meant* rather than what it stored.

The parts I'm least happy with — no committed test suite, and generic duplicate-key messages where the rest of the app has specific ones — are recorded in `SUBMISSION.md`, because those are mine too.
