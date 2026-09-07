import { parseOptionalPaidNowAmount } from "../lib/form-numbers";

if (parseOptionalPaidNowAmount("") !== null) throw new Error("blank should be null");
if (parseOptionalPaidNowAmount("0") !== 0) throw new Error("0 should parse as zero");
if (parseOptionalPaidNowAmount("5000") !== 5000) throw new Error("5000 should parse");

try {
  parseOptionalPaidNowAmount("-1");
  throw new Error("negative should fail");
} catch (e) {
  if (!(e instanceof Error) || !e.message.includes("cannot be negative")) {
    throw e;
  }
}

console.log("PASS parseOptionalPaidNowAmount");
