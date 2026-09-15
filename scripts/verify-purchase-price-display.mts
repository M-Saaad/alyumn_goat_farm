import assert from "node:assert/strict";
import { buyGoat } from "../lib/actions";
import { loadDb } from "../lib/db";
import { canonicalPurchasePrice } from "../lib/livestock/purchase-agreement";
import { applyUpdateTransaction } from "../lib/transactions/mutate";

async function main() {
  const before = loadDb();
  const maxId = before.animals.reduce((m, a) => Math.max(m, a.id), 0);

  await buyGoat({
    date: "2026-09-15",
    price: 95000,
    paidNow: 20000,
    breed: "Teddy",
    sex: "Female",
    description: "price-display-test",
    ownerName: "Farm",
    paidBy: "Monis",
  });

  const db = loadDb();
  const animal = db.animals.find((a) => a.id > maxId)!;
  const agreement = db.purchase_agreements?.find((a) => a.animal_id === animal.id)!;

  assert.equal(animal.price, 95000, "buyGoat should store full price on animal");
  assert.equal(agreement.total_amount, 95000);
  assert.equal(agreement.amount_paid, 20000);

  const tx = db.transactions.find(
    (t) => t.animal_id === animal.id && t.category === "Livestock Purchase"
  )!;
  assert.equal(tx.amount, 20000);

  // Simulate editing the purchase payment transaction (previously overwrote animal.price).
  const afterEdit = applyUpdateTransaction(db, {
    id: tx.id,
    variant: "livestock_purchase",
    date: tx.date,
    amount: 25000,
    paidBy: "Monis",
    vendorName: "",
    notes: tx.notes,
  });
  const editedAnimal = afterEdit.animals.find((a) => a.id === animal.id)!;
  assert.equal(editedAnimal.price, 95000, "payment edit must not change agreed purchase price");

  assert.equal(
    canonicalPurchasePrice(editedAnimal, agreement),
    95000,
    "canonical purchase price uses agreement total"
  );

  console.log("PASS purchase price display and transaction edit preserve agreed total");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
