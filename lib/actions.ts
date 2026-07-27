import type { FarmDatabase } from "./types";
import { fetchDb, persistDb } from "./db";
import { computeSettlement } from "./partner-equity/settlement";
import {
  createCostTransaction,
  createAdjustmentTransaction,
  getPartnerIds,
} from "./partner-equity/settlement";
import { recognizePalaiPayment, applyPalaiToDb } from "./palai/recognize-payment";
import { applyLivestockSaleToDb } from "./livestock/record-sale";
import {
  applyDeleteTransaction,
  applyUpdateTransaction,
  type UpdateTransactionInput,
} from "./transactions/mutate";
import type { LedgerCategory, AnimalStatus, AnimalBreed, AnimalSex, MedicalEventType } from "./types";
import { creditWallet, debitWalletForPurchase } from "./customer-wallet/wallet";

export async function getDb(): Promise<FarmDatabase> {
  return fetchDb();
}

export async function getSettlement() {
  return computeSettlement(await fetchDb());
}

export function contactName(db: FarmDatabase, id: string | null | undefined) {
  if (!id) return "—";
  return db.contacts.find((c) => c.id === id)?.name ?? "—";
}

export function animalLabel(a: { name: string | null; description: string | null; id: number }) {
  return a.name || a.description?.slice(0, 40) || `Goat #${a.id}`;
}

export async function logExpense(input: {
  date: string;
  amount: number;
  category: LedgerCategory;
  paidBy: "Monis" | "Saad";
  animalId?: number | null;
  notes?: string;
}) {
  const db = await fetchDb();
  const { monisId, saadId } = getPartnerIds(db);
  const paidById = input.paidBy === "Monis" ? monisId : saadId;
  const { tx, ledger } = createCostTransaction({
    date: input.date,
    amount: input.amount,
    category: input.category,
    paidByPartnerId: paidById,
    animalId: input.animalId,
    notes: input.notes,
  });
  db.transactions.push(tx);
  const now = new Date().toISOString();
  for (const l of ledger) {
    db.partner_ledger_entries.push({ ...l, id: crypto.randomUUID(), created_at: now });
  }
  return persistDb(db);
}

export async function recordPalai(input: {
  date: string;
  customerName: string;
  ratePerGoat: number;
  goatCount: number;
  paymentMethod?: string;
  notes?: string;
}) {
  let db = await fetchDb();
  let customer = db.contacts.find(
    (c) => c.name.toLowerCase() === input.customerName.toLowerCase() && c.type === "Customer"
  );
  if (!customer) {
    customer = {
      id: crypto.randomUUID(),
      name: input.customerName,
      type: "Customer",
      phone: null,
      notes: null,
    };
    db.contacts.push(customer);
    await persistDb(db);
    db = await fetchDb();
  }
  const total = input.ratePerGoat * input.goatCount;
  const result = recognizePalaiPayment(db, {
    date: input.date,
    customerId: customer.id,
    ratePerGoat: input.ratePerGoat,
    goatCount: input.goatCount,
    totalAmount: total,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
  });
  return persistDb(applyPalaiToDb(db, result));
}

function resolveOwnerContact(
  db: FarmDatabase,
  ownerName: string
): FarmDatabase["contacts"][number] {
  let owner = db.contacts.find((c) => c.name.toLowerCase() === ownerName.toLowerCase());
  if (!owner) {
    const type =
      ownerName === "Farm"
        ? "Farm"
        : ["Monis", "Saad"].includes(ownerName)
          ? "Partner"
          : "Customer";
    owner = { id: crypto.randomUUID(), name: ownerName, type, phone: null, notes: null };
    db.contacts.push(owner);
  }
  return owner;
}

function resolveVendorId(db: FarmDatabase, vendorName?: string | null): string | null {
  const name = vendorName?.trim();
  if (!name) return null;
  let v = db.contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === "Vendor"
  );
  if (!v) {
    v = { id: crypto.randomUUID(), name, type: "Vendor", phone: null, notes: null };
    db.contacts.push(v);
  }
  return v.id;
}

export async function buyGoat(input: {
  date: string;
  price: number;
  breed: AnimalBreed;
  sex: AnimalSex;
  description: string;
  name?: string;
  ownerName: string;
  vendorName?: string;
  paidBy: "Monis" | "Saad" | "Customer";
  palaiRate?: number | null;
}) {
  let db = await fetchDb();
  const { monisId, saadId } = getPartnerIds(db);

  const owner = resolveOwnerContact(db, input.ownerName);
  const vendorId = resolveVendorId(db, input.vendorName);
  const isCustomerOwner = owner.type === "Customer";
  if (input.paidBy === "Customer" && !isCustomerOwner) {
    throw new Error("Paid by customer is only allowed when the owner is a customer");
  }
  const palaiRate =
    isCustomerOwner && input.palaiRate != null && !Number.isNaN(input.palaiRate)
      ? input.palaiRate
      : null;

  const nextId = db.animals.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  db.animals.push({
    id: nextId,
    name: input.name || null,
    breed: input.breed,
    sex: input.sex,
    date_of_purchase: input.date,
    age_at_purchase: null,
    description: input.description,
    comment: null,
    status: "Active",
    price: input.price,
    sold_price: null,
    purchased_from: vendorId,
    owner_id: owner.id,
    home_bred: false,
    out_date: null,
    palai_rate: palaiRate,
  });

  if (input.paidBy === "Customer") {
    db = debitWalletForPurchase(db, {
      customerId: owner.id,
      date: input.date,
      amount: input.price,
      animalId: nextId,
      vendorId,
      notes: `Buy ${input.name || input.description}`,
    });
    return persistDb(db);
  }

  const paidById = input.paidBy === "Monis" ? monisId : saadId;
  const { tx, ledger } = createCostTransaction({
    date: input.date,
    amount: input.price,
    category: "Livestock Purchase",
    paidByPartnerId: paidById,
    animalId: nextId,
    vendorId,
    notes: `Buy ${input.name || input.description}`,
  });
  db.transactions.push(tx);
  const now = new Date().toISOString();
  for (const l of ledger) {
    db.partner_ledger_entries.push({ ...l, id: crypto.randomUUID(), created_at: now });
  }
  return persistDb(db);
}

export async function updateAnimal(input: {
  id: number;
  name?: string | null;
  breed?: AnimalBreed | null;
  sex?: AnimalSex | null;
  description?: string | null;
  comment?: string | null;
  ownerName: string;
  vendorName?: string | null;
  palai_rate?: number | null;
  age_at_purchase?: string | null;
  home_bred?: boolean;
}) {
  const db = await fetchDb();
  const animal = db.animals.find((a) => a.id === input.id);
  if (!animal) throw new Error("Animal not found");

  const owner = resolveOwnerContact(db, input.ownerName);
  const vendorId = resolveVendorId(db, input.vendorName);

  animal.name = input.name?.trim() || null;
  animal.breed = input.breed ?? null;
  animal.sex = input.sex ?? null;
  animal.description = input.description?.trim() || null;
  animal.comment = input.comment?.trim() || null;
  animal.owner_id = owner.id;
  animal.purchased_from = vendorId;
  animal.age_at_purchase = input.age_at_purchase?.trim() || null;
  animal.home_bred = Boolean(input.home_bred);
  animal.palai_rate =
    owner.type === "Customer" && input.palai_rate != null && !Number.isNaN(input.palai_rate)
      ? input.palai_rate
      : owner.type === "Customer"
        ? animal.palai_rate
        : null;

  return persistDb(db);
}

export async function logMedical(input: {
  animalId: number;
  eventType: MedicalEventType;
  date: string;
  notes?: string;
}) {
  const db = await fetchDb();
  db.medical_events.push({
    id: crypto.randomUUID(),
    animal_id: input.animalId,
    event_type: input.eventType,
    date: input.date,
    notes: input.notes || null,
    transaction_id: null,
  });
  return persistDb(db);
}

export async function recordBreeding(input: {
  femaleId: number;
  buckName: string;
  maleAnimalId?: number | null;
  dateCrossed: string;
  notes?: string;
}) {
  const db = await fetchDb();
  const d = new Date(input.dateCrossed);
  d.setUTCDate(d.getUTCDate() + 150);
  let maleAnimalId: number | null = input.maleAnimalId ?? null;
  let buckName = input.buckName.trim();
  if (maleAnimalId != null) {
    const male = db.animals.find((a) => a.id === maleAnimalId);
    if (!male) throw new Error("Buck animal not found");
    if (!buckName) buckName = animalLabel(male);
  } else {
    maleAnimalId = null;
  }
  db.breeding_events.push({
    id: crypto.randomUUID(),
    female_animal_id: input.femaleId,
    male_animal_id: maleAnimalId,
    buck_name: buckName || null,
    date_crossed: input.dateCrossed,
    expected_due_date: d.toISOString().slice(0, 10),
    delivered_date: null,
    outcome: "Pending",
    status: "Doubt",
    notes: input.notes || null,
  });
  return persistDb(db);
}

export async function changeStatus(input: {
  animalId: number;
  status: AnimalStatus;
  outDate?: string;
}) {
  const db = await fetchDb();
  const animal = db.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");
  animal.status = input.status;
  if (input.outDate) animal.out_date = input.outDate;
  return persistDb(db);
}

export async function recordLivestockSale(input: {
  date: string;
  animalId: number;
  additionalAnimalIds?: number[];
  grossSalePrice: number;
  deliveryCost?: number;
  receivedBy?: "Monis" | "Saad";
  notes?: string;
}) {
  const db = await fetchDb();
  return persistDb(applyLivestockSaleToDb(db, input));
}

export async function partnerTransfer(input: {
  date: string;
  amount: number;
  direction: "from_monis" | "to_monis";
  notes?: string;
}) {
  const db = await fetchDb();
  const { monisId } = getPartnerIds(db);
  const amount = input.direction === "from_monis" ? input.amount : -input.amount;
  const { tx, ledger } = createAdjustmentTransaction({
    date: input.date,
    amount,
    category: "Partner Transfer",
    monisId,
    notes: input.notes || (input.direction === "from_monis" ? "Received from Monis" : "Sent to Monis"),
  });
  db.transactions.push(tx);
  const now = new Date().toISOString();
  for (const l of ledger) {
    db.partner_ledger_entries.push({ ...l, id: crypto.randomUUID(), created_at: now });
  }
  return persistDb(db);
}

export async function recordWalletDeposit(input: {
  date: string;
  customerName: string;
  amount: number;
  notes?: string;
}) {
  let db = await fetchDb();
  let customer = db.contacts.find(
    (c) => c.name.toLowerCase() === input.customerName.toLowerCase() && c.type === "Customer"
  );
  if (!customer) {
    customer = {
      id: crypto.randomUUID(),
      name: input.customerName,
      type: "Customer",
      phone: null,
      notes: null,
    };
    db.contacts.push(customer);
  }
  db = creditWallet(db, {
    customerId: customer.id,
    date: input.date,
    amount: input.amount,
    notes: input.notes || null,
  });
  return persistDb(db);
}

export async function updateTransaction(input: UpdateTransactionInput) {
  const db = await fetchDb();
  return persistDb(applyUpdateTransaction(db, input));
}

export async function deleteTransaction(id: string) {
  const db = await fetchDb();
  return persistDb(applyDeleteTransaction(db, id));
}
