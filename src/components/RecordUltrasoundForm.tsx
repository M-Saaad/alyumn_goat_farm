"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { actionRecordBreedingUltrasound } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

type PregnancyResult = "confirmed" | "not_pregnant" | "unknown";

export type UltrasoundTarget = {
  breedingId: string;
  femaleId: number;
  label: string;
};

function defaultPregnancyResult(fetusCount?: number | null): PregnancyResult {
  if (fetusCount === 0) return "not_pregnant";
  if (fetusCount != null && fetusCount > 0) return "confirmed";
  return "unknown";
}

export function RecordUltrasoundForm({
  eligible,
  defaultSelectedBreedingIds,
  defaultUltrasoundDate,
  defaultFetusCount,
  supabaseEnabled,
  onDone,
}: {
  eligible: UltrasoundTarget[];
  defaultSelectedBreedingIds: string[];
  defaultUltrasoundDate?: string | null;
  defaultFetusCount?: number | null;
  supabaseEnabled: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pregnancyResult, setPregnancyResult] = useState<PregnancyResult>(
    defaultPregnancyResult(defaultFetusCount)
  );
  const eligibleIds = useMemo(() => new Set(eligible.map((t) => t.breedingId)), [eligible]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(defaultSelectedBreedingIds.filter((id) => eligibleIds.has(id)))
  );

  function toggleTarget(breedingId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(breedingId)) next.delete(breedingId);
      else next.add(breedingId);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (selectedIds.size === 0) {
      setError("Select at least one goat");
      return;
    }
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await actionRecordBreedingUltrasound(fd);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ultrasound");
    } finally {
      setBusy(false);
    }
  }

  const selectedTargets = eligible.filter((t) => selectedIds.has(t.breedingId));
  const saveLabel =
    selectedTargets.length > 1
      ? `Save ultrasound for ${selectedTargets.length} goats`
      : "Save ultrasound";

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
      <input type="hidden" name="status" value="Ready" />
      <p className="text-sm font-semibold text-stone-800">Record ultrasound</p>
      {eligible.length > 1 ? (
        <div>
          <label className={labelCls}>Goats</label>
          <div className="mt-1 space-y-2 rounded-xl border border-stone-200 bg-white p-2">
            {eligible.map((target) => (
              <label
                key={target.breedingId}
                className="flex items-center gap-2 text-sm text-stone-800"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                  checked={selectedIds.has(target.breedingId)}
                  onChange={() => toggleTarget(target.breedingId)}
                />
                <span>{target.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Select every goat scanned during this ultrasound visit.
          </p>
        </div>
      ) : (
        eligible.map((target) => (
          <div key={target.breedingId}>
            <input type="hidden" name="breedingIds" value={target.breedingId} />
            <input type="hidden" name="femaleIds" value={target.femaleId} />
          </div>
        ))
      )}
      {eligible.length > 1 &&
        selectedTargets.map((target) => (
          <div key={target.breedingId} className="hidden" aria-hidden>
            <input type="hidden" name="breedingIds" value={target.breedingId} />
            <input type="hidden" name="femaleIds" value={target.femaleId} />
          </div>
        ))}
      <div>
        <label className={labelCls}>Ultrasound date</label>
        <input
          className={field}
          name="ultrasoundDate"
          type="date"
          required
          defaultValue={defaultUltrasoundDate?.slice(0, 10) || todayIso()}
        />
      </div>
      <div>
        <label className={labelCls}>Pregnancy result</label>
        <select
          name="pregnancyResult"
          className={field}
          value={pregnancyResult}
          onChange={(e) => setPregnancyResult(e.target.value as PregnancyResult)}
          required
        >
          <option value="unknown">Unknown / not recorded</option>
          <option value="confirmed">Confirmed pregnant</option>
          <option value="not_pregnant">Not pregnant</option>
        </select>
      </div>
      {pregnancyResult === "confirmed" && (
        <div>
          <label className={labelCls}>Number of kids</label>
          <select
            name="kidCount"
            className={field}
            required
            defaultValue={
              defaultFetusCount != null && defaultFetusCount > 0
                ? String(Math.min(defaultFetusCount, 4))
                : "1"
            }
          >
            <option value="1">1 kid</option>
            <option value="2">2 kids</option>
            <option value="3">3 kids</option>
            <option value="4">4+ kids</option>
          </select>
        </div>
      )}
      {supabaseEnabled ? (
        <div>
          <label className={labelCls}>Ultrasound video (optional)</label>
          <input
            className={field}
            type="file"
            name="file"
            accept="video/mp4,video/webm,video/quicktime"
          />
          <p className="mt-1 text-xs text-stone-500">
            MP4, WebM, or MOV up to 50MB. Uploaded to each selected goat.
          </p>
        </div>
      ) : (
        <p className="text-xs text-stone-500">Video upload requires Supabase storage.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : saveLabel}
      </button>
    </form>
  );
}
