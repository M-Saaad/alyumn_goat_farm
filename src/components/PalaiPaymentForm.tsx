"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import {
  NON_NEGATIVE_NUMBER_INPUT_PROPS,
  POSITIVE_INTEGER_INPUT_PROPS,
} from "@/lib/form-numbers";

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
  serviceMonth,
  onServiceMonthChange,
  existingForMonth,
  ratePerGoat,
  onRatePerGoatChange,
  mergeWithExisting,
  onMergeWithExistingChange,
}: {
  defaults?: Partial<PalaiHistoryEntry>;
  customers: ContactOption[];
  customerName: string;
  onCustomerChange: (name: string) => void;
  serviceMonth: string;
  onServiceMonthChange: (month: string) => void;
  existingForMonth: PalaiHistoryEntry[];
  ratePerGoat: string;
  onRatePerGoatChange: (value: string) => void;
  mergeWithExisting: boolean;
  onMergeWithExistingChange: (value: boolean) => void;
}) {
  const rateNum = Number(ratePerGoat);
  const sameRateLine = existingForMonth.find(
    (e) => Number(e.ratePerGoat) === rateNum && Number.isFinite(rateNum)
  );
  const monthTotal = existingForMonth.reduce((sum, e) => sum + e.totalAmount, 0);

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
          value={serviceMonth}
          onChange={(e) => onServiceMonthChange(e.target.value)}
          required
        />
      </div>
      {existingForMonth.length > 0 && !defaults && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">
          <p>
            <span className="font-semibold">{formatServiceMonth(serviceMonth)}</span> already
            has {existingForMonth.length === 1 ? "a payment" : `${existingForMonth.length} payments`}{" "}
            totaling <span className="font-semibold">{formatPkr(monthTotal)}</span>:
          </p>
          <ul className="mt-1 list-disc pl-4">
            {existingForMonth.map((e) => (
              <li key={e.id}>
                {e.goatCount} goats @ {formatPkr(e.ratePerGoat)} ({formatPkr(e.totalAmount)})
              </li>
            ))}
          </ul>
          {sameRateLine ? (
            <label className="mt-2 flex items-start gap-2">
              <input
                type="checkbox"
                name="mergeWithExisting"
                checked={mergeWithExisting}
                onChange={(e) => onMergeWithExistingChange(e.target.checked)}
                className="mt-1"
              />
              <span>
                Add these goats onto the existing {sameRateLine.goatCount} @{" "}
                {formatPkr(sameRateLine.ratePerGoat)} line
              </span>
            </label>
          ) : (
            <p className="mt-2">
              A different rate is saved as a <span className="font-semibold">new line</span>. It
              will not replace the payment above.
            </p>
          )}
        </div>
      )}
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
      <Field
        label="Rate / goat"
        name="ratePerGoat"
        type="number"
        value={defaults ? undefined : ratePerGoat}
        onValueChange={defaults ? undefined : onRatePerGoatChange}
        defaultValue={defaults ? String(defaults.ratePerGoat ?? 7000) : undefined}
        required
        min={NON_NEGATIVE_NUMBER_INPUT_PROPS.min}
        step={NON_NEGATIVE_NUMBER_INPUT_PROPS.step}
      />
      <Field
        label="Goat count"
        name="goatCount"
        type="number"
        defaultValue={String(defaults?.goatCount ?? 2)}
        required
        min={POSITIVE_INTEGER_INPUT_PROPS.min}
        step={POSITIVE_INTEGER_INPUT_PROPS.step}
      />
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
  value,
  onValueChange,
  required,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  min?: number;
  step?: number | string;
}) {
  const controlled = onValueChange != null;
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        className={field}
        name={name}
        type={type}
        {...(controlled
          ? { value: value ?? "", onChange: (e) => onValueChange(e.target.value) }
          : { defaultValue })}
        required={required}
        min={type === "number" ? (min ?? NON_NEGATIVE_NUMBER_INPUT_PROPS.min) : undefined}
        step={type === "number" ? (step ?? NON_NEGATIVE_NUMBER_INPUT_PROPS.step) : undefined}
      />
    </div>
  );
}

export function PalaiPaymentForm({
  customers,
  palaiHistory,
  onSuccess,
}: {
  customers: ContactOption[];
  palaiHistory: PalaiHistoryEntry[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const defaultCustomer =
    customers.find((c) => c.name === "Awais")?.name ?? customers[0]?.name ?? "";
  const [customerName, setCustomerName] = useState(defaultCustomer);
  const [serviceMonth, setServiceMonth] = useState(currentMonthIso());
  const [ratePerGoat, setRatePerGoat] = useState("7000");
  const [mergeWithExisting, setMergeWithExisting] = useState(false);
  const [editing, setEditing] = useState<PalaiHistoryEntry | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const customerEntries = useMemo(
    () =>
      palaiHistory
        .filter((e) => e.customerName.toLowerCase() === customerName.toLowerCase())
        .sort((a, b) => b.serviceMonth.localeCompare(a.serviceMonth)),
    [palaiHistory, customerName]
  );

  const existingForMonth = useMemo(
    () => customerEntries.filter((e) => e.serviceMonth === serviceMonth),
    [customerEntries, serviceMonth]
  );

  const sameRateLine = existingForMonth.find(
    (e) => Number(e.ratePerGoat) === Number(ratePerGoat) && Number.isFinite(Number(ratePerGoat))
  );

  useEffect(() => {
    if (mergeWithExisting && !sameRateLine) setMergeWithExisting(false);
  }, [mergeWithExisting, sameRateLine]);

  function onDelete(entry: PalaiHistoryEntry) {
    const ok = window.confirm(
      `Delete palai for ${formatServiceMonth(entry.serviceMonth)} (${formatPkr(entry.totalAmount)})? Partner equity will be recalculated.`
    );
    if (!ok) return;
    setError(null);
    setSavedNotice(null);
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

  const fieldProps = {
    customers,
    customerName,
    onCustomerChange: setCustomerName,
    serviceMonth,
    onServiceMonthChange: setServiceMonth,
    existingForMonth,
    ratePerGoat,
    onRatePerGoatChange: setRatePerGoat,
    mergeWithExisting,
    onMergeWithExistingChange: setMergeWithExisting,
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {savedNotice && !error && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {savedNotice}
        </p>
      )}

      {!editing ? (
        <ActionForm
          action={actionRecordPalai}
          onSuccess={() => {
            setError(null);
            setSavedNotice(
              "Payment saved. Another rate for this month is added as a new line and will not replace this one."
            );
            setMergeWithExisting(false);
            router.refresh();
            onSuccess?.();
          }}
        >
          <PalaiFields {...fieldProps} />
          <p className="text-xs text-stone-500">
            Pick which month the fee is for. Different rates (for example 5 goats at 7,000 and 1
            kid at 4,000) are two lines. Splits 50/50 based on who received the cash.
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
              setSavedNotice(null);
              setEditing(null);
              router.refresh();
              onSuccess?.();
            }}
          >
            <input type="hidden" name="transactionId" value={editing.transactionId} />
            <PalaiFields
              {...fieldProps}
              defaults={editing}
              serviceMonth={editing.serviceMonth}
              onServiceMonthChange={() => {}}
              existingForMonth={[]}
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
                        setSavedNotice(null);
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
