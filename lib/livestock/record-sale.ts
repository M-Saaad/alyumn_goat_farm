/**
 * HOT ZONE: Livestock sale partner adjustments.
 * Blast radius: wrong partner credits on sale proceeds.
 *
 * Sheet convention (matches Google Sheets "Monis column" rows):
 * - Sale proceeds are split 50/50 between Monis and Saad
 * - The ledger adjustment stores ONE partner's half (not the full sale price)
 * - Category totals show full net proceeds (2× the ledger half)
 * - When Monis received net cash: adjustment = −(net/2) → credits Saad's share
 * - When Saad received net cash: adjustment = +(net/2) → credits Monis's share
 */
import type { FarmDatabase, LivestockSale, PartnerLedgerEntry, Transaction } from "../types";
import { createAdjustmentTransaction, getPartnerIds } from "../partner-equity/settlement";

export interface RecordLivestockSaleInput {
  date: string;
  /** Primary goat; use additionalAnimalIds for joint sales (e.g. Bilorani + Bruno). */
  animalId: number;
  additionalAnimalIds?: number[];
  /** Gross amount buyer paid (before delivery deduction). */
  grossSalePrice: number;
  /** Delivery cost deducted from proceeds before 50/50 split. Default 0. */
  deliveryCost?: number;
  /** Who received the net cash. Default Monis (typical farm pattern). */
  receivedBy?: "Monis" | "Saad";
  notes?: string | null;
}

export interface RecordLivestockSaleResult {
  sale: LivestockSale;
  tx: Transaction;
  ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[];
  netReceived: number;
  partnerShare: number;
}

export function computeSaleSplit(grossSalePrice: number, deliveryCost = 0) {
  const netReceived = grossSalePrice - deliveryCost;
  const partnerShare = netReceived / 2;
  return { netReceived, partnerShare };
}

/**
 * Build the partner adjustment for a livestock sale.
 * Returns signed amount on Monis's book (same convention as Palai / Sheets).
 */
export function saleAdjustmentAmount(partnerShare: number, receivedBy: "Monis" | "Saad") {
  return receivedBy === "Monis" ? -partnerShare : partnerShare;
}

export function recordLivestockSale(
  db: FarmDatabase,
  input: RecordLivestockSaleInput
): RecordLivestockSaleResult {
  const animal = db.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");

  const { monisId, saadId } = getPartnerIds(db);
  const deliveryCost = input.deliveryCost ?? 0;
  const receivedBy = input.receivedBy ?? "Monis";
  const { netReceived, partnerShare } = computeSaleSplit(input.grossSalePrice, deliveryCost);
  const animalIds = [input.animalId, ...(input.additionalAnimalIds ?? [])];

  if (netReceived < 0) throw new Error("Net sale amount cannot be negative");
  if (partnerShare === 0) throw new Error("Partner share must be non-zero");

  const otherPartner = receivedBy === "Monis" ? "Saad" : "Monis";
  const deliveryNote =
    deliveryCost > 0 ? `, ${deliveryCost} delivery → net ${netReceived}` : "";
  const notes =
    input.notes ||
    `Sale of ${animal.name || animal.description} — ${otherPartner} share (${receivedBy} received${deliveryNote})`;

  const adjustmentAmount = saleAdjustmentAmount(partnerShare, receivedBy);
  const receivedByPartnerId = receivedBy === "Monis" ? monisId : saadId;

  const { tx, ledger } = createAdjustmentTransaction({
    date: input.date,
    amount: adjustmentAmount,
    category: "Livestock Sale",
    monisId,
    animalId: input.animalId,
    notes,
  });

  const sale: LivestockSale = {
    id: crypto.randomUUID(),
    date: input.date,
    animal_ids: animalIds,
    gross_sale_price: input.grossSalePrice,
    delivery_cost: deliveryCost,
    net_received: netReceived,
    partner_share: partnerShare,
    received_by_partner_id: receivedByPartnerId,
    transaction_id: tx.id,
    notes: input.notes ?? null,
  };

  return { sale, tx, ledger, netReceived, partnerShare };
}

export function applyLivestockSaleToDb(
  db: FarmDatabase,
  input: RecordLivestockSaleInput
): FarmDatabase {
  const result = recordLivestockSale(db, input);
  const now = new Date().toISOString();
  const animalIds = new Set(result.sale.animal_ids);

  const animals = db.animals.map((a) => {
    if (!animalIds.has(a.id)) return a;
    return {
      ...a,
      status: "Sold" as const,
      out_date: input.date,
      sold_price: input.grossSalePrice,
    };
  });

  return {
    ...db,
    animals,
    transactions: [...db.transactions, result.tx],
    partner_ledger_entries: [
      ...db.partner_ledger_entries,
      ...result.ledger.map((l) => ({ ...l, id: crypto.randomUUID(), created_at: now })),
    ],
    livestock_sales: [...(db.livestock_sales ?? []), result.sale],
  };
}
