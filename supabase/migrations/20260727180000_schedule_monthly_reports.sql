-- De maandrapportage draait vanzelf bij maandafsluiting.
--
-- Elke rapportage moest per klant met de hand worden aangezet. Het gevolg stond
-- in de cijfers: achttien meetkoppelingen, drie rapportages, alle drie over
-- dezelfde maand. Werk dat je moet gaan halen, haal je niet.
--
-- Waarom elk uur en niet één keer per maand: de taak pakt per aanroep een paar
-- klanten en slaat een maand over die al een rapportage heeft. Vaker draaien
-- kost dus niets en betekent dat een storing bij Google om zeven uur 's ochtends
-- geen klant een maand laat missen.
--
-- Waarom pas vanaf de derde: GA4 en Search Console leveren de laatste dagen van
-- een maand met vertraging aan. Een rapportage op de eerste zou de maand
-- structureel te laag weergeven.
select cron.schedule(
  'marketingbende-monthly-reports',
  '23 * 3-8 * *',
  $monthly_reports_cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'marketingbende_crm_project_url'
      ) || '/functions/v1/inzyte',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-inzyte-report-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'marketingbende_inzyte_report_secret'
        )
      ),
      body := jsonb_build_object(
        'source', 'supabase-cron',
        'scheduled_at', now()
      ),
      timeout_milliseconds := 150000
    ) as request_id;
  $monthly_reports_cron$
);

-- Een verse of lokale database heeft geen Vault-waarden. De deploy zet de taak
-- pas aan nadat beide geheimen zijn opgeslagen.
select cron.alter_job(
  job_id := (
    select jobid from cron.job where jobname = 'marketingbende-monthly-reports'
  ),
  active := false
);

-- pg_cron ruimt zijn eigen historie niet op. De bestaande opruimtaak kende deze
-- taak nog niet; opnieuw plannen onder dezelfde naam vervangt de definitie.
select cron.schedule(
  'cleanup-marketingbende-gmail-sync-history',
  '17 3 * * 0',
  $cron_history_cleanup$
    delete from cron.job_run_details
    where end_time < now() - interval '30 days'
      and jobid in (
        select jobid
        from cron.job
        where jobname in (
          'marketingbende-gmail-sync',
          'marketingbende-monthly-reports',
          'cleanup-marketingbende-gmail-sync-history'
        )
      );
  $cron_history_cleanup$
);
