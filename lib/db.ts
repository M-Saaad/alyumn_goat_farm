import { cache } from "react";
import fs from "fs";
import path from "path";
import type { FarmDatabase } from "./types";
import { emptyDb } from "./db-empty";
import { loadFromSupabase, saveToSupabase } from "./db/supabase";
import { createServiceClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/env";

export { emptyDb };

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "farm.db.json");

export function isSupabaseDb(): boolean {
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function loadJsonDb(): FarmDatabase {
  if (!fs.existsSync(DB_PATH)) return emptyDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as FarmDatabase;
  if (!db.livestock_sales) db.livestock_sales = [];
  if (!db.purchase_agreements) db.purchase_agreements = [];
  if (!db.animal_media) db.animal_media = [];
  if (!db.weight_logs) db.weight_logs = [];
  if (!db.medical_events) db.medical_events = [];
  if (!db.breeding_events) db.breeding_events = [];
  for (const event of db.breeding_events) {
    if (event.fetus_count === undefined) event.fetus_count = null;
  }
  for (const p of db.palai_payments ?? []) {
    if (!p.service_month) p.service_month = p.date.slice(0, 7);
  }
  return db;
}

function saveJsonDb(db: FarmDatabase): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/** Sync JSON load — used by local verify scripts when Supabase is not configured. */
export function loadDb(): FarmDatabase {
  if (isSupabaseDb()) {
    throw new Error("loadDb() is sync-only for JSON. Use await fetchDb() when Supabase is enabled.");
  }
  return loadJsonDb();
}

/** Sync JSON save — used by local verify scripts when Supabase is not configured. */
export function saveDb(db: FarmDatabase): void {
  if (isSupabaseDb()) {
    throw new Error("saveDb() is sync-only for JSON. Use await persistDb() when Supabase is enabled.");
  }
  saveJsonDb(db);
}

async function fetchDbUncached(): Promise<FarmDatabase> {
  if (isSupabaseDb()) {
    const client = createServiceClient();
    return loadFromSupabase(client);
  }
  return loadJsonDb();
}

/**
 * Always-fresh DB load — use in mutations and scripts.
 * Page loaders should prefer targeted queries in lib/db/queries.ts.
 */
export async function fetchDb(): Promise<FarmDatabase> {
  return fetchDbUncached();
}

/** Dedupes multiple reads within a single React server render (pages only). */
export const getCachedDb = cache(fetchDbUncached);

export async function persistDb(db: FarmDatabase): Promise<FarmDatabase> {
  if (isSupabaseDb()) {
    const client = createServiceClient();
    await saveToSupabase(client, db);
    return db;
  }
  saveJsonDb(db);
  return db;
}

export function dbPath(): string {
  return DB_PATH;
}
