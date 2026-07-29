import type { AgreementStatus, FarmDatabase, PurchaseAgreement, Transaction } from "../types";

export function purchaseBalance(agreement: PurchaseAgreement): number {
  return Math.max(0, agreement.total_amount - agreement.amount_paid);
}

export function agreementStatus(amount: number, total: number): AgreementStatus {
  return amount >= total - 0.005 ? "settled" : "open";
}

export function findPurchaseAgreement(
  db: FarmDatabase,
  animalId: number
): PurchaseAgreement | undefined {
  return db.purchase_agreements?.find((a) => a.animal_id === animalId);
}

/** Legacy: infer paid amount from purchase transactions when no agreement exists. */
export function legacyPurchasePaid(db: FarmDatabase, animalId: number): number {
  return db.transactions
    .filter(
      (t) =>
        t.kind === "cost" &&
        t.category === "Livestock Purchase" &&
        t.animal_id === animalId
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

export function createPurchaseAgreement(input: {
  animalId: number;
  vendorId: string | null;
  totalAmount: number;
  amountPaid: number;
  notes?: string | null;
}): PurchaseAgreement {
  const amountPaid = Math.max(0, input.amountPaid);
  return {
    id: crypto.randomUUID(),
    animal_id: input.animalId,
    vendor_id: input.vendorId,
    total_amount: input.totalAmount,
    amount_paid: amountPaid,
    status: agreementStatus(amountPaid, input.totalAmount),
    notes: input.notes ?? null,
  };
}

export function applyPurchasePayment(
  agreement: PurchaseAgreement,
  amount: number
): PurchaseAgreement {
  const nextPaid = agreement.amount_paid + amount;
  if (nextPaid > agreement.total_amount + 0.005) {
    throw new Error(
      `Payment exceeds balance (owed ${purchaseBalance(agreement)}, tried ${amount})`
    );
  }
  return {
    ...agreement,
    amount_paid: nextPaid,
    status: agreementStatus(nextPaid, agreement.total_amount),
  };
}

export function purchaseAgreementTxIds(db: FarmDatabase, agreementId: string): string[] {
  return db.transactions
    .filter((t) => t.purchase_agreement_id === agreementId)
    .map((t) => t.id);
}

export function sumCustomerPurchasePayments(): number {
  return 0;
}

export type PurchasePaymentKind = "partner" | "customer";

export function validatePurchasePaymentAmount(
  agreement: PurchaseAgreement,
  amount: number
): void {
  if (amount <= 0 || Number.isNaN(amount)) {
    throw new Error("Payment amount must be positive");
  }
  if (amount > purchaseBalance(agreement) + 0.005) {
    throw new Error(`Payment exceeds outstanding balance (${purchaseBalance(agreement)})`);
  }
}

export function attachPurchaseTx(
  tx: Transaction,
  agreementId: string
): Transaction {
  return { ...tx, purchase_agreement_id: agreementId };
}
