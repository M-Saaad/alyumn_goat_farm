import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { CustomCategory, LedgerCategory } from "@/lib/types";

export const NEW_EXPENSE_CATEGORY_VALUE = "__new_expense_category__";

const BUILTIN_EXPENSE_SET = new Set<string>(EXPENSE_CATEGORIES);

export function isBuiltinExpenseCategory(name: string): boolean {
  return BUILTIN_EXPENSE_SET.has(name);
}

export function findCustomCategoryByName(
  custom: CustomCategory[],
  name: string
): CustomCategory | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return custom.find((c) => c.name.toLowerCase() === lower) ?? null;
}

/** Built-in expense categories plus user-defined ones (sorted, deduped). */
export function mergeExpenseCategories(custom: CustomCategory[]): string[] {
  const names = new Set<string>(EXPENSE_CATEGORIES);
  for (const c of custom) {
    const trimmed = c.name.trim();
    if (trimmed && !isBuiltinExpenseCategory(trimmed)) {
      names.add(trimmed);
    }
  }
  const customOnly = [...names].filter((n) => !isBuiltinExpenseCategory(n)).sort((a, b) => a.localeCompare(b));
  const builtIn = EXPENSE_CATEGORIES.filter((c) => c !== "Other");
  return [...builtIn, ...customOnly, "Other"];
}

/** Display order for finance breakdown — custom categories before Other. */
export function investedCategoryOrder(custom: CustomCategory[]): LedgerCategory[] {
  const merged = mergeExpenseCategories(custom);
  return merged.filter((c) => c !== "Livestock Sale" && c !== "Palai Income" && c !== "Partner Transfer") as LedgerCategory[];
}

export function isValidExpenseCategory(name: string, custom: CustomCategory[]): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (isBuiltinExpenseCategory(trimmed)) return true;
  return Boolean(findCustomCategoryByName(custom, trimmed));
}

export function assertNewCategoryName(name: string, custom: CustomCategory[]): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Enter a category name");
  if (isBuiltinExpenseCategory(trimmed)) {
    throw new Error(`"${trimmed}" is already a standard category`);
  }
  if (findCustomCategoryByName(custom, trimmed)) {
    throw new Error(`"${trimmed}" already exists`);
  }
  return trimmed;
}
