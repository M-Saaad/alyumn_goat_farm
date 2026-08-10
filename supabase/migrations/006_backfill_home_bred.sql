-- Mark existing farm-born kids (price 0, no vendor) as home_bred.
-- Safe to re-run: only updates rows not already flagged.

update animals
set
  home_bred = true,
  price = 0,
  purchased_from = null
where home_bred = false
  and price = 0
  and purchased_from is null;
