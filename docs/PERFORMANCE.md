# Performance guide

How this app was sped up (PR [#64](https://github.com/M-Saaad/alyumn_goat_farm/pull/64)) and how to apply the same patterns in similar Next.js / full-stack apps.

## Symptoms we fixed

- Every navigation re-read the full local JSON database (~426 KB).
- Every page loader built large Quick Entry props even when the user never opened the + FAB.
- The home finance report serialized hundreds of ledger rows when the UI only shows 12.
- Supabase page loaders duplicated table fetches (home + health).
- The transactions page used O(n×m) `.find()` lookups when mapping rows.

## Changes (reusable playbook)

### 1. Cache expensive local reads

**When:** Dev JSON DB, file-backed config, or any repeated cold `readFile` + `JSON.parse`.

**Pattern:** In-process cache keyed by file `mtime`; invalidate on write.

| File | What changed |
|------|----------------|
| `lib/db.ts` | `jsonDbCache` + `invalidateJsonDbCache()` on `saveJsonDb()` |

```typescript
let cache: { mtimeMs: number; db: T } | null = null;

function load() {
  const mtimeMs = fs.statSync(path).mtimeMs;
  if (cache?.mtimeMs === mtimeMs) return cache.db;
  const db = parse(fs.readFileSync(path));
  cache = { mtimeMs, db };
  return db;
}
```

React `cache()` only dedupes **within one request** — it does not help across navigations.

---

### 2. Lazy-load heavy UI not needed on first paint

**When:** FABs, modals, admin panels, or large forms that most visits never open.

**Pattern:**

1. Add a small API route that returns only that widget’s data.
2. Client component fetches after mount (or on first open).
3. Remove that data from every page loader.

| File | What changed |
|------|----------------|
| `src/app/api/quick-entry/route.ts` | `GET` → `getQuickEntryData()` (partner-only) |
| `src/components/QuickEntryLoader.tsx` | `fetch("/api/quick-entry")` after mount; `dynamic(..., { ssr: false })` for the form |
| `lib/db/queries.ts` | Removed `quickEntry` from `HomeData`, `AnimalsListData`, `TransactionsData`, `HerdHealthPageData` |

**Exception:** Animal profile inline editors still need contact/animal pickers on the server → `editorProps` on `AnimalProfileData` only.

---

### 3. Don’t serialize data the UI doesn’t show

**When:** Dashboard previews, “recent activity,” truncated lists.

**Pattern:** Add optional limits to report builders; keep full counts for totals/labels.

| File | What changed |
|------|----------------|
| `lib/transactions/monthly-report.ts` | `ledgerRowLimit`, `palaiRowLimit` (slice after sort) |
| `src/app/page.tsx` | Pass `FINANCE_TRANSACTION_PREVIEW_LIMIT` (12) |
| `src/components/FinanceMonthlyTransactions.tsx` | Use `report.transactionCount` for header count, not preview row length |

---

### 4. Remove duplicate DB/API fetches per page

**When:** A page loader and a shared helper both `selectAll` the same tables.

**Pattern:** One loader per route; shared extras move to lazy API or a single shared fetch.

| Loader | Before | After |
|--------|--------|-------|
| `loadHomeData` (Supabase) | 5 tables + `getQuickEntryData()` (6 more) | 5 tables only |
| `loadHerdHealthData` (Supabase) | 4 tables + `getQuickEntryData()` | 4 tables only |
| `loadTransactionsData` (Supabase) | 7 tables (incl. breeding/medical for Quick Entry) | 5 tables + `expenseCategories` derived from txs |

---

### 5. Replace repeated `.find()` with `Map` lookups

**When:** Enriching a list with related records (orders + customers, txs + palai, etc.).

| File | What changed |
|------|----------------|
| `src/app/transactions/page.tsx` | `animalById`, `palaiByTxId`, `saleByTxId` built once before `.map()` |
| `lib/quick-entry-props.ts` | `txById`, `contactById` for `palaiHistory` |

```typescript
const byId = new Map(items.map((x) => [x.id, x]));
// O(1) per row instead of O(n) .find()
```

---

### 6. Loading skeletons (perceived speed)

**When:** App Router routes where server data blocks the whole page.

| File | Route |
|------|-------|
| `src/app/loading.tsx` | Root |
| `src/app/animals/loading.tsx` | `/animals` |
| `src/app/transactions/loading.tsx` | `/transactions` |

Shows pulse placeholders immediately while the server component loads.

---

## Checklist for another app

1. **Profile** — What runs on every navigation? (full DB read, big props, duplicate queries)
2. **Cache** — File/DB reads that change rarely → in-memory + invalidation on write
3. **Defer** — Modals / FABs / editors → fetch on open or after mount
4. **Trim payloads** — Server returns only what the first screen renders
5. **Dedupe** — No second helper re-fetching the same tables on the same page
6. **Index joins** — `Map` / `Set` instead of `.find()` in loops
7. **UX** — `loading.tsx` on slow routes

---

## Not done yet (future wins)

| Item | Why it matters |
|------|----------------|
| Transactions pagination | `/transactions` still hydrates all ~457 rows to the client |
| Tab-scoped health loader | `computeHerdHealth()` builds all tabs on every visit |
| Targeted mutation reads | Some writes still `fetchDb()` full tables in `lib/actions.ts` |
| Narrow `revalidatePath` | Mutations invalidate `/`, `/transactions`, `/animals`, `/health` |
| `force-dynamic` review | Redundant where `cookies()` / auth already forces dynamic rendering |

---

## Verification

```bash
npm run build          # typecheck + production build
npm run verify         # financial scripts (hot zones unchanged)
```

Manual checks:

- Pages show skeleton briefly, then content.
- Quick Entry + FAB appears after `/api/quick-entry` returns (partner mode).
- Home finance report shows correct period totals with ≤12 preview rows.

---

## Deployment status

Performance work ships in **PR #64** on branch `cursor/performance-optimizations-9e9f`.

| Environment | Status |
|-------------|--------|
| **Production** (`main` → Vercel) | **Not live** until PR is merged |
| **Vercel Preview** (PR branch) | **Live** on the preview URL from the PR comment |

After merge to `main`, Vercel production redeploys automatically if the repo is connected.
