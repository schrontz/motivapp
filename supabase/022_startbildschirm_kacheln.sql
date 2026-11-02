-- Motivator – Startbildschirm-Kacheln und Erinnerung zur üblichen Zeit.
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Welche Module oben als Kachel stehen (höchstens drei). leer = die ersten drei sichtbaren.
alter table public.profiles add column if not exists home_tiles text[];

-- Erinnerung pro Gewohnheit:
--   null    = noch nicht gefragt (in der Abend-Nachricht)
--   'daily' = „Passt so“ – bleibt in der Abend-Nachricht
--   'usual' = eigene Erinnerung 30 Minuten vor „meist gegen …“
alter table public.habits add column if not exists remind_mode text;
alter table public.habits drop constraint if exists habits_remind_mode_check;
alter table public.habits add constraint habits_remind_mode_check check (remind_mode is null or remind_mode in ('daily', 'usual'));

-- an diesem Tag schon zur üblichen Zeit erinnert (dann nicht noch einmal am Abend)
alter table public.habits add column if not exists remind_last date;
