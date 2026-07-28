/**
 * HOT ZONE: Livestock sale partner adjustments.
 * Blast radius: wrong partner credits on sale proceeds.
 *
 * Sheet convention (matches Google Sheets "Monis column" rows):
 * - Sale proceeds are split 50/50 between Monis and Saad
 * - Each cash receipt posts ONE partner's half (not the full receipt)
 * - Category totals show full receipt amount (2× the ledger half)
 * - When Monis received cash: adjustment = −(receipt/2) → credits Saad's share
 * - When Saad received cash: adjustment = +(receipt/2) → credits Monis's share
 */
import type {
  AgreementStatus,
  FarmDatabase,
  LivestockSale,
  PartnerLedgerEntry,
  Transaction,
} from "../types";
import { createAdjustmentTransaction, getPartnerIds } from "../partner-equity/settlement";
import { agreementStatus } from "./purchase-agreement";

export interface RecordLivestockSaleInput {
  date: string;
  animalId: number;
  additionalAnimalIds?: number[];
  grossSalePrice: number;
  deliveryCost?: number;
  receivedBy?: "Monis" | "Saad";
  /** Cash received now toward net proceeds. Defaults to full net. Use 0 for sold-with-no-cash-yet. */
  amountReceivedNow?: number | null;
  notes?: string | null;
}

export interface SaleReceiptInput {
  date: string;
  amount: number;
  receivedBy: "Monis" | "Saad";
  notes?: string | null;
}

export interface SaleReceiptResult {
  tx: Transaction;
  ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[];
  sale: LivestockSale;
}

export function computeSaleSplit(grossSalePrice: number, deliveryCost = 0) {
  const netReceived = grossSalePrice - deliveryCost;
  const partnerShare = netReceived / 2;
  return { netReceived, partnerShare };
}

export function saleAdjustmentAmount(receiptAmount: number, receivedBy: "Monis" | "Saad") {
  const half = receiptAmount / 2;
  return receivedBy === "Monis" ? -half : half;
}

export function saleBalance(sale: LivestockSale): number {
  return Math.max(0, sale.net_received - sale.amount_received);
}

export function findSaleForAnimal(db: FarmDatabase, animalId: number): LivestockSale | undefined {
  return (db.livestock_sales ?? []).find((s) => s.animal_ids.includes(animalId));
}

export function saleReceiptTxIds(db: FarmDatabase, saleId: string): string[] {
  return db.transactions
    .filter((t) => t.livestock_sale_id === saleId)
    .map((t) => t.id);
}

function validateReceiptAmount(sale: LivestockSale, amount: number) {
  if (amount <= 0 || Number.isNaN(amount)) {
    throw new Error("Receipt amount must be positive");
  }
  const balance = saleBalance(sale);
  if (amount > balance + 0.005) {
    throw new Error(`Receipt exceeds outstanding balance (${balance})`);
  }
}

export function buildSaleReceipt(
  db: FarmDatabase,
  sale: LivestockSale,
  input: SaleReceiptInput,
  opts?: { initialLink?: boolean }
): SaleReceiptResult {
  validateReceiptAmount(sale, input.amount);
  const animal = db.animals.find((a) => sale.animal_ids.includes(a.id));
  const { monisId, saadId } = getPartnerIds(db);
  const receivedByPartnerId = input.receivedBy === "Monis" ? monisId : saadId;
  const otherPartner = input.receivedBy === "Monis" ? "Saad" : "Monis";
  const notes =
    input.notes ||
    `Sale receipt — ${animal?.name || animal?.description || "goat"} (${otherPartner} share, ${input.receivedBy} received)`;

  const { tx, ledger } = createAdjustmentTransaction({
    date: input.date,
    amount: saleAdjustmentAmount(input.amount, input.receivedBy),
    category: "Livestock Sale",
    monisId,
    animalId: sale.animal_ids[0] ?? null,
    notes,
    // Initial sale receipt links via livestock_sales.transaction_id only — both rows
    // are inserted together and livestock_sale_id would violate FK ordering on Supabase.
    livestockSaleId: opts?.initialLink ? null : sale.id,
  });

  const nextReceived = sale.amount_received + input.amount;
  const updatedSale: LivestockSale = {
    ...sale,
    amount_received: nextReceived,
    status: agreementStatus(nextReceived, sale.net_received) as AgreementStatus,
    received_by_partner_id: receivedByPartnerId,
    transaction_id: sale.transaction_id ?? tx.id,
  };

  return { tx, ledger, sale: updatedSale };
}

export function beginLivestockSale(
  db: FarmDatabase,
  input: RecordLivestockSaleInput
): {
  sale: LivestockSale;
  tx: Transaction | null;
  ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[];
  animals: FarmDatabase["animals"];
} {
  const animal = db.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");

  const deliveryCost = input.deliveryCost ?? 0;
  const { netReceived } = computeSaleSplit(input.grossSalePrice, deliveryCost);
  const animalIds = [input.animalId, ...(input.additionalAnimalIds ?? [])];

  if (netReceived < 0) throw new Error("Net sale amount cannot be negative");

  const receivedNow =
    input.amountReceivedNow == null || Number.isNaN(input.amountReceivedNow)
      ? netReceived
      : input.amountReceivedNow;

  if (receivedNow < 0) throw new Error("Amount received cannot be negative");
  if (receivedNow > netReceived + 0.005) {
    throw new Error(`Received amount cannot exceed net proceeds (${netReceived})`);
  }

  const sale: LivestockSale = {
    id: crypto.randomUUID(),
    date: input.date,
    animal_ids: animalIds,
    gross_sale_price: input.grossSalePrice,
    delivery_cost: deliveryCost,
    net_received: netReceived,
    partner_share: netReceived / 2,
    received_by_partner_id: "",
    transaction_id: null,
    amount_received: 0,
    status: receivedNow >= netReceived - 0.005 ? "settled" : "open",
    notes: input.notes ?? null,
  };

  let tx: Transaction | null = null;
  let ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[] = [];

  if (receivedNow > 0) {
    const receipt = buildSaleReceipt(
      db,
      { ...sale, amount_received: 0 },
      {
        date: input.date,
        amount: receivedNow,
        receivedBy: input.receivedBy ?? "Monis",
        notes: input.notes ?? undefined,
      },
      { initialLink: true }
    );
    tx = receipt.tx;
    ledger = receipt.ledger;
    sale.amount_received = receipt.sale.amount_received;
    sale.status = receipt.sale.status;
    sale.received_by_partner_id = receipt.sale.received_by_partner_id;
    sale.transaction_id = receipt.tx.id;
  } else {
    const { monisId, saadId } = getPartnerIds(db);
    sale.received_by_partner_id = (input.receivedBy ?? "Monis") === "Monis" ? monisId : saadId;
  }

  const idSet = new Set(animalIds);
  const animals = db.animals.map((a) => {
    if (!idSet.has(a.id)) return a;
    return {
      ...a,
      status: "Sold" as const,
      out_date: input.date,
      sold_price: input.grossSalePrice,
    };
  });

  return { sale, tx, ledger, animals };
}

export function applyLivestockSaleToDb(
  db: FarmDatabase,
  input: RecordLivestockSaleInput
): FarmDatabase {
  const result = beginLivestockSale(db, input);
  const now = new Date().toISOString();

  return {
    ...db,
    animals: result.animals,
    transactions: result.tx ? [...db.transactions, result.tx] : db.transactions,
    partner_ledger_entries: result.tx
      ? [
          ...db.partner_ledger_entries,
          ...result.ledger.map((l) => ({ ...l, id: crypto.randomUUID(), created_at: now })),
        ]
      : db.partner_ledger_entries,
    livestock_sales: [...(db.livestock_sales ?? []), result.sale],
  };
}

export function applySaleReceiptToDb(
  db: FarmDatabase,
  saleId: string,
  input: SaleReceiptInput
): FarmDatabase {
  const sale = (db.livestock_sales ?? []).find((s) => s.id === saleId);
  if (!sale) throw new Error("Sale not found");

  const { tx, ledger, sale: updatedSale } = buildSaleReceipt(db, sale, input);
  const now = new Date().toISOString();

  return {
    ...db,
    transactions: [...db.transactions, tx],
    partner_ledger_entries: [
      ...db.partner_ledger_entries,
      ...ledger.map((l) => ({ ...l, id: crypto.randomUUID(), created_at: now })),
    ],
    livestock_sales: (db.livestock_sales ?? []).map((s) => (s.id === saleId ? updatedSale : s)),
  };
}

// Backward-compatible exports used by tests
export function recordLivestockSale(db: FarmDatabase, input: RecordLivestockSaleInput) {
  const result = beginLivestockSale(db, input);
  if (!result.tx) {
    throw new Error("Partner share must be non-zero");
  }
  return {
    sale: result.sale,
    tx: result.tx,
    ledger: result.ledger,
    netReceived: result.sale.net_received,
    partnerShare: result.sale.partner_share,
  };
}
