-- Customer wallet escrow (separate from partner equity)
-- HOT ZONE: customer wallet balances must not mix with farm cash / partner settlement

alter type transaction_kind add value if not exists 'customer_wallet';
alter type ledger_category add value if not exists 'Customer Wallet';

create type wallet_entry_reason as enum ('deposit', 'livestock_purchase');

create table customer_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  customer_id uuid not null references contacts(id),
  amount numeric not null,
  reason wallet_entry_reason not null,
  animal_id integer references animals(id),
  transaction_id uuid references transactions(id),
  notes text,
  created_at timestamptz not null default now()
);

create index customer_wallet_entries_customer_idx on customer_wallet_entries (customer_id);
create index customer_wallet_entries_tx_idx on customer_wallet_entries (transaction_id);

alter table customer_wallet_entries enable row level security;

create policy partners_all_customer_wallet_entries on customer_wallet_entries
  for all to authenticated using (true) with check (true);
