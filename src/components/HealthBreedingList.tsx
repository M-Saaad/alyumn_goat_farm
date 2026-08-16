"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { animalLinkFromHealth } from "@/lib/livestock/health-nav";
import { isBreedingInPipeline } from "@/lib/livestock/breeding";
import type { BreedingRow } from "@/lib/livestock/herd-health";
import { UltrasoundStatusLine } from "@/components/UltrasoundStatusLine";
import { RecordUltrasoundForm, type UltrasoundTarget } from "@/components/RecordUltrasoundForm";

function statusBadge(
  status: "overdue" | "due_soon" | "pending" | "completed" | undefined
) {
  const key = status ?? "completed";
  const styles: Record<string, string> = {
    overdue: "bg-red-100 text-red-800",
    due_soon: "bg-amber-100 text-amber-900",
    pending: "bg-sky-100 text-sky-800",
    completed: "bg-stone-100 text-stone-600",
  };
  const labels: Record<string, string> = {
    overdue: "Overdue",
    due_soon: "Due soon",
    pending: "Pending",
    completed: "Done",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[key] ?? styles.completed}`}>
      {labels[key] ?? "—"}
    </span>
  );
}

export function HealthBreedingList({
  rows,
  supabaseEnabled,
}: {
  rows: BreedingRow[];
  supabaseEnabled: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showForm, setShowForm] = useState(false);

  const recordableRows = useMemo(
    () => rows.filter((b) => isBreedingInPipeline(b.event) && Boolean(b.event.date_crossed)),
    [rows]
  );

  const eligibleTargets: UltrasoundTarget[] = useMemo(
    () =>
      recordableRows.map((b) => ({
        breedingId: b.event.id,
        femaleId: b.event.female_animal_id,
        label: b.femaleLabel,
      })),
    [recordableRows]
  );

  const selectedTargets = eligibleTargets.filter((t) => selectedIds.has(t.breedingId));

  function toggleSelected(breedingId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(breedingId)) next.delete(breedingId);
      else next.add(breedingId);
      return next;
    });
  }

  function openFormFor(ids: string[]) {
    setSelectedIds(new Set(ids));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setSelectedIds(new Set());
  }

  if (rows.length === 0) {
    return <p className="text-sm text-stone-500">No active goats.</p>;
  }

  return (
    <div>
      {recordableRows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openFormFor(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {selectedIds.size > 0
              ? `Record ultrasound (${selectedIds.size} selected)`
              : "Record ultrasound"}
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-sm font-semibold text-stone-600"
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {showForm && selectedTargets.length > 0 && (
        <RecordUltrasoundForm
          eligible={eligibleTargets}
          defaultSelectedBreedingIds={Array.from(selectedIds)}
          defaultUltrasoundDate={null}
          defaultFetusCount={null}
          supabaseEnabled={supabaseEnabled}
          onDone={closeForm}
        />
      )}

      <ul className="divide-y divide-stone-100">
        {rows.map((b) => {
          const canRecord =
            isBreedingInPipeline(b.event) && Boolean(b.event.date_crossed);
          const showUltrasound =
            canRecord || b.ultrasoundStatus === "confirmed";

          return (
            <li key={b.event.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    {canRecord && (
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                        checked={selectedIds.has(b.event.id)}
                        onChange={() => toggleSelected(b.event.id)}
                        aria-label={`Select ${b.femaleLabel}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={animalLinkFromHealth(b.event.female_animal_id, "breeding")}
                        className="font-semibold text-stone-900 hover:text-emerald-800"
                      >
                        {b.femaleLabel}
                      </Link>
                      <p className="text-sm text-stone-600">
                        {b.event.buck_name || "Unknown buck"} · crossed{" "}
                        {formatDate(b.event.date_crossed)}
                      </p>
                      {b.event.expected_due_date && (
                        <p className="text-sm text-stone-500">
                          Due {formatDate(b.event.expected_due_date)}
                          {b.daysUntilDue != null && b.status !== "completed" && (
                            <span>
                              {" "}
                              · {b.daysUntilDue < 0 ? `${Math.abs(b.daysUntilDue)}d overdue` : `${b.daysUntilDue}d left`}
                            </span>
                          )}
                        </p>
                      )}
                      {showUltrasound && (
                        <UltrasoundStatusLine
                          ultrasoundStatus={b.ultrasoundStatus}
                          ultrasoundDate={b.event.ultrasound_date}
                          fetusCount={b.event.fetus_count}
                          daysSinceCrossed={b.daysSinceCrossed}
                          showWhenIdle={canRecord}
                        />
                      )}
                      {canRecord && (
                        <button
                          type="button"
                          onClick={() => openFormFor([b.event.id])}
                          className="mt-1 text-xs font-semibold text-emerald-700"
                        >
                          Record ultrasound
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {statusBadge(b.status)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
