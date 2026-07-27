import { animalLabel } from "@/lib/actions";
import type { FarmDatabase } from "@/lib/types";
import type { QuickEntryProps } from "@/components/QuickEntry";
import type { ContactOption } from "@/components/ContactSelect";

/** Build QuickEntry contact/animal props from the loaded database. */
export function quickEntryPropsFromDb(db: FarmDatabase): QuickEntryProps {
  const animals = db.animals
    .filter((a) => a.status === "Active")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  const femaleAnimals = db.animals
    .filter((a) => a.status === "Active" && a.sex === "Female")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  const maleAnimals = db.animals
    .filter((a) => a.status === "Active" && a.sex === "Male")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  const vendors: ContactOption[] = db.contacts
    .filter((c) => c.type === "Vendor")
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const customers: ContactOption[] = db.contacts
    .filter((c) => c.type === "Customer")
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ownerOptions: ContactOption[] = [
    ...db.contacts
      .filter((c) => c.type === "Farm" || c.type === "Partner" || c.type === "Customer")
      .map((c) => ({ id: c.id, name: c.name })),
  ].sort((a, b) => {
    const rank = (n: string) =>
      n === "Farm" ? 0 : n === "Monis" ? 1 : n === "Saad" ? 2 : 3;
    const d = rank(a.name) - rank(b.name);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const pastBuckNames = [
    ...new Set(
      db.breeding_events
        .map((b) => b.buck_name)
        .filter((n): n is string => Boolean(n && n.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    animals,
    femaleAnimals: femaleAnimals.length > 0 ? femaleAnimals : animals,
    vendors,
    customers,
    ownerOptions,
    maleAnimals,
    pastBuckNames,
  };
}
