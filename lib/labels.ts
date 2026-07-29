/** Display label for an animal row (shared by server loaders and actions). */
export function animalLabel(a: { name: string | null; description: string | null; id: number }) {
  return a.name || a.description?.slice(0, 40) || `Goat #${a.id}`;
}
