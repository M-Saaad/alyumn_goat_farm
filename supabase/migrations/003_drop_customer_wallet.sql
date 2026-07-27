-- Remove customer wallet escrow (rollback of wallet feature)
-- Safe to run if the table was never created.

delete from customer_wallet_entries where true;
delete from transactions where kind = 'customer_wallet';

drop policy if exists partners_all_customer_wallet_entries on customer_wallet_entries;
drop table if exists customer_wallet_entries;
drop type if exists wallet_entry_reason;

-- Note: PostgreSQL cannot easily remove enum values from transaction_kind / ledger_category.
-- Unused values 'customer_wallet' and 'Customer Wallet' may remain on those types; they are harmless.
