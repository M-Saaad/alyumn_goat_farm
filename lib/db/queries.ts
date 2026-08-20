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
  PurchaseAgreement,
  Transaction,
  WeightLog,
} from "../types";
import { emptyDb } from "../db-empty";
import { getCachedDb, isSupabaseDb } from "../db";
import { createServiceClient } from "../supabase/admin";
import {
  mapBreeding,
  mapContact,
  mapMedia,
  mapMedical,
  mapMeta,
  mapPalai,
  mapPurchaseAgreement,
  mapSale,
  mapAnimal,
  mapTx,
  mapWeight,
  selectAll,
  selectAllOptional,
} from "./supabase";
import { getPartnerIds } from "../partner-equity/settlement";
import { quickEntryPropsFromDb } from "../quick-entry-props";
import { mapAnimalsWithParents } from "../livestock/animal-parents-store";
import { computeHerdHealth, type HerdHealthData } from "../livestock/herd-health";
import { mergeVaccineSchedules, type VaccineScheduleEntry } from "../livestock/vaccine-schedule";
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

/** Resolve Monis/Saad partner IDs without loading the full database. */
export async function loadPartnerIds(): Promise<{ monisId: string; saadId: string }> {
  if (!isSupabaseDb()) {
    return getPartnerIds(await getCachedDb());
  }
  const client = createServiceClient();
  const contacts = await selectAll(client, "contacts");
  return getPartnerIds({ contacts: contacts.map(mapContact) } as FarmDatabase);
}

/** Shared QuickEntry props — active animals, contacts, buck names. */
export const getQuickEntryData = cache(async (): Promise<QuickEntryProps> => {
  if (!isSupabaseDb()) {
    return quickEntryPropsFromDb(await getCachedDb());
  }
  const client = createServiceClient();
  const [animals, contacts, breeding, palai, transactions] = await Promise.all([
    selectAll(client, "animals"),
    selectAll(client, "contacts"),
    selectAll(client, "breeding_events"),
    selectAll(client, "palai_payments"),
    selectAll(client, "transactions"),
  ]);
  const db = emptyDb();
  db.animals = await mapAnimalsWithParents(client, animals);
  db.contacts = contacts.map(mapContact);
  db.breeding_events = breeding.map(mapBreeding);
  db.palai_payments = palai.map(mapPalai);
  db.transactions = filterLedgerTxs(transactions);
  return quickEntryPropsFromDb(db);
});

export type HomeData = {
  contacts: Contact[];
  transactions: Transaction[];
  palai_payments: PalaiPayment[];
  animals: Animal[];
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
      animals: db.animals,
      meta: db.meta,
      quickEntry: quickEntryPropsFromDb(db),
    };
  }

  const client = createServiceClient();
  const [contacts, transactions, palai, metaRows, animalRows, quickEntry] = await Promise.all([
    selectAll(client, "contacts"),
    selectAll(client, "transactions"),
    selectAll(client, "palai_payments"),
    selectAll(client, "app_meta"),
    selectAll(client, "animals"),
    getQuickEntryData(),
  ]);

  return {
    contacts: contacts.map(mapContact),
    transactions: filterLedgerTxs(transactions),
    palai_payments: palai.map(mapPalai),
    animals: animalRows.map(mapAnimal),
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

  const mappedAnimals = await mapAnimalsWithParents(client, animals);
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
  animals: Animal[];
  contacts: Contact[];
  medical_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  transactions: Transaction[];
  livestock_sales: LivestockSale[];
  purchase_agreement: PurchaseAgreement | null;
  purchase_balance: number;
  sale_balance: number | null;
  weight_logs: WeightLog[];
  animal_media: AnimalMedia[];
  quickEntry: QuickEntryProps;
};

function profileTransactions(
  db: FarmDatabase,
  animalId: number,
  sales: LivestockSale[]
): Transaction[] {
  const saleIds = new Set(sales.map((s) => s.id));
  const legacyTxIds = new Set(
    sales.map((s) => s.transaction_id).filter((id): id is string => Boolean(id))
  );
  return db.transactions.filter(
    (t) =>
      t.animal_id === animalId ||
      legacyTxIds.has(t.id) ||
      (t.livestock_sale_id != null && saleIds.has(t.livestock_sale_id)) ||
      (t.purchase_agreement_id != null &&
        db.purchase_agreements?.some(
          (a) => a.id === t.purchase_agreement_id && a.animal_id === animalId
        ))
  );
}

function resolvePurchaseAgreement(
  db: FarmDatabase,
  animal: Animal
): { agreement: PurchaseAgreement | null; balance: number } {
  const agreement = db.purchase_agreements?.find((a) => a.animal_id === animal.id) ?? null;
  if (agreement) {
    return {
      agreement,
      balance: Math.max(0, agreement.total_amount - agreement.amount_paid),
    };
  }
  const paid = db.transactions
    .filter(
      (t) =>
        t.kind === "cost" &&
        t.category === "Livestock Purchase" &&
        t.animal_id === animal.id
    )
    .reduce((sum, t) => sum + t.amount, 0);
  if (animal.price <= 0) return { agreement: null, balance: 0 };
  return { agreement: null, balance: Math.max(0, animal.price - paid) };
}

export const loadAnimalProfileData = cache(
  async (animalId: number): Promise<AnimalProfileData | null> => {
    if (!isSupabaseDb()) {
      const db = await getCachedDb();
      const animal = db.animals.find((a) => a.id === animalId);
      if (!animal) return null;
      const saleMeta = (db.livestock_sales ?? []).filter((s) => s.animal_ids.includes(animalId));
      const purchase = resolvePurchaseAgreement(db, animal);
      const sale = saleMeta[0];
      return {
        animal,
        animals: db.animals,
        contacts: db.contacts,
        medical_events: db.medical_events.filter((m) => m.animal_id === animalId),
        breeding_events: db.breeding_events.filter((b) => b.female_animal_id === animalId),
        transactions: profileTransactions(db, animalId, saleMeta),
        livestock_sales: saleMeta,
        purchase_agreement: purchase.agreement,
        purchase_balance: purchase.balance,
        sale_balance: sale ? Math.max(0, sale.net_received - sale.amount_received) : null,
        weight_logs: db.weight_logs.filter((w) => w.animal_id === animalId),
        animal_media: (db.animal_media ?? []).filter((m) => m.animal_id === animalId),
        quickEntry: quickEntryPropsFromDb(db),
      };
    }

    const client = createServiceClient();
    const [animalRow, contacts, allAnimals, medical, breeding, sales, purchaseRows, weights, media, quickEntry] =
      await Promise.all([
        selectOne(client, "animals", "id", animalId),
        selectAll(client, "contacts"),
        selectAll(client, "animals"),
        selectWhere(client, "medical_events", "animal_id", animalId),
        selectWhere(client, "breeding_events", "female_animal_id", animalId),
        selectAll(client, "livestock_sales"),
        selectWhere(client, "purchase_agreements", "animal_id", animalId),
        selectWhere(client, "weight_logs", "animal_id", animalId),
        selectWhere(client, "animal_media", "animal_id", animalId),
        getQuickEntryData(),
      ]);

    if (!animalRow) return null;

    const mappedSales = sales.map(mapSale).filter((s) => s.animal_ids.includes(animalId));
    const mappedAgreements = purchaseRows.map(mapPurchaseAgreement);
    const saleIds = mappedSales.map((s) => s.id);
    const agreementIds = mappedAgreements.map((a) => a.id);
    const legacySaleTxIds = mappedSales
      .map((s) => s.transaction_id)
      .filter((id): id is string => Boolean(id));

    const { data: animalTxRows, error: animalTxErr } = await client
      .from("transactions")
      .select("*")
      .eq("animal_id", animalId);
    if (animalTxErr) throw new Error(`transactions: ${animalTxErr.message}`);

    const extraTxPromises: Promise<Record<string, unknown>[]>[] = [];
    if (legacySaleTxIds.length > 0) {
      extraTxPromises.push(
        (async () => {
          const { data, error } = await client
            .from("transactions")
            .select("*")
            .in("id", legacySaleTxIds);
          if (error) throw new Error(`transactions: ${error.message}`);
          return (data ?? []) as Record<string, unknown>[];
        })()
      );
    }
    if (saleIds.length > 0) {
      extraTxPromises.push(
        (async () => {
          const { data, error } = await client
            .from("transactions")
            .select("*")
            .in("livestock_sale_id", saleIds);
          if (error) throw new Error(`transactions: ${error.message}`);
          return (data ?? []) as Record<string, unknown>[];
        })()
      );
    }
    if (agreementIds.length > 0) {
      extraTxPromises.push(
        (async () => {
          const { data, error } = await client
            .from("transactions")
            .select("*")
            .in("purchase_agreement_id", agreementIds);
          if (error) throw new Error(`transactions: ${error.message}`);
          return (data ?? []) as Record<string, unknown>[];
        })()
      );
    }
    const extraTxRows = (await Promise.all(extraTxPromises)).flat();

    const txById = new Map<string, Transaction>();
    for (const row of [...(animalTxRows ?? []), ...extraTxRows]) {
      const tx = mapTx(row as Record<string, unknown>);
      if (tx.kind === "cost" || tx.kind === "partner_adjustment") {
        txById.set(tx.id, tx);
      }
    }

    const mappedAllAnimals = await mapAnimalsWithParents(client, allAnimals);
    const animal = mappedAllAnimals.find((a) => a.id === animalId);
    if (!animal) return null;
    const miniDb = emptyDb();
    miniDb.animals = [animal];
    miniDb.transactions = [...txById.values()];
    miniDb.purchase_agreements = mappedAgreements;
    miniDb.livestock_sales = mappedSales;
    const purchase = resolvePurchaseAgreement(miniDb, animal);
    const sale = mappedSales[0];

    return {
      animal,
      animals: mappedAllAnimals,
      contacts: contacts.map(mapContact),
      medical_events: medical.map(mapMedical),
      breeding_events: breeding.map(mapBreeding),
      transactions: profileTransactions(miniDb, animalId, mappedSales),
      livestock_sales: mappedSales,
      purchase_agreement: purchase.agreement,
      purchase_balance: purchase.balance,
      sale_balance: sale ? Math.max(0, sale.net_received - sale.amount_received) : null,
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

  const mappedAnimals = await mapAnimalsWithParents(client, animals);
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

export type HerdHealthPageData = {
  herd: HerdHealthData;
  quickEntry: QuickEntryProps;
  vaccineSchedules: VaccineScheduleEntry[];
  customVaccines: import("../types").CustomVaccine[];
};

export const loadHerdHealthData = cache(async (): Promise<HerdHealthPageData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    const customVaccines = db.custom_vaccines ?? [];
    return {
      herd: computeHerdHealth({
        animals: db.animals,
        medical_events: db.medical_events ?? [],
        breeding_events: db.breeding_events ?? [],
        weight_logs: db.weight_logs ?? [],
        custom_vaccines: customVaccines,
      }),
      quickEntry: quickEntryPropsFromDb(db),
      vaccineSchedules: mergeVaccineSchedules(customVaccines),
      customVaccines,
    };
  }

  const client = createServiceClient();
  const [animals, medical, breeding, weights, contacts, customVaccinesRows] = await Promise.all([
    selectAll(client, "animals"),
    selectAllOptional(client, "medical_events"),
    selectAllOptional(client, "breeding_events"),
    selectAllOptional(client, "weight_logs"),
    selectAll(client, "contacts"),
    selectAllOptional(client, "custom_vaccines"),
  ]);

  const mappedAnimals = await mapAnimalsWithParents(client, animals);
  const customVaccines = customVaccinesRows.map(
    (row) =>
      ({
        id: String(row.id),
        name: String(row.name),
        interval_days: Number(row.interval_days),
      }) satisfies import("../types").CustomVaccine
  );
  const db = emptyDb();
  db.animals = mappedAnimals;
  db.contacts = contacts.map(mapContact);
  db.breeding_events = breeding.map(mapBreeding);
  db.custom_vaccines = customVaccines;

  return {
    herd: computeHerdHealth({
      animals: mappedAnimals,
      medical_events: medical.map(mapMedical),
      breeding_events: breeding.map(mapBreeding),
      weight_logs: weights.map(mapWeight),
      custom_vaccines: customVaccines,
    }),
    quickEntry: quickEntryPropsFromDb(db),
    vaccineSchedules: mergeVaccineSchedules(customVaccines),
    customVaccines,
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
