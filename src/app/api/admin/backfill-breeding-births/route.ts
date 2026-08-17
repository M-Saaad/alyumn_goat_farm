import { NextResponse } from "next/server";
import { fetchDb, isSupabaseDb } from "@/lib/db";
import { applyWritePlan } from "@/lib/db/writes";
import { breedingUpdatesFromBirths } from "@/lib/livestock/breeding";
import { createClient } from "@/lib/supabase/server";
import { animalLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** One-time admin task: close open breeding records when farm-born kids exist. */
export async function POST() {
  if (!isSupabaseDb()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Login required" }, { status: 401 });
  }

  const db = await fetchDb();
  const updates = breedingUpdatesFromBirths(db.animals, db.breeding_events);

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, records: [] });
  }

  await applyWritePlan({ upsertBreeding: updates });

  return NextResponse.json({
    ok: true,
    updated: updates.length,
    records: updates.map((b) => {
      const dam = db.animals.find((a) => a.id === b.female_animal_id);
      return {
        dam: dam ? animalLabel(dam) : `Goat #${b.female_animal_id}`,
        buck: b.buck_name,
        deliveredDate: b.delivered_date,
      };
    }),
  });
}
