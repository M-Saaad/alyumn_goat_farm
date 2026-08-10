import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseDb } from "@/lib/db";
import { BORN_KID_PARENT_BACKFILL } from "@/lib/livestock/animal-parents";
import { applyAnimalParentsMigration } from "@/lib/supabase/postgres-url";
import {
  loadParentLinksFromStorage,
  mergeParentLinksInStorage,
  saveParentLinksToStorage,
} from "@/lib/livestock/animal-parents-store";
import { hasAnimalParentColumns } from "@/lib/db/parent-columns";

export const dynamic = "force-dynamic";

const MIGRATION_TOKEN = "apply-animal-parents-2026-08";

/**
 * One-time: apply dam/sire parent links for historical farm-born kids.
 * Tries Postgres DDL first; falls back to Supabase Storage JSON when no DB URL.
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

  const client = createServiceClient();
  const schema = await applyAnimalParentsMigration();
  let storage: { ok: boolean; method: string; count?: number; detail?: string } | null = null;

  if (!schema.ok) {
    try {
      await saveParentLinksToStorage(client, BORN_KID_PARENT_BACKFILL);
      storage = { ok: true, method: "storage-json", count: Object.keys(BORN_KID_PARENT_BACKFILL).length };
    } catch (e) {
      storage = {
        ok: false,
        method: "storage-json",
        detail: e instanceof Error ? e.message : String(e),
      };
      return NextResponse.json({ ok: false, schema, storage }, { status: 500 });
    }
  }

  const parentCols = await hasAnimalParentColumns(client);
  const results: Array<{ id: number; ok: boolean; error?: string }> = [];

  if (parentCols) {
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
  } else if (storage?.ok) {
    const merged = await mergeParentLinksInStorage(client, BORN_KID_PARENT_BACKFILL);
    for (const id of Object.keys(BORN_KID_PARENT_BACKFILL).map(Number)) {
      results.push({ id, ok: Boolean(merged[id]) });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    return NextResponse.json({ ok: false, schema, storage, failed, results }, { status: 500 });
  }

  const verify = await loadParentLinksFromStorage(client);
  return NextResponse.json({
    ok: true,
    updated: results.length,
    schema,
    storage,
    parentColumns: parentCols,
    sample: [8, 23, 36, 41].map((id) => ({ id, ...verify[id] })),
    results,
  });
}
