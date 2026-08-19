/**
 * Verifies quick-entry palai history is built when palai_payments + transactions are loaded.
 */
import { loadDb } from "../lib/db";
import { emptyDb } from "../lib/db-empty";
import { quickEntryPropsFromDb } from "../lib/quick-entry-props";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const full = loadDb();
const awais = full.contacts.find((c) => c.name === "Awais");
assert(!!awais, "Awais contact exists");

const partial = emptyDb();
partial.animals = full.animals;
partial.contacts = full.contacts;
partial.breeding_events = full.breeding_events;

const emptyHistory = quickEntryPropsFromDb(partial);
assert(emptyHistory.palaiHistory.length === 0, "partial db should have empty palai history");

const complete = emptyDb();
complete.animals = full.animals;
complete.contacts = full.contacts;
complete.breeding_events = full.breeding_events;
complete.palai_payments = full.palai_payments;
complete.transactions = full.transactions;

const fullHistory = quickEntryPropsFromDb(complete);
assert(fullHistory.palaiHistory.length > 0, "complete db should have palai history");
const awaisEntries = fullHistory.palaiHistory.filter(
  (e) => e.customerName.toLowerCase() === "awais"
);
assert(awaisEntries.length > 0, "Awais palai history should be present");
assert(
  awaisEntries.every((e) => e.transactionId),
  "every palai history entry should link to a transaction"
);

console.log("PASS quick-entry palai history requires palai_payments + transactions");
console.log(`  Awais entries: ${awaisEntries.length}`);
