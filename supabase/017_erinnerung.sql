-- Motivator – Erinnerung: eine Nachricht am Tag, wenn noch etwas offen ist.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- Danach: Edge Function „erinnerung“ anlegen (Code aus supabase/functions/erinnerung/index.ts), „Verify JWT“ AUS.
-- Es gibt keine Schlüssel zum Abtippen: Die Funktion erzeugt ihr Schlüsselpaar beim ersten Aufruf selbst,
-- und das Geheimnis für den Zeitplan erzeugt dieses Skript im Vault.

-- ───────── Einstellungen pro Person ─────────
alter table public.profiles add column if not exists remind_on boolean not null default false;
alter table public.profiles add column if not exists remind_at smallint;          -- Minuten seit Mitternacht, z. B. 1200 = 20:00
alter table public.profiles add column if not exists remind_tz text;              -- Zeitzone des Geräts, z. B. Europe/Berlin
alter table public.profiles add column if not exists remind_last date;            -- an diesem Tag schon erinnert (oder nichts offen)
alter table public.profiles drop constraint if exists profiles_remind_at_check;
alter table public.profiles add constraint profiles_remind_at_check check (remind_at is null or remind_at between 0 and 1439);

-- Pro Gewohnheit: in die Erinnerung aufnehmen?
alter table public.habits add column if not exists remind boolean not null default true;

-- ───────── Geräte, die Nachrichten bekommen ─────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,                                   -- z. B. „iPhone“ – nur zur Anzeige
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ───────── Schlüssel der App (VAPID) ─────────
-- Nur die Edge Function liest das (Server-Schlüssel). Keine Policy = für Nutzer unsichtbar.
create table if not exists public.push_keys (
  id smallint primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;

-- ───────── Zeitplan: alle 5 Minuten die Funktion anstoßen ─────────
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Geheimnis, damit nur der Zeitplan die Runde starten kann (einmalig erzeugt, bleibt im Vault)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'motivator_remind') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'motivator_remind', 'Erinnerung: Zeitplan → Edge Function');
  end if;
end $$;

-- Die Funktion fragt hier nach, ob das mitgeschickte Geheimnis stimmt (sie selbst kennt es nicht)
create or replace function public.remind_secret_ok(token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'motivator_remind' and decrypted_secret = token);
$$;
revoke all on function public.remind_secret_ok(text) from public, anon, authenticated;
grant execute on function public.remind_secret_ok(text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'motivator-erinnerung';
select cron.schedule(
  'motivator-erinnerung',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://msjvorshfezbcsomsvmj.supabase.co/functions/v1/erinnerung',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-motivator-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'motivator_remind')
    ),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Prüfen: select jobname, schedule from cron.job;
-- Letzte Läufe: select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
-- Antworten der Funktion: select status_code, content from net._http_response order by created desc limit 5;
