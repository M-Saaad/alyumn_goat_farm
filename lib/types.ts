export const LEDGER_CATEGORIES = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Livestock Purchase",
  "Livestock Sale",
  "Palai Income",
  "Palai Expense",
  "Partner Transfer",
  "Other",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];
export type AnimalStatus = "Active" | "Died" | "Sold" | "Slaughtered" | "Gone";
export type AnimalSex = "Male" | "Female";
export type AnimalBreed = "Gulabi" | "Teddy" | "Bissar" | "Tapra";
export type ContactType = "Vendor" | "Customer" | "Partner" | "Farm";
export type TransactionKind = "cost" | "partner_adjustment";
export type FarmModel = "Trading" | "Palai";
export type MedicalEventType = "Vaccine" | "Deworming" | "Ultrasound" | "Surgery" | "General";
export type BreedingOutcome = "Pending" | "Delivered" | "Stillbirth" | "Miscarriage" | "Doubt";
export type BreedingStatus = "Ready" | "Doubt" | "Delivered" | "Kid";

export type AgreementStatus = "open" | "settled";

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  phone?: string | null;
  notes?: string | null;
}

export interface Animal {
  id: number;
  name: string | null;
  breed: AnimalBreed | null;
  sex: AnimalSex | null;
  date_of_purchase: string | null;
  age_at_purchase: string | null;
  description: string | null;
  comment: string | null;
  status: AnimalStatus;
  price: number;
  sold_price: number | null;
  purchased_from: string | null;
  owner_id: string | null;
  home_bred: boolean;
  dam_id: number | null;
  sire_id: number | null;
  sire_name: string | null;
  out_date: string | null;
  palai_rate: number | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  category: LedgerCategory;
  farm_model: FarmModel | null;
  animal_id: number | null;
  customer_id: string | null;
  vendor_id: string | null;
  paid_by_partner_id: string | null;
  received_by_partner_id: string | null;
  adjustment_partner_id: string | null;
  notes: string | null;
  source_row: number | null;
  purchase_agreement_id: string | null;
  livestock_sale_id: string | null;
}

export interface PartnerLedgerEntry {
  id: string;
  transaction_id: string;
  partner_id: string;
  amount: number;
  category: LedgerCategory;
  created_at: string;
}

export interface PalaiPayment {
  id: string;
  date: string;
  /** YYYY-MM — which month this palai fee is for. */
  service_month: string;
  customer_id: string;
  rate_per_goat: number | null;
  goat_count: number | null;
  total_amount: number;
  payment_method: string | null;
  transaction_id: string | null;
  notes: string | null;
}

/** Purchase deal — total price vs cash paid so far. */
export interface PurchaseAgreement {
  id: string;
  animal_id: number;
  vendor_id: string | null;
  total_amount: number;
  amount_paid: number;
  status: AgreementStatus;
  notes: string | null;
}

/** Metadata for a livestock sale (ledger row stores one partner's half per receipt). */
export interface LivestockSale {
  id: string;
  date: string;
  animal_ids: number[];
  gross_sale_price: number;
  delivery_cost: number;
  net_received: number;
  partner_share: number;
  received_by_partner_id: string;
  transaction_id: string | null;
  amount_received: number;
  status: AgreementStatus;
  notes: string | null;
}

export interface MedicalEvent {
  id: string;
  animal_id: number;
  event_type: MedicalEventType;
  date: string | null;
  notes: string | null;
  transaction_id: string | null;
}

export interface BreedingEvent {
  id: string;
  female_animal_id: number;
  male_animal_id: number | null;
  buck_name: string | null;
  date_crossed: string | null;
  expected_due_date: string | null;
  delivered_date: string | null;
  ultrasound_date: string | null;
  outcome: BreedingOutcome;
  status: BreedingStatus | null;
  notes: string | null;
}

export interface WeightLog {
  id: string;
  animal_id: number;
  weighed_on: string;
  weight_kg: number;
  notes: string | null;
}

export type MediaType = "image" | "video";

export interface AnimalMedia {
  id: string;
  animal_id: number;
  storage_path: string;
  media_type: MediaType;
  caption: string | null;
  created_at: string;
}

export interface FarmDatabase {
  contacts: Contact[];
  animals: Animal[];
  transactions: Transaction[];
  partner_ledger_entries: PartnerLedgerEntry[];
  palai_payments: PalaiPayment[];
  livestock_sales: LivestockSale[];
  purchase_agreements: PurchaseAgreement[];
  medical_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  weight_logs: WeightLog[];
  animal_media: AnimalMedia[];
  meta: {
    importedAt: string | null;
    settlementVerified: boolean;
    monisDiff: number | null;
    saadDiff: number | null;
  };
}

export interface SettlementResult {
  costBase: number;
  fairShare: number;
  monisFunded: number;
  saadFunded: number;
  monisDiff: number;
  saadDiff: number;
  owedTo: "Monis" | "Saad" | "Even";
  amountOwed: number;
  byCategory: Record<string, number>;
}
