/** Client-safe ledger category constants (no Node deps). */
export const LEDGER_CATEGORIES = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Livestock Purchase",
  "Livestock Sale",
  "Palai Income",
  "Palai Expense",
  "Partner Transfer",
  "Other",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

/** Categories available in Log Expense quick entry and expense transaction edits. */
export const EXPENSE_CATEGORIES = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Palai Expense",
  "Other",
] as const satisfies readonly LedgerCategory[];

export const CATEGORY_DISPLAY_ORDER: LedgerCategory[] = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Livestock Purchase",
  "Livestock Sale",
  "Palai Income",
  "Palai Expense",
  "Partner Transfer",
  "Other",
];

/** URL-safe slug ↔ category (handles `/` and spaces). */
export function categoryToSlug(category: string): string {
  return category.toLowerCase().replace(/\//g, "-").replace(/\s+/g, "-");
}

export function slugToCategory(slug: string): LedgerCategory | null {
  const found = LEDGER_CATEGORIES.find((c) => categoryToSlug(c) === slug);
  return found ?? null;
}
