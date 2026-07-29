"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-stone-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-stone-600">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "The page failed to load. Try again — if you were saving an expense, check Transactions to see whether it was recorded."}
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-stone-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl bg-stone-200 px-4 py-2 text-sm font-semibold text-stone-800"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
