# Farm App — Monis & Saad

Mobile-first web app for goat farm livestock + partner equity.

## Quick start (local JSON)

```bash
npm install
npm run db:reset   # audit → import → verify (±192,247)
npm run dev        # http://localhost:3000
```

## Deploy (Supabase + Vercel)

See [DEPLOY.md](DEPLOY.md) for:

1. Running SQL migrations
2. Seeding from `data/farm.db.json`
3. Partner login accounts
4. Vercel env vars and go-live checklist

## Scripts

| Command | Purpose |
|---|---|
| `npm run audit:data` | Step 0 CSV audit |
| `npm run import` | Import Notion + Sheets into `data/farm.db.json` |
| `npm run verify` | Settlement + linkage assertions (JSON mode) |
| `npm run db:reset` | Full audit → import → verify |
| `npm run seed:supabase` | Upsert JSON DB into Supabase and verify settlement |

## Stack

- Next.js 15 (App Router) + Tailwind
- Local JSON database (`data/farm.db.json`) when Supabase env is unset
- Supabase Postgres + Auth + Storage for production
- Schema in `supabase/migrations/`

## HOT ZONES

Do not change without asking first:

- `lib/partner-equity/` — settlement math
- `lib/palai/` — Palai fee recognition
- `lib/livestock/` — livestock sale partner adjustments

## Features

- Partner equity dashboard + settlement
- Livestock list + animal profiles (photos/videos on Supabase)
- Quick entry: expense, Palai, buy goat, sell goat, medical, breeding, status, transfer
- Partner login (Supabase Auth)
- CSV import with canonical settlement Monis +192,247 / Saad −192,247
