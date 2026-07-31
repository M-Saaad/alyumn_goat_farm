-- Palai fee month (which month the boarding payment is for)

alter table palai_payments
  add column if not exists service_month text;

update palai_payments
set service_month = to_char(date, 'YYYY-MM')
where service_month is null;

alter table palai_payments
  alter column service_month set not null;

create index if not exists idx_palai_payments_customer_month
  on palai_payments(customer_id, service_month);
