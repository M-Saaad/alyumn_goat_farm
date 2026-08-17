/**
 * Close active breeding records for dams that already have farm-born kids logged.
 * Safe to re-run — skips breeding records no longer in the pipeline.
 */
import { fetchDb, isSupabaseDb } from "../lib/db";
import { breedingUpdatesFromBirths } from "../lib/livestock/breeding";
import { applyWritePlan } from "../lib/db/writes";
import { loadDb, saveDb } from "../lib/db";

async function main() {
  const db = isSupabaseDb() ? await fetchDb() : loadDb();
  const updates = breedingUpdatesFromBirths(db.animals, db.breeding_events);

  if (updates.length === 0) {
    console.log("No active breeding records to update from existing births.");
    return;
  }

  console.log(`Updating ${updates.length} breeding record(s):`);
  for (const b of updates) {
    const dam = db.animals.find((a) => a.id === b.female_animal_id);
    console.log(
      `  ${dam?.name || `Goat #${b.female_animal_id}`} · ${b.buck_name || "unknown buck"} → Delivered ${b.delivered_date}`
    );
  }

  if (isSupabaseDb()) {
    await applyWritePlan({ upsertBreeding: updates });
  } else {
    const after = {
      ...db,
      breeding_events: db.breeding_events.map(
        (b) => updates.find((u) => u.id === b.id) ?? b
      ),
    };
    saveDb(after);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
