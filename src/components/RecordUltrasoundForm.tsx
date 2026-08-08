"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionRecordBreedingUltrasound } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";
import type { BreedingStatus } from "@/lib/types";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

const STATUSES: BreedingStatus[] = ["Ready", "Doubt", "Delivered", "Kid"];

export function RecordUltrasoundForm({
  breedingId,
  femaleId,
  defaultUltrasoundDate,
  defaultStatus,
  supabaseEnabled,
  onDone,
}: {
  breedingId: string;
  femaleId: number;
  defaultUltrasoundDate?: string | null;
  defaultStatus?: BreedingStatus | null;
  supabaseEnabled: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
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

  return (
    <form onSubmit={onSubmit} className="mt-2 space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
      <input type="hidden" name="id" value={breedingId} />
      <input type="hidden" name="femaleId" value={femaleId} />
      <p className="text-sm font-semibold text-stone-800">Record ultrasound</p>
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
        <label className={labelCls}>Status</label>
        <select name="status" className={field} defaultValue={defaultStatus ?? "Ready"}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {supabaseEnabled ? (
        <div>
          <label className={labelCls}>Ultrasound video (optional)</label>
          <input
            className={field}
            type="file"
            name="file"
            accept="video/mp4,video/webm,video/quicktime"
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
        {busy ? "Saving…" : "Save ultrasound"}
      </button>
    </form>
  );
}
