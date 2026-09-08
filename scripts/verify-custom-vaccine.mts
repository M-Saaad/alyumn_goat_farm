import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emptyDb } from "../lib/db-empty.ts";
import {
  mergeVaccineSchedules,
  parseVaccineNote,
  vaccineKeyFromNotes,
} from "../lib/livestock/vaccine-schedule.ts";
import { formatVaccineNotes } from "../lib/livestock/medical-notes.ts";

assert.equal(formatVaccineNotes("PPR", "1ml"), "PPR 1ml");
assert.equal(formatVaccineNotes("PPR", "1ml", 365), "PPR 1ml");
assert.equal(formatVaccineNotes("FMD", "1ml", 182), "FMD 1ml · twice a year");
assert.equal(formatVaccineNotes("FMD", "2ml", 365), "FMD 2ml · once a year");
assert.throws(() => formatVaccineNotes("  ", "1ml"), /vaccine name/);

assert.deepEqual(parseVaccineNote("PPR 1ml"), { name: "PPR", intervalDays: null });
assert.deepEqual(parseVaccineNote("FMD 1ml · twice a year"), {
  name: "FMD",
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

console.log("PASS extra vaccines are medical notes, same as PPR — no lookup table");
