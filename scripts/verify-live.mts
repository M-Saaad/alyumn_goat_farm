/**
 * Live engine tests against local JSON (Supabase env must be unset).
 */
import { loadDb, saveDb } from "../lib/db";
import { computeSettlement, assertCanonicalSettlement } from "../lib/partner-equity/settlement";
import { recognizePalaiPayment, applyPalaiToDb } from "../lib/palai/recognize-payment";
import { computeSaleSplit, saleAdjustmentAmount } from "../lib/livestock/record-sale";
import { buyGoat, logExpense, logMedical, recordBreeding, recordLivestockSale, addSaleReceipt } from "../lib/actions";
import fs from "fs";
import path from "path";

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Unset SUPABASE_SERVICE_ROLE_KEY for local JSON verify-live tests.");
  process.exit(1);
}

const DB = path.join(process.cwd(), "data", "farm.db.json");
const backup = fs.readFileSync(DB, "utf8");

function restore() {
  fs.writeFileSync(DB, backup);
}

async function main() {
  try {
    const db = loadDb();
    const s0 = assertCanonicalSettlement(db);
    console.log("PASS canonical settlement", Math.round(s0.monisDiff), Math.round(s0.saadDiff));

    const livestockSaleTotal = s0.byCategory["Livestock Sale"];
    if (livestockSaleTotal !== 200000) {
      throw new Error(`livestock sale category expected 200000 got ${livestockSaleTotal}`);
    }
    console.log("PASS livestock sale category shows full net proceeds (200k)");

    const awais = db.contacts.find((c) => c.name === "Awais")!;
    const result = recognizePalaiPayment(db, {
      date: "2026-07-26",
      customerId: awais.id,
      ratePerGoat: 7000,
      goatCount: 2,
      totalAmount: 14000,
      paymentMethod: "test",
    });
    if (result.tx.amount !== 7000) throw new Error(`expected adj 7000 got ${result.tx.amount}`);
    const db2 = applyPalaiToDb(db, result);
    const s1 = computeSettlement(db2);
    if (Math.round(s1.monisDiff - s0.monisDiff) !== 7000) {
      throw new Error(`palai shift monis ${s1.monisDiff - s0.monisDiff}`);
    }
    if (Math.round(s1.saadDiff - s0.saadDiff) !== -7000) {
      throw new Error(`palai shift saad ${s1.saadDiff - s0.saadDiff}`);
    }
    console.log("PASS palai 14k → Monis +7k / Saad -7k settlement shift");

    const { netReceived, partnerShare } = computeSaleSplit(25000, 1000);
    if (partnerShare !== 12000) throw new Error(`bhola half expected 12000 got ${partnerShare}`);
    if (saleAdjustmentAmount(netReceived, "Monis") !== -12000) {
      throw new Error("monis received → negative adjustment");
    }
    if (saleAdjustmentAmount(netReceived, "Saad") !== 12000) {
      throw new Error("saad received → positive adjustment");
    }
    console.log("PASS livestock sale split math (Bhola pattern)");

    const activeGoat = db.animals.find((a) => a.status === "Active");
    if (!activeGoat) throw new Error("no active goat for sale test");
    await recordLivestockSale({
      date: "2026-07-26",
      animalId: activeGoat.id,
      grossSalePrice: 25000,
      deliveryCost: 1000,
      receivedBy: "Monis",
      notes: "verify sale test",
    });
    const afterSale = loadDb();
    const sold = afterSale.animals.find((a) => a.id === activeGoat.id);
    if (sold?.status !== "Sold" || sold.sold_price !== 25000) {
      throw new Error("sale did not update animal");
    }
    const saleTx = afterSale.transactions.find((t) => t.notes === "verify sale test");
    if (!saleTx || saleTx.amount !== -12000 || saleTx.animal_id !== activeGoat.id) {
      throw new Error(`sale tx expected -12000 linked, got ${saleTx?.amount} animal=${saleTx?.animal_id}`);
    }
    const sSale = computeSettlement(afterSale);
    if (Math.round(sSale.monisDiff - s0.monisDiff) !== -12000) {
      throw new Error(`sale shift monis ${sSale.monisDiff - s0.monisDiff}`);
    }
    if (Math.round(sSale.saadDiff - s0.saadDiff) !== 12000) {
      throw new Error(`sale shift saad ${sSale.saadDiff - s0.saadDiff}`);
    }
    console.log("PASS sell goat 25k-1k delivery → Monis adj -12k / Saad +12k settlement shift");

    restore();
    const dbPartial = loadDb();
    const partialGoat = dbPartial.animals.find((a) => a.status === "Active");
    if (!partialGoat) throw new Error("no active goat for partial sale test");
    await recordLivestockSale({
      date: "2026-07-27",
      animalId: partialGoat.id,
      grossSalePrice: 30000,
      deliveryCost: 0,
      receivedBy: "Saad",
      amountReceivedNow: 10000,
      notes: "partial sale test",
    });
    const afterPartial = loadDb();
    const partialSold = afterPartial.animals.find((a) => a.id === partialGoat.id);
    if (partialSold?.status !== "Sold") throw new Error("partial sale did not mark sold");
    const partialSale = (afterPartial.livestock_sales ?? []).find((s) =>
      s.animal_ids.includes(partialGoat.id)
    );
    if (!partialSale || partialSale.status !== "open" || partialSale.amount_received !== 10000) {
      throw new Error(`partial sale meta expected open/10k got ${partialSale?.status}/${partialSale?.amount_received}`);
    }
    const partialTx = afterPartial.transactions.find((t) => t.notes === "partial sale test");
    if (!partialTx || partialTx.livestock_sale_id != null) {
      throw new Error("initial partial receipt should link via sale.transaction_id only");
    }
    await addSaleReceipt({
      animalId: partialGoat.id,
      date: "2026-07-28",
      amount: 20000,
      receivedBy: "Monis",
      notes: "partial sale receipt",
    });
    const afterReceipt = loadDb();
    const settledSale = (afterReceipt.livestock_sales ?? []).find((s) => s.id === partialSale.id);
    if (!settledSale || settledSale.status !== "settled" || settledSale.amount_received !== 30000) {
      throw new Error(`sale should be settled at 30k got ${settledSale?.status}/${settledSale?.amount_received}`);
    }
    const receiptTx = afterReceipt.transactions.find((t) => t.notes === "partial sale receipt");
    if (!receiptTx || receiptTx.livestock_sale_id !== partialSale.id) {
      throw new Error("follow-up receipt should link via livestock_sale_id");
    }
    console.log("PASS partial sale + follow-up receipt");

    restore();
    await buyGoat({
      date: "2026-07-26",
      price: 1000,
      breed: "Teddy",
      sex: "Female",
      description: "Test goat verification",
      name: "VerifyGoat",
      ownerName: "Farm",
      paidBy: "Saad",
    });
    const afterBuy = loadDb();
    const vg = afterBuy.animals.find((a) => a.name === "VerifyGoat");
    if (!vg) throw new Error("buy goat missing animal");
    const linked = afterBuy.transactions.find(
      (t) => t.animal_id === vg.id && t.category === "Livestock Purchase"
    );
    if (!linked) throw new Error("buy goat missing transaction");
    const agreement = afterBuy.purchase_agreements?.find((a) => a.animal_id === vg.id);
    if (!agreement || agreement.status !== "settled") {
      throw new Error("buy goat missing settled purchase agreement");
    }
    console.log("PASS buy goat creates animal + linked transaction");

    await logMedical({ animalId: vg.id, eventType: "Vaccine", date: "2026-07-26", notes: "test vax" });
    const med = loadDb().medical_events.find((m) => m.animal_id === vg.id && m.notes === "test vax");
    if (!med) throw new Error("medical missing");
    console.log("PASS medical appears on animal");

    await recordBreeding({ femaleId: vg.id, buckName: "Shelby", dateCrossed: "2026-07-26" });
    const br = loadDb().breeding_events.find((b) => b.female_animal_id === vg.id);
    if (!br || br.expected_due_date !== "2026-12-23") {
      throw new Error(`due date ${br?.expected_due_date}`);
    }
    console.log("PASS breeding due date = crossed + 150 days");

    await logExpense({
      date: "2026-07-26",
      amount: 10000,
      category: "Feed",
      paidBy: "Saad",
      animalId: vg.id,
      notes: "test feed",
    });
    const exp = loadDb().transactions.find((t) => t.notes === "test feed" && t.animal_id === vg.id);
    if (!exp) throw new Error("expense linkage missing");
    console.log("PASS expense linked to animal");

    console.log("\nAll live engine tests passed.");
  } finally {
    restore();
  }
}

main().catch((e) => {
  restore();
  console.error(e);
  process.exit(1);
});
