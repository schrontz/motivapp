-- Motivator – Krafttraining aus Alpha Progression + Steigerungspläne
-- Kann gefahrlos mehrfach ausgeführt werden.

-- ───────── Einheiten aus Alpha Progression ─────────
-- Eine Zeile pro Einheit. Die Übungen samt Sätzen stehen als Liste in `exercises`:
-- [{ "name": "Curls", "equipment": "Kurzhanteln", "kind": "kg_reps",
--    "sets": [{ "kg": 7, "reps": 20 }, …] }, …]
create table if not exists public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ext_id text not null,                 -- z. B. "alpha:2026-10-08T07:24" – verhindert Doppelte beim erneuten Import
  source text not null default 'alpha',
  title text not null,
  program text,
  started_at timestamptz not null,
  day date not null,
  duration_min int,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, ext_id)
);
alter table public.strength_sessions drop constraint if exists strength_sessions_exercises_check;
alter table public.strength_sessions add constraint strength_sessions_exercises_check
  check (jsonb_typeof(exercises) = 'array');
create index if not exists strength_sessions_user_day_idx on public.strength_sessions (user_id, day);

alter table public.strength_sessions enable row level security;
drop policy if exists "strength_sessions_own" on public.strength_sessions;
create policy "strength_sessions_own" on public.strength_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ───────── Steigerungsplan pro Übung ─────────
-- „3 Sätze × 20 bei 7 kg, alle 2 Wochen +2, bis 40 – dann +3 kg und zurück auf 20“
create table if not exists public.exercise_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise text not null,
  equipment text not null default '',
  sets int not null default 3 check (sets between 1 and 20),
  start_reps int not null check (start_reps between 1 and 200),
  kg numeric not null check (kg >= 0),
  plus_reps int not null default 2 check (plus_reps between 1 and 50),
  every_weeks int not null default 2 check (every_weeks between 1 and 12),
  max_reps int not null check (max_reps between 1 and 300),
  kg_step numeric not null default 2.5 check (kg_step > 0),
  started_on date not null,             -- Montag der ersten Woche, die zählt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise, equipment)
);
alter table public.exercise_plans drop constraint if exists exercise_plans_max_check;
alter table public.exercise_plans add constraint exercise_plans_max_check check (max_reps >= start_reps);

alter table public.exercise_plans enable row level security;
drop policy if exists "exercise_plans_own" on public.exercise_plans;
create policy "exercise_plans_own" on public.exercise_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
