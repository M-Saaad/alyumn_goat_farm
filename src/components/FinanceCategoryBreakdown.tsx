import { formatPkr } from "@/lib/format";
import type { LedgerCategory } from "@/lib/constants";
import { RECEIVED_CATEGORY_ORDER } from "@/lib/transactions/category-breakdown";

type CategoryMap = Partial<Record<string, number>>;

function CategoryList({
  title,
  hint,
  accent,
  categories,
  order,
  total,
}: {
  title: string;
  hint: string;
  accent: "invested" | "received" | "transfer";
  categories: CategoryMap;
  order: string[];
  total: number;
}) {
  const items = [
    ...order.filter((c) => categories[c]),
    ...Object.keys(categories)
      .filter((c) => !order.includes(c) && categories[c])
      .sort((a, b) => a.localeCompare(b)),
  ];
  if (items.length === 0) return null;

  return (
    <CategoryListInner
      title={title}
      hint={hint}
      accent={accent}
      categories={categories}
      items={items}
      total={total}
    />
  );
}

function CategoryListInner({
  title,
  hint,
  accent,
  categories,
  items,
  total,
}: {
  title: string;
  hint: string;
  accent: "invested" | "received" | "transfer";
  categories: CategoryMap;
  items: string[];
  total: number;
}) {
  const headerClass =
    accent === "invested"
      ? "bg-red-50 text-red-800 ring-red-100"
      : accent === "received"
        ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
        : "bg-stone-100 text-stone-700 ring-stone-200";

  const amountClass =
    accent === "invested"
      ? "text-red-700"
      : accent === "received"
        ? "text-emerald-700"
        : "text-stone-700";

  return (
    <div className="rounded-xl ring-1 ring-stone-200">
      <div className={`flex items-center justify-between gap-2 rounded-t-xl px-3 py-2 text-xs font-semibold ring-1 ring-inset ${headerClass}`}>
        <span>{title}</span>
        <span className="opacity-80">{hint}</span>
      </div>
      <ul className="divide-y divide-stone-100 px-3 py-1">
        {items.map((c) => (
          <li key={c} className="flex justify-between py-1.5 text-sm">
            <span className="text-stone-600">{c}</span>
            <span className={`font-medium ${amountClass}`}>{formatPkr(categories[c]!)}</span>
          </li>
        ))}
      </ul>
      <div className={`flex justify-between border-t border-stone-100 px-3 py-2 text-sm font-bold ${amountClass}`}>
        <span>Total</span>
        <span>{formatPkr(total)}</span>
      </div>
    </div>
  );
}

export function FinanceCategoryBreakdown({
  investedByCategory,
  receivedByCategory,
  transfersByCategory,
  totalInvested,
  totalReceived,
  totalTransfers,
  investedOrder,
}: {
  investedByCategory: CategoryMap;
  receivedByCategory: CategoryMap;
  transfersByCategory: CategoryMap;
  totalInvested: number;
  totalReceived: number;
  totalTransfers: number;
  investedOrder: LedgerCategory[];
}) {
  const hasTransfers = totalTransfers > 0;

  return (
    <div className="space-y-3">
      <CategoryList
        title="Invested"
        hint="Costs · money out"
        accent="invested"
        categories={investedByCategory}
        order={investedOrder}
        total={totalInvested}
      />
      <CategoryList
        title="Received"
        hint="Income · money in"
        accent="received"
        categories={receivedByCategory}
        order={RECEIVED_CATEGORY_ORDER}
        total={totalReceived}
      />
      {hasTransfers && (
        <CategoryList
          title="Partner transfers"
          hint="Between Monis & Saad"
          accent="transfer"
          categories={transfersByCategory}
          order={["Partner Transfer"]}
          total={totalTransfers}
        />
      )}
    </div>
  );
}
