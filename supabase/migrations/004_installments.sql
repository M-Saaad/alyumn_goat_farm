-- Installment purchases and sales (cash-basis partial payments)

create type agreement_status as enum ('open', 'settled');

create table purchase_agreements (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  vendor_id uuid references contacts(id),
  total_amount numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  status agreement_status not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

alter table livestock_sales
  add column if not exists amount_received numeric(12,2),
  add column if not exists status agreement_status;

update livestock_sales
set
  amount_received = coalesce(amount_received, net_received),
  status = coalesce(status, 'settled'::agreement_status)
where amount_received is null or status is null;

alter table livestock_sales
  alter column amount_received set not null,
  alter column amount_received set default 0,
  alter column status set not null,
  alter column status set default 'open';

alter table livestock_sales
  alter column transaction_id drop not null;

alter table transactions
  add column if not exists purchase_agreement_id uuid references purchase_agreements(id) on delete set null,
  add column if not exists livestock_sale_id uuid references livestock_sales(id) on delete set null;

create index idx_purchase_agreements_animal on purchase_agreements(animal_id);
create index idx_transactions_purchase_agreement on transactions(purchase_agreement_id);
create index idx_transactions_livestock_sale on transactions(livestock_sale_id);

alter table purchase_agreements enable row level security;
create policy "partners_all_purchase_agreements" on purchase_agreements for all to authenticated using (true) with check (true);
