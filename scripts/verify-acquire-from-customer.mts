/**
 * Unit tests for acquire-from-customer domain logic.
 */
import { loadDb } from "../lib/db";
import { applyAcquireFromCustomer } from "../lib/livestock/acquire-from-customer";
import type { FarmDatabase } from "../lib/types";

function cloneDb(): FarmDatabase {
  return JSON.parse(JSON.stringify(loadDb()));
}

function main() {
  const db = cloneDb();
  const awais = db.contacts.find((c) => c.name === "Awais");
  const farm = db.contacts.find((c) => c.name === "Farm");
  const grace = db.animals.find((a) => a.name === "Grace" && a.status === "Active");
  if (!awais || !farm || !grace) {
    throw new Error("fixture missing Awais, Farm, or Grace");
  }
  if (grace.owner_id !== awais.id) {
    throw new Error("Grace should be owned by Awais for this test");
  }

  const result = applyAcquireFromCustomer(db, {
    animalId: grace.id,
    date: "2026-09-01",
    price: 65000,
    paidBy: "Monis",
    notes: "Test acquire Grace",
  });

  const acquired = result.db.animals.find((a) => a.id === grace.id);
  if (!acquired || acquired.owner_id !== farm.id) {
    throw new Error("ownership not transferred to farm");
  }
  if (acquired.palai_rate != null) {
    throw new Error("palai rate should be cleared");
  }
  if (!result.transaction || result.transaction.amount !== 65000) {
    throw new Error("missing purchase transaction");
  }
  if (result.transaction.customer_id !== awais.id) {
    throw new Error("transaction should reference selling customer");
  }
  if (result.agreement.vendor_id !== awais.id || result.agreement.status !== "settled") {
    throw new Error("purchase agreement should reference customer seller and be settled");
  }

  console.log("PASS acquire-from-customer domain logic");
}

main();
