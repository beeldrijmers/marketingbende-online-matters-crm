alter table public.sales
    add column hourly_rate numeric(10, 2);

alter table public.sales
    add constraint sales_hourly_rate_nonnegative
    check (hourly_rate is null or hourly_rate >= 0);

comment on column public.sales.hourly_rate is
    'Personal hourly rate excluding VAT; null means not yet determined.';
