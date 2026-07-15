create extension if not exists "pg_net" with schema "extensions";
create extension if not exists "pg_cron";

-- The secrets are resolved from Vault at execution time and are provisioned
-- by the deploy workflow. Keeping them out of this migration prevents secret
-- material from entering Git history, database job definitions, or logs.
select cron.schedule(
  'marketingbende-gmail-sync',
  '12,27,42,57 * * * *',
  $gmail_cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'marketingbende_crm_project_url'
      ) || '/functions/v1/gmail-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-gmail-sync-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'marketingbende_gmail_sync_secret'
        )
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron',
        'scheduled_at', now()
      ),
      timeout_milliseconds := 120000
    ) as request_id;
  $gmail_cron$
);

-- A fresh/local database has no production Vault values. The deploy workflow
-- activates the job only after both secrets have been stored successfully.
select cron.alter_job(
  job_id := (
    select jobid from cron.job where jobname = 'marketingbende-gmail-sync'
  ),
  active := false
);

-- pg_cron does not prune its own history. Retain enough evidence for
-- operations while preventing unbounded growth at a 15-minute cadence.
select cron.schedule(
  'cleanup-marketingbende-gmail-sync-history',
  '17 3 * * 0',
  $gmail_cron_cleanup$
    delete from cron.job_run_details
    where end_time < now() - interval '30 days'
      and jobid in (
        select jobid
        from cron.job
        where jobname in (
          'marketingbende-gmail-sync',
          'cleanup-marketingbende-gmail-sync-history'
        )
      );
  $gmail_cron_cleanup$
);
