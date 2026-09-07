import { animalLabel } from "../labels";
import { createCostTransaction, getPartnerIds } from "../partner-equity/settlement";
import type {
  FarmDatabase,
  PartnerLedgerEntry,
  PurchaseAgreement,
  Transaction,
} from "../types";
import {
  applyPurchasePayment,
  createPurchaseAgreement,
} from "./purchase-agreement";

export type AcquireFromCustomerInput = {
  animalId: number;
  date: string;
  price: number;
  paidNow?: number | null;
  paidBy: "Monis" | "Saad";
  notes?: string | null;
};

function farmOwnerId(db: FarmDatabase): string {
  const farm = db.contacts.find((c) => c.name === "Farm" && c.type === "Farm");
  if (!farm) throw new Error("Farm contact not found");
  return farm.id;
}

export function isCustomerOwnedAnimal(db: FarmDatabase, animalId: number): boolean {
  const animal = db.animals.find((a) => a.id === animalId);
  if (!animal || animal.status !== "Active") return false;
  const owner = db.contacts.find((c) => c.id === animal.owner_id);
  return owner?.type === "Customer";
}

function formatAcquisitionComment(
  existing: string | null,
  customerName: string,
  date: string,
  price: number
): string {
  const line = `Farm purchased from ${customerName} on ${date} for ${price.toLocaleString("en-PK")}`;
  if (!existing?.trim()) return line;
  if (existing.includes(line)) return existing;
  return `${existing.trim()}\n${line}`;
}

export type AcquireFromCustomerResult = {
  db: FarmDatabase;
  animalId: number;
  agreement: PurchaseAgreement;
  transaction: Transaction | null;
  ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[];
};

/** Transfer a palai goat from a customer to farm ownership and record the purchase. */
export function applyAcquireFromCustomer(
  db: FarmDatabase,
  input: AcquireFromCustomerInput
): AcquireFromCustomerResult {
  const animal = db.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Goat not found");
  if (animal.status !== "Active") {
    throw new Error("Only active goats can be acquired from a customer");
  }

  const seller = db.contacts.find((c) => c.id === animal.owner_id);
  if (!seller || seller.type !== "Customer") {
    throw new Error("This goat is not owned by a customer");
  }

  const farmId = farmOwnerId(db);
  if (animal.owner_id === farmId) {
    throw new Error("This goat is already owned by the farm");
  }

  if (input.price <= 0 || Number.isNaN(input.price)) {
    throw new Error("Price must be positive");
  }

  const paidNow =
    input.paidNow == null || Number.isNaN(input.paidNow) ? input.price : input.paidNow;
  if (paidNow < 0) throw new Error("Amount paid cannot be negative");
  if (paidNow > input.price + 0.005) {
    throw new Error("Amount paid cannot exceed total price");
  }

  const label = animalLabel(animal);
  const notes =
    input.notes?.trim() ||
    `Purchase from ${seller.name} — ${label}`;

  const updatedAnimal = {
    ...animal,
    owner_id: farmId,
    palai_rate: null,
    price: input.price,
    comment: formatAcquisitionComment(animal.comment, seller.name, input.date, input.price),
  };

  let agreement = createPurchaseAgreement({
    animalId: animal.id,
    vendorId: seller.id,
    totalAmount: input.price,
    amountPaid: 0,
    notes: `Acquired from ${seller.name}`,
  });

  let nextDb: FarmDatabase = {
    ...db,
    animals: db.animals.map((a) => (a.id === animal.id ? updatedAnimal : a)),
    purchase_agreements: [...(db.purchase_agreements ?? []), agreement],
  };

  let transaction: Transaction | null = null;
  let ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[] = [];
  if (paidNow > 0) {
    const { monisId, saadId } = getPartnerIds(db);
    const paidById = input.paidBy === "Monis" ? monisId : saadId;
    const created = createCostTransaction({
      date: input.date,
      amount: paidNow,
      category: "Livestock Purchase",
      paidByPartnerId: paidById,
      animalId: animal.id,
      customerId: seller.id,
      notes,
      purchaseAgreementId: agreement.id,
    });
    agreement = applyPurchasePayment(agreement, paidNow);
    transaction = created.tx;
    ledger = created.ledger;
    nextDb = {
      ...nextDb,
      transactions: [...nextDb.transactions, transaction],
      purchase_agreements: (nextDb.purchase_agreements ?? []).map((a) =>
        a.id === agreement.id ? agreement : a
      ),
    };
  }

  return {
    db: nextDb,
    animalId: animal.id,
    agreement,
    transaction,
    ledger,
  };
}

export function customerOwnedAnimals(db: FarmDatabase) {
  return db.animals
    .filter((a) => isCustomerOwnedAnimal(db, a.id))
    .map((a) => {
      const owner = db.contacts.find((c) => c.id === a.owner_id);
      const label = `${animalLabel(a)} (${owner?.name ?? "Customer"})`;
      return { id: a.id, label, ownerName: owner?.name ?? "" };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
