import { readFileSync } from "fs";
import path from "path";
import pg from "pg";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isSupabaseDb } from "@/lib/db";
import { BORN_KID_PARENT_BACKFILL } from "@/lib/livestock/animal-parents";

export const dynamic = "force-dynamic";

const MIGRATION_TOKEN = "apply-animal-parents-2026-08";

async function ensureParentColumns(): Promise<{ ok: boolean; detail?: string }> {
  const url =
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL;
  if (!url) return { ok: false, detail: "No Postgres URL in env" };

  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/008_animal_parents.sql"),
    "utf8"
  );
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * One-time: apply dam/sire parent links for historical farm-born kids.
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

  const schema = await ensureParentColumns();

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
    return NextResponse.json(
      {
        ok: false,
        error: "Some updates failed — run supabase/migrations/008_animal_parents.sql first",
        schema,
        failed,
        results,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, updated: results.length, schema, results });
}
