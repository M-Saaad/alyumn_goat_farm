/**
 * Apply dam/sire parent links on Supabase (schema + data).
 * Requires POSTGRES_URL or SUPABASE_DB_URL in env (direct Postgres connection).
 *
 * Usage: npx tsx --env-file=.env.local scripts/apply-animal-parents-supabase.mts
 */
import { readFileSync } from "fs";
import path from "path";
import pg from "pg";

async function main() {
  const url =
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL;
  if (!url) {
    console.error("Set POSTGRES_URL, SUPABASE_DB_URL, or DATABASE_URL in .env.local");
    process.exit(1);
  }

  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/008_animal_parents.sql"),
    "utf8"
  );

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied 008_animal_parents.sql — dam/sire columns and kid backfill.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
