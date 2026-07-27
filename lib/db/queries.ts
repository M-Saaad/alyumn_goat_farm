/**
 * Targeted page loaders — fetch only the tables each screen needs.
 * Falls back to full fetchDb() when Supabase is not configured (JSON mode).
 */
import { cache } from "react";
import type {
  Animal,
  AnimalMedia,
  BreedingEvent,
  Contact,
  FarmDatabase,
  LivestockSale,
  MedicalEvent,
  PalaiPayment,
  Transaction,
  WeightLog,
} from "../types";
import { emptyDb } from "../db-empty";
import { getCachedDb, isSupabaseDb } from "../db";
import { createServiceClient } from "../supabase/admin";
import {
  mapAnimal,
  mapBreeding,
  mapContact,
  mapMedia,
  mapMedical,
  mapMeta,
  mapPalai,
  mapSale,
  mapTx,
  mapWeight,
  selectAll,
} from "./supabase";
import { quickEntryPropsFromDb } from "../quick-entry-props";
import type { QuickEntryProps } from "@/components/QuickEntry";
import type { SupabaseClient } from "@supabase/supabase-js";

async function selectWhere(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string | number
) {
  const { data, error } = await client.from(table).select("*").eq(column, value);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function selectOne(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string | number
) {
  const { data, error } = await client.from(table).select("*").eq(column, value).maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? null) as Record<string, unknown> | null;
}

function filterLedgerTxs(rows: Record<string, unknown>[]): Transaction[] {
  return rows
    .map(mapTx)
    .filter((t) => t.kind === "cost" || t.kind === "partner_adjustment");
}

/** Shared QuickEntry props — active animals, contacts, buck names. */
export const getQuickEntryData = cache(async (): Promise<QuickEntryProps> => {
  if (!isSupabaseDb()) {
    return quickEntryPropsFromDb(await getCachedDb());
  }
  const client = createServiceClient();
  const [animals, contacts, breeding] = await Promise.all([
    selectAll(client, "animals"),
    selectAll(client, "contacts"),
    selectAll(client, "breeding_events"),
  ]);
  const db = emptyDb();
  db.animals = animals.map(mapAnimal);
  db.contacts = contacts.map(mapContact);
  db.breeding_events = breeding.map(mapBreeding);
  return quickEntryPropsFromDb(db);
});

export type HomeData = {
  contacts: Contact[];
  transactions: Transaction[];
  palai_payments: PalaiPayment[];
  meta: FarmDatabase["meta"];
  quickEntry: QuickEntryProps;
};

export const loadHomeData = cache(async (): Promise<HomeData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return {
      contacts: db.contacts,
      transactions: db.transactions,
      palai_payments: db.palai_payments,
      meta: db.meta,
      quickEntry: quickEntryPropsFromDb(db),
    };
  }

  const client = createServiceClient();
  const [contacts, transactions, palai, metaRows, quickEntry] = await Promise.all([
    selectAll(client, "contacts"),
    selectAll(client, "transactions"),
    selectAll(client, "palai_payments"),
    selectAll(client, "app_meta"),
    getQuickEntryData(),
  ]);

  return {
    contacts: contacts.map(mapContact),
    transactions: filterLedgerTxs(transactions),
    palai_payments: palai.map(mapPalai),
    meta: mapMeta(metaRows[0]),
    quickEntry,
  };
});

export type AnimalsListData = {
  animals: Animal[];
  contacts: Contact[];
  breeding_events: BreedingEvent[];
  quickEntry: QuickEntryProps;
};

export const loadAnimalsListData = cache(async (): Promise<AnimalsListData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return {
      animals: db.animals,
      contacts: db.contacts,
      breeding_events: db.breeding_events,
      quickEntry: quickEntryPropsFromDb(db),
    };
  }

  const client = createServiceClient();
  const [animals, contacts, breeding] = await Promise.all([
    selectAll(client, "animals"),
    selectAll(client, "contacts"),
    selectAll(client, "breeding_events"),
  ]);

  const mappedAnimals = animals.map(mapAnimal);
  const mappedContacts = contacts.map(mapContact);
  const mappedBreeding = breeding.map(mapBreeding);
  const db = emptyDb();
  db.animals = mappedAnimals;
  db.contacts = mappedContacts;
  db.breeding_events = mappedBreeding;

  return {
    animals: mappedAnimals,
    contacts: mappedContacts,
    breeding_events: mappedBreeding,
    quickEntry: quickEntryPropsFromDb(db),
  };
});

export type AnimalProfileData = {
  animal: Animal;
  contacts: Contact[];
  medical_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  transactions: Transaction[];
  livestock_sales: LivestockSale[];
  weight_logs: WeightLog[];
  animal_media: AnimalMedia[];
  quickEntry: QuickEntryProps;
};

export const loadAnimalProfileData = cache(
  async (animalId: number): Promise<AnimalProfileData | null> => {
    if (!isSupabaseDb()) {
      const db = await getCachedDb();
      const animal = db.animals.find((a) => a.id === animalId);
      if (!animal) return null;
      const saleMeta = (db.livestock_sales ?? []).filter((s) => s.animal_ids.includes(animalId));
      const saleTxIds = new Set(saleMeta.map((s) => s.transaction_id));
      return {
        animal,
        contacts: db.contacts,
        medical_events: db.medical_events.filter((m) => m.animal_id === animalId),
        breeding_events: db.breeding_events.filter((b) => b.female_animal_id === animalId),
        transactions: db.transactions.filter(
          (t) => t.animal_id === animalId || saleTxIds.has(t.id)
        ),
        livestock_sales: saleMeta,
        weight_logs: db.weight_logs.filter((w) => w.animal_id === animalId),
        animal_media: (db.animal_media ?? []).filter((m) => m.animal_id === animalId),
        quickEntry: quickEntryPropsFromDb(db),
      };
    }

    const client = createServiceClient();
    const [animalRow, contacts, medical, breeding, sales, weights, media, quickEntry] =
      await Promise.all([
        selectOne(client, "animals", "id", animalId),
        selectAll(client, "contacts"),
        selectWhere(client, "medical_events", "animal_id", animalId),
        selectWhere(client, "breeding_events", "female_animal_id", animalId),
        selectAll(client, "livestock_sales"),
        selectWhere(client, "weight_logs", "animal_id", animalId),
        selectWhere(client, "animal_media", "animal_id", animalId),
        getQuickEntryData(),
      ]);

    if (!animalRow) return null;

    const mappedSales = sales.map(mapSale).filter((s) => s.animal_ids.includes(animalId));
    const saleTxIds = mappedSales.map((s) => s.transaction_id);

    const { data: animalTxRows, error: animalTxErr } = await client
      .from("transactions")
      .select("*")
      .eq("animal_id", animalId);
    if (animalTxErr) throw new Error(`transactions: ${animalTxErr.message}`);

    let saleTxRows: Record<string, unknown>[] = [];
    if (saleTxIds.length > 0) {
      const { data, error } = await client.from("transactions").select("*").in("id", saleTxIds);
      if (error) throw new Error(`transactions: ${error.message}`);
      saleTxRows = (data ?? []) as Record<string, unknown>[];
    }

    const txById = new Map<string, Transaction>();
    for (const row of [...(animalTxRows ?? []), ...saleTxRows]) {
      const tx = mapTx(row as Record<string, unknown>);
      if (tx.kind === "cost" || tx.kind === "partner_adjustment") {
        txById.set(tx.id, tx);
      }
    }

    return {
      animal: mapAnimal(animalRow),
      contacts: contacts.map(mapContact),
      medical_events: medical.map(mapMedical),
      breeding_events: breeding.map(mapBreeding),
      transactions: [...txById.values()],
      livestock_sales: mappedSales,
      weight_logs: weights.map(mapWeight),
      animal_media: media.map(mapMedia),
      quickEntry,
    };
  }
);

export type TransactionsData = {
  transactions: Transaction[];
  contacts: Contact[];
  animals: Animal[];
  palai_payments: PalaiPayment[];
  livestock_sales: LivestockSale[];
  quickEntry: QuickEntryProps;
};

export const loadTransactionsData = cache(async (): Promise<TransactionsData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return {
      transactions: db.transactions,
      contacts: db.contacts,
      animals: db.animals,
      palai_payments: db.palai_payments,
      livestock_sales: db.livestock_sales,
      quickEntry: quickEntryPropsFromDb(db),
    };
  }

  const client = createServiceClient();
  const [transactions, contacts, animals, palai, sales, breeding] = await Promise.all([
    selectAll(client, "transactions"),
    selectAll(client, "contacts"),
    selectAll(client, "animals"),
    selectAll(client, "palai_payments"),
    selectAll(client, "livestock_sales"),
    selectAll(client, "breeding_events"),
  ]);

  const mappedAnimals = animals.map(mapAnimal);
  const mappedContacts = contacts.map(mapContact);
  const db = emptyDb();
  db.animals = mappedAnimals;
  db.contacts = mappedContacts;
  db.breeding_events = breeding.map(mapBreeding);

  return {
    transactions: filterLedgerTxs(transactions),
    contacts: mappedContacts,
    animals: mappedAnimals,
    palai_payments: palai.map(mapPalai),
    livestock_sales: sales.map(mapSale),
    quickEntry: quickEntryPropsFromDb(db),
  };
});

/** Helper for pages that only need contact name lookup from a contacts list. */
export function contactNameFrom(
  contacts: Contact[],
  id: string | null | undefined
): string {
  if (!id) return "—";
  return contacts.find((c) => c.id === id)?.name ?? "—";
}
