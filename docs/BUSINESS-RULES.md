# Business Rules

Financial logic is the most sensitive part of this codebase. Rules below mirror Google Sheets conventions verified by `npm run verify`.

## Partner settlement (HOT ZONE)

**File:** `lib/partner-equity/settlement.ts`

### Formula

```
cost_base     = SUM(amount) WHERE kind = 'cost'
fair_share    = cost_base / 2
monis_funded  = SUM(cost paid_by Monis) + SUM(signed adjustment amounts)
saad_funded   = SUM(cost paid_by Saad)  - SUM(signed adjustment amounts)
monis_diff    = monis_funded - fair_share
saad_diff     = saad_funded  - fair_share
```

### Interpretation

| Condition | Meaning |
|-----------|---------|
| `monis_diff > 0` | Monis over-funded → **Saad owes Monis** `amountOwed = round(abs(monis_diff))` |
| `saad_diff > 0` | Saad over-funded → **Monis owes Saad** |
| Both ≈ 0 | Partners are even |

### Canonical anchor

After importing all historical data:

```
monis_diff = +192,247 PKR
saad_diff  = −192,247 PKR
→ Saad owes Monis 192,247 PKR
```

`assertCanonicalSettlement()` throws if rounded diffs differ from these values.

### Balance identity

Always true: `monis_funded + saad_funded = cost_base`

### Category display totals

For `partner_adjustment` rows with category `Livestock Sale`, category breakdown uses `abs(amount) * 2` to show full receipt value (each ledger row stores one partner's half).

## Transaction kinds

### Cost (`kind: "cost"`)

- Represents money **spent** on the farm
- `amount` is always **positive**
- Exactly one partner in `paid_by_partner_id`
- Increases `cost_base` and that partner's `funded`

Common categories: Feed, Delivery, Vet/Medicine, Labor, Infrastructure, Livestock Purchase, Palai Expense, Other.

### Partner adjustment (`kind: "partner_adjustment"`)

- Represents **income attribution** or **partner share rebalancing**
- `amount` is **signed** on Monis's side of the book
- `adjustment_partner_id` always points to Monis
- Does **not** increase `cost_base`

Categories: Palai Income, Livestock Sale, Partner Transfer.

Effect on funded amounts:

```
monis_funded += adjustment.amount
saad_funded  -= adjustment.amount
```

## Palai payments (HOT ZONE)

**Files:** `lib/palai/recognize-payment.ts`, `lib/palai/service-month.ts`

### Rules

1. Record on **receipt date**, not accrual
2. Split **50/50** between partners as farm income
3. Creates one `partner_adjustment` with category `Palai Income`
4. Also creates a `palai_payments` row with `service_month` (YYYY-MM)

### Typical case: Saad received customer transfer

```
total_amount = 30,000 PKR
adjustment_amount = +15,000  (Monis's half)
```

Settlement effect: Monis funded +15,000, Saad funded −15,000. This reflects that Saad physically received the cash but half belongs to Monis.

### If Monis received instead

```
adjustment_amount = -15,000
```

### Service month

- User selects which month the fee covers
- `palaiMergeTarget()` may merge into an existing payment for same customer + month
- `normalizeServiceMonth()` accepts `YYYY-MM` or full dates

## Livestock sales (HOT ZONE)

**Files:** `lib/livestock/record-sale.ts`, `lib/livestock/cancel-sale.ts`

### Sale economics

```
net_received  = gross_sale_price - delivery_cost
partner_share = net_received / 2
```

### Receipt convention

Each cash receipt posts **one partner's half**, not the full amount:

| Receiver | adjustment amount |
|----------|-------------------|
| Monis received | `-(receipt / 2)` — credits Saad's share |
| Saad received | `+(receipt / 2)` — credits Monis's share |

### Partial receipts

- `amount_received` tracks running total on `livestock_sales`
- `status: "open"` until `amount_received >= net_received`
- Additional receipts via `addSaleReceipt()`

### Sold on Palai

When buyer keeps goats at farm:

- Animals stay `Active`
- `owner_id` → customer, `palai_rate` set
- Used when sale is to an existing/new Palai customer

### Undo

- `undoLivestockSale()` reverses sale + linked transactions
- `deleteSaleReceipt()` removes one receipt and adjusts balances

## Purchase agreements

**File:** `lib/livestock/purchase-agreement.ts`

- Created when buying a goat with `total_amount > paid_now`
- Each payment creates a `cost` transaction with category `Livestock Purchase`
- `status: "settled"` when `amount_paid >= total_amount`

## Partner transfers

Direct cash moves between partners. Creates `partner_adjustment` with category `Partner Transfer`. Used when one partner reimburses the other outside normal expense flow.

## Breeding rules

**File:** `lib/livestock/breeding.ts`

| Rule | Detail |
|------|--------|
| Dam availability | Female must not have active pending breeding |
| Expected due | `date_crossed + 150 days` (approximate gestation) |
| Ultrasound | Updates `fetus_count`, `ultrasound_date`, may set outcome |
| Delivery | Creates kid via `registerBornGoat()`, resolves breeding outcome |
| Buck | In-herd sire (`male_animal_id`) or external (`buck_name`) |

## Herd health

**Files:** `lib/livestock/vaccine-schedule.ts`, `lib/livestock/herd-health.ts`, `lib/livestock/medical-notes.ts`

- Built-in vaccines: PPR, Enterotoxaemia, etc. with interval presets
- Custom vaccine names allowed (stored in event `notes`)
- Deworm types: Oral, Injection, Pour-on — custom names merged from history
- Overdue = last event date + interval < today

## Animal status transitions

**File:** `lib/actions.ts` → `changeStatus()`

| Status | Effect |
|--------|--------|
| Sold | Usually via sale flow; sets `sold_price`, `out_date` |
| Died / Slaughtered / Gone | Sets `out_date`, removes from active lists |
| Active | Default; Palai goats owned by customers remain Active |

## Age calculation

**File:** `lib/livestock/age.ts`

Computes display age from `date_of_purchase` + `age_at_purchase` text, or from birth (home bred).

## Period headcount

**File:** `lib/livestock/period-headcount.ts`

Counts goats in herd between dates: purchased/home-bred before end AND (still active OR out_date after start).

## Finance reports

**File:** `lib/transactions/monthly-report.ts`

Splits period transactions into:

- **Invested** — cost rows (expenses)
- **Received** — Palai Income + Livestock Sale adjustments (full amounts)
- **Transfers** — Partner Transfer adjustments

## What NOT to change casually

1. Settlement formula or canonical ±192,247 expectation
2. Palai 50/50 split direction (sign of adjustment)
3. Sale half-receipt convention
4. Import scripts without re-running full verify pipeline
5. Partner name strings `"Monis"` / `"Saad"` — code looks up by exact name

## Verification

```bash
npm run verify
```

Runs, in order:

1. `verify-palai-merge.mts` — Palai merge behavior
2. `verify-v1.mjs` — Core settlement + linkage assertions
3. `verify-live.mts` — Livestock sale integrity
4. `verify-herd-health.mts` — Health schedule consistency
5. `verify-monthly-report.mts` — Report math
6. `verify-period-headcount.mts` — Headcount logic
7. `verify-animal-age.mts` — Age parsing
8. `verify-custom-vaccine.mts` — Custom vaccine flows

All must pass after any financial logic change.
