-- User roles: partner (full access) vs guest (view only)
-- Run after 014_medical_events_comment.sql

create type user_role as enum ('partner', 'guest');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users_read_own_profile"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

-- Existing auth users become partners (Monis, Saad, etc.)
insert into profiles (id, role)
select id, 'partner'::user_role from auth.users
on conflict (id) do nothing;

-- New sign-ups default to guest until promoted in SQL or via admin script
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'guest'::user_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
