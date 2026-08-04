"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { currentMonthIso } from "@/lib/format";
import { formatServiceMonth } from "@/lib/palai/service-month";

export function FinanceMonthPicker({ month }: { month: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(sp.toString());
    if (!value || value === currentMonthIso()) params.delete("month");
    else params.set("month", value);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor="finance-month" className="text-sm font-semibold text-stone-800">
        {formatServiceMonth(month)}
      </label>
      <input
        id="finance-month"
        type="month"
        value={month}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800"
      />
    </div>
  );
}
