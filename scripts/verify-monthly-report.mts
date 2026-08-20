import {
  computeMonthlyCategoryReport,
  parseFinanceMonth,
  parseFinanceReport,
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
assert(report.totalInvested === 7000, `invested expected 7000 got ${report.totalInvested}`);
assert(report.totalReceived === 38000, `received expected 38000 got ${report.totalReceived}`);
assert(report.transactionCount === 4, "four items in July");
assert(report.ledgerRows.length === 3, "three ledger rows dated in July");
assert(report.palaiRows.length === 1, "one palai row for July service month");

const august = computeMonthlyCategoryReport({
  month: "2026-08",
  transactions: [
    tx({ id: "f1", category: "Feed", amount: 30000, date: "2026-08-05" }),
    tx({ id: "d1", category: "Delivery", amount: 3000, date: "2026-08-06" }),
    tx({ id: "v1", category: "Vet/Medicine", amount: 22000, date: "2026-08-07" }),
    tx({ id: "o1", category: "Other", amount: 1000, date: "2026-08-08" }),
    tx({
      id: "s1",
      category: "Livestock Sale",
      kind: "partner_adjustment",
      amount: -59500,
      date: "2026-08-10",
    }),
    tx({
      id: "p1",
      category: "Palai Income",
      kind: "partner_adjustment",
      amount: 3500,
      date: "2026-08-19",
    }),
  ],
  palaiPayments: [
    {
      id: "palai-aug",
      date: "2026-08-19",
      service_month: "2026-08",
      customer_id: "c1",
      rate_per_goat: 7000,
      goat_count: 7,
      total_amount: 50000,
      payment_method: null,
      transaction_id: "p1",
      notes: "Awais palai",
    },
  ] satisfies PalaiPayment[],
});

assert(august.totalInvested === 56000, `August invested expected 56000 got ${august.totalInvested}`);
assert(august.totalReceived === 169000, `August received expected 169000 got ${august.totalReceived}`);
assert(august.receivedByCategory["Livestock Sale"] === 119000, "August livestock sale");
assert(august.receivedByCategory["Palai Income"] === 50000, "August palai by service month");
assert(august.ledgerRows.length === 5, "five dated ledger rows, palai adjustment excluded");
assert(august.palaiRows.length === 1, "one palai payment row");

const empty = computeMonthlyCategoryReport({
  month: "2026-01",
  transactions: [tx({ id: "x", category: "Feed", amount: 100, date: "2026-02-01" })],
  palaiPayments: [],
});
assert(empty.transactionCount === 0, "no txs in empty month");
assert(empty.total === 0, "empty month total is zero");
assert(empty.totalInvested === 0, "empty month invested is zero");
assert(empty.totalReceived === 0, "empty month received is zero");

assert(parseFinanceMonth(undefined) === new Date().toISOString().slice(0, 7), "default current month");
assert(parseFinanceMonth("2026-03") === "2026-03", "valid month");
assert(parseFinanceMonth("bad") === new Date().toISOString().slice(0, 7), "invalid falls back");

const custom = computeMonthlyCategoryReport({
  from: "2026-07-10",
  to: "2026-07-25",
  mode: "custom",
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
    tx({ id: "5", category: "Feed", amount: 9000, date: "2026-07-28" }),
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
    {
      id: "palai-aug",
      date: "2026-08-05",
      service_month: "2026-08",
      customer_id: "c1",
      rate_per_goat: 7000,
      goat_count: 1,
      total_amount: 7000,
      payment_method: null,
      transaction_id: "tx-palai-aug",
      notes: null,
    },
  ] satisfies PalaiPayment[],
});

assert(custom.mode === "custom", "custom mode");
assert(custom.totalInvested === 7000, `custom invested expected 7000 got ${custom.totalInvested}`);
assert(custom.totalReceived === 38000, `custom received expected 38000 got ${custom.totalReceived}`);
assert(custom.ledgerRows.length === 3, "three ledger rows in custom date window");
assert(custom.palaiRows.length === 1, "July palai only for July custom window");
assert(custom.transactionCount === 4, "four items in custom July window");

const crossMonth = computeMonthlyCategoryReport({
  from: "2026-07-15",
  to: "2026-08-10",
  mode: "custom",
  transactions: [
    tx({ id: "j1", category: "Feed", amount: 1000, date: "2026-07-20" }),
    tx({ id: "j2", category: "Feed", amount: 2000, date: "2026-08-05" }),
    tx({ id: "j3", category: "Feed", amount: 3000, date: "2026-06-01" }),
  ],
  palaiPayments: [
    {
      id: "palai-july",
      date: "2026-07-28",
      service_month: "2026-07",
      customer_id: "c1",
      rate_per_goat: 7000,
      goat_count: 2,
      total_amount: 14000,
      payment_method: null,
      transaction_id: "tx1",
      notes: null,
    },
    {
      id: "palai-aug",
      date: "2026-08-05",
      service_month: "2026-08",
      customer_id: "c1",
      rate_per_goat: 7000,
      goat_count: 1,
      total_amount: 7000,
      payment_method: null,
      transaction_id: "tx2",
      notes: null,
    },
  ] satisfies PalaiPayment[],
});

assert(crossMonth.totalInvested === 3000, `cross-month invested expected 3000 got ${crossMonth.totalInvested}`);
assert(crossMonth.totalReceived === 21000, `cross-month received expected 21000 got ${crossMonth.totalReceived}`);
assert(crossMonth.palaiRows.length === 2, "both palai months in cross-month window");

const parsedCustom = parseFinanceReport({ range: "custom", from: "2026-07-01", to: "2026-07-31" });
assert(parsedCustom.mode === "custom", "parse custom mode");
assert(parsedCustom.from === "2026-07-01" && parsedCustom.to === "2026-07-31", "parse custom dates");

const parsedMonth = parseFinanceReport({ month: "2026-05" });
assert(parsedMonth.mode === "month" && parsedMonth.month === "2026-05", "parse month mode");

console.log("PASS monthly category report");
