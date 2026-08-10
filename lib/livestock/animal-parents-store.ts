import type { SupabaseClient } from "@supabase/supabase-js";
import type { Animal } from "../types";
import { mapAnimal } from "../db/supabase";
import { hasAnimalParentColumns } from "../db/parent-columns";
import { BORN_KID_PARENT_BACKFILL } from "./animal-parents";

export type ParentLink = {
  dam_id: number | null;
  sire_id: number | null;
  sire_name: string | null;
};

export type ParentLinkMap = Record<number, ParentLink>;

const PARENTS_MARKER = "\n__parents__:";

export function stripParentsComment(comment: string | null): string {
  if (!comment) return "";
  const idx = comment.indexOf(PARENTS_MARKER);
  return idx === -1 ? comment : comment.slice(0, idx).trimEnd();
}

export function encodeParentsComment(comment: string | null, link: ParentLink): string {
  const base = stripParentsComment(comment);
  const payload = `${PARENTS_MARKER}${JSON.stringify(link)}`;
  return base ? `${base}${payload}` : payload.trimStart();
}

export function parseParentsFromComment(comment: string | null): ParentLink | null {
  if (!comment) return null;
  const idx = comment.indexOf(PARENTS_MARKER);
  if (idx === -1) return null;
  try {
    const parsed = JSON.parse(comment.slice(idx + PARENTS_MARKER.length)) as ParentLink;
    return {
      dam_id: parsed.dam_id ?? null,
      sire_id: parsed.sire_id ?? null,
      sire_name: parsed.sire_name ?? null,
    };
  } catch {
    return null;
  }
}

export function parentLinksFromAnimalRows(rows: Record<string, unknown>[]): ParentLinkMap {
  const out: ParentLinkMap = { ...BORN_KID_PARENT_BACKFILL };
  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    const fromComment = parseParentsFromComment((row.comment as string) ?? null);
    if (fromComment) out[id] = fromComment;
  }
  return out;
}

export function applyParentLinks(animals: Animal[], links: ParentLinkMap): Animal[] {
  return animals.map((a) => {
    const link = links[a.id];
    if (!link) return a;
    return {
      ...a,
      dam_id: link.dam_id,
      sire_id: link.sire_id,
      sire_name: link.sire_name,
    };
  });
}

export async function mapAnimalsWithParents(
  client: SupabaseClient,
  rows: Record<string, unknown>[]
): Promise<Animal[]> {
  const animals = rows.map(mapAnimal);
  if (await hasAnimalParentColumns(client)) return animals;
  const links = parentLinksFromAnimalRows(rows);
  return applyParentLinks(animals, links);
}

export function parentLinksFromAnimals(animals: Animal[]): ParentLinkMap {
  const out: ParentLinkMap = {};
  for (const a of animals) {
    if (!a.home_bred) continue;
    if (a.dam_id == null && a.sire_id == null && !a.sire_name?.trim()) continue;
    out[a.id] = {
      dam_id: a.dam_id,
      sire_id: a.sire_id,
      sire_name: a.sire_name,
    };
  }
  return out;
}

/** Persist parent links in comment when DB columns are missing. */
export function animalsWithEncodedParentComments(animals: Animal[]): Animal[] {
  return animals.map((a) => {
    if (!a.home_bred) return a;
    const link = parentLinksFromAnimals([a])[a.id];
    if (!link) return a;
    return {
      ...a,
      comment: encodeParentsComment(a.comment, link) || null,
      dam_id: null,
      sire_id: null,
      sire_name: null,
    };
  });
}

export async function backfillParentComments(
  client: SupabaseClient,
  links: ParentLinkMap
): Promise<Array<{ id: number; ok: boolean; error?: string }>> {
  const results: Array<{ id: number; ok: boolean; error?: string }> = [];
  for (const [idRaw, link] of Object.entries(links)) {
    const id = Number(idRaw);
    const { data, error: readErr } = await client
      .from("animals")
      .select("comment")
      .eq("id", id)
      .maybeSingle();
    if (readErr) {
      results.push({ id, ok: false, error: readErr.message });
      continue;
    }
    const comment = encodeParentsComment((data?.comment as string) ?? null, link);
    const { error } = await client.from("animals").update({ comment }).eq("id", id);
    results.push({ id, ok: !error, error: error?.message });
  }
  return results;
}

export async function loadParentLinks(client: SupabaseClient): Promise<ParentLinkMap> {
  const { data, error } = await client.from("animals").select("id,comment");
  if (error) throw new Error(error.message);
  return parentLinksFromAnimalRows((data ?? []) as Record<string, unknown>[]);
}
