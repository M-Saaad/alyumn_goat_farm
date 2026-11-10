# AGENTS.md — Farm App (Monis & Saad)

This file is the primary onboarding guide for AI agents working in this repository. Read it before making changes.

## What this app is

A **mobile-first Next.js web app** for a **goat farm partnership** between **Monis** and **Saad** (Pakistan, PKR currency). It tracks:

1. **Partner equity** — who funded what, 50/50 fair share, settlement balance
2. **Livestock** — goats (breeds, status, parents, media, sales)
3. **Palai boarding** — customer goats kept at the farm for a monthly fee
4. **Herd health** — vaccines, deworming, breeding, ultrasound, weights
5. **Finance** — expenses, transfers, monthly reports

The canonical dataset lives in `data/farm.db.json` (~457 transactions, 47 animals). Import from legacy Notion + Google Sheets CSVs in `Data/`.

## Deployment modes

| Mode | When | Database | Auth |
|------|------|----------|------|
| **JSON (local dev)** | No `SUPABASE_SERVICE_ROLE_KEY` | `data/farm.db.json` read/write via `lib/db.ts` | Bypassed — all users treated as `partner` |
| **Supabase (production)** | All three Supabase env vars set | Postgres via service role | Supabase Auth + `profiles.role` |

See [docs/OVERVIEW.md](docs/OVERVIEW.md) and [DEPLOY.md](DEPLOY.md).

## Hot zones — do not change without explicit user approval

These modules encode verified financial math tied to Google Sheets:

| Path | Why it matters |
|------|----------------|
| `lib/partner-equity/settlement.ts` | Partner settlement formula; canonical result **Monis +192,247 / Saad −192,247** |
| `lib/palai/recognize-payment.ts` | Palai fee 50/50 income recognition |
| `lib/palai/service-month.ts` | Palai service month normalization / merge rules |
| `lib/livestock/record-sale.ts` | Livestock sale partner adjustments |
| `lib/livestock/cancel-sale.ts` | Undo sale / receipt deletion |

Any change here must pass `npm run verify` and preserve the canonical settlement unless the user explicitly requests a formula change.

## Canonical reference numbers

After `npm run db:reset`, settlement must match:

```
Monis diff: +192,247 PKR  (Monis over-funded relative to fair share)
Saad diff:  −192,247 PKR  (Saad under-funded)
Interpretation: Saad owes Monis 192,247 PKR
```

Verified in `data/farm.db.json` → `meta.settlementVerified: true`.

## Repository layout

```
src/                    Next.js App Router (pages, components)
lib/                    Business logic, DB, types (shared by app + scripts)
  actions.ts            Mutation implementations (called by server-actions)
  server-actions.ts     "use server" entry points (auth guard + revalidate)
  db/                   queries.ts (page loaders), writes.ts (Supabase upserts)
  partner-equity/       Settlement engine (HOT ZONE)
  palai/                Palai payment recognition (HOT ZONE)
  livestock/            Sales, breeding, health, parents
  transactions/         Category breakdown, monthly report, mutate
data/farm.db.json       Committed canonical JSON database
Data/                   Source CSVs (Notion export + Google Sheets) — read-only inputs
scripts/                Import, verify, seed, backfill utilities
supabase/migrations/    Postgres schema (001–015)
```

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Key routes

| Route | Purpose |
|-------|---------|
| `/` | Partner equity dashboard + finance report + Quick Entry |
| `/animals` | Livestock list with filters |
| `/animals/[id]` | Animal profile (transactions, media, breeding, edit) |
| `/health` | Herd health tabs (vaccines, deworming, breeding) |
| `/transactions` | Full ledger with filters |
| `/login` | Supabase auth (production only) |
| `/api/health-check` | Public diagnostics endpoint |

## How mutations flow

```
UI form → lib/server-actions.ts (guardWrite → requirePartner)
       → lib/actions.ts (business logic, builds WritePlan)
       → lib/db/writes.ts applyWritePlan (Supabase row upserts)
       OR persistDb (JSON mode)
       → revalidatePath("/" | "/animals" | "/health" | "/transactions")
```

Guest users (`profiles.role = 'guest'`) can browse but all writes throw.

## Common commands

```bash
npm install
npm run dev              # http://localhost:3000 (JSON mode if no Supabase)
npm run db:reset         # audit → import → verify (must stay ±192,247)
npm run verify           # All verification scripts
npm run seed:supabase    # Push JSON → Postgres (needs .env.local)
npm run lint
npm run build
```

## Documentation index

| Doc | Contents |
|-----|----------|
| [docs/README.md](docs/README.md) | Navigation hub |
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | Domain glossary, users, features |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Entities, fields, relationships, sample IDs |
| [docs/BUSINESS-RULES.md](docs/BUSINESS-RULES.md) | Settlement, Palai, sales, breeding rules |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code layers, auth, DB access patterns |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Speed optimizations and reusable patterns |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Import pipeline, scripts, verification |

## Conventions for agents

- **Minimize scope** — match existing patterns in surrounding files
- **No inline imports** — keep imports at top of file
- **Exhaustive switches** — use `never` in default case for union types
- **Test financial changes** — always run `npm run verify` after touching hot zones
- **Prefer targeted queries** — page loaders in `lib/db/queries.ts`, not full `fetchDb()` in pages
- **Currency** — PKR, formatted via `lib/format.ts` (`formatPkr`)
- **Partners** — always resolved by name `"Monis"` / `"Saad"` with `type: "Partner"` in contacts
