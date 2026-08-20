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

export type HeadcountAverages = {
  breedingFemales: number;
  kids: number;
  others: number;
  total: number;
  dayCount: number;
};

export type PeriodHeadcount = {
  startDate: string;
  endDate: string;
  start: HeadcountBucket;
  end: HeadcountBucket;
  average: HeadcountAverages;
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

function parseIsoDateParts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startParts = parseIsoDateParts(start);
  const endParts = parseIsoDateParts(end);
  const cursor = new Date(startParts.year, startParts.month - 1, startParts.day);
  const endDate = new Date(endParts.year, endParts.month - 1, endParts.day);
  while (cursor <= endDate) {
    dates.push(
      formatIsoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function roundAverage(value: number): number {
  return Math.round(value * 10) / 10;
}

function averagesForPeriod(animals: Animal[], start: string, end: string): HeadcountAverages {
  const dates = eachDateInRange(start, end);
  if (dates.length === 0) {
    return { breedingFemales: 0, kids: 0, others: 0, total: 0, dayCount: 0 };
  }

  let breedingFemales = 0;
  let kids = 0;
  let others = 0;
  let total = 0;

  for (const date of dates) {
    const bucket = bucketForDate(animals, date);
    breedingFemales += bucket.breedingFemales;
    kids += bucket.kids;
    others += bucket.others;
    total += bucket.total;
  }

  const dayCount = dates.length;
  return {
    breedingFemales: roundAverage(breedingFemales / dayCount),
    kids: roundAverage(kids / dayCount),
    others: roundAverage(others / dayCount),
    total: roundAverage(total / dayCount),
    dayCount,
  };
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
    average: averagesForPeriod(animals, start, end),
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
