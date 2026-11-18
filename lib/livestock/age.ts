import type { Animal, AnimalStatus } from "@/lib/types";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.437;

/** Goats under 12 months are treated as kids for breeding views. */
export const KID_MAX_MONTHS = 12;

export type ParsedAgeAtAcquisition = {
  months: number;
  kind: "months" | "teeth" | "days" | "zero" | "unknown";
};

export type AnimalAgeEstimate = {
  /** e.g. "2 years 3 months" */
  label: string;
  months: number;
  teethLabel: string;
  teeth: number;
  asOf: string;
};

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim().slice(0, 10));
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function elapsedMonths(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return 0;
  return (to.getTime() - from.getTime()) / MS_PER_MONTH;
}

/** Parse free-text age strings from Notion / manual entry. */
export function parseAgeAtAcquisition(text: string | null | undefined): ParsedAgeAtAcquisition | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower === "0" || lower === "0 day" || lower === "0 days") {
    return { months: 0, kind: "zero" };
  }

  const almostTeeth = /almost\s+(\d+)\s*teeth/i.exec(raw);
  if (almostTeeth) {
    const n = Number(almostTeeth[1]);
    return { months: teethToMonths(n - 0.5), kind: "teeth" };
  }

  const teethRange = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*teeth/i.exec(raw);
  if (teethRange) {
    const low = Number(teethRange[1]);
    const high = Number(teethRange[2]);
    return { months: (teethToMonths(low) + teethToMonths(high)) / 2, kind: "teeth" };
  }

  const teeth = /(\d+(?:\.\d+)?)\s*teeth/i.exec(raw);
  if (teeth) {
    return { months: teethToMonths(Number(teeth[1])), kind: "teeth" };
  }

  const monthRange = /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*months?/i.exec(raw);
  if (monthRange) {
    return {
      months: (Number(monthRange[1]) + Number(monthRange[2])) / 2,
      kind: "months",
    };
  }

  const months = /(\d+(?:\.\d+)?)\s*months?/i.exec(raw);
  if (months) {
    return { months: Number(months[1]), kind: "months" };
  }

  const days = /(\d+(?:\.\d+)?)\s*days?/i.exec(raw);
  if (days) {
    return { months: Number(days[1]) / 30.437, kind: "days" };
  }

  return { months: 0, kind: "unknown" };
}

/** Midpoint month estimate for a teeth count used in Pakistani goat trading. */
export function teethToMonths(teeth: number): number {
  if (teeth <= 0) return 6;
  if (teeth <= 2) return 15;
  if (teeth <= 4) return 21;
  if (teeth <= 6) return 27;
  return 33;
}

/** Estimate permanent incisor count from age in months. */
export function monthsToTeeth(months: number): { teeth: number; label: string } {
  if (months < 12) return { teeth: 0, label: "0 teeth" };
  if (months < 18) return { teeth: 2, label: "2 teeth" };
  if (months < 24) return { teeth: 4, label: "4 teeth" };
  if (months < 30) return { teeth: 6, label: "6 teeth" };
  if (months < 33) return { teeth: 8, label: "Almost 8 teeth" };
  return { teeth: 8, label: "8 teeth" };
}

export function formatAgeMonths(months: number): string {
  const rounded = Math.max(0, months);
  if (rounded < 12) {
    const m = Math.round(rounded * 10) / 10;
    const whole = Math.round(m);
    if (Math.abs(m - whole) < 0.05) return `${whole} month${whole === 1 ? "" : "s"}`;
    return `${m} months`;
  }
  const years = Math.floor(rounded / 12);
  const rem = Math.round(rounded % 12);
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${rem} month${rem === 1 ? "" : "s"}`;
}

function referenceDateForAnimal(
  animal: Pick<Animal, "status" | "out_date">,
  asOf: string
): string {
  const terminal: AnimalStatus[] = ["Sold", "Died", "Slaughtered", "Gone"];
  if (terminal.includes(animal.status) && animal.out_date) {
    return animal.out_date.slice(0, 10);
  }
  return asOf.slice(0, 10);
}

export function estimateAnimalAge(
  animal: Pick<Animal, "date_of_purchase" | "age_at_purchase" | "out_date" | "status">,
  asOf: string
): AnimalAgeEstimate | null {
  const acquisition = animal.date_of_purchase?.trim().slice(0, 10);
  if (!acquisition) return null;

  const reference = referenceDateForAnimal(animal, asOf);
  const parsed = parseAgeAtAcquisition(animal.age_at_purchase);
  const startMonths = parsed?.months ?? 0;
  const totalMonths = Math.max(0, startMonths + elapsedMonths(acquisition, reference));
  const teeth = monthsToTeeth(totalMonths);

  return {
    label: formatAgeMonths(totalMonths),
    months: totalMonths,
    teethLabel: teeth.label,
    teeth: teeth.teeth,
    asOf: reference,
  };
}

export const AGE_AT_PURCHASE_UNITS = ["months", "days", "teeth"] as const;

export type AgeAtPurchaseUnit = (typeof AGE_AT_PURCHASE_UNITS)[number];

function roundAgeQuantity(amount: number): number {
  return Math.round(amount * 1000) / 1000;
}

/** Turn a Buy Goat age entry into the free-text `age_at_purchase` the estimator parses. */
export function formatAgeAtPurchase(amount: number, unit: AgeAtPurchaseUnit): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Age at purchase cannot be negative");
  }

  const rounded = roundAgeQuantity(amount);

  switch (unit) {
    case "months": {
      if (rounded === 0) return "0";
      const label = rounded === 1 ? "month" : "months";
      return `${rounded} ${label}`;
    }
    case "days": {
      if (rounded === 0) return "0";
      const label = rounded === 1 ? "day" : "days";
      return `${rounded} ${label}`;
    }
    case "teeth": {
      if (!Number.isInteger(rounded) || rounded > 8) {
        throw new Error("Teeth must be a whole number from 0 to 8");
      }
      return `${rounded} teeth`;
    }
    default: {
      const unknown: never = unit;
      throw new Error(`Unknown age unit: ${String(unknown)}`);
    }
  }
}

/** Blank amount means age unknown. A filled amount is stored as months, days, or teeth. */
export function parseAgeAtPurchaseForm(
  amountRaw: string | null | undefined,
  unitRaw: string | null | undefined
): string | null {
  const trimmed = String(amountRaw ?? "").trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Age at purchase cannot be negative");
  }

  const unit = String(unitRaw ?? "")
    .trim()
    .toLowerCase();
  if (!isAgeAtPurchaseUnit(unit)) {
    throw new Error("Age at purchase unit must be months, days, or teeth");
  }

  return formatAgeAtPurchase(amount, unit);
}

function isAgeAtPurchaseUnit(value: string): value is AgeAtPurchaseUnit {
  return (AGE_AT_PURCHASE_UNITS as readonly string[]).includes(value);
}

export function isKidAnimal(
  animal: Pick<Animal, "date_of_purchase" | "age_at_purchase" | "out_date" | "status" | "sex">,
  asOf: string
): boolean {
  const age = estimateAnimalAge(animal, asOf);
  if (age) return age.months < KID_MAX_MONTHS;
  const parsed = parseAgeAtAcquisition(animal.age_at_purchase);
  if (parsed?.kind === "zero") return true;
  if (parsed && parsed.months < KID_MAX_MONTHS) return true;
  return false;
}
