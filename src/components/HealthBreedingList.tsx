"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, todayIso } from "@/lib/format";
import { animalLinkFromHealth } from "@/lib/livestock/health-nav";
import { canRecordOrEditUltrasound, breedingTimeline } from "@/lib/livestock/breeding";
import type { BreedingRow } from "@/lib/livestock/herd-health";
import { UltrasoundStatusLine } from "@/components/UltrasoundStatusLine";
import { RecordUltrasoundForm } from "@/components/RecordUltrasoundForm";

function timelineText(
  timeline: ReturnType<typeof breedingTimeline>,
  formatDate: (iso: string) => string
): string | null {
  if (!timeline) return null;
  if (timeline.type === "delivered") return `Delivered ${formatDate(timeline.date)}`;
  if (timeline.type === "stillbirth") return `Stillbirth ${formatDate(timeline.date)}`;
  const due = `Due ${formatDate(timeline.date)}`;
  if (timeline.daysUntilDue == null) return due;
  if (timeline.daysUntilDue < 0) {
    return `${due} · ${Math.abs(timeline.daysUntilDue)}d overdue`;
  }
  return `${due} · ${timeline.daysUntilDue}d left`;
}

function statusBadge(
  status: BreedingRow["status"],
  label: string
) {
  const styles: Record<BreedingRow["status"], string> = {
    overdue: "bg-red-100 text-red-800",
    due_soon: "bg-amber-100 text-amber-900",
    pending: "bg-sky-100 text-sky-800",
    completed: "bg-stone-100 text-stone-600",
    ready: "bg-stone-100 text-stone-500",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {label}
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
    return <p className="text-sm text-stone-500">No adult females in the herd.</p>;
  }

  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((b) => {
        const event = b.event;
        const canUltrasound = event ? canRecordOrEditUltrasound(event) : false;
        const isEditing = Boolean(event?.ultrasound_date);
        const showUltrasound = event && (canUltrasound || b.ultrasoundStatus === "confirmed");
        const timeline = event ? breedingTimeline(event, b.daysUntilDue, todayIso()) : null;
        const dateLine = timelineText(timeline, formatDate);

        return (
          <li key={event?.id ?? `female-${b.femaleId}`} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={animalLinkFromHealth(b.femaleId, "breeding")}
                  className="font-semibold text-stone-900 hover:text-emerald-800"
                >
                  {b.femaleLabel}
                </Link>
                {event ? (
                  <p className="text-sm text-stone-600">
                    {event.buck_name || "Unknown buck"} · crossed{" "}
                    {formatDate(event.date_crossed)}
                  </p>
                ) : (
                  <p className="text-sm text-stone-600">Ready to breed</p>
                )}
                {dateLine && <p className="text-sm text-stone-500">{dateLine}</p>}
                {showUltrasound && event && (
                  <UltrasoundStatusLine
                    ultrasoundStatus={b.ultrasoundStatus}
                    ultrasoundDate={event.ultrasound_date}
                    fetusCount={event.fetus_count}
                    daysSinceCrossed={b.daysSinceCrossed}
                    showWhenIdle={canUltrasound && !isEditing}
                  />
                )}
                {event?.notes && (
                  <p className="mt-1 text-xs text-stone-500">{event.notes}</p>
                )}
                {canUltrasound && event && recordingId !== event.id && (
                  <button
                    type="button"
                    onClick={() => setRecordingId(event.id)}
                    className="mt-1 text-xs font-semibold text-emerald-700"
                  >
                    {isEditing ? "Edit ultrasound" : "Record ultrasound"}
                  </button>
                )}
              </div>
              {statusBadge(b.status, b.statusLabel)}
            </div>
            {event && recordingId === event.id && (
              <RecordUltrasoundForm
                breedingId={event.id}
                femaleId={b.femaleId}
                defaultUltrasoundDate={event.ultrasound_date}
                defaultFetusCount={event.fetus_count}
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
