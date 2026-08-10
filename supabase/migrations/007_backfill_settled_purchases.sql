-- One-time backfill: mark all goat purchases as fully paid.
-- Safe to re-run: only inserts missing agreements and settles open/partial ones.
-- Does NOT insert transactions (purchases already exist in the imported ledger).

insert into purchase_agreements (
  id,
  animal_id,
  vendor_id,
  total_amount,
  amount_paid,
  status,
  notes,
  created_at
)
select
  gen_random_uuid(),
  a.id,
  a.purchased_from,
  a.price,
  a.price,
  'settled'::agreement_status,
  'Paid in full on purchase date',
  coalesce(a.date_of_purchase::timestamptz, now())
from animals a
where a.price > 0
  and not exists (
    select 1 from purchase_agreements pa where pa.animal_id = a.id
  );

update purchase_agreements pa
set
  total_amount = a.price,
  amount_paid = a.price,
  status = 'settled'::agreement_status,
  vendor_id = coalesce(a.purchased_from, pa.vendor_id),
  notes = coalesce(pa.notes, 'Paid in full on purchase date')
from animals a
where pa.animal_id = a.id
  and a.price > 0
  and (pa.status <> 'settled' or pa.amount_paid < a.price - 0.005);
