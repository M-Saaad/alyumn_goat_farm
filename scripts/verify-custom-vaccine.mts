import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emptyDb } from "../lib/db-empty.ts";
import { mergeVaccineSchedules } from "../lib/livestock/vaccine-schedule.ts";
import { isMissingRelationMessage } from "../lib/db/supabase.ts";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "farm-vaccine-test-"));
fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
fs.writeFileSync(path.join(tmpDir, "data", "farm.db.json"), JSON.stringify(emptyDb(), null, 2));
process.chdir(tmpDir);

const { addCustomVaccine, ensureCustomVaccine, deleteCustomVaccine, logMedical } = await import(
  "../lib/actions.ts"
);

const saved = await addCustomVaccine({ name: "FMD", intervalDays: 182 });
assert.equal(saved.name, "FMD");
assert.equal(saved.interval_days, 182);

const db = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(db.custom_vaccines.length, 1);
assert.equal(db.custom_vaccines[0].name, "FMD");
assert.equal(db.custom_vaccines[0].interval_days, 182);
assert.equal(mergeVaccineSchedules(db.custom_vaccines).some((v) => v.name === "FMD"), true);

const again = await ensureCustomVaccine("fmd", 182);
assert.equal(again?.id, db.custom_vaccines[0].id);

await assert.rejects(
  () => addCustomVaccine({ name: "FMD", intervalDays: 365 }),
  /already exists/
);
await assert.rejects(
  () => addCustomVaccine({ name: "PPR", intervalDays: 365 }),
  /standard vaccine/
);
await assert.rejects(() => addCustomVaccine({ name: "  ", intervalDays: 365 }), /vaccine name/);

const goatDb = emptyDb();
goatDb.animals = [
  {
    id: 1,
    name: "Test",
    breed: "Teddy",
    sex: "Female",
    date_of_purchase: "2025-01-01",
    age_at_purchase: null,
    description: null,
    comment: null,
    status: "Active",
    price: 0,
    sold_price: null,
    purchased_from: null,
    owner_id: null,
    home_bred: false,
    dam_id: null,
    sire_id: null,
    sire_name: null,
    out_date: null,
    palai_rate: null,
  },
];
goatDb.custom_vaccines = db.custom_vaccines;
fs.writeFileSync(path.join(tmpDir, "data", "farm.db.json"), JSON.stringify(goatDb, null, 2));

await logMedical({
  animalIds: [1],
  eventType: "Vaccine",
  date: "2026-09-08",
  notes: "FMD 1ml",
});
const afterMed = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterMed.medical_events.length, 1);
assert.equal(afterMed.medical_events[0].notes, "FMD 1ml");

const vaccineId = afterMed.custom_vaccines[0].id;
await deleteCustomVaccine(vaccineId);
const afterDelete = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterDelete.custom_vaccines.length, 0);

assert.equal(
  isMissingRelationMessage(
    "custom_vaccines upsert: Could not find the table 'public.custom_vaccines' in the schema cache",
    "custom_vaccines"
  ),
  true
);
assert.equal(isMissingRelationMessage("animals upsert: duplicate key", "custom_vaccines"), false);

console.log("PASS custom vaccine add/ensure/delete + medical log persist to JSON db");
