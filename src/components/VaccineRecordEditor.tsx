"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionDeleteVaccine, actionUpdateVaccine } from "@/lib/server-actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import {
  NEW_VACCINE_VALUE,
  VACCINE_INTERVAL_PRESETS,
  builtinVaccineByName,
  isBuiltinVaccineKey,
  parseVaccineNote,
  type VaccineScheduleEntry,
} from "@/lib/livestock/vaccine-schedule";
import type { MedicalEvent } from "@/lib/types";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

export type VaccineSibling = {
  id: string;
  animalId: number;
  label: string;
};

export function VaccineRecordEditor({
  event,
  similarGoats,
  vaccineSchedules,
  canWrite = true,
}: {
  event: MedicalEvent;
  similarGoats: VaccineSibling[];
  vaccineSchedules: VaccineScheduleEntry[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const parsed = parseVaccineNote(event.notes);
  const initialName = parsed?.name ?? "";
  const knownName = vaccineSchedules.some((v) => v.name === initialName)
    ? initialName
    : NEW_VACCINE_VALUE;
  const [vaccineName, setVaccineName] = useState(knownName || vaccineSchedules[0]?.name || NEW_VACCINE_VALUE);
  const [applySimilar, setApplySimilar] = useState(similarGoats.length > 0);
  const [pending, startTransition] = useTransition();

  const selectedVaccine = vaccineSchedules.find((v) => v.name === vaccineName);
  const showNewName = vaccineName === NEW_VACCINE_VALUE;
  const extraIntervalDays = showNewName
    ? parsed?.intervalDays
    : selectedVaccine && !isBuiltinVaccineKey(selectedVaccine.key)
      ? (parsed?.intervalDays ?? selectedVaccine.intervalDays)
      : parsed?.intervalDays;
  const showSchedule =
    showNewName || (selectedVaccine != null && !isBuiltinVaccineKey(selectedVaccine.key));

  if (!canWrite) return null;

  function onDelete() {
    const extra =
      applySimilar && similarGoats.length > 0
        ? ` Also delete it for ${similarGoats.length} other goat${similarGoats.length === 1 ? "" : "s"} vaccinated the same day with the same dosage.`
        : "";
    const ok = window.confirm(`Delete this vaccination?${extra} This cannot be undone.`);
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", event.id);
    if (applySimilar) fd.set("applySimilar", "1");
    startTransition(async () => {
      const result = await actionDeleteVaccine(fd);
      if (result && result.ok === false) {
        window.alert(result.error);
        return;
      }
      router.refresh();
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="mt-1">
        {similarGoats.length > 0 && (
          <p className="text-xs text-stone-500">
            Same day & dosage: {similarGoats.map((g) => g.label).join(", ")}
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 text-xs font-semibold text-emerald-700"
        >
          Edit vaccine
        </button>
      </div>
    );
  }

  const defaultInterval =
    extraIntervalDays ??
    (builtinVaccineByName(initialName)?.intervalDays ?? VACCINE_INTERVAL_PRESETS[0].value);

  return (
    <div className="mt-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
      <ActionForm action={actionUpdateVaccine} onSuccess={() => setEditing(false)}>
        <input type="hidden" name="id" value={event.id} />
        {applySimilar ? <input type="hidden" name="applySimilar" value="1" /> : null}
        <div>
          <label className={labelCls}>Date</label>
          <input
            className={field}
            name="date"
            type="date"
            required
            defaultValue={event.date?.slice(0, 10) ?? ""}
          />
        </div>
        <div>
          <label className={labelCls}>Vaccine</label>
          <select
            name="vaccineName"
            className={field}
            required
            value={vaccineName}
            onChange={(e) => setVaccineName(e.target.value)}
          >
            {vaccineSchedules.map((v) => (
              <option key={v.key} value={v.name}>
                {v.name}
              </option>
            ))}
            <option value={NEW_VACCINE_VALUE}>+ Add new vaccine type…</option>
          </select>
        </div>
        {showNewName && (
          <div>
            <label className={labelCls}>Vaccine name</label>
            <input
              className={field}
              name="vaccineNameOther"
              required
              defaultValue={knownName === NEW_VACCINE_VALUE ? initialName : ""}
            />
          </div>
        )}
        {showSchedule && (
          <div>
            <label className={labelCls}>Schedule</label>
            <select
              name="vaccineIntervalDays"
              className={field}
              required
              key={vaccineName}
              defaultValue={String(defaultInterval)}
            >
              {VACCINE_INTERVAL_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Dosage</label>
          <input className={field} name="dosage" required defaultValue={parsed?.dosage ?? "1ml"} />
        </div>
        {similarGoats.length > 0 && (
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-stone-300"
              checked={applySimilar}
              onChange={(e) => setApplySimilar(e.target.checked)}
            />
            <span>
              Also apply to {similarGoats.length} other goat
              {similarGoats.length === 1 ? "" : "s"} vaccinated the same day with the same dosage
              ({similarGoats.map((g) => g.label).join(", ")})
            </span>
          </label>
        )}
        <div className="flex gap-2">
          <SubmitButton
            label="Save vaccine"
            className="flex-1 rounded-xl bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-60"
          />
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
          {pending ? "Deleting…" : "Delete vaccination"}
        </button>
      </ActionForm>
    </div>
  );
}
