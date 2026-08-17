"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionRecordBreedingUltrasound } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

type PregnancyResult = "confirmed" | "not_pregnant" | "unknown";

function defaultPregnancyResult(fetusCount?: number | null): PregnancyResult {
  if (fetusCount === 0) return "not_pregnant";
  if (fetusCount != null && fetusCount > 0) return "confirmed";
  return "unknown";
}

export function RecordUltrasoundForm({
  breedingId,
  femaleId,
  defaultUltrasoundDate,
  defaultFetusCount,
  defaultComments,
  supabaseEnabled,
  onDone,
}: {
  breedingId: string;
  femaleId: number;
  defaultUltrasoundDate?: string | null;
  defaultFetusCount?: number | null;
  defaultComments?: string | null;
  supabaseEnabled: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pregnancyResult, setPregnancyResult] = useState<PregnancyResult>(
    defaultPregnancyResult(defaultFetusCount)
  );
  const isEditing = Boolean(defaultUltrasoundDate);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const result = await actionRecordBreedingUltrasound(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ultrasound");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
      <input type="hidden" name="id" value={breedingId} />
      <input type="hidden" name="femaleId" value={femaleId} />
      <p className="text-sm font-semibold text-stone-800">
        {isEditing ? "Edit ultrasound" : "Record ultrasound"}
      </p>
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
      <div>
        <label className={labelCls}>Comments</label>
        <textarea
          className={field}
          name="comments"
          rows={2}
          placeholder="Optional notes from the ultrasound visit"
          defaultValue={defaultComments ?? ""}
        />
      </div>
      {supabaseEnabled ? (
        <div>
          <label className={labelCls}>Ultrasound video (optional)</label>
          <input
            className={field}
            type="file"
            name="file"
            accept="video/mp4,video/webm,video/quicktime,video/*,.mp4,.mov,.webm,.m4v,.3gp"
          />
          <p className="mt-1 text-xs text-stone-500">MP4, WebM, or MOV up to 50MB</p>
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
        {busy ? "Saving…" : isEditing ? "Save changes" : "Save ultrasound"}
      </button>
    </form>
  );
}
