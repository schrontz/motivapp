// Aktionen: Essen – Favorit mit einem Tipp, Eintragen (Suche im BLS, Gramm, Portion, Pflanzen), Mahlzeit ändern/löschen,
// Wikipedia-Häppchen zu Pflanzen.

import * as db from '../db.js';
import { S, local, render, persist, toast, go } from '../core.js';
import { nutrOf, per100, guessPlants, defaultGrams, plantWikiTitle, offToFood, skilletDecode, guessSlot, mealAt } from '../food.js';
import { pickSummary } from '../distance.js';
import { toDay, today } from '../dates.js';

const newDraft = () => ({ name: '', items: [], portion: 1, plants: [], home: false, fav: false, editId: null, day: today(), slot: guessSlot() });

function resetSearch() {
  S.foodQuery = '';
  S.foodResults = null;
  S.foodSearching = false;
  S.offResults = null;
  S.offSearching = false;
}

// Vorschlag der Pflanzen aus den Zutaten – nur ergänzen, nie etwas wieder abwählen, das man selbst gesetzt hat
function suggestPlants(d, extra = '') {
  // Zutatenlisten (Open Food Facts) nur bis zur ersten Klammer-Ebene – „Gewürze (Pfeffer, …)“ zählt trotzdem
  const parts = d.items.map((i) => i.name).concat(d.name, String(extra || '').split(/[,;]/).slice(0, 25));
  for (const p of guessPlants(parts)) if (!d.plants.includes(p) && !(d.removed || []).includes(p)) d.plants.push(p);
}

// ───────────── Favorit: ein Tipp ─────────────
let undoTimer = null;
async function logFavorite(id) {
  const f = (S.mealFavorites || []).find((x) => x.id === id);
  if (!f) return;
  const now = new Date();
  const meal = { at: now.toISOString(), day: toDay(now), name: f.name, portion: 1, items: f.items || [], plants: f.plants || [], home: !!f.home, fav_id: f.id };
  if (S.hasMealSlot) meal.slot = guessSlot(now);
  meal.nutr = nutrOf(meal.items, null, 1);
  S.meals = (S.meals || []).concat(meal);
  S.foodUndo = meal;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { if (S.foodUndo === meal) { S.foodUndo = null; render(); } }, 10000);
  toast(`${f.name} · ${meal.plants.length} ${meal.plants.length === 1 ? 'Pflanze' : 'Pflanzen'}`);
  go('#/'); // zurück zur Übersicht – dort steht „Rückgängig“
  const saved = await persist(() => db.saveMeal(meal));
  if (!saved) return;
  meal.id = saved.id;
  if (meal.cancelled) await persist(() => db.deleteMeal(meal.id));
  else render();
}

async function undo() {
  const m = S.foodUndo;
  if (!m) return;
  S.foodUndo = null;
  m.cancelled = true;
  S.meals = S.meals.filter((x) => x !== m);
  render();
  if (m.id) await persist(() => db.deleteMeal(m.id));
}

// ───────────── Eintragen ─────────────
let lastSearch = 0;
async function search(form) {
  return runSearch(String(new FormData(form).get('q') || '').trim());
}

// Suche in der gewählten Quelle: BLS (Lebensmittel und Gerichte) oder Open Food Facts (Markenprodukte)
async function runSearch(q) {
  if (!q) { resetSearch(); render(); return; }
  if (S.foodSource === 'off') return offSearch(q);
  S.foodQuery = q;
  S.foodSearching = true;
  render();
  const wait = 300 - (Date.now() - lastSearch);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearch = Date.now();
  try {
    const rows = await db.searchFoods(q);
    if (S.foodQuery !== q) return;
    S.foodResults = rows;
  } catch (err) {
    console.error(err);
    S.foodResults = [];
    toast('Die Suche hat gerade nicht geklappt – Internet da?');
  }
  S.foodSearching = false;
  render();
}

function addFood(f) {
  const d = S.foodDraft;
  if (!d || !f) return;
  d.items.push({ code: f.code, name: f.name, grams: defaultGrams(f.code, f.serving), n: per100(f) });
  if (!d.name) d.name = f.name.split(/[,(]/)[0].trim();
  suggestPlants(d, f.ingredients);
  resetSearch();
  render();
}

const addItem = (idx) => addFood(S.foodResults && S.foodResults[Number(idx)]);
const addOff = (idx) => addFood(S.offResults && S.offResults[Number(idx)]);

// Open Food Facts: Suche mit dem gleichen Begriff
async function offSearch(q) {
  if (!q || S.offSearching) return;
  S.foodQuery = q;
  S.offSearching = true;
  render();
  try {
    const res = await db.offRequest({ action: 'search', q });
    if (S.foodQuery !== q) return;
    S.offResults = (res.products || []).map(offToFood).filter(Boolean);
  } catch (err) {
    console.error(err);
    toast(err.message || 'Open Food Facts hat gerade nicht geantwortet.');
  }
  S.offSearching = false;
  render();
}

// ───────────── Strichcode ─────────────
let stream = null;
let detector = null;
let scanTimer = null;

function stopCamera() {
  clearTimeout(scanTimer);
  scanTimer = null;
  if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
}

async function openScanner() {
  const can = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!can) { S.scan = { mode: 'manual' }; render(); return; }
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((f) => formats.includes(f)) });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    S.scan = { mode: 'camera' };
  } catch (err) {
    console.warn(err);
    stopCamera();
    S.scan = { mode: 'manual', note: 'Ohne Kamera-Erlaubnis geht es auch so: Tipp die Nummer unter dem Strichcode ein.' };
  }
  render();
}

// Nach jedem Zeichnen: Kamera ans (neu gezeichnete) Video hängen und weiter suchen
export function mountScanner() {
  const video = document.getElementById('scan-video');
  if (!video || !stream) return;
  if (video.srcObject !== stream) video.srcObject = stream;
  clearTimeout(scanTimer);
  const tick = async () => {
    if (!stream || !S.scan || S.scan.mode !== 'camera') return;
    try {
      const v = document.getElementById('scan-video');
      if (v && v.readyState >= 2) {
        const codes = await detector.detect(v);
        if (codes.length) { lookup(codes[0].rawValue); return; }
      }
    } catch { /* nächster Versuch */ }
    scanTimer = setTimeout(tick, 250);
  };
  scanTimer = setTimeout(tick, 250);
}

async function lookup(code) {
  stopCamera();
  if (navigator.vibrate) try { navigator.vibrate(60); } catch { /* egal */ }
  S.scan = { ...(S.scan || {}), mode: 'manual', busy: true, error: null };
  render();
  try {
    const res = await db.offRequest({ action: 'product', code });
    const f = res.product && offToFood(res.product);
    if (!f) { S.scan = { mode: 'manual', error: `Die Nummer ${code} kennt Open Food Facts noch nicht – such nach dem Namen.` }; render(); return; }
    S.scan = null;
    addFood(f);
    toast(`${f.name}${f.brand ? ` (${f.brand})` : ''} – gefunden`);
  } catch (err) {
    console.error(err);
    S.scan = { mode: 'manual', error: err.message || 'Open Food Facts hat gerade nicht geantwortet.' };
    render();
  }
}

export function closeScanner() {
  stopCamera();
  S.scan = null;
}

function grams(idx, dir) {
  const it = S.foodDraft && S.foodDraft.items[Number(idx)];
  if (!it) return;
  const step = it.grams >= 200 ? 50 : (it.grams >= 50 ? 25 : 5);
  it.grams = Math.max(5, Math.min(2000, it.grams + step * Number(dir)));
  render();
}

function togglePlant(name) {
  const d = S.foodDraft;
  if (!d) return;
  d.removed = d.removed || [];
  if (d.plants.includes(name)) { d.plants = d.plants.filter((p) => p !== name); d.removed.push(name); }
  else { d.plants.push(name); d.removed = d.removed.filter((p) => p !== name); }
  render();
}

async function saveDraft() {
  const d = S.foodDraft;
  if (!d) return;
  const name = (d.name || '').trim();
  if (!name) {
    d.showName = true;
    render();
    const el = document.getElementById('food-error');
    if (el) el.textContent = 'Bitte kurz sagen, was es war – z. B. „Flammkuchen“.';
    document.querySelector('[name="fname"]')?.focus();
    return;
  }
  const items = d.items.map(({ code, name: n, grams: g, n: v }) => ({ code, name: n, grams: g, n: v }));
  const nutr = nutrOf(items, null, d.portion);
  if (d.editId) {
    const m = S.meals.find((x) => x.id === d.editId);
    if (!m) return;
    Object.assign(m, { name, items, plants: d.plants.slice(), portion: d.portion, home: d.home, nutr });
    if (d.day !== m.day) Object.assign(m, { day: d.day, at: mealAt(d.day, d.slot, today()) });
    if (S.hasMealSlot) m.slot = d.slot;
    S.foodDraft = null;
    go(`#/essen/${encodeURIComponent(m.id)}`);
    await persist(() => db.saveMeal(m));
    return;
  }
  const T = today();
  const day = d.day && d.day <= T ? d.day : T;
  const meal = { at: mealAt(day, d.slot, T), day, name, portion: d.portion, items, plants: d.plants.slice(), home: d.home, nutr, fav_id: null };
  if (S.hasMealSlot) meal.slot = d.slot;
  let fav = null;
  if (d.fav) {
    fav = { name, items, plants: d.plants.slice(), home: d.home, sort_order: (S.mealFavorites || []).length };
    S.mealFavorites = (S.mealFavorites || []).concat(fav);
  }
  S.meals = (S.meals || []).concat(meal);
  S.foodDraft = null;
  resetSearch();
  toast(`Eingetragen: ${name} · ${meal.plants.length} ${meal.plants.length === 1 ? 'Pflanze' : 'Pflanzen'}`);
  go('#/');
  if (fav) {
    const sf = await persist(() => db.saveFavorite(fav));
    if (sf) { Object.assign(fav, sf); meal.fav_id = fav.id; }
  }
  const saved = await persist(() => db.saveMeal(meal));
  if (saved) { meal.id = saved.id; render(); }
}

// ───────────── Eine Mahlzeit ─────────────

async function setPortion(id, value) {
  const m = (S.meals || []).find((x) => x.id === id);
  if (!m) return;
  m.portion = Number(value) || 1;
  m.nutr = nutrOf(m.items, null, m.portion);
  render();
  await persist(() => db.saveMeal(m));
}

async function deleteMeal(id) {
  const m = (S.meals || []).find((x) => x.id === id);
  if (!m || !confirm(`„${m.name}“ löschen?`)) return;
  S.meals = S.meals.filter((x) => x !== m);
  go('#/essen');
  await persist(() => db.deleteMeal(m.id));
}

async function toFavorite(id) {
  const m = (S.meals || []).find((x) => x.id === id);
  if (!m) return;
  const fav = { name: m.name, items: m.items || [], plants: m.plants || [], home: !!m.home, sort_order: (S.mealFavorites || []).length };
  S.mealFavorites = (S.mealFavorites || []).concat(fav);
  toast(`„${m.name}“ ist jetzt ein Favorit – beim Eintragen reicht ein Tipp.`);
  render();
  const saved = await persist(() => db.saveFavorite(fav));
  if (saved) { Object.assign(fav, saved); m.fav_id = fav.id; await persist(() => db.saveMeal(m)); }
}

async function deleteFavorite(id) {
  const f = (S.mealFavorites || []).find((x) => x.id === id);
  if (!f || !confirm(`Favorit „${f.name}“ löschen? Eingetragene Mahlzeiten bleiben.`)) return;
  S.mealFavorites = S.mealFavorites.filter((x) => x !== f);
  render();
  await persist(() => db.deleteFavorite(f.id));
}

// ───────────── Wikipedia zu Pflanzen ─────────────
const WIKI_DAYS = 30;
async function loadPlantWiki(name) {
  const k = 'p:' + name;
  if (!name || S.wiki[k]) return;
  try {
    const hit = JSON.parse(local.get('wiki.' + k) || 'null');
    if (hit && Date.now() - hit.at < WIKI_DAYS * 86400000) { S.wiki[k] = hit.data ? { state: 'ok', data: hit.data } : { state: 'none' }; render(); return; }
  } catch { /* egal */ }
  S.wiki[k] = { state: 'loading' };
  let data = null;
  try {
    data = pickSummary(await db.wikiSummary(plantWikiTitle(name)), null);
    S.wiki[k] = data ? { state: 'ok', data } : { state: 'none' };
    local.set('wiki.' + k, JSON.stringify({ at: Date.now(), data }));
  } catch (err) {
    console.warn(err);
    S.wiki[k] = { state: 'error' };
  }
  if (S.plantInfo === name) render();
}

// Seite „Gegessen“ geöffnet: Entwurf anlegen, falls keiner da ist. Seite verlassen: Entwurf und Suche weg.
export function ensureDraft(payload) {
  if (payload && payload.startsWith('s1.')) { importSkillet(payload); return; }
  if (!S.foodDraft) S.foodDraft = newDraft();
}

// Übergabe aus Skillet: Rezept mit Zutaten (BLS-Code + Gramm) → Formular ausgefüllt, eine Portion, selbst gekocht
function importSkillet(payload) {
  // Adresse gleich kürzen – Neuladen soll nicht nochmal übernehmen, Zurück nicht im Kreis führen
  try { history.replaceState(null, '', location.pathname + location.search + '#/essen-neu'); } catch { /* egal */ }
  const data = skilletDecode(payload);
  if (!data) {
    S.foodDraft = newDraft();
    toast('Der Link aus Skillet ließ sich nicht lesen.');
    return;
  }
  S.foodDraft = { ...newDraft(), name: data.name, home: true, skillet: { portions: data.portions, loading: true, missing: [] } };
  loadSkilletFoods(S.foodDraft, data);
}

async function loadSkilletFoods(d, data) {
  let rows = [];
  try {
    rows = await db.foodsByCodes([...new Set(data.items.map((i) => i.code))]);
  } catch (err) {
    console.error(err);
    toast('Die Lebensmittel-Daten ließen sich gerade nicht laden – Internet da?');
  }
  if (S.foodDraft !== d) return; // inzwischen woanders
  const byCode = new Map(rows.map((r) => [r.code, r]));
  for (const it of data.items) {
    const f = byCode.get(it.code);
    if (!f) { d.skillet.missing.push(it.name || it.code); continue; }
    d.items.push({ code: it.code, name: it.name || f.name, grams: it.grams, n: per100(f) });
  }
  d.skillet.loading = false;
  suggestPlants(d);
  render();
}
export function leaveDraft() {
  S.foodDraft = null;
  resetSearch();
  closeScanner();
}

export const clicks = {
  'food-fav': ({ id }) => logFavorite(id),
  'food-undo': undo,
  'food-add': ({ el }) => addItem(el.dataset.idx),
  'food-add-off': ({ el }) => addOff(el.dataset.idx),

  'food-scan': openScanner,
  'scan-close': () => { closeScanner(); render(); },
  'food-grams': ({ el, id }) => grams(el.dataset.idx, id),
  'food-item-del': ({ el }) => { const d = S.foodDraft; if (!d) return; d.items.splice(Number(el.dataset.idx), 1); render(); },
  'food-group': ({ id }) => { S.foodGroup = id; render(); },
  'food-plant': ({ id }) => togglePlant(id),
  'food-save': saveDraft,
  'meal-edit': ({ id }) => {
    const m = (S.meals || []).find((x) => x.id === id);
    if (!m) return;
    S.foodDraft = { name: m.name, items: (m.items || []).map((i) => ({ ...i })), portion: Number(m.portion) || 1, plants: (m.plants || []).slice(), home: !!m.home, fav: false, editId: m.id, removed: [], day: m.day, slot: m.slot || guessSlot(new Date(m.at)) };
    go('#/essen-neu');
  },
  // Nochmal gegessen (z. B. Reste): Formular vorbefüllt für heute – Portion/Tag noch anpassbar, dann speichern
  'meal-again': ({ id }) => {
    const m = (S.meals || []).find((x) => x.id === id);
    if (!m) return;
    S.foodDraft = { ...newDraft(), name: m.name, items: (m.items || []).map((i) => ({ ...i })), portion: Number(m.portion) || 1, plants: (m.plants || []).slice(), home: !!m.home, again: m.day, removed: [] };
    resetSearch();
    go('#/essen-neu');
  },
  'meal-del': ({ id }) => deleteMeal(id),
  'meal-to-fav': ({ id }) => toFavorite(id),
  'food-fav-del': ({ id }) => deleteFavorite(id),
  'plant-info': ({ id }) => { S.plantInfo = id; render(); loadPlantWiki(id); },
  'plant-close': () => { S.plantInfo = null; render(); }
};

export const changes = {
  // Quelle umschalten: steht schon ein Suchbegriff da, gleich in der anderen Quelle suchen
  'food-source': ({ el }) => {
    S.foodSource = el.value === 'off' ? 'off' : 'bls';
    local.set('foodSource', S.foodSource);
    const q = S.foodQuery || String(document.querySelector('[data-form="food-search"] [name="q"]')?.value || '').trim();
    if (q) runSearch(q); else render();
  },
  // Name eingetippt, aber noch nichts gesucht? Dann gleich danach suchen – so findet man es auch über dieses Feld
  'food-name': ({ el }) => {
    const d = S.foodDraft;
    if (!d) return;
    d.name = el.value;
    if (!d.items.length && !S.foodResults && d.name.trim().length >= 3) runSearch(d.name.trim());
  },
  'food-portion': ({ el }) => { if (S.foodDraft) { S.foodDraft.portion = Number(el.value) || 1; render(); } },
  // Wann gegessen? Heute / gestern / anderer Tag, dazu die Mahlzeit
  'food-day': ({ el }) => {
    const d = S.foodDraft;
    if (!d) return;
    const T = today();
    if (el.value === 'today') d.day = T;
    else if (el.value === 'yesterday') { const y = new Date(); y.setDate(y.getDate() - 1); d.day = toDay(y); if (d.slot === 'fruehstueck' && new Date().getHours() < 11) d.slot = 'abend'; }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(el.value) && el.value <= T) d.day = el.value;
    render();
  },
  'food-slot': ({ el }) => { if (S.foodDraft) { S.foodDraft.slot = el.value; render(); } },
  'food-home': ({ el }) => { if (S.foodDraft) S.foodDraft.home = el.checked; },
  'food-fav-mark': ({ el }) => { if (S.foodDraft) S.foodDraft.fav = el.checked; },
  'meal-portion': ({ el }) => setPortion(el.dataset.id, el.value)
};

export const submits = {
  'food-search': (form) => search(form),
  'food-code': (form) => {
    const code = String(new FormData(form).get('code') || '').replace(/\D/g, '');
    if (code.length < 6) { S.scan = { ...(S.scan || { mode: 'manual' }), error: 'Bitte die ganze Nummer unter dem Strichcode eintippen (meist 13 Ziffern).' }; render(); return null; }
    return lookup(code);
  }
};

