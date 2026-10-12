# Motivator

Gewohnheiten aufbauen – freundlich statt streng. Quote statt Streak, Mini-Versionen zählen, Pausen zählen nicht gegen dich.

Live: https://schrontz.github.io/motivapp/ · Demo ohne Login: https://schrontz.github.io/motivapp/?demo

## Einrichtung (einmalig)

1. **Datenbank:** Im Supabase-Dashboard → *SQL Editor* → Inhalt von [`supabase/001_fundament.sql`](supabase/001_fundament.sql) einfügen → *Run*. Das Skript kann gefahrlos mehrfach laufen.
2. **Konten anlegen:** *Authentication → Users → Add user → Create new user* (E-Mail + Passwort, „Auto Confirm User“ anhaken).
3. **Fremde Registrierungen sperren:** *Authentication → Sign In / Providers* → „Allow new users to sign up“ ausschalten. Neue Konten legst du dann nur noch selbst an (Schritt 2).
4. **GitHub Pages:** *Settings → Pages → Deploy from a branch → main / root*.

## Datenbank-Updates

Neue SQL-Dateien in `supabase/` der Reihe nach im SQL-Editor ausführen (jede einmal, Wiederholen schadet nicht):
`001_fundament.sql` → `002_mini_woche.sql` → `003_withings.sql`

## Withings verbinden (einmalig)

1. **Withings-App anlegen:** developer.withings.com → Dashboard → neue App (Public API). Redirect-URL: `https://schrontz.github.io/motivapp/`. Client ID in `js/config.js` eintragen (`WITHINGS_CLIENT_ID`).
2. **Server-Funktion:** Supabase → *Edge Functions* → *Deploy a new function* → *Via Editor* → Name `withings` → Inhalt von [`supabase/functions/withings/index.ts`](supabase/functions/withings/index.ts) einfügen → *Deploy*.
3. **JWT-Prüfung aus:** In den Einstellungen der Funktion „Verify JWT“ / „Enforce JWT verification“ ausschalten (die Funktion prüft den Login selbst).
4. **Secrets:** *Edge Functions → Secrets* → `WITHINGS_CLIENT_ID` und `WITHINGS_CLIENT_SECRET` anlegen. Das Secret gehört nur hierher – nie ins Repo.
5. In der App: *Profil → Mit Withings verbinden*.

Falls die Funktion „Kein Server-Schlüssel gefunden“ meldet: unter *Project Settings → API Keys* einen Secret Key kopieren und als Secret `MOTIVATOR_SECRET_KEY` anlegen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Gerüst und Gestaltung (hell/dunkel folgt dem Gerät) |
| `js/app.js` | Zustand, Navigation, Aktionen |
| `js/views.js` | Alle Bildschirme |
| `js/stats.js` | Quoten, Ringe, Statistik – reine Funktionen, getestet |
| `js/auto.js` | Withings: Trainingsarten, Auto-Abhaken, Kacheln – getestet |
| `supabase/functions/withings/` | Server-Funktion für die Withings-API |
| `js/dates.js` | Datums-Hilfen |
| `js/db.js` | Supabase-Zugriff + Demo-Daten (`?demo`) |
| `supabase/` | SQL-Skripte |
| `tests/` | `npm test` (Node 20+) |

Kein Build-Schritt: Dateien hochladen, fertig.
