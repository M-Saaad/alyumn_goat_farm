import { normalizeServiceMonth, palaiServiceMonth } from "../palai/service-month";
import type { LedgerCategory, PalaiPayment, Transaction } from "../types";
import { currentMonthIso } from "../format";
import { computeCategoryBreakdown } from "./category-breakdown";

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
  month: string;
  byCategory: Partial<Record<LedgerCategory, number>>;
  investedByCategory: Partial<Record<LedgerCategory, number>>;
  receivedByCategory: Partial<Record<LedgerCategory, number>>;
  transfersByCategory: Partial<Record<LedgerCategory, number>>;
  total: number;
  totalInvested: number;
  totalReceived: number;
  totalTransfers: number;
  transactionCount: number;
  /** Ledger rows dated in this month (excludes Palai Income adjustments — palai uses service month). */
  ledgerRows: MonthlyLedgerRow[];
  /** Palai payments counted for this month by service month. */
  palaiRows: Array<{
    id: string;
    date: string;
    serviceMonth: string;
    totalAmount: number;
    goatCount: number | null;
    notes: string | null;
  }>;
};

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

export function computeMonthlyCategoryReport(input: {
  transactions: Transaction[];
  palaiPayments: PalaiPayment[];
  month: string;
}): MonthlyCategoryReport {
  const month = parseFinanceMonth(input.month);
  const breakdown = computeCategoryBreakdown({
    transactions: input.transactions,
    palaiPayments: input.palaiPayments,
    month,
  });

  const byCategory: Partial<Record<LedgerCategory, number>> = {};
  let transactionCount = 0;

  for (const tx of input.transactions) {
    if (tx.category === "Palai Income") continue;
    if (!tx.date?.startsWith(month)) continue;
    const amount = displayAmount(tx);
    byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
    transactionCount++;
  }

  const palaiInMonth = input.palaiPayments.filter((p) => palaiServiceMonth(p) === month);
  if (palaiInMonth.length > 0) {
    byCategory["Palai Income"] = palaiInMonth.reduce((sum, p) => sum + p.total_amount, 0);
    transactionCount += palaiInMonth.length;
  }

  const ledgerRows = transactionsDatedInMonth(input.transactions, month)
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

  const palaiRows = palaiInMonth
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
    month,
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
