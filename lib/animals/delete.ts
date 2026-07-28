import type { FarmDatabase } from "../types";

/**
 * Remove a goat and all records tied only to that animal.
 * Financial transactions linked to the goat (expenses, purchase installments, sale receipts) are removed too.
 */
export function applyDeleteAnimal(db: FarmDatabase, animalId: number): FarmDatabase {
  const animal = db.animals.find((a) => a.id === animalId);
  if (!animal) throw new Error("Animal not found");

  const jointSale = (db.livestock_sales ?? []).find(
    (s) => s.animal_ids.includes(animalId) && s.animal_ids.length > 1
  );
  if (jointSale) {
    throw new Error(
      "This goat was sold together with other goats. Edit or delete that joint sale from Transactions first."
    );
  }

  const saleIds = new Set(
    (db.livestock_sales ?? [])
      .filter((s) => s.animal_ids.includes(animalId))
      .map((s) => s.id)
  );
  const agreementIds = new Set(
    (db.purchase_agreements ?? [])
      .filter((a) => a.animal_id === animalId)
      .map((a) => a.id)
  );

  const txIdsToDelete = new Set<string>();
  for (const t of db.transactions) {
    if (t.animal_id === animalId) txIdsToDelete.add(t.id);
    if (t.livestock_sale_id && saleIds.has(t.livestock_sale_id)) txIdsToDelete.add(t.id);
    if (t.purchase_agreement_id && agreementIds.has(t.purchase_agreement_id)) {
      txIdsToDelete.add(t.id);
    }
  }
  for (const s of db.livestock_sales ?? []) {
    if (!s.animal_ids.includes(animalId)) continue;
    if (s.transaction_id) txIdsToDelete.add(s.transaction_id);
  }

  return {
    ...db,
    animals: db.animals.filter((a) => a.id !== animalId),
    transactions: db.transactions.filter((t) => !txIdsToDelete.has(t.id)),
    partner_ledger_entries: db.partner_ledger_entries.filter(
      (l) => !txIdsToDelete.has(l.transaction_id)
    ),
    livestock_sales: (db.livestock_sales ?? []).filter((s) => !s.animal_ids.includes(animalId)),
    purchase_agreements: (db.purchase_agreements ?? []).filter((a) => a.animal_id !== animalId),
    medical_events: db.medical_events.filter((m) => m.animal_id !== animalId),
    breeding_events: db.breeding_events.filter(
      (b) => b.female_animal_id !== animalId && b.male_animal_id !== animalId
    ),
    weight_logs: db.weight_logs.filter((w) => w.animal_id !== animalId),
    animal_media: (db.animal_media ?? []).filter((m) => m.animal_id !== animalId),
  };
}
