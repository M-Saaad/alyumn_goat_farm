/**
 * Row-level Supabase writes. Prefer these over full-table saveToSupabase at runtime.
 * Seed scripts may still call saveToSupabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Animal,
  AnimalMedia,
  BreedingEvent,
  Contact,
  FarmDatabase,
  LivestockSale,
  MedicalEvent,
  PalaiPayment,
  PartnerLedgerEntry,
  Transaction,
  WeightLog,
} from "../types";
import { createServiceClient } from "../supabase/admin";
import { isSupabaseDb, persistDb } from "../db";

export type WritePlan = {
  upsertContacts?: Contact[];
  upsertAnimals?: Animal[];
  deleteAnimalIds?: number[];
  upsertTransactions?: Transaction[];
  deleteTransactionIds?: string[];
  upsertLedger?: PartnerLedgerEntry[];
  deleteLedgerIds?: string[];
  /** Delete all ledger rows for these transaction ids (before upserting new ones). */
  replaceLedgerForTxIds?: string[];
  upsertPalai?: PalaiPayment[];
  deletePalaiIds?: string[];
  upsertSales?: LivestockSale[];
  deleteSaleIds?: string[];
  upsertMedical?: MedicalEvent[];
  upsertBreeding?: BreedingEvent[];
  upsertMedia?: AnimalMedia[];
  upsertWeights?: WeightLog[];
};

function txRow(t: Transaction): Record<string, unknown> {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    kind: t.kind,
    category: t.category,
    farm_model: t.farm_model,
    animal_id: t.animal_id,
    customer_id: t.customer_id,
    vendor_id: t.vendor_id,
    paid_by_partner_id: t.paid_by_partner_id,
    received_by_partner_id: t.received_by_partner_id,
    adjustment_partner_id: t.adjustment_partner_id,
    notes: t.notes,
    source_row: t.source_row,
  };
}

function contactRow(c: Contact): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    phone: c.phone ?? null,
    notes: c.notes ?? null,
  };
}

function animalRow(a: Animal): Record<string, unknown> {
  return {
    id: a.id,
    name: a.name,
    breed: a.breed,
    sex: a.sex,
    date_of_purchase: a.date_of_purchase,
    age_at_purchase: a.age_at_purchase,
    description: a.description,
    comment: a.comment,
    status: a.status,
    price: a.price,
    sold_price: a.sold_price,
    purchased_from: a.purchased_from,
    owner_id: a.owner_id,
    home_bred: a.home_bred,
    out_date: a.out_date,
    palai_rate: a.palai_rate,
  };
}

function ledgerRow(l: PartnerLedgerEntry): Record<string, unknown> {
  return {
    id: l.id,
    transaction_id: l.transaction_id,
    partner_id: l.partner_id,
    amount: l.amount,
    category: l.category,
    created_at: l.created_at,
  };
}

function palaiRow(p: PalaiPayment): Record<string, unknown> {
  return {
    id: p.id,
    date: p.date,
    customer_id: p.customer_id,
    rate_per_goat: p.rate_per_goat,
    goat_count: p.goat_count,
    total_amount: p.total_amount,
    payment_method: p.payment_method,
    transaction_id: p.transaction_id,
    notes: p.notes,
  };
}

function saleRow(s: LivestockSale): Record<string, unknown> {
  return {
    id: s.id,
    date: s.date,
    animal_ids: s.animal_ids,
    gross_sale_price: s.gross_sale_price,
    delivery_cost: s.delivery_cost,
    net_received: s.net_received,
    partner_share: s.partner_share,
    received_by_partner_id: s.received_by_partner_id,
    transaction_id: s.transaction_id,
    notes: s.notes,
  };
}

function medicalRow(m: MedicalEvent): Record<string, unknown> {
  return {
    id: m.id,
    animal_id: m.animal_id,
    event_type: m.event_type,
    date: m.date,
    notes: m.notes,
    transaction_id: m.transaction_id,
  };
}

function breedingRow(b: BreedingEvent): Record<string, unknown> {
  return {
    id: b.id,
    female_animal_id: b.female_animal_id,
    male_animal_id: b.male_animal_id,
    buck_name: b.buck_name,
    date_crossed: b.date_crossed,
    expected_due_date: b.expected_due_date,
    delivered_date: b.delivered_date,
    outcome: b.outcome,
    status: b.status,
    notes: b.notes,
  };
}

function mediaRow(m: AnimalMedia): Record<string, unknown> {
  return {
    id: m.id,
    animal_id: m.animal_id,
    storage_path: m.storage_path,
    media_type: m.media_type,
    caption: m.caption,
    created_at: m.created_at,
  };
}

async function upsertRows(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function deleteByIds(
  client: SupabaseClient,
  table: string,
  ids: (string | number)[],
  column = "id"
) {
  if (ids.length === 0) return;
  const { error } = await client.from(table).delete().in(column, ids);
  if (error) throw new Error(`${table} delete: ${error.message}`);
}

export async function applyWritePlan(plan: WritePlan): Promise<void> {
  const client = createServiceClient();

  if (plan.upsertContacts?.length) {
    await upsertRows(client, "contacts", plan.upsertContacts.map(contactRow));
  }

  // Children that reference transactions — delete first when replacing
  if (plan.replaceLedgerForTxIds?.length) {
    const { error } = await client
      .from("partner_ledger_entries")
      .delete()
      .in("transaction_id", plan.replaceLedgerForTxIds);
    if (error) throw new Error(`partner_ledger_entries delete: ${error.message}`);
  }
  if (plan.deleteLedgerIds?.length) {
    await deleteByIds(client, "partner_ledger_entries", plan.deleteLedgerIds);
  }
  if (plan.deletePalaiIds?.length) {
    await deleteByIds(client, "palai_payments", plan.deletePalaiIds);
  }
  if (plan.deleteSaleIds?.length) {
    await deleteByIds(client, "livestock_sales", plan.deleteSaleIds);
  }

  if (plan.deleteTransactionIds?.length) {
    await deleteByIds(client, "transactions", plan.deleteTransactionIds);
  }
  if (plan.deleteAnimalIds?.length) {
    await deleteByIds(client, "animals", plan.deleteAnimalIds);
  }

  if (plan.upsertAnimals?.length) {
    await upsertRows(client, "animals", plan.upsertAnimals.map(animalRow));
  }
  if (plan.upsertTransactions?.length) {
    await upsertRows(client, "transactions", plan.upsertTransactions.map(txRow));
  }
  if (plan.upsertLedger?.length) {
    await upsertRows(client, "partner_ledger_entries", plan.upsertLedger.map(ledgerRow));
  }
  if (plan.upsertPalai?.length) {
    await upsertRows(client, "palai_payments", plan.upsertPalai.map(palaiRow));
  }
  if (plan.upsertSales?.length) {
    await upsertRows(client, "livestock_sales", plan.upsertSales.map(saleRow));
  }
  if (plan.upsertMedical?.length) {
    await upsertRows(client, "medical_events", plan.upsertMedical.map(medicalRow));
  }
  if (plan.upsertBreeding?.length) {
    await upsertRows(client, "breeding_events", plan.upsertBreeding.map(breedingRow));
  }
  if (plan.upsertMedia?.length) {
    await upsertRows(client, "animal_media", plan.upsertMedia.map(mediaRow));
  }
  if (plan.upsertWeights?.length) {
    await upsertRows(
      client,
      "weight_logs",
      plan.upsertWeights.map((w) => ({
        id: w.id,
        animal_id: w.animal_id,
        weighed_on: w.weighed_on,
        weight_kg: w.weight_kg,
        notes: w.notes,
      }))
    );
  }
}

function byId<T extends { id: string | number }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [String(r.id), r]));
}

function changed<T extends { id: string | number }>(
  before: T[],
  after: T[],
  equal: (a: T, b: T) => boolean
): { upsert: T[]; deleteIds: string[] } {
  const bMap = byId(before);
  const aMap = byId(after);
  const upsert: T[] = [];
  for (const [id, row] of aMap) {
    const prev = bMap.get(id);
    if (!prev || !equal(prev, row)) upsert.push(row);
  }
  const deleteIds: string[] = [];
  for (const id of bMap.keys()) {
    if (!aMap.has(id)) deleteIds.push(id);
  }
  return { upsert, deleteIds };
}

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Diff two FarmDatabase snapshots into a minimal WritePlan. */
export function diffDb(before: FarmDatabase, after: FarmDatabase): WritePlan {
  const contacts = changed(before.contacts, after.contacts, jsonEq);
  const animals = changed(before.animals, after.animals, jsonEq);
  const txs = changed(before.transactions, after.transactions, jsonEq);
  const ledger = changed(before.partner_ledger_entries, after.partner_ledger_entries, jsonEq);
  const palai = changed(before.palai_payments, after.palai_payments, jsonEq);
  const sales = changed(before.livestock_sales ?? [], after.livestock_sales ?? [], jsonEq);
  const medical = changed(before.medical_events, after.medical_events, jsonEq);
  const breeding = changed(before.breeding_events, after.breeding_events, jsonEq);
  const media = changed(before.animal_media ?? [], after.animal_media ?? [], jsonEq);
  const weights = changed(before.weight_logs ?? [], after.weight_logs ?? [], jsonEq);

  // When ledger rows for a tx were replaced (delete+insert with new UUIDs),
  // also clear by transaction_id so orphans are gone even if we miss an id.
  const replaceLedgerForTxIds: string[] = [];
  for (const tx of txs.upsert) {
    const beforeLedger = before.partner_ledger_entries.filter((l) => l.transaction_id === tx.id);
    const afterLedger = after.partner_ledger_entries.filter((l) => l.transaction_id === tx.id);
    if (
      beforeLedger.length > 0 &&
      (beforeLedger.length !== afterLedger.length ||
        !beforeLedger.every((b) => afterLedger.some((a) => a.id === b.id && jsonEq(a, b))))
    ) {
      replaceLedgerForTxIds.push(tx.id);
    }
  }
  for (const txId of txs.deleteIds) {
    replaceLedgerForTxIds.push(txId);
  }

  return {
    upsertContacts: contacts.upsert,
    upsertAnimals: animals.upsert,
    deleteAnimalIds: animals.deleteIds.map(Number),
    upsertTransactions: txs.upsert,
    deleteTransactionIds: txs.deleteIds,
    upsertLedger: ledger.upsert,
    deleteLedgerIds: replaceLedgerForTxIds.length
      ? undefined
      : ledger.deleteIds,
    replaceLedgerForTxIds: replaceLedgerForTxIds.length ? replaceLedgerForTxIds : undefined,
    upsertPalai: palai.upsert,
    deletePalaiIds: palai.deleteIds,
    upsertSales: sales.upsert,
    deleteSaleIds: sales.deleteIds,
    upsertMedical: medical.upsert,
    upsertBreeding: breeding.upsert,
    upsertMedia: media.upsert,
    upsertWeights: weights.upsert,
  };
}

/**
 * Persist in-memory mutation result. On Supabase: only changed rows.
 * On JSON: full file write.
 */
export async function persistMutation(
  before: FarmDatabase,
  after: FarmDatabase
): Promise<FarmDatabase> {
  if (!isSupabaseDb()) {
    return persistDb(after);
  }
  const plan = diffDb(before, after);
  await applyWritePlan(plan);
  return after;
}

/** Insert a new cost/adjustment tx + its ledger rows (no full DB load required after build). */
export async function insertTransactionWithLedger(
  tx: Transaction,
  ledger: PartnerLedgerEntry[],
  extras?: {
    contacts?: Contact[];
    animals?: Animal[];
    palai?: PalaiPayment[];
    sales?: LivestockSale[];
    medical?: MedicalEvent[];
    breeding?: BreedingEvent[];
    media?: AnimalMedia[];
  }
): Promise<void> {
  if (!isSupabaseDb()) {
    // Caller should use persistMutation for JSON mode with full db
    throw new Error("insertTransactionWithLedger requires Supabase; use persistMutation for JSON");
  }
  await applyWritePlan({
    upsertContacts: extras?.contacts,
    upsertAnimals: extras?.animals,
    upsertTransactions: [tx],
    upsertLedger: ledger,
    upsertPalai: extras?.palai,
    upsertSales: extras?.sales,
    upsertMedical: extras?.medical,
    upsertBreeding: extras?.breeding,
    upsertMedia: extras?.media,
  });
}
