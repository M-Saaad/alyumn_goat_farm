"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BackfillBreedingBirthsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/backfill-breeding-births", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        updated?: number;
        records?: Array<{ dam: string; buck: string | null; deliveredDate: string | null }>;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Backfill failed");
        return;
      }
      if (data.updated === 0) {
        setMessage("No open breeding records needed updating.");
      } else {
        const lines = (data.records ?? [])
          .map((r) => `${r.dam} → Delivered ${r.deliveredDate ?? "?"}`)
          .join("; ");
        setMessage(`Updated ${data.updated} record(s): ${lines}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backfill failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-sm font-semibold text-amber-950">Sync breeding from logged births</p>
      <p className="mt-1 text-xs text-amber-900">
        If you logged kid births before the auto-update fix, run this once to mark dams as Delivered.
      </p>
      {message && <p className="mt-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="mt-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Running…" : "Run backfill"}
      </button>
    </div>
  );
}
