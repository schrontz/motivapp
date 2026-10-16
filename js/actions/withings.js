// Aktionen: Withings verbinden, abgleichen, automatisch abhaken.

import * as db from '../db.js';
import { S, local, render, toast, reindex, persist } from '../core.js';
import { today } from '../dates.js';
import { autoLogChanges } from '../auto.js';
import { WITHINGS_CLIENT_ID, WITHINGS_REDIRECT } from '../config.js';

export async function applyAuto() {
  if (!S.hasWithingsSchema) return;
  const changes = autoLogChanges({
    habits: S.habits, logs: S.logs, workouts: S.workouts, activity: S.activity, dismissals: S.dismissals, today: today()
  });
  if (!changes.length) return;
  for (const c of changes) {
    S.logs = S.logs.filter((l) => !(l.habit_id === c.habit_id && l.day === c.day));
    S.logs.push(c);
  }
  reindex();
  render();
  const newToday = changes.filter((c) => c.day === today() && c.value == null)
    .map((c) => (S.habits.find((h) => h.id === c.habit_id) || {}).name).filter(Boolean);
  if (newToday.length) toast(`${newToday.join(', ')} automatisch abgehakt – dank Withings.`);
  for (const c of changes) await persist(() => db.setLog(c.habit_id, c.day, c.status, c.value, 'withings'));
}

export async function syncWithings({ manual = false } = {}) {
  if (!S.withings.connected || S.syncing) return;
  const last = S.withings.last_sync_at ? new Date(S.withings.last_sync_at).getTime() : 0;
  if (!manual && Date.now() - last < 10 * 60000) { await applyAuto(); return; }
  S.syncing = true;
  render();
  try {
    const res = await db.withings('sync');
    if (res && res.needsReconnect) {
      toast('Withings bitte neu verbinden (Profil) – der Zugang ist abgelaufen.');
    } else if (res && res.last_sync_at) {
      S.withings.last_sync_at = res.last_sync_at;
      const fresh = await db.loadWithingsData();
      // Ablehnungen zusammenführen – eine gerade erst gemerkte darf nicht durchs Neuladen verloren gehen
      const keys = new Set(fresh.dismissals.map((d) => `${d.habit_id}|${d.day}`));
      fresh.dismissals = [...fresh.dismissals, ...S.dismissals.filter((d) => !keys.has(`${d.habit_id}|${d.day}`))];
      fresh.withings = { ...fresh.withings, last_sync_at: res.last_sync_at };
      Object.assign(S, fresh);
      if (manual) toast('Withings abgeglichen');
    }
  } catch (err) {
    console.error(err);
    if (manual) toast(`Abgleich hat nicht geklappt: ${err.message}`);
  } finally {
    S.syncing = false;
  }
  await applyAuto();
  render();
}

function startWithingsLogin() {
  if (!WITHINGS_CLIENT_ID) { toast('Die Withings Client ID fehlt noch in js/config.js.'); return; }
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  // Geräteweit merken (nicht nur im Tab): Nach dem Withings-Login landet man auf Android oft in einem neuen Tab
  local.set('withings.state', JSON.stringify({ state, at: Date.now() }));
  const url = 'https://account.withings.com/oauth2_user/authorize2?' + new URLSearchParams({
    response_type: 'code', client_id: WITHINGS_CLIENT_ID, scope: 'user.activity,user.metrics',
    redirect_uri: WITHINGS_REDIRECT, state
  }).toString();
  location.href = url;
}

// Rückkehr vom Withings-Login: ?code=…&state=… – der Code ist nur 30 Sekunden gültig, also sofort tauschen.
export async function handleWithingsReturn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return;
  history.replaceState(null, '', location.pathname + location.hash);
  let saved = null;
  try { saved = JSON.parse(local.get('withings.state') || 'null'); } catch { saved = null; }
  local.set('withings.state', '');
  const fresh = saved && Date.now() - saved.at < 15 * 60000;
  if (!state || !fresh || state !== saved.state) {
    toast('Withings-Anmeldung konnte nicht bestätigt werden – bitte im Profil noch einmal „Mit Withings verbinden“ tippen.');
    return;
  }
  try {
    await db.withings('connect', { code, redirect_uri: WITHINGS_REDIRECT });
    toast('Withings verbunden – hole deine Daten …');
    S.withings = { connected: true, last_sync_at: null };
  } catch (err) {
    console.error(err);
    toast(`Withings-Verbindung fehlgeschlagen: ${err.message}`);
  }
}

export const clicks = {
  'withings-connect': () => startWithingsLogin(),
  'withings-sync': () => syncWithings({ manual: true }),
  'withings-disconnect': async () => {
    if (!confirm('Withings trennen? Deine bisherigen Schritte und Trainings bleiben gespeichert.')) return;
    try {
      await db.withings('disconnect');
      S.withings = { connected: false };
      toast('Withings getrennt');
    } catch (err) { toast(`Trennen hat nicht geklappt: ${err.message}`); }
    render();
  }
};

export const changes = {
  'train-range': ({ el }) => {
    S.trainRange = Number(el.value);
    local.set('trainRange', el.value);
    render();
  }
};
