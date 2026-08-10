import type { SupabaseClient } from "@supabase/supabase-js";

let cached: boolean | null = null;

/** Whether animals.dam_id / sire_id / sire_name exist (migration 008 applied). */
export async function hasAnimalParentColumns(client: SupabaseClient): Promise<boolean> {
  if (cached !== null) return cached;
  const { error } = await client.from("animals").select("dam_id").limit(1);
  cached = !error;
  return cached;
}

export function resetAnimalParentColumnsCache(): void {
  cached = null;
}
