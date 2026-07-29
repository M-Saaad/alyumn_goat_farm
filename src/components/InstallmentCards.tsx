"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionAddPurchasePayment,
  actionAddSaleReceipt,
  actionDeleteSaleReceipt,
  actionUndoLivestockSale,
} from "@/lib/server-actions";
import { formatDate, formatPkr, todayIso } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import type { AgreementStatus, LivestockSale, PurchaseAgreement } from "@/lib/types";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

function StatusBadge({ status }: { status: AgreementStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        status === "settled" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {status === "settled" ? "Settled" : "Outstanding"}
    </span>
  );
}

export type SaleReceiptRow = {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
};

export function PurchaseInstallmentCard({
  animalId,
  agreement,
  balance,
  isCustomerOwner,
}: {
  animalId: number;
  agreement: PurchaseAgreement;
  balance: number;
  isCustomerOwner: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Purchase installments</h2>
        <StatusBadge status={agreement.status} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-stone-500">Total</dt>
          <dd className="font-semibold">{formatPkr(agreement.total_amount)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Paid</dt>
          <dd className="font-semibold">{formatPkr(agreement.amount_paid)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Balance</dt>
          <dd className="font-semibold text-amber-800">{formatPkr(balance)}</dd>
        </div>
      </dl>
      {balance > 0 && (
        <>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Add payment
            </button>
          ) : (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <ActionForm action={actionAddPurchasePayment} onSuccess={() => setOpen(false)}>
                <input type="hidden" name="animalId" value={animalId} />
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    className={field}
                    name="date"
                    type="date"
                    defaultValue={todayIso()}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Amount (PKR)</label>
                  <input className={field} name="amount" type="number" required />
                </div>
                <div>
                  <label className={labelCls}>Who paid</label>
                  <select name="paidBy" className={field} required defaultValue="Saad">
                    <option value="Saad">Saad</option>
                    <option value="Monis">Monis</option>
                    {isCustomerOwner && <option value="Customer">Customer</option>}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input className={field} name="notes" />
                </div>
                <div className="flex gap-2">
                  <SubmitButton label="Record payment" pendingLabel="Saving…" />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm text-stone-600"
                  >
                    Cancel
                  </button>
                </div>
              </ActionForm>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DeleteReceiptButton({
  animalId,
  receipt,
}: {
  animalId: number;
  receipt: SaleReceiptRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    const ok = window.confirm(
      `Delete receipt of ${formatPkr(receipt.amount)} on ${formatDate(receipt.date)}? Partner equity will be recalculated.`
    );
    if (!ok) return;
    setError(null);
    const fd = new FormData();
    fd.set("txId", receipt.id);
    fd.set("animalId", String(animalId));
    startTransition(async () => {
      try {
        await actionDeleteSaleReceipt(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-xs font-semibold text-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function UndoSaleButton({ animalId }: { animalId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onUndo() {
    const ok = window.confirm(
      "Undo this entire sale? All receipts will be removed and goats will be marked Active again. This cannot be undone."
    );
    if (!ok) return;
    setError(null);
    const fd = new FormData();
    fd.set("animalId", String(animalId));
    startTransition(async () => {
      try {
        await actionUndoLivestockSale(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Undo failed");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={onUndo}
        disabled={pending}
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
      >
        {pending ? "Undoing…" : "Undo entire sale"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SaleInstallmentCard({
  animalId,
  sale,
  balance,
  receipts,
  soldOnPalai,
}: {
  animalId: number;
  sale: LivestockSale;
  balance: number;
  receipts: SaleReceiptRow[];
  soldOnPalai?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Sale installments</h2>
        <StatusBadge status={sale.status} />
      </div>
      {soldOnPalai && (
        <p className="mb-2 rounded-lg bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900">
          Sold on palai — goats stay Active at the farm under the buyer.
        </p>
      )}
      <p className="mb-2 text-xs text-stone-500">
        Sold {formatDate(sale.date)} · gross {formatPkr(sale.gross_sale_price)}
        {sale.delivery_cost > 0 ? ` · delivery ${formatPkr(sale.delivery_cost)}` : ""}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-stone-500">Net due</dt>
          <dd className="font-semibold">{formatPkr(sale.net_received)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Received</dt>
          <dd className="font-semibold">{formatPkr(sale.amount_received)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Outstanding</dt>
          <dd className="font-semibold text-amber-800">{formatPkr(balance)}</dd>
        </div>
      </dl>

      {receipts.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
            Receipts
          </h3>
          <ul className="space-y-2 text-sm">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{formatPkr(r.amount)}</p>
                  <p className="text-xs text-stone-500">
                    {formatDate(r.date)}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <DeleteReceiptButton animalId={animalId} receipt={r} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {balance > 0 && (
        <>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Record receipt
            </button>
          ) : (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <ActionForm action={actionAddSaleReceipt} onSuccess={() => setOpen(false)}>
                <input type="hidden" name="animalId" value={animalId} />
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    className={field}
                    name="date"
                    type="date"
                    defaultValue={todayIso()}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Amount received (PKR)</label>
                  <input className={field} name="amount" type="number" required />
                </div>
                <div>
                  <label className={labelCls}>Cash received by</label>
                  <select name="receivedBy" className={field} required defaultValue="Monis">
                    <option value="Monis">Monis</option>
                    <option value="Saad">Saad</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input className={field} name="notes" />
                </div>
                <div className="flex gap-2">
                  <SubmitButton label="Record receipt" pendingLabel="Saving…" />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm text-stone-600"
                  >
                    Cancel
                  </button>
                </div>
              </ActionForm>
            </div>
          )}
        </>
      )}

      <div className="mt-4 border-t border-stone-100 pt-3">
        <UndoSaleButton animalId={animalId} />
      </div>
    </section>
  );
}
