"use client";

import { useState } from "react";
import { isBreedingInPipeline } from "@/lib/livestock/breeding";
import { BreedingEventEditor, type BreedingEditorEvent } from "@/components/BreedingEventEditor";
import { RecordUltrasoundForm } from "@/components/RecordUltrasoundForm";
import { UltrasoundStatusLine } from "@/components/UltrasoundStatusLine";
import type { UltrasoundStatus } from "@/lib/livestock/breeding";

export function BreedingRecordActions({
  event,
  ultrasoundStatus,
  daysSinceCrossed,
  maleAnimals,
  pastBuckNames,
  supabaseEnabled,
}: {
  event: BreedingEditorEvent;
  ultrasoundStatus: UltrasoundStatus;
  daysSinceCrossed: number | null;
  maleAnimals: { id: number; label: string }[];
  pastBuckNames: string[];
  supabaseEnabled: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const canRecord =
    isBreedingInPipeline({
      id: event.id,
      female_animal_id: event.femaleId,
      male_animal_id: event.male_animal_id,
      buck_name: event.buck_name,
      date_crossed: event.date_crossed,
      expected_due_date: event.expected_due_date,
      delivered_date: event.delivered_date,
      ultrasound_date: event.ultrasound_date,
      outcome: event.outcome,
      status: event.status,
      notes: event.notes,
    }) && Boolean(event.date_crossed);

  return (
    <div className="mt-1">
      <UltrasoundStatusLine
        ultrasoundStatus={ultrasoundStatus}
        ultrasoundDate={event.ultrasound_date}
        daysSinceCrossed={daysSinceCrossed}
        showWhenIdle={canRecord}
      />
      <div className="mt-1 flex flex-wrap gap-3">
        {canRecord && !recording && (
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="text-xs font-semibold text-emerald-700"
          >
            Record ultrasound
          </button>
        )}
        <BreedingEventEditor
          event={event}
          maleAnimals={maleAnimals}
          pastBuckNames={pastBuckNames}
        />
      </div>
      {recording && (
        <RecordUltrasoundForm
          breedingId={event.id}
          femaleId={event.femaleId}
          defaultUltrasoundDate={event.ultrasound_date}
          defaultStatus={event.status}
          supabaseEnabled={supabaseEnabled}
          onDone={() => setRecording(false)}
        />
      )}
    </div>
  );
}
