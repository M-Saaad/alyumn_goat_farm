# AGENTS.md

Farm App — a mobile-first Next.js 15 (App Router) + Tailwind web app for goat farm
livestock and partner equity. See `README.md`, `DEPLOY.md`, and `project-spec.md` for
product/domain details, and `package.json` for the full script list.

## Cursor Cloud specific instructions

### Running the app (local JSON mode — default here)

- With no Supabase env vars set, the app runs in **local JSON mode** with the auth gate
  disabled (see `lib/supabase/middleware.ts`). This is the default dev setup in this
  environment — no login required.
- Start the dev server with `npm run dev` (Next.js on `http://localhost:3000`). Standard
  commands live in `package.json`.

### The local database is generated, and the directory casing matters

- The app reads/writes `data/farm.db.json` (**lowercase** `data/`), but the source CSVs
  and committed audit files live in `Data/` (**uppercase**). This is intentional and
  case-sensitive on Linux — do not "fix" it.
- `data/` is generated and untracked. It is (re)built from `Data/` by `npm run db:reset`
  (audit → import → verify), which asserts the canonical settlement Monis +192,247 /
  Saad −192,247.
- The audit/import scripts do **not** create the `data/` directory; it must already exist
  (`mkdir -p data`) or `db:reset` fails with `ENOENT .../data/audit-report.json`. The
  startup update script handles this.
- Editing data through the UI (Quick Entry) persists to `data/farm.db.json`. Re-running
  `db:reset` overwrites it back to the seed, so it is guarded in the update script to only
  seed when the file is missing.

### Lint has a pre-existing failure

- `npm run lint` exits non-zero due to a pre-existing `prefer-const` error in
  `scripts/verify-txn-mutate.mts` (a standalone verify script, not app code). App/source
  lint is clean.

### Supabase mode (production parity, optional)

- To exercise Postgres/Auth/Storage, follow `DEPLOY.md`: set `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, run the
  SQL in `supabase/migrations/`, then `npm run seed:supabase`. Requires an external
  Supabase project (credentials via Secrets).

### HOT ZONES (per README — ask before changing)

- `lib/partner-equity/` (settlement math), `lib/palai/` (fee recognition),
  `lib/livestock/` (sale partner adjustments).
