export const HEALTH_TABS = ["overview", "breeding", "vaccine", "deworm", "weight"] as const;
export type HealthTab = (typeof HEALTH_TABS)[number];

export function parseHealthTab(value: string | undefined): HealthTab {
  if (value && (HEALTH_TABS as readonly string[]).includes(value)) {
    return value as HealthTab;
  }
  return "overview";
}
