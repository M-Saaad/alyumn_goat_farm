-- User-defined expense categories (beyond built-in ledger_category enum values).
create table custom_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Allow arbitrary category names on transactions (custom + built-in).
alter table transactions alter column category type text using category::text;
alter table partner_ledger_entries alter column category type text using category::text;
