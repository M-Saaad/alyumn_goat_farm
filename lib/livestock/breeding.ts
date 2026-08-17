import type { BreedingEvent, BreedingOutcome, BreedingStatus } from "../types";

export const GESTATION_DAYS = 150;
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
  if (fetusCount === 0) return `Not pregnant · ${datePart}`;
  if (fetusCount != null && fetusCount > 0) {
    return `Confirmed · ${formatKidCount(fetusCount)} · ${datePart}`;
  }
  return datePart;
}

/** Short label for breeding rows after ultrasound (animal profile, lists). */
export function breedingRecordStatusLabel(event: BreedingEvent): string {
  if (event.ultrasound_date) {
    if (event.fetus_count != null && event.fetus_count > 0) return "Confirmed";
    if (event.fetus_count === 0) return "Not pregnant";
  }
  return event.status || event.outcome;
}

/** Update breeding status/outcome when an ultrasound result is saved. */
export function resolveBreedingAfterUltrasound(
  existing: BreedingEvent,
  fetusCount: number | null | undefined
): { status: BreedingStatus | null; outcome: BreedingOutcome } {
  if (fetusCount === 0) {
    return { status: null, outcome: "Miscarriage" };
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

export function hasDefinitiveUltrasoundResult(event: BreedingEvent): boolean {
  return Boolean(event.ultrasound_date && event.fetus_count != null);
}

/** Active pregnancy / not yet closed out — matches Goats "Breeding" filter. */
export function isBreedingInPipeline(event: BreedingEvent): boolean {
  if (event.outcome === "Delivered" || event.outcome === "Stillbirth" || event.outcome === "Miscarriage") {
    return false;
  }
  return event.outcome === "Pending" || event.outcome === "Doubt" || event.status === "Doubt";
}

export function femalesInBreedingPipeline(events: BreedingEvent[]): Set<number> {
  const ids = new Set<number>();
  for (const e of events) {
    if (isBreedingInPipeline(e)) ids.add(e.female_animal_id);
  }
  return ids;
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
