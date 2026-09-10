# Architecture

## Layer diagram

```
┌─────────────────────────────────────────────────────────┐
│  src/app/          Pages (RSC) + src/components/        │
│  src/middleware.ts Supabase session refresh             │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  lib/server-actions.ts  "use server" + auth guard       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  lib/actions.ts         Business mutations              │
│  lib/livestock/*        Domain-specific logic           │
│  lib/partner-equity/*   Settlement (HOT ZONE)           │
│  lib/palai/*            Palai recognition (HOT ZONE)    │
└──────────────────────────┬──────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
┌──────────────────┐              ┌──────────────────────┐
│ lib/db/queries.ts│              │ lib/db/writes.ts     │
│ Page loaders     │              │ applyWritePlan()     │
│ (read, cached)   │              │ Row-level upserts    │
└────────┬─────────┘              └──────────┬───────────┘
         │                                   │
         └──────────────┬────────────────────┘
                        ▼
         ┌──────────────────────────┐
         │ lib/db.ts                │
         │ fetchDb / persistDb      │
         │ isSupabaseDb()           │
         └────────────┬─────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
  data/farm.db.json          Supabase Postgres
  (JSON mode)                (service role client)
```

## Directory reference

### `src/app/` — Next.js routes

| Path | File | Loader |
|------|------|--------|
| `/` | `page.tsx` | `loadHomeData()` |
| `/animals` | `animals/page.tsx` | `loadAnimalsListData()` |
| `/animals/[id]` | `animals/[id]/page.tsx` | `loadAnimalProfileData(id)` |
| `/health` | `health/page.tsx` | `loadHerdHealthData()` |
| `/transactions` | `transactions/page.tsx` | `loadTransactionsData()` |
| `/login` | `login/page.tsx` | — |
| `/auth/callback` | `auth/callback/route.ts` | OAuth code exchange |

All main pages set `export const dynamic = "force-dynamic"`.

### `src/components/` — UI

Key components:

| Component | Role |
|-----------|------|
| `QuickEntry.tsx` | Floating + button, all quick-entry forms |
| `BottomNav.tsx` | Finance / Animals / Health navigation |
| `AppHeader.tsx` | Page title bar |
| `ViewOnlyBanner.tsx` | Shown for guest role |
| `PalaiPaymentForm.tsx` | Palai entry + history edit |
| `TransactionEditor.tsx` | Edit ledger rows |
| `AnimalEditor.tsx` | Edit animal details |
| `HealthBreedingList.tsx` | Breeding tab on health page |

Client components call `lib/server-actions.ts` via form actions.

### `lib/` — Shared logic (imported as `@/lib/...`)

| Module | Purpose |
|--------|---------|
| `types.ts` | All TypeScript interfaces and enums |
| `db.ts` | JSON/Supabase mode switch, fetchDb, persistDb |
| `db/queries.ts` | Targeted Supabase selects per page |
| `db/writes.ts` | `WritePlan` batch upserts |
| `db/supabase.ts` | Row mappers + full load/save |
| `actions.ts` | All mutation implementations |
| `server-actions.ts` | Thin server wrappers + FormData parsing |
| `auth/roles.ts` | `getSessionRole`, `requirePartner` |
| `format.ts` | PKR formatting, date helpers |
| `labels.ts` | `animalLabel()` display helper |
| `quick-entry-props.ts` | Builds QuickEntry dropdown data |

### `lib/supabase/` — Auth clients

| File | Use |
|------|-----|
| `client.ts` | Browser client |
| `server.ts` | Server component client |
| `admin.ts` | Service role (writes, scripts) |
| `middleware.ts` | Session refresh in middleware |
| `env.ts` | `isSupabaseConfigured()` |

### `scripts/` — CLI utilities

Not imported at runtime. Run via `npm run` or `npx tsx`. See [OPERATIONS.md](OPERATIONS.md).

## Database access patterns

### Reads

**Pages:** Use cached loaders from `lib/db/queries.ts`:

```typescript
export const loadHomeData = cache(async () => { ... });
```

`getCachedDb()` in `lib/db.ts` dedupes within a single React render.

**Scripts/mutations:** Use `fetchDb()` (always fresh, uncached).

### Writes

**Runtime mutations** build a `WritePlan` and call `applyWritePlan()`:

```typescript
await applyWritePlan({
  upsertTransactions: [tx],
  upsertLedger: ledgerEntries,
  upsertAnimals: [animal],
});
```

**Seed/import:** May use full `persistDb(db)` or `saveToSupabase()`.

### Mode detection

```typescript
isSupabaseDb() =
  isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
```

JSON mode uses sync `loadDb()` / `saveDb()` in scripts only.

## Authentication flow

1. `src/middleware.ts` calls `updateSession()` on every matched request
2. Unauthenticated users redirected to `/login` (when Supabase configured)
3. `getSessionRole()` reads `profiles.role`
4. `requirePartner()` throws before any write in server-actions

Local JSON mode skips auth entirely — role defaults to `partner`.

## Server actions catalog

All in `lib/server-actions.ts`, guarded by `guardWrite()`:

| Action | Underlying `lib/actions.ts` fn |
|--------|-------------------------------|
| `actionLogExpense` | `logExpense` |
| `actionRecordPalai` / `updatePalai` | `recordPalai`, `updatePalai` |
| `actionBuyGoat` | `buyGoat` |
| `actionAcquireFromCustomer` | `acquireGoatFromCustomer` |
| `actionRegisterBornGoat` | `registerBornGoat` |
| `actionLogMedical` | `logMedical` |
| `actionLogWeight` | `logWeight` |
| `actionRecordBreeding` | `recordBreeding` |
| `actionRecordLivestockSale` | `recordLivestockSale` |
| `actionChangeStatus` | `changeStatus` |
| `actionPartnerTransfer` | `partnerTransfer` |
| `actionUpdateAnimal` | `updateAnimal` |
| `actionDeleteAnimal` | `deleteAnimal` |
| `actionUpdateTransaction` | `updateTransaction` |
| `actionDeleteTransaction` | `deleteTransaction` |
| `actionUndoLivestockSale` | `undoLivestockSale` |

After mutations: `revalidatePath()` on `/`, `/animals`, `/health`, `/transactions`.

## Media upload

**File:** `lib/media/upload.ts`

- Supabase Storage bucket: `animal-media`
- Path pattern: `{animal_id}/{uuid}.{ext}`
- Creates `animal_media` row after upload
- Requires Supabase (no JSON-mode upload)

## Health check API

`GET /api/health-check` returns JSON:

```json
{
  "ok": true,
  "checks": {
    "mode": "supabase" | "json",
    "env_url": "set" | "missing",
    "home": "ok",
    "animals": "ok",
    "health": "ok",
    "transactions": "ok",
    "breeding_profiles": "ok (5 sampled)",
    "breeding_ultrasound_schema": "ok"
  }
}
```

Use when pages fail in production — no secrets exposed.

## TypeScript path aliases

```json
// tsconfig.json
"@/*" → "./src/*" and "./lib/*" (both roots)
```

Imports like `@/lib/types` resolve to `lib/types.ts`.

## Styling conventions

- Tailwind utility classes, mobile-first
- Rounded cards: `rounded-2xl`, ring borders `ring-stone-200`
- Primary action color: `emerald-700`
- Settlement banner: green (Monis owed), amber (Saad owed), gray (even)
- Fixed Quick Entry FAB: `bottom-20 right-4` (above BottomNav)

## PWA

- `src/app/manifest.ts` — web app manifest
- Icons in `public/icons/`
- `src/app/viewport.ts` — mobile viewport config

## Config files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js config |
| `vercel.json` | Vercel deployment |
| `eslint.config.mjs` | ESLint |
| `postcss.config.mjs` | Tailwind PostCSS |
| `supabase/config.toml` | Local Supabase CLI (optional) |

## Adding a new feature — checklist

1. Add types to `lib/types.ts` if new entities
2. Add migration in `supabase/migrations/` if schema change
3. Add mappers in `lib/db/supabase.ts`
4. Extend `WritePlan` + `applyWritePlan` in `lib/db/writes.ts`
5. Implement mutation in `lib/actions.ts`
6. Expose via `lib/server-actions.ts` with `guardWrite()`
7. Add UI in `src/components/` and wire into page
8. Add targeted loader in `lib/db/queries.ts`
9. Add verification script if financial logic involved
10. Run `npm run verify` and `npm run build`
