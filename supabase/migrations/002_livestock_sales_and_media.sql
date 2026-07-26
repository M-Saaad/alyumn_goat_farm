-- livestock_sales, animal_media, app_meta, RLS, storage bucket
-- Run after 001_initial.sql

create type media_type as enum ('image', 'video');

create table livestock_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  animal_ids integer[] not null default '{}',
  gross_sale_price numeric(12,2) not null,
  delivery_cost numeric(12,2) not null default 0,
  net_received numeric(12,2) not null,
  partner_share numeric(12,2) not null,
  received_by_partner_id uuid not null references contacts(id),
  transaction_id uuid not null references transactions(id),
  notes text,
  created_at timestamptz not null default now()
);

create table animal_media (
  id uuid primary key default gen_random_uuid(),
  animal_id integer not null references animals(id) on delete cascade,
  storage_path text not null,
  media_type media_type not null,
  caption text,
  created_at timestamptz not null default now()
);

create table app_meta (
  id integer primary key default 1 check (id = 1),
  imported_at timestamptz,
  settlement_verified boolean not null default false,
  monis_diff numeric(14,2),
  saad_diff numeric(14,2),
  updated_at timestamptz not null default now()
);

insert into app_meta (id, settlement_verified) values (1, false)
  on conflict (id) do nothing;

create index idx_livestock_sales_date on livestock_sales(date);
create index idx_animal_media_animal on animal_media(animal_id);

-- RLS: authenticated partners have full access (v1)
alter table contacts enable row level security;
alter table animals enable row level security;
alter table transactions enable row level security;
alter table partner_ledger_entries enable row level security;
alter table palai_payments enable row level security;
alter table medical_events enable row level security;
alter table breeding_events enable row level security;
alter table weight_logs enable row level security;
alter table livestock_sales enable row level security;
alter table animal_media enable row level security;
alter table app_meta enable row level security;

create policy "partners_all_contacts" on contacts for all to authenticated using (true) with check (true);
create policy "partners_all_animals" on animals for all to authenticated using (true) with check (true);
create policy "partners_all_transactions" on transactions for all to authenticated using (true) with check (true);
create policy "partners_all_ledger" on partner_ledger_entries for all to authenticated using (true) with check (true);
create policy "partners_all_palai" on palai_payments for all to authenticated using (true) with check (true);
create policy "partners_all_medical" on medical_events for all to authenticated using (true) with check (true);
create policy "partners_all_breeding" on breeding_events for all to authenticated using (true) with check (true);
create policy "partners_all_weights" on weight_logs for all to authenticated using (true) with check (true);
create policy "partners_all_livestock_sales" on livestock_sales for all to authenticated using (true) with check (true);
create policy "partners_all_animal_media" on animal_media for all to authenticated using (true) with check (true);
create policy "partners_all_app_meta" on app_meta for all to authenticated using (true) with check (true);

-- Private storage bucket for animal photos/videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'animal-media',
  'animal-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "partners_read_animal_media"
  on storage.objects for select to authenticated
  using (bucket_id = 'animal-media');

create policy "partners_upload_animal_media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'animal-media');

create policy "partners_update_animal_media"
  on storage.objects for update to authenticated
  using (bucket_id = 'animal-media')
  with check (bucket_id = 'animal-media');

create policy "partners_delete_animal_media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'animal-media');
