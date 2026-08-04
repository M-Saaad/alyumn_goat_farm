import {
  computeMonthlyCategoryReport,
  parseFinanceMonth,
} from "../lib/transactions/monthly-report.ts";
import type { PalaiPayment, Transaction } from "../lib/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const tx = (overrides: Partial<Transaction> & Pick<Transaction, "id" | "category" | "amount">): Transaction => ({
  date: "2026-07-15",
  kind: "cost",
  farm_model: null,
  animal_id: null,
  customer_id: null,
  vendor_id: null,
  paid_by_partner_id: "p1",
  notes: null,
  source_row: null,
  ...overrides,
});

const month = "2026-07";
const report = computeMonthlyCategoryReport({
  month,
  transactions: [
    tx({ id: "1", category: "Feed", amount: 5000, date: "2026-07-10" }),
    tx({ id: "2", category: "Feed", amount: 3000, date: "2026-06-30" }),
    tx({ id: "3", category: "Vet/Medicine", amount: 2000, date: "2026-07-20" }),
    tx({
      id: "4",
      category: "Livestock Sale",
      kind: "partner_adjustment",
      amount: -12000,
      date: "2026-07-25",
    }),
  ],
  palaiPayments: [
    {
      id: "palai-1",
      date: "2026-07-28",
      service_month: "2026-07",
      customer_id: "c1",
      rate_per_goat: 7000,
      goat_count: 2,
      total_amount: 14000,
      payment_method: null,
      transaction_id: "tx-palai",
      notes: null,
    },
  ] satisfies PalaiPayment[],
});

assert(report.byCategory.Feed === 5000, "Feed in July only");
assert(report.byCategory["Vet/Medicine"] === 2000, "Vet in July");
assert(report.byCategory["Livestock Sale"] === 24000, "Livestock sale shows full net");
assert(report.byCategory["Palai Income"] === 14000, "Palai by service month");
assert(report.total === 45000, `total expected 45000 got ${report.total}`);
assert(report.transactionCount === 4, "four items in July");

const empty = computeMonthlyCategoryReport({
  month: "2026-01",
  transactions: [tx({ id: "x", category: "Feed", amount: 100, date: "2026-02-01" })],
  palaiPayments: [],
});
assert(empty.transactionCount === 0, "no txs in empty month");
assert(empty.total === 0, "empty month total is zero");

assert(parseFinanceMonth(undefined) === new Date().toISOString().slice(0, 7), "default current month");
assert(parseFinanceMonth("2026-03") === "2026-03", "valid month");
assert(parseFinanceMonth("bad") === new Date().toISOString().slice(0, 7), "invalid falls back");

console.log("PASS monthly category report");
