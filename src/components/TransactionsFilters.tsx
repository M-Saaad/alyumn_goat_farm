"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LEDGER_CATEGORIES, categoryToSlug } from "@/lib/constants";

const filters = [
  { id: "all", label: "All" },
  { id: "cost", label: "Cost" },
  { id: "adjustment", label: "Adjustment" },
  ...LEDGER_CATEGORIES.map((c) => ({ id: categoryToSlug(c), label: c })),
];

export function TransactionsFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = sp.get("filter") || "all";
  const q = sp.get("q") || "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/transactions?${qs}` : "/transactions");
    });
  }

  function setFilter(id: string) {
    const params = new URLSearchParams(sp.toString());
    if (id === "all") params.delete("filter");
    else params.set("filter", id);
    navigate(params);
  }

  function onSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      navigate(params);
    }, 300);
  }

  return (
    <div className={`mb-4 space-y-2 ${pending ? "opacity-70" : ""}`}>
      <input
        type="search"
        placeholder="Search notes or category…"
        defaultValue={q}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
              current === f.id
                ? "bg-emerald-700 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
