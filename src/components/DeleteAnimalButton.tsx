"use client";

import { useTransition } from "react";
import { actionDeleteAnimal } from "@/lib/server-actions";

export function DeleteAnimalButton({
  animalId,
  label,
}: {
  animalId: number;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    const ok = window.confirm(
      `Delete ${label}? This removes the goat and all linked expenses, medical, breeding, and sale records. Partner equity will be recalculated. This cannot be undone.`
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("animalId", String(animalId));
    startTransition(() => {
      actionDeleteAnimal(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete goat"}
    </button>
  );
}
