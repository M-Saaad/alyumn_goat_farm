import { formatDate, formatPkr } from "@/lib/format";
import { formatServiceMonth } from "@/lib/palai/service-month";
import type { MonthlyCategoryReport } from "@/lib/transactions/monthly-report";

export function FinanceMonthlyTransactions({ report }: { report: MonthlyCategoryReport }) {
  const { ledgerRows, palaiRows } = report;
  const periodLabel = report.periodLabel;
  if (ledgerRows.length === 0 && palaiRows.length === 0) {
    return (
      <p className="mt-3 text-sm text-stone-500">
        No transactions in {periodLabel}.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-stone-100 pt-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
        Included in period ({ledgerRows.length + palaiRows.length})
      </h3>
      <ul className="divide-y divide-stone-100 text-sm">
        {ledgerRows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="font-medium text-stone-800">{row.category}</p>
              <p className="text-xs text-stone-500">
                {formatDate(row.date)} · {row.kind === "cost" ? "cost" : "adjustment"}
              </p>
              {row.notes && <p className="text-xs text-stone-500 line-clamp-2">{row.notes}</p>}
            </div>
            <p
              className={`shrink-0 font-semibold ${
                row.kind === "cost" ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {formatPkr(row.displayAmount)}
            </p>
          </li>
        ))}
        {palaiRows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="font-medium text-stone-800">Palai Income</p>
              <p className="text-xs text-stone-500">
                Paid {formatDate(row.date)} · Service month {formatServiceMonth(row.serviceMonth)}
                {row.goatCount != null ? ` · ${row.goatCount} goats` : ""}
              </p>
              {row.notes && <p className="text-xs text-stone-500 line-clamp-2">{row.notes}</p>}
            </div>
            <p className="shrink-0 font-semibold text-emerald-700">{formatPkr(row.totalAmount)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
