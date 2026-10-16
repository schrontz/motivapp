// Aktionen: „Wie weit bin ich gekommen?“ – Zeitraum, Startort, Reiseziel.

import * as db from '../db.js';
import { S, local, render, persist, toast } from '../core.js';
import { walked, startOf, activeGoal, goalStatus, CITIES, city, km, searchLocal, osmToPlace } from '../distance.js';

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

async function pick(name) {
  const cur = activeGoal(S.travel);
  const goal = cur || { id: null, reached_on: null, seen: false };
  goal.city = name;
  goal.start_city = startOf(S);
  // Eigene Orte: Koordinaten mit ins Ziel (Spalten gibt es erst mit Update 007)
  if (S.hasPlacesSchema) {
    const own = !CITIES.some((c) => c.name === name) && (S.places || []).find((p) => p.name === name);
    goal.lat = own ? Number(own.lat) : null;
    goal.lng = own ? Number(own.lng) : null;
  }
  resetSearch();
  if (!cur) S.travel.push(goal);
  S.travelSheet = false;
  S.celebrateId = null;
  render();
  const saved = await persist(() => db.saveTravelGoal(goal));
  if (saved) { Object.assign(goal, saved); render(); }
}

function resetSearch() {
  S.travelQuery = '';
  S.travelResults = null;
  S.travelSearching = false;
}

// Suche: eigene Liste sofort, OpenStreetMap höchstens einmal pro Sekunde
let lastSearch = 0;
async function search(form) {
  const q = String(new FormData(form).get('q') || '').trim();
  if (!q) { resetSearch(); render(); return; }
  S.travelQuery = q;
  S.travelResults = { local: searchLocal(q, S.places), osm: null, error: null };
  if (!S.hasPlacesSchema) { render(); return; }
  S.travelSearching = true;
  render();
  const wait = 1100 - (Date.now() - lastSearch);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearch = Date.now();
  const results = S.travelResults;
  try {
    const known = results.local.map((c) => c.name);
    const seen = new Set();
    results.osm = (await db.searchPlaces(q)).map(osmToPlace)
      .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .filter((p) => !known.includes(p.name))
      .filter((p) => { const k = p.name + '|' + p.label; if (seen.has(k)) return false; seen.add(k); return true; });
  } catch (err) {
    console.error(err);
    results.error = 'Die Suche hat gerade nicht geklappt – Internet da? Später nochmal probieren.';
  }
  if (S.travelResults !== results) return; // inzwischen neu gesucht oder geschlossen
  S.travelSearching = false;
  render();
}

// Treffer antippen: als eigenen Ort speichern – liegt er noch vor dir, wird er gleich zum Ziel
async function addPlace(idx) {
  const hit = S.travelResults && S.travelResults.osm && S.travelResults.osm[Number(idx)];
  if (!hit) return;
  const place = { name: hit.name, label: hit.label, lat: hit.lat, lng: hit.lng };
  S.places = (S.places || []).filter((p) => p.name !== place.name).concat(place);
  const inside = km(city(startOf(S)), place) <= total();
  const saved = persist(() => db.savePlace(place)).then((row) => { if (row) Object.assign(place, row); });
  if (inside) {
    resetSearch();
    toast(`${place.name} liegt schon in deinem Kreis – unter „Meine Orte“ gespeichert.`);
    render();
    await saved;
    return;
  }
  await saved;
  await pick(place.name);
}

async function deletePlace(name) {
  const place = (S.places || []).find((p) => p.name === name);
  if (!place) return;
  S.places = S.places.filter((p) => p !== place);
  render();
  await persist(() => db.deletePlace(place.id));
}

async function clearGoal() {
  const cur = activeGoal(S.travel);
  if (!cur) return;
  S.travel = S.travel.filter((g) => g !== cur);
  render();
  await persist(() => db.deleteTravelGoal(cur.id));
}

export const clicks = {
  'travel-open': () => { S.travelSheet = true; S.travelRegion = null; resetSearch(); render(); },
  'travel-search-clear': () => { resetSearch(); render(); },
  'travel-add': ({ el }) => addPlace(el.dataset.idx),
  'travel-place-delete': ({ id }) => deletePlace(id),
  'travel-region': ({ id }) => { S.travelRegion = id; render(); },
  'travel-close': () => { S.travelSheet = false; resetSearch(); render(); },
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

export const submits = {
  'travel-search': (form) => search(form)
};
