import { Suspense } from "react";
import { getDb, contactName, animalLabel } from "@/lib/actions";
import { formatPkr } from "@/lib/format";
import { LEDGER_CATEGORIES, slugToCategory } from "@/lib/constants";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntry } from "@/components/QuickEntry";
import { TransactionsFilters } from "@/components/TransactionsFilters";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDb();
  const q = (sp.q || "").toLowerCase().trim();
  const filter = sp.filter || "all";

  let txs = [...db.transactions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.source_row ?? 0) - (a.source_row ?? 0);
  });

  if (filter === "cost") {
    txs = txs.filter((t) => t.kind === "cost");
  } else if (filter === "adjustment") {
    txs = txs.filter((t) => t.kind === "partner_adjustment");
  } else {
    // Support both slug (vet-medicine) and legacy raw category (Vet/Medicine)
    const fromSlug = slugToCategory(filter);
    const category =
      fromSlug ||
      ((LEDGER_CATEGORIES as readonly string[]).includes(filter) ? filter : null);
    if (category) txs = txs.filter((t) => t.category === category);
  }

  if (q) {
    txs = txs.filter(
      (t) =>
        (t.notes || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.date.includes(q)
    );
  }

  const animals = db.animals
    .filter((a) => a.status === "Active")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  return (
    <main className="px-4 pt-6">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Finance</p>
        <h1 className="text-2xl font-bold text-stone-900">Transactions ({txs.length})</h1>
      </header>

      <Suspense fallback={<div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />}>
        <TransactionsFilters />
      </Suspense>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        {txs.length === 0 ? (
          <p className="text-sm text-stone-500">No transactions match.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-stone-800">{tx.category}</p>
                  <p className="text-xs text-stone-500">
                    {tx.date} ·{" "}
                    {tx.kind === "cost"
                      ? `paid by ${contactName(db, tx.paid_by_partner_id)}`
                      : "adjustment"}
                    {tx.animal_id != null ? ` · goat #${tx.animal_id}` : ""}
                  </p>
                  {tx.notes && (
                    <p className="text-xs text-stone-500 line-clamp-1">{tx.notes}</p>
                  )}
                </div>
                <p className="shrink-0 font-semibold">{formatPkr(tx.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <QuickEntry animals={animals} />
      <BottomNav active="txns" />
    </main>
  );
}
