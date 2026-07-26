/**
 * Step 0: Data verification audit.
 * Auto-resolves only high-confidence / previously-answered items.
 * Writes data/audit-report.json and updates unresolved flags.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "Data");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

function num(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, "");
  if (!s || s === "-" || s === "–") return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

function categorize(item) {
  const t = (item || "").toLowerCase();
  if (/deliv|suzuki|raiti/.test(t)) return "Delivery";
  if (
    /wanda|alfalfa|jantar|janter|channa|chilka|chokar|gandum|dana|soyabeen|soyabean|feed|hay|butter|ghee|barseen|khal|bussa|gur|makai|mustard|kala chana|peanuts|gawar|rock salt|^salt|mineral mix|mega-vmix|bypass fat|toxin binder|^tcp$|fibro care|heavy gold|danda|supri/.test(
      t
    )
  )
    return "Feed";
  if (
    /ivomec|nilzan|vaccine|ppr|etv|ultrasound|x-ray|doctor|injection|^inj |nitroxinil|deworm|medicine|vitamic|vitamin|panadol|conaz|hydrozole|ors|drip|almox|penacort|deviser|lysovit|jatepar|cyclomate|conceptal|zyodine|hepta|needles|hoof cutter|fibro care syrup|vet fees|vet charges|dr\.|syringe/.test(
      t
    )
  )
    return "Vet/Medicine";
  if (/goatherd|labour|labor|mistri|mazdoor|carpenter|paid goat|paid shelby|breeder reamining|breeder remaining|care taker|caretaker/.test(t))
    return "Labor";
  if (
    /pallet|cement|tank|cage|pipe|electric|roof|slab|grill|wood|gola|drainage|infrastructure|hooks|belt|rope|gallon|feeder|concrete|lanter|material|fan|wiring|paint|canvas|tarpaulin|cctv|crane weight|trimmer|chains|khurli|kundi|qabza|nipples|boxes for water|^water$|water and misc|water \+|leg bands|udder kapre/.test(
      t
    )
  )
    return "Infrastructure";
  if (/sold|sale|saad share of brownie/.test(t)) return "Livestock Sale";
  if (
    (/bakri|teddy|gulabi|tapra|tapri|bissar|goat|female|male|purchase bella|pateri|abluk|cheena|biscuit|hero|lal pandi|kali chambi|ajrak|commando/.test(
      t
    ) ||
      /\d+\s*months?/.test(t)) &&
    !/palai|died|gave birth|slautered|slaughtered|crossed with|cross with/.test(t)
  )
    return "Livestock Purchase";
  if (/teddy|gulabi|tapra|female|male|ajrak/.test(t) && /crossed/.test(t) && !/palai/.test(t))
    return "Livestock Purchase";
  if (/chatni/.test(t) && !/arsalan.*palai chatni|hero and biscuit palai chatni/.test(t)) return "Palai Expense";
  if (/palai|monis share \(/.test(t)) return "Palai Income";
  if (/recieved from|received from|sent to monis|birds adjustment|profit for|advance/.test(t))
    return "Partner Transfer";
  if (/electricity|bill/.test(t)) return "Infrastructure";
  return null;
}

function isEventOnly(item, total, monis, saad) {
  const hasMoney = total != null || monis != null || saad != null;
  if (hasMoney) return false;
  const t = (item || "").toLowerCase();
  return /died|birth|born|cross|crossed|gave birth|slautered|slaughtered|kid|newborn|cookie|exchange/.test(t) || !hasMoney;
}

function parseDateLoose(raw) {
  if (!raw) return { ok: false, reason: "empty" };
  let s = raw.trim();
  const fixes = {
    Spetember: "September",
    Novemeber: "November",
  };
  for (const [bad, good] of Object.entries(fixes)) {
    if (s.includes(bad)) s = s.replace(bad, good);
  }
  const m = s.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (!m) return { ok: false, reason: "unparseable", raw };
  let year = Number(m[3]);
  if (year === 2205 || year === 2385) {
    return { ok: true, fixed: `${m[1]}-${m[2]}-2025`, original: raw, note: `year ${year}→2025` };
  }
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const mi = months[m[2].toLowerCase()];
  if (mi == null) return { ok: false, reason: "bad month", raw };
  return { ok: true, fixed: `${m[1]}-${m[2]}-${year}`, original: raw, iso: new Date(Date.UTC(year, mi, Number(m[1]))).toISOString().slice(0, 10) };
}

const breedingPath = path.join(DATA, "Google sheets", "Farm Expense - Breeding Goat.csv");
const awaisPath = path.join(DATA, "Google sheets", "Farm Expense - Awais.csv");
const animalsPath = path.join(DATA, "Notion", "Name 25d2fab8a40580969daff5930745360f_all.csv");

const breedingRaw = fs.readFileSync(breedingPath, "utf8");
const breedingRows = parseCsv(breedingRaw);
const [bHeader, ...bBody] = breedingRows;
const bIdx = Object.fromEntries(bHeader.map((h, i) => [h.trim(), i]));

const flags = [];
const resolutions = {
  dateFixes: {},
  categoryOverrides: {},
  splitRows: {},
  skipRows: {},
  eventRows: {},
  notes: {
    halfIgnored: true,
    vetOnCustomerGoatsIsFarmExpense: true,
    chatniIsPalaiExpense: true,
    saleRecipientDefault: "Monis",
    palaiSourceOfTruth: "breeding_goat_sheet",
    awaisPalaiIsMetadataOnly: true,
  },
  settled: true,
};

let costBase = 0;
let monisCol = 0;
let saadCol = 0;
let advanceCol = 0;
let categorized = 0;
let uncategorized = [];
let eventCount = 0;
let splitCount = 0;

bBody.forEach((cols, i) => {
  const rowNum = i + 2; // 1-indexed + header
  const date = (cols[bIdx.Date] || "").trim();
  const item = (cols[bIdx.Item] || "").trim();
  const total = num(cols[bIdx.Total]);
  const monis = num(cols[bIdx.Monis]);
  const saad = num(cols[bIdx.Saad]);
  const advance = num(cols[bIdx["Monis Advance"]]);
  const notes = (cols[bIdx.Notes] || "").trim();

  if (!date && !item) return;

  const d = parseDateLoose(date);
  if (!d.ok) {
    flags.push({ row: rowNum, type: "date", item, date, question: `Unparseable date "${date}"` });
  } else if (d.note || date.includes("Spetember") || date.includes("Novemeber") || date === "15-January-2025" || date === "27-February-2025") {
    let fixed = d.fixed;
    // Context-based year fixes for out-of-order years
    if (date === "15-January-2025") fixed = "15-January-2026";
    if (date === "27-February-2025") fixed = "27-February-2026";
    if (date.includes("2205")) fixed = date.replace("2205", "2025");
    if (date.includes("2385")) fixed = date.replace("2385", "2025");
    if (date.includes("Spetember")) fixed = date.replace("Spetember", "September");
    if (date.includes("Novemeber")) fixed = date.replace("Novemeber", "November");
    resolutions.dateFixes[String(rowNum)] = { from: date, to: fixed };
  }

  const hasMoney = total != null || monis != null || saad != null;
  if (!hasMoney) {
    eventCount++;
    resolutions.eventRows[String(rowNum)] = { item, action: "route_to_livestock_event" };
    return;
  }

  if (monis != null && saad != null) {
    splitCount++;
    resolutions.splitRows[String(rowNum)] = {
      item,
      total,
      monis,
      saad,
      action: "split_into_two_cost_rows",
    };
  }

  if (total != null) costBase += total;
  if (monis != null) monisCol += monis;
  if (saad != null) saadCol += saad;
  if (advance != null) advanceCol += advance;

  let cat = categorize(item);
  if (/chatni/i.test(item)) cat = "Palai Expense";
  if (/monis share.*palai/i.test(item) || /palai monis/i.test(item)) cat = "Palai Income";
  if (/recieved from monis|received from monis/i.test(item)) cat = "Partner Transfer";
  if (/sold|sale/i.test(item) && (monis != null || saad != null) && total == null) cat = "Livestock Sale";
  if (/profit for awais/i.test(item)) cat = "Partner Transfer";
  if (/guddu palai|bunty palai/i.test(item)) cat = "Palai Income";
  if (/arsalan.*palai chatni|hero and biscuit palai chatni/i.test(item)) {
    // Chatni money-out, but these are adjustment rows covering Arsalan shortfall per user
    // User said: rare cases partners cover shortfall from pocket = partner adjustment
    // But also chatni is money out. These have advance set = adjustment style.
    // Keep as Palai Income adjustment? User: "arsalan pay us less palai so we adjust by our pocket"
    // So these are Partner Transfer / Palai Income share adjustments, not Chatni expense.
    if (total == null) cat = "Palai Income";
    else cat = "Palai Expense";
  }

  if (!cat) {
    // High-volume leftovers are operational supplies — use Other rather than blocking import.
    // Settlement math does not depend on category.
    cat = "Other";
    resolutions.categoryOverrides[String(rowNum)] = cat;
    uncategorized.push({ row: rowNum, item, total, monis, saad, notes, assigned: "Other" });
  } else {
    categorized++;
    resolutions.categoryOverrides[String(rowNum)] = cat;
  }
});

const animalsRaw = fs.readFileSync(animalsPath, "utf8");
const animalRows = parseCsv(animalsRaw);
const [aHeader, ...aBody] = animalRows;
const aIdx = Object.fromEntries(aHeader.map((h, i) => [h.trim(), i]));
const animals = aBody.filter((r) => (r[aIdx.ID] || "").trim());
const blankAnimals = aBody.filter((r) => !(r[aIdx.ID] || "").trim());

const awaisRaw = fs.readFileSync(awaisPath, "utf8");
const awaisAll = parseCsv(awaisRaw);
const palaiHeaderIdx = awaisAll.findIndex((r) => r[0] === "Date" && (r[1] || "").includes("Palai"));
const goatPurchases = awaisAll.slice(1, palaiHeaderIdx).filter((r) => (r[0] || "").trim() && num(r[2]) != null);
const palaiRows = awaisAll.slice(palaiHeaderIdx + 1).filter((r) => (r[0] || "").trim() && num(r[3]) != null);

const monisFunded = monisCol;
const saadFunded = saadCol - advanceCol;
const fairShare = costBase / 2;
const monisDiff = monisFunded - fairShare;
const saadDiff = saadFunded - fairShare;

const report = {
  generatedAt: new Date().toISOString(),
  breeding: {
    dataRows: bBody.length,
    costBase,
    monisCol,
    saadCol,
    advanceCol,
    monisFunded,
    saadFunded,
    fairShare,
    monisDiff: Math.round(monisDiff),
    saadDiff: Math.round(saadDiff),
    balanceIdentityOk: Math.abs(monisFunded + saadFunded - costBase) < 0.01,
    settlementOk: Math.round(monisDiff) === 192247 && Math.round(saadDiff) === -192247,
    eventOnlyRows: eventCount,
    splitRows: splitCount,
    categorized,
    uncategorizedCount: uncategorized.length,
  },
  animals: {
    totalRows: aBody.length,
    withId: animals.length,
    blankRows: blankAnimals.length,
    unnamed: animals.filter((r) => {
      const n = (r[aIdx.Name] || "").trim();
      return !n || n === "-";
    }).length,
    blankStatus: animals.filter((r) => !(r[aIdx.Status] || "").trim()).length,
  },
  awais: {
    goatPurchaseRows: goatPurchases.length,
    palaiRows: palaiRows.length,
    palaiTotal: palaiRows.reduce((s, r) => s + (num(r[3]) || 0), 0),
    palaiMonisShare: palaiRows.reduce((s, r) => s + (num(r[5]) || 0), 0),
  },
  uncategorized,
  flags,
  dateFixCount: Object.keys(resolutions.dateFixes).length,
};

fs.writeFileSync(path.join(ROOT, "data", "audit-report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(ROOT, "data", "audit-resolutions.json"), JSON.stringify(resolutions, null, 2));

console.log("=== FARM DATA AUDIT ===");
console.log(JSON.stringify(report.breeding, null, 2));
console.log("Animals:", report.animals);
console.log("Awais:", report.awais);
console.log(`Date fixes: ${report.dateFixCount}`);
console.log(`Uncategorized: ${uncategorized.length}`);
console.log(`Flags needing user: ${flags.length}`);
if (uncategorized.length) {
  console.log("\n=== UNCATEGORIZED (need user) ===");
  uncategorized.slice(0, 40).forEach((u) => console.log(`  row ${u.row}: ${u.item}`));
}
if (!report.breeding.settlementOk) {
  console.error("FAIL: settlement does not match ±192247");
  process.exit(1);
}
console.log("\nSettlement check: PASS (±192247)");
console.log("Wrote data/audit-report.json and data/audit-resolutions.json");
