/**
 * Transaction update/delete with ledger re-sync.
 * Settlement formula is untouched — only rebuilds ledger rows for the affected tx
 * using existing ledgerForCost / ledgerForAdjustment / Palai / Sale helpers.
 */
import type {
  FarmDatabase,
  LedgerCategory,
  LivestockSale,
  PalaiPayment,
  Transaction,
} from "../types";
import {
  getPartnerIds,
  ledgerForAdjustment,
  ledgerForCost,
} from "../partner-equity/settlement";
import {
  computeSaleSplit,
  saleAdjustmentAmount,
} from "../livestock/record-sale";
import { applyDeleteSaleReceipt, findSaleForReceipt } from "../livestock/cancel-sale";
import { buildPalaiNotes, normalizeServiceMonth } from "../palai/service-month";
import { diffDb, type WritePlan } from "../db/writes";

export type TransactionEditVariant =
  | "expense"
  | "livestock_purchase"
  | "partner_transfer"
  | "palai_income"
  | "livestock_sale";

export function resolveTransactionKind(tx: Transaction): TransactionEditVariant {
  if (tx.category === "Livestock Sale") return "livestock_sale";
  if (tx.category === "Palai Income") return "palai_income";
  if (tx.category === "Partner Transfer") return "partner_transfer";
  if (tx.kind === "cost" && tx.category === "Livestock Purchase") return "livestock_purchase";
  if (tx.kind === "cost") return "expense";
  // Fallback: treat other partner_adjustments like a transfer (date/amount/notes)
  return "partner_transfer";
}

function rebuildLedger(db: FarmDatabase, tx: Transaction): FarmDatabase {
  const { monisId } = getPartnerIds(db);
  const without = db.partner_ledger_entries.filter((e) => e.transaction_id !== tx.id);
  const now = new Date().toISOString();
  const raw =
    tx.kind === "cost"
      ? ledgerForCost(tx, tx.paid_by_partner_id!)
      : ledgerForAdjustment(tx, monisId);
  const entries = raw.map((l) => ({ ...l, id: crypto.randomUUID(), created_at: now }));
  return { ...db, partner_ledger_entries: [...without, ...entries] };
}

function removeTxAndLedger(db: FarmDatabase, txId: string): FarmDatabase {
  return {
    ...db,
    transactions: db.transactions.filter((t) => t.id !== txId),
    partner_ledger_entries: db.partner_ledger_entries.filter((e) => e.transaction_id !== txId),
  };
}

function findOrCreateContact(
  db: FarmDatabase,
  name: string,
  type: "Customer" | "Vendor"
): { db: FarmDatabase; id: string } {
  const existing = db.contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type
  );
  if (existing) return { db, id: existing.id };
  const contact = {
    id: crypto.randomUUID(),
    name,
    type,
    phone: null,
    notes: null,
  };
  return { db: { ...db, contacts: [...db.contacts, contact] }, id: contact.id };
}

export type UpdateTransactionInput =
  | {
      id: string;
      variant: "expense";
      date: string;
      amount: number;
      category: LedgerCategory;
      paidBy: "Monis" | "Saad";
      animalId?: number | null;
      notes?: string | null;
    }
  | {
      id: string;
      variant: "livestock_purchase";
      date: string;
      amount: number;
      paidBy: "Monis" | "Saad";
      vendorName?: string | null;
      notes?: string | null;
    }
  | {
      id: string;
      variant: "partner_transfer";
      date: string;
      amount: number;
      direction: "from_monis" | "to_monis";
      notes?: string | null;
    }
  | {
      id: string;
      variant: "palai_income";
      date: string;
      serviceMonth: string;
      customerName: string;
      ratePerGoat: number;
      goatCount: number;
      paymentMethod?: string | null;
      notes?: string | null;
      receivedBy: "Monis" | "Saad";
    }
  | {
      id: string;
      variant: "livestock_sale";
      date: string;
      animalId: number;
      additionalAnimalIds?: number[];
      grossSalePrice: number;
      deliveryCost?: number;
      receivedBy: "Monis" | "Saad";
      notes?: string | null;
    };

export function applyUpdateTransaction(
  db: FarmDatabase,
  input: UpdateTransactionInput
): FarmDatabase {
  const tx = db.transactions.find((t) => t.id === input.id);
  if (!tx) throw new Error("Transaction not found");
  const variant = resolveTransactionKind(tx);
  if (variant !== input.variant) {
    throw new Error(`Cannot edit as ${input.variant}; transaction is ${variant}`);
  }

  const { monisId, saadId } = getPartnerIds(db);

  switch (input.variant) {
    case "expense": {
      const paidById = input.paidBy === "Monis" ? monisId : saadId;
      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: input.amount,
        category: input.category,
        paid_by_partner_id: paidById,
        animal_id: input.animalId ?? null,
        notes: input.notes || null,
      };
      const next = {
        ...db,
        transactions: db.transactions.map((t) => (t.id === tx.id ? updated : t)),
      };
      return rebuildLedger(next, updated);
    }

    case "livestock_purchase": {
      const paidById = input.paidBy === "Monis" ? monisId : saadId;
      let next = db;
      let vendorId: string | null = tx.vendor_id;
      if (input.vendorName != null && input.vendorName.trim()) {
        const r = findOrCreateContact(next, input.vendorName.trim(), "Vendor");
        next = r.db;
        vendorId = r.id;
      } else if (input.vendorName === "") {
        vendorId = null;
      }

      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: input.amount,
        paid_by_partner_id: paidById,
        vendor_id: vendorId,
        notes: input.notes || null,
      };

      const animals = next.animals.map((a) => {
        if (tx.animal_id == null || a.id !== tx.animal_id) return a;
        return {
          ...a,
          price: input.amount,
          date_of_purchase: input.date,
          purchased_from: vendorId,
        };
      });

      next = {
        ...next,
        animals,
        transactions: next.transactions.map((t) => (t.id === tx.id ? updated : t)),
      };
      return rebuildLedger(next, updated);
    }

    case "partner_transfer": {
      const signed = input.direction === "from_monis" ? input.amount : -input.amount;
      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: signed,
        notes:
          input.notes ||
          (input.direction === "from_monis" ? "Received from Monis" : "Sent to Monis"),
        adjustment_partner_id: monisId,
      };
      const next = {
        ...db,
        transactions: db.transactions.map((t) => (t.id === tx.id ? updated : t)),
      };
      return rebuildLedger(next, updated);
    }

    case "palai_income": {
      const total = input.ratePerGoat * input.goatCount;
      const half = total / 2;
      const receivedBy = input.receivedBy ?? "Saad";
      const adjustmentAmount = receivedBy === "Saad" ? half : -half;
      const receivedByPartnerId = receivedBy === "Monis" ? monisId : saadId;
      const serviceMonth = normalizeServiceMonth(input.serviceMonth);

      let next = db;
      const r = findOrCreateContact(next, input.customerName.trim(), "Customer");
      next = r.db;
      const customerId = r.id;

      const notes = buildPalaiNotes({
        goatCount: input.goatCount,
        ratePerGoat: input.ratePerGoat,
        totalAmount: total,
        serviceMonth,
        notes: input.notes,
      });

      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: adjustmentAmount,
        category: "Palai Income",
        farm_model: "Palai",
        customer_id: customerId,
        notes,
        adjustment_partner_id: monisId,
        received_by_partner_id: receivedByPartnerId,
      };

      const existingPayment = next.palai_payments.find((p) => p.transaction_id === tx.id);
      const payment: PalaiPayment = existingPayment
        ? {
            ...existingPayment,
            date: input.date,
            service_month: serviceMonth,
            customer_id: customerId,
            rate_per_goat: input.ratePerGoat,
            goat_count: input.goatCount,
            total_amount: total,
            payment_method: input.paymentMethod ?? null,
            notes: input.notes || null,
            transaction_id: tx.id,
          }
        : {
            id: crypto.randomUUID(),
            date: input.date,
            service_month: serviceMonth,
            customer_id: customerId,
            rate_per_goat: input.ratePerGoat,
            goat_count: input.goatCount,
            total_amount: total,
            payment_method: input.paymentMethod ?? null,
            notes: input.notes || null,
            transaction_id: tx.id,
          };

      const palai_payments = existingPayment
        ? next.palai_payments.map((p) => (p.id === existingPayment.id ? payment : p))
        : [...next.palai_payments, payment];

      next = {
        ...next,
        transactions: next.transactions.map((t) => (t.id === tx.id ? updated : t)),
        palai_payments,
      };
      return rebuildLedger(next, updated);
    }

    case "livestock_sale": {
      const deliveryCost = input.deliveryCost ?? 0;
      const { netReceived, partnerShare } = computeSaleSplit(
        input.grossSalePrice,
        deliveryCost
      );
      if (netReceived < 0) throw new Error("Net sale amount cannot be negative");
      if (partnerShare === 0) throw new Error("Partner share must be non-zero");

      const animalIds = [input.animalId, ...(input.additionalAnimalIds ?? [])];
      const primary = db.animals.find((a) => a.id === input.animalId);
      if (!primary) throw new Error("Animal not found");

      const otherPartner = input.receivedBy === "Monis" ? "Saad" : "Monis";
      const deliveryNote =
        deliveryCost > 0 ? `, ${deliveryCost} delivery → net ${netReceived}` : "";
      const notes =
        input.notes ||
        `Sale of ${primary.name || primary.description} — ${otherPartner} share (${input.receivedBy} received${deliveryNote})`;

      const adjustmentAmount = saleAdjustmentAmount(partnerShare, input.receivedBy);
      const receivedByPartnerId = input.receivedBy === "Monis" ? monisId : saadId;

      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: adjustmentAmount,
        category: "Livestock Sale",
        animal_id: input.animalId,
        notes,
        adjustment_partner_id: monisId,
      };

      const existingSale = (db.livestock_sales ?? []).find(
        (s) => s.transaction_id === tx.id || s.id === tx.livestock_sale_id
      );
      const prevAnimalIds = new Set(existingSale?.animal_ids ?? (tx.animal_id != null ? [tx.animal_id] : []));
      const newAnimalIds = new Set(animalIds);

      // Revert animals no longer on this sale
      const animals = db.animals.map((a) => {
        if (prevAnimalIds.has(a.id) && !newAnimalIds.has(a.id)) {
          return { ...a, status: "Active" as const, sold_price: null, out_date: null };
        }
        if (newAnimalIds.has(a.id)) {
          return {
            ...a,
            status: "Sold" as const,
            out_date: input.date,
            sold_price: input.grossSalePrice,
          };
        }
        return a;
      });

      const amountReceived = existingSale
        ? Math.min(existingSale.amount_received, netReceived)
        : netReceived;

      const sale: LivestockSale = existingSale
        ? {
            ...existingSale,
            date: input.date,
            animal_ids: animalIds,
            gross_sale_price: input.grossSalePrice,
            delivery_cost: deliveryCost,
            net_received: netReceived,
            partner_share: partnerShare,
            received_by_partner_id: receivedByPartnerId,
            amount_received: amountReceived,
            status: amountReceived >= netReceived - 0.005 ? "settled" : "open",
            notes: input.notes || null,
          }
        : {
            id: crypto.randomUUID(),
            date: input.date,
            animal_ids: animalIds,
            gross_sale_price: input.grossSalePrice,
            delivery_cost: deliveryCost,
            net_received: netReceived,
            partner_share: partnerShare,
            received_by_partner_id: receivedByPartnerId,
            transaction_id: tx.id,
            amount_received: netReceived,
            status: "settled",
            notes: input.notes || null,
          };

      const livestock_sales = existingSale
        ? (db.livestock_sales ?? []).map((s) => (s.id === existingSale.id ? sale : s))
        : [...(db.livestock_sales ?? []), sale];

      const next = {
        ...db,
        animals,
        transactions: db.transactions.map((t) => (t.id === tx.id ? updated : t)),
        livestock_sales,
      };
      return rebuildLedger(next, updated);
    }
  }
}

export function applyDeleteTransaction(db: FarmDatabase, id: string): FarmDatabase {
  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) throw new Error("Transaction not found");
  const variant = resolveTransactionKind(tx);

  switch (variant) {
    case "expense":
    case "partner_transfer": {
      return removeTxAndLedger(db, id);
    }

    case "palai_income": {
      const next = removeTxAndLedger(db, id);
      return {
        ...next,
        palai_payments: next.palai_payments.filter((p) => p.transaction_id !== id),
      };
    }

    case "livestock_sale": {
      const linkedSale = findSaleForReceipt(db, id);
      if (linkedSale) {
        return applyDeleteSaleReceipt(db, id);
      }
      return removeTxAndLedger(db, id);
    }

    case "livestock_purchase": {
      const animalId = tx.animal_id;
      if (animalId != null) {
        const otherTxs = db.transactions.filter(
          (t) => t.id !== id && t.animal_id === animalId
        );
        const medical = db.medical_events.filter((m) => m.animal_id === animalId);
        const breeding = db.breeding_events.filter(
          (b) => b.female_animal_id === animalId || b.male_animal_id === animalId
        );
        const sales = (db.livestock_sales ?? []).filter((s) => s.animal_ids.includes(animalId));
        const media = (db.animal_media ?? []).filter((m) => m.animal_id === animalId);
        const weights = (db.weight_logs ?? []).filter((w) => w.animal_id === animalId);

        if (
          otherTxs.length > 0 ||
          medical.length > 0 ||
          breeding.length > 0 ||
          sales.length > 0 ||
          media.length > 0 ||
          weights.length > 0
        ) {
          throw new Error(
            "Cannot delete this purchase: the linked animal has medical, breeding, sales, or other records. Remove those first, or keep the purchase transaction."
          );
        }

        const next = removeTxAndLedger(db, id);
        return {
          ...next,
          animals: next.animals.filter((a) => a.id !== animalId),
        };
      }
      return removeTxAndLedger(db, id);
    }
  }
}

/** Build a row-level WritePlan for an update (in-memory apply + diff). */
export function planUpdateTransaction(
  db: FarmDatabase,
  input: UpdateTransactionInput
): { after: FarmDatabase; plan: WritePlan } {
  const after = applyUpdateTransaction(db, input);
  return { after, plan: diffDb(db, after) };
}

/** Build a row-level WritePlan for a delete (in-memory apply + diff). */
export function planDeleteTransaction(
  db: FarmDatabase,
  id: string
): { after: FarmDatabase; plan: WritePlan } {
  const after = applyDeleteTransaction(db, id);
  return { after, plan: diffDb(db, after) };
}
