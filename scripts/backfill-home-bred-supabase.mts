/**
 * Mark farm-born goats in Supabase (home_bred = true).
 * Does NOT wipe or re-seed — only updates matching animal rows.
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill-home-bred-supabase.mts
 */
import { createServiceClient } from "../lib/supabase/admin";
import { mapAnimal } from "../lib/db/supabase";

const BORN_ANIMAL_IDS = [8, 12, 13, 14, 23, 32, 36, 38, 39, 40, 41, 44, 45];

function isFarmBorn(row: {
  id: number;
  price: number;
  purchased_from: string | null;
  home_bred: boolean;
}) {
  return (
    BORN_ANIMAL_IDS.includes(row.id) ||
    (row.price === 0 && !row.purchased_from)
  );
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env.local)");
    process.exit(1);
  }

  const client = createServiceClient();
  const { data, error } = await client.from("animals").select("id,name,price,purchased_from,home_bred,description");
  if (error) throw new Error(error.message);

  const animals = (data ?? []).map((r) => mapAnimal(r as Record<string, unknown>));
  const targets = animals.filter((a) => isFarmBorn(a) && !a.home_bred);

  if (targets.length === 0) {
    const already = animals.filter((a) => a.home_bred).length;
    console.log(`Nothing to update — ${already} animal(s) already marked home_bred.`);
    return;
  }

  console.log(`Updating ${targets.length} farm-born goat(s):`);
  for (const a of targets) {
    console.log(`  #${a.id} ${a.name || "(unnamed)"} — ${(a.description || "").slice(0, 50)}`);
  }

  const ids = targets.map((a) => a.id);
  const { error: updateError } = await client
    .from("animals")
    .update({ home_bred: true, price: 0, purchased_from: null })
    .in("id", ids);

  if (updateError) throw new Error(updateError.message);

  const { data: after, error: verifyError } = await client
    .from("animals")
    .select("id,home_bred")
    .in("id", ids);
  if (verifyError) throw new Error(verifyError.message);

  const failed = (after ?? []).filter((r) => !r.home_bred);
  if (failed.length) {
    throw new Error(`Verification failed for ids: ${failed.map((r) => r.id).join(", ")}`);
  }

  console.log("Done — all targets now have home_bred = true.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
