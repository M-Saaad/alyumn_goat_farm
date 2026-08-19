import type { FarmDatabase } from "./types";

export function emptyDb(): FarmDatabase {
  return {
    contacts: [],
    animals: [],
    transactions: [],
    partner_ledger_entries: [],
    palai_payments: [],
    livestock_sales: [],
    purchase_agreements: [],
    medical_events: [],
    breeding_events: [],
    weight_logs: [],
    animal_media: [],
    custom_vaccines: [],
    meta: {
      importedAt: null,
      settlementVerified: false,
      monisDiff: null,
      saadDiff: null,
    },
  };
}
