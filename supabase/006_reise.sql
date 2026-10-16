-- Motivator – Reiseziele („Wie weit bin ich gekommen?“)
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Startort der Reise (z. B. „Frankfurt am Main“) – gilt auf allen Geräten
alter table public.profiles add column if not exists travel_start text;

-- Reiseziele: höchstens eins offen (reached_on leer), erreichte bleiben als Sammlung
create table if not exists public.travel_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_city text not null,
  city text not null,
  created_at timestamptz not null default now(),
  reached_on date,                      -- Tag der Ankunft
  seen boolean not null default false   -- Feier schon gezeigt?
);
create unique index if not exists travel_goals_one_open on public.travel_goals (user_id) where reached_on is null;
create index if not exists travel_goals_user_idx on public.travel_goals (user_id, created_at);

alter table public.travel_goals enable row level security;
drop policy if exists "travel_goals_own" on public.travel_goals;
create policy "travel_goals_own" on public.travel_goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
