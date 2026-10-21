-- Motivator – „Alkoholfrei“ (nutzt die Tabellen von „Weniger von …“, Update 009)
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Ein Eintrag kann mehrere Getränke umfassen und sagt optional, was los war
alter table public.reduce_events add column if not exists qty integer not null default 1;
alter table public.reduce_events drop constraint if exists reduce_events_qty_check;
alter table public.reduce_events add constraint reduce_events_qty_check check (qty between 1 and 50);
alter table public.reduce_events add column if not exists tags text[] not null default '{}';
