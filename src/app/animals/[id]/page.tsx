import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, animalLabel, contactName } from "@/lib/actions";
import { formatPkr } from "@/lib/format";
import { signedMediaUrl } from "@/lib/media/upload";
import { isSupabaseDb } from "@/lib/db";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntry } from "@/components/QuickEntry";
import { AnimalMediaUpload } from "@/components/AnimalMediaUpload";

export const dynamic = "force-dynamic";

export default async function AnimalProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const animalId = Number(id);
  const db = await getDb();
  const animal = db.animals.find((a) => a.id === animalId);
  if (!animal) notFound();

  const medical = db.medical_events
    .filter((m) => m.animal_id === animalId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const breeding = db.breeding_events
    .filter((b) => b.female_animal_id === animalId)
    .sort((a, b) => (b.date_crossed || "").localeCompare(a.date_crossed || ""));
  const saleMeta = (db.livestock_sales ?? []).filter((s) => s.animal_ids.includes(animalId));
  const saleTxIds = new Set(saleMeta.map((s) => s.transaction_id));
  const txs = db.transactions
    .filter((t) => t.animal_id === animalId || saleTxIds.has(t.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const weights = db.weight_logs
    .filter((w) => w.animal_id === animalId)
    .sort((a, b) => b.weighed_on.localeCompare(a.weighed_on));
  const media = (db.animal_media ?? [])
    .filter((m) => m.animal_id === animalId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const mediaWithUrls = await Promise.all(
    media.map(async (m) => ({
      ...m,
      url: await signedMediaUrl(m.storage_path),
    }))
  );
  const supabaseEnabled = isSupabaseDb();

  const options = db.animals
    .filter((a) => a.status === "Active")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  return (
    <main className="px-4 pt-6">
      <Link href="/animals" className="text-sm font-semibold text-emerald-700">
        ← Goats
      </Link>

      <header className="mt-2 mb-4">
        <h1 className="text-2xl font-bold">{animalLabel(animal)}</h1>
        <p className="text-stone-500">
          {[animal.breed, animal.sex, animal.status, contactName(db, animal.owner_id)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">Photos &amp; videos ({mediaWithUrls.length})</h2>
        {mediaWithUrls.length === 0 ? (
          <p className="text-sm text-stone-500">No media yet.</p>
        ) : (
          <ul className="space-y-3">
            {mediaWithUrls.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-xl bg-stone-50">
                {m.url ? (
                  m.media_type === "video" ? (
                    <video src={m.url} controls className="max-h-64 w-full bg-black object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.caption || "Goat media"}
                      className="max-h-64 w-full object-cover"
                    />
                  )
                ) : (
                  <p className="p-3 text-sm text-stone-500">Could not load media</p>
                )}
                {m.caption && <p className="px-3 py-2 text-xs text-stone-600">{m.caption}</p>}
              </li>
            ))}
          </ul>
        )}
        {supabaseEnabled ? (
          <AnimalMediaUpload animalId={animalId} />
        ) : (
          <p className="mt-3 text-xs text-stone-500">
            Media upload is available when Supabase is configured.
          </p>
        )}
      </section>

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">Purchase</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-stone-500">Price</dt>
            <dd className="font-semibold">{formatPkr(animal.price)}</dd>
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
            <dd>{contactName(db, animal.purchased_from)}</dd>
          </div>
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

      <QuickEntry animals={options} />
      <BottomNav active="goats" />
    </main>
  );
}
