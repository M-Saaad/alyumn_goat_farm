import { animalLabel } from "@/lib/labels";
import { isBreedingInPipeline } from "./breeding";
import type { Animal, BreedingEvent, MedicalEvent, WeightLog } from "@/lib/types";
import { todayIso } from "@/lib/format";

export { HEALTH_TABS, parseHealthTab } from "./health-tabs";
export type { HealthTab } from "./health-tabs";
export const VACCINE_INTERVAL_DAYS = 90;
export const DEWORM_INTERVAL_DAYS = 90;
export { GESTATION_DAYS } from "./breeding";
export const DUE_SOON_DAYS = 14;

export type DueStatus = "overdue" | "due_soon" | "ok" | "never";

export type AnimalDueItem = {
  animalId: number;
  label: string;
  lastDate: string | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  status: DueStatus;
};

export type BreedingRow = {
  event: BreedingEvent;
  femaleLabel: string;
  daysUntilDue: number | null;
  status: "overdue" | "due_soon" | "pending" | "completed";
};

export type WeightRow = {
  animalId: number;
  label: string;
  latest: WeightLog | null;
  previous: WeightLog | null;
  changeKg: number | null;
};

export type HerdHealthSummary = {
  activeCount: number;
  pendingPregnancies: number;
  overdueVaccines: number;
  dueSoonVaccines: number;
  overdueDeworm: number;
  dueSoonDeworm: number;
  neverVaccinated: number;
  neverDewormed: number;
  neverWeighed: number;
  breedingDelivered: number;
  breedingFailed: number;
  avgWeightKg: number | null;
};

export type HerdHealthData = {
  summary: HerdHealthSummary;
  actions: Array<{
    kind: "vaccine" | "deworm" | "breeding";
    animalId: number;
    label: string;
    detail: string;
    urgency: "overdue" | "due_soon";
  }>;
  vaccines: AnimalDueItem[];
  deworming: AnimalDueItem[];
  breeding: BreedingRow[];
  weights: WeightRow[];
  recentMedical: Array<MedicalEvent & { animalLabel: string }>;
  recentWeights: Array<WeightLog & { animalLabel: string }>;
};

function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso.slice(0, 10));
  const to = new Date(toIso.slice(0, 10));
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function dueStatus(lastDate: string | null, intervalDays: number, today: string): {
  dueDate: string | null;
  daysUntilDue: number | null;
  status: DueStatus;
} {
  if (!lastDate) {
    return { dueDate: null, daysUntilDue: null, status: "never" };
  }
  const dueDate = addDays(lastDate, intervalDays);
  const daysUntilDue = daysBetween(today, dueDate);
  if (daysUntilDue < 0) {
    return { dueDate, daysUntilDue, status: "overdue" };
  }
  if (daysUntilDue <= DUE_SOON_DAYS) {
    return { dueDate, daysUntilDue, status: "due_soon" };
  }
  return { dueDate, daysUntilDue, status: "ok" };
}

function lastEventByAnimal(
  events: MedicalEvent[],
  eventType: MedicalEvent["event_type"]
): Map<number, MedicalEvent> {
  const map = new Map<number, MedicalEvent>();
  for (const e of events) {
    if (e.event_type !== eventType || !e.date) continue;
    const prev = map.get(e.animal_id);
    if (!prev || (e.date > (prev.date || ""))) {
      map.set(e.animal_id, e);
    }
  }
  return map;
}

function buildDueList(
  activeAnimals: Animal[],
  lastByAnimal: Map<number, MedicalEvent>,
  intervalDays: number,
  today: string
): AnimalDueItem[] {
  return activeAnimals
    .map((a) => {
      const last = lastByAnimal.get(a.id);
      const { dueDate, daysUntilDue, status } = dueStatus(last?.date ?? null, intervalDays, today);
      return {
        animalId: a.id,
        label: animalLabel(a),
        lastDate: last?.date ?? null,
        dueDate,
        daysUntilDue,
        status,
      };
    })
    .sort((a, b) => {
      const order: Record<DueStatus, number> = { overdue: 0, due_soon: 1, never: 2, ok: 3 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999);
    });
}

export function computeHerdHealth(input: {
  animals: Animal[];
  medical_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  weight_logs: WeightLog[];
  today?: string;
}): HerdHealthData {
  const today = input.today ?? todayIso();
  const weightLogs = input.weight_logs ?? [];
  const medicalEvents = input.medical_events ?? [];
  const breedingEvents = input.breeding_events ?? [];
  const activeAnimals = input.animals.filter((a) => a.status === "Active");

  const lastVaccine = lastEventByAnimal(medicalEvents, "Vaccine");
  const lastDeworm = lastEventByAnimal(medicalEvents, "Deworming");

  const vaccines = buildDueList(activeAnimals, lastVaccine, VACCINE_INTERVAL_DAYS, today);
  const deworming = buildDueList(activeAnimals, lastDeworm, DEWORM_INTERVAL_DAYS, today);

  const breeding: BreedingRow[] = breedingEvents
    .map((event) => {
      const female = input.animals.find((a) => a.id === event.female_animal_id);
      const femaleLabel = female ? animalLabel(female) : `Goat #${event.female_animal_id}`;
      const isPending = isBreedingInPipeline(event);
      let daysUntilDue: number | null = null;
      let status: BreedingRow["status"] = "completed";
      if (isPending && event.expected_due_date) {
        daysUntilDue = daysBetween(today, event.expected_due_date);
        if (daysUntilDue < 0) status = "overdue";
        else if (daysUntilDue <= DUE_SOON_DAYS) status = "due_soon";
        else status = "pending";
      }
      return { event, femaleLabel, daysUntilDue, status };
    })
    .sort((a, b) => {
      const pendingOrder = { overdue: 0, due_soon: 1, pending: 2, completed: 3 };
      const diff = pendingOrder[a.status] - pendingOrder[b.status];
      if (diff !== 0) return diff;
      return (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999);
    });

  const weightsByAnimal = new Map<number, WeightLog[]>();
  for (const w of weightLogs) {
    const list = weightsByAnimal.get(w.animal_id) ?? [];
    list.push(w);
    weightsByAnimal.set(w.animal_id, list);
  }
  for (const list of weightsByAnimal.values()) {
    list.sort((a, b) => b.weighed_on.localeCompare(a.weighed_on));
  }

  const weights: WeightRow[] = activeAnimals
    .map((a) => {
      const logs = weightsByAnimal.get(a.id) ?? [];
      const latest = logs[0] ?? null;
      const previous = logs[1] ?? null;
      const changeKg =
        latest && previous ? Math.round((latest.weight_kg - previous.weight_kg) * 10) / 10 : null;
      return { animalId: a.id, label: animalLabel(a), latest, previous, changeKg };
    })
    .sort((a, b) => {
      if (!a.latest && !b.latest) return a.label.localeCompare(b.label);
      if (!a.latest) return -1;
      if (!b.latest) return 1;
      return b.latest.weighed_on.localeCompare(a.latest.weighed_on);
    });

  const actions: HerdHealthData["actions"] = [];
  for (const v of vaccines) {
    if (v.status === "overdue" || v.status === "due_soon" || v.status === "never") {
      actions.push({
        kind: "vaccine",
        animalId: v.animalId,
        label: v.label,
        detail: v.status === "never" ? "Never vaccinated" : `Due ${v.dueDate}`,
        urgency: v.status === "overdue" ? "overdue" : "due_soon",
      });
    }
  }
  for (const d of deworming) {
    if (d.status === "overdue" || d.status === "due_soon" || d.status === "never") {
      actions.push({
        kind: "deworm",
        animalId: d.animalId,
        label: d.label,
        detail: d.status === "never" ? "Never dewormed" : `Due ${d.dueDate}`,
        urgency: d.status === "overdue" ? "overdue" : "due_soon",
      });
    }
  }
  for (const b of breeding) {
    if (b.status === "overdue" || b.status === "due_soon") {
      actions.push({
        kind: "breeding",
        animalId: b.event.female_animal_id,
        label: b.femaleLabel,
        detail: `Expected ${b.event.expected_due_date}`,
        urgency: b.status === "overdue" ? "overdue" : "due_soon",
      });
    }
  }
  actions.sort((a, b) => (a.urgency === "overdue" ? -1 : 1) - (b.urgency === "overdue" ? -1 : 1));

  const pendingPregnancies = breeding.filter(
    (b) => b.status === "overdue" || b.status === "due_soon" || b.status === "pending"
  ).length;

  const completedBreeding = breedingEvents.filter((b) => b.outcome !== "Pending");
  const breedingDelivered = completedBreeding.filter((b) => b.outcome === "Delivered").length;
  const breedingFailed = completedBreeding.filter(
    (b) => b.outcome === "Miscarriage" || b.outcome === "Stillbirth"
  ).length;

  const latestWeights = weights.filter((w) => w.latest).map((w) => w.latest!.weight_kg);
  const avgWeightKg =
    latestWeights.length > 0
      ? Math.round((latestWeights.reduce((s, w) => s + w, 0) / latestWeights.length) * 10) / 10
      : null;

  const animalLabelMap = new Map(input.animals.map((a) => [a.id, animalLabel(a)]));

  const recentMedical = [...medicalEvents]
    .filter((m) => m.date)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 15)
    .map((m) => ({ ...m, animalLabel: animalLabelMap.get(m.animal_id) ?? `Goat #${m.animal_id}` }));

  const recentWeights = [...weightLogs]
    .sort((a, b) => b.weighed_on.localeCompare(a.weighed_on))
    .slice(0, 15)
    .map((w) => ({ ...w, animalLabel: animalLabelMap.get(w.animal_id) ?? `Goat #${w.animal_id}` }));

  const summary: HerdHealthSummary = {
    activeCount: activeAnimals.length,
    pendingPregnancies,
    overdueVaccines: vaccines.filter((v) => v.status === "overdue").length,
    dueSoonVaccines: vaccines.filter((v) => v.status === "due_soon").length,
    overdueDeworm: deworming.filter((d) => d.status === "overdue").length,
    dueSoonDeworm: deworming.filter((d) => d.status === "due_soon").length,
    neverVaccinated: vaccines.filter((v) => v.status === "never").length,
    neverDewormed: deworming.filter((d) => d.status === "never").length,
    neverWeighed: weights.filter((w) => !w.latest).length,
    breedingDelivered,
    breedingFailed,
    avgWeightKg,
  };

  return {
    summary,
    actions,
    vaccines,
    deworming,
    breeding,
    weights,
    recentMedical,
    recentWeights,
  };
}
