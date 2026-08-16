"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionDeleteBreeding, actionUpdateBreeding } from "@/lib/server-actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { BuckSelect } from "@/components/ContactSelect";
import type { BreedingOutcome, BreedingStatus } from "@/lib/types";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

const OUTCOMES: BreedingOutcome[] = [
  "Pending",
  "Doubt",
  "Delivered",
  "Stillbirth",
  "Miscarriage",
];

const STATUSES: BreedingStatus[] = ["Ready", "Doubt", "Delivered", "Kid"];

export type BreedingEditorEvent = {
  id: string;
  femaleId: number;
  buck_name: string | null;
  male_animal_id: number | null;
  date_crossed: string | null;
  expected_due_date: string | null;
  delivered_date: string | null;
  ultrasound_date: string | null;
  fetus_count: number | null;
  outcome: BreedingOutcome;
  status: BreedingStatus | null;
  notes: string | null;
};

export function BreedingEventEditor({
  event,
  maleAnimals,
  pastBuckNames,
}: {
  event: BreedingEditorEvent;
  maleAnimals: { id: number; label: string }[];
  pastBuckNames: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<BreedingOutcome>(event.outcome);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    const label = event.buck_name || "this breeding record";
    const ok = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", event.id);
    fd.set("femaleId", String(event.femaleId));
    startTransition(async () => {
      await actionDeleteBreeding(fd);
      router.refresh();
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 text-xs font-semibold text-emerald-700"
      >
        Edit breeding
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
      <ActionForm action={actionUpdateBreeding} onSuccess={() => setEditing(false)}>
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="femaleId" value={event.femaleId} />
        <BuckSelect
          maleAnimals={maleAnimals}
          pastNames={pastBuckNames}
          defaultMaleAnimalId={event.male_animal_id}
          defaultBuckName={event.buck_name ?? ""}
        />
        <div>
          <label className={labelCls}>Date crossed</label>
          <input
            className={field}
            name="dateCrossed"
            type="date"
            required
            defaultValue={event.date_crossed?.slice(0, 10) ?? ""}
          />
        </div>
        <div>
          <label className={labelCls}>Ultrasound date</label>
          <input
            className={field}
            name="ultrasoundDate"
            type="date"
            defaultValue={event.ultrasound_date?.slice(0, 10) ?? ""}
          />
          <p className="mt-1 text-xs text-stone-500">Ideal window is day 40–75 after crossing.</p>
        </div>
        <div>
          <label className={labelCls}>Kids on ultrasound</label>
          <input
            className={field}
            name="fetusCount"
            type="number"
            min={0}
            max={10}
            placeholder="Blank = unknown, 0 = not pregnant"
            defaultValue={event.fetus_count ?? ""}
          />
          <p className="mt-1 text-xs text-stone-500">
            Confirmed pregnancy count from ultrasound. Leave blank if unknown.
          </p>
        </div>
        <div>
          <label className={labelCls}>Outcome</label>
          <select
            name="outcome"
            className={field}
            required
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as BreedingOutcome)}
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" className={field} defaultValue={event.status ?? ""}>
            <option value="">—</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {outcome === "Delivered" && (
          <div>
            <label className={labelCls}>Delivered date</label>
            <input
              className={field}
              name="deliveredDate"
              type="date"
              defaultValue={event.delivered_date?.slice(0, 10) ?? ""}
            />
          </div>
        )}
        <div>
          <label className={labelCls}>Notes</label>
          <input className={field} name="notes" defaultValue={event.notes ?? ""} />
        </div>
        {event.expected_due_date && (
          <p className="text-xs text-stone-500">
            Due date recalculates from date crossed (+150 days). Was {event.expected_due_date}.
          </p>
        )}
        <div className="flex gap-2">
          <SubmitButton label="Save breeding" className="flex-1 rounded-xl bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-60" />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-700"
          >
            Cancel
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="w-full rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete breeding record"}
        </button>
      </ActionForm>
    </div>
  );
}
