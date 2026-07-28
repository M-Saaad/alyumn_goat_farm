import type { FarmDatabase } from "./types";
import { fetchDb, isSupabaseDb } from "./db";
import { loadPartnerIds } from "./db/queries";
import { computeSettlement } from "./partner-equity/settlement";
import {
  createCostTransaction,
  createAdjustmentTransaction,
  getPartnerIds,
} from "./partner-equity/settlement";
import { recognizePalaiPayment, applyPalaiToDb } from "./palai/recognize-payment";
import { applyLivestockSaleToDb, applySaleReceiptToDb, beginLivestockSale, buildSaleReceipt, findSaleForAnimal } from "./livestock/record-sale";
import {
  applyDeleteSaleReceipt,
  applyUndoLivestockSaleForAnimal,
} from "./livestock/cancel-sale";
import {
  applyPurchasePayment,
  createPurchaseAgreement,
  findPurchaseAgreement,
  validatePurchasePaymentAmount,
} from "./livestock/purchase-agreement";
import { applyDeleteAnimal } from "./animals/delete";
import { applyUpdateAnimalDetails, type UpdateAnimalInput } from "./animals/update";
import {
  applyDeleteTransaction,
  applyUpdateTransaction,
  type UpdateTransactionInput,
} from "./transactions/mutate";
import {
  persistMutation,
  insertTransactionWithLedger,
  applyWritePlan,
} from "./db/writes";
import type { LedgerCategory, AnimalStatus, AnimalBreed, AnimalSex, MedicalEventType } from "./types";
import { animalLabel } from "./labels";

export { animalLabel };

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

function withLedgerIds(
  ledger: Omit<FarmDatabase["partner_ledger_entries"][number], "id" | "created_at">[]
) {
  const now = new Date().toISOString();
  return ledger.map((l) => ({ ...l, id: crypto.randomUUID(), created_at: now }));
}

export async function logExpense(input: {
  date: string;
  amount: number;
  category: LedgerCategory;
  paidBy: "Monis" | "Saad";
  animalId?: number | null;
  notes?: string;
}) {
  if (isSupabaseDb()) {
    const { monisId, saadId } = await loadPartnerIds();
    const paidById = input.paidBy === "Monis" ? monisId : saadId;
    const { tx, ledger } = createCostTransaction({
      date: input.date,
      amount: input.amount,
      category: input.category,
      paidByPartnerId: paidById,
      animalId: input.animalId,
      notes: input.notes,
    });
    await insertTransactionWithLedger(tx, withLedgerIds(ledger));
    return;
  }

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
  const entries = withLedgerIds(ledger);
  const after = {
    ...db,
    transactions: [...db.transactions, tx],
    partner_ledger_entries: [...db.partner_ledger_entries, ...entries],
  };
  return persistMutation(db, after);
}

export async function recordPalai(input: {
  date: string;
  customerName: string;
  ratePerGoat: number;
  goatCount: number;
  paymentMethod?: string;
  notes?: string;
}) {
  const before = await fetchDb();
  let db = before;
  let customer = db.contacts.find(
    (c) => c.name.toLowerCase() === input.customerName.toLowerCase() && c.type === "Customer"
  );
  const newContacts: FarmDatabase["contacts"] = [];
  if (!customer) {
    customer = {
      id: crypto.randomUUID(),
      name: input.customerName,
      type: "Customer",
      phone: null,
      notes: null,
    };
    newContacts.push(customer);
    db = { ...db, contacts: [...db.contacts, customer] };
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
  const after = applyPalaiToDb(db, result);
  if (isSupabaseDb()) {
    const entries = after.partner_ledger_entries.filter(
      (l) => l.transaction_id === result.tx.id
    );
    await insertTransactionWithLedger(result.tx, entries, {
      contacts: newContacts.length ? newContacts : undefined,
      palai: [result.payment],
    });
    return after;
  }
  return persistMutation(before, after);
}

function resolveOwnerContact(
  db: FarmDatabase,
  ownerName: string
): { contact: FarmDatabase["contacts"][number]; created: boolean } {
  let owner = db.contacts.find((c) => c.name.toLowerCase() === ownerName.toLowerCase());
  if (!owner) {
    const type =
      ownerName === "Farm"
        ? "Farm"
        : ["Monis", "Saad"].includes(ownerName)
          ? "Partner"
          : "Customer";
    owner = { id: crypto.randomUUID(), name: ownerName, type, phone: null, notes: null };
    return { contact: owner, created: true };
  }
  return { contact: owner, created: false };
}

function resolveVendor(
  db: FarmDatabase,
  vendorName?: string | null
): { id: string | null; contact?: FarmDatabase["contacts"][number] } {
  const name = vendorName?.trim();
  if (!name) return { id: null };
  let v = db.contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === "Vendor"
  );
  if (!v) {
    v = { id: crypto.randomUUID(), name, type: "Vendor", phone: null, notes: null };
    return { id: v.id, contact: v };
  }
  return { id: v.id };
}

export async function buyGoat(input: {
  date: string;
  price?: number | null;
  paidNow?: number | null;
  breed: AnimalBreed;
  sex: AnimalSex;
  description: string;
  name?: string;
  ownerName: string;
  vendorName?: string;
  paidBy: "Monis" | "Saad" | "Customer";
  palaiRate?: number | null;
}) {
  const before = await fetchDb();
  let db = before;
  const ownerRes = resolveOwnerContact(db, input.ownerName);
  const newContacts: FarmDatabase["contacts"] = [];
  if (ownerRes.created) {
    newContacts.push(ownerRes.contact);
    db = { ...db, contacts: [...db.contacts, ownerRes.contact] };
  }
  const vendorRes = resolveVendor(db, input.vendorName);
  if (vendorRes.contact) {
    newContacts.push(vendorRes.contact);
    db = { ...db, contacts: [...db.contacts, vendorRes.contact] };
  }
  const owner = ownerRes.contact;
  const vendorId = vendorRes.id;
  const isCustomerOwner = owner.type === "Customer";
  const palaiRate =
    isCustomerOwner && input.palaiRate != null && !Number.isNaN(input.palaiRate)
      ? input.palaiRate
      : null;

  const customerPaid = input.paidBy === "Customer";
  if (customerPaid && !isCustomerOwner) {
    throw new Error("Paid by customer requires a customer owner");
  }

  let price: number;
  if (customerPaid) {
    price = input.price != null && !Number.isNaN(input.price) ? input.price : 0;
  } else {
    if (input.price == null || Number.isNaN(input.price)) {
      throw new Error("Price is required");
    }
    price = input.price;
  }

  const nextId = db.animals.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const animal = {
    id: nextId,
    name: input.name || null,
    breed: input.breed,
    sex: input.sex,
    date_of_purchase: input.date,
    age_at_purchase: null,
    description: input.description,
    comment: null,
    status: "Active" as const,
    price,
    sold_price: null,
    purchased_from: vendorId,
    owner_id: owner.id,
    home_bred: false,
    out_date: null,
    palai_rate: palaiRate,
  };
  db = { ...db, animals: [...db.animals, animal] };

  const defaultPaidNow = customerPaid ? 0 : price;
  const paidNow =
    input.paidNow == null || Number.isNaN(input.paidNow) ? defaultPaidNow : input.paidNow;
  if (paidNow < 0) throw new Error("Amount paid cannot be negative");
  if (paidNow > price + 0.005) throw new Error("Amount paid cannot exceed total price");

  const agreement = createPurchaseAgreement({
    animalId: nextId,
    vendorId,
    totalAmount: price,
    amountPaid: customerPaid ? paidNow : 0,
    notes: `Buy ${input.name || input.description}`,
  });

  let after = {
    ...db,
    purchase_agreements: [...(db.purchase_agreements ?? []), agreement],
  };

  if (customerPaid) {
    if (isSupabaseDb()) {
      await applyWritePlan({
        upsertContacts: newContacts.length ? newContacts : undefined,
        upsertAnimals: [animal],
        upsertPurchaseAgreements: [agreement],
      });
      return after;
    }
    return persistMutation(before, after);
  }

  if (paidNow > 0) {
    const { monisId, saadId } = getPartnerIds(after);
    const paidById = input.paidBy === "Monis" ? monisId : saadId;
    const { tx, ledger } = createCostTransaction({
      date: input.date,
      amount: paidNow,
      category: "Livestock Purchase",
      paidByPartnerId: paidById,
      animalId: nextId,
      vendorId,
      notes: `Buy ${input.name || input.description}`,
      purchaseAgreementId: agreement.id,
    });
    const entries = withLedgerIds(ledger);
    const settledAgreement = applyPurchasePayment(agreement, paidNow);
    after = {
      ...after,
      transactions: [...after.transactions, tx],
      partner_ledger_entries: [...after.partner_ledger_entries, ...entries],
      purchase_agreements: (after.purchase_agreements ?? []).map((a) =>
        a.id === agreement.id ? settledAgreement : a
      ),
    };
    if (isSupabaseDb()) {
      await insertTransactionWithLedger(tx, entries, {
        contacts: newContacts.length ? newContacts : undefined,
        animals: [animal],
        purchaseAgreements: [settledAgreement],
      });
      return after;
    }
    return persistMutation(before, after);
  }

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertContacts: newContacts.length ? newContacts : undefined,
      upsertAnimals: [animal],
      upsertPurchaseAgreements: [agreement],
    });
    return after;
  }
  return persistMutation(before, after);
}

export async function addPurchasePayment(input: {
  animalId: number;
  date: string;
  amount: number;
  paidBy: "Monis" | "Saad" | "Customer";
  notes?: string;
}) {
  const before = await fetchDb();
  const agreement = findPurchaseAgreement(before, input.animalId);
  if (!agreement) throw new Error("No purchase agreement for this goat");
  validatePurchasePaymentAmount(agreement, input.amount);

  const updatedAgreement = applyPurchasePayment(agreement, input.amount);
  let after: FarmDatabase = {
    ...before,
    purchase_agreements: (before.purchase_agreements ?? []).map((a) =>
      a.id === agreement.id ? updatedAgreement : a
    ),
  };

  if (input.paidBy === "Customer") {
    return persistMutation(before, after);
  }

  const { monisId, saadId } = getPartnerIds(before);
  const paidById = input.paidBy === "Monis" ? monisId : saadId;
  const animal = before.animals.find((a) => a.id === input.animalId);
  const { tx, ledger } = createCostTransaction({
    date: input.date,
    amount: input.amount,
    category: "Livestock Purchase",
    paidByPartnerId: paidById,
    animalId: input.animalId,
    vendorId: agreement.vendor_id,
    notes: input.notes || `Purchase payment — ${animal?.name || animal?.description || "goat"}`,
    purchaseAgreementId: agreement.id,
  });
  const entries = withLedgerIds(ledger);
  after = {
    ...after,
    transactions: [...after.transactions, tx],
    partner_ledger_entries: [...after.partner_ledger_entries, ...entries],
  };

  if (isSupabaseDb()) {
    await insertTransactionWithLedger(tx, entries, {
      purchaseAgreements: [updatedAgreement],
    });
    return after;
  }
  return persistMutation(before, after);
}

export async function addSaleReceipt(input: {
  animalId: number;
  date: string;
  amount: number;
  receivedBy: "Monis" | "Saad";
  notes?: string;
}) {
  const before = await fetchDb();
  const sale = (before.livestock_sales ?? []).find((s) => s.animal_ids.includes(input.animalId));
  if (!sale) throw new Error("No sale agreement for this goat");

  if (isSupabaseDb()) {
    const { tx, ledger, sale: updatedSale } = buildSaleReceipt(before, sale, {
      date: input.date,
      amount: input.amount,
      receivedBy: input.receivedBy,
      notes: input.notes,
    });
    const entries = withLedgerIds(ledger);
    await insertTransactionWithLedger(tx, entries, { sales: [updatedSale] });
    return {
      ...before,
      transactions: [...before.transactions, tx],
      partner_ledger_entries: [...before.partner_ledger_entries, ...entries],
      livestock_sales: (before.livestock_sales ?? []).map((s) =>
        s.id === updatedSale.id ? updatedSale : s
      ),
    };
  }

  const after = applySaleReceiptToDb(before, sale.id, {
    date: input.date,
    amount: input.amount,
    receivedBy: input.receivedBy,
    notes: input.notes,
  });
  return persistMutation(before, after);
}

export async function updateAnimal(input: UpdateAnimalInput) {
  const before = await fetchDb();
  const { db: after, newContacts } = applyUpdateAnimalDetails(before, input);
  const updated = after.animals.find((a) => a.id === input.id)!;
  const agreement = findPurchaseAgreement(after, input.id);
  const sale = findSaleForAnimal(after, input.id);

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertContacts: newContacts.length ? newContacts : undefined,
      upsertAnimals: [updated],
      upsertPurchaseAgreements: agreement ? [agreement] : undefined,
      upsertSales: sale ? [sale] : undefined,
    });
    return after;
  }
  return persistMutation(before, after);
}

export async function logMedical(input: {
  animalId: number;
  eventType: MedicalEventType;
  date: string;
  notes?: string;
}) {
  const before = await fetchDb();
  const event = {
    id: crypto.randomUUID(),
    animal_id: input.animalId,
    event_type: input.eventType,
    date: input.date,
    notes: input.notes || null,
    transaction_id: null,
  };
  const after = {
    ...before,
    medical_events: [...before.medical_events, event],
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertMedical: [event] });
    return after;
  }
  return persistMutation(before, after);
}

export async function recordBreeding(input: {
  femaleId: number;
  buckName: string;
  maleAnimalId?: number | null;
  dateCrossed: string;
  notes?: string;
}) {
  const before = await fetchDb();
  const d = new Date(input.dateCrossed);
  d.setUTCDate(d.getUTCDate() + 150);
  let maleAnimalId: number | null = input.maleAnimalId ?? null;
  let buckName = input.buckName.trim();
  if (maleAnimalId != null) {
    const male = before.animals.find((a) => a.id === maleAnimalId);
    if (!male) throw new Error("Buck animal not found");
    if (!buckName) buckName = animalLabel(male);
  } else {
    maleAnimalId = null;
  }
  const event = {
    id: crypto.randomUUID(),
    female_animal_id: input.femaleId,
    male_animal_id: maleAnimalId,
    buck_name: buckName || null,
    date_crossed: input.dateCrossed,
    expected_due_date: d.toISOString().slice(0, 10),
    delivered_date: null,
    outcome: "Pending" as const,
    status: "Doubt" as const,
    notes: input.notes || null,
  };
  const after = {
    ...before,
    breeding_events: [...before.breeding_events, event],
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertBreeding: [event] });
    return after;
  }
  return persistMutation(before, after);
}

export async function changeStatus(input: {
  animalId: number;
  status: AnimalStatus;
  outDate?: string;
}) {
  const before = await fetchDb();
  const animal = before.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");
  const updated = {
    ...animal,
    status: input.status,
    out_date: input.outDate ?? animal.out_date,
  };
  const after = {
    ...before,
    animals: before.animals.map((a) => (a.id === updated.id ? updated : a)),
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertAnimals: [updated] });
    return after;
  }
  return persistMutation(before, after);
}

export async function deleteSaleReceipt(txId: string) {
  const before = await fetchDb();
  const after = applyDeleteSaleReceipt(before, txId);
  return persistMutation(before, after);
}

export async function undoLivestockSale(animalId: number) {
  const before = await fetchDb();
  const after = applyUndoLivestockSaleForAnimal(before, animalId);
  return persistMutation(before, after);
}

export async function recordLivestockSale(input: {
  date: string;
  animalId: number;
  additionalAnimalIds?: number[];
  grossSalePrice: number;
  deliveryCost?: number;
  receivedBy?: "Monis" | "Saad";
  amountReceivedNow?: number | null;
  notes?: string;
  soldOnPalai?: boolean;
  buyerName?: string | null;
  palaiRatePerGoat?: number | null;
}) {
  const before = await fetchDb();
  const result = beginLivestockSale(before, input);

  if (isSupabaseDb()) {
    const animalIds = new Set(result.sale.animal_ids);
    const entries = result.tx ? withLedgerIds(result.ledger) : [];
    await applyWritePlan({
      upsertContacts: result.newContacts.length ? result.newContacts : undefined,
      upsertAnimals: result.animals.filter((a) => animalIds.has(a.id)),
      upsertTransactions: result.tx ? [result.tx] : undefined,
      upsertLedger: entries.length ? entries : undefined,
      upsertSales: [result.sale],
    });
    return {
      ...before,
      contacts: result.newContacts.length
        ? [...before.contacts, ...result.newContacts]
        : before.contacts,
      animals: result.animals,
      transactions: result.tx ? [...before.transactions, result.tx] : before.transactions,
      partner_ledger_entries: result.tx
        ? [...before.partner_ledger_entries, ...entries]
        : before.partner_ledger_entries,
      livestock_sales: [...(before.livestock_sales ?? []), result.sale],
    };
  }

  const after = applyLivestockSaleToDb(before, input);
  return persistMutation(before, after);
}

export async function partnerTransfer(input: {
  date: string;
  amount: number;
  direction: "from_monis" | "to_monis";
  notes?: string;
}) {
  const before = await fetchDb();
  const { monisId } = getPartnerIds(before);
  const amount = input.direction === "from_monis" ? input.amount : -input.amount;
  const { tx, ledger } = createAdjustmentTransaction({
    date: input.date,
    amount,
    category: "Partner Transfer",
    monisId,
    notes: input.notes || (input.direction === "from_monis" ? "Received from Monis" : "Sent to Monis"),
  });
  const entries = withLedgerIds(ledger);
  const after = {
    ...before,
    transactions: [...before.transactions, tx],
    partner_ledger_entries: [...before.partner_ledger_entries, ...entries],
  };
  if (isSupabaseDb()) {
    await insertTransactionWithLedger(tx, entries);
    return after;
  }
  return persistMutation(before, after);
}

export async function updateTransaction(input: UpdateTransactionInput) {
  const before = await fetchDb();
  const after = applyUpdateTransaction(before, input);
  return persistMutation(before, after);
}

export async function deleteTransaction(id: string) {
  const before = await fetchDb();
  const after = applyDeleteTransaction(before, id);
  return persistMutation(before, after);
}

export async function deleteAnimal(animalId: number) {
  const before = await fetchDb();
  const after = applyDeleteAnimal(before, animalId);
  return persistMutation(before, after);
}
