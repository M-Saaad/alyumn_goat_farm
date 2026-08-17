import { palaiServiceMonth } from "../palai/service-month";
import type { LedgerCategory, PalaiPayment, Transaction } from "../types";

export const INVESTED_CATEGORY_ORDER: LedgerCategory[] = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Livestock Purchase",
  "Palai Expense",
  "Other",
];

export const RECEIVED_CATEGORY_ORDER: LedgerCategory[] = ["Livestock Sale", "Palai Income"];

export type CategoryBreakdown = {
  investedByCategory: Partial<Record<LedgerCategory, number>>;
  receivedByCategory: Partial<Record<LedgerCategory, number>>;
  transfersByCategory: Partial<Record<LedgerCategory, number>>;
  totalInvested: number;
  totalReceived: number;
  totalTransfers: number;
};

export function computeCategoryBreakdown(input: {
  transactions: Transaction[];
  palaiPayments?: PalaiPayment[];
  month?: string;
}): CategoryBreakdown {
  const investedByCategory: Partial<Record<LedgerCategory, number>> = {};
  const receivedByCategory: Partial<Record<LedgerCategory, number>> = {};
  const transfersByCategory: Partial<Record<LedgerCategory, number>> = {};
  let totalInvested = 0;
  let totalReceived = 0;
  let totalTransfers = 0;

  for (const tx of input.transactions) {
    if (input.month && !tx.date?.startsWith(input.month)) continue;
    if (tx.category === "Palai Income") continue;

    if (tx.kind === "cost") {
      investedByCategory[tx.category] = (investedByCategory[tx.category] || 0) + tx.amount;
      totalInvested += tx.amount;
    } else if (tx.kind === "partner_adjustment") {
      if (tx.category === "Livestock Sale") {
        const amount = Math.abs(tx.amount) * 2;
        receivedByCategory["Livestock Sale"] = (receivedByCategory["Livestock Sale"] || 0) + amount;
        totalReceived += amount;
      } else if (tx.category === "Partner Transfer") {
        const amount = Math.abs(tx.amount);
        transfersByCategory["Partner Transfer"] =
          (transfersByCategory["Partner Transfer"] || 0) + amount;
        totalTransfers += amount;
      }
    }
  }

  const palaiPayments = input.palaiPayments ?? [];
  const palaiInScope = input.month
    ? palaiPayments.filter((p) => palaiServiceMonth(p) === input.month)
    : palaiPayments;

  if (palaiInScope.length > 0) {
    const palaiTotal = palaiInScope.reduce((sum, p) => sum + p.total_amount, 0);
    receivedByCategory["Palai Income"] = palaiTotal;
    totalReceived += palaiTotal;
  }

  return {
    investedByCategory,
    receivedByCategory,
    transfersByCategory,
    totalInvested,
    totalReceived,
    totalTransfers,
  };
}
