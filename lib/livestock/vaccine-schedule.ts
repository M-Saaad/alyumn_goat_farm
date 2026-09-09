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
};

export type VaccineNoteEvent = {
  event_type: string;
  notes: string | null;
};

export const NEW_VACCINE_VALUE = "__new__";

const DOSAGE_SUFFIX = /\s+\d+(?:\.\d+)?\s*ml\s*$/i;
const SCHEDULE_SUFFIX =
  /\s·\s(once a year|twice a year|every (\d+) days)\s*$/i;

export function scheduleLabelFromDays(days: number): string {
  if (days === 365) return "once a year";
  if (days === 182) return "twice a year";
  return `every ${days} days`;
}

export function isBuiltinVaccineKey(key: string): boolean {
  return BUILTIN_VACCINE_SCHEDULE.some((b) => b.key === key);
}

export function vaccineKeyFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "vaccine";
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

function matchesBuiltinNotes(upper: string, key: BuiltinVaccineKey): boolean {
  if (key === "ppr") return upper.includes("PPR");
  if (key === "etv") return upper.includes("ETV");
  if (key === "nitroxinil") return upper.includes("NITROX") || upper.includes("LIVER VACCINE");
  return false;
}

function intervalFromScheduleLabel(label: string, everyDays?: string): number | null {
  const lower = label.toLowerCase();
  if (lower === "once a year") return 365;
  if (lower === "twice a year") return 182;
  if (everyDays) {
    const days = Number.parseInt(everyDays, 10);
    if (Number.isFinite(days) && days > 0) return days;
  }
  return null;
}

export function parseVaccineNote(notes: string | null | undefined): {
  name: string;
  dosage: string | null;
  intervalDays: number | null;
} | null {
  let text = (notes ?? "").trim();
  if (!text) return null;

  let intervalDays: number | null = null;
  const scheduleMatch = text.match(SCHEDULE_SUFFIX);
  if (scheduleMatch) {
    intervalDays = intervalFromScheduleLabel(scheduleMatch[1], scheduleMatch[2]);
    text = text.slice(0, scheduleMatch.index).trim();
  }

  const dosageMatch = text.match(DOSAGE_SUFFIX);
  const dosage = dosageMatch ? dosageMatch[0].trim() : null;
  const name = text.replace(DOSAGE_SUFFIX, "").trim() || text;
  if (!name) return null;
  return { name, dosage, intervalDays };
}

export type VaccineRecordMatch = {
  id: string;
  event_type: string;
  date: string | null;
  notes: string | null;
};

/** Other Vaccine rows logged the same day with the same notes (name + dosage + schedule). */
export function similarVaccineEvents<T extends VaccineRecordMatch>(
  events: T[],
  target: VaccineRecordMatch
): T[] {
  if (target.event_type !== "Vaccine") return [];
  const date = (target.date ?? "").slice(0, 10);
  const notes = target.notes ?? "";
  return events.filter(
    (event) =>
      event.id !== target.id &&
      event.event_type === "Vaccine" &&
      (event.date ?? "").slice(0, 10) === date &&
      (event.notes ?? "") === notes
  );
}

function extraVaccinesFromEvents(events: VaccineNoteEvent[]): VaccineScheduleEntry[] {
  const byKey = new Map<string, VaccineScheduleEntry>();
  for (const event of events) {
    if (event.event_type !== "Vaccine") continue;
    const parsed = parseVaccineNote(event.notes);
    if (!parsed) continue;
    if (builtinVaccineByName(parsed.name)) continue;
    const upper = parsed.name.toUpperCase();
    if (BUILTIN_VACCINE_SCHEDULE.some((b) => matchesBuiltinNotes(upper, b.key))) continue;

    const key = vaccineKeyFromName(parsed.name);
    if (isBuiltinVaccineKey(key)) continue;
    const intervalDays = parsed.intervalDays ?? byKey.get(key)?.intervalDays ?? 365;
    byKey.set(key, {
      key,
      name: byKey.get(key)?.name ?? parsed.name,
      scheduleLabel: scheduleLabelFromDays(intervalDays),
      intervalDays,
    });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function mergeVaccineSchedules(events: VaccineNoteEvent[] = []): VaccineScheduleEntry[] {
  const builtins: VaccineScheduleEntry[] = BUILTIN_VACCINE_SCHEDULE.map((v) => ({
    key: v.key,
    name: v.name,
    scheduleLabel: v.scheduleLabel,
    intervalDays: v.intervalDays,
  }));
  return [...builtins, ...extraVaccinesFromEvents(events)];
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
      isBuiltinVaccineKey(schedule.key) &&
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
