import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseDb } from "@/lib/db";
import { agreementStatus } from "@/lib/livestock/purchase-agreement";

export const dynamic = "force-dynamic";

const MIGRATION_TOKEN = "backfill-purchase-settled-2026-08";

/**
 * One-time backfill: mark all goat purchases as fully paid.
 * POST /api/backfill-purchase-settled
 * Header: x-migration-token: backfill-purchase-settled-2026-08
 */
export async function POST(req: Request) {
  if (!isSupabaseDb()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const token = req.headers.get("x-migration-token");
  const expected = process.env.MIGRATION_TOKEN ?? MIGRATION_TOKEN;
  if (token !== expected) {
    return NextResponse.json({ error: "Invalid migration token" }, { status: 401 });
  }

  const client = createServiceClient();
  const { data: animals, error: animalsError } = await client
    .from("animals")
    .select("id,price,purchased_from,date_of_purchase,name,description");
  if (animalsError) {
    return NextResponse.json({ error: animalsError.message }, { status: 500 });
  }

  const { data: existingRows, error: agreementsError } = await client
    .from("purchase_agreements")
    .select("id,animal_id,total_amount,amount_paid,status,vendor_id,notes");
  if (agreementsError) {
    return NextResponse.json({ error: agreementsError.message }, { status: 500 });
  }

  const byAnimal = new Map((existingRows ?? []).map((a) => [a.animal_id, a]));
  const upserts: Array<Record<string, unknown>> = [];
  let created = 0;
  let updated = 0;

  for (const animal of animals ?? []) {
    const price = Number(animal.price);
    if (price <= 0) continue;

    const existing = byAnimal.get(animal.id);
    const settled = {
      id: existing?.id ?? crypto.randomUUID(),
      animal_id: animal.id,
      vendor_id: animal.purchased_from ?? existing?.vendor_id ?? null,
      total_amount: price,
      amount_paid: price,
      status: agreementStatus(price, price),
      notes: existing?.notes ?? "Paid in full on purchase date",
      ...(animal.date_of_purchase
        ? { created_at: `${animal.date_of_purchase}T12:00:00.000Z` }
        : {}),
    };

    if (!existing) created++;
    else if (existing.status !== "settled" || Number(existing.amount_paid) < price - 0.005) {
      updated++;
    }
    upserts.push(settled);
  }

  if (upserts.length === 0) {
    return NextResponse.json({ ok: true, upserted: 0, message: "No priced animals to update" });
  }

  const { error: upsertError } = await client
    .from("purchase_agreements")
    .upsert(upserts, { onConflict: "id" });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: afterRows, error: verifyError } = await client
    .from("purchase_agreements")
    .select("animal_id,status,total_amount,amount_paid");
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  const open = (afterRows ?? []).filter((r) => r.status === "open");
  const outstanding = (afterRows ?? []).filter(
    (r) => Number(r.total_amount) - Number(r.amount_paid) > 0.005
  );

  return NextResponse.json({
    ok: true,
    upserted: upserts.length,
    created,
    updated,
    openAgreements: open.length,
    outstandingBalances: outstanding.length,
  });
}
