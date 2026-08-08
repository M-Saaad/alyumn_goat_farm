import {
  computeHerdHealth,
  DEWORM_INTERVAL_DAYS,
  ETV_INTERVAL_DAYS,
  PPR_INTERVAL_DAYS,
  vaccineKindFromNotes,
} from "../lib/livestock/herd-health.ts";
import {
  computeUltrasoundStatus,
  needsUltrasound,
  ULTRASOUND_WINDOW_END_DAYS,
  ULTRASOUND_WINDOW_START_DAYS,
} from "../lib/livestock/breeding.ts";
import type { Animal, BreedingEvent, MedicalEvent } from "../lib/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const animal: Animal = {
  id: 1,
  name: "Test",
  breed: "Teddy",
  sex: "Female",
  date_of_purchase: "2025-01-01",
  age_at_purchase: null,
  description: null,
  comment: null,
  status: "Active",
  price: 10000,
  sold_price: null,
  purchased_from: null,
  owner_id: null,
  home_bred: false,
  out_date: null,
  palai_rate: null,
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

function breedingEvent(
  overrides: Partial<BreedingEvent> & Pick<BreedingEvent, "id" | "female_animal_id">
): BreedingEvent {
  return {
    male_animal_id: null,
    buck_name: "Shelby",
    date_crossed: "2026-05-01",
    expected_due_date: "2026-09-28",
    delivered_date: null,
    ultrasound_date: null,
    outcome: "Pending",
    status: "Doubt",
    notes: null,
    ...overrides,
  };
}

const ultrasoundToday = "2026-06-20"; // day 50 after 2026-05-01
const inWindow = breedingEvent({ id: "br-1", female_animal_id: 1 });
assert(ULTRASOUND_WINDOW_START_DAYS === 40, "ultrasound window starts day 40");
assert(ULTRASOUND_WINDOW_END_DAYS === 75, "ultrasound window ends day 75");
assert(
  computeUltrasoundStatus(inWindow, ultrasoundToday) === "in_window",
  "day 50 should be in ultrasound window"
);
assert(needsUltrasound(inWindow, ultrasoundToday), "in-window doe needs ultrasound");

const beforeWindow = breedingEvent({
  id: "br-2",
  female_animal_id: 3,
  date_crossed: "2026-06-01",
});
assert(
  computeUltrasoundStatus(beforeWindow, ultrasoundToday) === "not_due",
  "day 19 should be before ultrasound window"
);
assert(!needsUltrasound(beforeWindow, ultrasoundToday), "before window should not need ultrasound");

const overdueUltrasound = breedingEvent({
  id: "br-3",
  female_animal_id: 4,
  date_crossed: "2026-03-01",
});
assert(
  computeUltrasoundStatus(overdueUltrasound, ultrasoundToday) === "overdue",
  "day 111 should be ultrasound overdue"
);

const confirmed = breedingEvent({
  id: "br-4",
  female_animal_id: 5,
  ultrasound_date: "2026-06-10",
});
assert(
  computeUltrasoundStatus(confirmed, ultrasoundToday) === "confirmed",
  "ultrasound date set should be confirmed"
);

const herdUltrasound = computeHerdHealth({
  animals: [animal],
  medical_events: [],
  breeding_events: [inWindow],
  weight_logs: [],
  today: ultrasoundToday,
});
assert(herdUltrasound.ultrasoundDue.length === 1, "herd health lists ultrasound due");
assert(herdUltrasound.summary.ultrasoundDue === 1, "summary counts ultrasound due");
assert(
  herdUltrasound.actions.some((a) => a.kind === "ultrasound"),
  "overview action includes ultrasound"
);

console.log("PASS herd health intervals (PPR yearly, ETV & deworm twice yearly)");
console.log("PASS breeding ultrasound window (day 40–75)");
