"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionDeleteTransaction,
  actionUpdateTransaction,
} from "@/lib/server-actions";
import { LEDGER_CATEGORIES } from "@/lib/constants";
import { formatPkr } from "@/lib/format";
import type { TransactionEditVariant } from "@/lib/transactions/mutate";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ContactSelect, type ContactOption } from "@/components/ContactSelect";

export type AnimalOption = { id: number; label: string };

export type EditableTransaction = {
  id: string;
  date: string;
  amount: number;
  kind: "cost" | "partner_adjustment";
  category: string;
  variant: TransactionEditVariant;
  notes: string | null;
  paidBy: "Monis" | "Saad" | null;
  animalId: number | null;
  animalLabel: string | null;
  vendorName: string | null;
  customerName: string | null;
  /** Absolute amount for partner transfers (form shows positive). */
  transferAbsAmount: number | null;
  transferDirection: "from_monis" | "to_monis" | null;
  palai: {
    ratePerGoat: number;
    goatCount: number;
    paymentMethod: string;
    totalAmount: number;
  } | null;
  sale: {
    animalIds: number[];
    grossSalePrice: number;
    deliveryCost: number;
    receivedBy: "Monis" | "Saad";
  } | null;
};

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

const EXPENSE_CATEGORIES = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Palai Expense",
  "Other",
] as const;

export function TransactionEditor({
  transactions,
  animals,
  allAnimals,
  vendors,
  customers,
}: {
  transactions: EditableTransaction[];
  /** Active animals for expense linking. */
  animals: AnimalOption[];
  /** All animals (incl. sold) for sale forms. */
  allAnimals: AnimalOption[];
  vendors: ContactOption[];
  customers: ContactOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableTransaction | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function close() {
    setEditing(null);
    setError(null);
  }

  function onDelete(tx: EditableTransaction) {
    setMenuOpenId(null);
    const ok = window.confirm(
      `Delete ${tx.category} · ${formatPkr(Math.abs(tx.amount))} on ${tx.date}? This cannot be undone.`
    );
    if (!ok) return;
    setError(null);
    setDeletingId(tx.id);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", tx.id);
        await actionDeleteTransaction(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <>
      {error && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {pending && deletingId && (
        <p className="mb-2 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
          Deleting…
        </p>
      )}
      <ul className={`divide-y divide-stone-100 ${pending ? "pointer-events-none opacity-70" : ""}`}>
        {transactions.map((tx) => (
          <li key={tx.id} className="flex items-start justify-between gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-stone-800">{tx.category}</p>
              <p className="text-xs text-stone-500">
                {tx.date} ·{" "}
                {tx.kind === "cost"
                  ? `paid by ${tx.paidBy ?? "—"}`
                  : "adjustment"}
                {tx.animalLabel ? ` · ${tx.animalLabel}` : ""}
              </p>
              {tx.notes && (
                <p className="text-xs text-stone-500 line-clamp-1">{tx.notes}</p>
              )}
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <p className="pt-0.5 font-semibold">{formatPkr(tx.amount)}</p>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Transaction actions"
                  aria-expanded={menuOpenId === tx.id}
                  disabled={pending}
                  onClick={() =>
                    setMenuOpenId((id) => (id === tx.id ? null : tx.id))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
                >
                  <MoreVerticalIcon />
                </button>
                {menuOpenId === tx.id && (
                  <>
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuOpenId(null)}
                    />
                    <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-stone-200">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm font-medium text-stone-800 hover:bg-stone-50"
                        onClick={() => {
                          setMenuOpenId(null);
                          setError(null);
                          setEditing(tx);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(tx)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-stone-50 p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">Edit {editing.category}</h2>
              <button type="button" onClick={close} className="rounded-lg px-3 py-1 text-stone-600">
                Close
              </button>
            </div>

            <ActionForm action={actionUpdateTransaction} onSuccess={close}>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="variant" value={editing.variant} />

              {editing.variant === "expense" && (
                <ExpenseForm tx={editing} animals={animals} />
              )}
              {editing.variant === "livestock_purchase" && (
                <PurchaseForm tx={editing} vendors={vendors} />
              )}
              {editing.variant === "partner_transfer" && <TransferForm tx={editing} />}
              {editing.variant === "palai_income" && (
                <PalaiForm tx={editing} customers={customers} />
              )}
              {editing.variant === "livestock_sale" && (
                <SaleForm tx={editing} animals={allAnimals} />
              )}

              <SubmitButton label="Save changes" />
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  step?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{props.label}</label>
      <input
        className={field}
        name={props.name}
        type={props.type || "text"}
        defaultValue={props.defaultValue}
        required={props.required}
        step={props.step}
      />
    </div>
  );
}

function ExpenseForm({
  tx,
  animals,
}: {
  tx: EditableTransaction;
  animals: AnimalOption[];
}) {
  const cats = LEDGER_CATEGORIES.filter((c) =>
    (EXPENSE_CATEGORIES as readonly string[]).includes(c)
  );
  const options =
    cats.includes(tx.category as (typeof cats)[number])
      ? cats
      : [tx.category, ...cats];

  return (
    <>
      <Field label="Date" name="date" type="date" defaultValue={tx.date} required />
      <Field
        label="Amount (PKR)"
        name="amount"
        type="number"
        defaultValue={tx.amount}
        required
        step="any"
      />
      <div>
        <label className={labelCls}>Category</label>
        <select name="category" className={field} required defaultValue={tx.category}>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Who paid</label>
        <select name="paidBy" className={field} required defaultValue={tx.paidBy ?? "Saad"}>
          <option value="Saad">Saad</option>
          <option value="Monis">Monis</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Goat (optional)</label>
        <select
          name="animalId"
          className={field}
          defaultValue={tx.animalId != null ? String(tx.animalId) : ""}
        >
          <option value="">—</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
          {tx.animalId != null &&
            !animals.some((a) => a.id === tx.animalId) &&
            tx.animalLabel && (
              <option value={tx.animalId}>{tx.animalLabel}</option>
            )}
        </select>
      </div>
      <Field label="Notes" name="notes" defaultValue={tx.notes ?? ""} />
    </>
  );
}

function PurchaseForm({
  tx,
  vendors,
}: {
  tx: EditableTransaction;
  vendors: ContactOption[];
}) {
  return (
    <>
      {tx.animalLabel && (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
          Linked animal: <span className="font-semibold">{tx.animalLabel}</span>
        </p>
      )}
      <Field label="Date" name="date" type="date" defaultValue={tx.date} required />
      <Field
        label="Price (PKR)"
        name="amount"
        type="number"
        defaultValue={tx.amount}
        required
        step="any"
      />
      <div>
        <label className={labelCls}>Who paid</label>
        <select name="paidBy" className={field} required defaultValue={tx.paidBy ?? "Saad"}>
          <option value="Saad">Saad</option>
          <option value="Monis">Monis</option>
        </select>
      </div>
      <ContactSelect
        label="Vendor"
        name="vendorName"
        options={vendors}
        defaultValue={tx.vendorName ?? undefined}
        allowEmpty
        emptyLabel="—"
        addNewLabel="+ Add new vendor"
      />
      <Field label="Notes" name="notes" defaultValue={tx.notes ?? ""} />
    </>
  );
}

function TransferForm({ tx }: { tx: EditableTransaction }) {
  return (
    <>
      <Field label="Date" name="date" type="date" defaultValue={tx.date} required />
      <Field
        label="Amount"
        name="amount"
        type="number"
        defaultValue={tx.transferAbsAmount ?? Math.abs(tx.amount)}
        required
        step="any"
      />
      <div>
        <label className={labelCls}>Direction</label>
        <select
          name="direction"
          className={field}
          required
          defaultValue={tx.transferDirection ?? (tx.amount >= 0 ? "from_monis" : "to_monis")}
        >
          <option value="from_monis">Received from Monis</option>
          <option value="to_monis">Sent to Monis</option>
        </select>
      </div>
      <Field label="Notes" name="notes" defaultValue={tx.notes ?? ""} />
    </>
  );
}

function PalaiForm({
  tx,
  customers,
}: {
  tx: EditableTransaction;
  customers: ContactOption[];
}) {
  const palai = tx.palai;
  const rate = palai?.ratePerGoat ?? Math.abs(tx.amount);
  const count = palai?.goatCount ?? 2;
  return (
    <>
      <Field label="Date" name="date" type="date" defaultValue={tx.date} required />
      <ContactSelect
        label="Customer"
        name="customerName"
        options={customers}
        defaultValue={tx.customerName ?? "Awais"}
        required
        addNewLabel="+ Add new customer"
      />
      <Field
        label="Rate / goat"
        name="ratePerGoat"
        type="number"
        defaultValue={rate}
        required
        step="any"
      />
      <Field
        label="Goat count"
        name="goatCount"
        type="number"
        defaultValue={count}
        required
      />
      <Field
        label="Payment method"
        name="paymentMethod"
        defaultValue={palai?.paymentMethod ?? ""}
      />
      <Field label="Notes" name="notes" defaultValue={tx.notes ?? ""} />
      <p className="text-xs text-stone-500">
        Total {formatPkr(palai?.totalAmount ?? Math.abs(tx.amount) * 2)} · splits 50/50
        automatically.
      </p>
    </>
  );
}

function SaleForm({
  tx,
  animals,
}: {
  tx: EditableTransaction;
  animals: AnimalOption[];
}) {
  const sale = tx.sale;
  const primaryId = sale?.animalIds[0] ?? tx.animalId ?? "";
  const secondId = sale?.animalIds[1] ?? "";
  return (
    <>
      <div>
        <label className={labelCls}>Goat</label>
        <select
          name="animalId"
          className={field}
          required
          defaultValue={primaryId !== "" ? String(primaryId) : undefined}
        >
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Second goat (optional)</label>
        <select
          name="additionalAnimalId"
          className={field}
          defaultValue={secondId !== "" ? String(secondId) : ""}
        >
          <option value="">—</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <Field label="Sale date" name="date" type="date" defaultValue={tx.date} required />
      <Field
        label="Gross sale price (PKR)"
        name="grossSalePrice"
        type="number"
        defaultValue={sale?.grossSalePrice ?? Math.abs(tx.amount) * 2}
        required
        step="any"
      />
      <Field
        label="Delivery deducted from proceeds"
        name="deliveryCost"
        type="number"
        defaultValue={sale?.deliveryCost ?? 0}
        step="any"
      />
      <div>
        <label className={labelCls}>Cash received by</label>
        <select
          name="receivedBy"
          className={field}
          required
          defaultValue={sale?.receivedBy ?? "Monis"}
        >
          <option value="Monis">Monis</option>
          <option value="Saad">Saad</option>
        </select>
      </div>
      <Field label="Notes" name="notes" defaultValue={tx.notes ?? ""} />
    </>
  );
}

function MoreVerticalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}
