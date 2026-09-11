import { Suspense } from "react";
import { animalLabel } from "@/lib/labels";
import { palaiServiceMonth } from "@/lib/palai/service-month";
import { palaiReceivedByFromTx } from "@/lib/palai/received-by";
import { LEDGER_CATEGORIES, slugToCategory, categoryToSlug } from "@/lib/constants";
import { extraCategoryNames } from "@/lib/transactions/expense-categories";
import { loadTransactionsData, contactNameFrom } from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { TransactionsFilters } from "@/components/TransactionsFilters";
import { getWriteAccess } from "@/lib/auth/roles";
import {
  TransactionEditor,
  type EditableTransaction,
} from "@/components/TransactionEditor";
import { formatDate } from "@/lib/format";
import { resolveTransactionKind } from "@/lib/transactions/mutate";
import { getPartnerIds } from "@/lib/partner-equity/settlement";
import type { FarmDatabase } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const canWrite = await getWriteAccess();
  const data = await loadTransactionsData();
  const q = (sp.q || "").toLowerCase().trim();
  const filter = sp.filter || "all";
  const fromDate = sp.from?.trim().slice(0, 10);
  const toDate = sp.to?.trim().slice(0, 10);
  const { monisId, saadId } = getPartnerIds({ contacts: data.contacts } as FarmDatabase);

  let txs = [...data.transactions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.source_row ?? 0) - (a.source_row ?? 0);
  });

  if (fromDate) {
    txs = txs.filter((t) => t.date.slice(0, 10) >= fromDate);
  }
  if (toDate) {
    txs = txs.filter((t) => t.date.slice(0, 10) <= toDate);
  }

  if (filter === "cost") {
    txs = txs.filter((t) => t.kind === "cost");
  } else if (filter === "adjustment") {
    txs = txs.filter((t) => t.kind === "partner_adjustment");
  } else {
    const fromSlug = slugToCategory(filter);
    const extraNames = extraCategoryNames(data.transactions.map((t) => t.category));
    const customMatch = extraNames.find((name) => categoryToSlug(name) === filter);
    const category =
      fromSlug ||
      customMatch ||
      ((LEDGER_CATEGORIES as readonly string[]).includes(filter) ? filter : null);
    if (category) txs = txs.filter((t) => t.category === category);
  }

  if (q) {
    txs = txs.filter(
      (t) =>
        (t.notes || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.date.includes(q) ||
        formatDate(t.date).toLowerCase().includes(q)
    );
  }

  const animals = data.animals
    .filter((a) => a.status === "Active")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  const allAnimals = data.animals.map((a) => ({ id: a.id, label: animalLabel(a) }));

  const animalById = new Map(data.animals.map((a) => [a.id, a]));
  const palaiByTxId = new Map(
    data.palai_payments
      .filter((p) => p.transaction_id)
      .map((p) => [p.transaction_id as string, p])
  );
  const saleByTxId = new Map(
    (data.livestock_sales ?? [])
      .filter((s) => s.transaction_id)
      .map((s) => [s.transaction_id as string, s])
  );
  const vendors = data.contacts
    .filter((c) => c.type === "Vendor")
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const customers = data.contacts
    .filter((c) => c.type === "Customer")
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const editable: EditableTransaction[] = txs.map((tx) => {
    const variant = resolveTransactionKind(tx);
    const paidBy =
      tx.paid_by_partner_id === monisId
        ? ("Monis" as const)
        : tx.paid_by_partner_id === saadId
          ? ("Saad" as const)
          : null;

    const animal = tx.animal_id != null ? animalById.get(tx.animal_id) : null;
    const palaiPayment = palaiByTxId.get(tx.id);
    const sale = saleByTxId.get(tx.id);

    let transferAbsAmount: number | null = null;
    let transferDirection: "from_monis" | "to_monis" | null = null;
    if (variant === "partner_transfer") {
      transferAbsAmount = Math.abs(tx.amount);
      transferDirection = tx.amount >= 0 ? "from_monis" : "to_monis";
    }

    let palai: EditableTransaction["palai"] = null;
    if (variant === "palai_income") {
      const receivedBy = palaiReceivedByFromTx(tx, monisId, saadId);
      if (palaiPayment) {
        palai = {
          serviceMonth: palaiServiceMonth(palaiPayment),
          ratePerGoat: palaiPayment.rate_per_goat ?? Math.abs(tx.amount),
          goatCount: palaiPayment.goat_count ?? 1,
          paymentMethod: palaiPayment.payment_method ?? "",
          totalAmount: palaiPayment.total_amount,
          receivedBy,
        };
      } else {
        const total = Math.abs(tx.amount) * 2;
        palai = {
          serviceMonth: tx.date.slice(0, 7),
          ratePerGoat: total,
          goatCount: 1,
          paymentMethod: "",
          totalAmount: total,
          receivedBy,
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

    const vendor = contactNameFrom(data.contacts, tx.vendor_id);
    const customerFromTx = contactNameFrom(data.contacts, tx.customer_id);
    const customerFromPalai = palaiPayment
      ? contactNameFrom(data.contacts, palaiPayment.customer_id)
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
      <AppHeader
        eyebrow="Finance"
        title={`Transactions (${txs.length})`}
        subtitle={
          fromDate && toDate
            ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
            : fromDate
              ? `From ${formatDate(fromDate)}`
              : toDate
                ? `Through ${formatDate(toDate)}`
                : undefined
        }
      />

      {!canWrite && <ViewOnlyBanner />}

      <Suspense fallback={<div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />}>
        <TransactionsFilters extraCategoryNames={extraCategoryNames(data.transactions.map((t) => t.category))} />
      </Suspense>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        {txs.length === 0 ? (
          <p className="text-sm text-stone-500">No transactions match.</p>
        ) : (
          <TransactionEditor
            transactions={editable}
            animals={animals}
            allAnimals={allAnimals}
            vendors={vendors}
            customers={customers}
            expenseCategories={data.expenseCategories}
            canWrite={canWrite}
          />
        )}
      </section>

      <QuickEntryLoader canWrite={canWrite} />
      <BottomNav active="txns" />
    </main>
  );
}
