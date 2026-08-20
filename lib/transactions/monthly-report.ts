import { normalizeServiceMonth, palaiServiceMonth, formatServiceMonth } from "../palai/service-month";
import type { LedgerCategory, PalaiPayment, Transaction } from "../types";
import { currentMonthIso, formatDate, todayIso } from "../format";
import { lastDayOfMonth } from "../livestock/period-headcount";
import {
  computeCategoryBreakdown,
  palaiInFilter,
  transactionInFilter,
  type DateRangeFilter,
} from "./category-breakdown";

export type FinanceReportMode = "month" | "custom";

export type MonthlyLedgerRow = {
  id: string;
  date: string;
  category: LedgerCategory;
  kind: Transaction["kind"];
  amount: number;
  displayAmount: number;
  notes: string | null;
};

export type MonthlyCategoryReport = {
  mode: FinanceReportMode;
  month: string;
  from?: string;
  to?: string;
  periodLabel: string;
  byCategory: Partial<Record<LedgerCategory, number>>;
  investedByCategory: Partial<Record<LedgerCategory, number>>;
  receivedByCategory: Partial<Record<LedgerCategory, number>>;
  transfersByCategory: Partial<Record<LedgerCategory, number>>;
  total: number;
  totalInvested: number;
  totalReceived: number;
  totalTransfers: number;
  transactionCount: number;
  /** Ledger rows in this period (excludes Palai Income adjustments — palai uses service month). */
  ledgerRows: MonthlyLedgerRow[];
  /** Palai payments counted for this period by service month. */
  palaiRows: Array<{
    id: string;
    date: string;
    serviceMonth: string;
    totalAmount: number;
    goatCount: number | null;
    notes: string | null;
  }>;
};

function parseIsoDate(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim().slice(0, 10));
  if (!match) return null;
  const [, year, month, day] = match;
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  const parsed = new Date(Number(year), monthNum - 1, dayNum);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${year}-${month}-${day}`;
}

function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

function orderedRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Transactions dated in the given month (YYYY-MM), excluding Palai Income ledger duplicates. */
export function transactionsDatedInMonth(
  transactions: Transaction[],
  month: string
): Transaction[] {
  const ym = parseFinanceMonth(month);
  return transactions.filter(
    (tx) => tx.date?.startsWith(ym) && tx.category !== "Palai Income"
  );
}

function displayAmount(tx: Transaction): number {
  if (tx.kind === "partner_adjustment" && tx.category === "Livestock Sale") {
    return Math.abs(tx.amount) * 2;
  }
  return Math.abs(tx.amount);
}

export function parseFinanceMonth(value: string | undefined): string {
  if (!value?.trim()) return currentMonthIso();
  try {
    return normalizeServiceMonth(value);
  } catch {
    return currentMonthIso();
  }
}

export function parseFinanceReport(searchParams: {
  month?: string;
  from?: string;
  to?: string;
  range?: string;
}): {
  mode: FinanceReportMode;
  month: string;
  from?: string;
  to?: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  filter: DateRangeFilter;
} {
  if (searchParams.range === "custom") {
    const month = parseFinanceMonth(searchParams.month);
    const defaultFrom = firstDayOfMonth(month);
    const defaultTo = todayIso();
    const fromRaw = parseIsoDate(searchParams.from) ?? defaultFrom;
    const toRaw = parseIsoDate(searchParams.to) ?? defaultTo;
    const { from, to } = orderedRange(fromRaw, toRaw);
    return {
      mode: "custom",
      month: from.slice(0, 7),
      from,
      to,
      periodStart: from,
      periodEnd: to,
      periodLabel: `${formatDate(from)} – ${formatDate(to)}`,
      filter: { from, to },
    };
  }

  const month = parseFinanceMonth(searchParams.month);
  const periodStart = firstDayOfMonth(month);
  const periodEnd = lastDayOfMonth(month);
  return {
    mode: "month",
    month,
    from: periodStart,
    to: periodEnd,
    periodStart,
    periodEnd,
    periodLabel: formatServiceMonth(month),
    filter: { month },
  };
}

export function computeMonthlyCategoryReport(input: {
  transactions: Transaction[];
  palaiPayments: PalaiPayment[];
  month?: string;
  from?: string;
  to?: string;
  mode?: FinanceReportMode;
  periodLabel?: string;
}): MonthlyCategoryReport {
  const filter: DateRangeFilter =
    input.from && input.to
      ? { from: input.from, to: input.to }
      : { month: parseFinanceMonth(input.month) };

  const mode: FinanceReportMode = input.mode ?? (input.from && input.to ? "custom" : "month");
  const month = filter.month ?? (input.from ? input.from.slice(0, 7) : parseFinanceMonth(input.month));
  const from = filter.from;
  const to = filter.to;
  const periodLabel =
    input.periodLabel ??
    (mode === "custom" && from && to
      ? `${formatDate(from)} – ${formatDate(to)}`
      : formatServiceMonth(month));

  const breakdown = computeCategoryBreakdown({
    transactions: input.transactions,
    palaiPayments: input.palaiPayments,
    month: filter.month,
    from: filter.from,
    to: filter.to,
  });

  const byCategory: Partial<Record<LedgerCategory, number>> = {};
  let transactionCount = 0;

  for (const tx of input.transactions) {
    if (tx.category === "Palai Income") continue;
    if (!transactionInFilter(tx.date, filter)) continue;
    const amount = displayAmount(tx);
    byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
    transactionCount++;
  }

  const palaiInPeriod = input.palaiPayments.filter((p) => palaiInFilter(p, filter));
  if (palaiInPeriod.length > 0) {
    byCategory["Palai Income"] = palaiInPeriod.reduce((sum, p) => sum + p.total_amount, 0);
    transactionCount += palaiInPeriod.length;
  }

  const ledgerRows = input.transactions
    .filter((tx) => tx.category !== "Palai Income" && transactionInFilter(tx.date, filter))
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      category: tx.category,
      kind: tx.kind,
      amount: tx.amount,
      displayAmount: displayAmount(tx),
      notes: tx.notes,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const palaiRows = palaiInPeriod
    .map((p) => ({
      id: p.id,
      date: p.date,
      serviceMonth: palaiServiceMonth(p),
      totalAmount: p.total_amount,
      goatCount: p.goat_count,
      notes: p.notes,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = Object.values(byCategory).reduce((sum, n) => sum + (n || 0), 0);

  return {
    mode,
    month,
    from,
    to,
    periodLabel,
    byCategory,
    investedByCategory: breakdown.investedByCategory,
    receivedByCategory: breakdown.receivedByCategory,
    transfersByCategory: breakdown.transfersByCategory,
    total,
    totalInvested: breakdown.totalInvested,
    totalReceived: breakdown.totalReceived,
    totalTransfers: breakdown.totalTransfers,
    transactionCount,
    ledgerRows,
    palaiRows,
  };
}
