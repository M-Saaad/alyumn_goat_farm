"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const filters = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "breeding", label: "Breeding" },
  { id: "palai", label: "Palai" },
];

export function AnimalsFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("filter") || "all";
  const q = sp.get("q") || "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function setFilter(id: string) {
    const params = new URLSearchParams(sp.toString());
    if (id === "all") params.delete("filter");
    else params.set("filter", id);
    router.push(`/animals?${params.toString()}`);
  }

  function onSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.push(`/animals?${params.toString()}`);
    }, 300);
  }

  return (
    <div className="mb-4 space-y-2">
      <input
        type="search"
        placeholder="Search name or description…"
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
              current === f.id ? "bg-emerald-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
