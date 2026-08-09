/**
 * HOT ZONE: Partner settlement engine.
 * Blast radius: wrong payouts / flawed profit metrics.
 * Do not change without explicit user approval.
 *
 * Canonical formula (verified against Sheets → ±192,247):
 *   cost_base    = sum(amount) over kind='cost'
 *   fair_share   = cost_base / 2
 *   monis_funded = sum(cost paid_by Monis) + sum(signed adjustments)
 *   saad_funded  = sum(cost paid_by Saad)  - sum(signed adjustments)
 *   settlement   = funded - fair_share
 */
import type { FarmDatabase, SettlementResult, Transaction, PartnerLedgerEntry, LedgerCategory } from "../types";

export const MONIS_NAME = "Monis";
export const SAAD_NAME = "Saad";
export const CANONICAL_MONIS_DIFF = 192247;
export const CANONICAL_SAAD_DIFF = -192247;

export function getPartnerIds(db: FarmDatabase) {
  const monis = db.contacts.find((c) => c.name === MONIS_NAME && c.type === "Partner");
  const saad = db.contacts.find((c) => c.name === SAAD_NAME && c.type === "Partner");
  if (!monis || !saad) throw new Error("Partners Monis/Saad must exist in contacts");
  return { monisId: monis.id, saadId: saad.id };
}

export function computeSettlement(db: FarmDatabase): SettlementResult {
  const { monisId, saadId } = getPartnerIds(db);
  let costBase = 0;
  let monisFunded = 0;
  let saadFunded = 0;
  const byCategory: Record<string, number> = {};

  for (const tx of db.transactions) {
    // Livestock Sale ledger rows store one partner's half; show full net proceeds in totals.
    const displayAmount =
      tx.kind === "partner_adjustment" && tx.category === "Livestock Sale"
        ? Math.abs(tx.amount) * 2
        : Math.abs(tx.amount);
    byCategory[tx.category] = (byCategory[tx.category] || 0) + displayAmount;

    if (tx.kind === "cost") {
      costBase += tx.amount;
      if (tx.paid_by_partner_id === monisId) monisFunded += tx.amount;
      else if (tx.paid_by_partner_id === saadId) saadFunded += tx.amount;
    } else if (tx.kind === "partner_adjustment") {
      // partner_adjustment: signed amount on Monis's side of the book
      const adj = tx.amount;
      monisFunded += adj;
      saadFunded -= adj;
    }
  }

  const fairShare = costBase / 2;
  const monisDiff = monisFunded - fairShare;
  const saadDiff = saadFunded - fairShare;
  const amountOwed = Math.abs(Math.round(monisDiff));
  let owedTo: SettlementResult["owedTo"] = "Even";
  if (monisDiff > 0.5) owedTo = "Monis";
  else if (saadDiff > 0.5) owedTo = "Saad";

  return {
    costBase,
    fairShare,
    monisFunded,
    saadFunded,
    monisDiff,
    saadDiff,
    owedTo,
    amountOwed,
    byCategory,
  };
}

export function assertCanonicalSettlement(db: FarmDatabase): SettlementResult {
  const s = computeSettlement(db);
  if (Math.abs(s.monisFunded + s.saadFunded - s.costBase) > 0.01) {
    throw new Error(
      `Balance identity failed: monis+saad=${s.monisFunded + s.saadFunded} costBase=${s.costBase}`
    );
  }
  if (Math.round(s.monisDiff) !== CANONICAL_MONIS_DIFF || Math.round(s.saadDiff) !== CANONICAL_SAAD_DIFF) {
    throw new Error(
      `Settlement mismatch: Monis ${Math.round(s.monisDiff)} / Saad ${Math.round(s.saadDiff)} (expected ±192247)`
    );
  }
  return s;
}

/** Create ledger entries for a cost transaction (payer funded the full amount). */
export function ledgerForCost(
  tx: Transaction,
  paidByPartnerId: string
): Omit<PartnerLedgerEntry, "id" | "created_at">[] {
  return [
    {
      transaction_id: tx.id,
      partner_id: paidByPartnerId,
      amount: tx.amount,
      category: tx.category,
    },
  ];
}

/** Create ledger entry for a partner adjustment (signed amount for Monis book). */
export function ledgerForAdjustment(
  tx: Transaction,
  monisId: string
): Omit<PartnerLedgerEntry, "id" | "created_at">[] {
  return [
    {
      transaction_id: tx.id,
      partner_id: monisId,
      amount: tx.amount,
      category: tx.category,
    },
  ];
}

export function createCostTransaction(input: {
  date: string;
  amount: number;
  category: LedgerCategory;
  paidByPartnerId: string;
  animalId?: number | null;
  vendorId?: string | null;
  customerId?: string | null;
  farmModel?: "Trading" | "Palai" | null;
  notes?: string | null;
  sourceRow?: number | null;
  purchaseAgreementId?: string | null;
  livestockSaleId?: string | null;
}): { tx: Transaction; ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[] } {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    date: input.date,
    amount: input.amount,
    kind: "cost",
    category: input.category,
    farm_model: input.farmModel ?? null,
    animal_id: input.animalId ?? null,
    customer_id: input.customerId ?? null,
    vendor_id: input.vendorId ?? null,
    paid_by_partner_id: input.paidByPartnerId,
    received_by_partner_id: null,
    adjustment_partner_id: null,
    notes: input.notes ?? null,
    source_row: input.sourceRow ?? null,
    purchase_agreement_id: input.purchaseAgreementId ?? null,
    livestock_sale_id: input.livestockSaleId ?? null,
  };
  return { tx, ledger: ledgerForCost(tx, input.paidByPartnerId) };
}

export function createAdjustmentTransaction(input: {
  date: string;
  amount: number;
  category: LedgerCategory;
  monisId: string;
  notes?: string | null;
  sourceRow?: number | null;
  customerId?: string | null;
  animalId?: number | null;
  livestockSaleId?: string | null;
  receivedByPartnerId?: string | null;
}): { tx: Transaction; ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[] } {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    date: input.date,
    amount: input.amount,
    kind: "partner_adjustment",
    category: input.category,
    farm_model: input.category === "Palai Income" ? "Palai" : null,
    animal_id: input.animalId ?? null,
    customer_id: input.customerId ?? null,
    vendor_id: null,
    paid_by_partner_id: null,
    received_by_partner_id: input.receivedByPartnerId ?? null,
    adjustment_partner_id: input.monisId,
    notes: input.notes ?? null,
    source_row: input.sourceRow ?? null,
    purchase_agreement_id: null,
    livestock_sale_id: input.livestockSaleId ?? null,
  };
  return { tx, ledger: ledgerForAdjustment(tx, input.monisId) };
}
