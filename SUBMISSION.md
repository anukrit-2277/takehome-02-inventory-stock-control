# Submission

## Links

- **GitHub repository:** https://github.com/anukrit-2277/takehome-02-inventory-stock-control
- **Live application:** https://takehome-02-inventory-stock-control.vercel.app/

## Notes for the reviewer

**The hosts sleep when idle.** Both the API (Railway) and the database (Aiven) are on free tiers, so the first request after a quiet period can take up to a minute while they wake. A slow first load isn't a broken deployment — give it one retry before concluding anything. Everything after that is fast (queries run in ~5ms; see the note on regions below).

**Where to look first, if you only have five minutes.** Sign in as the manager, open any item, and record a **transfer** between two locations. Then look at the item's movement history and the stock-by-location panel. That one action exercises the core of the design: a transfer is a single movement that writes two ledger lines summing to zero, inside one transaction, so it cannot be half-applied. Then try issuing more than is in stock — the server refuses it and tells you both numbers.

**Two things that are deliberate and might otherwise look like bugs:**

- **Unit of measure is locked** once an item has any recorded movement. That's not an oversight — the unit is the denominator of every quantity in the ledger, so changing it would silently re-denominate history. The error message tells you to create a separate SKU instead. The reasoning is Decision 5 in `docs/decisions.md`, and it's the design I reversed mid-project.
- **An inactive location refuses incoming stock but still allows stock to be issued out.** Closing a site shouldn't strand the inventory sitting in it.

**On hosting regions.** The app was noticeably slow when first deployed. It wasn't the free tier — Railway was in a US region while the database was in Singapore, so every query paid a cross-region round trip. Both are now in Singapore. The diagnosis is written up in `docs/plan.md` because the method (timing a route that never touches the database, to get the network floor, then subtracting) is more interesting than the fix.

**Docs.** `docs/decisions.md` and `docs/ai-prompts.md` are the two I'd read if you only read two.

## Demo credentials

Password is the same for every account: **`Inventory@2026`**

| Role | Email | Password | Assigned locations |
|------|-------|----------|--------------------|
| Manager | `manager@demo.test` | `Inventory@2026` | All (managers act everywhere) |
| Manager | `manager2@demo.test` | `Inventory@2026` | All |
| Staff | `staff@demo.test` | `Inventory@2026` | WH-MAIN, RT-NORTH |
| Staff | `staff2@demo.test` | `Inventory@2026` | RT-SOUTH |
| Staff | `staff3@demo.test` | `Inventory@2026` | WH-MAIN, SITE-A, RT-NORTH |

**To see the role split enforced on the server**, sign in as `staff@demo.test` and try to transfer stock *from* WH-MAIN *to* RT-SOUTH. It's refused with `You are not assigned to RT-SOUTH` — the check runs on both ends of a transfer, not just the source. Hitting a manager-only endpoint directly with a staff token returns `403`, not a hidden button.

Seeded with 5 users, 4 locations, 5 categories, 6 units, 15 items and ~260 movements, all recorded through the same service the API uses — nothing was inserted straight into the ledger.

## Stack

| Layer | What I used | Why |
|-------|-------------|-----|
| Frontend | React 19, Vite, React Router 7, Tailwind | Dependencies are literally just `react`, `react-dom`, `react-router-dom` — no state library, no data-fetching library, no form library, no chart library. Two pieces of state are genuinely global; the rest is local. I'd rather explain every line than import a solution to a problem I don't have. The two dashboard charts are hand-written SVG. |
| Backend | Node, Express 5, Prisma 6, Zod 4 | Plain JavaScript, not TypeScript — deliberate. The brief says no stack scores better and that time learning something new is time not spent on the ten goals, so I used what I'm fastest in. Zod's discriminated unions map exactly onto the four movement kinds, so each kind validates only the fields it actually has. |
| Database | MySQL 8 on Aiven | The core read is an aggregate (`SUM` over the ledger), and MySQL handles that fine. More importantly it supports **triggers and CHECK constraints**, which is where the append-only guarantee lives. I verified both work on Aiven specifically before committing to it. |
| Hosting | Vercel (app), Railway (API), Aiven (DB) | All free tiers. Vercel rewrites `/api/*` to Railway server-side so the refresh-token cookie is first-party — Safari blocks third-party cookies, which silently signed users out on every reload until I fixed it this way. `VITE_API_URL` is deliberately left unset in production; setting it would reintroduce the bug. |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | **Done** | Email/password, two roles. Enforcement is on the server: every manager-only route refuses a staff token with `403`. Staff location scope is checked on **both ends** of a transfer. Adjustments are manager-only — a receipt is an observation, an adjustment is a decision to overrule the ledger. |
| 2 | Items | **Done** | SKU, name, description, unit, reorder level, category, all editable. Categories **and units** are managed reference tables, not free text. Archive/restore keeps full history and blocks new movements. |
| 3 | Stock movements | **Done** | Four kinds, each recording quantity, location and who. Transfers record both source and destination. Backdating supported (never into the future). Full history in order on the item page. |
| 4 | The stock ledger | **Done** | On-hand is never stored — there is no balance column in any table. Append-only enforced by **6 database triggers**, not just by having no endpoint. Transfers are one transaction writing two lines that sum to zero. Negative stock refused via `SELECT … FOR UPDATE` (verified: 10 concurrent issues of 2 against 10 in stock → exactly 5 succeed, final balance 0). Adjustment reason required by both the service and a CHECK constraint. |
| 5 | Location assignment | **Done** | Many-to-many through a real join table with a composite primary key, recording who granted the assignment and when. Manager-only, and all-or-nothing — a bad location ID in the list fails the whole request rather than granting partial access. |
| 6 | Finding items | **Done** | All server-side. Search over name and SKU, filters for category, location, archived and at-or-below-reorder, sorting by name / on-hand / reorder level, pagination with total matches. Sorting by on-hand is raw SQL against the aggregated ledger — sort columns come from an allow-list, never interpolated. |
| 7 | Bulk import and export | **Done** | One transaction **per row**, so valid rows import while bad ones are reported with the **line number in the uploaded file**. Rows go through the same services the UI uses, so archived items, inactive locations and staff location scope all still apply row by row. Export is one column per location plus totals. |
| 8 | A dashboard | **Done** | All four headline numbers, stock by category and by location, and the eight-week receipt/issue chart. Weeks with no activity render as zero rather than being dropped, so the trend isn't distorted. |
| 9 | History you cannot rewrite | **Done** | One timeline carrying creation, field changes with old/new values and actor, archive/restore, and staff notes. Foreign keys are logged as readable values (`category: Fasteners → Power Tools`, not IDs). No edit or delete route exists for any role, and triggers refuse it at the database too. |
| 10 | Low-stock alerts | **Done** | Count badge in the nav, manager-only dismiss. Re-arming falls out of the ledger rather than a scheduled job: a dismissal is closed the moment a movement lifts the item above its reorder level, so the next fall raises a fresh alert. Recovery is strictly `>`, so an item sitting exactly at its reorder level doesn't count as recovered. Verified through the full cycle. |

Stretch ideas: none attempted. All ten goals are done, and the brief is explicit that stretch work never substitutes for a goal.

## How much time did you actually spend?

About **16 hours** across three days, against the 12-hour guide. The overrun was almost entirely two things:

- **Deployment, which I budgeted at 30 minutes and which took 2.5 hours.** None of the problems were code problems and none were visible locally: a remote transaction timeout during seeding, the Safari third-party-cookie failure, and the cross-region latency. If I did this again I'd deploy an empty skeleton against the real managed database on day one, so the environment's problems surface while there's still time.
- **The unit-of-measure redesign, which wasn't in the plan at all** (~1.5 hours plus a full re-seed of both databases). I found the flaw reviewing my own work, late, after the system was already deployed.

The per-area breakdown is in `docs/plan.md`.

## What would you do next, with another 12 hours?

1. **Commit a real test suite.** This is first by a distance. I tested hard — around 750 checks, including cross-checking every item's on-hand against an independent SQL sum and attacking the triggers directly in SQL — but I wrote them as throwaway scripts and deleted them as I went. They found genuine bugs. None of it is committed, so from the outside it may as well not exist. I'd port them to Vitest with a seeded test database.

2. **Fix the duplicate-key error messages.** Creating a duplicate SKU, email, category or unit surfaces Prisma's generic *"A record with that value already exists"*, which is noticeably worse than the specific messages elsewhere in the app (*"Unknown unit 'furlong' — create it first"*). I know exactly where it is; it's a small fix I ran out of time for.

3. **A snapshot table, before it's needed.** The first thing to break at 100x is the item list, because sorting by on-hand aggregates the whole ledger. One row per item per location per day holding a closing balance, with live balance = latest snapshot + lines since, bounds every read to one day of ledger instead of all of history — and keeps the ledger as the source of truth, since the snapshot stays a rebuildable cache. Reasoning is in `docs/schema.md`.

4. **Make destructive actions consistent.** Deleting a category asks for confirmation; archiving an item doesn't. Archive is reversible so it's defensible, but the inconsistency is just an oversight.

5. **Cycle counts with a variance report.** The most useful stretch item for this domain: count the shelf, compare against the ledger, and turn the difference into an adjustment carrying the count as its reason. It fits the existing model exactly — a cycle count *is* an adjustment with better provenance.

## What are you least happy with in this codebase, and why?

**The absent test suite**, for the reason above. I can point at the coverage I achieved but I can't hand it to anyone, and "trust me, I tested it" is worth nothing in a code review. It's the clearest gap between how I actually worked and what the repository can prove.

**That the unit-of-measure flaw survived until the last day.** I'm glad I caught it, and the fix is the design decision I'm proudest of — but I only caught it by asking what a field *meant* rather than what it stored, and I should have asked that during the schema phase, not after the system was deployed and seeded. It cost a migration and a full re-seed that better questions up front would have avoided entirely.

**Some services are longer than I'd like.** `items.service.js` in particular does CRUD, archive/restore, the unit-freeze rule and timeline event writing. It's readable and I can explain all of it, but the timeline-writing concern would be better factored out — it's the same pattern repeated in several places, and I noticed that too late to change it safely.

**`Admin.jsx` carries four screens in one file.** Categories, units, locations and people are four independent CRUD surfaces sharing a tab bar. It works and it's consistent, but the file is long enough that I'd split it before adding a fifth.
