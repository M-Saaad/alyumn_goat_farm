import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseDb } from "@/lib/db";
import { BORN_KID_PARENT_BACKFILL } from "@/lib/livestock/animal-parents";
import { applyAnimalParentsMigration } from "@/lib/supabase/postgres-url";

export const dynamic = "force-dynamic";

const MIGRATION_TOKEN = "apply-animal-parents-2026-08";

/**
 * One-time: apply dam/sire schema + parent links for historical farm-born kids.
 * POST /api/apply-animal-parents
 * Header: x-migration-token: apply-animal-parents-2026-08
 */
export async function POST(req: Request) {
  if (!isSupabaseDb()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const token = req.headers.get("x-migration-token");
  const expected = process.env.MIGRATION_TOKEN ?? MIGRATION_TOKEN;
  if (token !== expected) {
    return NextResponse.json({ error: "Invalid migration token" }, { status: 401 });
  }

  const schema = await applyAnimalParentsMigration();
  if (!schema.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Schema migration failed — add POSTGRES_URL or SUPABASE_ACCESS_TOKEN to Vercel env",
        schema,
      },
      { status: 500 }
    );
  }

  const client = createServiceClient();
  const results: Array<{ id: number; ok: boolean; error?: string }> = [];

  for (const [idRaw, parents] of Object.entries(BORN_KID_PARENT_BACKFILL)) {
    const id = Number(idRaw);
    const { error } = await client
      .from("animals")
      .update({
        dam_id: parents.dam_id,
        sire_id: parents.sire_id,
        sire_name: parents.sire_name,
      })
      .eq("id", id);

    results.push({ id, ok: !error, error: error?.message });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return NextResponse.json({ ok: false, schema, failed, results }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: results.length, schema, results });
}
