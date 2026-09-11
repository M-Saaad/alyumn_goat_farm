# Farm App Documentation

Detailed reference for developers and AI agents working on the **Monis & Saad Goat Farm** web app.

## Start here

| If you need to… | Read |
|-----------------|------|
| Onboard quickly as an AI agent | [../AGENTS.md](../AGENTS.md) |
| Understand what the app does | [OVERVIEW.md](OVERVIEW.md) |
| Learn entities and sample data | [DATA-MODEL.md](DATA-MODEL.md) |
| Change financial logic safely | [BUSINESS-RULES.md](BUSINESS-RULES.md) |
| Navigate the codebase | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Improve speed / apply perf patterns | [PERFORMANCE.md](PERFORMANCE.md) |
| Run imports, seeds, verification | [OPERATIONS.md](OPERATIONS.md) |
| Deploy to production | [../DEPLOY.md](../DEPLOY.md) |

## Quick facts

- **Stack:** Next.js 15 (App Router), React 19, Tailwind 4, TypeScript, Supabase (optional)
- **Partners:** Monis and Saad — 50/50 equity on all farm costs
- **Currency:** PKR (Pakistani Rupees)
- **Canonical DB:** `data/farm.db.json` (18 contacts, 47 animals, 457 transactions)
- **Settlement anchor:** Monis **+192,247** / Saad **−192,247** PKR after full import
- **Source data:** Notion exports + Google Sheets in `Data/`

## Sample data snapshot (committed `farm.db.json`)

```
Contacts:     18  (2 partners, 1 farm, 5 customers, 10 vendors)
Animals:      47  (23 Active, 11 Died, 7 Sold, 4 Slaughtered, 2 Gone)
Transactions: 457 (cost + partner_adjustment rows)
Palai:        19 payments
Sales:        4 livestock sale records
Breeding:     17 events
Medical:      70 events
```

Top transaction categories: Feed (149), Delivery (56), Infrastructure (54), Vet/Medicine (47), Partner Transfer (46).
