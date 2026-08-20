"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { currentMonthIso, todayIso } from "@/lib/format";
import type { FinanceReportMode } from "@/lib/transactions/monthly-report";

type FinanceReportPickerProps = {
  mode: FinanceReportMode;
  month: string;
  from?: string;
  to?: string;
};

export function FinanceReportPicker({ mode, month, from, to }: FinanceReportPickerProps) {
  const router = useRouter();
  const sp = useSearchParams();

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function switchMode(nextMode: FinanceReportMode) {
    const params = new URLSearchParams(sp.toString());
    if (nextMode === "month") {
      params.delete("range");
      params.delete("from");
      params.delete("to");
      if (!params.get("month")) params.set("month", month);
    } else if (nextMode === "custom") {
      params.set("range", "custom");
      params.delete("month");
      const start = from ?? `${month}-01`;
      const end = to ?? todayIso();
      params.set("from", start);
      params.set("to", end);
    } else {
      params.set("range", "alltime");
      params.delete("month");
      params.delete("from");
      params.delete("to");
    }
    navigate(params);
  }

  function onMonthChange(value: string) {
    const params = new URLSearchParams(sp.toString());
    params.delete("range");
    params.delete("from");
    params.delete("to");
    if (!value || value === currentMonthIso()) params.delete("month");
    else params.set("month", value);
    navigate(params);
  }

  function onDateChange(field: "from" | "to", value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("range", "custom");
    params.delete("month");
    const start = field === "from" ? value : from ?? `${month}-01`;
    const end = field === "to" ? value : to ?? todayIso();
    if (start) params.set("from", start);
    if (end) params.set("to", end);
    navigate(params);
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${
      active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-700 ring-1 ring-stone-200"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => switchMode("month")} className={tabClass(mode === "month")}>
          Monthly
        </button>
        <button type="button" onClick={() => switchMode("custom")} className={tabClass(mode === "custom")}>
          Custom range
        </button>
        <button type="button" onClick={() => switchMode("alltime")} className={tabClass(mode === "alltime")}>
          All time
        </button>
      </div>

      {mode === "month" ? (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="finance-month" className="text-sm font-semibold text-stone-800">
            Select month
          </label>
          <input
            id="finance-month"
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800"
          />
        </div>
      ) : mode === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-stone-800">Start date</span>
            <input
              type="date"
              value={from ?? ""}
              onChange={(e) => onDateChange("from", e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-stone-800">End date</span>
            <input
              type="date"
              value={to ?? ""}
              onChange={(e) => onDateChange("to", e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800"
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-stone-600">Full ledger history with category totals.</p>
      )}
    </div>
  );
}
