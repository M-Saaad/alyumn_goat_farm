"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { HEALTH_TABS } from "@/lib/livestock/health-tabs";

const tabLabels: Record<(typeof HEALTH_TABS)[number], string> = {
  overview: "Overview",
  breeding: "Breeding",
  vaccine: "Vaccine",
  deworm: "Deworm",
  weight: "Weight",
};

export function HealthFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("tab") || "overview";

  function setTab(id: string) {
    const params = new URLSearchParams(sp.toString());
    if (id === "overview") params.delete("tab");
    else params.set("tab", id);
    router.push(`/health?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {HEALTH_TABS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
            current === t ? "bg-emerald-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
          }`}
        >
          {tabLabels[t]}
        </button>
      ))}
    </div>
  );
}
