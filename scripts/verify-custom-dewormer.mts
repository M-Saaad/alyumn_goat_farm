import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emptyDb } from "../lib/db-empty.ts";
import {
  extraDewormerNamesFromEvents,
  formatDewormNotes,
  mergeDewormerNames,
} from "../lib/livestock/medical-notes.ts";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "farm-deworm-test-"));
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
const notes = formatDewormNotes({
  type: "internal",
  name: "Super Wormer",
  dosage: "5ml",
});
assert.equal(notes, "I-DW Super Wormer 5ml");

await logMedical({
  animalIds: [1],
  eventType: "Deworming",
  date: "2026-09-08",
  notes,
});

const db = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(db.medical_events.length, 1);
assert.equal(db.custom_dewormers, undefined);
assert.deepEqual(extraDewormerNamesFromEvents(db.medical_events, "internal"), ["Super Wormer"]);
assert.equal(mergeDewormerNames(["Super Wormer"], "internal").includes("Super Wormer"), true);

console.log("PASS extra dewormers are medical notes — no lookup table");
