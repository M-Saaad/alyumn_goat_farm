import { Suspense } from "react";
import { loadHomeData } from "@/lib/db/queries";
import { computeSettlement } from "@/lib/partner-equity/settlement";
import { computePeriodHeadcount } from "@/lib/livestock/period-headcount";
import { formatPkr, currentMonthIso, todayIso } from "@/lib/format";
import { palaiServiceMonth } from "@/lib/palai/service-month";
import {
  computeMonthlyCategoryReport,
  earliestFarmDate,
  parseFinanceReport,
} from "@/lib/transactions/monthly-report";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { FinanceCategoryBreakdown } from "@/components/FinanceCategoryBreakdown";
import { FinanceMonthlyTransactions } from "@/components/FinanceMonthlyTransactions";
import { FinanceReportPicker } from "@/components/FinanceReportPicker";
import { FinancePeriodHeadcount } from "@/components/FinancePeriodHeadcount";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { SignOutButton } from "@/components/SignOutButton";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { FarmDatabase } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string; range?: string }>;
}) {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent searchParams={searchParams} />
    </Suspense>
  );
}

function HomePageFallback() {
  return (
    <main className="px-4 pt-6">
      <div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />
      <div className="mb-4 h-32 animate-pulse rounded-xl bg-stone-200" />
      <BottomNav active="finance" />
    </main>
  );
}

async function HomePageContent({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const reportRange = parseFinanceReport(sp);
  const data = await loadHomeData();
  const settlementDb = {
    contacts: data.contacts,
    transactions: data.transactions,
  } as FarmDatabase;
  const s = computeSettlement(settlementDb);

  const headcountStart =
    reportRange.mode === "alltime"
      ? earliestFarmDate(data.animals, data.transactions)
      : reportRange.periodStart;
  const headcountEnd =
    reportRange.mode === "alltime" ? todayIso() : reportRange.periodEnd;

  const periodReport = computeMonthlyCategoryReport({
    transactions: data.transactions,
    palaiPayments: data.palai_payments,
    mode: reportRange.mode,
    periodLabel: reportRange.periodLabel,
    month: reportRange.mode === "month" ? reportRange.month : undefined,
    from: reportRange.mode === "custom" ? reportRange.from : undefined,
    to: reportRange.mode === "custom" ? reportRange.to : undefined,
  });

  const headcount = computePeriodHeadcount(data.animals, headcountStart, headcountEnd);

  const viewAllHref =
    reportRange.mode === "alltime"
      ? "/transactions"
      : `/transactions?from=${headcountStart}&to=${headcountEnd}`;

  const palaiThisMonth = data.palai_payments
    .filter((p) => palaiServiceMonth(p) === currentMonthIso())
    .reduce((sum, p) => sum + p.total_amount, 0);

  return (
    <main className="px-4 pt-6">
      <AppHeader
        eyebrow="Farm Finance"
        title="Partner Equity"
        action={isSupabaseConfigured() ? <SignOutButton /> : undefined}
      />

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
        <div className="mb-3">
          <h2 className="mb-1 text-sm font-bold text-stone-800">Finance report</h2>
          <p className="mb-2 text-xs text-stone-500">{periodReport.periodLabel}</p>
          <Suspense fallback={<div className="h-8 animate-pulse rounded-lg bg-stone-100" />}>
            <FinanceReportPicker
              mode={reportRange.mode}
              month={reportRange.month}
              from={reportRange.from}
              to={reportRange.to}
            />
          </Suspense>
        </div>
        <FinancePeriodHeadcount headcount={headcount} />
        {periodReport.transactionCount === 0 ? (
          <p className="text-sm text-stone-500">No transactions in this period.</p>
        ) : (
          <>
            <FinanceCategoryBreakdown
              investedByCategory={periodReport.investedByCategory}
              receivedByCategory={periodReport.receivedByCategory}
              transfersByCategory={periodReport.transfersByCategory}
              totalInvested={periodReport.totalInvested}
              totalReceived={periodReport.totalReceived}
              totalTransfers={periodReport.totalTransfers}
            />
            <FinanceMonthlyTransactions report={periodReport} viewAllHref={viewAllHref} />
          </>
        )}
      </section>

      <QuickEntryLoader {...data.quickEntry} />
      <BottomNav active="finance" />
    </main>
  );
}
