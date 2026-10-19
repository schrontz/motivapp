-- Motivator – Puls von Withings (Ruhepuls aus dem Schlaf, Puls pro Tag)
-- Kann gefahrlos mehrfach ausgeführt werden.
-- Reihenfolge: ERST dieses Skript ausführen, DANN die Server-Funktion „withings“ neu einspielen.

-- Puls pro Tag (aus der Tagesaktivität der Uhr)
alter table public.daily_activity add column if not exists hr_avg int;
alter table public.daily_activity add column if not exists hr_min int;
alter table public.daily_activity add column if not exists hr_max int;

-- Schlaf: eine Zeile pro Nacht (Tag = Aufwach-Tag laut Withings). Schreibt nur die Server-Funktion.
create table if not exists public.sleep_summary (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  hr_avg int,            -- Ø Puls im Schlaf = „Ruhepuls“ in der App
  hr_min int,
  hr_max int,
  sleep_min int,         -- Schlafdauer in Minuten
  data jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.sleep_summary enable row level security;
drop policy if exists "sleep_summary_read_own" on public.sleep_summary;
create policy "sleep_summary_read_own" on public.sleep_summary
  for select to authenticated using (user_id = (select auth.uid()));
