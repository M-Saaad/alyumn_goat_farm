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
  ultrasoundConfirmedText,
  resolveBreedingAfterUltrasound,
  breedingRecordStatusLabel,
  breedingTimeline,
  findActiveBreedingForDam,
  isBreedingInPipeline,
  isRecentDelivery,
  resolveBreedingAfterBirth,
  breedingUpdatesFromBirths,
  canRecordOrEditUltrasound,
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
  dam_id: null,
  sire_id: null,
  sire_name: null,
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
    fetus_count: null,
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

const confirmedTwins = breedingEvent({
  id: "br-5",
  female_animal_id: 6,
  ultrasound_date: "2026-06-10",
  fetus_count: 2,
});
assert(
  ultrasoundConfirmedText(confirmedTwins.ultrasound_date, confirmedTwins.fetus_count) ===
    "Confirmed · 2 kids · Ultrasound 2026-06-10",
  "confirmed twins text"
);

const notPregnant = breedingEvent({
  id: "br-6",
  female_animal_id: 7,
  ultrasound_date: "2026-06-10",
  fetus_count: 0,
});
assert(
  ultrasoundConfirmedText(notPregnant.ultrasound_date, notPregnant.fetus_count) ===
    "Ready · Ultrasound 2026-06-10",
  "ready after empty ultrasound text"
);

const pending = breedingEvent({ id: "br-7", female_animal_id: 8, outcome: "Pending", status: "Doubt" });
const confirmedPregnant = resolveBreedingAfterUltrasound(pending, 2);
assert(confirmedPregnant.status === "Ready" && confirmedPregnant.outcome === "Pending", "pregnant ultrasound → Ready / Pending");
assert(breedingRecordStatusLabel({ ...pending, ultrasound_date: "2026-06-10", fetus_count: 2, ...confirmedPregnant }) === "Confirmed", "pregnant label");

const confirmedEmpty = resolveBreedingAfterUltrasound(pending, 0);
assert(confirmedEmpty.outcome === "Miscarriage" && confirmedEmpty.status === "Ready", "empty ultrasound → Ready / Miscarriage");
assert(breedingRecordStatusLabel({ ...pending, ultrasound_date: "2026-06-10", fetus_count: 0, ...confirmedEmpty }) === "Ready", "ready label");

const delivered = resolveBreedingAfterBirth(pending, "2026-08-15");
assert(delivered.outcome === "Delivered" && delivered.status === "Delivered", "birth closes breeding");
assert(breedingRecordStatusLabel({ ...pending, ...delivered }) === "Delivered", "delivered label within 60 days");
assert(
  breedingRecordStatusLabel({ ...pending, ...delivered, delivered_date: "2026-04-01" }, "2026-08-17") === "Ready",
  "delivered label after 60 days becomes ready"
);
assert(
  isRecentDelivery({ ...pending, ...delivered, delivered_date: "2026-08-15" }, "2026-08-17"),
  "recent delivery within 60 days"
);
assert(
  !isRecentDelivery({ ...pending, ...delivered, delivered_date: "2026-04-01" }, "2026-08-17"),
  "old delivery not recent"
);

const deliveredTimeline = breedingTimeline({ ...pending, ...delivered });
assert(deliveredTimeline?.type === "delivered" && deliveredTimeline.date === "2026-08-15", "delivered timeline uses birth date");
assert(
  breedingTimeline({ ...pending, ...delivered, expected_due_date: "2026-09-03" })?.type === "delivered",
  "delivered timeline ignores expected due date"
);

assert(
  canRecordOrEditUltrasound({ ...pending, ultrasound_date: "2026-06-10", fetus_count: 2 }),
  "can edit after confirmed ultrasound"
);
assert(
  !canRecordOrEditUltrasound({ ...delivered, ultrasound_date: "2026-06-10", fetus_count: 2 }),
  "cannot edit ultrasound after delivery"
);

const notPregnantUltrasound = breedingEvent({
  id: "br-ready",
  female_animal_id: 6,
  ultrasound_date: "2026-08-15",
  fetus_count: 0,
  outcome: "Pending",
  status: "Ready",
});
assert(!isBreedingInPipeline(notPregnantUltrasound), "0-kid ultrasound closes pipeline");
const readyHerd = computeHerdHealth({
  animals: [{ ...animal, id: 6, name: "Guriya", sex: "Female" }],
  medical_events: [],
  breeding_events: [notPregnantUltrasound],
  weight_logs: [],
  today: "2026-08-17",
});
assert(readyHerd.breeding[0]?.status === "ready", "not pregnant doe shows ready badge tone");
assert(readyHerd.breeding[0]?.statusLabel === "Ready", "not pregnant doe shows ready label");

const cadburyBreeding = breedingEvent({
  id: "br-cadbury",
  female_animal_id: 43,
  buck_name: "Black Abluk Breeder",
  date_crossed: "2026-04-07",
  outcome: "Doubt",
  status: "Doubt",
});
const found = findActiveBreedingForDam([cadburyBreeding], 43, { sireName: "Black Abluk Breeder" });
assert(found?.id === "br-cadbury", "find active breeding for dam");

const deliveredBreeding = resolveBreedingAfterBirth(cadburyBreeding, "2026-08-15");
const herdAfterBirth = computeHerdHealth({
  animals: [{ ...animal, id: 43, name: "Cadbury", sex: "Female" }],
  medical_events: [],
  breeding_events: [deliveredBreeding],
  weight_logs: [],
  today: "2026-08-17",
});
assert(herdAfterBirth.breeding[0]?.status === "completed", "delivered breeding not pending in herd");
assert(herdAfterBirth.breeding[0]?.statusLabel === "Delivered", "delivered doe shows delivered label");

const oldDelivery = resolveBreedingAfterBirth(cadburyBreeding, "2026-04-01");
const herdOldDelivery = computeHerdHealth({
  animals: [{ ...animal, id: 43, name: "Cadbury", sex: "Female" }],
  medical_events: [],
  breeding_events: [oldDelivery],
  weight_logs: [],
  today: "2026-08-17",
});
assert(herdOldDelivery.breeding[0]?.status === "ready", "old delivery shows ready badge");
assert(herdOldDelivery.breeding[0]?.statusLabel === "Ready", "old delivery shows ready label");

const kidDoe: Animal = {
  ...animal,
  id: 99,
  name: "KidDoe",
  sex: "Female",
  home_bred: true,
  date_of_purchase: "2026-07-01",
  age_at_purchase: "0",
};
const openDoe: Animal = { ...animal, id: 100, name: "OpenDoe", sex: "Female" };
const herdRoster = computeHerdHealth({
  animals: [animal, kidDoe, openDoe],
  medical_events: [],
  breeding_events: [inWindow],
  weight_logs: [],
  today: ultrasoundToday,
});
assert(!herdRoster.breeding.some((b) => b.femaleId === 99), "kids excluded from breeding roster");
assert(
  herdRoster.breeding.some((b) => b.femaleId === 100 && b.status === "ready"),
  "adult doe without breeding shows ready"
);
assert(herdRoster.breeding.length === 2, "roster lists each adult female once");

const herdUltrasound = computeHerdHealth({
  animals: [animal],
  medical_events: [],
  breeding_events: [inWindow],
  weight_logs: [],
  today: ultrasoundToday,
});
assert(
  herdUltrasound.breeding[0]?.ultrasoundStatus === "in_window",
  "herd breeding row tracks ultrasound status"
);

const soldDoe: Animal = { ...animal, id: 2, name: "SoldDoe", status: "Sold" };
const soldBreeding = breedingEvent({ id: "br-sold", female_animal_id: 2 });
const herdActiveOnly = computeHerdHealth({
  animals: [animal, soldDoe],
  medical_events: [],
  breeding_events: [inWindow, soldBreeding],
  weight_logs: [],
  today: ultrasoundToday,
});
assert(herdActiveOnly.breeding.length === 1, "only active adult female in breeding roster");
assert(
  herdActiveOnly.breeding[0]?.femaleId === 1,
  "active doe in breeding roster"
);

console.log("PASS herd health intervals (PPR yearly, ETV & deworm twice yearly)");
console.log("PASS breeding ultrasound window (day 40–75)");
