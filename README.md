# Motivator

Gewohnheiten aufbauen – freundlich statt streng. Quote statt Streak, Mini-Versionen zählen, Pausen zählen nicht gegen dich.

Live: https://schrontz.github.io/motivapp/ · Demo ohne Login: https://schrontz.github.io/motivapp/?demo

## Einrichtung (einmalig)

1. **Datenbank:** Im Supabase-Dashboard → *SQL Editor* → Inhalt von [`supabase/001_fundament.sql`](supabase/001_fundament.sql) einfügen → *Run*. Das Skript kann gefahrlos mehrfach laufen.
2. **Konten anlegen:** *Authentication → Users → Add user → Create new user* (E-Mail + Passwort, „Auto Confirm User“ anhaken).
3. **Fremde Registrierungen sperren:** *Authentication → Sign In / Providers* → „Allow new users to sign up“ ausschalten. Neue Konten legst du dann nur noch selbst an (Schritt 2).
4. **GitHub Pages:** *Settings → Pages → Deploy from a branch → main / root*.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Gerüst und Gestaltung (hell/dunkel folgt dem Gerät) |
| `js/app.js` | Zustand, Navigation, Aktionen |
| `js/views.js` | Alle Bildschirme |
| `js/stats.js` | Quoten, Ringe, Statistik – reine Funktionen, getestet |
| `js/dates.js` | Datums-Hilfen |
| `js/db.js` | Supabase-Zugriff + Demo-Daten (`?demo`) |
| `supabase/` | SQL-Skripte |
| `tests/` | `npm test` (Node 20+) |

Kein Build-Schritt: Dateien hochladen, fertig.
