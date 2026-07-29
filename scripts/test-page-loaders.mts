import { loadHomeData, loadAnimalsListData, loadHerdHealthData, loadTransactionsData } from "../lib/db/queries.ts";

const loaders = [
  ["home", () => loadHomeData()],
  ["animals", () => loadAnimalsListData()],
  ["health", () => loadHerdHealthData()],
  ["transactions", () => loadTransactionsData()],
] as const;

for (const [name, fn] of loaders) {
  try {
    await fn();
    console.log(`${name}: OK`);
  } catch (e) {
    console.error(`${name}: FAIL`, e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
