// Aktionen: „Wie weit bin ich gekommen?“ – Zeitraum, Startort, Reiseziel.

import * as db from '../db.js';
import { S, local, render, persist, toast, route } from '../core.js';
import { walkedFor, travelFrom, startOf, activeGoal, goalStatus, CITIES, city, km, searchLocal, osmToPlace, stagesFor, stageStatus, withPlaces, placeOf, wikiTitle, pickSummary, titleMatches } from '../distance.js';

const total = () => walkedFor(S).km;

// Ziel erreicht? Dann Ankunftstag speichern – die Feier zeigt die Seite. Jeden Versuch nur einmal (kein Fehler-Kreislauf).
const tried = new Set();
export function checkArrival(T) {
  if (!S.loaded || !S.hasTravelSchema) return;
  // Rückwirkend „angekommen“, aber noch nicht angesehen und nach dem Zähl-Start doch nicht erreicht? Wieder öffnen.
  const open = activeGoal(S.travel);
  for (const g of (S.activity || []).length && !open ? S.travel || [] : []) {
    if (g.id && g.reached_on && !g.seen && !goalStatus(g, total()).reached) {
      g.reached_on = null;
      persist(() => db.saveTravelGoal(g));
      break; // höchstens ein offenes Ziel
    }
  }
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
  // Neue Etappe? Einmal feiern (bleibt sichtbar, bis man sie wegklickt oder das Ziel wechselt)
  const goal = S.hasStagesSchema && activeGoal(S.travel);
  if (!goal || !goal.id) return;
  const ss = stageStatus(stagesFor(goal, S.places), total());
  if (ss.reached > (goal.stages_seen || 0) && ss.prev) {
    goal.stages_seen = ss.reached;
    S.stageCelebrate = { goalId: goal.id, name: ss.prev.name };
    persist(() => db.saveTravelGoal(goal));
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
  // Etappen, die beim Wählen schon hinter dir liegen, werden nicht nachträglich gefeiert
  if (S.hasStagesSchema) goal.stages_seen = stageStatus(stagesFor(goal, S.places), total()).reached;
  S.stageCelebrate = null;
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

// ───────────── Stadt-Wissen ─────────────

// Koordinaten zu einem Namen (feste Ziele, eigene Orte, Reiseziele) – damit der richtige Artikel gewählt wird
function placeByName(name) {
  const known = withPlaces(S.places).find((c) => c.name === name);
  if (known) return known;
  const goal = (S.travel || []).find((g) => g.city === name);
  return goal ? placeOf(goal) : null;
}

// Wikipedia-Auszug laden: erst aus dem Gerätespeicher, dann Kurzfassung, sonst Suche. Ergebnis in S.wiki[name].
const WIKI_DAYS = 30;
export async function loadWiki(name) {
  if (!name || S.wiki[name]) return;
  const key = 'wiki.' + name;
  try {
    const hit = JSON.parse(local.get(key) || 'null');
    if (hit && Date.now() - hit.at < WIKI_DAYS * 86400000) { S.wiki[name] = hit.data ? { state: 'ok', data: hit.data } : { state: 'none' }; return; }
  } catch { /* egal */ }
  S.wiki[name] = { state: 'loading' };
  const place = placeByName(name);
  let data = null;
  try {
    data = pickSummary(await db.wikiSummary(wikiTitle(name)), place);
    if (!data) {
      // Rückfall: Suche, z. B. bei eigenen Orten oder Begriffsklärungen
      const label = (S.places || []).find((p) => p.name === name)?.label || '';
      const titles = (await db.wikiSearch(`${name} ${label.split(',')[0] || ''}`.trim())).filter((t) => titleMatches(t, name));
      for (const title of titles) {
        data = pickSummary(await db.wikiSummary(title), place);
        if (data) break;
      }
    }
    S.wiki[name] = data ? { state: 'ok', data } : { state: 'none' };
    local.set(key, JSON.stringify({ at: Date.now(), data }));
  } catch (err) {
    console.warn(err);
    S.wiki[name] = { state: 'error' };
  }
  if (route().name === 'distance') render();
}

// Nach dem Zeichnen der Strecken-Seite: Infos für die gerade gefeierte Stadt vorladen
export function prefetchWiki() {
  const done = S.celebrateId && (S.travel || []).find((g) => g.id === S.celebrateId);
  if (done) loadWiki(done.city);
  if (S.stageCelebrate) loadWiki(S.stageCelebrate.name);
  if (S.cityInfo) loadWiki(S.cityInfo);
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
  'travel-stage-ok': () => { S.stageCelebrate = null; render(); },
  'dist-all': () => { S.distAll = !S.distAll; render(); },
  'city-info': ({ id }) => { S.cityInfo = id; if (S.wiki[id] && S.wiki[id].state === 'error') delete S.wiki[id]; render(); },
  'city-close': () => { S.cityInfo = null; render(); },
  'travel-clear': () => { S.travelSheet = false; return clearGoal(); }
};

export const changes = {
  'dist-range': ({ el }) => {
    S.distRange = el.value;
    local.set('distRange', el.value);
    render();
  },
  'dist-from': async ({ el }) => {
    const value = el.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !S.profile) return;
    S.profile.travel_from = value;
    render();
    await persist(() => db.updateProfile(S.profile.id, { travel_from: value }));
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
