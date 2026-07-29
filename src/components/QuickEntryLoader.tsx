"use client";

import dynamic from "next/dynamic";
import type { QuickEntryProps } from "@/components/QuickEntry";

const QuickEntry = dynamic(
  () => import("@/components/QuickEntry").then((m) => m.QuickEntry),
  { ssr: false }
);

export function QuickEntryLoader(props: QuickEntryProps) {
  return <QuickEntry {...props} />;
}
