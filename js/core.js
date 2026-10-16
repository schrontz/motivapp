// Kern der App: gemeinsamer Zustand, Navigation, Meldungen, Speichern.
// Alle Aktions-Module (./actions/) arbeiten über diese Funktionen.

import * as db from './db.js';
import { indexLogs } from './stats.js';

export const root = document.getElementById('app');

export const S = {
  session: null,
  profile: null,
  categories: [],
  habits: [],
  logs: [],
  pauses: [],
  activity: [],
  workouts: [],
  dismissals: [],
  withings: { connected: false },
  hasWithingsSchema: false,
  strength: [],
  plans: [],
  hasStrengthSchema: false,
  imp: null,
  planDraft: null,
  body: [],
  hasBodySchema: false,
  bimp: null,
  travel: [],
  hasTravelSchema: false,
  travelSheet: false,
  celebrateId: null,
  bodyOpen: new Set(),
  syncing: false,
  idx: new Map(),
  cat: 'all',
  sheet: null,
  pauseSheet: null,
  form: null,
  welcomePause: true,
  loaded: false,
  loginError: ''
};

// Kleine Merkhilfen pro Gerät (Filter, „Willkommen“ schon gesehen). Darf fehlschlagen.
export const local = {
  get(k) { try { return localStorage.getItem('motivator.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('motivator.' + k, v); } catch { /* egal */ } }
};
export const session = {
  get(k) { try { return sessionStorage.getItem('motivator.' + k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem('motivator.' + k, v); } catch { /* egal */ } }
};

S.cat = local.get('cat') || 'all';
S.trainRange = Number(local.get('trainRange') || 30);
S.bodyRange = local.get('bodyRange') || '3m';
S.distRange = local.get('distRange') || 'all';
S.distStart = local.get('distStart') || 'Frankfurt am Main';
S.standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// „Passt so“ beim Muster-Hinweis: erst wieder zeigen, wenn das Muster 4 weitere Zeiträume anhält
S.hintSeen = (id, count) => {
  const seen = Number(local.get('hint.' + id) || 0);
  return seen > 0 && count < seen + 4;
};

// ───────────── Navigation ─────────────

export function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || 'overview', id: parts[1] ? decodeURIComponent(parts[1]) : null };
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// Zurück statt vorwärts: Kommt man von `hash`, einen Schritt zurück – sonst die Seite ersetzen.
// So landet man nach „Speichern“ nicht in einer Schleife (Übung → Plan → Übung → Zurück → Plan).
let lastHash = '';
export function setLastHash(hash) {
  lastHash = hash;
}
export function goBackTo(hash) {
  const same = (a, b) => { try { return decodeURIComponent(a) === decodeURIComponent(b); } catch { return a === b; } };
  if (same(lastHash, hash)) history.back();
  else location.replace(location.pathname + location.search + hash);
}

// ───────────── Darstellung ─────────────

// Die eigentliche Darstellung (Routen → Ansicht) setzt app.js beim Start.
let renderer = () => {};
export function setRenderer(fn) {
  renderer = fn;
}
export function render() {
  renderer();
}

let toastTimer = null;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

// ───────────── Daten ─────────────

export function reindex() {
  S.idx = indexLogs(S.logs);
}

export async function reload() {
  const data = await db.loadAll();
  Object.assign(S, data);
  reindex();
  S.loaded = true;
}

// Speichern im Hintergrund: Oberfläche ist schon aktualisiert. Bei Fehlern neu laden.
export async function persist(fn, errorText = 'Speichern hat nicht geklappt – bitte Verbindung prüfen.') {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    const msg = String((err && err.message) || '');
    let text = errorText;
    if (/schedule_min/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 002 (Mini-Woche) im SQL-Editor ausführen.';
    else if (/travel_/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 006 (Reiseziele) im SQL-Editor ausführen.';
    else if (/body_measurements/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 005 (Körperwerte) im SQL-Editor ausführen.';
    else if (/strength_sessions|exercise_plans/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 004 (Krafttraining) im SQL-Editor ausführen.';
    else if (/auto_|tiles|source|schema cache/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 003 (Withings) im SQL-Editor ausführen.';
    toast(text);
    try { await reload(); } catch { /* offline */ }
    render();
    return null;
  }
}
