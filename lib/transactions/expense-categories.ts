import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { LedgerCategory } from "@/lib/types";

export const NEW_EXPENSE_CATEGORY_VALUE = "__new_expense_category__";

const BUILTIN_EXPENSE_SET = new Set<string>(EXPENSE_CATEGORIES);

export function isBuiltinExpenseCategory(name: string): boolean {
  return BUILTIN_EXPENSE_SET.has(name);
}

/** User-entered category names already stored on transactions (not built-ins). */
export function extraCategoryNames(categories: Iterable<string>): string[] {
  const byLower = new Map<string, string>();
  for (const raw of categories) {
    const trimmed = raw.trim();
    if (!trimmed || isBuiltinExpenseCategory(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, trimmed);
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b));
}

/** Built-in expense categories plus names already used on transactions. */
export function mergeExpenseCategories(extraNames: Iterable<string> = []): string[] {
  const customOnly = extraCategoryNames(extraNames);
  const builtIn = EXPENSE_CATEGORIES.filter((c) => c !== "Other");
  return [...builtIn, ...customOnly, "Other"];
}

/** Display order for finance breakdown — extra categories before Other. */
export function investedCategoryOrder(extraNames: Iterable<string> = []): LedgerCategory[] {
  const merged = mergeExpenseCategories(extraNames);
  return merged.filter(
    (c) => c !== "Livestock Sale" && c !== "Palai Income" && c !== "Partner Transfer"
  ) as LedgerCategory[];
}

export function isValidExpenseCategory(name: string): boolean {
  return Boolean(name.trim());
}

export function assertNewCategoryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a category name");
  if (isBuiltinExpenseCategory(trimmed)) {
    throw new Error(`"${trimmed}" is already a standard category`);
  }
  return trimmed;
}
