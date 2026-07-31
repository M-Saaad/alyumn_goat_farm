# Deploy: Supabase + Vercel

This app needs Postgres + auth for production. Local JSON (`data/farm.db.json`) still works when Supabase env vars are unset.

## 1. Create Supabase project

1. Go to https://supabase.com and create a project.
2. Open **SQL Editor** and run, in order:
   - [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)
   - [`supabase/migrations/002_livestock_sales_and_media.sql`](supabase/migrations/002_livestock_sales_and_media.sql)
   - [`supabase/migrations/003_drop_customer_wallet.sql`](supabase/migrations/003_drop_customer_wallet.sql)
   - [`supabase/migrations/004_installments.sql`](supabase/migrations/004_installments.sql)
   - [`supabase/migrations/005_palai_service_month.sql`](supabase/migrations/005_palai_service_month.sql)
3. Confirm Storage bucket `animal-media` exists (created by migration 002).
4. Copy from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (server only)

## 2. Create partner logins

In Supabase **Authentication → Users → Add user**:

- Monis: email + password
- Saad: email + password

Both partners share full data access (RLS allows any authenticated user).

## 3. Local env + seed

```bash
cp .env.example .env.local
# fill in the three keys

npm install
npm run seed:supabase
```

`seed:supabase` loads `data/farm.db.json` into Postgres and asserts settlement **Monis +192,247 / Saad −192,247**.

To keep developing against JSON only, remove `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` (or leave all Supabase vars empty).

## 4. GitHub + Vercel

1. Install [Git for Windows](https://git-scm.com/download/win) if needed.
2. Create a GitHub repo and push this project (do **not** commit `.env.local`).
3. Import the repo at https://vercel.com → Framework: Next.js.
4. Set environment variables (Production + Preview):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

5. Deploy. Open the Vercel URL → `/login` with a partner account.

## 5. Post-deploy checklist

- [ ] Login works for Monis and Saad
- [ ] Partner equity shows Monis +192,247 / Saad −192,247
- [ ] Quick Entry expense/sale/Palai persists after refresh
- [ ] Animal profile shows linked transactions
- [ ] Photo/video upload works on a goat profile

## Auth redirect URL

In Supabase **Authentication → URL Configuration**, add:

- Site URL: `https://YOUR_APP.vercel.app`
- Redirect: `https://YOUR_APP.vercel.app/auth/callback`
