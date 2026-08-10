/**
 * Mark all goat purchases as fully paid (settled purchase_agreements).
 * Does NOT create ledger transactions — historical purchases are already in the sheet import.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-purchase-settled.mts
 *   npx tsx --env-file=.env.local scripts/backfill-purchase-settled.mts --dry-run
 */
import { createServiceClient } from "../lib/supabase/admin";
import { loadFromSupabase } from "../lib/db/supabase";
import { agreementStatus } from "../lib/livestock/purchase-agreement";
import type { PurchaseAgreement } from "../lib/types";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env.local)");
    process.exit(1);
  }

  const client = createServiceClient();
  const db = await loadFromSupabase(client);
  const byAnimal = new Map((db.purchase_agreements ?? []).map((a) => [a.animal_id, a]));

  const upserts: PurchaseAgreement[] = [];
  let created = 0;
  let updated = 0;

  for (const animal of db.animals) {
    if (animal.price <= 0) continue;

    const existing = byAnimal.get(animal.id);
    const settled: PurchaseAgreement = existing
      ? {
          ...existing,
          vendor_id: animal.purchased_from ?? existing.vendor_id,
          total_amount: animal.price,
          amount_paid: animal.price,
          status: agreementStatus(animal.price, animal.price),
          notes: existing.notes ?? "Paid in full on purchase date",
        }
      : {
          id: crypto.randomUUID(),
          animal_id: animal.id,
          vendor_id: animal.purchased_from,
          total_amount: animal.price,
          amount_paid: animal.price,
          status: "settled",
          notes: "Paid in full on purchase date",
        };

    if (!existing) created++;
    else if (existing.status !== "settled" || existing.amount_paid < animal.price - 0.005) updated++;
    upserts.push(settled);
  }

  console.log({
    dryRun,
    animalsWithPrice: upserts.length,
    created,
    updated,
    alreadySettled: upserts.length - created - updated,
  });

  if (dryRun) {
    const openBefore = (db.purchase_agreements ?? []).filter((a) => a.status === "open").length;
    console.log("Would clear open agreements:", openBefore, "→ 0");
    return;
  }

  const rows = upserts.map((p) => {
    const animal = db.animals.find((a) => a.id === p.animal_id);
    const createdAt = animal?.date_of_purchase
      ? `${animal.date_of_purchase}T12:00:00.000Z`
      : undefined;
    return {
      id: p.id,
      animal_id: p.animal_id,
      vendor_id: p.vendor_id,
      total_amount: p.total_amount,
      amount_paid: p.amount_paid,
      status: p.status,
      notes: p.notes,
      ...(createdAt ? { created_at: createdAt } : {}),
    };
  });

  const { error } = await client.from("purchase_agreements").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`upsert purchase_agreements: ${error.message}`);

  const after = await loadFromSupabase(client);
  const stillOpen = (after.purchase_agreements ?? []).filter((a) => a.status === "open");
  const legacyOutstanding = after.animals.filter((animal) => {
    const agreement = after.purchase_agreements?.find((a) => a.animal_id === animal.id);
    if (agreement) return agreement.total_amount - agreement.amount_paid > 0.005;
    const paid = after.transactions
      .filter(
        (t) =>
          t.kind === "cost" &&
          t.category === "Livestock Purchase" &&
          t.animal_id === animal.id
      )
      .reduce((sum, t) => sum + t.amount, 0);
    return animal.price - paid > 0.005;
  });

  console.log("PASS purchase_agreements upserted:", rows.length);
  console.log("Open agreements remaining:", stillOpen.length);
  console.log("Goats with outstanding purchase balance:", legacyOutstanding.length);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
