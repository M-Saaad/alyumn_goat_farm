import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emptyDb } from "../lib/db-empty.ts";
import {
  mergeVaccineSchedules,
  parseVaccineNote,
  similarVaccineEvents,
  vaccineKeyFromNotes,
} from "../lib/livestock/vaccine-schedule.ts";
import { formatVaccineNotes } from "../lib/livestock/medical-notes.ts";

assert.equal(formatVaccineNotes("PPR", "1ml"), "PPR 1ml");
assert.equal(formatVaccineNotes("PPR", "1ml", 365), "PPR 1ml");
assert.equal(formatVaccineNotes("FMD", "1ml", 182), "FMD 1ml · twice a year");
assert.equal(formatVaccineNotes("FMD", "2ml", 365), "FMD 2ml · once a year");
assert.throws(() => formatVaccineNotes("  ", "1ml"), /vaccine name/);

assert.deepEqual(parseVaccineNote("PPR 1ml"), { name: "PPR", dosage: "1ml", intervalDays: null });
assert.deepEqual(parseVaccineNote("FMD 1ml · twice a year"), {
  name: "FMD",
  dosage: "1ml",
  intervalDays: 182,
});

const events = [
  { event_type: "Vaccine", notes: "PPR 1ml" },
  { event_type: "Vaccine", notes: "FMD 1ml · twice a year" },
  { event_type: "Vaccine", notes: "FMD 2ml · twice a year" },
];
const schedules = mergeVaccineSchedules(events);
assert.deepEqual(
  schedules.map((s) => s.key),
  ["ppr", "etv", "nitroxinil", "fmd"]
);
const fmd = schedules.find((s) => s.key === "fmd");
assert.equal(fmd?.name, "FMD");
assert.equal(fmd?.intervalDays, 182);
assert.equal(vaccineKeyFromNotes("FMD 1ml · twice a year", schedules), "fmd");
assert.equal(vaccineKeyFromNotes("PPR 1ml", schedules), "ppr");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "farm-vaccine-test-"));
fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
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
fs.writeFileSync(path.join(tmpDir, "data", "farm.db.json"), JSON.stringify(goatDb, null, 2));
process.chdir(tmpDir);

const { logMedical } = await import("../lib/actions.ts");

await logMedical({
  animalIds: [1],
  eventType: "Vaccine",
  date: "2026-09-08",
  notes: formatVaccineNotes("FMD", "1ml", 182),
});
const afterMed = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterMed.medical_events.length, 1);
assert.equal(afterMed.medical_events[0].notes, "FMD 1ml · twice a year");
assert.equal(afterMed.custom_vaccines, undefined);
assert.equal(
  mergeVaccineSchedules(afterMed.medical_events).some((v) => v.name === "FMD" && v.intervalDays === 182),
  true
);

await logMedical({
  animalIds: [1],
  eventType: "Vaccine",
  date: "2026-09-08",
  notes: formatVaccineNotes("PPR", "1ml", 365),
});
const afterPpr = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterPpr.medical_events[1].notes, "PPR 1ml");

function goat(id: number, name: string) {
  return {
    id,
    name,
    breed: "Teddy" as const,
    sex: "Female" as const,
    date_of_purchase: "2025-01-01",
    age_at_purchase: null,
    description: null,
    comment: null,
    status: "Active" as const,
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
  };
}

const herdDb = emptyDb();
herdDb.animals = [goat(1, "Gulabo"), goat(2, "Gurdya")];
fs.writeFileSync(path.join(tmpDir, "data", "farm.db.json"), JSON.stringify(herdDb, null, 2));

const { updateVaccineEvents, deleteVaccineEvents } = await import("../lib/actions.ts");

await logMedical({
  animalIds: [1, 2],
  eventType: "Vaccine",
  date: "2026-09-08",
  notes: formatVaccineNotes("FMD", "1ml", 182),
});
const logged = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(logged.medical_events.length, 2);
assert.equal(
  similarVaccineEvents(logged.medical_events, logged.medical_events[0]).length,
  1
);

const firstId = logged.medical_events[0].id;
await updateVaccineEvents({
  id: firstId,
  date: "2026-09-09",
  notes: formatVaccineNotes("FMD", "2ml", 182),
  applySimilar: true,
});
const afterEdit = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterEdit.medical_events.length, 2);
assert.ok(afterEdit.medical_events.every((e: { date: string; notes: string }) => e.date === "2026-09-09"));
assert.ok(
  afterEdit.medical_events.every((e: { notes: string }) => e.notes === "FMD 2ml · twice a year")
);

await updateVaccineEvents({
  id: firstId,
  date: "2026-09-10",
  notes: formatVaccineNotes("FMD", "3ml", 365),
  applySimilar: false,
});
const afterOne = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
const edited = afterOne.medical_events.find((e: { id: string }) => e.id === firstId);
const other = afterOne.medical_events.find((e: { id: string }) => e.id !== firstId);
assert.equal(edited.notes, "FMD 3ml · once a year");
assert.equal(edited.date, "2026-09-10");
assert.equal(other.notes, "FMD 2ml · twice a year");
assert.equal(other.date, "2026-09-09");

await deleteVaccineEvents({ id: other.id, applySimilar: false });
const afterDeleteOne = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterDeleteOne.medical_events.length, 1);
assert.equal(afterDeleteOne.medical_events[0].id, firstId);

await logMedical({
  animalIds: [1, 2],
  eventType: "Vaccine",
  date: "2026-09-11",
  notes: formatVaccineNotes("PPR", "1ml"),
});
const beforeBulkDelete = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
const ppr = beforeBulkDelete.medical_events.find((e: { notes: string }) => e.notes === "PPR 1ml");
await deleteVaccineEvents({ id: ppr.id, applySimilar: true });
const afterBulkDelete = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(afterBulkDelete.medical_events.some((e: { notes: string }) => e.notes === "PPR 1ml"), false);
assert.equal(afterBulkDelete.medical_events.length, 1);

console.log("PASS extra vaccines are medical notes, same as PPR — no lookup table");
console.log("PASS vaccine edit/delete including same-day same-dosage goats");
