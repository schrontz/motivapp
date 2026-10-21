-- Motivator – Reiseziele vormerken („Danach“): ist ein Ziel erreicht, kommt das nächste dran
-- Kann gefahrlos mehrfach ausgeführt werden.
alter table public.profiles add column if not exists travel_queue text[] not null default '{}';
