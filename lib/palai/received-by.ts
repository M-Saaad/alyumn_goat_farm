import type { Transaction } from "../types";

/** Infer who received palai cash from ledger row (legacy rows use adjustment sign). */
export function palaiReceivedByFromTx(
  tx: Transaction,
  monisId: string,
  saadId: string
): "Monis" | "Saad" {
  if (tx.received_by_partner_id === monisId) return "Monis";
  if (tx.received_by_partner_id === saadId) return "Saad";
  return tx.amount >= 0 ? "Saad" : "Monis";
}
