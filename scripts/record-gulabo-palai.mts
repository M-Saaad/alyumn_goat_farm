/**
 * Record farm-paid palai (boarding at Chatni) for Gulabo.
 * Usage: npx tsx scripts/record-gulabo-palai.mts
 * With Supabase: npx tsx --env-file=.env.local scripts/record-gulabo-palai.mts
 */
import { logExpense } from "../lib/actions.ts";
import { fetchDb } from "../lib/db.ts";
import { computeSettlement } from "../lib/partner-equity/settlement.ts";

const GULABO_ID = 1;

async function main() {
  const before = await fetchDb();
  const existing = before.transactions.find(
    (t) =>
      t.category === "Palai Expense" &&
      t.animal_id === GULABO_ID &&
      /gulabo/i.test(t.notes ?? "")
  );
  if (existing) {
    console.log("Already recorded:", {
      date: existing.date,
      amount: existing.amount,
      notes: existing.notes,
      id: existing.id,
    });
    return;
  }

  await logExpense({
    date: "2026-08-11",
    amount: 20000,
    category: "Palai Expense",
    paidBy: "Monis",
    animalId: GULABO_ID,
    notes: "Gulabo 1 month palai (Chatni)",
  });

  const after = await fetchDb();
  const tx = after.transactions.find(
    (t) =>
      t.category === "Palai Expense" &&
      t.animal_id === GULABO_ID &&
      /gulabo/i.test(t.notes ?? "")
  );
  if (!tx) throw new Error("Transaction not found after insert");

  const settlement = computeSettlement(after);
  console.log("Recorded palai expense:", {
    id: tx.id,
    date: tx.date,
    amount: tx.amount,
    animal_id: tx.animal_id,
    notes: tx.notes,
  });
  console.log("Settlement:", {
    monisDiff: Math.round(settlement.monisDiff),
    saadDiff: Math.round(settlement.saadDiff),
    owedTo: settlement.owedTo,
    amountOwed: Math.round(settlement.amountOwed),
  });
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
