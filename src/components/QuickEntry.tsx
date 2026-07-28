"use client";

import { useEffect, useState } from "react";
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
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { BuckSelect, ContactSelect, type ContactOption } from "@/components/ContactSelect";

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

export type QuickEntryProps = {
  animals: AnimalOption[];
  femaleAnimals?: AnimalOption[];
  vendors: ContactOption[];
  customers: ContactOption[];
  ownerOptions: ContactOption[];
  maleAnimals: AnimalOption[];
  pastBuckNames: string[];
};

export function QuickEntry({
  animals,
  femaleAnimals,
  vendors,
  customers,
  ownerOptions,
  maleAnimals,
  pastBuckNames,
}: QuickEntryProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const females = femaleAnimals ?? animals;

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
        className="fixed bottom-20 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl font-light text-white shadow-lg touch-manipulation"
        aria-label="Quick entry"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-[55] flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-stone-50 sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 p-4">
              <h2 className="text-lg font-bold text-stone-900">
                {mode ? modeLabel(mode) : "Quick Entry"}
              </h2>
              <button type="button" onClick={close} className="rounded-lg px-3 py-1 text-stone-600">
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
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
              <ActionForm action={actionLogExpense} onSuccess={close}>
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
                <SubmitButton />
              </ActionForm>
            )}

            {mode === "palai" && (
              <ActionForm action={actionRecordPalai} onSuccess={close}>
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <ContactSelect
                  label="Customer"
                  name="customerName"
                  options={customers}
                  defaultValue={customers.find((c) => c.name === "Awais")?.name ?? customers[0]?.name}
                  required
                  addNewLabel="+ Add new customer"
                />
                <Field label="Rate / goat" name="ratePerGoat" type="number" defaultValue="7000" required />
                <Field label="Goat count" name="goatCount" type="number" defaultValue="2" required />
                <Field label="Payment method" name="paymentMethod" defaultValue="Online Transfer" />
                <Field label="Notes" name="notes" />
                <p className="text-xs text-stone-500">Splits 50/50 to Monis and Saad automatically.</p>
                <SubmitButton />
              </ActionForm>
            )}

            {mode === "buy" && (
              <BuyGoatForm vendors={vendors} ownerOptions={ownerOptions} onSuccess={close} />
            )}

            {mode === "medical" && (
              <ActionForm action={actionLogMedical} onSuccess={close}>
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
                <SubmitButton />
              </ActionForm>
            )}

            {mode === "breeding" && (
              <ActionForm action={actionRecordBreeding} onSuccess={close}>
                <div>
                  <label className={label}>Female</label>
                  <select name="femaleId" className={field} required>
                    {females.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <BuckSelect maleAnimals={maleAnimals} pastNames={pastBuckNames} />
                <Field label="Date crossed" name="dateCrossed" type="date" defaultValue={todayIso()} required />
                <Field label="Notes" name="notes" />
                <p className="text-xs text-stone-500">Due date auto-calculated as +150 days.</p>
                <SubmitButton />
              </ActionForm>
            )}

            {mode === "sell" && (
              <SellGoatForm animals={animals} customers={customers} onSuccess={close} />
            )}

            {mode === "status" && (
              <ActionForm action={actionChangeStatus} onSuccess={close}>
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
                <SubmitButton />
              </ActionForm>
            )}

            {mode === "transfer" && (
              <ActionForm action={actionPartnerTransfer} onSuccess={close}>
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
                <SubmitButton />
              </ActionForm>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SellGoatForm({
  animals,
  customers,
  onSuccess,
}: {
  animals: AnimalOption[];
  customers: ContactOption[];
  onSuccess: () => void;
}) {
  const [soldOnPalai, setSoldOnPalai] = useState(false);

  return (
    <ActionForm action={actionRecordLivestockSale} onSuccess={onSuccess}>
      <AnimalSelect animals={animals} />
      <AnimalSelect
        animals={animals}
        optional
        name="additionalAnimalId"
        fieldLabel="Second goat (optional)"
      />
      <Field label="Sale date" name="date" type="date" defaultValue={todayIso()} required />
      <Field label="Gross sale price (PKR)" name="grossSalePrice" type="number" required />
      <Field
        label="Received now (PKR, optional — leave blank for full net)"
        name="amountReceivedNow"
        type="number"
      />
      <Field
        label="Delivery deducted from proceeds"
        name="deliveryCost"
        type="number"
        defaultValue="0"
      />
      <div>
        <label className={label}>Cash received by</label>
        <select name="receivedBy" className={field} required>
          <option value="Monis">Monis</option>
          <option value="Saad">Saad</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="soldOnPalai"
          value="true"
          checked={soldOnPalai}
          onChange={(e) => setSoldOnPalai(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300"
        />
        Sold on palai (buyer owns goats but they stay at the farm)
      </label>
      {soldOnPalai && (
        <>
          <ContactSelect
            label="Buyer (customer)"
            name="buyerName"
            options={customers}
            required
            addNewLabel="+ Add new customer"
          />
          <Field
            label="Palai rate per goat (PKR / month)"
            name="palaiRatePerGoat"
            type="number"
            required
          />
        </>
      )}
      <Field label="Notes" name="notes" />
      <p className="text-xs text-stone-500">
        {soldOnPalai
          ? "Goats stay Active under the buyer for palai. Sale installments and partner split still apply."
          : "Goat is marked sold immediately. Each receipt splits 50/50 in the ledger. Leave received blank to record full net proceeds now."}
      </p>
      <SubmitButton />
    </ActionForm>
  );
}

function BuyGoatForm({
  vendors,
  ownerOptions,
  onSuccess,
}: {
  vendors: ContactOption[];
  ownerOptions: ContactOption[];
  onSuccess: () => void;
}) {
  const [showPalaiRate, setShowPalaiRate] = useState(false);
  const [showCustomerPaid, setShowCustomerPaid] = useState(false);
  const [paidBy, setPaidBy] = useState<"Saad" | "Monis" | "Customer">("Saad");
  const priceOptional = showCustomerPaid && paidBy === "Customer";

  useEffect(() => {
    if (!showCustomerPaid && paidBy === "Customer") {
      setPaidBy("Saad");
    }
  }, [showCustomerPaid, paidBy]);

  return (
    <ActionForm action={actionBuyGoat} onSuccess={onSuccess}>
      <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
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
      <ContactSelect
        label="Owner"
        name="ownerName"
        options={ownerOptions}
        defaultValue="Farm"
        required
        addNewLabel="+ Add new customer"
        onSelectionChange={(name) => {
          const isCustomer =
            Boolean(name.trim()) && !["Farm", "Monis", "Saad"].includes(name);
          setShowPalaiRate(isCustomer);
          setShowCustomerPaid(isCustomer);
        }}
      />
      {showPalaiRate && <Field label="Palai rate (optional)" name="palaiRate" type="number" />}
      <ContactSelect
        label="Vendor"
        name="vendorName"
        options={vendors}
        allowEmpty
        emptyLabel="—"
        addNewLabel="+ Add new vendor"
      />
      <div>
        <label className={label}>Who paid</label>
        <select
          name="paidBy"
          className={field}
          required
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value as "Saad" | "Monis" | "Customer")}
        >
          <option value="Saad">Saad</option>
          <option value="Monis">Monis</option>
          {showCustomerPaid && <option value="Customer">Customer</option>}
        </select>
      </div>
      <Field
        label={priceOptional ? "Price (optional)" : "Total price"}
        name="price"
        type="number"
        required={!priceOptional}
      />
      <Field
        label="Paid now (optional — leave blank for full amount)"
        name="paidNow"
        type="number"
      />
      <SubmitButton label="Add goat" pendingLabel="Adding…" />
    </ActionForm>
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
      <select name="paidBy" className={field} required defaultValue="Saad">
        <option value="Saad">Saad</option>
        <option value="Monis">Monis</option>
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
