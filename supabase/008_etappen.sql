-- Motivator – Etappen auf dem Weg zum Reiseziel
-- Kann gefahrlos mehrfach ausgeführt werden. Setzt 006_reise.sql voraus.

-- Wie viele Etappen schon gefeiert wurden – damit jede Etappe genau einmal gefeiert wird
alter table public.travel_goals add column if not exists stages_seen integer not null default 0;
