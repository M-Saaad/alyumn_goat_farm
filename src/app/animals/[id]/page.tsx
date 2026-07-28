import Link from "next/link";
import { notFound } from "next/navigation";
import { animalLabel } from "@/lib/actions";
import { formatPkr } from "@/lib/format";
import { isSupabaseDb } from "@/lib/db";
import { loadAnimalProfileData, contactNameFrom } from "@/lib/db/queries";
import { BottomNav } from "@/components/BottomNav";
import { AnimalEditor } from "@/components/AnimalEditor";
import { AnimalMediaGallery } from "@/components/AnimalMediaGallery";
import { QuickEntry } from "@/components/QuickEntryDynamic";

export const dynamic = "force-dynamic";

export default async function AnimalProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const animalId = Number(id);
  const data = await loadAnimalProfileData(animalId);
  if (!data) notFound();

  const { animal } = data;
  const medical = [...data.medical_events].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );
  const breeding = [...data.breeding_events].sort((a, b) =>
    (b.date_crossed || "").localeCompare(a.date_crossed || "")
  );
  const saleMeta = data.livestock_sales;
  const txs = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));
  const weights = [...data.weight_logs].sort((a, b) =>
    b.weighed_on.localeCompare(a.weighed_on)
  );
  const media = [...data.animal_media].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  const supabaseEnabled = isSupabaseDb();
  const ownerName = contactNameFrom(data.contacts, animal.owner_id);
  const vendorName = animal.purchased_from
    ? contactNameFrom(data.contacts, animal.purchased_from)
    : null;

  return (
    <main className="px-4 pt-6">
      <Link href="/animals" className="text-sm font-semibold text-emerald-700">
        ← Goats
      </Link>

      <header className="mt-2 mb-4">
        <h1 className="text-2xl font-bold">{animalLabel(animal)}</h1>
        <p className="text-stone-500">
          {[animal.breed, animal.sex, animal.status, ownerName]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <AnimalEditor
        animal={{
          id: animal.id,
          name: animal.name,
          breed: animal.breed,
          sex: animal.sex,
          description: animal.description,
          comment: animal.comment,
          ownerName: ownerName === "—" ? "Farm" : ownerName,
          vendorName: vendorName === "—" ? null : vendorName,
          palai_rate: animal.palai_rate,
          age_at_purchase: animal.age_at_purchase,
          home_bred: animal.home_bred,
        }}
        vendors={data.quickEntry.vendors}
        ownerOptions={data.quickEntry.ownerOptions}
      />

      <AnimalMediaGallery
        media={media}
        animalId={animalId}
        supabaseEnabled={supabaseEnabled}
      />

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">Purchase</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-stone-500">Price</dt>
            <dd className="font-semibold">
              {animal.price ? formatPkr(animal.price) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Sold price</dt>
            <dd className="font-semibold">
              {animal.sold_price != null ? formatPkr(animal.sold_price) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Purchased</dt>
            <dd>{animal.date_of_purchase || "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">From</dt>
            <dd>{contactNameFrom(data.contacts, animal.purchased_from)}</dd>
          </div>
          {animal.palai_rate != null && (
            <div>
              <dt className="text-stone-500">Palai rate</dt>
              <dd className="font-semibold">{formatPkr(animal.palai_rate)}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-stone-500">Description</dt>
            <dd>{animal.description || "—"}</dd>
          </div>
          {animal.comment && (
            <div className="col-span-2">
              <dt className="text-stone-500">Notes</dt>
              <dd>{animal.comment}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">Medical ({medical.length})</h2>
        {medical.length === 0 ? (
          <p className="text-sm text-stone-500">No medical events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {medical.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 border-b border-stone-100 pb-2">
                <span>
                  <span className="font-medium">{m.event_type}</span>
                  {m.notes && <span className="text-stone-500"> — {m.notes}</span>}
                </span>
                <span className="shrink-0 text-stone-500">{m.date || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">Breeding ({breeding.length})</h2>
        {breeding.length === 0 ? (
          <p className="text-sm text-stone-500">No breeding records.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {breeding.map((b) => (
              <li key={b.id} className="border-b border-stone-100 pb-2">
                <p className="font-medium">
                  {b.buck_name || "Unknown buck"} · {b.status || b.outcome}
                </p>
                <p className="text-stone-500">
                  Crossed {b.date_crossed || "—"} · Due {b.expected_due_date || "—"}
                </p>
                {b.notes && <p className="text-xs text-stone-500">{b.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">Linked transactions ({txs.length})</h2>
        {txs.length === 0 ? (
          <p className="text-sm text-stone-500">No linked expenses yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {txs.map((t) => {
              const sale = saleMeta.find((s) => s.transaction_id === t.id);
              return (
                <li key={t.id} className="flex justify-between gap-2">
                  <span>
                    {t.date} · {t.category}
                    {sale && (
                      <span className="block text-xs text-stone-500">
                        Net {formatPkr(sale.net_received)} (your half {formatPkr(sale.partner_share)})
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold">{formatPkr(t.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {weights.length > 0 && (
        <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <h2 className="mb-2 text-sm font-bold">Weight</h2>
          <ul className="space-y-1 text-sm">
            {weights.map((w) => (
              <li key={w.id} className="flex justify-between">
                <span>{w.weighed_on}</span>
                <span className="font-semibold">{w.weight_kg} kg</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuickEntry {...data.quickEntry} />
      <BottomNav active="goats" />
    </main>
  );
}
