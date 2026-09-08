/**
 * Fetch current Supabase state (tables, counts, settlement, herd health).
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/fetch-supabase-status.mts
 */
import { createServiceClient } from "../lib/supabase/admin.ts";
import { loadFromSupabase, selectAll } from "../lib/db/supabase.ts";
import { assertCanonicalSettlement, computeSettlement } from "../lib/partner-equity/settlement.ts";
import { computeHerdHealth } from "../lib/livestock/herd-health.ts";

const TABLES = [
  "contacts",
  "animals",
  "transactions",
  "partner_ledger_entries",
  "palai_payments",
  "purchase_agreements",
  "livestock_sales",
  "medical_events",
  "breeding_events",
  "weight_logs",
  "animal_media",
  "app_meta",
] as const;

async function tableStatus(client: ReturnType<typeof createServiceClient>, table: string) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, ok: false, error: error.message };
  return { table, ok: true, count: count ?? 0 };
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "unknown";

  console.log("=== Supabase project ===");
  console.log("URL:", url);
  console.log("Project ref:", projectRef);

  const client = createServiceClient();

  console.log("\n=== Table status ===");
  const statuses = await Promise.all(TABLES.map((t) => tableStatus(client, t)));
  for (const s of statuses) {
    if (s.ok) console.log(`  ${s.table}: ${s.count} rows`);
    else console.log(`  ${s.table}: ERROR — ${s.error}`);
  }

  const metaRows = await selectAll(client, "app_meta");
  const meta = metaRows[0];
  if (meta) {
    console.log("\n=== app_meta ===");
    console.log({
      imported_at: meta.imported_at,
      settlement_verified: meta.settlement_verified,
      monis_diff: meta.monis_diff,
      saad_diff: meta.saad_diff,
      updated_at: meta.updated_at,
    });
  }

  console.log("\n=== Loading full DB (settlement + health) ===");
  const db = await loadFromSupabase(client);
  const settlement = computeSettlement(db);
  console.log("Settlement (live):", {
    monisDiff: Math.round(settlement.monisDiff),
    saadDiff: Math.round(settlement.saadDiff),
    owedTo: settlement.owedTo,
    amountOwed: Math.round(settlement.amountOwed),
    costBase: Math.round(settlement.costBase),
    fairShare: Math.round(settlement.fairShare),
  });

  try {
    const canonical = assertCanonicalSettlement(db);
    console.log("Canonical check: PASS", Math.round(canonical.monisDiff), Math.round(canonical.saadDiff));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("Canonical check: DRIFT —", msg);
    console.log(
      "  (app_meta still shows import baseline ±192,247; live ledger has moved since import)"
    );
  }

  const herd = computeHerdHealth({
    animals: db.animals,
    medical_events: db.medical_events,
    breeding_events: db.breeding_events,
    weight_logs: db.weight_logs,
  });
  console.log("\n=== Herd health summary ===");
  console.log(herd.summary);
  console.log("Action items:", herd.actions.length);

  const active = db.animals.filter((a) => a.status === "Active");
  const allByStatus = db.animals.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n=== Livestock snapshot ===");
  console.log({
    totalAnimals: db.animals.length,
    active: active.length,
    byStatus: allByStatus,
    medicalEvents: db.medical_events.length,
    breedingEvents: db.breeding_events.length,
    weightLogs: db.weight_logs.length,
    transactions: db.transactions.length,
    purchaseAgreements: db.purchase_agreements?.length ?? 0,
    livestockSales: db.livestock_sales?.length ?? 0,
    animalMedia: db.animal_media?.length ?? 0,
  });

  if (db.purchase_agreements?.length) {
    console.log("\n=== Purchase agreements ===");
    for (const a of db.purchase_agreements) {
      const animal = db.animals.find((x) => x.id === a.animal_id);
      console.log({
        animalId: a.animal_id,
        label: animal?.name || animal?.description?.slice(0, 30) || `#${a.animal_id}`,
        total: a.total_amount,
        paid: a.amount_paid,
        balance: a.total_amount - a.amount_paid,
        status: a.status,
      });
    }
  }

  const recent = [...db.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  console.log("\n=== Recent transactions ===");
  for (const t of recent) {
    console.log(`  ${t.date} · ${t.category} · Rs ${t.amount}${t.notes ? ` — ${t.notes.slice(0, 50)}` : ""}`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
