/**
 * Breeding flow smoke test — run with:
 * node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/review-breeding.mts
 */
import { loadHerdHealthData, loadAnimalProfileData } from "../lib/db/queries.ts";
import { animalLinkFromHealth, backFromAnimalProfile } from "../lib/livestock/health-nav.ts";
import { parseHealthTab } from "../lib/livestock/health-tabs.ts";
import { isBreedingInPipeline } from "../lib/livestock/breeding.ts";

async function main() {
  let failed = 0;

  function ok(msg: string) {
    console.log("OK", msg);
  }
  function fail(msg: string, err?: unknown) {
    failed++;
    console.error("FAIL", msg, err instanceof Error ? err.message : err ?? "");
  }

  const tab = parseHealthTab("breeding");
  if (tab !== "breeding") fail("parseHealthTab breeding");

  const back = backFromAnimalProfile({ from: "health", tab: "breeding" });
  if (back.href !== "/health?tab=breeding" || back.label !== "Breeding") {
    fail("backFromAnimalProfile breeding", back);
  } else ok("back link");

  const data = await loadHerdHealthData();
  ok(`herd health loaded (${data.herd.breeding.length} breeding rows)`);

  if (data.herd.breeding.length === 0) {
    fail("expected breeding records in database");
  }

  for (const row of data.herd.breeding) {
    const href = animalLinkFromHealth(row.event.female_animal_id, "breeding");
    if (!href.includes("from=health") || !href.includes("tab=breeding")) {
      fail(`bad animal link for ${row.femaleLabel}`, href);
      continue;
    }

    if (!row.event.id) fail(`missing event id for ${row.femaleLabel}`);
    if (!row.femaleLabel) fail(`missing female label for animal ${row.event.female_animal_id}`);
    if (!["overdue", "due_soon", "pending", "completed"].includes(row.status)) {
      fail(`invalid status ${row.status} for ${row.femaleLabel}`);
    }

    try {
      const profile = await loadAnimalProfileData(row.event.female_animal_id);
      if (!profile) {
        fail(`profile not found for ${row.femaleLabel}`);
        continue;
      }
      const hasEvent = profile.breeding_events.some((b) => b.id === row.event.id);
      if (!hasEvent) fail(`breeding event missing on profile ${row.femaleLabel}`);
      if (!profile.quickEntry.maleAnimals) fail(`missing maleAnimals for ${row.femaleLabel}`);
    } catch (e) {
      fail(`profile load ${row.femaleLabel}`, e);
    }
  }
  ok("all breeding rows link to valid profiles");

  const inPipeline = data.herd.breeding.filter((b) => isBreedingInPipeline(b.event));
  const eligible = data.quickEntry.breedingEligibleFemales ?? [];
  const overlap = eligible.filter((a) =>
    inPipeline.some((b) => b.event.female_animal_id === a.id)
  );
  if (overlap.length > 0) {
    fail(`eligible females include in-pipeline does: ${overlap.map((a) => a.label).join(", ")}`);
  } else {
    ok(`pipeline guard (${inPipeline.length} in pipeline, ${eligible.length} eligible to log)`);
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll breeding checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
