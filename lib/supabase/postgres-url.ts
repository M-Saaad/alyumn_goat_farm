import { readFileSync } from "fs";
import path from "path";
import pg from "pg";

const POSTGRES_ENV_KEYS = [
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "SUPABASE_DB_URL",
  "DATABASE_URL",
] as const;

export function supabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

/** Resolve a direct Postgres connection string from common Vercel/Supabase env names. */
export function resolvePostgresUrl(): { url: string; source: string } | null {
  for (const key of POSTGRES_ENV_KEYS) {
    const value = process.env[key];
    if (value?.trim()) return { url: value.trim(), source: key };
  }

  const host = process.env.POSTGRES_HOST?.trim();
  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD?.trim();
  const database = process.env.POSTGRES_DATABASE?.trim() || "postgres";
  const port = process.env.POSTGRES_PORT?.trim() || "5432";
  if (host && user && password) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    return {
      url: `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`,
      source: "POSTGRES_HOST+USER+PASSWORD",
    };
  }

  return null;
}

export function postgresEnvStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const key of POSTGRES_ENV_KEYS) {
    status[key] = Boolean(process.env[key]?.trim());
  }
  status.POSTGRES_HOST = Boolean(process.env.POSTGRES_HOST?.trim());
  status.POSTGRES_USER = Boolean(process.env.POSTGRES_USER?.trim());
  status.POSTGRES_PASSWORD = Boolean(process.env.POSTGRES_PASSWORD?.trim());
  status.SUPABASE_ACCESS_TOKEN = Boolean(
    process.env.SUPABASE_ACCESS_TOKEN?.trim() || process.env.SUPABASE_PAT?.trim()
  );
  return status;
}

async function runSqlViaManagementApi(sql: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim() || process.env.SUPABASE_PAT?.trim();
  const ref = supabaseProjectRef();
  if (!token) return { ok: false, detail: "No SUPABASE_ACCESS_TOKEN or SUPABASE_PAT in env" };
  if (!ref) return { ok: false, detail: "Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL" };

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, detail: `Management API ${res.status}: ${body.slice(0, 500)}` };
  }

  return { ok: true };
}

async function runSqlViaPg(url: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sqlFromMigrationFile());
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function sqlFromMigrationFile(): string {
  return readFileSync(
    path.join(process.cwd(), "supabase/migrations/008_animal_parents.sql"),
    "utf8"
  );
}

/** Apply 008_animal_parents.sql using Postgres URL or Supabase Management API. */
export async function applyAnimalParentsMigration(): Promise<{
  ok: boolean;
  method?: string;
  detail?: string;
  env: Record<string, boolean>;
}> {
  const env = postgresEnvStatus();
  const pgConfig = resolvePostgresUrl();
  if (pgConfig) {
    const result = await runSqlViaPg(pgConfig.url);
    if (result.ok) return { ok: true, method: `pg:${pgConfig.source}`, env };
    return { ok: false, method: `pg:${pgConfig.source}`, detail: result.detail, env };
  }

  const mgmt = await runSqlViaManagementApi(sqlFromMigrationFile());
  if (mgmt.ok) return { ok: true, method: "supabase-management-api", env };
  return { ok: false, method: "supabase-management-api", detail: mgmt.detail, env };
}
