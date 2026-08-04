import { normalizeServiceMonth, palaiServiceMonth } from "../palai/service-month";
import type { LedgerCategory, PalaiPayment, Transaction } from "../types";
import { currentMonthIso } from "../format";

export type MonthlyCategoryReport = {
  month: string;
  byCategory: Partial<Record<LedgerCategory, number>>;
  total: number;
  transactionCount: number;
};

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

  const total = Object.values(byCategory).reduce((sum, n) => sum + (n || 0), 0);

  return { month, byCategory, total, transactionCount };
}
