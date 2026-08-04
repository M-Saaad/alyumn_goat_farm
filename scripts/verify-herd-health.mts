import {
  computeHerdHealth,
  DEWORM_INTERVAL_DAYS,
  ETV_INTERVAL_DAYS,
  PPR_INTERVAL_DAYS,
  vaccineKindFromNotes,
} from "../lib/livestock/herd-health.ts";
import type { Animal, MedicalEvent } from "../lib/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const animal: Animal = {
  id: 1,
  name: "Test",
  tag_id: "T1",
  breed: "Teddy",
  sex: "Female",
  status: "Active",
  purchase_date: "2025-01-01",
  purchase_price: 10000,
  owner_id: null,
  sold_date: null,
  sold_price: null,
  notes: null,
};

function med(date: string, notes: string): MedicalEvent {
  return {
    id: `m-${date}-${notes}`,
    animal_id: 1,
    event_type: "Vaccine",
    date,
    notes,
    transaction_id: null,
  };
}

assert(vaccineKindFromNotes("PPR") === "ppr", "PPR notes");
assert(vaccineKindFromNotes("ETV 1ml") === "etv", "ETV notes");
assert(vaccineKindFromNotes("PPR + Loxin") === "ppr", "PPR combo notes");
assert(vaccineKindFromNotes(null) === null, "empty notes");

const today = "2026-07-01";
const recentPpr = computeHerdHealth({
  animals: [animal],
  medical_events: [med("2026-01-15", "PPR")],
  breeding_events: [],
  weight_logs: [],
  today,
});
const ppr = recentPpr.vaccines.find((v) => v.vaccineKind === "ppr");
assert(ppr?.status === "ok", `recent PPR should be ok, got ${ppr?.status}`);
assert(PPR_INTERVAL_DAYS === 365, "PPR interval is yearly");

const overduePpr = computeHerdHealth({
  animals: [animal],
  medical_events: [med("2024-06-01", "PPR")],
  breeding_events: [],
  weight_logs: [],
  today,
});
const oldPpr = overduePpr.vaccines.find((v) => v.vaccineKind === "ppr");
assert(oldPpr?.status === "overdue", `old PPR should be overdue, got ${oldPpr?.status}`);

const recentEtv = computeHerdHealth({
  animals: [animal],
  medical_events: [med("2026-02-01", "ETV 1ml")],
  breeding_events: [],
  weight_logs: [],
  today,
});
const etv = recentEtv.vaccines.find((v) => v.vaccineKind === "etv");
assert(etv?.status === "ok", `recent ETV should be ok, got ${etv?.status}`);
assert(ETV_INTERVAL_DAYS === 182, "ETV interval is twice yearly");

const overdueEtv = computeHerdHealth({
  animals: [animal],
  medical_events: [med("2025-12-01", "ETV 1ml")],
  breeding_events: [],
  weight_logs: [],
  today,
});
const oldEtv = overdueEtv.vaccines.find((v) => v.vaccineKind === "etv");
assert(oldEtv?.status === "overdue", `old ETV should be overdue, got ${oldEtv?.status}`);

const split = computeHerdHealth({
  animals: [animal],
  medical_events: [med("2026-01-01", "PPR"), med("2025-12-01", "ETV 1ml")],
  breeding_events: [],
  weight_logs: [],
  today,
});
assert(split.vaccines.length === 2, "one PPR + one ETV row per active goat");
assert(
  split.vaccines.some((v) => v.vaccineKind === "ppr" && v.status === "ok"),
  "split PPR ok"
);
assert(
  split.vaccines.some((v) => v.vaccineKind === "etv" && v.status === "overdue"),
  "split ETV overdue"
);

assert(DEWORM_INTERVAL_DAYS === 182, "deworm interval is twice yearly");

console.log("PASS herd health intervals (PPR yearly, ETV & deworm twice yearly)");
