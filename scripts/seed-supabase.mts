/**
 * Seed Supabase from data/farm.db.json.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-supabase.mts
 */
import fs from "fs";
import path from "path";
import { createServiceClient } from "../lib/supabase/admin";
import { saveToSupabase, loadFromSupabase } from "../lib/db/supabase";
import { assertCanonicalSettlement } from "../lib/partner-equity/settlement";
import type { FarmDatabase } from "../lib/types";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "farm.db.json");

async function clearTables(client: ReturnType<typeof createServiceClient>) {
  const ordered = [
    "animal_media",
    "livestock_sales",
    "partner_ledger_entries",
    "purchase_agreements",
    "palai_payments",
    "medical_events",
    "breeding_events",
    "weight_logs",
    "transactions",
    "animals",
    "contacts",
  ] as const;

  for (const table of ordered) {
    if (table === "animals") {
      const { error } = await client.from("animals").delete().gte("id", 0);
      if (error) throw new Error(`clear animals: ${error.message}`);
      continue;
    }
    const { error } = await client.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`clear ${table}: ${error.message}`);
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env.local)");
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error("Missing", DB_PATH, "— run npm run import first");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as FarmDatabase;
  if (!raw.animal_media) raw.animal_media = [];
  if (!raw.livestock_sales) raw.livestock_sales = [];

  const localSettlement = assertCanonicalSettlement(raw);
  console.log(
    "Local JSON settlement OK:",
    Math.round(localSettlement.monisDiff),
    Math.round(localSettlement.saadDiff)
  );

  const client = createServiceClient();
  console.log("Clearing existing Supabase rows…");
  await clearTables(client);

  console.log("Upserting farm.db.json…");
  await saveToSupabase(client, raw);

  console.log("Reloading from Supabase and verifying settlement…");
  const remote = await loadFromSupabase(client);
  const remoteSettlement = assertCanonicalSettlement(remote);
  console.log(
    "PASS Supabase settlement:",
    Math.round(remoteSettlement.monisDiff),
    Math.round(remoteSettlement.saadDiff)
  );
  console.log({
    contacts: remote.contacts.length,
    animals: remote.animals.length,
    transactions: remote.transactions.length,
    livestockSales: remote.livestock_sales.length,
    palai: remote.palai_payments.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
