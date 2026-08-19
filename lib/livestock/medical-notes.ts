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

export function formatVaccineNotes(name: string, dosage: string): string {
  const n = name.trim();
  const d = dosage.trim();
  if (!n) throw new Error("Enter a vaccine name");
  if (!d) throw new Error("Enter vaccine dosage");
  return `${n} ${d}`;
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
