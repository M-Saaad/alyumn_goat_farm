import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const BORN_ANIMAL_IDS = [8, 12, 13, 14, 23, 32, 36, 38, 39, 40, 41, 44, 45];
const MIGRATION_TOKEN = "backfill-home-bred-2026-08";

/**
 * One-time backfill for farm-born goats.
 * POST /api/backfill-home-bred
 * Header: x-migration-token: backfill-home-bred-2026-08
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

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("animals")
    .select("id,name,price,purchased_from,home_bred,description");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (data ?? []).filter(
    (a) => BORN_ANIMAL_IDS.includes(a.id) && !a.home_bred
  );

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: "Already up to date" });
  }

  const ids = targets.map((a) => a.id);
  const { error: updateError } = await admin
    .from("animals")
    .update({ home_bred: true, price: 0, purchased_from: null })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updated: ids.length,
    ids,
    labels: targets.map((a) => `#${a.id} ${a.name || a.description?.slice(0, 40) || "goat"}`),
  });
}
