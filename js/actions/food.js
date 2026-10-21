// Aktionen: Essen – Favorit mit einem Tipp, Eintragen (Suche im BLS, Gramm, Portion, Pflanzen), Mahlzeit ändern/löschen,
// Wikipedia-Häppchen zu Pflanzen.

import * as db from '../db.js';
import { S, local, render, persist, toast, go } from '../core.js';
import { nutrOf, per100, guessPlants, defaultGrams, plantWikiTitle } from '../food.js';
import { pickSummary } from '../distance.js';
import { toDay } from '../dates.js';

const newDraft = () => ({ name: '', items: [], portion: 1, plants: [], home: false, fav: false, editId: null });

function resetSearch() {
  S.foodQuery = '';
  S.foodResults = null;
  S.foodSearching = false;
}

// Vorschlag der Pflanzen aus den Zutaten – nur ergänzen, nie etwas wieder abwählen, das man selbst gesetzt hat
function suggestPlants(d) {
  for (const p of guessPlants(d.items.map((i) => i.name).concat(d.name))) if (!d.plants.includes(p) && !(d.removed || []).includes(p)) d.plants.push(p);
}

// ───────────── Favorit: ein Tipp ─────────────
let undoTimer = null;
async function logFavorite(id) {
  const f = (S.mealFavorites || []).find((x) => x.id === id);
  if (!f) return;
  const now = new Date();
  const meal = { at: now.toISOString(), day: toDay(now), name: f.name, portion: 1, items: f.items || [], plants: f.plants || [], home: !!f.home, fav_id: f.id };
  meal.nutr = nutrOf(meal.items, null, 1);
  S.meals = (S.meals || []).concat(meal);
  S.foodUndo = meal;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { if (S.foodUndo === meal) { S.foodUndo = null; render(); } }, 10000);
  render();
  toast(`${f.name} · ${meal.plants.length} ${meal.plants.length === 1 ? 'Pflanze' : 'Pflanzen'}`);
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
  const q = String(new FormData(form).get('q') || '').trim();
  if (!q) { resetSearch(); render(); return; }
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

function addItem(idx) {
  const d = S.foodDraft;
  const f = S.foodResults && S.foodResults[Number(idx)];
  if (!d || !f) return;
  d.items.push({ code: f.code, name: f.name, grams: defaultGrams(f.code), n: per100(f) });
  if (!d.name) d.name = f.name.split(/[,(]/)[0].trim();
  suggestPlants(d);
  resetSearch();
  render();
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
    S.foodDraft = null;
    go(`#/essen/${encodeURIComponent(m.id)}`);
    await persist(() => db.saveMeal(m));
    return;
  }
  const now = new Date();
  const meal = { at: now.toISOString(), day: toDay(now), name, portion: d.portion, items, plants: d.plants.slice(), home: d.home, nutr, fav_id: null };
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
  toast(`„${m.name}“ ist jetzt ein Favorit – auf der Übersicht reicht ein Tipp.`);
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
export function ensureDraft() {
  if (!S.foodDraft) S.foodDraft = newDraft();
}
export function leaveDraft() {
  S.foodDraft = null;
  resetSearch();
}

export const clicks = {
  'food-fav': ({ id }) => logFavorite(id),
  'food-undo': undo,
  'food-add': ({ el }) => addItem(el.dataset.idx),
  'food-grams': ({ el, id }) => grams(el.dataset.idx, id),
  'food-item-del': ({ el }) => { const d = S.foodDraft; if (!d) return; d.items.splice(Number(el.dataset.idx), 1); render(); },
  'food-group': ({ id }) => { S.foodGroup = id; render(); },
  'food-plant': ({ id }) => togglePlant(id),
  'food-save': saveDraft,
  'meal-edit': ({ id }) => {
    const m = (S.meals || []).find((x) => x.id === id);
    if (!m) return;
    S.foodDraft = { name: m.name, items: (m.items || []).map((i) => ({ ...i })), portion: Number(m.portion) || 1, plants: (m.plants || []).slice(), home: !!m.home, fav: false, editId: m.id, removed: [] };
    go('#/essen-neu');
  },
  'meal-del': ({ id }) => deleteMeal(id),
  'meal-to-fav': ({ id }) => toFavorite(id),
  'food-fav-del': ({ id }) => deleteFavorite(id),
  'plant-info': ({ id }) => { S.plantInfo = id; render(); loadPlantWiki(id); },
  'plant-close': () => { S.plantInfo = null; render(); }
};

export const changes = {
  'food-name': ({ el }) => { if (S.foodDraft) S.foodDraft.name = el.value; },
  'food-portion': ({ el }) => { if (S.foodDraft) { S.foodDraft.portion = Number(el.value) || 1; render(); } },
  'food-home': ({ el }) => { if (S.foodDraft) S.foodDraft.home = el.checked; },
  'food-fav-mark': ({ el }) => { if (S.foodDraft) S.foodDraft.fav = el.checked; },
  'meal-portion': ({ el }) => setPortion(el.dataset.id, el.value)
};

export const submits = {
  'food-search': (form) => search(form)
};

