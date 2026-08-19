"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionDeleteTransaction,
  actionRecordPalai,
  actionUpdatePalai,
} from "@/lib/server-actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ContactSelect, type ContactOption } from "@/components/ContactSelect";
import { formatPkr, formatDate, currentMonthIso, todayIso } from "@/lib/format";
import { formatServiceMonth } from "@/lib/palai/service-month";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

export type PalaiHistoryEntry = {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  date: string;
  serviceMonth: string;
  ratePerGoat: number;
  goatCount: number;
  totalAmount: number;
  paymentMethod: string | null;
  receivedBy: "Monis" | "Saad";
  notes: string | null;
};

function PalaiFields({
  defaults,
  customers,
  customerName,
  onCustomerChange,
}: {
  defaults?: Partial<PalaiHistoryEntry>;
  customers: ContactOption[];
  customerName: string;
  onCustomerChange: (name: string) => void;
}) {
  return (
    <>
      <ContactSelect
        label="Customer"
        name="customerName"
        options={customers}
        defaultValue={defaults?.customerName ?? customerName}
        required
        addNewLabel="+ Add new customer"
        onSelectionChange={onCustomerChange}
      />
      <div>
        <label className={labelCls}>For month</label>
        <input
          className={field}
          name="serviceMonth"
          type="month"
          defaultValue={defaults?.serviceMonth ?? currentMonthIso()}
          required
        />
      </div>
      <div>
        <label className={labelCls}>Payment date</label>
        <input
          className={field}
          name="date"
          type="date"
          defaultValue={defaults?.date ?? todayIso()}
          required
        />
      </div>
      <Field label="Rate / goat" name="ratePerGoat" type="number" defaultValue={String(defaults?.ratePerGoat ?? 7000)} required />
      <Field label="Goat count" name="goatCount" type="number" defaultValue={String(defaults?.goatCount ?? 2)} required />
      <div>
        <label className={labelCls}>Received by</label>
        <select name="receivedBy" className={field} defaultValue={defaults?.receivedBy ?? "Saad"}>
          <option value="Saad">Saad</option>
          <option value="Monis">Monis</option>
        </select>
      </div>
      <Field
        label="Payment method"
        name="paymentMethod"
        defaultValue={defaults?.paymentMethod ?? "Online Transfer"}
      />
      <Field label="Notes" name="notes" defaultValue={defaults?.notes ?? ""} />
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        className={field}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}

export function PalaiPaymentForm({
  customers,
  palaiHistory,
}: {
  customers: ContactOption[];
  palaiHistory: PalaiHistoryEntry[];
}) {
  const router = useRouter();
  const defaultCustomer =
    customers.find((c) => c.name === "Awais")?.name ?? customers[0]?.name ?? "";
  const [customerName, setCustomerName] = useState(defaultCustomer);
  const [editing, setEditing] = useState<PalaiHistoryEntry | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const customerEntries = useMemo(
    () =>
      palaiHistory
        .filter((e) => e.customerName.toLowerCase() === customerName.toLowerCase())
        .sort((a, b) => b.serviceMonth.localeCompare(a.serviceMonth)),
    [palaiHistory, customerName]
  );

  function onDelete(entry: PalaiHistoryEntry) {
    const ok = window.confirm(
      `Delete palai for ${formatServiceMonth(entry.serviceMonth)} (${formatPkr(entry.totalAmount)})? Partner equity will be recalculated.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", entry.transactionId);
        await actionDeleteTransaction(fd);
        setEditing(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Palai payment recorded. It will also appear under Transactions.
        </p>
      )}

      {!editing ? (
        <ActionForm
          key={formKey}
          action={actionRecordPalai}
          onSuccess={() => {
            setError(null);
            setSaved(true);
            setFormKey((k) => k + 1);
          }}
        >
          <PalaiFields
            customers={customers}
            customerName={customerName}
            onCustomerChange={setCustomerName}
          />
          <p className="text-xs text-stone-500">
            Pick which month the fee is for. Splits 50/50 to Monis and Saad based on who received the cash.
          </p>
          <SubmitButton label="Record palai payment" />
        </ActionForm>
      ) : (
        <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold">Edit palai entry</h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm text-stone-600"
            >
              Cancel
            </button>
          </div>
          <ActionForm
            action={actionUpdatePalai}
            onSuccess={() => {
              setError(null);
              setSaved(true);
              setEditing(null);
              router.refresh();
            }}
          >
            <input type="hidden" name="transactionId" value={editing.transactionId} />
            <PalaiFields
              defaults={editing}
              customers={customers}
              customerName={customerName}
              onCustomerChange={setCustomerName}
            />
            <SubmitButton label="Save changes" pendingLabel="Saving…" />
          </ActionForm>
        </div>
      )}

      {customerName && (
        <div className="border-t border-stone-100 pt-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
            {customerName} — palai by month
          </h3>
          {customerEntries.length === 0 ? (
            <p className="text-sm text-stone-500">No palai payments recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customerEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold">{formatServiceMonth(entry.serviceMonth)}</p>
                    <p className="text-stone-600">
                      {formatPkr(entry.totalAmount)} · {entry.goatCount} goats @{" "}
                      {formatPkr(entry.ratePerGoat)}
                    </p>
                    <p className="text-xs text-stone-500">
                      Paid {formatDate(entry.date)}
                      {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ""}
                      {` · Received by ${entry.receivedBy}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditing(entry);
                      }}
                      disabled={pending || editing != null}
                      className="text-xs font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      disabled={pending}
                      className="text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
