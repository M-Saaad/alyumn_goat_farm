import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emptyDb } from "../lib/db-empty.ts";
import { mergeDewormerNames } from "../lib/livestock/medical-notes.ts";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "farm-deworm-test-"));
fs.mkdirSync(path.join(tmpDir, "data"), { recursive: true });
fs.writeFileSync(path.join(tmpDir, "data", "farm.db.json"), JSON.stringify(emptyDb(), null, 2));
process.chdir(tmpDir);

const { ensureCustomDewormer } = await import("../lib/actions.ts");

const saved = await ensureCustomDewormer("Super Wormer", "internal");
assert.ok(saved);
assert.equal(saved?.name, "Super Wormer");

const db = JSON.parse(fs.readFileSync(path.join(tmpDir, "data", "farm.db.json"), "utf8"));
assert.equal(db.custom_dewormers.length, 1);
assert.equal(mergeDewormerNames(db.custom_dewormers, "internal").includes("Super Wormer"), true);

const again = await ensureCustomDewormer("super wormer", "internal");
assert.equal(again?.id, saved?.id);

console.log("PASS ensureCustomDewormer persists to JSON db");
