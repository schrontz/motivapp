-- Motivator – Meine Orte (eigene Reiseziele aus der OpenStreetMap-Suche)
-- Kann gefahrlos mehrfach ausgeführt werden. Setzt 006_reise.sql voraus.

create table if not exists public.travel_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  label text,                           -- z. B. „Bayern, Deutschland“
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.travel_places enable row level security;
drop policy if exists "travel_places_own" on public.travel_places;
create policy "travel_places_own" on public.travel_places
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Ziele merken sich die Koordinaten eigener Orte (bleiben gültig, auch wenn der Ort gelöscht wird)
alter table public.travel_goals add column if not exists lat double precision;
alter table public.travel_goals add column if not exists lng double precision;
