import type { AnimalBreed, AnimalSex, AnimalStatus, FarmDatabase, LivestockSale } from "../types";
import {
  agreementStatus,
  createPurchaseAgreement,
  findPurchaseAgreement,
  legacyPurchasePaid,
} from "../livestock/purchase-agreement";
import { computeSaleSplit, findSaleForAnimal } from "../livestock/record-sale";

export type UpdateAnimalInput = {
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
  status?: AnimalStatus;
  date_of_purchase?: string | null;
  purchase_price?: number | null;
  purchase_paid?: number | null;
  out_date?: string | null;
  sold_price?: number | null;
  sale_date?: string | null;
  gross_sale_price?: number | null;
  delivery_cost?: number | null;
  amount_received?: number | null;
};

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

function parseOptionalNumber(value: number | null | undefined): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  return value;
}

function updatePurchaseAgreement(
  db: FarmDatabase,
  animalId: number,
  vendorId: string | null,
  purchasePrice: number | undefined,
  purchasePaid: number | undefined
): FarmDatabase {
  if (purchasePrice == null && purchasePaid == null) return db;

  const agreement = findPurchaseAgreement(db, animalId);
  const animal = db.animals.find((a) => a.id === animalId)!;
  const total =
    purchasePrice ??
    agreement?.total_amount ??
    (animal.price > 0 ? animal.price : undefined);
  if (total == null) return db;

  const paid =
    purchasePaid ??
    agreement?.amount_paid ??
    legacyPurchasePaid(db, animalId);

  if (paid < 0) throw new Error("Amount paid cannot be negative");
  if (paid > total + 0.005) {
    throw new Error(`Amount paid (${paid}) cannot exceed purchase price (${total})`);
  }

  const nextAgreement = agreement
    ? {
        ...agreement,
        vendor_id: vendorId ?? agreement.vendor_id,
        total_amount: total,
        amount_paid: paid,
        status: agreementStatus(paid, total),
      }
    : createPurchaseAgreement({
        animalId,
        vendorId,
        totalAmount: total,
        amountPaid: paid,
        notes: `Purchase — ${animal.name || animal.description || "goat"}`,
      });

  const agreements = agreement
    ? (db.purchase_agreements ?? []).map((a) => (a.id === agreement!.id ? nextAgreement : a))
    : [...(db.purchase_agreements ?? []), nextAgreement];

  return { ...db, purchase_agreements: agreements };
}

function updateLivestockSale(
  db: FarmDatabase,
  animalId: number,
  input: {
    sale_date?: string | null;
    gross_sale_price?: number | null;
    delivery_cost?: number | null;
    amount_received?: number | null;
    sold_price?: number | null;
  }
): { db: FarmDatabase; sale?: LivestockSale } {
  const sale = findSaleForAnimal(db, animalId);
  if (!sale) return { db };

  const gross =
    parseOptionalNumber(input.gross_sale_price) ??
    parseOptionalNumber(input.sold_price) ??
    sale.gross_sale_price;
  const delivery =
    input.delivery_cost != null && !Number.isNaN(input.delivery_cost)
      ? input.delivery_cost
      : sale.delivery_cost;
  const { netReceived, partnerShare } = computeSaleSplit(gross, delivery);
  const received =
    input.amount_received != null && !Number.isNaN(input.amount_received)
      ? input.amount_received
      : sale.amount_received;

  if (received < 0) throw new Error("Amount received cannot be negative");
  if (received > netReceived + 0.005) {
    throw new Error(`Amount received (${received}) cannot exceed net proceeds (${netReceived})`);
  }

  const updatedSale: LivestockSale = {
    ...sale,
    date: input.sale_date?.trim() || sale.date,
    gross_sale_price: gross,
    delivery_cost: delivery,
    net_received: netReceived,
    partner_share: partnerShare,
    amount_received: received,
    status: agreementStatus(received, netReceived),
  };

  return {
    db: {
      ...db,
      livestock_sales: (db.livestock_sales ?? []).map((s) =>
        s.id === sale.id ? updatedSale : s
      ),
    },
    sale: updatedSale,
  };
}

export function applyUpdateAnimalDetails(
  db: FarmDatabase,
  input: UpdateAnimalInput
): { db: FarmDatabase; newContacts: FarmDatabase["contacts"] } {
  const animal = db.animals.find((a) => a.id === input.id);
  if (!animal) throw new Error("Animal not found");

  const ownerRes = resolveOwnerContact(db, input.ownerName);
  const vendorRes = resolveVendor(db, input.vendorName);
  const newContacts: FarmDatabase["contacts"] = [];
  let nextDb = db;

  if (ownerRes.created) {
    newContacts.push(ownerRes.contact);
    nextDb = { ...nextDb, contacts: [...nextDb.contacts, ownerRes.contact] };
  }
  if (vendorRes.contact) {
    newContacts.push(vendorRes.contact);
    nextDb = { ...nextDb, contacts: [...nextDb.contacts, vendorRes.contact] };
  }

  const owner = ownerRes.contact;
  const isHomeBred = Boolean(input.home_bred);
  const purchasePrice = parseOptionalNumber(input.purchase_price);
  const soldPrice = parseOptionalNumber(input.sold_price ?? input.gross_sale_price);

  const nextStatus = input.status ?? animal.status;

  const updatedAnimal = {
    ...animal,
    name: input.name?.trim() || null,
    breed: input.breed ?? null,
    sex: input.sex ?? null,
    description: input.description?.trim() || null,
    comment: input.comment?.trim() || null,
    owner_id: owner.id,
    purchased_from: isHomeBred ? null : vendorRes.id,
    age_at_purchase: input.age_at_purchase?.trim() || null,
    home_bred: isHomeBred,
    status: nextStatus,
    date_of_purchase: input.date_of_purchase?.trim() || animal.date_of_purchase,
    price: isHomeBred ? 0 : (purchasePrice ?? animal.price),
    out_date:
      input.out_date !== undefined
        ? input.out_date?.trim() || null
        : nextStatus === "Sold" && !animal.out_date
          ? input.sale_date?.trim() || animal.out_date
          : animal.out_date,
    sold_price: nextStatus === "Sold" ? soldPrice ?? animal.sold_price : null,
    palai_rate:
      owner.type === "Customer" && input.palai_rate != null && !Number.isNaN(input.palai_rate)
        ? input.palai_rate
        : owner.type === "Customer"
          ? animal.palai_rate
          : null,
  };

  nextDb = {
    ...nextDb,
    animals: nextDb.animals.map((a) => (a.id === updatedAnimal.id ? updatedAnimal : a)),
  };

  if (!isHomeBred) {
    nextDb = updatePurchaseAgreement(
      nextDb,
      input.id,
      vendorRes.id,
      purchasePrice ?? (updatedAnimal.price > 0 ? updatedAnimal.price : undefined),
      parseOptionalNumber(input.purchase_paid)
    );
  }

  const saleResult = updateLivestockSale(nextDb, input.id, {
    sale_date: input.sale_date,
    gross_sale_price: input.gross_sale_price ?? input.sold_price,
    delivery_cost: input.delivery_cost,
    amount_received: input.amount_received,
    sold_price: input.sold_price,
  });
  nextDb = saleResult.db;

  if (saleResult.sale && updatedAnimal.sold_price == null) {
    nextDb = {
      ...nextDb,
      animals: nextDb.animals.map((a) =>
        a.id === updatedAnimal.id ? { ...a, sold_price: saleResult.sale!.gross_sale_price } : a
      ),
    };
  }

  return { db: nextDb, newContacts };
}
