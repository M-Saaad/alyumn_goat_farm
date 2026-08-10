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

const STORAGE_PATH = "_system/animal-parents.json";

function parseParentLinks(raw: unknown): ParentLinkMap {
  if (!raw || typeof raw !== "object") return {};
  const out: ParentLinkMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    if (!Number.isFinite(id) || !value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    out[id] = {
      dam_id: row.dam_id == null ? null : Number(row.dam_id),
      sire_id: row.sire_id == null ? null : Number(row.sire_id),
      sire_name: row.sire_name == null ? null : String(row.sire_name),
    };
  }
  return out;
}

export async function loadParentLinksFromStorage(client: SupabaseClient): Promise<ParentLinkMap> {
  const { data, error } = await client.storage.from("animal-media").download(STORAGE_PATH);
  if (error || !data) return { ...BORN_KID_PARENT_BACKFILL };
  try {
    const text = await data.text();
    const parsed = parseParentLinks(JSON.parse(text));
    return { ...BORN_KID_PARENT_BACKFILL, ...parsed };
  } catch {
    return { ...BORN_KID_PARENT_BACKFILL };
  }
}

export async function saveParentLinksToStorage(
  client: SupabaseClient,
  links: ParentLinkMap
): Promise<void> {
  const body = JSON.stringify(links, null, 2);
  const { error } = await client.storage
    .from("animal-media")
    .upload(STORAGE_PATH, Buffer.from(body, "utf8"), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(`parent links storage: ${error.message}`);
}

export async function mergeParentLinksInStorage(
  client: SupabaseClient,
  patch: ParentLinkMap
): Promise<ParentLinkMap> {
  const existing = await loadParentLinksFromStorage(client);
  const merged = { ...existing, ...patch };
  await saveParentLinksToStorage(client, merged);
  return merged;
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
  const links = await loadParentLinksFromStorage(client);
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
