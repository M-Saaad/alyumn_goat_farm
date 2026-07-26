"use client";

import { useState } from "react";
import {
  actionBuyGoat,
  actionChangeStatus,
  actionLogExpense,
  actionLogMedical,
  actionPartnerTransfer,
  actionRecordBreeding,
  actionRecordLivestockSale,
  actionRecordPalai,
} from "@/lib/server-actions";
import { LEDGER_CATEGORIES } from "@/lib/constants";
import { todayIso } from "@/lib/format";

type AnimalOption = { id: number; label: string };
type Mode =
  | null
  | "expense"
  | "palai"
  | "buy"
  | "medical"
  | "breeding"
  | "sell"
  | "status"
  | "transfer";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const label = "block text-sm font-medium text-stone-700";

export function QuickEntry({ animals }: { animals: AnimalOption[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);

  function pick(m: Mode) {
    setMode(m);
  }

  function close() {
    setOpen(false);
    setMode(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl font-light text-white shadow-lg"
        aria-label="Quick entry"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-stone-50 p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">
                {mode ? modeLabel(mode) : "Quick Entry"}
              </h2>
              <button type="button" onClick={close} className="rounded-lg px-3 py-1 text-stone-600">
                Close
              </button>
            </div>

            {!mode && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["expense", "Log Expense"],
                    ["palai", "Palai Payment"],
                    ["buy", "Buy Goat"],
                    ["medical", "Log Medical"],
                    ["breeding", "Record Breeding"],
                    ["sell", "Sell Goat"],
                    ["status", "Change Status"],
                    ["transfer", "Partner Transfer"],
                  ] as const
                ).map(([k, text]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pick(k)}
                    className="rounded-xl bg-white p-4 text-left text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}

            {mode === "expense" && (
              <form action={actionLogExpense} onSubmit={close} className="space-y-3">
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Amount (PKR)" name="amount" type="number" required />
                <div>
                  <label className={label}>Category</label>
                  <select name="category" className={field} required>
                    {LEDGER_CATEGORIES.filter((c) =>
                      ["Feed", "Delivery", "Vet/Medicine", "Labor", "Infrastructure", "Other"].includes(c)
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <PartnerSelect />
                <AnimalSelect animals={animals} optional />
                <Field label="Notes" name="notes" />
                <Submit />
              </form>
            )}

            {mode === "palai" && (
              <form action={actionRecordPalai} onSubmit={close} className="space-y-3">
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Customer" name="customerName" defaultValue="Awais" required />
                <Field label="Rate / goat" name="ratePerGoat" type="number" defaultValue="7000" required />
                <Field label="Goat count" name="goatCount" type="number" defaultValue="2" required />
                <Field label="Payment method" name="paymentMethod" defaultValue="Online Transfer" />
                <Field label="Notes" name="notes" />
                <p className="text-xs text-stone-500">Splits 50/50 to Monis and Saad automatically.</p>
                <Submit />
              </form>
            )}

            {mode === "buy" && (
              <form action={actionBuyGoat} onSubmit={close} className="space-y-3">
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Price" name="price" type="number" required />
                <Field label="Name (optional)" name="name" />
                <Field label="Description" name="description" required />
                <div>
                  <label className={label}>Breed</label>
                  <select name="breed" className={field} required>
                    {["Teddy", "Gulabi", "Bissar", "Tapra"].map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Sex</label>
                  <select name="sex" className={field} required>
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </div>
                <Field label="Owner" name="ownerName" defaultValue="Farm" required />
                <Field label="Vendor" name="vendorName" />
                <PartnerSelect />
                <Submit />
              </form>
            )}

            {mode === "medical" && (
              <form action={actionLogMedical} onSubmit={close} className="space-y-3">
                <AnimalSelect animals={animals} />
                <div>
                  <label className={label}>Event type</label>
                  <select name="eventType" className={field} required>
                    {["Vaccine", "Deworming", "Ultrasound", "Surgery", "General"].map((e) => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Notes" name="notes" />
                <Submit />
              </form>
            )}

            {mode === "breeding" && (
              <form action={actionRecordBreeding} onSubmit={close} className="space-y-3">
                <div>
                  <label className={label}>Female</label>
                  <select name="femaleId" className={field} required>
                    {animals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label="Buck name" name="buckName" required />
                <Field label="Date crossed" name="dateCrossed" type="date" defaultValue={todayIso()} required />
                <Field label="Notes" name="notes" />
                <p className="text-xs text-stone-500">Due date auto-calculated as +150 days.</p>
                <Submit />
              </form>
            )}

            {mode === "sell" && (
              <form action={actionRecordLivestockSale} onSubmit={close} className="space-y-3">
                <AnimalSelect animals={animals} />
                <AnimalSelect animals={animals} optional name="additionalAnimalId" fieldLabel="Second goat (optional)" />
                <Field label="Sale date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Gross sale price (PKR)" name="grossSalePrice" type="number" required />
                <Field label="Delivery deducted from proceeds" name="deliveryCost" type="number" defaultValue="0" />
                <div>
                  <label className={label}>Cash received by</label>
                  <select name="receivedBy" className={field} required>
                    <option value="Monis">Monis</option>
                    <option value="Saad">Saad</option>
                  </select>
                </div>
                <Field label="Notes" name="notes" />
                <p className="text-xs text-stone-500">
                  Records one partner&apos;s half in the ledger (sheet convention). Dashboard shows full net
                  proceeds (2×). Examples: Brownie 78k → −39k adj; Bhola 25k − 1k delivery → −12k adj;
                  Bilorani+Bruno 65k → −32.5k adj (log delivery separately if not deducted from proceeds).
                </p>
                <Submit />
              </form>
            )}

            {mode === "status" && (
              <form action={actionChangeStatus} onSubmit={close} className="space-y-3">
                <AnimalSelect animals={animals} />
                <div>
                  <label className={label}>Status</label>
                  <select name="status" className={field} required>
                    {["Active", "Died", "Sold", "Slaughtered", "Gone"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Field label="Out date" name="outDate" type="date" defaultValue={todayIso()} />
                <p className="text-xs text-stone-500">
                  For sales with partner split, use &quot;Sell Goat&quot; instead.
                </p>
                <Submit />
              </form>
            )}

            {mode === "transfer" && (
              <form action={actionPartnerTransfer} onSubmit={close} className="space-y-3">
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Amount" name="amount" type="number" required />
                <div>
                  <label className={label}>Direction</label>
                  <select name="direction" className={field} required>
                    <option value="from_monis">Received from Monis</option>
                    <option value="to_monis">Sent to Monis</option>
                  </select>
                </div>
                <Field label="Notes" name="notes" />
                <Submit />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function modeLabel(m: Mode) {
  switch (m) {
    case "expense":
      return "Log Expense";
    case "palai":
      return "Palai Payment";
    case "buy":
      return "Buy Goat";
    case "medical":
      return "Log Medical";
    case "breeding":
      return "Record Breeding";
    case "sell":
      return "Sell Goat";
    case "status":
      return "Change Status";
    case "transfer":
      return "Partner Transfer";
    default:
      return "Quick Entry";
  }
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={label}>{props.label}</label>
      <input
        className={field}
        name={props.name}
        type={props.type || "text"}
        defaultValue={props.defaultValue}
        required={props.required}
      />
    </div>
  );
}

function PartnerSelect() {
  return (
    <div>
      <label className={label}>Who paid</label>
      <select name="paidBy" className={field} required>
        <option>Saad</option>
        <option>Monis</option>
      </select>
    </div>
  );
}

function AnimalSelect({
  animals,
  optional,
  name = "animalId",
  fieldLabel,
}: {
  animals: AnimalOption[];
  optional?: boolean;
  name?: string;
  fieldLabel?: string;
}) {
  return (
    <div>
      <label className={label}>{fieldLabel ?? `Goat ${optional ? "(optional)" : ""}`}</label>
      <select name={name} className={field} required={!optional}>
        {optional && <option value="">—</option>}
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Submit() {
  return (
    <button
      type="submit"
      className="w-full rounded-xl bg-emerald-700 py-3 text-base font-semibold text-white"
    >
      Save
    </button>
  );
}
