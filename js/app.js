// Motivator – App-Steuerung: Routen, Ereignisse, Start.
// Zustand und Hilfen liegen in ./core.js, die Aktionen pro Bereich in ./actions/.

import * as db from './db.js';
import * as V from './views.js';
import { S, root, session, route, render, setRenderer, setLastHash, reload } from './core.js';
import { today, diffDays } from './dates.js';
import { lastActivityDay } from './stats.js';
import * as habits from './actions/habits.js';
import * as withings from './actions/withings.js';
import * as strength from './actions/strength.js';
import * as imports from './actions/imports.js';
import * as body from './actions/body.js';
import * as profile from './actions/profile.js';
import * as distance from './actions/distance.js';
import * as reduce from './actions/reduce.js';
import * as alcohol from './actions/alcohol.js';
import * as food from './actions/food.js';
import * as remind from './actions/remind.js';
import { mountDistanceMap, unmountDistanceMap } from './map.js';

const MODULES = [habits, withings, strength, imports, body, profile, distance, reduce, alcohol, food, remind];
const CLICKS = Object.assign({}, ...MODULES.map((m) => m.clicks || {}));
const CHANGES = Object.assign({}, ...MODULES.map((m) => m.changes || {}));
const SUBMITS = Object.assign({}, ...MODULES.map((m) => m.submits || {}));

// ───────────── Darstellung ─────────────

setRenderer(() => {
  if (!S.session) { root.innerHTML = V.login(S.loginError); return; }
  if (!S.loaded) { root.innerHTML = V.loading(); return; }
  const T = today();
  const r = route();
  distance.checkArrival(T);
  if (r.name === 'distance') distance.markSeen();
  let html;
  switch (r.name) {
    case 'habits': html = V.habitsList(S, T); break;
    case 'training': html = r.id ? V.sessionView(S, T, r.id) : V.trainingView(S, T); break;
    case 'steps': html = V.stepsView(S, T); break;
    case 'distance': html = V.distanceView(S, T); break;
    case 'weniger': html = V.reduceView(S, T); break;
    case 'weniger-einrichten': html = V.reduceSettingsView(S, T); break;
    case 'alkohol': html = V.alcoholView(S, T); break;
    case 'alkohol-einrichten': html = V.alcoholSettingsView(S, T); break;
    case 'essen': html = r.id ? V.mealView(S, T, r.id) : V.foodView(S, T); break;
    case 'essen-neu': food.ensureDraft(); html = V.foodForm(S, T); break;
    case 'import': html = V.importView(S); break;
    case 'body': html = V.bodyView(S, T); break;
    case 'body-import': html = V.bodyImportView(S); break;
    case 'exercise': html = V.exerciseView(S, T, r.id); break;
    case 'plan': strength.ensurePlanDraft(r.id, T); html = V.planForm(S, T, r.id); break;
    case 'habit': html = V.detail(S, T, r.id); break;
    case 'new': html = V.habitForm(S, T, null); break;
    case 'edit': html = V.habitForm(S, T, r.id); break;
    case 'erinnerung': html = V.remindView(S, T); break;
    case 'profile': html = V.profile(S, S.session.user && S.session.user.email); break;
    case 'welcome': {
      const last = lastActivityDay(S.logs);
      html = last && diffDays(last, T) > 1 ? V.welcome(S, T, last) : V.overview(S, T);
      break;
    }
    default: html = V.overview(S, T);
  }
  unmountDistanceMap();
  root.innerHTML = html;
  if (r.name === 'distance') { mountDistanceMap(); distance.prefetchWiki(); }
  if (r.name === 'essen-neu') food.mountScanner();
  if ((r.name === 'erinnerung' || r.name === 'profile') && !S.pushDevice) remind.checkDevice();
  if (S.sheet) {
    const input = document.getElementById('sheet-val');
    if (input && S.sheet.focus) { input.focus(); input.select(); S.sheet.focus = false; }
  }
});

window.addEventListener('hashchange', (e) => {
  try { setLastHash(new URL(e.oldURL).hash); } catch { setLastHash(''); }
  S.sheet = null;
  S.pauseSheet = null;
  S.travelSheet = false;
  S.cityInfo = null;
  S.drinkSheet = null;
  S.plantInfo = null;
  if (route().name !== 'essen-neu') food.leaveDraft();
  S.form = null;
  const r = route();
  imports.resetImportsExcept(r.name);
  if (r.name === 'import' && r.id === 'shared') imports.consumeShared();
  render();
  window.scrollTo(0, 0);
});

// ───────────── Ereignisse ─────────────

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const { action, id, day } = el.dataset;
  const fn = CLICKS[action];
  if (fn) await fn({ el, action, id, day, T: today() });
});

root.addEventListener('change', async (e) => {
  const el = e.target;
  const action = el.dataset && el.dataset.action;
  const fn = action && CHANGES[action];
  if (fn) await fn({ el, action });
});

root.addEventListener('submit', async (e) => {
  const form = e.target;
  const kind = form.dataset.form;
  if (!kind) return;
  e.preventDefault();
  if (kind === 'login') {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await db.signIn(String(fd.get('email')).trim(), String(fd.get('password')));
      S.loginError = '';
    } catch (err) {
      console.error(err);
      S.loginError = 'Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.';
      render();
    }
    return;
  }
  const fn = SUBMITS[kind];
  if (fn) await fn(form);
});

// Enter im Wert-Feld speichert
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'sheet-val') {
    e.preventDefault();
    document.querySelector('[data-action="sheet-save"]').click();
  }
  if (e.key === 'Escape' && (S.sheet || S.pauseSheet || S.travelSheet || S.cityInfo || S.drinkSheet || S.plantInfo || S.scan)) { S.sheet = null; S.pauseSheet = null; S.travelSheet = false; S.cityInfo = null; S.drinkSheet = null; S.plantInfo = null; food.closeScanner(); render(); }
});

// Timer auf Übersicht und „Weniger rauchen“ aktuell halten – nur, wenn gerade nichts offen ist
setInterval(() => {
  if (!S.loaded || document.visibilityState !== 'visible') return;
  const name = route().name;
  if (name !== 'overview' && name !== 'weniger') return;
  if (S.sheet || S.pauseSheet || S.travelSheet || S.cityInfo || S.drinkSheet || S.plantInfo) return;
  const a = document.activeElement;
  if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  render();
}, 30000);

// ───────────── Start ─────────────

async function afterLogin() {
  S.loaded = false;
  render();
  await withings.handleWithingsReturn();
  try {
    await reload();
  } catch (err) {
    console.error(err);
    root.innerHTML = V.loading('Daten konnten nicht geladen werden. Bitte später erneut versuchen.');
    return;
  }
  const last = lastActivityDay(S.logs);
  const T = today();
  if (last && diffDays(last, T) > 3 && !session.get('welcomed') && route().name === 'overview') {
    location.hash = '#/welcome';
  }
  render();
  if (route().name === 'import' && route().id === 'shared') imports.consumeShared();
  withings.syncWithings(); // im Hintergrund
}

// Zurück in die App (z. B. nach dem Training): Withings erneut abgleichen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.loaded) withings.syncWithings();
});

async function start() {
  root.innerHTML = V.loading();
  try {
    await db.initDb();
  } catch (err) {
    console.error(err);
    root.innerHTML = V.loading('Keine Verbindung. Bitte Internet prüfen und neu laden.');
    return;
  }
  S.session = await db.getSession();
  db.onAuthChange((sess) => {
    const was = !!S.session;
    S.session = sess;
    if (sess && !was) afterLogin();
    if (!sess) { S.loaded = false; render(); }
  });
  if (S.session) await afterLogin();
  else render();
}

start();

if ('serviceWorker' in navigator && !db.isDemo) {
  // Neue Version übernommen → einmal neu laden, damit sofort der neue Code läuft
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => reg.update())
    .catch(() => {});
}
