"use client";

import { actionAddCustomVaccine, actionDeleteCustomVaccine } from "@/lib/server-actions";
import {
  scheduleLabelFromDays,
  VACCINE_INTERVAL_PRESETS,
} from "@/lib/livestock/vaccine-schedule";
import type { CustomVaccine } from "@/lib/types";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const label = "block text-sm font-medium text-stone-700";

export function VaccineScheduleManager({ customVaccines }: { customVaccines: CustomVaccine[] }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-1 text-sm font-bold text-stone-800">Custom vaccine schedules</h2>
      <p className="mb-3 text-xs text-stone-600">
        Add vaccine types with a due schedule, like PPR yearly or ETV twice yearly.
      </p>

      {customVaccines.length > 0 && (
        <ul className="mb-3 space-y-2">
          {customVaccines.map((vaccine) => (
            <li
              key={vaccine.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 text-sm ring-1 ring-stone-100"
            >
              <span>
                <span className="font-semibold text-stone-900">{vaccine.name}</span>
                <span className="text-stone-600"> · {scheduleLabelFromDays(vaccine.interval_days)}</span>
              </span>
              <ActionForm action={actionDeleteCustomVaccine} className="shrink-0">
                <input type="hidden" name="id" value={vaccine.id} />
                <button
                  type="submit"
                  className="text-xs font-semibold text-red-700 hover:text-red-800"
                >
                  Remove
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={actionAddCustomVaccine}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Vaccine name</label>
            <input
              name="name"
              className={field}
              required
              placeholder="e.g. FMD"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={label}>Schedule</label>
            <select
              name="intervalDays"
              className={field}
              required
              defaultValue={String(VACCINE_INTERVAL_PRESETS[0].value)}
            >
              {VACCINE_INTERVAL_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <SubmitButton label="Add vaccine type" />
        </div>
      </ActionForm>
    </section>
  );
}
