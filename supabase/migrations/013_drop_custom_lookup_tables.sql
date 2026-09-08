-- Extra vaccine/dewormer/category names live on medical_events.notes
-- and transactions.category, same as built-in PPR/ETV/Feed rows.
-- Lookup tables are no longer used.

drop table if exists custom_vaccines;
drop table if exists custom_dewormers;
drop table if exists custom_categories;
