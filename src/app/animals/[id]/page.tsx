import Link from "next/link";
import { notFound } from "next/navigation";
import { animalLabel } from "@/lib/labels";
import { formatPkr, formatDate, todayIso } from "@/lib/format";
import { animalParentLabel, sireLabel } from "@/lib/livestock/animal-parents";
import { isSupabaseDb } from "@/lib/db";
import { isSoldOnPalaiSale, saleReceiptAmount } from "@/lib/livestock/cancel-sale";
import { loadAnimalProfileData, contactNameFrom } from "@/lib/db/queries";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { AnimalEditor } from "@/components/AnimalEditor";
import { AnimalMediaGallery } from "@/components/AnimalMediaGallery";
import {
  PurchaseInstallmentCard,
  SaleInstallmentCard,
} from "@/components/InstallmentCards";
import { DeleteAnimalButton } from "@/components/DeleteAnimalButton";
import { BreedingRecordActions } from "@/components/BreedingRecordActions";
import { backFromAnimalProfile } from "@/lib/livestock/health-nav";
import { computeUltrasoundStatus, daysSinceCrossed, breedingRecordStatusLabel, breedingTimeline } from "@/lib/livestock/breeding";
import { estimateAnimalAge } from "@/lib/livestock/age";

export const dynamic = "force-dynamic";

export default async function AnimalProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const back = backFromAnimalProfile(sp);
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
  const ownerContact = data.contacts.find((c) => c.id === animal.owner_id);
  const isCustomerOwner = ownerContact?.type === "Customer";
  const ageEstimate = estimateAnimalAge(animal, todayIso());
  const sale = saleMeta[0];
  const purchasePaid =
    data.purchase_agreement?.amount_paid ??
    data.transactions
      .filter(
        (t) =>
          t.kind === "cost" &&
          t.category === "Livestock Purchase" &&
          t.animal_id === animalId
      )
      .reduce((sum, t) => sum + t.amount, 0);

  const saleReceipts = sale
    ? txs
        .filter(
          (t) =>
            t.category === "Livestock Sale" &&
            (t.livestock_sale_id === sale.id || sale.transaction_id === t.id)
        )
        .map((t) => ({
          id: t.id,
          date: t.date,
          amount: saleReceiptAmount(t.amount),
          notes: t.notes,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <main className="px-4 pt-6">
      <Link href={back.href} className="text-sm font-semibold text-emerald-700">
        ← {back.label}
      </Link>

      <header className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{animalLabel(animal)}</h1>
          <p className="text-stone-500">
            {[animal.breed, animal.sex, animal.status, animal.home_bred ? "Born" : null, ownerName]
              .filter(Boolean)
              .join(" · ")}
            {ageEstimate ? ` · ${ageEstimate.label} (est. ${ageEstimate.teethLabel})` : ""}
            {sale && isSoldOnPalaiSale(sale) ? " · Sold on palai" : ""}
          </p>
        </div>
        <DeleteAnimalButton animalId={animal.id} label={animalLabel(animal)} />
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
          dam_id: animal.dam_id,
          sire_id: animal.sire_id,
          sire_name: animal.sire_name,
          status: animal.status,
          date_of_purchase: animal.date_of_purchase,
          price: animal.price,
          purchase_paid: purchasePaid,
          out_date: animal.out_date,
          sold_price: animal.sold_price,
          sale: sale
            ? {
                date: sale.date,
                gross_sale_price: sale.gross_sale_price,
                delivery_cost: sale.delivery_cost,
                amount_received: sale.amount_received,
              }
            : null,
        }}
        vendors={data.quickEntry.vendors}
        ownerOptions={data.quickEntry.ownerOptions}
        damAnimals={data.quickEntry.damAnimals ?? data.quickEntry.femaleAnimals ?? []}
        maleAnimals={data.quickEntry.maleAnimals}
        pastBuckNames={data.quickEntry.pastBuckNames}
      />

      <AnimalMediaGallery
        media={media}
        animalId={animalId}
        supabaseEnabled={supabaseEnabled}
      />

      {data.purchase_agreement && !animal.home_bred ? (
        <PurchaseInstallmentCard
          animalId={animalId}
          agreement={data.purchase_agreement}
          balance={data.purchase_balance}
          isCustomerOwner={isCustomerOwner}
        />
      ) : data.purchase_balance > 0 && !animal.home_bred ? (
        <section className="mb-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">Outstanding purchase balance</p>
          <p>{formatPkr(data.purchase_balance)} remaining on agreed price {formatPkr(animal.price)}</p>
          <p className="mt-1 text-xs text-amber-800">
            Log further livestock purchase payments from Transactions or Quick Entry.
          </p>
        </section>
      ) : null}

      {sale && (
        <SaleInstallmentCard
          animalId={animalId}
          sale={sale}
          balance={data.sale_balance ?? 0}
          receipts={saleReceipts}
          soldOnPalai={isSoldOnPalaiSale(sale)}
        />
      )}

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="mb-2 text-sm font-bold">{animal.home_bred ? "Birth" : "Purchase"}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {!animal.home_bred && (
            <>
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
                <dd>{formatDate(animal.date_of_purchase)}</dd>
              </div>
              <div>
                <dt className="text-stone-500">From</dt>
                <dd>{contactNameFrom(data.contacts, animal.purchased_from)}</dd>
              </div>
              {animal.age_at_purchase && (
                <div>
                  <dt className="text-stone-500">Age at purchase</dt>
                  <dd>{animal.age_at_purchase}</dd>
                </div>
              )}
            </>
          )}
          {animal.home_bred && (
            <>
              <div>
                <dt className="text-stone-500">Born</dt>
                <dd>{formatDate(animal.date_of_purchase)}</dd>
              </div>
              {animal.age_at_purchase && (
                <div>
                  <dt className="text-stone-500">Age at birth</dt>
                  <dd>{animal.age_at_purchase}</dd>
                </div>
              )}
              <div>
                <dt className="text-stone-500">Dam</dt>
                <dd>{animalParentLabel(data.animals, animal.dam_id)}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Sire</dt>
                <dd>{sireLabel(animal, data.animals)}</dd>
              </div>
              {animal.sold_price != null && (
                <div>
                  <dt className="text-stone-500">Sold price</dt>
                  <dd className="font-semibold">{formatPkr(animal.sold_price)}</dd>
                </div>
              )}
            </>
          )}
          {ageEstimate && (
            <>
              <div>
                <dt className="text-stone-500">Current age (est.)</dt>
                <dd>{ageEstimate.label}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Estimated teeth</dt>
                <dd>{ageEstimate.teethLabel}</dd>
              </div>
            </>
          )}
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Medical ({medical.length})</h2>
          <Link href="/health?tab=vaccine" className="text-xs font-semibold text-emerald-700">
            Schedule →
          </Link>
        </div>
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
                <span className="shrink-0 text-stone-500">{formatDate(m.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="breeding" className="mb-3 scroll-mt-20 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Breeding ({breeding.length})</h2>
          <Link href="/health?tab=breeding" className="text-xs font-semibold text-emerald-700">
            Herd view →
          </Link>
        </div>
        {breeding.length === 0 ? (
          <p className="text-sm text-stone-500">No breeding records.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {breeding.map((b) => {
              const today = todayIso();
              const ultrasoundStatus = computeUltrasoundStatus(b, today);
              const crossedDays =
                b.date_crossed ? daysSinceCrossed(b.date_crossed, today) : null;
              const timeline = breedingTimeline(b, undefined, today);
              const timelineLabel =
                timeline?.type === "delivered"
                  ? `Delivered ${formatDate(timeline.date)}`
                  : timeline?.type === "stillbirth"
                    ? `Stillbirth ${formatDate(timeline.date)}`
                    : timeline?.type === "due"
                        ? `Due ${formatDate(timeline.date)}`
                        : null;
              return (
              <li key={b.id} className="border-b border-stone-100 pb-2">
                <p className="font-medium">
                  {b.buck_name || "Unknown buck"} · {breedingRecordStatusLabel(b, today)}
                </p>
                <p className="text-stone-500">
                  Crossed {formatDate(b.date_crossed)}
                  {timelineLabel ? ` · ${timelineLabel}` : ""}
                </p>
                {b.notes && <p className="text-xs text-stone-500">{b.notes}</p>}
                <BreedingRecordActions
                  event={{
                    id: b.id,
                    femaleId: animalId,
                    buck_name: b.buck_name,
                    male_animal_id: b.male_animal_id,
                    date_crossed: b.date_crossed,
                    expected_due_date: b.expected_due_date,
                    delivered_date: b.delivered_date,
                    ultrasound_date: b.ultrasound_date,
                    fetus_count: b.fetus_count,
                    outcome: b.outcome,
                    status: b.status,
                    notes: b.notes,
                  }}
                  ultrasoundStatus={ultrasoundStatus}
                  daysSinceCrossed={crossedDays}
                  maleAnimals={data.quickEntry.maleAnimals}
                  pastBuckNames={data.quickEntry.pastBuckNames}
                  supabaseEnabled={supabaseEnabled}
                />
              </li>
              );
            })}
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
                    {formatDate(t.date)} · {t.category}
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

      <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Weight ({weights.length})</h2>
          <Link href="/health?tab=weight" className="text-xs font-semibold text-emerald-700">
            Herd view →
          </Link>
        </div>
        {weights.length === 0 ? (
          <p className="text-sm text-stone-500">No weight records yet. Use Quick Entry → Log Weight.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {weights.map((w) => (
              <li key={w.id} className="flex justify-between">
                <span>{formatDate(w.weighed_on)}</span>
                <span className="font-semibold">{w.weight_kg} kg</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <QuickEntryLoader {...data.quickEntry} />
      <BottomNav active={sp.from === "health" ? "health" : "goats"} />
    </main>
  );
}
