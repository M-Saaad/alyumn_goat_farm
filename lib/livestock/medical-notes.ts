import { builtinVaccineByName, scheduleLabelFromDays } from "./vaccine-schedule";

export {
  BUILTIN_VACCINE_SCHEDULE,
  mergeVaccineSchedules,
  vaccineDisplayName,
  vaccineKeyFromNotes,
  vaccineKindFromNotes,
  type VaccineKind,
  type VaccineScheduleEntry,
} from "./vaccine-schedule";

export const DEWORM_TYPES = [
  { value: "internal", label: "Internal", prefix: "I-DW" },
  { value: "external", label: "External", prefix: "E-DW" },
] as const;
export type DewormType = (typeof DEWORM_TYPES)[number]["value"];

/** External deworming is due this many days after the latest internal deworming. */
export const EXTERNAL_DEWORM_DELAY_DAYS = 2;

export function dewormKindFromNotes(notes: string | null | undefined): DewormType | null {
  const text = (notes ?? "").trim();
  if (text.startsWith("I-DW") || text.includes("I-DW")) return "internal";
  if (text.startsWith("E-DW") || text.includes("E-DW")) return "external";
  return null;
}

/** Common dewormer product names used on this farm, by type. */
export const DEWORMER_NAMES_BY_TYPE: Record<DewormType, readonly string[]> = {
  internal: ["Deviser Plus", "Nilzan Plus", "Punch", "Thunder"],
  external: ["Unimec Plus"],
};

export const DEWORMER_NAMES = [
  ...DEWORMER_NAMES_BY_TYPE.internal,
  ...DEWORMER_NAMES_BY_TYPE.external,
] as const;

const DOSAGE_SUFFIX = /\s+\d+(?:\.\d+)?\s*ml\s*$/i;

export type DewormNoteEvent = {
  event_type: string;
  notes: string | null;
};

export function builtinDewormerByName(name: string, type: DewormType): string | null {
  const upper = name.trim().toUpperCase();
  const match = DEWORMER_NAMES_BY_TYPE[type].find((n) => n.toUpperCase() === upper);
  return match ?? null;
}

export function parseDewormNote(
  notes: string | null | undefined
): { type: DewormType; name: string } | null {
  const text = (notes ?? "").trim();
  const match = text.match(/^(I-DW|E-DW)\s+(.+)$/i);
  if (!match) return null;
  const type: DewormType = match[1].toUpperCase() === "I-DW" ? "internal" : "external";
  const name = match[2].replace(DOSAGE_SUFFIX, "").trim();
  if (!name) return null;
  return { type, name };
}

export function extraDewormerNamesFromEvents(
  events: DewormNoteEvent[],
  type: DewormType
): string[] {
  const byLower = new Map<string, string>();
  for (const event of events) {
    if (event.event_type !== "Deworming") continue;
    const parsed = parseDewormNote(event.notes);
    if (!parsed || parsed.type !== type) continue;
    if (builtinDewormerByName(parsed.name, type)) continue;
    const key = parsed.name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, parsed.name);
  }
  return [...byLower.values()];
}

export function mergeDewormerNames(extraNames: string[], type: DewormType): string[] {
  const builtins = [...DEWORMER_NAMES_BY_TYPE[type]];
  const builtinUpper = new Set(builtins.map((n) => n.toUpperCase()));
  const extras = extraNames
    .map((n) => n.trim())
    .filter((name) => name && !builtinUpper.has(name.toUpperCase()));
  const seen = new Set<string>(builtins.map((n) => n.toUpperCase()));
  const uniqueExtras: string[] = [];
  for (const name of extras) {
    const key = name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueExtras.push(name);
  }
  return [...builtins, ...uniqueExtras];
}

export function formatVaccineNotes(name: string, dosage: string, intervalDays?: number): string {
  const n = name.trim();
  const d = dosage.trim();
  if (!n) throw new Error("Enter a vaccine name");
  if (!d) throw new Error("Enter vaccine dosage");
  const base = `${n} ${d}`;
  if (intervalDays && !builtinVaccineByName(n)) {
    return `${base} · ${scheduleLabelFromDays(intervalDays)}`;
  }
  return base;
}

export function formatDewormNotes(input: {
  type: string;
  name: string;
  dosage: string;
}): string {
  const kind = DEWORM_TYPES.find((t) => t.value === input.type);
  if (!kind) throw new Error("Select internal or external deworming");
  const name = input.name.trim();
  const dosage = input.dosage.trim();
  if (!name) throw new Error("Enter dewormer name");
  if (!dosage) throw new Error("Enter dewormer dosage");
  return `${kind.prefix} ${name} ${dosage}`;
}
