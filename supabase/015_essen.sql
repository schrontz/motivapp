-- Motivator – Essen: Lebensmittel (BLS 4.0), Mahlzeiten, Favoriten
-- Kann gefahrlos mehrfach ausgeführt werden.
-- Danach: Die Datei bls_motivator.csv über Table Editor → bls_foods → „Insert“ → „Import data from CSV“ einspielen.

-- ───────── Lebensmittel: Nährwerte je 100 g aus dem Bundeslebensmittelschlüssel (Max Rubner-Institut) ─────────
-- Leere Werte = im BLS nicht bestimmt (unbekannt, nicht 0).
create table if not exists public.bls_foods (
  code text primary key,      -- z. B. G480100
  name text not null,         -- „Speisezwiebel roh“
  kcal numeric, protein numeric, fat numeric, carbs numeric, fiber numeric, sugar numeric, salt numeric,
  iron numeric,               -- mg
  zinc numeric,               -- mg
  magnesium numeric,          -- mg
  calcium numeric,            -- mg
  potassium numeric,          -- mg
  folate numeric,             -- µg Folat-Äquivalent
  vit_c numeric,              -- mg
  vit_b12 numeric,            -- µg
  vit_d numeric,              -- µg
  iodine numeric              -- µg
);
alter table public.bls_foods enable row level security;
drop policy if exists "bls_foods_read" on public.bls_foods;
create policy "bls_foods_read" on public.bls_foods for select to authenticated using (true);

-- ───────── Mahlzeiten ─────────
-- items: [{ code, name, grams }] – Gramm für eine normale Portion; portion: 0.75 / 1 / 1.5
-- nutr: Summe der Nährwerte dieser Mahlzeit (schon mit Portion) – gespeichert, damit der Verlauf nicht nachladen muss
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  day date not null,
  name text not null,
  portion numeric not null default 1 check (portion > 0 and portion <= 5),
  items jsonb not null default '[]'::jsonb,
  plants text[] not null default '{}',
  home boolean not null default false,     -- selbst gekocht
  nutr jsonb not null default '{}'::jsonb,
  fav_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_day_idx on public.meals (user_id, day);

-- Favoriten: „wie immer“ mit einem Tipp
create table if not exists public.meal_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  plants text[] not null default '{}',
  home boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.meals enable row level security;
alter table public.meal_favorites enable row level security;
drop policy if exists "meals_own" on public.meals;
create policy "meals_own" on public.meals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "meal_favorites_own" on public.meal_favorites;
create policy "meal_favorites_own" on public.meal_favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
