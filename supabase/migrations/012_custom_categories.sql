-- custom_categories lookup table is dropped by 013_drop_custom_lookup_tables.sql.
-- Extra category names live on transactions.category (this migration still converts
-- category columns from enum to text — keep running it on fresh installs).
create table custom_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Allow arbitrary category names on transactions (custom + built-in).
alter table transactions alter column category type text using category::text;
alter table partner_ledger_entries alter column category type text using category::text;
