import { palaiMergeTarget } from "../lib/palai/service-month.ts";
import type { PalaiPayment } from "../lib/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const adults: PalaiPayment = {
  id: "p1",
  date: "2026-09-02",
  service_month: "2026-09",
  customer_id: "awais",
  rate_per_goat: 7000,
  goat_count: 5,
  total_amount: 35000,
  payment_method: "Online Transfer",
  transaction_id: "tx-1",
  notes: "5 goats @ 7000",
};

const payments = [adults];

assert(
  palaiMergeTarget(payments, {
    customerId: "awais",
    serviceMonth: "2026-09",
    ratePerGoat: 4000,
  }) === undefined,
  "different rate must insert a new line, not replace"
);

assert(
  palaiMergeTarget(payments, {
    customerId: "awais",
    serviceMonth: "2026-09",
    ratePerGoat: 7000,
  }) === undefined,
  "same rate still inserts unless merge is requested"
);

const merged = palaiMergeTarget(payments, {
  customerId: "awais",
  serviceMonth: "2026-09",
  ratePerGoat: 7000,
  mergeWithExisting: true,
});
assert(merged?.id === "p1", "explicit merge at the same rate targets the existing line");

assert(
  palaiMergeTarget(payments, {
    customerId: "awais",
    serviceMonth: "2026-09",
    ratePerGoat: 4000,
    mergeWithExisting: true,
  }) === undefined,
  "cannot merge a kid rate onto the 7000 line"
);

console.log("PASS palai merge does not replace a different-rate payment");
