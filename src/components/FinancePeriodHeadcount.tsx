import { formatDate } from "@/lib/format";
import type { HeadcountAverages, HeadcountBucket } from "@/lib/livestock/period-headcount";
import type { PeriodHeadcount } from "@/lib/livestock/period-headcount";

function formatAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function HeadcountColumn({
  title,
  bucket,
  formatCount,
}: {
  title: string;
  bucket: HeadcountBucket | HeadcountAverages;
  formatCount?: (value: number) => string;
}) {
  const fmt = formatCount ?? String;
  const rows: Array<{ label: string; count: number; names?: string[] }> = [
    { label: "Breeding (females)", count: bucket.breedingFemales, names: (bucket as HeadcountBucket).breedingFemaleLabels },
    { label: "Kids", count: bucket.kids, names: (bucket as HeadcountBucket).kidLabels },
    { label: "Others", count: bucket.others, names: (bucket as HeadcountBucket).otherLabels },
  ];

  return (
    <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{title}</p>
      <p className="mb-2 text-lg font-bold text-stone-900">{fmt(bucket.total)} active</p>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between gap-2">
              <span className="text-stone-700">{row.label}</span>
              <span className="font-semibold text-stone-900">{fmt(row.count)}</span>
            </div>
            {row.names && row.names.length > 0 && (
              <p className="mt-0.5 text-xs text-stone-500 line-clamp-3">{row.names.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FinancePeriodHeadcount({ headcount }: { headcount: PeriodHeadcount }) {
  const averageTitle =
    headcount.average.dayCount === 1
      ? "Daily average · 1 day"
      : `Period average · ${headcount.average.dayCount} days`;

  return (
    <div className="mb-4 border-b border-stone-100 pb-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
        Active goats
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HeadcountColumn
          title={`Start · ${formatDate(headcount.startDate)}`}
          bucket={headcount.start}
        />
        <HeadcountColumn
          title={`End · ${formatDate(headcount.endDate)}`}
          bucket={headcount.end}
        />
        <HeadcountColumn
          title={averageTitle}
          bucket={headcount.average}
          formatCount={formatAverage}
        />
      </div>
    </div>
  );
}
