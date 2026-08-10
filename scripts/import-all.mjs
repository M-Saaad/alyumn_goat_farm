/**
 * One-time import of Notion + Google Sheets data.
 * Refuses to run unless data/audit-resolutions.json exists.
 * Asserts settlement Monis +192247 / Saad -192247.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "Data");
const OUT = path.join(ROOT, "data", "farm.db.json");
const RESOLUTIONS = path.join(ROOT, "data", "audit-resolutions.json");

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
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
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

function parseDate(raw, fixes, rowNum) {
  let s = (raw || "").trim();
  if (fixes[String(rowNum)]) s = fixes[String(rowNum)].to;
  s = s.replace("Spetember", "September").replace("Novemeber", "November");
  s = s.replace("2205", "2025").replace("2385", "2025");
  const m = s.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (!m) return null;
  const months = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };
  const mo = months[m[2].toLowerCase()];
  if (!mo) return null;
  return `${m[3]}-${mo}-${m[1].padStart(2, "0")}`;
}

function parseNotionDate(raw) {
  if (!raw || !String(raw).trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

if (!fs.existsSync(RESOLUTIONS)) {
  console.error("BLOCKED: Run scripts/audit-data.mjs first and resolve flags.");
  process.exit(1);
}
const resolutions = JSON.parse(fs.readFileSync(RESOLUTIONS, "utf8"));
if (!resolutions.settled && resolutions.notes == null) {
  console.error("BLOCKED: audit resolutions not settled.");
  process.exit(1);
}

const db = {
  contacts: [],
  animals: [],
  transactions: [],
  partner_ledger_entries: [],
  palai_payments: [],
  livestock_sales: [],
  medical_events: [],
  breeding_events: [],
  weight_logs: [],
  animal_media: [],
  meta: { importedAt: null, settlementVerified: false, monisDiff: null, saadDiff: null },
};

function upsertContact(name, type) {
  const n = (name || "").trim();
  if (!n || n === "-") return null;
  let c = db.contacts.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!c) {
    c = { id: randomUUID(), name: n, type, phone: null, notes: null };
    db.contacts.push(c);
  }
  return c.id;
}

const monisId = upsertContact("Monis", "Partner");
const saadId = upsertContact("Saad", "Partner");
const farmId = upsertContact("Farm", "Farm");
upsertContact("Awais", "Customer");
upsertContact("Arsalan", "Customer");

function addLedger(txId, partnerId, amount, category) {
  db.partner_ledger_entries.push({
    id: randomUUID(),
    transaction_id: txId,
    partner_id: partnerId,
    amount,
    category,
    created_at: new Date().toISOString(),
  });
}

function addCost({ date, amount, category, paidBy, notes, sourceRow, animalId, vendorId, customerId, farmModel }) {
  const tx = {
    id: randomUUID(),
    date,
    amount,
    kind: "cost",
    category,
    farm_model: farmModel || null,
    animal_id: animalId || null,
    customer_id: customerId || null,
    vendor_id: vendorId || null,
    paid_by_partner_id: paidBy,
    received_by_partner_id: null,
    adjustment_partner_id: null,
    notes: notes || null,
    source_row: sourceRow || null,
  };
  db.transactions.push(tx);
  addLedger(tx.id, paidBy, amount, category);
  return tx;
}

function addAdj({ date, amount, category, notes, sourceRow, customerId }) {
  const tx = {
    id: randomUUID(),
    date,
    amount,
    kind: "partner_adjustment",
    category,
    farm_model: category === "Palai Income" ? "Palai" : null,
    animal_id: null,
    customer_id: customerId || null,
    vendor_id: null,
    paid_by_partner_id: null,
    received_by_partner_id: null,
    adjustment_partner_id: monisId,
    notes: notes || null,
    source_row: sourceRow || null,
  };
  db.transactions.push(tx);
  addLedger(tx.id, monisId, amount, category);
  return tx;
}

// --- Animals ---
const animalsCsv = parseCsv(fs.readFileSync(path.join(DATA, "Notion", "Name 25d2fab8a40580969daff5930745360f_all.csv"), "utf8"));
const [aH, ...aBody] = animalsCsv;
const aI = Object.fromEntries(aH.map((h, i) => [h.trim(), i]));

for (const row of aBody) {
  const id = num(row[aI.ID]);
  if (id == null) continue;
  const ownerName = (row[aI.Owner] || "Farm").trim() || "Farm";
  const ownerType = ["Monis", "Saad"].includes(ownerName) ? "Partner" : ownerName === "Farm" ? "Farm" : "Customer";
  const ownerId = upsertContact(ownerName, ownerType);
  const vendorName = (row[aI["Purchased From"]] || "").trim();
  const vendorId = vendorName && vendorName !== "-" ? upsertContact(vendorName, "Vendor") : null;
  const price = num(row[aI.Price]) || 0;
  let status = (row[aI.Status] || "").trim() || "Active";
  if (!["Active", "Died", "Sold", "Slaughtered", "Gone"].includes(status)) status = "Active";
  let breed = (row[aI.Breed] || "").trim() || null;
  if (breed && !["Gulabi", "Teddy", "Bissar", "Tapra"].includes(breed)) breed = null;
  let sex = (row[aI.Sex] || "").trim() || null;
  if (sex && !["Male", "Female"].includes(sex)) sex = null;
  const nameRaw = (row[aI.Name] || "").trim();
  db.animals.push({
    id,
    name: !nameRaw || nameRaw === "-" ? null : nameRaw,
    breed,
    sex,
    date_of_purchase: parseNotionDate(row[aI["Date of purchasing"]]),
    age_at_purchase: (row[aI["Age at purchasing"]] || "").trim() || null,
    description: (row[aI.Description] || "").trim() || null,
    comment: (row[aI.Comment] || "").trim() || null,
    status,
    price,
    sold_price: num(row[aI.Sold]),
    purchased_from: vendorId,
    owner_id: ownerId,
    home_bred:
      String(row[aI["Home-bred"]] || "").toLowerCase() === "yes" ||
      (price === 0 && (!vendorName || vendorName === "-")),
    out_date: parseNotionDate(row[aI["Out Date"]]),
    palai_rate: num(row[aI["Palai Rate"]]),
  });
}

// --- Breeding ---
const breedFile = fs.readdirSync(path.join(DATA, "Notion")).find((f) => f.startsWith("Breeding") && f.endsWith("_all.csv"));
const breedCsv = parseCsv(fs.readFileSync(path.join(DATA, "Notion", breedFile), "utf8"));
const [bH, ...bBody] = breedCsv;
const bI = Object.fromEntries(bH.map((h, i) => [h.trim(), i]));
for (const row of bBody) {
  const name = (row[bI.Name] || "").trim();
  if (!name) continue;
  const goatIdRaw = (row[bI["Goat ID"]] || "").split(" ")[0];
  const femaleId = num(goatIdRaw);
  if (femaleId == null) continue;
  const crossed = parseNotionDate(row[bI["Mate Date"]]);
  let expected = parseNotionDate(row[bI["Expected (150 days)"]]);
  if (!expected && crossed) {
    const d = new Date(crossed);
    d.setUTCDate(d.getUTCDate() + 150);
    expected = d.toISOString().slice(0, 10);
  }
  let status = (row[bI.Status] || "").trim() || null;
  if (status && !["Ready", "Doubt", "Delivered", "Kid"].includes(status)) status = "Doubt";
  const confirmed = (row[bI["Confirmed Date"]] || "").trim().toLowerCase() === "yes";
  let ultrasoundDate = null;
  if (confirmed && crossed) {
    const d = new Date(crossed);
    d.setUTCDate(d.getUTCDate() + 50);
    ultrasoundDate = d.toISOString().slice(0, 10);
  }
  db.breeding_events.push({
    id: randomUUID(),
    female_animal_id: femaleId,
    male_animal_id: null,
    buck_name: (row[bI.Buck] || "").trim() || null,
    date_crossed: crossed,
    expected_due_date: expected,
    delivered_date: parseNotionDate(row[bI["Delivered Date"]]),
    ultrasound_date: ultrasoundDate,
    outcome: status === "Delivered" ? "Delivered" : status === "Doubt" ? "Doubt" : "Pending",
    status,
    notes: (row[bI.Comments] || "").trim() || null,
  });
}

// --- Vaccination / Deworming (snapshots) ---
const vaxFile = fs.readdirSync(path.join(DATA, "Notion")).find((f) => f.startsWith("Vaccination") && f.endsWith("_all.csv"));
const vaxCsv = parseCsv(fs.readFileSync(path.join(DATA, "Notion", vaxFile), "utf8"));
const [vH, ...vBody] = vaxCsv;
const vI = Object.fromEntries(vH.map((h, i) => [h.trim(), i]));
for (const row of vBody) {
  const goatId = num((row[vI["Goat ID"]] || "").split(" ")[0]);
  if (goatId == null) continue;
  const etv = parseNotionDate(row[vI["ETV Date"]]);
  const ppr = parseNotionDate(row[vI["PPR Date"]]);
  if (etv) db.medical_events.push({ id: randomUUID(), animal_id: goatId, event_type: "Vaccine", date: etv, notes: `ETV ${row[vI["ETV Dose"]] || ""}`.trim(), transaction_id: null });
  if (ppr) db.medical_events.push({ id: randomUUID(), animal_id: goatId, event_type: "Vaccine", date: ppr, notes: "PPR", transaction_id: null });
}

const dewFile = fs.readdirSync(path.join(DATA, "Notion")).find((f) => f.startsWith("De-worming") && f.endsWith("_all.csv"));
const dewCsv = parseCsv(fs.readFileSync(path.join(DATA, "Notion", dewFile), "utf8"));
const [dH, ...dBody] = dewCsv;
const dI = Object.fromEntries(dH.map((h, i) => [h.trim(), i]));
for (const row of dBody) {
  const goatId = num((row[dI["Goats ID"]] || row[dI["Goat ID"]] || "").split(" ")[0]);
  if (goatId == null) continue;
  const lastI = parseNotionDate(row[dI["Last I-DW Date"]]);
  const lastE = parseNotionDate(row[dI["Last E-DW Date"]]);
  if (lastI) db.medical_events.push({ id: randomUUID(), animal_id: goatId, event_type: "Deworming", date: lastI, notes: `I-DW ${row[dI["Last I-DW"]] || ""}`.trim(), transaction_id: null });
  if (lastE) db.medical_events.push({ id: randomUUID(), animal_id: goatId, event_type: "Deworming", date: lastE, notes: `E-DW ${row[dI["Last E-DW"]] || ""}`.trim(), transaction_id: null });
}

// --- Weight ---
const wFile = fs.readdirSync(path.join(DATA, "Notion")).find((f) => f.startsWith("Weight") && f.endsWith("_all.csv"));
if (wFile) {
  const wCsv = parseCsv(fs.readFileSync(path.join(DATA, "Notion", wFile), "utf8"));
  const [wH, ...wBody] = wCsv;
  const wI = Object.fromEntries(wH.map((h, i) => [h.trim(), i]));
  for (const row of wBody) {
    const goatId = num((row[wI["Goat ID"]] || "").split(" ")[0]);
    if (goatId == null) continue;
    for (const col of Object.keys(wI)) {
      if (!col.startsWith("Weight")) continue;
      const kg = num(row[wI[col]]);
      if (kg == null) continue;
      const dm = col.match(/Weight \((.+)\)/);
      let weighed = null;
      if (dm) {
        const parsed = new Date(dm[1].replace(",", ""));
        if (!Number.isNaN(parsed.getTime())) weighed = parsed.toISOString().slice(0, 10);
      }
      if (!weighed) weighed = "2025-10-29";
      db.weight_logs.push({ id: randomUUID(), animal_id: goatId, weighed_on: weighed, weight_kg: kg, notes: col });
    }
  }
}

// --- Financials (Breeding Goat sheet = settlement truth) ---
const finCsv = parseCsv(fs.readFileSync(path.join(DATA, "Google sheets", "Farm Expense - Breeding Goat.csv"), "utf8"));
const [fH, ...fBody] = finCsv;
const fI = Object.fromEntries(fH.map((h, i) => [h.trim(), i]));
const dateFixes = resolutions.dateFixes || {};
const cats = resolutions.categoryOverrides || {};
const splits = resolutions.splitRows || {};
const events = resolutions.eventRows || {};

for (let i = 0; i < fBody.length; i++) {
  const row = fBody[i];
  const rowNum = i + 2;
  const item = (row[fI.Item] || "").trim();
  const dateRaw = (row[fI.Date] || "").trim();
  if (!dateRaw && !item) continue;
  if (events[String(rowNum)]) continue; // livestock events — not money

  const date = parseDate(dateRaw, dateFixes, rowNum);
  if (!date) {
    console.warn(`Skip row ${rowNum}: bad date ${dateRaw}`);
    continue;
  }
  const total = num(row[fI.Total]);
  const monis = num(row[fI.Monis]);
  const saad = num(row[fI.Saad]);
  const notes = (row[fI.Notes] || "").trim();
  const category = cats[String(rowNum)] || "Other";

  if (splits[String(rowNum)]) {
    // Two cost rows
    if (monis != null && monis !== 0) {
      addCost({ date, amount: monis, category, paidBy: monisId, notes: `${item} (Monis portion)`, sourceRow: rowNum });
    }
    if (saad != null && saad !== 0) {
      addCost({ date, amount: saad, category, paidBy: saadId, notes: `${item} (Saad portion)`, sourceRow: rowNum });
    }
    continue;
  }

  if (total != null) {
    const paidBy = monis != null ? monisId : saadId;
    addCost({ date, amount: total, category, paidBy, notes: notes ? `${item} — ${notes}` : item, sourceRow: rowNum });
    continue;
  }

  if (monis != null) {
    // partner adjustment
    let customerId = null;
    if (/awais/i.test(item)) customerId = db.contacts.find((c) => c.name === "Awais")?.id;
    if (/arsalan/i.test(item)) customerId = db.contacts.find((c) => c.name === "Arsalan")?.id;
    const tx = addAdj({ date, amount: monis, category, notes: notes ? `${item} — ${notes}` : item, sourceRow: rowNum, customerId });

    // If Palai Income adjustment, also record palai_payments metadata when we can
    if (category === "Palai Income" && monis > 0) {
      db.palai_payments.push({
        id: randomUUID(),
        date,
        customer_id: customerId || db.contacts.find((c) => c.name === "Awais").id,
        rate_per_goat: null,
        goat_count: null,
        total_amount: monis * 2, // Monis share is half
        payment_method: null,
        transaction_id: tx.id,
        notes: item,
      });
    }
  }
}

// --- Awais Palai metadata enrichment (NO new ledger entries) ---
const awaisRaw = fs.readFileSync(path.join(DATA, "Google sheets", "Farm Expense - Awais.csv"), "utf8");
const awaisAll = parseCsv(awaisRaw);
const palaiHeaderIdx = awaisAll.findIndex((r) => r[0] === "Date" && String(r[1] || "").includes("Palai"));
const palaiRows = awaisAll.slice(palaiHeaderIdx + 1).filter((r) => (r[0] || "").trim() && num(r[3]) != null);

for (const r of palaiRows) {
  const date = parseDate((r[0] || "").trim(), {}, 0);
  const rate = num(r[1]);
  const goats = num(r[2]);
  const total = num(r[3]);
  const method = (r[4] || "").trim();
  const comments = (r[7] || "").trim();
  // Find matching existing palai_payment by date + monis share
  const monisShare = num(r[5]);
  const existing = db.palai_payments.find(
    (p) => p.date === date && Math.abs(p.total_amount / 2 - (monisShare || 0)) < 1
  );
  if (existing) {
    existing.rate_per_goat = rate;
    existing.goat_count = goats;
    existing.total_amount = total;
    existing.payment_method = method || existing.payment_method;
    if (comments) existing.notes = comments;
  }
}

// --- Livestock sale metadata (ledger stores partner half; metadata holds full sale) ---
const LIVESTOCK_SALE_META = {
  451: { animalIds: [9], gross: 78000, delivery: 0 },
  475: { animalIds: [3, 38], gross: 65000, delivery: 0 },
  487: { animalIds: [12], gross: 33000, delivery: 0 },
  491: { animalIds: [40], gross: 25000, delivery: 1000 },
};

db.livestock_sales = [];
for (const tx of db.transactions) {
  if (tx.category !== "Livestock Sale" || tx.kind !== "partner_adjustment") continue;
  const meta = LIVESTOCK_SALE_META[tx.source_row];
  if (!meta) continue;
  const net = meta.gross - meta.delivery;
  tx.animal_id = meta.animalIds[0];
  db.livestock_sales.push({
    id: randomUUID(),
    date: tx.date,
    animal_ids: meta.animalIds,
    gross_sale_price: meta.gross,
    delivery_cost: meta.delivery,
    net_received: net,
    partner_share: Math.abs(tx.amount),
    received_by_partner_id: tx.amount < 0 ? monisId : saadId,
    transaction_id: tx.id,
    notes: tx.notes,
  });
}

// --- Settlement assert ---
let costBase = 0, monisFunded = 0, saadFunded = 0;
for (const tx of db.transactions) {
  if (tx.kind === "cost") {
    costBase += tx.amount;
    if (tx.paid_by_partner_id === monisId) monisFunded += tx.amount;
    if (tx.paid_by_partner_id === saadId) saadFunded += tx.amount;
  } else {
    monisFunded += tx.amount;
    saadFunded -= tx.amount;
  }
}
const fairShare = costBase / 2;
const monisDiff = Math.round(monisFunded - fairShare);
const saadDiff = Math.round(saadFunded - fairShare);

console.log({
  animals: db.animals.length,
  transactions: db.transactions.length,
  ledger: db.partner_ledger_entries.length,
  palai: db.palai_payments.length,
  livestockSales: db.livestock_sales.length,
  breeding: db.breeding_events.length,
  medical: db.medical_events.length,
  costBase,
  monisFunded,
  saadFunded,
  monisDiff,
  saadDiff,
  identity: monisFunded + saadFunded === costBase,
});

if (monisDiff !== 192247 || saadDiff !== -192247) {
  console.error("FAIL settlement assertion");
  process.exit(1);
}
if (Math.abs(monisFunded + saadFunded - costBase) > 0.01) {
  console.error("FAIL balance identity");
  process.exit(1);
}

db.meta = {
  importedAt: new Date().toISOString(),
  settlementVerified: true,
  monisDiff,
  saadDiff,
};

fs.writeFileSync(OUT, JSON.stringify(db, null, 2));
console.log("PASS: wrote", OUT);
console.log("Settlement: Monis +192247 / Saad -192247");
