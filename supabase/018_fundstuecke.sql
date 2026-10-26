-- Motivator – Fundstücke: Jede erledigte Gewohnheit deckt Buchstaben auf – ist alles frei, gehört das Fundstück dir.
-- Kann gefahrlos mehrfach ausgeführt werden.

create table if not exists public.finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,                       -- Wikipedia-Titel (bis zum Finden ein Rätsel)
  description text,                          -- Kurzbeschreibung = Hinweis zum Raten
  extract text,                              -- Einleitung des Artikels (für offline)
  image text,                                -- Vorschaubild
  url text,                                  -- Link zum Artikel
  source text not null default 'walk' check (source in ('start', 'walk', 'branch')),
  origin text,                               -- „über ‚Gotik‘“ oder „Essen: zum ersten Mal Kümmel“
  base integer not null default 0,           -- aufgedeckte Buchstaben aus abgeschlossenen Tagen (kann am ersten Tag negativ sein)
  base_day date not null default current_date,
  found_day date,                            -- leer = noch offen
  options jsonb not null default '[]'::jsonb,  -- Wohin geht es weiter? [{ title, description }]
  chosen text,                               -- gewählter Titel daraus
  created_day date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists finds_user_idx on public.finds (user_id, created_at);
-- Immer höchstens ein offenes Fundstück pro Person (schützt vor doppeltem Anlegen in zwei Fenstern)
create unique index if not exists finds_one_open on public.finds (user_id) where found_day is null;

alter table public.finds enable row level security;
drop policy if exists "finds_own" on public.finds;
create policy "finds_own" on public.finds
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
