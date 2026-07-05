-- Add the collaboration party column to sales.
-- Values map to the three collaborating parties: Online Matters, Marketingbende
-- and Groeien met Ads. A NOT NULL default keeps trigger- and edge-function-based
-- inserts working without change; the users edge function sets the chosen value.
alter table public.sales
    add column if not exists partij text not null default 'marketingbende';

alter table public.sales
    drop constraint if exists sales_partij_check;

alter table public.sales
    add constraint sales_partij_check
    check (partij in ('online_matters', 'marketingbende', 'groeien_met_ads'));
