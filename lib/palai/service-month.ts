import type { FarmDatabase, PalaiPayment } from "../types";

const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

/** Normalize YYYY-MM or YYYY-MM-DD to YYYY-MM. */
export function normalizeServiceMonth(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})/.exec(trimmed);
  if (!match) throw new Error("Month must be YYYY-MM");
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Invalid month");
  return `${match[1]}-${match[2]}`;
}

export function currentServiceMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function formatServiceMonth(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const ym = normalizeServiceMonth(value);
  const [year, month] = ym.split("-").map(Number);
  const parsed = new Date(year, month - 1, 1);
  if (Number.isNaN(parsed.getTime())) return value;
  return monthLabel.format(parsed);
}

export function palaiServiceMonth(payment: PalaiPayment): string {
  return payment.service_month || payment.date.slice(0, 7);
}

export function buildPalaiNotes(input: {
  goatCount: number;
  ratePerGoat: number;
  totalAmount: number;
  serviceMonth: string;
  notes?: string | null;
}): string {
  if (input.notes?.trim()) return input.notes.trim();
  const month = formatServiceMonth(input.serviceMonth);
  return `Palai ${input.goatCount} goats @ ${input.ratePerGoat} = ${input.totalAmount} (${month}, 50/50 split)`;
}

export function findPalaiForCustomerMonth(
  db: FarmDatabase,
  customerId: string,
  serviceMonth: string,
  excludePaymentId?: string
): PalaiPayment | undefined {
  const month = normalizeServiceMonth(serviceMonth);
  return db.palai_payments.find(
    (p) =>
      p.customer_id === customerId &&
      palaiServiceMonth(p) === month &&
      p.id !== excludePaymentId
  );
}
