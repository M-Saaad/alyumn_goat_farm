import type { FarmDatabase } from "./types";

export function emptyDb(): FarmDatabase {
  return {
    contacts: [],
    animals: [],
    transactions: [],
    partner_ledger_entries: [],
    palai_payments: [],
    livestock_sales: [],
    medical_events: [],
    breeding_events: [],
    weight_logs: [],
    animal_media: [],
    meta: {
      importedAt: null,
      settlementVerified: false,
      monisDiff: null,
      saadDiff: null,
    },
  };
}
