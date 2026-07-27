/**
 * HOT ZONE: Customer wallet (escrow).
 * Blast radius: wrong balances can mix escrow with farm cash or show
 * customers owing / owed incorrectly.
 *
 * Rules:
 * - Positive amount = credit (deposit into escrow)
 * - Negative amount = debit (e.g. livestock purchase paid from escrow)
 * - Never creates partner_ledger_entries
 * - Linked transactions use kind = customer_wallet (ignored by settlement)
 */
import type {
  CustomerWalletEntry,
  FarmDatabase,
  Transaction,
} from "../types";

export function walletBalance(db: FarmDatabase, customerId: string): number {
  return (db.customer_wallet_entries ?? [])
    .filter((e) => e.customer_id === customerId)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function allCustomerWalletBalances(
  db: FarmDatabase
): { customerId: string; name: string; balance: number }[] {
  const customers = db.contacts.filter((c) => c.type === "Customer");
  return customers
    .map((c) => ({
      customerId: c.id,
      name: c.name,
      balance: walletBalance(db, c.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function pushWalletTxAndEntry(
  db: FarmDatabase,
  tx: Transaction,
  entry: CustomerWalletEntry
): FarmDatabase {
  return {
    ...db,
    transactions: [...db.transactions, tx],
    customer_wallet_entries: [...(db.customer_wallet_entries ?? []), entry],
  };
}

export function creditWallet(
  db: FarmDatabase,
  input: {
    customerId: string;
    date: string;
    amount: number;
    notes?: string | null;
  }
): FarmDatabase {
  if (!(input.amount > 0)) throw new Error("Deposit amount must be positive");
  const customer = db.contacts.find((c) => c.id === input.customerId);
  if (!customer || customer.type !== "Customer") {
    throw new Error("Customer not found");
  }

  const txId = crypto.randomUUID();
  const tx: Transaction = {
    id: txId,
    date: input.date,
    amount: input.amount,
    kind: "customer_wallet",
    category: "Customer Wallet",
    farm_model: "Palai",
    animal_id: null,
    customer_id: input.customerId,
    vendor_id: null,
    paid_by_partner_id: null,
    received_by_partner_id: null,
    adjustment_partner_id: null,
    notes: input.notes || `Wallet deposit — ${customer.name}`,
    source_row: null,
  };

  const entry: CustomerWalletEntry = {
    id: crypto.randomUUID(),
    date: input.date,
    customer_id: input.customerId,
    amount: input.amount,
    reason: "deposit",
    animal_id: null,
    transaction_id: txId,
    notes: input.notes ?? null,
  };

  return pushWalletTxAndEntry(db, tx, entry);
}

export function debitWalletForPurchase(
  db: FarmDatabase,
  input: {
    customerId: string;
    date: string;
    amount: number;
    animalId: number;
    vendorId?: string | null;
    notes?: string | null;
  }
): FarmDatabase {
  if (!(input.amount > 0)) throw new Error("Purchase amount must be positive");
  const customer = db.contacts.find((c) => c.id === input.customerId);
  if (!customer || customer.type !== "Customer") {
    throw new Error("Customer not found");
  }

  const txId = crypto.randomUUID();
  const tx: Transaction = {
    id: txId,
    date: input.date,
    amount: input.amount,
    kind: "customer_wallet",
    category: "Livestock Purchase",
    farm_model: "Palai",
    animal_id: input.animalId,
    customer_id: input.customerId,
    vendor_id: input.vendorId ?? null,
    paid_by_partner_id: null,
    received_by_partner_id: null,
    adjustment_partner_id: null,
    notes: input.notes || `Customer-paid purchase — ${customer.name}`,
    source_row: null,
  };

  const entry: CustomerWalletEntry = {
    id: crypto.randomUUID(),
    date: input.date,
    customer_id: input.customerId,
    amount: -input.amount,
    reason: "livestock_purchase",
    animal_id: input.animalId,
    transaction_id: txId,
    notes: input.notes ?? null,
  };

  return pushWalletTxAndEntry(db, tx, entry);
}

export function removeWalletEntriesForTx(db: FarmDatabase, txId: string): FarmDatabase {
  return {
    ...db,
    customer_wallet_entries: (db.customer_wallet_entries ?? []).filter(
      (e) => e.transaction_id !== txId
    ),
  };
}

export function syncWalletDebitForPurchase(
  db: FarmDatabase,
  txId: string,
  input: { date: string; amount: number; animalId: number | null; notes?: string | null }
): FarmDatabase {
  const entries = (db.customer_wallet_entries ?? []).map((e) => {
    if (e.transaction_id !== txId) return e;
    return {
      ...e,
      date: input.date,
      amount: -Math.abs(input.amount),
      animal_id: input.animalId,
      notes: input.notes ?? e.notes,
      reason: "livestock_purchase" as const,
    };
  });
  return { ...db, customer_wallet_entries: entries };
}

export function syncWalletCreditForDeposit(
  db: FarmDatabase,
  txId: string,
  input: { date: string; amount: number; notes?: string | null }
): FarmDatabase {
  const entries = (db.customer_wallet_entries ?? []).map((e) => {
    if (e.transaction_id !== txId) return e;
    return {
      ...e,
      date: input.date,
      amount: Math.abs(input.amount),
      notes: input.notes ?? e.notes,
      reason: "deposit" as const,
    };
  });
  return { ...db, customer_wallet_entries: entries };
}
