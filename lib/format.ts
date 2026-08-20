export function formatPkr(n: number): string {
  const rounded = Math.round(Number(n) || 0);
  const sign = rounded < 0 ? "-" : "";
  const abs = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}Rs ${abs}`;
}

const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Display an ISO date (YYYY-MM-DD) as e.g. "28 July 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const iso = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return value;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return value;
  return displayDateFormatter.format(parsed);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

/** First day of the month spanning `monthCount` calendar months ending on `endIso`. */
export function startDateForMonthSpan(endIso: string, monthCount: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endIso.trim().slice(0, 10));
  if (!match || monthCount < 1) return endIso.slice(0, 10);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(year, month - monthCount, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
