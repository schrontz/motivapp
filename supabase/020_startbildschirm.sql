-- Motivator – Startbildschirm: Reihenfolge der Blöcke (Ringe, Heute, Fundstück, …) pro Person.
-- Kann gefahrlos mehrfach ausgeführt werden.
alter table public.profiles add column if not exists home_order text[];  -- leer = Standardreihenfolge
