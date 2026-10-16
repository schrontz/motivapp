# Motivator – Hinweise für Claude

- Sprache: Deutsch (UI, Kommentare, Commits).
- Stack: Vanilla-JS-PWA ohne Build-Schritt, GitHub Pages, Supabase (eigener Account, Projekt-Ref `msjvorshfezbcsomsvmj`). Der Supabase-Connector hängt an einem anderen Account → SQL-Änderungen als neue Datei `supabase/00X_….sql` schreiben, Jan führt sie im SQL-Editor aus. Skripte idempotent halten.
- Neue Bildschirme/Funktionen: zuerst Mockups (Design-Fläche „Motivator – Mockups“), dann bauen. Kleinigkeiten (Sortierung, Texte, Bugfixes) ohne Mockup – nur wenn es wirklich eine Vorschau braucht.
- Regeln der Statistik (siehe `js/stats.js`): Mini zählt als geschafft, Pausentage zählen nicht, heute zählt erst, wenn geschafft; Quote statt Streak.
- Nie den service_role-Key ins Frontend.
- Vor dem Push: `npm test` und die App im Demo-Modus (`?demo`) im Browser prüfen.
- Bei jeder Änderung an gecachten Dateien die Cache-Version in `sw.js` UND `APP_VERSION` in `js/config.js` erhöhen (steht im Profil – so sieht Jan, welcher Stand läuft).
- Aufbau: `js/core.js` (Zustand, render, persist), `js/actions/*` (Aktionen pro Bereich als `clicks`/`changes`/`submits`), `js/views/*` (Bildschirme pro Bereich, `views.js` bündelt). Neue JS-Dateien auch in `sw.js` → `SHELL` eintragen.
