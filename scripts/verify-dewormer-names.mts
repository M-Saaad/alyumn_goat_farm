import assert from "node:assert/strict";
import {
  mergeDewormerNames,
  findCustomDewormerByName,
  builtinDewormerByName,
} from "../lib/livestock/medical-notes.ts";

const custom = [
  { name: "Farm Mix", deworm_type: "internal" as const },
  { name: "Tick Guard", deworm_type: "external" as const },
];

assert.deepEqual(mergeDewormerNames(custom, "internal"), [
  "Deviser Plus",
  "Nilzan Plus",
  "Punch",
  "Thunder",
  "Farm Mix",
]);
assert.deepEqual(mergeDewormerNames(custom, "external"), ["Unimec Plus", "Tick Guard"]);
assert.equal(findCustomDewormerByName(custom, "farm mix", "internal")?.name, "Farm Mix");
assert.equal(builtinDewormerByName("punch", "internal"), "Punch");
assert.equal(builtinDewormerByName("Farm Mix", "internal"), null);

console.log("PASS custom dewormer name merge");
