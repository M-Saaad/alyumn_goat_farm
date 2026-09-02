"use client";

import { actionAddCustomCategory, actionDeleteCustomCategory } from "@/lib/server-actions";
import type { CustomCategory } from "@/lib/types";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const label = "block text-sm font-medium text-stone-700";

export function CategoryManager({ customCategories }: { customCategories: CustomCategory[] }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-1 text-sm font-bold text-stone-800">Custom expense categories</h2>
      <p className="mb-3 text-xs text-stone-600">
        Add categories beyond Feed, Labor, Vet, etc. They appear in Log Expense and finance reports.
      </p>

      {customCategories.length > 0 && (
        <ul className="mb-3 space-y-2">
          {customCategories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 text-sm ring-1 ring-stone-100"
            >
              <span className="font-semibold text-stone-900">{category.name}</span>
              <ActionForm action={actionDeleteCustomCategory} className="shrink-0">
                <input type="hidden" name="id" value={category.id} />
                <button
                  type="submit"
                  className="text-xs font-semibold text-red-700 hover:text-red-800"
                >
                  Remove
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={actionAddCustomCategory}>
        <div>
          <label className={label}>Category name</label>
          <input
            name="name"
            className={field}
            required
            placeholder="e.g. Transport"
            autoComplete="off"
          />
        </div>
        <div className="mt-3">
          <SubmitButton label="Add category" />
        </div>
      </ActionForm>
    </section>
  );
}
