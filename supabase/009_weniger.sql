-- Motivator – „Weniger von …“ (zuerst: Rauchen)
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Einstellungen: eine Zeile pro Person und Art (später z. B. auch „alkohol“)
create table if not exists public.reduce_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'rauchen',
  started_on date not null default current_date,       -- Beginn der ersten Woche (nur zählen)
  costs jsonb not null default '{}'::jsonb,            -- Preise: Tabak, Blättchen, Filter, Gramm pro Zigarette
  night_from text not null default '23:00',            -- Nachtruhe: Abstand läuft nicht
  night_to text not null default '07:00',
  step_min integer not null default 5 check (step_min between 0 and 60),   -- Abstand wird pro Woche so viel länger
  adjust_min integer not null default 0,               -- eigene Korrektur (− / +)
  show_card boolean not null default true,             -- Karte auf der Übersicht
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
alter table public.reduce_settings drop constraint if exists reduce_settings_costs_check;
alter table public.reduce_settings add constraint reduce_settings_costs_check check (jsonb_typeof(costs) = 'object');

-- Ereignisse: jedes Mal „Geraucht“
create table if not exists public.reduce_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'rauchen',
  at timestamptz not null default now(),
  day date not null,                                   -- Kalendertag (Gerätezeit)
  created_at timestamptz not null default now()
);
create index if not exists reduce_events_user_at_idx on public.reduce_events (user_id, kind, at);

alter table public.reduce_settings enable row level security;
alter table public.reduce_events enable row level security;
drop policy if exists "reduce_settings_own" on public.reduce_settings;
create policy "reduce_settings_own" on public.reduce_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "reduce_events_own" on public.reduce_events;
create policy "reduce_events_own" on public.reduce_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
