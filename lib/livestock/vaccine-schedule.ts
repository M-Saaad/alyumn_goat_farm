import type { CustomVaccine } from "@/lib/types";

export const VACCINE_INTERVAL_PRESETS = [
  { value: 365, label: "Once a year" },
  { value: 182, label: "Twice a year" },
] as const;

export const BUILTIN_VACCINE_SCHEDULE = [
  { key: "ppr", name: "PPR", scheduleLabel: "once a year", intervalDays: 365 },
  { key: "etv", name: "ETV", scheduleLabel: "twice a year", intervalDays: 182 },
  { key: "nitroxinil", name: "Nitroxinil", scheduleLabel: "once a year", intervalDays: 365 },
] as const;

export type BuiltinVaccineKey = (typeof BUILTIN_VACCINE_SCHEDULE)[number]["key"];
export type VaccineKind = BuiltinVaccineKey | (string & {});

export type VaccineScheduleEntry = {
  key: string;
  name: string;
  scheduleLabel: string;
  intervalDays: number;
  custom?: boolean;
};

export const NEW_VACCINE_VALUE = "__new__";

export function scheduleLabelFromDays(days: number): string {
  if (days === 365) return "once a year";
  if (days === 182) return "twice a year";
  return `every ${days} days`;
}

export function mergeVaccineSchedules(custom: CustomVaccine[]): VaccineScheduleEntry[] {
  const builtins: VaccineScheduleEntry[] = BUILTIN_VACCINE_SCHEDULE.map((v) => ({
    key: v.key,
    name: v.name,
    scheduleLabel: v.scheduleLabel,
    intervalDays: v.intervalDays,
  }));
  const customs: VaccineScheduleEntry[] = custom.map((v) => ({
    key: v.id,
    name: v.name,
    scheduleLabel: scheduleLabelFromDays(v.interval_days),
    intervalDays: v.interval_days,
    custom: true,
  }));
  return [...builtins, ...customs];
}

export function builtinVaccineByName(name: string): VaccineScheduleEntry | null {
  const upper = name.trim().toUpperCase();
  const match = BUILTIN_VACCINE_SCHEDULE.find((v) => v.name.toUpperCase() === upper);
  if (!match) return null;
  return {
    key: match.key,
    name: match.name,
    scheduleLabel: match.scheduleLabel,
    intervalDays: match.intervalDays,
  };
}

export function findCustomVaccineByName(
  custom: CustomVaccine[],
  name: string
): CustomVaccine | null {
  const upper = name.trim().toUpperCase();
  return custom.find((v) => v.name.toUpperCase() === upper) ?? null;
}

function matchesBuiltinNotes(upper: string, key: BuiltinVaccineKey): boolean {
  if (key === "ppr") return upper.includes("PPR");
  if (key === "etv") return upper.includes("ETV");
  if (key === "nitroxinil") return upper.includes("NITROX") || upper.includes("LIVER VACCINE");
  return false;
}

export function vaccineKeyFromNotes(
  notes: string | null | undefined,
  schedules: VaccineScheduleEntry[]
): string | null {
  const text = (notes ?? "").trim();
  if (!text) return null;
  const upper = text.toUpperCase();

  for (const schedule of schedules) {
    if (
      BUILTIN_VACCINE_SCHEDULE.some((b) => b.key === schedule.key) &&
      matchesBuiltinNotes(upper, schedule.key as BuiltinVaccineKey)
    ) {
      return schedule.key;
    }
  }

  const sorted = [...schedules].sort((a, b) => b.name.length - a.name.length);
  for (const schedule of sorted) {
    const nameUpper = schedule.name.toUpperCase();
    if (upper.startsWith(`${nameUpper} `) || upper === nameUpper) return schedule.key;
  }
  return null;
}

/** @deprecated Use vaccineKeyFromNotes with schedules */
export function vaccineKindFromNotes(notes: string | null | undefined): VaccineKind | null {
  return vaccineKeyFromNotes(notes, mergeVaccineSchedules([]));
}

export function vaccineDisplayName(
  key: string | null | undefined,
  schedules: VaccineScheduleEntry[]
): string {
  if (!key) return "Vaccine";
  return schedules.find((s) => s.key === key)?.name ?? "Vaccine";
}

export function parseVaccineIntervalDays(raw: string): number {
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Select a vaccine schedule");
  }
  return days;
}
