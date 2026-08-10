import type { Animal } from "../types";
import { animalLabel } from "../labels";

/** One-time parent links for historical farm-born kids. */
export const BORN_KID_PARENT_BACKFILL: Record<
  number,
  { dam_id: number | null; sire_id: number | null; sire_name: string | null }
> = {
  8: { dam_id: 3, sire_id: null, sire_name: null },
  12: { dam_id: null, sire_id: null, sire_name: null },
  13: { dam_id: 1, sire_id: null, sire_name: null },
  14: { dam_id: 1, sire_id: null, sire_name: null },
  23: { dam_id: 16, sire_id: 47, sire_name: null },
  32: { dam_id: 22, sire_id: 47, sire_name: null },
  36: { dam_id: 20, sire_id: 9, sire_name: null },
  38: { dam_id: 3, sire_id: null, sire_name: null },
  39: { dam_id: 1, sire_id: null, sire_name: null },
  40: { dam_id: 25, sire_id: null, sire_name: null },
  41: { dam_id: 30, sire_id: 47, sire_name: null },
  44: { dam_id: 11, sire_id: null, sire_name: null },
  45: { dam_id: 33, sire_id: null, sire_name: null },
};

export function animalParentLabel(animals: Animal[], id: number | null): string {
  if (id == null) return "—";
  const a = animals.find((x) => x.id === id);
  return a ? animalLabel(a) : `#${id}`;
}

export function sireLabel(animal: Pick<Animal, "sire_id" | "sire_name">, animals: Animal[]): string {
  if (animal.sire_id != null) return animalParentLabel(animals, animal.sire_id);
  if (animal.sire_name?.trim()) return animal.sire_name.trim();
  return "—";
}
