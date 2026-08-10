import {
  estimateAnimalAge,
  formatAgeMonths,
  monthsToTeeth,
  parseAgeAtAcquisition,
  teethToMonths,
} from "../lib/livestock/age.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(parseAgeAtAcquisition("4 teeths")?.months === 21, "4 teeths -> 21 months");
assert(parseAgeAtAcquisition("10 months")?.months === 10, "10 months");
assert(parseAgeAtAcquisition("5-6 months")?.months === 5.5, "5-6 months range");
assert(parseAgeAtAcquisition("Almost 8 teeths")?.months === teethToMonths(7.5), "almost 8 teeth");
assert(parseAgeAtAcquisition("0 day")?.months === 0, "0 day");

assert(monthsToTeeth(6).label === "0 teeth", "6 months = kid");
assert(monthsToTeeth(15).label === "2 teeth", "15 months = 2 teeth");
assert(monthsToTeeth(45).label === "8 teeth", "45 months = 8 teeth");

const born = estimateAnimalAge(
  {
    date_of_purchase: "2025-06-01",
    age_at_purchase: "0",
    out_date: null,
    status: "Active",
  },
  "2026-08-10"
);
assert(born !== null, "born estimate exists");
assert(born!.label.includes("month"), "born label mentions months");

const purchased = estimateAnimalAge(
  {
    date_of_purchase: "2024-07-25",
    age_at_purchase: "4 teeths",
    out_date: null,
    status: "Active",
  },
  "2026-08-10"
);
assert(purchased !== null, "purchased estimate exists");
assert(purchased!.teeth >= 6, "Gulabo-like goat should be 6+ teeth by Aug 2026");

const sold = estimateAnimalAge(
  {
    date_of_purchase: "2024-01-01",
    age_at_purchase: "2 teeth",
    out_date: "2025-06-01",
    status: "Sold",
  },
  "2026-08-10"
);
assert(sold!.asOf === "2025-06-01", "sold animals age as-of out_date");

assert(formatAgeMonths(24) === "2 years", "24 months = 2 years");
assert(formatAgeMonths(25) === "2 years 1 month", "25 months");

console.log("verify-animal-age: ok");
