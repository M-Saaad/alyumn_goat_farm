export const NON_NEGATIVE_NUMBER_INPUT_PROPS = {
  min: 0,
  step: "any" as const,
};

export const POSITIVE_INTEGER_INPUT_PROPS = {
  min: 1,
  step: 1 as const,
};

export const NON_NEGATIVE_INTEGER_INPUT_PROPS = {
  min: 0,
  step: 1 as const,
};

/** Parse form numbers with no negatives allowed. */

export function parsePositiveAmount(raw: string, label = "Amount"): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return n;
}

export function parseNonNegativeAmount(
  raw: string,
  label: string,
  defaultWhenEmpty?: number
): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (defaultWhenEmpty !== undefined) return defaultWhenEmpty;
    throw new Error(`${label} is required`);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  return n;
}

export function parseOptionalNonNegativeAmount(
  raw: string | null | undefined,
  label: string
): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  return n;
}

export function parsePositiveInteger(raw: string, label: string): number {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a whole number greater than zero`);
  }
  return n;
}

export function parseOptionalNonNegativeInteger(
  raw: string | null | undefined,
  label: string
): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a whole number (0 or greater)`);
  }
  return n;
}

export function parseOptionalPositiveAmount(
  raw: string | null | undefined,
  label: string
): number | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return n;
}
