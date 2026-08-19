create table custom_vaccines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  interval_days integer not null check (interval_days > 0),
  created_at timestamptz not null default now()
);
