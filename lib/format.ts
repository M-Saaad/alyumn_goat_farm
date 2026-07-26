export function formatPkr(n: number): string {
  const rounded = Math.round(Number(n) || 0);
  const sign = rounded < 0 ? "-" : "";
  const abs = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}Rs ${abs}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
