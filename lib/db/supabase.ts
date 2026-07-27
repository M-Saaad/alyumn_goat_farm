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
import { emptyDb } from "../db-empty";

export function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

export function mapContact(r: Record<string, unknown>): Contact {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as Contact["type"],
    phone: (r.phone as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export function mapAnimal(r: Record<string, unknown>): Animal {
  return {
    id: num(r.id),
    name: (r.name as string) ?? null,
    breed: (r.breed as Animal["breed"]) ?? null,
    sex: (r.sex as Animal["sex"]) ?? null,
    date_of_purchase: r.date_of_purchase ? String(r.date_of_purchase) : null,
    age_at_purchase: (r.age_at_purchase as string) ?? null,
    description: (r.description as string) ?? null,
    comment: (r.comment as string) ?? null,
    status: r.status as Animal["status"],
    price: num(r.price ?? 0),
    sold_price: r.sold_price == null ? null : num(r.sold_price),
    purchased_from: (r.purchased_from as string) ?? null,
    owner_id: (r.owner_id as string) ?? null,
    home_bred: Boolean(r.home_bred),
    out_date: r.out_date ? String(r.out_date) : null,
    palai_rate: r.palai_rate == null ? null : num(r.palai_rate),
  };
}

export function mapTx(r: Record<string, unknown>): Transaction {
  return {
    id: String(r.id),
    date: String(r.date),
    amount: num(r.amount),
    kind: r.kind as Transaction["kind"],
    category: r.category as Transaction["category"],
    farm_model: (r.farm_model as Transaction["farm_model"]) ?? null,
    animal_id: r.animal_id == null ? null : num(r.animal_id),
    customer_id: (r.customer_id as string) ?? null,
    vendor_id: (r.vendor_id as string) ?? null,
    paid_by_partner_id: (r.paid_by_partner_id as string) ?? null,
    received_by_partner_id: (r.received_by_partner_id as string) ?? null,
    adjustment_partner_id: (r.adjustment_partner_id as string) ?? null,
    notes: (r.notes as string) ?? null,
    source_row: r.source_row == null ? null : num(r.source_row),
  };
}

export function mapLedger(r: Record<string, unknown>): PartnerLedgerEntry {
  return {
    id: String(r.id),
    transaction_id: String(r.transaction_id),
    partner_id: String(r.partner_id),
    amount: num(r.amount),
    category: r.category as PartnerLedgerEntry["category"],
    created_at: String(r.created_at),
  };
}

export function mapPalai(r: Record<string, unknown>): PalaiPayment {
  return {
    id: String(r.id),
    date: String(r.date),
    customer_id: String(r.customer_id),
    rate_per_goat: r.rate_per_goat == null ? null : num(r.rate_per_goat),
    goat_count: r.goat_count == null ? null : num(r.goat_count),
    total_amount: num(r.total_amount),
    payment_method: (r.payment_method as string) ?? null,
    transaction_id: (r.transaction_id as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export function mapSale(r: Record<string, unknown>): LivestockSale {
  return {
    id: String(r.id),
    date: String(r.date),
    animal_ids: Array.isArray(r.animal_ids) ? r.animal_ids.map(num) : [],
    gross_sale_price: num(r.gross_sale_price),
    delivery_cost: num(r.delivery_cost ?? 0),
    net_received: num(r.net_received),
    partner_share: num(r.partner_share),
    received_by_partner_id: String(r.received_by_partner_id),
    transaction_id: String(r.transaction_id),
    notes: (r.notes as string) ?? null,
  };
}

export function mapMedical(r: Record<string, unknown>): MedicalEvent {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    event_type: r.event_type as MedicalEvent["event_type"],
    date: r.date ? String(r.date) : null,
    notes: (r.notes as string) ?? null,
    transaction_id: (r.transaction_id as string) ?? null,
  };
}

export function mapBreeding(r: Record<string, unknown>): BreedingEvent {
  return {
    id: String(r.id),
    female_animal_id: num(r.female_animal_id),
    male_animal_id: r.male_animal_id == null ? null : num(r.male_animal_id),
    buck_name: (r.buck_name as string) ?? null,
    date_crossed: r.date_crossed ? String(r.date_crossed) : null,
    expected_due_date: r.expected_due_date ? String(r.expected_due_date) : null,
    delivered_date: r.delivered_date ? String(r.delivered_date) : null,
    outcome: r.outcome as BreedingEvent["outcome"],
    status: (r.status as BreedingEvent["status"]) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export function mapWeight(r: Record<string, unknown>): WeightLog {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    weighed_on: String(r.weighed_on),
    weight_kg: num(r.weight_kg),
    notes: (r.notes as string) ?? null,
  };
}

export function mapMedia(r: Record<string, unknown>): AnimalMedia {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    storage_path: String(r.storage_path),
    media_type: r.media_type as AnimalMedia["media_type"],
    caption: (r.caption as string) ?? null,
    created_at: String(r.created_at),
  };
}

export async function selectAll(client: SupabaseClient, table: string) {
  const { data, error } = await client.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export function mapMeta(meta: Record<string, unknown> | undefined): FarmDatabase["meta"] {
  return {
    importedAt: meta?.imported_at ? String(meta.imported_at) : null,
    settlementVerified: Boolean(meta?.settlement_verified),
    monisDiff: meta?.monis_diff == null ? null : num(meta.monis_diff),
    saadDiff: meta?.saad_diff == null ? null : num(meta.saad_diff),
  };
}

export async function loadFromSupabase(client: SupabaseClient): Promise<FarmDatabase> {
  const [
    contacts,
    animals,
    transactions,
    ledger,
    palai,
    sales,
    medical,
    breeding,
    weights,
    media,
    metaRows,
  ] = await Promise.all([
    selectAll(client, "contacts"),
    selectAll(client, "animals"),
    selectAll(client, "transactions"),
    selectAll(client, "partner_ledger_entries"),
    selectAll(client, "palai_payments"),
    selectAll(client, "livestock_sales"),
    selectAll(client, "medical_events"),
    selectAll(client, "breeding_events"),
    selectAll(client, "weight_logs"),
    selectAll(client, "animal_media"),
    selectAll(client, "app_meta"),
  ]);

  const meta = metaRows[0];
  const db = emptyDb();
  db.contacts = contacts.map(mapContact);
  db.animals = animals.map(mapAnimal);
  db.transactions = transactions
    .map(mapTx)
    .filter((t) => t.kind === "cost" || t.kind === "partner_adjustment");
  db.partner_ledger_entries = ledger.map(mapLedger);
  db.palai_payments = palai.map(mapPalai);
  db.livestock_sales = sales.map(mapSale);
  db.medical_events = medical.map(mapMedical);
  db.breeding_events = breeding.map(mapBreeding);
  db.weight_logs = weights.map(mapWeight);
  db.animal_media = media.map(mapMedia);
  db.meta = mapMeta(meta);
  return db;
}

async function upsert(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id"
) {
  if (rows.length === 0) return;
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await client.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

/**
 * Delete rows that exist in Supabase but not in memory, then upsert current rows.
 * Without this, deletes never persist (upsert-only leaves orphan rows).
 */
async function syncTable(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  idColumn = "id"
) {
  const { data, error } = await client.from(table).select(idColumn);
  if (error) throw new Error(`${table} select ids: ${error.message}`);

  const keep = new Set(rows.map((r) => String(r[idColumn])));
  const orphanIds = (data as unknown as Array<Record<string, unknown>> | null ?? [])
    .map((r) => String(r[idColumn]))
    .filter((id) => !keep.has(id));

  if (orphanIds.length > 0) {
    const chunk = 500;
    for (let i = 0; i < orphanIds.length; i += chunk) {
      const slice = orphanIds.slice(i, i + chunk);
      const { error: delErr } = await client.from(table).delete().in(idColumn, slice);
      if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
    }
  }

  await upsert(client, table, rows, idColumn);
}

/** Persist FarmDatabase to Supabase (delete orphans, then upsert; preserves IDs). */
export async function saveToSupabase(client: SupabaseClient, db: FarmDatabase): Promise<void> {
  // Children before parents so FK constraints are respected when deleting.
  await syncTable(
    client,
    "partner_ledger_entries",
    db.partner_ledger_entries.map((l) => ({
      id: l.id,
      transaction_id: l.transaction_id,
      partner_id: l.partner_id,
      amount: l.amount,
      category: l.category,
      created_at: l.created_at,
    }))
  );

  await syncTable(
    client,
    "palai_payments",
    db.palai_payments.map((p) => ({
      id: p.id,
      date: p.date,
      customer_id: p.customer_id,
      rate_per_goat: p.rate_per_goat,
      goat_count: p.goat_count,
      total_amount: p.total_amount,
      payment_method: p.payment_method,
      transaction_id: p.transaction_id,
      notes: p.notes,
    }))
  );

  await syncTable(
    client,
    "livestock_sales",
    db.livestock_sales.map((s) => ({
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
    }))
  );

  await syncTable(
    client,
    "medical_events",
    db.medical_events.map((m) => ({
      id: m.id,
      animal_id: m.animal_id,
      event_type: m.event_type,
      date: m.date,
      notes: m.notes,
      transaction_id: m.transaction_id,
    }))
  );

  await syncTable(
    client,
    "breeding_events",
    db.breeding_events.map((b) => ({
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
    }))
  );

  await syncTable(
    client,
    "weight_logs",
    db.weight_logs.map((w) => ({
      id: w.id,
      animal_id: w.animal_id,
      weighed_on: w.weighed_on,
      weight_kg: w.weight_kg,
      notes: w.notes,
    }))
  );

  await syncTable(
    client,
    "animal_media",
    (db.animal_media ?? []).map((m) => ({
      id: m.id,
      animal_id: m.animal_id,
      storage_path: m.storage_path,
      media_type: m.media_type,
      caption: m.caption,
      created_at: m.created_at,
    }))
  );

  await syncTable(
    client,
    "transactions",
    db.transactions.map((t) => ({
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
    }))
  );

  await syncTable(
    client,
    "animals",
    db.animals.map((a) => ({
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
    }))
  );

  await syncTable(
    client,
    "contacts",
    db.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
    }))
  );

  const { error: metaErr } = await client.from("app_meta").upsert({
    id: 1,
    imported_at: db.meta.importedAt,
    settlement_verified: db.meta.settlementVerified,
    monis_diff: db.meta.monisDiff,
    saad_diff: db.meta.saadDiff,
    updated_at: new Date().toISOString(),
  });
  if (metaErr) throw new Error(`app_meta upsert: ${metaErr.message}`);
}
