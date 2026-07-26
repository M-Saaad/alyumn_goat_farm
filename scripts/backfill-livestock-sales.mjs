/**
 * Backfill livestock_sales metadata and animal links for imported sale rows.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = path.join(ROOT, "data", "farm.db.json");

const LIVESTOCK_SALE_META = {
  451: { animalIds: [9], gross: 78000, delivery: 0 },
  475: { animalIds: [3, 38], gross: 65000, delivery: 0 },
  487: { animalIds: [12], gross: 33000, delivery: 0 },
  491: { animalIds: [40], gross: 25000, delivery: 1000 },
};

const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const monis = db.contacts.find((c) => c.name === "Monis");
if (!monis) throw new Error("Monis contact missing");

db.livestock_sales = [];
for (const tx of db.transactions) {
  if (tx.category !== "Livestock Sale" || tx.kind !== "partner_adjustment") continue;
  const meta = LIVESTOCK_SALE_META[tx.source_row];
  if (!meta) continue;
  const net = meta.gross - meta.delivery;
  tx.animal_id = meta.animalIds[0];
  db.livestock_sales.push({
    id: randomUUID(),
    date: tx.date,
    animal_ids: meta.animalIds,
    gross_sale_price: meta.gross,
    delivery_cost: meta.delivery,
    net_received: net,
    partner_share: Math.abs(tx.amount),
    received_by_partner_id: tx.amount < 0 ? monis.id : db.contacts.find((c) => c.name === "Saad").id,
    transaction_id: tx.id,
    notes: tx.notes,
  });
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`Backfilled ${db.livestock_sales.length} livestock sales`);
