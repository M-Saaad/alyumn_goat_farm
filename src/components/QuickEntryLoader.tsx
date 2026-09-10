"use client";

import dynamic from "next/dynamic";
import type { QuickEntryProps } from "@/components/QuickEntry";

const QuickEntry = dynamic(
  () => import("@/components/QuickEntry").then((m) => m.QuickEntry),
  { ssr: false }
);

export function QuickEntryLoader({
  canWrite = true,
  ...props
}: QuickEntryProps & { canWrite?: boolean }) {
  if (!canWrite) return null;
  return <QuickEntry {...props} />;
}
