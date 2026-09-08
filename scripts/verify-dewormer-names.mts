import assert from "node:assert/strict";
import {
  extraDewormerNamesFromEvents,
  mergeDewormerNames,
  builtinDewormerByName,
} from "../lib/livestock/medical-notes.ts";

assert.deepEqual(mergeDewormerNames(["Farm Mix"], "internal"), [
  "Deviser Plus",
  "Nilzan Plus",
  "Punch",
  "Thunder",
  "Farm Mix",
]);
assert.deepEqual(mergeDewormerNames(["Tick Guard"], "external"), ["Unimec Plus", "Tick Guard"]);
assert.equal(builtinDewormerByName("punch", "internal"), "Punch");
assert.equal(builtinDewormerByName("Farm Mix", "internal"), null);

const events = [
  { event_type: "Deworming", notes: "I-DW Farm Mix 5ml" },
  { event_type: "Deworming", notes: "E-DW Tick Guard 1ml" },
  { event_type: "Deworming", notes: "I-DW Punch 5ml" },
];
assert.deepEqual(extraDewormerNamesFromEvents(events, "internal"), ["Farm Mix"]);
assert.deepEqual(extraDewormerNamesFromEvents(events, "external"), ["Tick Guard"]);

console.log("PASS extra dewormer names merge from medical notes");
