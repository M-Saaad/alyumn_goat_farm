-- Lookup table, dropped by 013_drop_custom_lookup_tables.sql.
-- Extra dewormer names now live on medical_events.notes, same as Punch/Unimec.
create table custom_dewormers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deworm_type text not null check (deworm_type in ('internal', 'external')),
  created_at timestamptz not null default now(),
  unique (name, deworm_type)
);
