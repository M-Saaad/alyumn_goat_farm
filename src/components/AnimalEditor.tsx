"use client";

import { useState } from "react";
import { actionUpdateAnimal } from "@/lib/server-actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ContactSelect, type ContactOption } from "@/components/ContactSelect";
import type { AnimalBreed, AnimalSex, AnimalStatus } from "@/lib/types";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";
const sectionCls = "space-y-3 border-t border-stone-100 pt-3";

const STATUSES: AnimalStatus[] = ["Active", "Sold", "Died", "Slaughtered", "Gone"];

export type AnimalEditorData = {
  id: number;
  name: string | null;
  breed: AnimalBreed | null;
  sex: AnimalSex | null;
  description: string | null;
  comment: string | null;
  ownerName: string;
  vendorName: string | null;
  palai_rate: number | null;
  age_at_purchase: string | null;
  home_bred: boolean;
  status: AnimalStatus;
  date_of_purchase: string | null;
  price: number;
  purchase_paid: number;
  out_date: string | null;
  sold_price: number | null;
  sale: {
    date: string;
    gross_sale_price: number;
    delivery_cost: number;
    amount_received: number;
  } | null;
};

export function AnimalEditor({
  animal,
  vendors,
  ownerOptions,
}: {
  animal: AnimalEditorData;
  vendors: ContactOption[];
  ownerOptions: ContactOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<AnimalStatus>(animal.status);
  const [acquisitionType, setAcquisitionType] = useState<"purchased" | "born">(
    animal.home_bred ? "born" : "purchased"
  );
  const [showPalaiRate, setShowPalaiRate] = useState(
    Boolean(animal.ownerName) && !["Farm", "Monis", "Saad"].includes(animal.ownerName)
  );

  const showSaleFields = status === "Sold" || Boolean(animal.sale);

  return (
    <div className="mb-3">
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm ring-1 ring-stone-200"
        >
          Edit details
        </button>
      ) : (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Edit goat</h2>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1 text-sm text-stone-600"
            >
              Cancel
            </button>
          </div>
          <ActionForm action={actionUpdateAnimal} onSuccess={() => setEditing(false)}>
            <input type="hidden" name="id" value={animal.id} />

            <div className={sectionCls}>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Basics</p>
              <div>
                <label className={labelCls}>Name</label>
                <input className={field} name="name" defaultValue={animal.name ?? ""} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input
                  className={field}
                  name="description"
                  defaultValue={animal.description ?? ""}
                />
              </div>
              <div>
                <label className={labelCls}>Breed</label>
                <select name="breed" className={field} defaultValue={animal.breed ?? ""}>
                  <option value="">—</option>
                  {["Teddy", "Gulabi", "Bissar", "Tapra"].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sex</label>
                <select name="sex" className={field} defaultValue={animal.sex ?? ""}>
                  <option value="">—</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  name="status"
                  className={field}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AnimalStatus)}
                  required
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <ContactSelect
                label="Owner"
                name="ownerName"
                options={ownerOptions}
                defaultValue={animal.ownerName}
                required
                addNewLabel="+ Add new customer"
                onSelectionChange={(name) => {
                  setShowPalaiRate(
                    Boolean(name.trim()) && !["Farm", "Monis", "Saad"].includes(name)
                  );
                }}
              />
              {showPalaiRate && (
                <div>
                  <label className={labelCls}>Palai rate</label>
                  <input
                    className={field}
                    name="palaiRate"
                    type="number"
                    defaultValue={animal.palai_rate ?? ""}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>
                  {acquisitionType === "born" ? "Age at birth" : "Age at purchase"}
                </label>
                <input
                  className={field}
                  name="ageAtPurchase"
                  defaultValue={animal.age_at_purchase ?? ""}
                />
              </div>
              <div>
                <label className={labelCls}>Comment</label>
                <input className={field} name="comment" defaultValue={animal.comment ?? ""} />
              </div>
              <div>
                <p className={labelCls}>Acquisition</p>
                <div className="mt-1 flex gap-2">
                  {(
                    [
                      ["purchased", "Purchased"],
                      ["born", "Born on farm"],
                    ] as const
                  ).map(([value, text]) => (
                    <label
                      key={value}
                      className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold ${
                        acquisitionType === value
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                          : "border-stone-300 bg-white text-stone-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="acquisitionType"
                        value={value}
                        checked={acquisitionType === value}
                        onChange={() => setAcquisitionType(value)}
                        className="sr-only"
                      />
                      {text}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {acquisitionType === "purchased" ? (
            <div className={sectionCls}>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Purchase</p>
              <ContactSelect
                label="Vendor"
                name="vendorName"
                options={vendors}
                defaultValue={animal.vendorName ?? undefined}
                allowEmpty
                emptyLabel="—"
                addNewLabel="+ Add new vendor"
              />
              <div>
                <label className={labelCls}>Purchase date</label>
                <input
                  className={field}
                  name="purchaseDate"
                  type="date"
                  defaultValue={animal.date_of_purchase ?? ""}
                />
              </div>
              <div>
                <label className={labelCls}>Purchase price (PKR)</label>
                <input
                  className={field}
                  name="purchasePrice"
                  type="number"
                  defaultValue={animal.price || ""}
                />
              </div>
              <div>
                <label className={labelCls}>Amount paid so far (PKR)</label>
                <input
                  className={field}
                  name="purchasePaid"
                  type="number"
                  defaultValue={animal.purchase_paid || ""}
                />
              </div>
              <p className="text-xs text-stone-500">
                Updates the purchase agreement totals. Linked payment transactions are not changed
                automatically — edit those from Transactions if amounts need to match.
              </p>
            </div>
            ) : (
            <div className={sectionCls}>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Birth</p>
              <div>
                <label className={labelCls}>Birth date</label>
                <input
                  className={field}
                  name="purchaseDate"
                  type="date"
                  defaultValue={animal.date_of_purchase ?? ""}
                />
              </div>
              <p className="text-xs text-stone-500">
                Farm-born goats have no purchase price or vendor. Feed and vet costs can still be
                linked to this goat.
              </p>
            </div>
            )}

            {showSaleFields && (
              <div className={sectionCls}>
                <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Sale</p>
                <div>
                  <label className={labelCls}>Sale date</label>
                  <input
                    className={field}
                    name="saleDate"
                    type="date"
                    defaultValue={animal.sale?.date ?? animal.out_date ?? ""}
                  />
                </div>
                <div>
                  <label className={labelCls}>Out date</label>
                  <input
                    className={field}
                    name="outDate"
                    type="date"
                    defaultValue={animal.out_date ?? ""}
                  />
                </div>
                <div>
                  <label className={labelCls}>Gross sale price (PKR)</label>
                  <input
                    className={field}
                    name="soldPrice"
                    type="number"
                    defaultValue={
                      animal.sale?.gross_sale_price ?? animal.sold_price ?? ""
                    }
                  />
                </div>
                {animal.sale && (
                  <>
                    <div>
                      <label className={labelCls}>Delivery deducted (PKR)</label>
                      <input
                        className={field}
                        name="deliveryCost"
                        type="number"
                        defaultValue={animal.sale.delivery_cost || ""}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Amount received so far (PKR)</label>
                      <input
                        className={field}
                        name="amountReceived"
                        type="number"
                        defaultValue={animal.sale.amount_received || ""}
                      />
                    </div>
                  </>
                )}
                <p className="text-xs text-stone-500">
                  Sale receipt transactions are not recalculated here. Use Sale installments to log
                  new receipts, or edit individual transactions from Transactions.
                </p>
              </div>
            )}

            <SubmitButton label="Save details" />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
