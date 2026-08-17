import type { Animal, BreedingEvent, BreedingOutcome, BreedingStatus } from "../types";
import { todayIso } from "../format";

export const GESTATION_DAYS = 150;
/** Show Delivered status for this many days after kidding, then Ready. */
export const POST_DELIVERY_READY_DAYS = 60;
/** Ultrasound window starts day 40 after crossing (inclusive). */
export const ULTRASOUND_WINDOW_START_DAYS = 40;
/** Ultrasound window ends day 75 after crossing (inclusive). */
export const ULTRASOUND_WINDOW_END_DAYS = 75;

export type UltrasoundStatus = "not_due" | "in_window" | "overdue" | "confirmed";

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso.slice(0, 10));
  const to = new Date(toIso.slice(0, 10));
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysSinceCrossed(dateCrossed: string, today: string): number {
  return daysBetween(dateCrossed, today);
}

export function ultrasoundWindowStart(dateCrossed: string): string {
  return addDays(dateCrossed, ULTRASOUND_WINDOW_START_DAYS);
}

export function ultrasoundWindowEnd(dateCrossed: string): string {
  return addDays(dateCrossed, ULTRASOUND_WINDOW_END_DAYS);
}

export function computeUltrasoundStatus(event: BreedingEvent, today: string): UltrasoundStatus {
  if (event.ultrasound_date) return "confirmed";
  if (!event.date_crossed || !isBreedingInPipeline(event)) return "not_due";

  const days = daysSinceCrossed(event.date_crossed, today);
  if (days < ULTRASOUND_WINDOW_START_DAYS) return "not_due";
  if (days <= ULTRASOUND_WINDOW_END_DAYS) return "in_window";
  return "overdue";
}

export function needsUltrasound(event: BreedingEvent, today: string): boolean {
  const status = computeUltrasoundStatus(event, today);
  return status === "in_window" || status === "overdue";
}

export function ultrasoundStatusText(
  status: UltrasoundStatus,
  ultrasoundDate: string | null,
  daysSinceCrossed: number | null,
  fetusCount?: number | null
): string {
  if (status === "confirmed" && ultrasoundDate) {
    return ultrasoundConfirmedText(ultrasoundDate, fetusCount ?? null);
  }
  const day = daysSinceCrossed != null ? `day ${daysSinceCrossed}` : "";
  if (status === "not_due") return `Ultrasound · early · ${day}`.trim();
  if (status === "in_window") return `Ultrasound · in window · ${day}`.trim();
  if (status === "overdue") return `Ultrasound · overdue · ${day}`.trim();
  return "Ultrasound";
}

export function formatKidCount(count: number): string {
  return count === 1 ? "1 kid" : `${count} kids`;
}

export function ultrasoundConfirmedText(
  ultrasoundDate: string | null,
  fetusCount: number | null
): string {
  const datePart = ultrasoundDate ? `Ultrasound ${ultrasoundDate.slice(0, 10)}` : "Ultrasound";
  if (fetusCount === 0) return `Ready · ${datePart}`;
  if (fetusCount != null && fetusCount > 0) {
    return `Confirmed · ${formatKidCount(fetusCount)} · ${datePart}`;
  }
  return datePart;
}

/** Short label for breeding rows after ultrasound (animal profile, lists). */
export function isRecentDelivery(event: BreedingEvent, today: string = todayIso()): boolean {
  if (event.outcome !== "Delivered") return false;
  const delivered = event.delivered_date?.trim().slice(0, 10);
  if (!delivered) return false;
  return daysBetween(delivered, today) <= POST_DELIVERY_READY_DAYS;
}

export function breedingRecordStatusLabel(
  event: BreedingEvent,
  today: string = todayIso()
): string {
  if (event.outcome === "Delivered") {
    return isRecentDelivery(event, today) ? "Delivered" : "Ready";
  }
  if (event.outcome === "Stillbirth") return "Stillbirth";
  if (event.outcome === "Miscarriage") return "Ready";
  if (event.ultrasound_date) {
    if (event.fetus_count != null && event.fetus_count > 0) return "Confirmed";
    if (event.fetus_count === 0) return "Ready";
  }
  return event.status || event.outcome;
}

/** Update breeding status/outcome when an ultrasound result is saved. */
export function resolveBreedingAfterUltrasound(
  existing: BreedingEvent,
  fetusCount: number | null | undefined
): { status: BreedingStatus | null; outcome: BreedingOutcome } {
  if (fetusCount === 0) {
    return { status: "Ready", outcome: "Miscarriage" };
  }
  if (fetusCount != null && fetusCount > 0) {
    return { status: "Ready", outcome: "Pending" };
  }

  let outcome: BreedingOutcome = existing.outcome;
  if (outcome === "Doubt") outcome = "Pending";
  let status: BreedingStatus | null = existing.status;
  if (!status || status === "Doubt") status = "Ready";
  return { status, outcome };
}

/** Record a new ultrasound or edit an existing one (until kidding is logged). */
export function canRecordOrEditUltrasound(event: BreedingEvent): boolean {
  if (!event.date_crossed) return false;
  if (event.outcome === "Delivered" || event.outcome === "Stillbirth") return false;
  if (event.ultrasound_date) return true;
  return isBreedingInPipeline(event);
}

/** Pick the active breeding record to close when a kid is born. */
export function findActiveBreedingForDam(
  events: BreedingEvent[],
  damId: number,
  match?: { sireId?: number | null; sireName?: string | null }
): BreedingEvent | null {
  const active = events.filter(
    (e) => e.female_animal_id === damId && isBreedingInPipeline(e)
  );
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];

  if (match?.sireId) {
    const bySire = active.find((e) => e.male_animal_id === match.sireId);
    if (bySire) return bySire;
  }
  if (match?.sireName?.trim()) {
    const name = match.sireName.trim().toLowerCase();
    const byName = active.find((e) => (e.buck_name ?? "").toLowerCase() === name);
    if (byName) return byName;
  }

  return active.sort((a, b) => (b.date_crossed ?? "").localeCompare(a.date_crossed ?? ""))[0];
}

/** Close a breeding record when kids are born. */
export function resolveBreedingAfterBirth(
  existing: BreedingEvent,
  birthDate: string
): BreedingEvent {
  return {
    ...existing,
    outcome: "Delivered",
    status: "Delivered",
    delivered_date: birthDate.trim().slice(0, 10),
  };
}

/** Backfill breeding deliveries from existing farm-born kid records. */
export function breedingUpdatesFromBirths(
  animals: Animal[],
  breedingEvents: BreedingEvent[]
): BreedingEvent[] {
  const byBreedingId = new Map<string, BreedingEvent>();

  for (const kid of animals) {
    if (!kid.home_bred || !kid.dam_id || !kid.date_of_purchase) continue;
    const breeding = findActiveBreedingForDam(breedingEvents, kid.dam_id, {
      sireId: kid.sire_id,
      sireName: kid.sire_name,
    });
    if (!breeding) continue;
    if (breeding.date_crossed && kid.date_of_purchase < breeding.date_crossed) continue;

    const birthDate = kid.date_of_purchase.slice(0, 10);
    const prev = byBreedingId.get(breeding.id);
    if (!prev) {
      byBreedingId.set(breeding.id, resolveBreedingAfterBirth(breeding, birthDate));
      continue;
    }
    const prevDate = prev.delivered_date ?? birthDate;
    if (birthDate < prevDate) {
      byBreedingId.set(breeding.id, resolveBreedingAfterBirth(breeding, birthDate));
    }
  }

  return [...byBreedingId.values()];
}

/** Doe is available to breed again (no active pregnancy on this record). */
export function isDoeBreedingReady(
  event: BreedingEvent | null,
  today: string = todayIso()
): boolean {
  if (!event) return true;
  if (event.outcome === "Miscarriage") return true;
  if (event.ultrasound_date && event.fetus_count === 0) return true;
  if (event.outcome === "Delivered" && !isRecentDelivery(event, today)) return true;
  return false;
}

/** Active pregnancy / not yet closed out — matches Goats "Breeding" filter. */
export function isBreedingInPipeline(event: BreedingEvent): boolean {
  if (event.outcome === "Delivered" || event.outcome === "Stillbirth" || event.outcome === "Miscarriage") {
    return false;
  }
  if (event.ultrasound_date && event.fetus_count === 0) return false;
  return event.outcome === "Pending" || event.outcome === "Doubt" || event.status === "Doubt";
}

export function femalesInBreedingPipeline(events: BreedingEvent[]): Set<number> {
  const ids = new Set<number>();
  for (const e of events) {
    if (isBreedingInPipeline(e)) ids.add(e.female_animal_id);
  }
  return ids;
}

/** Secondary date line for breeding rows (delivery, loss, or expected due). */
export type BreedingTimeline =
  | { type: "delivered"; date: string }
  | { type: "stillbirth"; date: string }
  | { type: "due"; date: string; daysUntilDue: number | null };

export function breedingTimeline(
  event: BreedingEvent,
  daysUntilDue?: number | null,
  today: string = todayIso()
): BreedingTimeline | null {
  if (event.outcome === "Delivered") {
    if (!isRecentDelivery(event, today)) return null;
    const date = event.delivered_date ?? event.expected_due_date;
    return date ? { type: "delivered", date } : null;
  }
  if (event.outcome === "Stillbirth") {
    const date = event.delivered_date;
    return date ? { type: "stillbirth", date } : null;
  }
  if (!isBreedingInPipeline(event)) return null;
  if (event.expected_due_date) {
    return { type: "due", date: event.expected_due_date, daysUntilDue: daysUntilDue ?? null };
  }
  return null;
}

export function expectedDueDate(dateCrossed: string): string {
  const d = new Date(dateCrossed.slice(0, 10));
  d.setUTCDate(d.getUTCDate() + GESTATION_DAYS);
  return d.toISOString().slice(0, 10);
}

export function assertFemaleAvailableForBreeding(
  events: BreedingEvent[],
  femaleId: number,
  excludeEventId?: string
): void {
  const conflict = events.find(
    (e) =>
      e.female_animal_id === femaleId &&
      e.id !== excludeEventId &&
      isBreedingInPipeline(e)
  );
  if (conflict) {
    throw new Error(
      "This doe already has an active breeding record. Update it or mark it delivered/lost before logging a new one."
    );
  }
}
