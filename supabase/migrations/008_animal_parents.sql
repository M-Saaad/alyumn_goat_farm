-- Dam / sire links for farm-born kids.

alter table animals
  add column if not exists dam_id integer references animals(id),
  add column if not exists sire_id integer references animals(id),
  add column if not exists sire_name text;

create index if not exists idx_animals_dam on animals(dam_id);
create index if not exists idx_animals_sire on animals(sire_id);

-- Backfill known farm-born kids (safe to re-run).
update animals set dam_id = 3, sire_id = null, sire_name = null where id = 8;
update animals set dam_id = null, sire_id = null, sire_name = null where id = 12;
update animals set dam_id = 1, sire_id = null, sire_name = null where id in (13, 14);
update animals set dam_id = 16, sire_id = 47, sire_name = null where id = 23;
update animals set dam_id = 22, sire_id = 47, sire_name = null where id = 32;
update animals set dam_id = 20, sire_id = 9, sire_name = null where id = 36;
update animals set dam_id = 3, sire_id = null, sire_name = null where id = 38;
update animals set dam_id = 1, sire_id = null, sire_name = null where id = 39;
update animals set dam_id = 25, sire_id = null, sire_name = null where id = 40;
update animals set dam_id = 30, sire_id = 47, sire_name = null where id = 41;
update animals set dam_id = 11, sire_id = null, sire_name = null where id = 44;
update animals set dam_id = 33, sire_id = null, sire_name = null where id = 45;
