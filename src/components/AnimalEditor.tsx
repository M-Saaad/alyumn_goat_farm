"use client";

import { useState } from "react";
import { actionUpdateAnimal } from "@/lib/server-actions";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ContactSelect, type ContactOption } from "@/components/ContactSelect";
import type { AnimalBreed, AnimalSex } from "@/lib/types";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

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
  const [showPalaiRate, setShowPalaiRate] = useState(
    Boolean(animal.ownerName) && !["Farm", "Monis", "Saad"].includes(animal.ownerName)
  );

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
              <label className={labelCls}>Age at purchase</label>
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
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                name="homeBred"
                value="true"
                defaultChecked={animal.home_bred}
                className="h-4 w-4 rounded border-stone-300"
              />
              Home bred
            </label>
            <SubmitButton label="Save details" />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
