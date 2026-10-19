-- Motivator – Puls über den Tag (alle ~10 Minuten von der Uhr) und „ruhigste halbe Stunde“ pro Tag
-- Kann gefahrlos mehrfach ausgeführt werden.
-- Reihenfolge: ERST dieses Skript ausführen, DANN die Server-Funktion „withings“ neu einspielen.

-- Einzelne Pulswerte (für den Ruhepuls und später „Puls nach der ersten Zigarette“). Schreibt nur die Server-Funktion.
create table if not exists public.heart_samples (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null,
  bpm int not null,
  primary key (user_id, at)
);

-- Pro Tag: Ruhepuls = Mittelwert der ruhigsten halben Stunde (3 Messungen hintereinander, mittlerer Wert)
create table if not exists public.daily_heart (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  rest_hr int,           -- ruhigste halbe Stunde
  samples int,           -- Anzahl gültiger Messungen an dem Tag
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.heart_samples enable row level security;
alter table public.daily_heart enable row level security;
drop policy if exists "heart_samples_read_own" on public.heart_samples;
create policy "heart_samples_read_own" on public.heart_samples
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "daily_heart_read_own" on public.daily_heart;
create policy "daily_heart_read_own" on public.daily_heart
  for select to authenticated using (user_id = (select auth.uid()));
