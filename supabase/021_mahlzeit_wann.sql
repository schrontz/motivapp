-- Motivator – Essen: Mahlzeit (Frühstück, Mittag, Snack, Abendessen). Das Datum steht schon in meals.day.
-- Kann gefahrlos mehrfach ausgeführt werden.
alter table public.meals add column if not exists slot text;
alter table public.meals drop constraint if exists meals_slot_check;
alter table public.meals add constraint meals_slot_check check (slot is null or slot in ('fruehstueck', 'mittag', 'snack', 'abend'));
