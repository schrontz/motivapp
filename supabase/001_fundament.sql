-- Motivator – Fundament (Version 1)
-- Einmal komplett im Supabase SQL-Editor ausführen.
-- Jede Tabelle ist per Row Level Security geschützt: Jede Person sieht nur ihre eigenen Daten.

-- ───────────────────────── Profile ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  modules text[] not null default array['habits'],
  created_at timestamptz not null default now()
);

-- Legt bei jedem neuen Login-Konto automatisch ein Profil an.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profile für bereits bestehende Konten nachziehen.
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ───────────────────────── Kategorien ─────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'blue',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories (user_id);

-- ───────────────────────── Gewohnheiten ─────────────────────────
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'check',
  color text not null default 'blue',

  -- Wie wird gezählt? 'check' = abhaken, 'count' = Zahl eintragen
  kind text not null default 'check' check (kind in ('check', 'count')),
  target numeric,              -- nur bei 'count': Tagesziel
  unit text,                   -- nur bei 'count': z. B. 'Wdh.', 'Schritte'

  -- Wie oft? 'daily' | 'weekdays' (bestimmte Tage) | 'per_week' | 'per_month'
  schedule text not null default 'daily' check (schedule in ('daily', 'weekdays', 'per_week', 'per_month')),
  schedule_days int[],         -- bei 'weekdays': 1 = Montag … 7 = Sonntag
  schedule_count int,          -- bei 'per_week' / 'per_month': wie oft

  -- Mini-Version für schwere Tage
  mini_text text,
  mini_value numeric,          -- bei 'count': Wert der Mini-Version

  -- Steigerung (Logik folgt in einer späteren Version)
  progression_step numeric,    -- z. B. +2
  progression_every_weeks int, -- z. B. alle 2 Wochen
  progression_max numeric,     -- z. B. bis 40, dann Gewicht hoch
  weight_kg numeric,           -- aktuelles Gewicht
  weight_step_kg numeric,      -- Gewichtssprung an der Obergrenze

  start_day date not null default current_date,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id);
create index if not exists habits_category_idx on public.habits (category_id);

-- ───────────────────────── Einträge ─────────────────────────
-- Ein Eintrag pro Gewohnheit und Tag.
-- status: 'done' = geschafft, 'mini' = Mini-Version geschafft, 'partial' = Zahl eingetragen, Ziel noch nicht erreicht
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  status text not null check (status in ('done', 'mini', 'partial')),
  value numeric,
  created_at timestamptz not null default now(),
  unique (habit_id, day)
);
create index if not exists habit_logs_user_day_idx on public.habit_logs (user_id, day);

-- ───────────────────────── Pausen ─────────────────────────
-- habit_id leer = Pause für alle Gewohnheiten. Pausentage zählen nicht in die Quoten.
create table if not exists public.pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid references public.habits (id) on delete cascade,
  start_day date not null,
  end_day date not null,
  created_at timestamptz not null default now(),
  check (end_day >= start_day)
);
create index if not exists pauses_user_idx on public.pauses (user_id);
create index if not exists pauses_habit_idx on public.pauses (habit_id);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;
alter table public.pauses     enable row level security;

drop policy if exists "profile_select_own" on public.profiles;
drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profile_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['categories', 'habits', 'habit_logs', 'pauses'] loop
    execute format('drop policy if exists "%1$s_own" on public.%1$I', t);
    execute format(
      'create policy "%1$s_own" on public.%1$I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Verweise dürfen nur auf eigene Datensätze zeigen
-- (verhindert, dass jemand einen Eintrag an eine fremde Gewohnheit hängt).
create or replace function public.check_category_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'Kategorie gehört nicht zu diesem Konto';
  end if;
  return new;
end;
$$;

create or replace function public.check_habit_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.habit_id is not null and not exists (
    select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id
  ) then
    raise exception 'Gewohnheit gehört nicht zu diesem Konto';
  end if;
  return new;
end;
$$;

drop trigger if exists habits_owner_refs on public.habits;
create trigger habits_owner_refs before insert or update on public.habits
  for each row execute function public.check_category_owner();
drop trigger if exists habit_logs_owner_refs on public.habit_logs;
create trigger habit_logs_owner_refs before insert or update on public.habit_logs
  for each row execute function public.check_habit_owner();
drop trigger if exists pauses_owner_refs on public.pauses;
create trigger pauses_owner_refs before insert or update on public.pauses
  for each row execute function public.check_habit_owner();
