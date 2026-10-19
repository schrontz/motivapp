// Aktionen: „Weniger rauchen“ – starten, zählen (mit Rückgängig), Abstand anpassen, Einstellungen.

import * as db from '../db.js';
import { S, local, render, persist, toast, go } from '../core.js';
import { DEFAULT_COSTS, newEvent } from '../reduce.js';

const KIND = 'rauchen';
const settingsOf = () => (S.reduceSettings || []).find((r) => r.kind === KIND) || null;

async function saveSettings(s) {
  const saved = await persist(() => db.saveReduceSettings(s));
  if (saved) Object.assign(s, saved);
  return saved;
}

async function start({ T }) {
  if (settingsOf()) return;
  const s = { kind: KIND, started_on: T, costs: { ...DEFAULT_COSTS }, night_from: '23:00', night_to: '07:00', step_min: 5, adjust_min: 0, show_card: true };
  S.reduceSettings = (S.reduceSettings || []).concat(s);
  render();
  await saveSettings(s);
  render();
}

// „Geraucht“: sofort zählen, 10 Sekunden lang rückgängig machbar
let undoTimer = null;
async function smoke() {
  const ev = newEvent(KIND);
  S.reduceEvents = (S.reduceEvents || []).concat(ev);
  S.reduceUndo = ev;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { if (S.reduceUndo === ev) { S.reduceUndo = null; render(); } }, 10000);
  render();
  const saved = await persist(() => db.addReduceEvent({ kind: ev.kind, at: ev.at, day: ev.day }));
  if (!saved) return;
  ev.id = saved.id;
  if (ev.cancelled) await persist(() => db.deleteReduceEvent(ev.id)); // in der Zwischenzeit zurückgenommen
}

async function undo() {
  const ev = S.reduceUndo;
  if (!ev) return;
  S.reduceUndo = null;
  ev.cancelled = true;
  S.reduceEvents = S.reduceEvents.filter((e) => e !== ev);
  render();
  if (ev.id) await persist(() => db.deleteReduceEvent(ev.id));
}

async function adjust({ id }) {
  const s = settingsOf();
  if (!s) return;
  s.adjust_min = (s.adjust_min || 0) + Number(id);
  render();
  await saveSettings(s);
}

// Zahlen mit Komma oder Punkt
const dec = (v) => Number(String(v || '').replace(',', '.').trim());

async function saveForm(form) {
  const s = settingsOf();
  if (!s) return;
  const fd = new FormData(form);
  const costs = {};
  for (const k of Object.keys(DEFAULT_COSTS)) {
    const v = dec(fd.get(k));
    if (!(v > 0)) {
      const el = form.querySelector('#reduce-error');
      if (el) el.textContent = 'Bitte überall eine Zahl größer als 0 eintragen.';
      form.querySelector(`[name="${k}"]`)?.focus();
      return;
    }
    costs[k] = v;
  }
  const time = (v, d) => (/^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v).padStart(5, '0') : d);
  Object.assign(s, {
    costs,
    night_from: time(fd.get('night_from'), '23:00'),
    night_to: time(fd.get('night_to'), '07:00'),
    step_min: Math.max(0, Math.min(60, Math.round(dec(fd.get('step_min')) || 0))),
    show_card: fd.get('show_card') === 'on'
  });
  const ok = await saveSettings(s);
  if (ok) { toast('Gespeichert.'); go('#/weniger'); }
}

export const clicks = {
  'reduce-start': start,
  'reduce-smoke': smoke,
  'reduce-undo': undo,
  'reduce-adjust': adjust
};

export const changes = {
  'reduce-cost-basis': ({ el }) => {
    S.reduceCostBasis = el.value === 'start' ? 'start' : 'recent';
    local.set('reduceCostBasis', S.reduceCostBasis);
    render();
  }
};

export const submits = {
  'reduce-settings': saveForm
};
