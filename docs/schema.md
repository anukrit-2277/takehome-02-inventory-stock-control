# Schema

Eleven tables. MySQL 8, via Prisma. The whole design turns on one rule: **on-hand quantity is never stored**. There is no balance column in any table. If you want to know how many units exist, you sum the ledger.

## Table by table

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `email` | VARCHAR(255) UNIQUE | login identity |
| `passwordHash` | VARCHAR(255) | bcrypt |
| `name` | VARCHAR(120) | |
| `role` | ENUM('MANAGER','STAFF') | default STAFF |
| `isActive` | BOOLEAN | deactivated users can't sign in; rows are never deleted |
| `createdAt` / `updatedAt` | DATETIME(3) | |

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `userId` | INT FK → users, CASCADE | |
| `tokenHash` | VARCHAR(64) UNIQUE | SHA-256 hex, never the raw token |
| `expiresAt` | DATETIME(3) | 7 days |
| `revokedAt` | DATETIME(3) NULL | set on logout, rotation, or reuse detection |

Stored hashed so a database leak doesn't hand over live sessions. Rotated on every use: presenting an already-rotated token is treated as theft and revokes the whole family.

### `locations`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `code` | VARCHAR(32) UNIQUE | upper-cased, e.g. `WH-MAIN` |
| `name` | VARCHAR(120) | |
| `isActive` | BOOLEAN | inactive locations can't receive stock but can still issue it out |

`isActive` is asymmetric on purpose. Closing a site shouldn't strand the stock sitting in it — you need to be able to move it out.

### `location_assignments`
| Column | Type | Notes |
|---|---|---|
| `userId` | INT FK → users, CASCADE | composite PK part |
| `locationId` | INT FK → locations, CASCADE | composite PK part |
| `assignedById` | INT FK → users NULL, SET NULL | who granted it |
| `assignedAt` | DATETIME(3) | |

Composite primary key `(userId, locationId)`, so the same person can't be assigned twice to one location — the database enforces it, not a `findFirst` check.

### `units`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `code` | VARCHAR(32) UNIQUE | lower-cased: `each`, `box`, `metre` |

### `categories`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `name` | VARCHAR(80) UNIQUE | |

### `items`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `sku` | VARCHAR(64) UNIQUE | stored upper-case |
| `name` | VARCHAR(200) | indexed for search |
| `description` | TEXT NULL | |
| `unitId` | INT FK → units | |
| `reorderLevel` | INT default 0 | CHECK ≥ 0 |
| `categoryId` | INT FK → categories | |
| `archivedAt` | DATETIME(3) NULL | soft state, indexed |
| `createdById` | INT FK → users NULL, SET NULL | |

### `stock_movements` — the semantic half of the ledger
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `itemId` | INT FK → items | |
| `kind` | ENUM('RECEIPT','ISSUE','TRANSFER','ADJUSTMENT') | |
| `quantity` | INT | magnitude, except ADJUSTMENT which is signed |
| `locationId` | INT FK NULL, RESTRICT | set for all kinds except TRANSFER |
| `sourceLocationId` | INT FK NULL, RESTRICT | TRANSFER only |
| `destinationLocationId` | INT FK NULL, RESTRICT | TRANSFER only |
| `reason` | VARCHAR(500) NULL | mandatory for ADJUSTMENT |
| `note` | TEXT NULL | |
| `recordedById` | INT FK → users | |
| `occurredAt` | DATETIME(3) | defaults to now, can be backdated |

Plus a redundant-looking `UNIQUE(id, itemId, occurredAt)`. It exists only so the lines table can point a composite foreign key at it — MySQL will only let a FK reference an indexed column list.

### `stock_movement_lines` — the arithmetic half
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `movementId` | INT | part of composite FK |
| `itemId` | INT | denormalised from the movement |
| `locationId` | INT FK → locations | |
| `quantityDelta` | INT | **signed**. CHECK ≠ 0 |
| `occurredAt` | DATETIME(3) | denormalised from the movement |

One movement, one or two lines. A receipt writes `+qty`. An issue writes `-qty`. A transfer writes two lines, `-qty` and `+qty`, in one transaction — so the two halves of a transfer can never come apart.

### `item_events` — the timeline
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `itemId` | INT FK → items | |
| `type` | ENUM('CREATED','FIELD_CHANGED','ARCHIVED','RESTORED','NOTE') | |
| `field` / `oldValue` / `newValue` | VARCHAR(64) / TEXT / TEXT | populated for FIELD_CHANGED |
| `note` | TEXT NULL | populated for NOTE |
| `actorId` | INT FK → users NULL, SET NULL | |
| `createdAt` | DATETIME(3) | |

Field changes and notes share one table because goal 9 asks for them in one timeline. Splitting them would mean merging two ordered lists in application code for every read.

### `alert_dismissals`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK auto | |
| `itemId` | INT FK → items, CASCADE | |
| `dismissedById` | INT FK → users NULL | |
| `dismissedAt` | DATETIME(3) | |
| `resolvedAt` | DATETIME(3) NULL | |

This table is how goal 10's trickiest sentence works. A dismissal suppresses the alert while `resolvedAt` is null. When a movement lifts the item back above its reorder level, `resolvedAt` gets stamped. So the *next* time it falls back down, there is no active dismissal and the alert reappears — without anyone having to remember to clear anything.

## One-to-many vs many-to-many

**One-to-many:** category → items, unit → items, item → movements, item → lines, item → events, item → dismissals, movement → lines, user → movements, user → refresh tokens, location → movements (three separate relations: at, from, to).

**Many-to-many:** exactly one — users ↔ locations, through `location_assignments`. It's a real table rather than an implicit join table because the assignment carries its own data (`assignedById`, `assignedAt`), and goal 5 asks who granted access.

## Which constraints live in the database, and which in code

I drew the line at this question: **if this rule were violated, would the data be wrong forever?** If yes, it goes in the database. If it's a policy that could reasonably change, it goes in the service layer.

**In the database:**

- 6 triggers. `BEFORE UPDATE` and `BEFORE DELETE` on `stock_movements`, `stock_movement_lines` and `item_events`, each raising `SIGNAL SQLSTATE '45000'`. Goal 4 says the ledger can never be changed or removed, and goal 9 says the same of the timeline. An application-layer rule is a promise that the next developer can break with one `prisma.update()`. A trigger refuses everybody — my code, a migration, someone in a SQL console at 2am.
- 6 CHECK constraints: `chk_movement_shape` (a TRANSFER must have both endpoints and no `locationId`, and the endpoints must differ; every other kind is the reverse), `chk_movement_quantity_nonzero`, `chk_movement_positive_unless_adjustment`, `chk_movement_adjustment_reason` (goal 4's "every adjustment must carry a reason"), `chk_line_delta_nonzero`, `chk_item_reorder_level_nonnegative`.
- The composite foreign key `(movementId, itemId, occurredAt)` → `stock_movements(id, itemId, occurredAt)`. This is the one I'm most pleased with. The denormalised columns can't drift from their parent, because a row that disagrees with its movement has no parent to point at. It makes the bug unwritable rather than merely untested.
- `ON DELETE RESTRICT` on every location referenced by the ledger. A location that appears in history can never be deleted — blanking it would silently rewrite what happened.

**In the service layer:**

- Who may act where (staff location assignments) — a policy, and it needs to produce a readable message like *"You are not assigned to RT-SOUTH"*.
- Whether stock is sufficient — needs a `SELECT … FOR UPDATE` and a summed read, which a CHECK can't express.
- Archived items rejecting movements.
- Unit-of-measure freezing once an item has ledger rows.
- Only managers may adjust.

I verified the database-level half actually fires by attacking it directly in SQL, bypassing the API entirely — UPDATE, DELETE, a mass `DELETE … WHERE 1=1`, and a row violating each CHECK. All refused, each naming its own constraint. I ran this against Aiven as well as locally, because managed MySQL services vary in what they support and I didn't want to find out at demo time.

## What I deliberately denormalised

`itemId` and `occurredAt` on `stock_movement_lines`, copied from the parent movement.

Without them, every balance query joins lines to movements just to learn which item a line belongs to and when it happened — and that's the single hottest query in the system, behind on-hand, the item list, the dashboard and the alerts. With them, all of that reads one table.

The usual objection to denormalising is drift. I answered it with the composite foreign key above, so the copies are structurally incapable of disagreeing. That's what made the trade acceptable to me rather than just convenient.

## What would break first at 100x

At 100x — call it 5,000 items, 30,000 movements a day, ~10M ledger rows — the first thing to break is **the item list**, not the ledger.

`GET /items` sorts and filters on `SUM(quantityDelta)`, which means aggregating every line for every matching item on every keystroke of the search box. It's fine today because the index on `(itemId, locationId)` covers it and the table is small. At 10M rows, sorting 5,000 items by on-hand means aggregating the whole ledger before you can return page one. There's no index that makes an aggregate sortable.

Second would be the dashboard's eight-week chart, for the same reason at a larger scale.

The fix I'd reach for, and deliberately did not build here, is a **periodic snapshot** table: one row per item per location per day holding a closing balance, with live balance computed as *most recent snapshot + lines since*. That bounds every read to one day of ledger instead of all of history, and it keeps the append-only ledger as the source of truth — the snapshot stays a derived cache you can rebuild from scratch. I'd rather add that with real numbers in front of me than guess at it now, and adding it later doesn't require changing a single existing row.

Two things that would *not* break first, worth saying because they look like the obvious answers: the `FOR UPDATE` row lock only serialises writers on the same item, which is exactly the contention you want; and the ledger's own inserts stay cheap forever because appending to an indexed table doesn't care how much is already in it.
