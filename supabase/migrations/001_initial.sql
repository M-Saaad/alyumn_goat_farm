-- Unified Goat Farm Management — initial schema
-- HOT ZONE tables: partner_ledger_entries, palai_payments

create extension if not exists "pgcrypto";

create type animal_status as enum ('Active', 'Died', 'Sold', 'Slaughtered', 'Gone');
create type animal_sex as enum ('Male', 'Female');
create type animal_breed as enum ('Gulabi', 'Teddy', 'Bissar', 'Tapra');
create type contact_type as enum ('Vendor', 'Customer', 'Partner', 'Farm');
create type transaction_kind as enum ('cost', 'partner_adjustment');
create type farm_model as enum ('Trading', 'Palai');
create type ledger_category as enum (
  'Feed',
  'Delivery',
  'Vet/Medicine',
  'Labor',
  'Infrastructure',
  'Livestock Purchase',
  'Livestock Sale',
  'Palai Income',
  'Palai Expense',
  'Partner Transfer',
  'Other'
);
create type medical_event_type as enum ('Vaccine', 'Deworming', 'Ultrasound', 'Surgery', 'General');
create type breeding_outcome as enum ('Pending', 'Delivered', 'Stillbirth', 'Miscarriage', 'Doubt');
create type breeding_status as enum ('Ready', 'Doubt', 'Delivered', 'Kid');

create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type contact_type not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table animals (
  id integer primary key,
  name text,
  breed animal_breed,
  sex animal_sex,
  date_of_purchase date,
  age_at_purchase text,
  description text,
  comment text,
  status animal_status not null default 'Active',
  price numeric(12,2) default 0,
  sold_price numeric(12,2),
  purchased_from uuid references contacts(id),
  owner_id uuid references contacts(id),
  home_bred boolean default false,
  out_date date,
  palai_rate numeric(12,2),
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12,2) not null,
  kind transaction_kind not null,
  category ledger_category not null,
  farm_model farm_model,
  animal_id integer references animals(id),
  customer_id uuid references contacts(id),
  vendor_id uuid references contacts(id),
  paid_by_partner_id uuid references contacts(id),
  received_by_partner_id uuid references contacts(id),
  adjustment_partner_id uuid references contacts(id),
  notes text,
  source_row integer,
  created_at timestamptz not null default now()
);

create table partner_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  partner_id uuid not null references contacts(id),
  amount numeric(12,2) not null,
  category ledger_category not null,
  created_at timestamptz not null default now()
);

create table palai_payments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  customer_id uuid not null references contacts(id),
  rate_per_goat numeric(12,2),
  goat_count integer,
  total_amount numeric(12,2) not null,
  payment_method text,
  transaction_id uuid references transactions(id),
  notes text,
  created_at timestamptz not null default now()
);

create table medical_events (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  event_type medical_event_type not null,
  date date,
  notes text,
  transaction_id uuid references transactions(id),
  created_at timestamptz not null default now()
);

create table breeding_events (
  id uuid primary key default gen_random_uuid(),
  female_animal_id integer not null references animals(id),
  male_animal_id integer references animals(id),
  buck_name text,
  date_crossed date,
  expected_due_date date,
  delivered_date date,
  outcome breeding_outcome default 'Pending',
  status breeding_status,
  notes text,
  created_at timestamptz not null default now()
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  weighed_on date not null,
  weight_kg numeric(8,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_transactions_date on transactions(date);
create index idx_transactions_category on transactions(category);
create index idx_ledger_partner on partner_ledger_entries(partner_id);
create index idx_animals_status on animals(status);
create index idx_animals_owner on animals(owner_id);
