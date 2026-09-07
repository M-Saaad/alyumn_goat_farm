/**
 * Assert Supabase write plan upserts respect FK order for linked rows.
 */
import { readFileSync } from "fs";
import path from "path";

const writesPath = path.join(process.cwd(), "lib/db/writes.ts");
const source = readFileSync(writesPath, "utf8");

function idx(snippet: string): number {
  const i = source.indexOf(snippet);
  if (i < 0) throw new Error(`applyWritePlan block missing: ${snippet}`);
  return i;
}

const animalsIdx = idx("if (plan.upsertAnimals?.length)");
const agreementsIdx = idx("if (plan.upsertPurchaseAgreements?.length)");
const txsBeforeSalesWriteIdx = idx("txsBeforeSales.map(txRow)");
const salesWriteIdx = idx('upsertRows(client, "livestock_sales"');
const txsAfterSalesWriteIdx = idx("txsAfterSales.map(txRow)");
const ledgerIdx = idx("if (plan.upsertLedger?.length)");

if (!(animalsIdx < agreementsIdx && agreementsIdx < txsBeforeSalesWriteIdx)) {
  throw new Error("purchase_agreements must be upserted before transactions");
}

if (!(txsBeforeSalesWriteIdx < salesWriteIdx && salesWriteIdx < txsAfterSalesWriteIdx)) {
  throw new Error(
    "initial sale txs (no livestock_sale_id) must be written before livestock_sales; receipt txs after"
  );
}

if (!(txsAfterSalesWriteIdx < ledgerIdx)) {
  throw new Error("ledger entries must be written after transactions");
}

console.log("PASS applyWritePlan FK upsert order");
