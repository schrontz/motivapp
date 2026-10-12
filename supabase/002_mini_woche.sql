-- Motivator – Mini-Woche / Mini-Monat
-- Bei „X-mal pro Woche/Monat“: ab dieser Anzahl zählt der Zeitraum als geschafft.
-- Leer = nur das Ziel zählt. Kann gefahrlos mehrfach ausgeführt werden.

alter table public.habits add column if not exists schedule_min int;

alter table public.habits drop constraint if exists habits_schedule_min_check;
alter table public.habits add constraint habits_schedule_min_check
  check (schedule_min is null or (schedule_min >= 1 and (schedule_count is null or schedule_min <= schedule_count)));
