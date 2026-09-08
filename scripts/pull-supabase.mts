/**
 * Pull live farm data from Supabase into data/farm.db.json.
 *
 * Usage: npx tsx --env-file=.env.local scripts/pull-supabase.mts
 */
import fs from "fs";
import path from "path";
import { createServiceClient } from "../lib/supabase/admin.ts";
import { loadFromSupabase } from "../lib/db/supabase.ts";
import { computeSettlement } from "../lib/partner-equity/settlement.ts";
import type { FarmDatabase } from "../lib/types.ts";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "data", "farm.db.json");

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env.local)");
    process.exit(1);
  }

  const client = createServiceClient();
  console.log("Loading from Supabase…");
  const db = await loadFromSupabase(client);

  const settlement = computeSettlement(db);
  console.log("Settlement:", {
    monisDiff: Math.round(settlement.monisDiff),
    saadDiff: Math.round(settlement.saadDiff),
    owedTo: settlement.owedTo,
    amountOwed: Math.round(settlement.amountOwed),
  });

  const out: FarmDatabase = {
    contacts: db.contacts,
    animals: db.animals,
    transactions: db.transactions,
    partner_ledger_entries: db.partner_ledger_entries,
    palai_payments: db.palai_payments,
    livestock_sales: db.livestock_sales ?? [],
    purchase_agreements: db.purchase_agreements ?? [],
    medical_events: db.medical_events,
    breeding_events: db.breeding_events,
    weight_logs: db.weight_logs ?? [],
    animal_media: db.animal_media ?? [],
    meta: db.meta,
  };

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(out, null, 2));

  console.log("Wrote", DB_PATH);
  console.log({
    contacts: out.contacts.length,
    animals: out.animals.length,
    transactions: out.transactions.length,
    breeding_events: out.breeding_events.length,
    medical_events: out.medical_events.length,
    animal_media: out.animal_media.length,
  });
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
