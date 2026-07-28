import Link from "next/link";
import { loadHomeData, contactNameFrom } from "@/lib/db/queries";
import { computeSettlement } from "@/lib/partner-equity/settlement";
import { formatPkr, formatDate } from "@/lib/format";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { SignOutButton } from "@/components/SignOutButton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FarmDatabase } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await loadHomeData();
  // Settlement only needs contacts + transactions
  const settlementDb = {
    contacts: data.contacts,
    transactions: data.transactions,
  } as FarmDatabase;
  const s = computeSettlement(settlementDb);
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  const palaiThisMonth = data.palai_payments
    .filter((p) => p.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, p) => sum + p.total_amount, 0);

  const categoryOrder = [
    "Feed",
    "Delivery",
    "Vet/Medicine",
    "Labor",
    "Infrastructure",
    "Livestock Purchase",
    "Livestock Sale",
    "Palai Income",
    "Palai Expense",
    "Partner Transfer",
    "Other",
  ];

  return (
    <main className="px-4 pt-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Farm Finance</p>
          <h1 className="text-2xl font-bold text-stone-900">Partner Equity</h1>
        </div>
        {isSupabaseConfigured() && <SignOutButton />}
      </header>

      <section
        className={`mb-4 rounded-2xl p-4 text-white shadow ${
          s.owedTo === "Monis" ? "bg-emerald-700" : s.owedTo === "Saad" ? "bg-amber-700" : "bg-stone-600"
        }`}
      >
        {s.owedTo === "Even" ? (
          <p className="text-lg font-semibold">Partners are even</p>
        ) : (
          <>
            <p className="text-sm opacity-90">{s.owedTo} is owed</p>
            <p className="text-3xl font-bold">{formatPkr(s.amountOwed)}</p>
            <p className="mt-1 text-sm opacity-90">
              by {s.owedTo === "Monis" ? "Saad" : "Monis"}
            </p>
          </>
        )}
        {data.meta.settlementVerified && (
          <p className="mt-2 text-xs opacity-80">Import verified · Monis +192,247 / Saad −192,247</p>
        )}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
          <p className="text-xs text-stone-500">Monis funded</p>
          <p className="text-lg font-bold">{formatPkr(s.monisFunded)}</p>
          <p className={`text-sm ${s.monisDiff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {s.monisDiff >= 0 ? "+" : ""}
            {formatPkr(s.monisDiff)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
          <p className="text-xs text-stone-500">Saad funded</p>
          <p className="text-lg font-bold">{formatPkr(s.saadFunded)}</p>
          <p className={`text-sm ${s.saadDiff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {s.saadDiff >= 0 ? "+" : ""}
            {formatPkr(s.saadDiff)}
          </p>
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <p className="text-xs text-stone-500">Fair share (50% of cost base)</p>
        <p className="text-xl font-bold">{formatPkr(s.fairShare)}</p>
        <p className="text-xs text-stone-500">Cost base {formatPkr(s.costBase)}</p>
        <p className="mt-2 text-sm text-stone-700">
          Palai this month: <span className="font-semibold">{formatPkr(palaiThisMonth)}</span>
        </p>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold text-stone-800">Spending by category</h2>
        <ul className="space-y-1">
          {categoryOrder
            .filter((c) => s.byCategory[c])
            .map((c) => (
              <li key={c} className="flex justify-between text-sm">
                <span className="text-stone-600">{c}</span>
                <span className="font-medium">{formatPkr(s.byCategory[c])}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-stone-800">Recent transactions</h2>
          <Link href="/transactions" className="text-sm font-semibold text-emerald-700">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-stone-100">
          {recent.map((tx) => (
            <li key={tx.id} className="flex items-start justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium text-stone-800">{tx.category}</p>
                <p className="text-xs text-stone-500">
                  {formatDate(tx.date)} ·{" "}
                  {tx.kind === "cost"
                    ? `paid by ${contactNameFrom(data.contacts, tx.paid_by_partner_id)}`
                    : "adjustment"}
                </p>
                {tx.notes && <p className="text-xs text-stone-500 line-clamp-1">{tx.notes}</p>}
              </div>
              <p className="shrink-0 font-semibold">{formatPkr(tx.amount)}</p>
            </li>
          ))}
        </ul>
      </section>

      <QuickEntryLoader {...data.quickEntry} />
      <BottomNav active="finance" />
    </main>
  );
}
