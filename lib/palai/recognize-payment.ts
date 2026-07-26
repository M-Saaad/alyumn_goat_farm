/**
 * HOT ZONE: Palai fee recognition.
 * Blast radius: mixing escrow with farm cash / wrong partner credits.
 * Do not change without explicit user approval.
 *
 * Rules:
 * - Record on receipt (not accrued)
 * - Split 50/50 to partners as farm income (Palai Income category)
 * - Creates a partner_adjustment for Monis's half held in the book
 *   (matches Sheets: Monis share rows are adjustments, not cost rows)
 * - Full payment total/2 credited to each partner via settlement math:
 *   adjustment of +total/2 increases Monis funded and decreases Saad funded
 *   by the same amount — reflecting Monis's share when Saad received the cash.
 */
import type { FarmDatabase, PalaiPayment, PartnerLedgerEntry, Transaction } from "../types";
import { createAdjustmentTransaction, getPartnerIds } from "../partner-equity/settlement";

export interface RecognizePalaiInput {
  date: string;
  customerId: string;
  ratePerGoat: number;
  goatCount: number;
  totalAmount: number;
  paymentMethod?: string | null;
  notes?: string | null;
  /** When true, Monis share = total/2 adjustment (Saad received cash). Default true. */
  saadReceivedCash?: boolean;
}

export interface RecognizePalaiResult {
  payment: PalaiPayment;
  tx: Transaction;
  ledger: Omit<PartnerLedgerEntry, "id" | "created_at">[];
}

/**
 * Recognize a Palai payment as farm income split 50/50.
 * Settlement effect when Saad received the transfer (typical):
 *   adjustment amount = +total/2 (Monis's share)
 *   → Monis funded += total/2, Saad funded -= total/2
 * which matches the Breeding Goat sheet "Monis share (…palai)" rows.
 */
export function recognizePalaiPayment(
  db: FarmDatabase,
  input: RecognizePalaiInput
): RecognizePalaiResult {
  const { monisId } = getPartnerIds(db);
  const half = input.totalAmount / 2;
  const saadReceived = input.saadReceivedCash !== false;

  // Monis share adjustment: positive when Saad holds Monis's half
  const adjustmentAmount = saadReceived ? half : -half;

  const { tx, ledger } = createAdjustmentTransaction({
    date: input.date,
    amount: adjustmentAmount,
    category: "Palai Income",
    monisId,
    customerId: input.customerId,
    notes:
      input.notes ||
      `Palai ${input.goatCount} goats @ ${input.ratePerGoat} = ${input.totalAmount} (50/50 split)`,
  });

  const payment: PalaiPayment = {
    id: crypto.randomUUID(),
    date: input.date,
    customer_id: input.customerId,
    rate_per_goat: input.ratePerGoat,
    goat_count: input.goatCount,
    total_amount: input.totalAmount,
    payment_method: input.paymentMethod ?? null,
    transaction_id: tx.id,
    notes: input.notes ?? null,
  };

  return { payment, tx, ledger };
}

export function applyPalaiToDb(db: FarmDatabase, result: RecognizePalaiResult): FarmDatabase {
  const now = new Date().toISOString();
  return {
    ...db,
    transactions: [...db.transactions, result.tx],
    partner_ledger_entries: [
      ...db.partner_ledger_entries,
      ...result.ledger.map((l) => ({ ...l, id: crypto.randomUUID(), created_at: now })),
    ],
    palai_payments: [...db.palai_payments, result.payment],
  };
}
