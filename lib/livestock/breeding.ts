import type { BreedingEvent } from "../types";

export const GESTATION_DAYS = 150;

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
