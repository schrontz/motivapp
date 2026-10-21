// Aktionen: „Alkoholfrei“ – starten, „Getrunken“ (Anzahl + Situation, rückgängig), Einstellungen.

import * as db from '../db.js';
import { S, render, persist, toast, go } from '../core.js';
import { KIND, DEFAULTS, newDrink } from '../alcohol.js';
import { today as todayDay } from '../dates.js';

const settingsOf = () => (S.reduceSettings || []).find((r) => r.kind === KIND) || null;

async function saveSettings(s) {
  const saved = await persist(() => db.saveReduceSettings(s));
  if (saved) Object.assign(s, saved);
  return saved;
}

async function start({ T }) {
  if (settingsOf()) return;
  const s = { kind: KIND, started_on: T, costs: { ...DEFAULTS }, night_from: '23:00', night_to: '07:00', step_min: 0, adjust_min: 0, show_card: true };
  S.reduceSettings = (S.reduceSettings || []).concat(s);
  render();
  await saveSettings(s);
  render();
}

// „Getrunken“: Fenster mit Anzahl und Situation
let undoTimer = null;
async function save() {
  const d = S.drinkSheet;
  if (!d) return;
  if (!S.hasAlcoholSchema) { toast('Bitte zuerst das Datenbank-Update 013_alkohol.sql ausführen.'); return; }
  const ev = newDrink(d.qty, d.tags.slice());
  S.drinkSheet = null;
  S.reduceEvents = (S.reduceEvents || []).concat(ev);
  S.drinkUndo = ev;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { if (S.drinkUndo === ev) { S.drinkUndo = null; render(); } }, 10000);
  render();
  const saved = await persist(() => db.addReduceEvent({ kind: ev.kind, at: ev.at, day: ev.day, qty: ev.qty, tags: ev.tags }));
  if (!saved) return;
  ev.id = saved.id;
  if (ev.cancelled) await persist(() => db.deleteReduceEvent(ev.id)); // in der Zwischenzeit zurückgenommen
}

async function undo() {
  const ev = S.drinkUndo;
  if (!ev) return;
  S.drinkUndo = null;
  ev.cancelled = true;
  S.reduceEvents = S.reduceEvents.filter((e) => e !== ev);
  render();
  if (ev.id) await persist(() => db.deleteReduceEvent(ev.id));
}

const dec = (v) => Number(String(v || '').replace(',', '.').trim());

async function saveForm(form) {
  const s = settingsOf();
  if (!s) return;
  const fd = new FormData(form);
  const err = (msg, name) => {
    const el = form.querySelector('#alc-error');
    if (el) el.textContent = msg;
    form.querySelector(`[name="${name}"]`)?.focus();
  };
  const price = dec(fd.get('price'));
  const perWeek = dec(fd.get('per_week'));
  if (!(price > 0)) return err('Bitte einen Preis größer als 0 eintragen.', 'price');
  if (!(perWeek > 0)) return err('Bitte eine Zahl größer als 0 eintragen – deine ehrliche Schätzung.', 'per_week');
  const started = String(fd.get('started_on') || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(started) || started > todayDay()) return err('Bitte ein Datum bis heute wählen.', 'started_on');
  Object.assign(s, {
    started_on: started,
    costs: { price, per_week: perWeek, goal_start: Math.min(7, Math.max(1, Number(fd.get('goal_start')) || 5)), goal_every: Math.max(0, Math.min(4, Number(fd.get('goal_every')) || 0)) },
    show_card: fd.get('show_card') === 'on'
  });
  const ok = await saveSettings(s);
  if (ok) { toast('Gespeichert.'); go('#/alkohol'); }
}

export const clicks = {
  'alc-start': start,
  'alc-open': () => { S.drinkSheet = { qty: 1, tags: [] }; render(); },
  'alc-close': () => { S.drinkSheet = null; render(); },
  'alc-qty': ({ id }) => { if (!S.drinkSheet) return; S.drinkSheet.qty = Math.max(1, Math.min(20, S.drinkSheet.qty + Number(id))); render(); },
  'alc-tag': ({ id }) => {
    const d = S.drinkSheet;
    if (!d) return;
    d.tags = d.tags.includes(id) ? d.tags.filter((t) => t !== id) : d.tags.concat(id);
    render();
  },
  'alc-save': save,
  'alc-undo': undo
};

export const submits = {
  'alc-settings': saveForm
};
