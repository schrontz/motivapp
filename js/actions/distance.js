// Aktionen: „Wie weit bin ich gekommen?“ – Zeitraum, Startort, Reiseziel.

import * as db from '../db.js';
import { S, local, render, persist, toast } from '../core.js';
import { walked, startOf, activeGoal, goalStatus } from '../distance.js';

const total = () => walked(S.activity || []).km;

// Ziel erreicht? Dann Ankunftstag speichern – die Feier zeigt die Seite. Jeden Versuch nur einmal (kein Fehler-Kreislauf).
const tried = new Set();
export function checkArrival(T) {
  if (!S.loaded || !S.hasTravelSchema) return;
  const goal = activeGoal(S.travel);
  if (!goal || !goal.id || tried.has(goal.id)) return;
  if (!goalStatus(goal, total()).reached) return;
  tried.add(goal.id);
  goal.reached_on = T;
  persist(() => db.saveTravelGoal(goal));
}

// Seite geöffnet: Ankunft als gesehen merken. Die Feier bleibt sichtbar, bis ein neues Ziel gewählt ist.
export function markSeen() {
  const fresh = (S.travel || []).filter((g) => g.reached_on && !g.seen && g.id);
  for (const g of fresh) {
    g.seen = true;
    S.celebrateId = g.id;
    persist(() => db.saveTravelGoal(g));
  }
}

async function pick(city) {
  const cur = activeGoal(S.travel);
  const goal = cur || { id: null, reached_on: null, seen: false };
  goal.city = city;
  goal.start_city = startOf(S);
  if (!cur) S.travel.push(goal);
  S.travelSheet = false;
  S.celebrateId = null;
  render();
  const saved = await persist(() => db.saveTravelGoal(goal));
  if (saved) { Object.assign(goal, saved); render(); }
}

async function clearGoal() {
  const cur = activeGoal(S.travel);
  if (!cur) return;
  S.travel = S.travel.filter((g) => g !== cur);
  render();
  await persist(() => db.deleteTravelGoal(cur.id));
}

export const clicks = {
  'travel-open': () => { S.travelSheet = true; S.travelRegion = null; render(); },
  'travel-region': ({ id }) => { S.travelRegion = id; render(); },
  'travel-close': () => { S.travelSheet = false; render(); },
  'travel-pick': ({ id }) => pick(id),
  'travel-none': () => { S.celebrateId = null; render(); },
  'travel-clear': () => { S.travelSheet = false; return clearGoal(); }
};

export const changes = {
  'dist-range': ({ el }) => {
    S.distRange = el.value;
    local.set('distRange', el.value);
    render();
  },
  'dist-start': async ({ el }) => {
    const value = el.value;
    S.distStart = value;
    local.set('distStart', value);
    const cur = activeGoal(S.travel);
    const reset = cur && cur.start_city !== value;
    if (S.profile && S.hasTravelSchema) S.profile.travel_start = value;
    render();
    if (reset) { toast('Neuer Startort – das Reiseziel ist zurückgesetzt.'); await clearGoal(); }
    if (S.profile && S.hasTravelSchema) await persist(() => db.updateProfile(S.profile.id, { travel_start: value }));
  }
};
