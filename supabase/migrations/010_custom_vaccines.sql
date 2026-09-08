create table if not exists custom_vaccines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  interval_days integer not null check (interval_days > 0),
  created_at timestamptz not null default now()
);

alter table custom_vaccines enable row level security;

drop policy if exists partners_all_custom_vaccines on custom_vaccines;
create policy "partners_all_custom_vaccines" on custom_vaccines
  for all to authenticated using (true) with check (true);

grant all on table custom_vaccines to postgres, anon, authenticated, service_role;

notify pgrst, 'reload schema';
