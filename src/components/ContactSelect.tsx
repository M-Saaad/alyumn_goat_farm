"use client";

import { useEffect, useState } from "react";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const labelCls = "block text-sm font-medium text-stone-700";

export type ContactOption = { id: string; name: string };

const NEW = "__new__";

/**
 * Dropdown of existing contacts with an "add new" option that reveals a text input.
 * Submits the resolved name via a hidden field (backend findOrCreate stays unchanged).
 */
export function ContactSelect({
  label,
  name,
  options,
  defaultValue,
  required,
  allowEmpty,
  emptyLabel = "—",
  addNewLabel = "+ Add new",
  onSelectionChange,
}: {
  label: string;
  name: string;
  options: ContactOption[];
  defaultValue?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  addNewLabel?: string;
  /** Called with the selected name (or "" for empty). Useful for conditional UI. */
  onSelectionChange?: (name: string, isNew: boolean) => void;
}) {
  const initial =
    defaultValue && options.some((o) => o.name === defaultValue)
      ? defaultValue
      : defaultValue
        ? NEW
        : allowEmpty
          ? ""
          : options[0]?.name ?? NEW;

  const [selected, setSelected] = useState(initial);
  const [newName, setNewName] = useState(
    defaultValue && !options.some((o) => o.name === defaultValue) ? defaultValue : ""
  );

  const isNew = selected === NEW;
  const resolved = isNew ? newName.trim() : selected;

  useEffect(() => {
    onSelectionChange?.(resolved, isNew);
    // Only notify when selection/name changes; avoid depending on callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, isNew]);

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        className={field}
        value={selected}
        required={required && !isNew}
        onChange={(e) => {
          setSelected(e.target.value);
          if (e.target.value !== NEW) setNewName("");
        }}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.name}
          </option>
        ))}
        <option value={NEW}>{addNewLabel}</option>
      </select>
      {isNew && (
        <input
          className={`${field} mt-2`}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter name"
          required={required}
        />
      )}
      <input type="hidden" name={name} value={resolved} />
    </div>
  );
}

export type BuckOption =
  | { kind: "animal"; id: number; label: string }
  | { kind: "name"; name: string };

/**
 * Buck picker: farm male goats + historical buck names + "other" text input.
 * Submits buckName (always) and optional maleAnimalId when a farm buck is picked.
 */
export function BuckSelect({
  maleAnimals,
  pastNames,
  defaultBuckName,
  defaultMaleAnimalId,
  label = "Buck",
  optional = false,
  nameField = "buckName",
  idField = "maleAnimalId",
}: {
  maleAnimals: { id: number; label: string }[];
  pastNames: string[];
  defaultBuckName?: string;
  defaultMaleAnimalId?: number | null;
  label?: string;
  optional?: boolean;
  nameField?: string;
  idField?: string;
}) {
  const animalOpts = maleAnimals.map((a) => ({
    value: `animal:${a.id}`,
    label: a.label,
  }));
  const nameOpts = pastNames
    .filter((n) => n.trim())
    .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
    .filter(
      (n) =>
        !maleAnimals.some(
          (a) => a.label.toLowerCase() === n.toLowerCase() || String(a.id) === n
        )
    )
    .map((n) => ({ value: `name:${n}`, label: n }));

  let initial = optional ? "" : NEW;
  if (defaultMaleAnimalId != null && maleAnimals.some((a) => a.id === defaultMaleAnimalId)) {
    initial = `animal:${defaultMaleAnimalId}`;
  } else if (defaultBuckName) {
    const byAnimal = maleAnimals.find(
      (a) => a.label.toLowerCase() === defaultBuckName.toLowerCase()
    );
    if (byAnimal) initial = `animal:${byAnimal.id}`;
    else if (pastNames.some((n) => n.toLowerCase() === defaultBuckName.toLowerCase())) {
      initial = `name:${defaultBuckName}`;
    } else {
      initial = NEW;
    }
  } else if (animalOpts[0]) {
    initial = animalOpts[0].value;
  } else if (nameOpts[0]) {
    initial = nameOpts[0].value;
  } else if (!optional) {
    initial = NEW;
  }

  const [selected, setSelected] = useState(initial);
  const [otherName, setOtherName] = useState(
    initial === NEW && defaultBuckName ? defaultBuckName : ""
  );

  let buckName = "";
  let maleAnimalId = "";
  if (!selected) {
    buckName = "";
    maleAnimalId = "";
  } else if (selected.startsWith("animal:")) {
    const id = Number(selected.slice("animal:".length));
    const a = maleAnimals.find((m) => m.id === id);
    buckName = a?.label ?? "";
    maleAnimalId = String(id);
  } else if (selected.startsWith("name:")) {
    buckName = selected.slice("name:".length);
  } else {
    buckName = otherName.trim();
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        className={field}
        value={selected}
        required={!optional && selected !== NEW}
        onChange={(e) => {
          setSelected(e.target.value);
          if (e.target.value !== NEW) setOtherName("");
        }}
      >
        {optional && <option value="">—</option>}
        {animalOpts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {nameOpts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={NEW}>+ Other buck</option>
      </select>
      {selected === NEW && (
        <input
          className={`${field} mt-2`}
          type="text"
          value={otherName}
          onChange={(e) => setOtherName(e.target.value)}
          placeholder="Buck name"
          required
        />
      )}
      <input type="hidden" name={nameField} value={buckName} />
      <input type="hidden" name={idField} value={maleAnimalId} />
    </div>
  );
}
