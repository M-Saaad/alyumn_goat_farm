import { animalLabel } from "../labels";
import { todayIso } from "../format";
import type { Animal, AnimalStatus } from "../types";
import { isKidAnimal } from "./age";

const TERMINAL_STATUSES: AnimalStatus[] = ["Sold", "Died", "Slaughtered", "Gone"];

export type HeadcountCategory = "breedingFemales" | "kids" | "others";

export type HeadcountBucket = {
  breedingFemales: number;
  kids: number;
  others: number;
  total: number;
  breedingFemaleLabels: string[];
  kidLabels: string[];
  otherLabels: string[];
};

export type PeriodHeadcount = {
  startDate: string;
  endDate: string;
  start: HeadcountBucket;
  end: HeadcountBucket;
};

/** Active on date: entered on or before date and still on farm that day. */
export function isActiveOnDate(
  animal: Pick<Animal, "date_of_purchase" | "status" | "out_date">,
  date: string
): boolean {
  const iso = date.trim().slice(0, 10);
  const entry = animal.date_of_purchase?.trim().slice(0, 10);
  if (!entry || entry > iso) return false;
  if (animal.status === "Active") return true;
  if (!TERMINAL_STATUSES.includes(animal.status)) return false;
  const out = animal.out_date?.trim().slice(0, 10);
  if (!out) return false;
  return out > iso;
}

export function classifyActiveAnimal(
  animal: Animal,
  date: string
): HeadcountCategory | null {
  if (!isActiveOnDate(animal, date)) return null;
  if (isKidAnimal(animal, date)) return "kids";
  if (animal.sex === "Female") return "breedingFemales";
  return "others";
}

function emptyBucket(): HeadcountBucket {
  return {
    breedingFemales: 0,
    kids: 0,
    others: 0,
    total: 0,
    breedingFemaleLabels: [],
    kidLabels: [],
    otherLabels: [],
  };
}

function bucketForDate(animals: Animal[], date: string): HeadcountBucket {
  const bucket = emptyBucket();
  const breedingFemaleLabels: string[] = [];
  const kidLabels: string[] = [];
  const otherLabels: string[] = [];

  for (const animal of animals) {
    const category = classifyActiveAnimal(animal, date);
    if (!category) continue;
    const label = animalLabel(animal);
    if (category === "breedingFemales") {
      bucket.breedingFemales++;
      breedingFemaleLabels.push(label);
    } else if (category === "kids") {
      bucket.kids++;
      kidLabels.push(label);
    } else {
      bucket.others++;
      otherLabels.push(label);
    }
  }

  bucket.breedingFemaleLabels = breedingFemaleLabels.sort((a, b) => a.localeCompare(b));
  bucket.kidLabels = kidLabels.sort((a, b) => a.localeCompare(b));
  bucket.otherLabels = otherLabels.sort((a, b) => a.localeCompare(b));
  bucket.total = bucket.breedingFemales + bucket.kids + bucket.others;
  return bucket;
}

export function computePeriodHeadcount(
  animals: Animal[],
  startDate: string,
  endDate: string
): PeriodHeadcount {
  const start = startDate.trim().slice(0, 10);
  const today = todayIso();
  const endRaw = endDate.trim().slice(0, 10);
  const end = endRaw > today ? today : endRaw;
  return {
    startDate: start,
    endDate: end,
    start: bucketForDate(animals, start),
    end: bucketForDate(animals, end),
  };
}

export function lastDayOfMonth(month: string): string {
  const ym = month.trim().slice(0, 7);
  const [year, monthNum] = ym.split("-").map(Number);
  const last = new Date(year, monthNum, 0);
  const day = String(last.getDate()).padStart(2, "0");
  const m = String(monthNum).padStart(2, "0");
  return `${year}-${m}-${day}`;
}
