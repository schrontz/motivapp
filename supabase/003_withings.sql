-- Motivator – Withings-Anbindung
-- Kann gefahrlos mehrfach ausgeführt werden.

-- ───────── Regeln für automatisches Abhaken ─────────
alter table public.habits add column if not exists auto_categories int[];   -- Withings-Trainingsarten (-1 = alle sonstigen)
alter table public.habits add column if not exists auto_min_minutes int;    -- Mindestdauer
alter table public.habits add column if not exists auto_metric text;        -- 'steps' | 'active' | 'distance' (für Zahl-Gewohnheiten)
alter table public.habits drop constraint if exists habits_auto_metric_check;
alter table public.habits add constraint habits_auto_metric_check
  check (auto_metric is null or auto_metric in ('steps', 'active', 'distance'));

-- Woher kommt ein Eintrag? 'manual' oder 'withings'
alter table public.habit_logs add column if not exists source text not null default 'manual';

-- Welche Kacheln zeigt die Übersicht?
alter table public.profiles add column if not exists tiles text[] not null default array['steps', 'training'];

-- ───────── Zugangsdaten (nur für die Server-Funktion) ─────────
-- RLS an, aber KEINE Policy: Die App im Browser kann die Tokens nie lesen.
create table if not exists public.withings_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  withings_userid text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz
);
alter table public.withings_tokens enable row level security;
revoke all on public.withings_tokens from anon, authenticated;

-- Status ohne Tokens für die App
create or replace function public.withings_status()
returns table (connected boolean, last_sync_at timestamptz, connected_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select true, t.last_sync_at, t.connected_at
  from public.withings_tokens t
  where t.user_id = (select auth.uid());
$$;
revoke all on function public.withings_status() from public, anon;
grant execute on function public.withings_status() to authenticated;

-- ───────── Daten von Withings (schreibt nur die Server-Funktion) ─────────
create table if not exists public.daily_activity (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  steps int,
  distance_m numeric,
  active_minutes int,
  calories numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ext_id text not null,
  day date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  category int not null,
  duration_min numeric not null,
  calories numeric,
  hr_avg int,
  hr_min int,
  hr_max int,
  data jsonb,
  unique (user_id, ext_id)
);
create index if not exists workouts_user_day_idx on public.workouts (user_id, day);

alter table public.daily_activity enable row level security;
alter table public.workouts enable row level security;
drop policy if exists "daily_activity_read_own" on public.daily_activity;
create policy "daily_activity_read_own" on public.daily_activity
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "workouts_read_own" on public.workouts;
create policy "workouts_read_own" on public.workouts
  for select to authenticated using (user_id = (select auth.uid()));

-- ───────── Abgelehnte Auto-Haken ─────────
-- Nimmst du einen automatischen Haken zurück, merkt sich die App das und setzt ihn nicht wieder.
create table if not exists public.auto_dismissals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);
alter table public.auto_dismissals enable row level security;
drop policy if exists "auto_dismissals_own" on public.auto_dismissals;
create policy "auto_dismissals_own" on public.auto_dismissals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop trigger if exists auto_dismissals_owner_refs on public.auto_dismissals;
create trigger auto_dismissals_owner_refs before insert or update on public.auto_dismissals
  for each row execute function public.check_habit_owner();
