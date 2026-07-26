"use client";

import { useState } from "react";
import { actionUploadAnimalMedia } from "@/lib/server-actions";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const label = "block text-sm font-medium text-stone-700";

export function AnimalMediaUpload({ animalId }: { animalId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await actionUploadAnimalMedia(fd);
      form.reset();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
      <input type="hidden" name="animalId" value={animalId} />
      <div>
        <label className={label}>Photo or video</label>
        <input
          className={field}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          required
        />
      </div>
      <div>
        <label className={label}>Caption (optional)</label>
        <input className={field} name="caption" type="text" />
      </div>
      <p className="text-xs text-stone-500">Images up to 10MB · Videos up to 50MB</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-emerald-700">Uploaded.</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload media"}
      </button>
    </form>
  );
}
