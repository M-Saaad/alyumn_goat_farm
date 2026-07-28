import { Suspense } from "react";
import Link from "next/link";
import { animalLabel } from "@/lib/labels";
import { loadAnimalsListData, contactNameFrom } from "@/lib/db/queries";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { AnimalsFilters } from "@/components/AnimalsFilters";

export const dynamic = "force-dynamic";

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const data = await loadAnimalsListData();
  const q = (sp.q || "").toLowerCase();
  const filter = sp.filter || "all";

  let animals = [...data.animals];
  if (filter === "active") animals = animals.filter((a) => a.status === "Active");
  if (filter === "palai") {
    const farmId = data.contacts.find((c) => c.name === "Farm")?.id;
    animals = animals.filter((a) => a.owner_id && a.owner_id !== farmId && a.status === "Active");
  }
  if (filter === "breeding") {
    const femaleIds = new Set(
      data.breeding_events
        .filter((b) => b.outcome === "Pending" || b.status === "Doubt")
        .map((b) => b.female_animal_id)
    );
    animals = animals.filter((a) => femaleIds.has(a.id));
  }
  if (q) {
    animals = animals.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        String(a.id).includes(q)
    );
  }

  animals.sort((a, b) => {
    if (a.status === "Active" && b.status !== "Active") return -1;
    if (b.status === "Active" && a.status !== "Active") return 1;
    return animalLabel(a).localeCompare(animalLabel(b));
  });

  const statusColor: Record<string, string> = {
    Active: "bg-emerald-100 text-emerald-800",
    Died: "bg-stone-200 text-stone-600",
    Sold: "bg-sky-100 text-sky-800",
    Slaughtered: "bg-orange-100 text-orange-800",
    Gone: "bg-stone-200 text-stone-500",
  };

  return (
    <main className="px-4 pt-6">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Livestock</p>
        <h1 className="text-2xl font-bold">Goats ({animals.length})</h1>
      </header>

      <Suspense fallback={<div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />}>
        <AnimalsFilters />
      </Suspense>

      <ul className="space-y-2">
        {animals.map((a) => (
          <li key={a.id}>
            <Link
              href={`/animals/${a.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">{animalLabel(a)}</p>
                  <p className="text-sm text-stone-500">
                    {[a.breed, a.sex, contactNameFrom(data.contacts, a.owner_id)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[a.status]}`}>
                  {a.status}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <QuickEntryLoader {...data.quickEntry} />
      <BottomNav active="goats" />
    </main>
  );
}
