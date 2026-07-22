create index inzyte_links_created_by_idx
    on public.inzyte_links using btree (created_by);

create index inzyte_runs_requested_by_idx
    on public.inzyte_runs using btree (requested_by);
