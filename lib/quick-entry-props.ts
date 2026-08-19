import { animalLabel } from "@/lib/labels";
import { palaiReceivedByFromTx } from "@/lib/palai/received-by";
import { palaiServiceMonth } from "@/lib/palai/service-month";
import { getPartnerIds } from "@/lib/partner-equity/settlement";
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

  const damAnimals = db.animals
    .filter((a) => a.sex === "Female")
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

  const { monisId, saadId } = getPartnerIds(db);
  const palaiHistory = db.palai_payments
    .map((p) => {
      const customer = db.contacts.find((c) => c.id === p.customer_id);
      if (!customer) return null;
      const tx = db.transactions.find((t) => t.id === p.transaction_id);
      const receivedBy =
        tx ? palaiReceivedByFromTx(tx, monisId, saadId) : "Saad";
      return {
        id: p.id,
        transactionId: p.transaction_id ?? "",
        customerId: p.customer_id,
        customerName: customer.name,
        date: p.date,
        serviceMonth: palaiServiceMonth(p),
        ratePerGoat: p.rate_per_goat ?? 0,
        goatCount: p.goat_count ?? 0,
        totalAmount: p.total_amount,
        paymentMethod: p.payment_method,
        receivedBy,
        notes: p.notes,
      };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.transactionId));

  return {
    animals,
    femaleAnimals: femaleAnimals.length > 0 ? femaleAnimals : animals,
    damAnimals,
    vendors,
    customers,
    ownerOptions,
    maleAnimals,
    pastBuckNames,
    palaiHistory,
  };
}
