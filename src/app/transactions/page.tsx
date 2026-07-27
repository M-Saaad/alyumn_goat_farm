import { Suspense } from "react";
import { getDb, contactName, animalLabel } from "@/lib/actions";
import { LEDGER_CATEGORIES, slugToCategory } from "@/lib/constants";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntry } from "@/components/QuickEntry";
import { TransactionsFilters } from "@/components/TransactionsFilters";
import {
  TransactionEditor,
  type EditableTransaction,
} from "@/components/TransactionEditor";
import { resolveTransactionKind } from "@/lib/transactions/mutate";
import { getPartnerIds } from "@/lib/partner-equity/settlement";
import { quickEntryPropsFromDb } from "@/lib/quick-entry-props";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDb();
  const q = (sp.q || "").toLowerCase().trim();
  const filter = sp.filter || "all";
  const { monisId, saadId } = getPartnerIds(db);

  let txs = [...db.transactions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.source_row ?? 0) - (a.source_row ?? 0);
  });

  if (filter === "cost") {
    txs = txs.filter((t) => t.kind === "cost");
  } else if (filter === "adjustment") {
    txs = txs.filter((t) => t.kind === "partner_adjustment");
  } else {
    const fromSlug = slugToCategory(filter);
    const category =
      fromSlug ||
      ((LEDGER_CATEGORIES as readonly string[]).includes(filter) ? filter : null);
    if (category) txs = txs.filter((t) => t.category === category);
  }

  if (q) {
    txs = txs.filter(
      (t) =>
        (t.notes || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.date.includes(q)
    );
  }

  const animals = db.animals
    .filter((a) => a.status === "Active")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  const allAnimals = db.animals.map((a) => ({ id: a.id, label: animalLabel(a) }));
  const quickEntry = quickEntryPropsFromDb(db);

  const editable: EditableTransaction[] = txs.map((tx) => {
    const variant = resolveTransactionKind(tx);
    const paidBy =
      tx.paid_by_partner_id === monisId
        ? ("Monis" as const)
        : tx.paid_by_partner_id === saadId
          ? ("Saad" as const)
          : null;

    const animal = tx.animal_id != null ? db.animals.find((a) => a.id === tx.animal_id) : null;
    const palaiPayment = db.palai_payments.find((p) => p.transaction_id === tx.id);
    const sale = (db.livestock_sales ?? []).find((s) => s.transaction_id === tx.id);

    let transferAbsAmount: number | null = null;
    let transferDirection: "from_monis" | "to_monis" | null = null;
    if (variant === "partner_transfer") {
      transferAbsAmount = Math.abs(tx.amount);
      transferDirection = tx.amount >= 0 ? "from_monis" : "to_monis";
    }

    let palai: EditableTransaction["palai"] = null;
    if (variant === "palai_income") {
      if (palaiPayment) {
        palai = {
          ratePerGoat: palaiPayment.rate_per_goat ?? Math.abs(tx.amount),
          goatCount: palaiPayment.goat_count ?? 1,
          paymentMethod: palaiPayment.payment_method ?? "",
          totalAmount: palaiPayment.total_amount,
        };
      } else {
        // Legacy import: infer total from adjustment half
        const total = Math.abs(tx.amount) * 2;
        palai = {
          ratePerGoat: total,
          goatCount: 1,
          paymentMethod: "",
          totalAmount: total,
        };
      }
    }

    let saleMeta: EditableTransaction["sale"] = null;
    if (variant === "livestock_sale") {
      if (sale) {
        const receivedBy =
          sale.received_by_partner_id === monisId
            ? ("Monis" as const)
            : ("Saad" as const);
        saleMeta = {
          animalIds: sale.animal_ids,
          grossSalePrice: sale.gross_sale_price,
          deliveryCost: sale.delivery_cost,
          receivedBy,
        };
      } else {
        saleMeta = {
          animalIds: tx.animal_id != null ? [tx.animal_id] : [],
          grossSalePrice: Math.abs(tx.amount) * 2,
          deliveryCost: 0,
          receivedBy: tx.amount < 0 ? "Monis" : "Saad",
        };
      }
    }

    const vendor = contactName(db, tx.vendor_id);
    const customerFromTx = contactName(db, tx.customer_id);
    const customerFromPalai = palaiPayment
      ? contactName(db, palaiPayment.customer_id)
      : "—";

    return {
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      kind: tx.kind,
      category: tx.category,
      variant,
      notes: tx.notes,
      paidBy,
      animalId: tx.animal_id,
      animalLabel: animal
        ? animalLabel(animal)
        : tx.animal_id != null
          ? `goat #${tx.animal_id}`
          : null,
      vendorName: vendor !== "—" ? vendor : null,
      customerName:
        customerFromTx !== "—"
          ? customerFromTx
          : customerFromPalai !== "—"
            ? customerFromPalai
            : null,
      transferAbsAmount,
      transferDirection,
      palai,
      sale: saleMeta,
    };
  });

  return (
    <main className="px-4 pt-6">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Finance</p>
        <h1 className="text-2xl font-bold text-stone-900">Transactions ({txs.length})</h1>
      </header>

      <Suspense fallback={<div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />}>
        <TransactionsFilters />
      </Suspense>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        {txs.length === 0 ? (
          <p className="text-sm text-stone-500">No transactions match.</p>
        ) : (
          <TransactionEditor
            transactions={editable}
            animals={animals}
            allAnimals={allAnimals}
            vendors={quickEntry.vendors}
            customers={quickEntry.customers}
          />
        )}
      </section>

      <QuickEntry {...quickEntry} />
      <BottomNav active="txns" />
    </main>
  );
}
