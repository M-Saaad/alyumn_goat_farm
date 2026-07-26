Project Specification: Unified Goat Farm Management System
1. Project Overview
Context: A small goat farm in Karachi, Pakistan, run by two partners (Monis and Saad) on a 50/50 investment and revenue split. The farm operates on two models: 1) Buying breeding/fattening goats for trading/selling, and 2) "Palai" (boarding), where customers pay a monthly fee for the farm to raise their goats. Current Problem: The farm's financial data is in messy Google Sheets, and livestock data (medical, breeding, gestation) is in Notion. This siloed approach makes it impossible to track the profitability of specific animals or quickly view partner equity.Solution: A mobile-first, unified web application to track financials and livestock in one place. Actions like buying, selling, or vaccinating a goat will update both the animal's profile and the financial ledger simultaneously.

2. Tech Stack
Framework: Next.js (React)
Database/Auth: Supabase (PostgreSQL)
Styling: Tailwind CSS (Mobile-first design)
State Management: React Query / Zustand (or standard Next.js server actions)
3. Core Domain Logic & Rules
Partner Equity: All farm expenses and income are split 50/50 between Monis and Saad.
Palai Customer Wallet: When a customer (e.g., Awais) gives money to buy a goat or pay for Palai, that money goes into a "Customer Wallet", not directly into farm revenue. If the farm buys a goat for Awais, it deducts from his wallet. Farm profit is strictly separated from customer escrow.
Palai Revenue Recognition: Palai monthly fees are split 50/50 and added to the partners' equity.
Livestock Linkage: Every financial transaction can be linked to a specific animal via an animal_id. This allows calculating the exact cost per goat (feed, vet, purchase price).
Goat Identification: Animals are identified by Name (e.g., "Gulabo") or a descriptive Tag/ID if unnamed.
4. Implementation Spec
What it does
A mobile-first web app replacing Google Sheets and Notion. It tracks financials (partner equity, customer wallets, expenses/income) and livestock management (purchases, sales, vaccinations, breeding, gestation, deaths) in a linked system.

Who it is for
Saad and Monis (the partners). Designed for quick, on-the-go data entry (<20 seconds) during short farm visits.

Who it is NOT for
Customers (no login for Awais/Arslan).
Accountants (Operational tool, not a formal double-entry accounting ledger).
IoT/Scale integrations.
What success looks like
Logging a vet expense for "Bebo" and a feed purchase takes under 20 seconds.
The app automatically calculates that a Palai payment from Awais is split 50/50 and updates partner equity.
A "Goat Profile" for any animal shows its purchase cost, medical history, breeding timeline, and current status.
Monthly audits of expenses by category (Feed, Med, Vet, Infrastructure) are generated automatically.
What's out of scope
Automatic bank API integrations.
Customer-facing portals.
5. Data Model Requirements (Based on provided CSVs)
Animals Table (Replacing Notion)
Maps directly to the Notion CSV structure:

id, name, breed (Gulabi, Teddy, Bissar, Tapra), sex, date_of_purchase, age_at_purchase, description, status (Active, Died, Sold, Slaughtered, Gone), price, purchased_from (Vendor ID), owner (Farm, Awais, Arsalan, Monis), sold_price, home_bred (boolean), out_date, palai_rate.
Transactions Table (Replacing Google Sheets)
Maps to the financial CSV but normalized:

id, date, amount, type (Expense, Income, Partner Investment, Partner Draw, Customer Wallet Credit/Debit), category (Feed, Vet, Med, Infrastructure, Labor, Delivery, Livestock Purchase, Livestock Sale, Palai Income), farm_model (Trading, Palai), animal_id (optional foreign key), partner_id (optional, for investments), customer_id (optional, for Palai wallets), vendor_id (optional), notes.
Medical_Events Table
id, animal_id, event_type (Vaccine, Deworming, Ultrasound, Surgery, General), date, cost (links to Transactions), notes.
Breeding_Events Table
id, female_animal_id, male_animal_id (or "breeder name"), date_crossed, expected_due_date (auto-calculated: date_crossed + 150 days), outcome (Pending, Birthed, Miscarriage), notes.
Contacts Table (Vendors, Customers, Partners)
id, name, type (Vendor, Customer, Partner), phone, notes.
6. Step-by-Step Build Plan
Step 1: Database & Data Model
Set up Supabase tables as defined above. Create scripts to ingest the provided CSVs (Notion livestock data, Google Sheets financial data).

Step 2: The Livestock Hub (Replacing Notion)
Build the UI to view, add, and manage goats. List view with filters: "All", "Breeding", "Fattening", "Palai (Awais)". Tapping a goat shows its profile: medical history, breeding status, and financial costs tied to it.

Step 3: The Scheduler (Alerts)
Build dashboard logic for upcoming tasks. Home screen shows an "Action Required" list based on date math (e.g., 150 days from breeding = due date; 3 months from last vaccine = due for booster).

Step 4: The Smart Quick-Entry Interface
Build a unified entry form replacing the Google Sheet logging. A big "+" button.

If "Buy Goat" -> asks Price, Vendor, Breed, Owner. Creates Animal profile AND Transaction.
If "Vet Expense" -> asks Amount, Category, and optionally which Goat. Updates ledger and Animal profile.
Step 5: Customer Wallet & Partner Equity Engines (HOT ZONES)
Build logic to calculate partner splits and Palai customer balances. Keep farm cash strictly separated from customer escrow.

Step 6: Analytics Dashboard
Build reporting view. Monthly bar charts for spending categories, replacing manual summing. Show "Total Partner Equity" and "Outstanding Customer Balances".

7. Verification Strategy
Before writing code, the following tests must be implemented and pass:

Data Import Verification: Ingesting CSVs must yield exact partner differences (Monis: +192,247 PKR / Saad: -192,247 PKR).
Linkage Verification: Logging an expense tied to an animal must appear in both the monthly finance audit AND the animal's profile.
Scheduler Verification: Simulating a breeding record must accurately predict the due date and flag it on the dashboard.
8. HOT ZONE Protocol & Rules of Engagement
CRITICAL: Before changing ANY code in the following HOT ZONES, the AI MUST ask the user for explicit permission first and explain the "blast radius" (what breaks if the logic is wrong).

/partner-equity logic: Changing how Monis and Saad's money is split or calculated. Blast radius: Could result in incorrect payouts or deeply flawed profit metrics.
/customer-wallet logic: Changing how Palai money is tracked. Blast radius: Could mix customer escrow money with farm cash, making the farm look more profitable than it is, or showing customers owe money when they don't.
/livestock-scheduler logic: Changing gestation or medical interval math. Blast radius: Miscalculating gestation could lead to missed vaccinations or lost animals.