-- Motivator – Fundstücke raten: richtig geraten = Stern („erraten mit 4 von 11 Buchstaben“).
-- Der Artikel öffnet sich trotzdem erst, wenn alle Buchstaben aufgedeckt sind.
-- Kann gefahrlos mehrfach ausgeführt werden.
alter table public.finds add column if not exists guessed_with smallint;  -- aufgedeckte Buchstaben beim richtigen Tipp (leer = nicht erraten)
