"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { QuickEntryProps } from "@/components/QuickEntry";

const QuickEntry = dynamic(
  () => import("@/components/QuickEntry").then((m) => m.QuickEntry),
  { ssr: false }
);

export function QuickEntryLoader({ canWrite = true }: { canWrite?: boolean }) {
  const [props, setProps] = useState<QuickEntryProps | null>(null);

  useEffect(() => {
    if (!canWrite) return;

    let cancelled = false;
    void fetch("/api/quick-entry")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: QuickEntryProps | null) => {
        if (!cancelled && data) setProps(data);
      });

    return () => {
      cancelled = true;
    };
  }, [canWrite]);

  if (!canWrite || !props) return null;
  return <QuickEntry {...props} />;
}
