-- Motivator – Strecke zählt ab einem Datum (statt „alles, was Withings weiß“)
-- Kann gefahrlos mehrfach ausgeführt werden. Leer = Standard: 30 Tage vor dem Verbinden mit Withings.
alter table public.profiles add column if not exists travel_from date;
