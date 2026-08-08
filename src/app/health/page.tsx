import Link from "next/link";
import { Suspense } from "react";
import { loadHerdHealthData } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { parseHealthTab, type DueStatus, type HerdHealthData, type HerdHealthSummary } from "@/lib/livestock/herd-health";
import { animalLinkFromHealth, healthTabForActionKind } from "@/lib/livestock/health-nav";
import type { HealthTab } from "@/lib/livestock/health-tabs";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { HealthFilters } from "@/components/HealthFilters";
import type { QuickEntryProps } from "@/components/QuickEntry";

export const dynamic = "force-dynamic";

function statusBadge(
  status:
    | DueStatus
    | "overdue"
    | "due_soon"
    | "pending"
    | "completed"
    | "in_window"
    | "confirmed"
    | undefined
) {
  const key = status ?? "completed";
  const styles: Record<string, string> = {
    overdue: "bg-red-100 text-red-800",
    due_soon: "bg-amber-100 text-amber-900",
    in_window: "bg-amber-100 text-amber-900",
    never: "bg-stone-200 text-stone-700",
    ok: "bg-emerald-100 text-emerald-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    pending: "bg-sky-100 text-sky-800",
    completed: "bg-stone-100 text-stone-600",
  };
  const labels: Record<string, string> = {
    overdue: "Overdue",
    due_soon: "Due soon",
    in_window: "Ultrasound window",
    never: "Never",
    ok: "OK",
    confirmed: "Confirmed",
    pending: "Pending",
    completed: "Done",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${styles[key] ?? styles.completed}`}>
      {labels[key] ?? "—"}
    </span>
  );
}

function urgencyDot(urgency: "overdue" | "due_soon") {
  return (
    <span
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgency === "overdue" ? "bg-red-500" : "bg-amber-500"}`}
    />
  );
}

export default function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<HealthPageFallback />}>
      <HealthPageContent searchParams={searchParams} />
    </Suspense>
  );
}

function HealthPageFallback() {
  return (
    <main className="px-4 pt-6">
      <div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />
      <div className="mb-4 h-10 animate-pulse rounded-xl bg-stone-200" />
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
      </div>
      <BottomNav active="health" />
    </main>
  );
}

async function HealthPageContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseHealthTab(sp.tab);
  const data = await loadHerdHealthData();
  const { herd } = data;
  const { summary } = herd;

  return (
    <HealthPageView tab={tab} herd={herd} summary={summary} quickEntry={data.quickEntry} />
  );
}

function HealthPageView({
  tab,
  herd,
  summary,
  quickEntry,
}: {
  tab: ReturnType<typeof parseHealthTab>;
  herd: HerdHealthData;
  summary: HerdHealthSummary;
  quickEntry: QuickEntryProps;
}) {
  return (
    <main className="px-4 pt-6">
      <AppHeader
        eyebrow="Livestock"
        title="Herd Health"
        subtitle={`${summary.activeCount} active goats · Ultrasound day 40–75 · PPR yearly · ETV & deworm twice yearly`}
      />

      <Suspense fallback={<div className="mb-4 h-10 animate-pulse rounded-xl bg-stone-200" />}>
        <HealthFilters />
      </Suspense>

      {tab === "overview" && (
        <>
          {herd.actions.length > 0 && (
            <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
              <h2 className="mb-2 text-sm font-bold text-stone-800">
                Action required ({herd.actions.length})
              </h2>
              <ul className="space-y-2">
                {herd.actions.map((a, i) => (
                  <li key={`${a.kind}-${a.animalId}-${i}`}>
                    <Link
                      href={animalLinkFromHealth(a.animalId, healthTabForActionKind(a.kind))}
                      className="flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-sm ring-1 ring-stone-100"
                    >
                      {urgencyDot(a.urgency)}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-stone-900">{a.label}</p>
                        <p className="text-stone-600">
                          {a.kind === "vaccine" && "Vaccination · "}
                          {a.kind === "deworm" && "Deworming · "}
                          {a.kind === "ultrasound" && "Ultrasound · "}
                          {a.kind === "breeding" && "Kidding due · "}
                          {a.detail}
                        </p>
                      </div>
                      {statusBadge(a.urgency)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-4 grid grid-cols-2 gap-3">
            <StatCard label="Pending pregnancies" value={String(summary.pendingPregnancies)} />
            <StatCard
              label="Ultrasound due"
              value={String(summary.ultrasoundDue)}
              warn={summary.ultrasoundDue > 0}
            />
            <StatCard
              label="Ultrasound overdue"
              value={String(summary.ultrasoundOverdue)}
              warn={summary.ultrasoundOverdue > 0}
            />
            <StatCard
              label="Avg weight"
              value={summary.avgWeightKg != null ? `${summary.avgWeightKg} kg` : "—"}
            />
            <StatCard
              label="Vaccine overdue"
              value={String(summary.overdueVaccines)}
              warn={summary.overdueVaccines > 0}
            />
            <StatCard
              label="Deworm overdue"
              value={String(summary.overdueDeworm)}
              warn={summary.overdueDeworm > 0}
            />
            <StatCard label="Never vaccinated" value={String(summary.neverVaccinated)} />
            <StatCard label="Never weighed" value={String(summary.neverWeighed)} />
          </section>

          {summary.breedingDelivered + summary.breedingFailed > 0 && (
            <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
              <h2 className="mb-2 text-sm font-bold">Breeding outcomes</h2>
              <div className="flex gap-4 text-sm">
                <p>
                  <span className="font-semibold text-emerald-700">{summary.breedingDelivered}</span>{" "}
                  delivered
                </p>
                <p>
                  <span className="font-semibold text-red-700">{summary.breedingFailed}</span> lost
                </p>
                <p className="text-stone-500">
                  {Math.round(
                    (summary.breedingDelivered /
                      (summary.breedingDelivered + summary.breedingFailed)) *
                      100
                  )}
                  % success
                </p>
              </div>
            </section>
          )}

          <RecentActivity medical={herd.recentMedical} weights={herd.recentWeights} />
        </>
      )}

      {tab === "breeding" && (
        <>
          {herd.ultrasoundDue.length > 0 && (
            <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-200">
              <h2 className="mb-2 text-sm font-bold text-amber-900">
                Needs ultrasound ({herd.ultrasoundDue.length})
              </h2>
              <p className="mb-3 text-xs text-stone-600">
                Scan between day 40 and day 75 after crossing. Set ultrasound date on the goat profile
                after the vet visit.
              </p>
              <ul className="divide-y divide-stone-100">
                {herd.ultrasoundDue.map((b) => (
                  <li key={b.event.id} className="py-3">
                    <Link
                      href={animalLinkFromHealth(b.event.female_animal_id, "breeding")}
                      className="block"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{b.femaleLabel}</p>
                          <p className="text-sm text-stone-600">
                            {b.event.buck_name || "Unknown buck"} · crossed{" "}
                            {formatDate(b.event.date_crossed)}
                          </p>
                          {b.daysSinceCrossed != null && (
                            <p className="text-sm text-stone-500">
                              Day {b.daysSinceCrossed} since crossing
                              {b.ultrasoundWindowStart && b.ultrasoundWindowEnd && (
                                <span>
                                  {" "}
                                  · window {formatDate(b.ultrasoundWindowStart)} –{" "}
                                  {formatDate(b.ultrasoundWindowEnd)}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        {statusBadge(
                          b.ultrasoundStatus === "overdue" ? "overdue" : "in_window"
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
            <h2 className="mb-2 text-sm font-bold">Breeding records</h2>
          {herd.breeding.length === 0 ? (
            <p className="text-sm text-stone-500">No breeding records yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {herd.breeding.map((b) => (
                <li key={b.event.id} className="py-3">
                  <Link href={animalLinkFromHealth(b.event.female_animal_id, "breeding")} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{b.femaleLabel}</p>
                        <p className="text-sm text-stone-600">
                          {b.event.buck_name || "Unknown buck"} · crossed{" "}
                          {formatDate(b.event.date_crossed)}
                        </p>
                        {b.event.expected_due_date && (
                          <p className="text-sm text-stone-500">
                            Due {formatDate(b.event.expected_due_date)}
                            {b.daysUntilDue != null && b.status !== "completed" && (
                              <span>
                                {" "}
                                · {b.daysUntilDue < 0 ? `${Math.abs(b.daysUntilDue)}d overdue` : `${b.daysUntilDue}d left`}
                              </span>
                            )}
                          </p>
                        )}
                        {b.event.ultrasound_date && (
                          <p className="text-sm text-emerald-700">
                            Ultrasound {formatDate(b.event.ultrasound_date)}
                          </p>
                        )}
                        {b.ultrasoundStatus === "in_window" || b.ultrasoundStatus === "overdue" ? (
                          <p className="text-sm font-medium text-amber-800">
                            Ultrasound needed · day {b.daysSinceCrossed}
                          </p>
                        ) : null}
                      </div>
                      {statusBadge(b.status)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </section>
        </>
      )}

      {tab === "vaccine" && (
        <>
          <DueList
            title="PPR (once a year)"
            items={herd.vaccines.filter((v) => v.vaccineKind === "ppr")}
            emptyMessage="No active goats."
            healthTab="vaccine"
          />
          <DueList
            title="ETV (twice a year)"
            items={herd.vaccines.filter((v) => v.vaccineKind === "etv")}
            emptyMessage="No active goats."
            healthTab="vaccine"
          />
        </>
      )}

      {tab === "deworm" && (
        <DueList
          title="Deworming (twice a year)"
          items={herd.deworming}
          emptyMessage="No active goats."
          healthTab="deworm"
        />
      )}

      {tab === "weight" && (
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <h2 className="mb-2 text-sm font-bold">Latest weights</h2>
          {herd.weights.length === 0 ? (
            <p className="text-sm text-stone-500">No active goats.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {herd.weights.map((w) => (
                <li key={w.animalId} className="flex items-center justify-between gap-2 py-3">
                  <Link href={animalLinkFromHealth(w.animalId, "weight")} className="min-w-0 flex-1">
                    <p className="font-semibold">{w.label}</p>
                    <p className="text-sm text-stone-500">
                      {w.latest ? `Last weighed ${formatDate(w.latest.weighed_on)}` : "Never weighed"}
                    </p>
                  </Link>
                  <div className="text-right">
                    {w.latest ? (
                      <>
                        <p className="font-bold">{w.latest.weight_kg} kg</p>
                        {w.changeKg != null && (
                          <p
                            className={`text-xs font-semibold ${
                              w.changeKg >= 0 ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {w.changeKg >= 0 ? "+" : ""}
                            {w.changeKg} kg
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-stone-400">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <QuickEntryLoader {...quickEntry} />
      <BottomNav active="health" />
    </main>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 shadow-sm ring-1 ${
        warn ? "bg-red-50 ring-red-200" : "bg-white ring-stone-200"
      }`}
    >
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-red-800" : ""}`}>{value}</p>
    </div>
  );
}

function DueList({
  title,
  items,
  emptyMessage,
  healthTab,
}: {
  title: string;
  items: Array<{
    animalId: number;
    label: string;
    lastDate: string | null;
    dueDate: string | null;
    daysUntilDue: number | null;
    status: DueStatus;
  }>;
  emptyMessage: string;
  healthTab: HealthTab;
}) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((item) => (
            <li key={item.animalId} className="flex items-start justify-between gap-2 py-3">
              <Link href={animalLinkFromHealth(item.animalId, healthTab)} className="min-w-0 flex-1">
                <p className="font-semibold">{item.label}</p>
                <p className="text-sm text-stone-500">
                  Last: {formatDate(item.lastDate)}
                  {item.dueDate && <> · Due {formatDate(item.dueDate)}</>}
                </p>
              </Link>
              <div className="text-right">
                {statusBadge(item.status)}
                {item.daysUntilDue != null && item.status !== "never" && item.status !== "ok" && (
                  <p className="mt-1 text-xs text-stone-500">
                    {item.daysUntilDue < 0
                      ? `${Math.abs(item.daysUntilDue)}d overdue`
                      : `${item.daysUntilDue}d left`}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentActivity({
  medical,
  weights,
}: {
  medical: Array<{ id: string; animalLabel: string; event_type: string; date: string | null; notes: string | null }>;
  weights: Array<{ id: string; animalLabel: string; weighed_on: string; weight_kg: number }>;
}) {
  const combined = [
    ...medical.map((m) => ({
      id: m.id,
      date: m.date || "",
      label: m.animalLabel,
      detail: m.event_type,
      sub: m.notes,
    })),
    ...weights.map((w) => ({
      id: w.id,
      date: w.weighed_on,
      label: w.animalLabel,
      detail: `${w.weight_kg} kg`,
      sub: null as string | null,
    })),
  ]
    .filter((r) => r.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  if (combined.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-2 text-sm font-bold">Recent activity</h2>
      <ul className="divide-y divide-stone-100">
        {combined.map((r) => (
          <li key={r.id} className="flex justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium">{r.label}</p>
              <p className="text-stone-600">
                {r.detail}
                {r.sub && <span className="text-stone-500"> — {r.sub}</span>}
              </p>
            </div>
            <span className="shrink-0 text-stone-500">{formatDate(r.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
