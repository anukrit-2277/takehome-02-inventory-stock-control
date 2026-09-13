# Decisions

Seven decisions where a real alternative existed. Decision 5 is the one I reversed mid-project.

## Decision 1 — Split the ledger into two tables instead of one

- **Chose:** `stock_movements` (what a person did: kind, quantity, locations, who, when) plus `stock_movement_lines` (signed deltas). A receipt writes one movement and one line. A transfer writes one movement and two lines, `-qty` and `+qty`, summing to zero.
- **Rejected:** A single `stock_movements` table with a signed quantity and a nullable source/destination, and every balance query full of `CASE WHEN kind = 'TRANSFER' THEN …`.
- **Why:** A transfer is one thing to a human and two things to arithmetic, and trying to make one row be both is where I expected the bugs to come from. With lines, on-hand at any location is `SUM(quantityDelta) WHERE locationId = ?` — the same expression for every kind, with no special cases anywhere. It's double-entry bookkeeping, and the reason accountants settled on it is the same reason it works here: the two halves of a transfer are written in one transaction, so the brief's "logged at the sending end but never at the receiving end" isn't a bug I have to avoid, it's a state that can't be represented.

  The cost is one extra table and a slightly longer explanation. I think that's cheap for making a whole class of error structurally impossible.

## Decision 2 — Enforce the append-only rule with database triggers, not application discipline

- **Chose:** Six `BEFORE UPDATE` / `BEFORE DELETE` triggers raising `SIGNAL SQLSTATE '45000'` on `stock_movements`, `stock_movement_lines` and `item_events`. Plus six CHECK constraints for shape rules.
- **Rejected:** Simply never writing an update or delete path in the service layer, and relying on code review to keep it that way.
- **Why:** "There's no endpoint for it" is a promise about today's code. Goals 4 and 9 aren't asking for a missing feature, they're asking for a guarantee — *nothing in it can be edited or deleted after the fact, including by managers*. A guarantee that only holds while everyone remembers it isn't one. The trigger refuses my code, a future migration, and anyone with a SQL console.

  It also gave me something to test. I attacked the tables directly in SQL, including a `DELETE FROM stock_movement_lines WHERE 1=1`, and watched the database refuse every one. I couldn't have run that test against a policy that only lived in my service layer.

  The real cost: triggers are invisible if you only read the Prisma schema, and not every managed MySQL supports them. I checked Aiven specifically before committing to it, because discovering this at deploy time would have been painful.

## Decision 3 — A composite foreign key to make denormalisation safe

- **Chose:** Copy `itemId` and `occurredAt` onto every line, then add a composite FK `(movementId, itemId, occurredAt)` → `stock_movements(id, itemId, occurredAt)`.
- **Rejected:** (a) Not denormalising, and joining lines to movements on every balance read. (b) Denormalising and keeping the copies in sync in application code.
- **Why:** Balance queries are the hottest path in the system, and without the copies every one of them joins just to find out which item a line belongs to. But denormalised copies drift — that's the standard objection and it's a fair one.

  The composite key answers it. A line whose `itemId` disagrees with its movement has no parent row to reference, so the insert fails. I'm not *trusting* the copies to stay in sync, and I'm not *testing* that they do — I've made disagreement unrepresentable. That's the difference between a bug you catch and a bug that can't be written.

  This is the piece of the schema I'd most want to be asked about.

## Decision 4 — `SELECT … FOR UPDATE` on the item row, rather than optimistic retries

- **Chose:** Every movement opens a transaction and locks its item row before reading balances.
- **Rejected:** Optimistic concurrency with a version column and retry-on-conflict; or relying on transaction isolation alone.
- **Why:** Without a lock there's a textbook race: two people issue the last 10 units at the same moment, both read "10 available", both pass the check, and the location goes to `-10`. Goal 4 says the server must refuse a move that drives a location negative, and "refuses it unless two people click at once" doesn't meet that.

  The lock is per item, so it only serialises people touching the *same* item — which is exactly the contention worth serialising. I proved it rather than assuming: 10 simultaneous issues of 2 units against 10 in stock, and exactly 5 succeeded with a final balance of 0. The 5 that lost got a clean 409, not a 500.

## Decision 5 — Unit of measure as a managed list, frozen once stock exists *(reversed)*

- **Chose (originally):** A free-text `unitOfMeasure` VARCHAR on the item, exactly as the brief words it.
- **Rejected:** Full multi-unit support with conversion factors (box = 12 each), which is on the stretch list.
- **Why:** The brief says "a unit of measure" and lists conversion as a stretch idea, so a plain string looked like the scoped-correctly answer.
- **Later reversed:** Replaced with a `units` reference table and a foreign key, edited by managers exactly like categories — and the unit is now immutable once the item has any ledger rows.
- **What changed my mind:** I was reviewing my own work and asked whether the free-text field had any validation on it. It didn't — I could type `abc`. That alone was only a tidiness problem. What made it a correctness problem was the follow-on question: if someone re-adds an existing product with a different unit, what happens?

  The answer was bad. On-hand is a single summed number. If 10 rows say "box" and 5 say "each", the ledger says `15` and 15 is meaningless — it isn't 15 of anything. **The unit is the denominator of every quantity in the ledger**, and I'd left the denominator as an unvalidated string anyone could change at any time. Worse, editing an item's unit after movements existed would silently re-denominate history that was recorded in the old unit.

  So two changes. Unit became a reference table, for the same reason the brief already insists categories are a managed list — so `each`, `Each` and `ea` can't coexist as three different things. And changing the unit is refused once any ledger line exists, with a message that tells you what to do instead:

  > `FST-1001 has 12 recorded movement(s) in its current unit, so the unit can no longer be changed. Create a separate item to stock it in a different unit.`

  Stocking the same physical product in boxes and in singles is two SKUs, because it's two different countable things. That's what real inventory systems do, and it's honest about the fact that I haven't built conversions.

  In short: I'd treated a field as a label when it was actually the unit of every number in the system. This cost a migration, a new module, and a full re-seed late in the project, and I'd still do it — the alternative was a system that can produce a confidently wrong number.

## Decision 6 — Access token in memory, refresh token in an httpOnly cookie

- **Chose:** Short-lived JWT (15 min) held in a JavaScript variable, never persisted. Opaque refresh token (7 days) in an httpOnly, secure, SameSite cookie, stored SHA-256-hashed in the database and rotated on every use. Presenting an already-rotated token revokes the entire family.
- **Rejected:** Putting either token in `localStorage`.
- **Why:** `localStorage` is readable by any script on the page, so one XSS is a stolen session. httpOnly puts the long-lived credential where JavaScript can't reach it. Hashing it means a database leak doesn't hand over live sessions either. Rotation plus reuse detection means a stolen token is usable at most once before the theft becomes visible and kills the family.

  Holding the access token only in memory means a page reload has no token — so the client refreshes on boot. That's one extra request per load, and it's why the refresh cookie had to be first-party, which is the whole reason for the Vercel rewrite described in `architecture.md`.

  One smaller thing in the same file that's easy to miss: a failed login compares the submitted password against a dummy bcrypt hash when the email doesn't exist. Without it, "no such user" returns noticeably faster than "wrong password", and that timing difference tells an attacker which email addresses are real.

## Decision 7 — Per-row transactions on CSV import, not one big one

- **Chose:** Each CSV row gets its own transaction. A failed row rolls back only itself; every valid row still lands. The response reports `imported`, `failed`, and a per-row list of `{ line, sku, error }` pointing at line numbers in the uploaded file.
- **Rejected:** One transaction for the whole file, all-or-nothing.
- **Why:** Goal 7 asks for it in as many words — import every valid row rather than rejecting the whole file over one bad line. It's also just right for the use case: someone uploads 400 rows from a spreadsheet, three have a typo, and rejecting all 400 helps nobody.

  Because each row goes through the same `createItem()` / `recordMovement()` service the UI uses, every rule still applies row by row — archived items, inactive locations, and a staff member's location assignments. A staff member importing receipts gets the rows at their own locations and a clear refusal on the rest, in the same report.

  The cost is throughput: 400 rows is 400 transactions. Fine at the scale in the brief, and I'd batch it if that ever became the bottleneck.
