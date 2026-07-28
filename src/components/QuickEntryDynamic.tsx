"use client";

import nextDynamic from "next/dynamic";

export const QuickEntry = nextDynamic(
  () => import("@/components/QuickEntry").then((m) => m.QuickEntry),
  { ssr: false }
);
