-- Motivator – Körperwerte (Renpho-Waage)
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Eine Zeile pro Messtag. Alle Werte der Waage stehen in `vals` (auch die, die gerade nicht angezeigt werden):
-- { "weight": 83.35, "fat_pct": 27.8, "muscle_kg": 57.18, … }
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ext_id text not null,                 -- z. B. "renpho:2026-10-08" – ein Eintrag pro Tag, verhindert Doppelte
  source text not null default 'renpho',
  measured_at timestamptz not null,
  day date not null,
  weight numeric,
  vals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, ext_id)
);
alter table public.body_measurements drop constraint if exists body_measurements_vals_check;
alter table public.body_measurements add constraint body_measurements_vals_check
  check (jsonb_typeof(vals) = 'object');
create index if not exists body_measurements_user_day_idx on public.body_measurements (user_id, day);

alter table public.body_measurements enable row level security;
drop policy if exists "body_measurements_own" on public.body_measurements;
create policy "body_measurements_own" on public.body_measurements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
