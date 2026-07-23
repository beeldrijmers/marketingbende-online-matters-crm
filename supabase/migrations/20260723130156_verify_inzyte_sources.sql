alter table public.inzyte_links
    add column ga4_verified_at timestamp with time zone,
    add column gsc_verified_at timestamp with time zone,
    add column gbp_verified_at timestamp with time zone,
    add column ads_verified_at timestamp with time zone;

-- Existing rows were created before the selected source was checked against a
-- live provider response. Keep their configuration, but do not present it as
-- verified until the user reselects and saves a source from the live list.
update public.inzyte_links
set last_verified_at = null;

alter table public.inzyte_links
    add constraint inzyte_links_ga4_verification_check
        check (
            ga4_verified_at is null
            or (ga4_connection_id is not null and ga4_property_id is not null)
        ),
    add constraint inzyte_links_gsc_verification_check
        check (gsc_verified_at is null or gsc_site_url is not null),
    add constraint inzyte_links_gbp_verification_check
        check (gbp_verified_at is null or gbp_location_id is not null),
    add constraint inzyte_links_ads_verification_check
        check (ads_verified_at is null or ads_customer_id is not null);

comment on column public.inzyte_links.ga4_verified_at is
    'Set only after the selected GA4 property was found in the live Inzyte response.';
comment on column public.inzyte_links.gsc_verified_at is
    'Set only after the selected Search Console site was found in the live Inzyte response.';
comment on column public.inzyte_links.gbp_verified_at is
    'Set only after the selected Business Profile location was found in the live Inzyte response.';
comment on column public.inzyte_links.ads_verified_at is
    'Set only after the selected Google Ads account was found in the live Inzyte response.';
