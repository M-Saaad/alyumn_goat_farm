import type { HealthTab } from "./health-tabs";

export function animalLinkFromHealth(animalId: number, tab: HealthTab): string {
  if (tab === "overview") return `/animals/${animalId}?from=health`;
  const base = `/animals/${animalId}?from=health&tab=${tab}`;
  if (tab === "breeding") return `${base}#breeding`;
  return base;
}

export function backFromAnimalProfile(searchParams: {
  from?: string;
  tab?: string;
}): { href: string; label: string } {
  if (searchParams.from === "health") {
    const tab = searchParams.tab;
    const href = tab && tab !== "overview" ? `/health?tab=${tab}` : "/health";
    const labels: Record<string, string> = {
      overview: "Health",
      breeding: "Breeding",
      vaccine: "Vaccination",
      deworm: "Deworming",
      weight: "Weight",
    };
    return { href, label: labels[tab || "overview"] ?? "Health" };
  }
  return { href: "/animals", label: "Goats" };
}

export function healthTabForActionKind(
  kind: "vaccine" | "deworm" | "breeding" | "ultrasound"
): HealthTab {
  if (kind === "ultrasound") return "breeding";
  return kind;
}
