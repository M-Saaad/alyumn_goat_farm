/**
 * Smoke test for transaction update/delete mutations (in-memory, does not persist).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  applyDeleteTransaction,
  applyUpdateTransaction,
  resolveTransactionKind,
} from "../lib/transactions/mutate";
import type { FarmDatabase } from "../lib/types";
import { computeSettlement, getPartnerIds } from "../lib/partner-equity/settlement";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const db = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "farm.db.json"), "utf8")
) as FarmDatabase;

let failed = 0;
function assert(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`PASS  ${name}`);
  else {
    console.error(`FAIL  ${name} ${detail}`);
    failed++;
  }
}

const { monisId, saadId } = getPartnerIds(db);
const base = computeSettlement(db);

// --- Expense: change amount + paidBy ---
const expense = db.transactions.find(
  (t) => t.kind === "cost" && t.category === "Feed" && t.paid_by_partner_id === saadId
);
assert("found Feed expense paid by Saad", !!expense);
if (expense) {
  assert("variant expense", resolveTransactionKind(expense) === "expense");
  const next = applyUpdateTransaction(db, {
    id: expense.id,
    variant: "expense",
    date: expense.date,
    amount: expense.amount + 1000,
    category: "Feed",
    paidBy: "Monis",
    animalId: expense.animal_id,
    notes: expense.notes,
  });
  const updated = next.transactions.find((t) => t.id === expense.id)!;
  assert("expense amount bumped", updated.amount === expense.amount + 1000);
  assert("expense paidBy → Monis", updated.paid_by_partner_id === monisId);
  assert(
    "ledger still 1:1",
    next.partner_ledger_entries.length === next.transactions.length
  );
  const ledger = next.partner_ledger_entries.find((e) => e.transaction_id === expense.id)!;
  assert("ledger partner Monis", ledger.partner_id === monisId);
  assert("ledger amount matches", ledger.amount === updated.amount);

  // delete expense
  const afterDel = applyDeleteTransaction(next, expense.id);
  assert(
    "expense deleted",
    !afterDel.transactions.some((t) => t.id === expense.id)
  );
  assert(
    "ledger cleaned",
    !afterDel.partner_ledger_entries.some((e) => e.transaction_id === expense.id)
  );
  assert(
    "ledger still 1:1 after delete",
    afterDel.partner_ledger_entries.length === afterDel.transactions.length
  );
}

// --- Partner transfer edit ---
const transfer = db.transactions.find((t) => t.category === "Partner Transfer");
assert("found partner transfer", !!transfer);
if (transfer) {
  const next = applyUpdateTransaction(db, {
    id: transfer.id,
    variant: "partner_transfer",
    date: transfer.date,
    amount: 5000,
    direction: "to_monis",
    notes: "test edit",
  });
  const updated = next.transactions.find((t) => t.id === transfer.id)!;
  assert("transfer signed negative", updated.amount === -5000);
  assert("transfer notes", updated.notes === "test edit");
}

// --- Palai income edit (with payment side row) ---
const palaiWithPay = db.transactions.find(
  (t) =>
    t.category === "Palai Income" &&
    db.palai_payments.some((p) => p.transaction_id === t.id)
);
assert("found palai with payment", !!palaiWithPay);
if (palaiWithPay) {
  const next = applyUpdateTransaction(db, {
    id: palaiWithPay.id,
    variant: "palai_income",
    date: palaiWithPay.date,
    customerName: "Awais",
    ratePerGoat: 7000,
    goatCount: 2,
    paymentMethod: "Online Transfer",
    notes: "edited palai",
  });
  const updated = next.transactions.find((t) => t.id === palaiWithPay.id)!;
  assert("palai adj = half of 14k", updated.amount === 7000);
  const pay = next.palai_payments.find((p) => p.transaction_id === palaiWithPay.id)!;
  assert("palai payment total 14k", pay.total_amount === 14000);
  assert("palai goat count 2", pay.goat_count === 2);
}

// --- Legacy palai without payment: create side row on edit ---
const legacyPalai = db.transactions.find(
  (t) =>
    t.category === "Palai Income" &&
    !db.palai_payments.some((p) => p.transaction_id === t.id)
);
assert("found legacy palai", !!legacyPalai);
if (legacyPalai) {
  const beforeCount = db.palai_payments.length;
  const next = applyUpdateTransaction(db, {
    id: legacyPalai.id,
    variant: "palai_income",
    date: legacyPalai.date,
    customerName: "Awais",
    ratePerGoat: 8000,
    goatCount: 1,
    paymentMethod: null,
    notes: null,
  });
  assert("created palai payment", next.palai_payments.length === beforeCount + 1);
  const pay = next.palai_payments.find((p) => p.transaction_id === legacyPalai.id);
  assert("legacy payment linked", !!pay && pay.total_amount === 8000);
}

// --- Livestock sale: delete reverts animal ---
const saleTx = db.transactions.find((t) => t.category === "Livestock Sale");
assert("found livestock sale", !!saleTx);
if (saleTx) {
  const sale = db.livestock_sales.find((s) => s.transaction_id === saleTx.id)!;
  const animalId = sale.animal_ids[0];
  const afterDel = applyDeleteTransaction(db, saleTx.id);
  const animal = afterDel.animals.find((a) => a.id === animalId)!;
  assert("sale deleted", !afterDel.transactions.some((t) => t.id === saleTx.id));
  assert("sale meta removed", !afterDel.livestock_sales.some((s) => s.transaction_id === saleTx.id));
  assert("animal Active again", animal.status === "Active");
  assert("sold_price cleared", animal.sold_price === null);
}

// --- Livestock purchase without animal_id: delete freely ---
const orphanPurchase = db.transactions.find(
  (t) => t.category === "Livestock Purchase" && t.animal_id == null
);
assert("found orphan purchase", !!orphanPurchase);
if (orphanPurchase) {
  const afterDel = applyDeleteTransaction(db, orphanPurchase.id);
  assert(
    "orphan purchase deleted",
    !afterDel.transactions.some((t) => t.id === orphanPurchase.id)
  );
}

// --- Livestock purchase delete blocked when animal has history ---
{
  const animal = db.animals.find((a) =>
    db.medical_events.some((m) => m.animal_id === a.id)
  );
  assert("found animal with medical history", !!animal);
  if (animal) {
    const synthetic = {
      ...db,
      transactions: [
        ...db.transactions,
        {
          id: "synthetic-purchase",
          date: "2024-01-01",
          amount: 50000,
          kind: "cost" as const,
          category: "Livestock Purchase" as const,
          farm_model: null,
          animal_id: animal.id,
          customer_id: null,
          vendor_id: null,
          paid_by_partner_id: saadId,
          received_by_partner_id: null,
          adjustment_partner_id: null,
          notes: null,
          source_row: null,
        },
      ],
      partner_ledger_entries: [
        ...db.partner_ledger_entries,
        {
          id: "synthetic-ledger",
          transaction_id: "synthetic-purchase",
          partner_id: saadId,
          amount: 50000,
          category: "Livestock Purchase" as const,
          created_at: new Date().toISOString(),
        },
      ],
    };
    let threw = false;
    try {
      applyDeleteTransaction(synthetic, "synthetic-purchase");
    } catch {
      threw = true;
    }
    assert("purchase delete blocked when animal has history", threw);
  }
}

// Settlement identity still holds after expense edit+delete cycle on a copy
{
  const feed = db.transactions.find((t) => t.kind === "cost" && t.category === "Feed")!;
  let next = applyUpdateTransaction(db, {
    id: feed.id,
    variant: "expense",
    date: feed.date,
    amount: feed.amount,
    category: "Feed",
    paidBy: feed.paid_by_partner_id === monisId ? "Monis" : "Saad",
    animalId: feed.animal_id,
    notes: feed.notes,
  });
  const s = computeSettlement(next);
  assert(
    "settlement identity after no-op edit",
    Math.abs(s.monisFunded + s.saadFunded - s.costBase) < 0.01
  );
  assert(
    "canonical monis unchanged after no-op",
    Math.round(s.monisDiff) === Math.round(base.monisDiff)
  );
}

console.log("\n--- Summary ---");
if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("All mutate smoke tests passed.");
