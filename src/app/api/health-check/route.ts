import { NextResponse } from "next/server";
import {
  loadAnimalProfileData,
  loadHomeData,
  loadAnimalsListData,
  loadHerdHealthData,
  loadTransactionsData,
} from "@/lib/db/queries";
import { isSupabaseDb } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Public diagnostics — no secrets. Hit /api/health-check when pages fail. */
export async function GET() {
  const checks: Record<string, string> = {
    mode: isSupabaseDb() ? "supabase" : "json",
    env_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    env_anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "missing",
    env_service: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
  };

  const loaders = [
    ["home", loadHomeData],
    ["animals", loadAnimalsListData],
    ["health", loadHerdHealthData],
    ["transactions", loadTransactionsData],
  ] as const;

  let loadersOk = true;
  for (const [name, fn] of loaders) {
    try {
      await fn();
      checks[name] = "ok";
    } catch (e) {
      loadersOk = false;
      checks[name] = e instanceof Error ? e.message : "error";
    }
  }

  try {
    const { herd } = await loadHerdHealthData();
    const samples = herd.breeding.filter((row) => row.event).slice(0, 5);
    for (const row of samples) {
      const event = row.event!;
      const profile = await loadAnimalProfileData(row.femaleId);
      if (!profile) {
        throw new Error(`animal ${row.femaleId} not found`);
      }
      if (!profile.breeding_events.some((b) => b.id === event.id)) {
        throw new Error(`breeding ${event.id} missing on profile`);
      }
    }
    checks.breeding_profiles = samples.length > 0 ? `ok (${samples.length} sampled)` : "ok (none)";
  } catch (e) {
    loadersOk = false;
    checks.breeding_profiles = e instanceof Error ? e.message : "error";
  }

  const envOk =
    checks.env_url === "set" &&
    checks.env_anon === "set" &&
    (checks.mode === "json" || checks.env_service === "set");

  if (checks.mode === "supabase") {
    try {
      const client = createServiceClient();
      const { error } = await client
        .from("breeding_events")
        .select("ultrasound_date, fetus_count")
        .limit(1);
      checks.breeding_ultrasound_schema = error ? error.message : "ok";
    } catch (e) {
      checks.breeding_ultrasound_schema = e instanceof Error ? e.message : "error";
    }
  } else {
    checks.breeding_ultrasound_schema = "n/a";
  }

  const ok =
    loadersOk &&
    envOk &&
    (checks.breeding_ultrasound_schema === "ok" || checks.breeding_ultrasound_schema === "n/a");
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 500 });
}
