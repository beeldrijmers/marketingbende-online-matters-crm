-- Task ownership integrity. sales_id was an unconstrained bigint. The FK is
-- added NOT VALID so it enforces new rows without failing on any legacy orphan,
-- and ON DELETE SET NULL keeps a task when its owner is removed. The
-- (sales_id, due_date) index backs the team task overview query.
alter table public.tasks
    add constraint tasks_sales_id_fkey foreign key (sales_id)
    references public.sales(id) on update cascade on delete set null not valid;

create index if not exists tasks_sales_id_due_date_idx
    on public.tasks using btree (sales_id, due_date);
