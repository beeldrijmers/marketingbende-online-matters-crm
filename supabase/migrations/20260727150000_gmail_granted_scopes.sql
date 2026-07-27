-- Welke toegang Google werkelijk heeft gegeven.
--
-- Of iemand bij het koppelen ook toegang tot zijn agenda heeft toegestaan was
-- onzichtbaar: je kwam er pas achter door een afspraak te proberen en dan een
-- foutmelding te krijgen. Google zet de toegekende scopes in elk tokenantwoord,
-- dus door ze te bewaren weet het CRM het na de eerstvolgende synchronisatie
-- (elk kwartier) gewoon, zonder dat iemand iets hoeft uit te proberen.
alter table public.gmail_connections
    add column if not exists granted_scopes text;

-- Hier is een grant WEL nodig: gmail_connections is voor de clientrollen op
-- kolomniveau gegrant (het versleutelde refresh token en de history-cursor blijven
-- er bewust buiten), dus een nieuwe kolom is zonder dit onzichtbaar voor de
-- frontend. Schrijven blijft aan de edge functions, die met de service role werken.
grant select (granted_scopes) on table public.gmail_connections to authenticated;
