"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { animalLinkFromHealth } from "@/lib/livestock/health-nav";
import { isBreedingInPipeline, hasDefinitiveUltrasoundResult } from "@/lib/livestock/breeding";
import type { BreedingRow } from "@/lib/livestock/herd-health";
import { UltrasoundStatusLine } from "@/components/UltrasoundStatusLine";
import { RecordUltrasoundForm } from "@/components/RecordUltrasoundForm";

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
  const [recordingId, setRecordingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-stone-500">No active goats.</p>;
  }

  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((b) => {
        const canRecord =
          isBreedingInPipeline(b.event) &&
          Boolean(b.event.date_crossed) &&
          !hasDefinitiveUltrasoundResult(b.event);
        const showUltrasound =
          canRecord || b.ultrasoundStatus === "confirmed";

        return (
          <li key={b.event.id} className="py-3">
            <div className="flex items-start justify-between gap-2">
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
                {b.event.notes && (
                  <p className="mt-1 text-xs text-stone-500">{b.event.notes}</p>
                )}
                {canRecord && recordingId !== b.event.id && (
                  <button
                    type="button"
                    onClick={() => setRecordingId(b.event.id)}
                    className="mt-1 text-xs font-semibold text-emerald-700"
                  >
                    Record ultrasound
                  </button>
                )}
              </div>
              {statusBadge(b.status)}
            </div>
            {recordingId === b.event.id && (
              <RecordUltrasoundForm
                breedingId={b.event.id}
                femaleId={b.event.female_animal_id}
                defaultUltrasoundDate={b.event.ultrasound_date}
                defaultFetusCount={b.event.fetus_count}
                supabaseEnabled={supabaseEnabled}
                onDone={() => setRecordingId(null)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
