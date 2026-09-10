# Overview

## Purpose

The Farm App replaces scattered **Notion databases** and **Google Sheets** with a single mobile-friendly tool for day-to-day farm operations and partner accounting. Two equal partners — **Monis** and **Saad** — run a goat trading and **Palai** (boarding) business in Pakistan.

The app answers three daily questions:

1. **Who owes whom?** — Partner equity settlement on the home screen
2. **What is the herd doing?** — Animals list, health schedules, breeding pipeline
3. **What happened financially?** — Transactions ledger and period reports

## Users and access

| Role | Auth | Capabilities |
|------|------|--------------|
| **Partner** | Supabase login (Monis / Saad) | Full read/write: Quick Entry, edits, deletes, uploads |
| **Guest** | Supabase login (`guest@farm.app` by default) | View-only: no Quick Entry, no edit/delete; server rejects writes |
| **Local dev** | No auth when Supabase unset | Treated as partner |

Roles live in `profiles.role` (`partner` | `guest`). See `lib/auth/roles.ts`.

## Business models

### Trading

Partners buy goats from vendors, raise/sell them, and share all costs 50/50. Purchases may be **installment deals** (`purchase_agreements`) where total price exceeds cash paid so far.

### Palai (boarding)

Customers leave goats at the farm for a **monthly per-goat fee**. Goats stay `Active` with `owner_id` = customer and `palai_rate` set. Income is recognized **on receipt** (not accrued) and split 50/50 between partners.

## Domain glossary

| Term | Meaning |
|------|---------|
| **Palai** | Goat boarding service — monthly fee per goat from a customer |
| **Gulabi / Teddy / Bissar / Tapra** | Goat breed enum values |
| **Cost transaction** | `kind: "cost"` — expense paid by one partner from their pocket |
| **Partner adjustment** | `kind: "partner_adjustment"` — credits one partner's share of income or sale proceeds |
| **Fair share** | `cost_base / 2` — each partner's equal obligation |
| **Diff (settlement)** | `funded - fair_share` — positive means over-funded (owed money back) |
| **Home bred** | Goat born on farm (`home_bred: true`), linked to dam/sire |
| **Sold on Palai** | Buyer keeps goats at farm after sale — animal stays Active with new owner |
| **Service month** | `YYYY-MM` on Palai payments — which month the fee covers |

## App sections

### Home (`/`)

- Settlement banner (who is owed, how much)
- Monis/Saad funded amounts and diffs
- Finance report (month / custom range / all-time)
- Period headcount (goats in herd over date range)
- **Quick Entry** floating action button (partners only)

### Animals (`/animals`, `/animals/[id]`)

- Filterable list of all goats
- Profile: details, parents, linked transactions, media gallery, breeding history
- Edit/delete (partners only)
- Photo/video upload (Supabase Storage bucket `animal-media`)

### Health (`/health`)

- Vaccine schedule and overdue alerts
- Deworming status
- Breeding pipeline: crossed → ultrasound → delivery
- Tabs driven by `lib/livestock/health-tabs.ts`

### Transactions (`/transactions`)

- Full ledger with date/category/partner filters
- Edit/delete individual rows (partners only)

## Quick Entry modes

Accessible from the `+` button on the home page:

| Mode | Action |
|------|--------|
| Expense | Log a cost (Feed, Vet, etc.) paid by Monis or Saad |
| Palai | Record customer Palai payment |
| Buy goat | Purchase from vendor (optional installment) |
| Buy from customer | Acquire goat already owned by a Palai customer |
| Register born | Home-bred kid linked to dam (+ optional sire) |
| Medical | Vaccine, deworming, ultrasound, surgery, general |
| Weight | Weight log entry |
| Breeding | Record crossing event |
| Sell goat | Livestock sale with optional partial receipt |
| Status | Change animal status (Died, Slaughtered, Gone, etc.) |
| Transfer | Partner-to-partner cash transfer |

## Technology stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router |
| UI | React 19, Tailwind CSS 4, mobile-first |
| Types | TypeScript, Zod for validation in places |
| Local DB | `data/farm.db.json` (single JSON file) |
| Production DB | Supabase Postgres |
| Auth | Supabase Auth + profiles table |
| Media | Supabase Storage |
| Hosting | Vercel |
| Dates | `date-fns`, ISO date strings (`YYYY-MM-DD`) |

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Client-side auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Server-side DB writes (never expose to client) |

When all three are set, the app uses Supabase. Otherwise it falls back to JSON.

## Related files outside `docs/`

- [../README.md](../README.md) — Quick start
- [../DEPLOY.md](../DEPLOY.md) — Supabase + Vercel deployment
- [../AGENTS.md](../AGENTS.md) — AI agent onboarding
- [../Data/README.md](../Data/README.md) — Source CSV note
