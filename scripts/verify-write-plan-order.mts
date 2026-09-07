/**
 * Assert Supabase write plan upserts respect FK order for purchase-linked transactions.
 */
import { readFileSync } from "fs";
import path from "path";

const writesPath = path.join(process.cwd(), "lib/db/writes.ts");
const source = readFileSync(writesPath, "utf8");

const animalsIdx = source.indexOf("if (plan.upsertAnimals?.length)");
const agreementsIdx = source.indexOf("if (plan.upsertPurchaseAgreements?.length)");
const salesIdx = source.indexOf("if (plan.upsertSales?.length)");
const transactionsIdx = source.indexOf("if (plan.upsertTransactions?.length)");
const ledgerIdx = source.indexOf("if (plan.upsertLedger?.length)");

if (
  animalsIdx < 0 ||
  agreementsIdx < 0 ||
  salesIdx < 0 ||
  transactionsIdx < 0 ||
  ledgerIdx < 0
) {
  throw new Error("applyWritePlan upsert blocks missing");
}

if (!(animalsIdx < agreementsIdx && agreementsIdx < transactionsIdx && transactionsIdx < ledgerIdx)) {
  throw new Error(
    "applyWritePlan must upsert purchase_agreements before transactions (FK on purchase_agreement_id)"
  );
}

if (!(salesIdx < transactionsIdx)) {
  throw new Error("applyWritePlan must upsert livestock_sales before transactions");
}

console.log("PASS applyWritePlan FK upsert order");
