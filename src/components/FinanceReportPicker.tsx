"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  currentMonthIso,
  formatDate,
  monthSpanForRange,
  startDateForMonthSpan,
  todayIso,
} from "@/lib/format";
import type { FinanceReportMode } from "@/lib/transactions/monthly-report";

const MAX_CUSTOM_MONTHS = 120;

type FinanceReportPickerProps = {
  mode: FinanceReportMode;
  month: string;
  from?: string;
  to?: string;
};

export function FinanceReportPicker({ mode, month, from, to }: FinanceReportPickerProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [customMonths, setCustomMonths] = useState("");

  useEffect(() => {
    if (mode !== "custom" || !from || !to) {
      setCustomMonths("");
      return;
    }
    const span = monthSpanForRange(from, to);
    setCustomMonths(span != null ? String(span) : "");
  }, [mode, from, to]);

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
      const end = todayIso();
      const start = from ?? startDateForMonthSpan(end, 3);
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

  function applyMonthSpan(monthCount: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("range", "custom");
    params.delete("month");
    const end = todayIso();
    params.set("from", startDateForMonthSpan(end, monthCount));
    params.set("to", end);
    navigate(params);
  }

  function applyCustomMonths() {
    const monthCount = Number.parseInt(customMonths.trim(), 10);
    if (!Number.isFinite(monthCount) || monthCount < 1 || monthCount > MAX_CUSTOM_MONTHS) return;
    applyMonthSpan(monthCount);
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${
      active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-700 ring-1 ring-stone-200"
    }`;

  const parsedMonths = Number.parseInt(customMonths.trim(), 10);
  const previewValid =
    Number.isFinite(parsedMonths) && parsedMonths >= 1 && parsedMonths <= MAX_CUSTOM_MONTHS;
  const previewEnd = todayIso();
  const previewStart = previewValid ? startDateForMonthSpan(previewEnd, parsedMonths) : null;
  const activeSpan = mode === "custom" && from && to ? monthSpanForRange(from, to) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => switchMode("alltime")} className={tabClass(mode === "alltime")}>
          All time
        </button>
        <button type="button" onClick={() => switchMode("month")} className={tabClass(mode === "month")}>
          Monthly
        </button>
        <button type="button" onClick={() => switchMode("custom")} className={tabClass(mode === "custom")}>
          Custom range
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
        <div className="space-y-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyCustomMonths();
            }}
          >
            <div>
              <label htmlFor="finance-month-span" className="text-sm font-semibold text-stone-800">
                Number of months
              </label>
              <p className="text-xs text-stone-500">
                Same day of month, counting back from today
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="finance-month-span"
                type="number"
                min={1}
                max={MAX_CUSTOM_MONTHS}
                step={1}
                value={customMonths}
                onChange={(e) => setCustomMonths(e.target.value)}
                onBlur={applyCustomMonths}
                placeholder="3"
                className="w-20 rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-base font-semibold text-stone-900"
              />
              <span className="text-sm font-medium text-stone-700">months</span>
              <button
                type="submit"
                className="ml-auto rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white"
              >
                Apply
              </button>
            </div>
            {previewStart && (
              <p className="text-xs text-stone-600">
                {activeSpan === parsedMonths && from && to
                  ? `Showing ${formatDate(from)} – ${formatDate(to)}`
                  : `Will show ${formatDate(previewStart)} – ${formatDate(previewEnd)}`}
              </p>
            )}
            {!previewStart && from && to && (
              <p className="text-xs text-stone-600">
                Showing {formatDate(from)} – {formatDate(to)}
              </p>
            )}
          </form>

          <div className="border-t border-stone-200 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Or pick exact dates
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">Start</span>
                <input
                  type="date"
                  value={from ?? ""}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">End</span>
                <input
                  type="date"
                  value={to ?? ""}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800"
                />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-stone-600">Full ledger history with category totals.</p>
      )}
    </div>
  );
}
