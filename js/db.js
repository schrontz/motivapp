// Datenzugriff. Zwei Varianten mit derselben Schnittstelle:
// - Supabase (echt)
// - Demo (?demo in der Adresse): Beispieldaten im Speicher, nichts wird gespeichert.

import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS } from './config.js';
import { today, addDays, toDay, weekStart } from './dates.js';
import { searchTerms, rankFoods } from './food.js';

export const isDemo = new URLSearchParams(location.search).has('demo');

let client = null;

export async function initDb() {
  if (isDemo) return;
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// Supabase liefert max. 1000 Zeilen pro Anfrage – darum seitenweise laden.
async function fetchAll(table, order) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const page = check(await client.from(table).select('*').order(order).range(from, from + size - 1));
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}

// ───────────── Login ─────────────

export async function getSession() {
  if (isDemo) return { user: { id: 'demo', email: 'demo@motivator' } };
  return check(await client.auth.getSession()).session;
}

export function onAuthChange(cb) {
  if (isDemo) return;
  client.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function signIn(email, password) {
  if (isDemo) return;
  check(await client.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  if (isDemo) { location.href = location.pathname; return; }
  await client.auth.signOut();
}

// ───────────── Daten ─────────────

export async function loadAll() {
  if (isDemo) return { ...structuredClone(demo), hasWithingsSchema: true, hasStrengthSchema: true, hasBodySchema: true, hasTravelSchema: true, hasPlacesSchema: true, hasStagesSchema: true, hasReduceSchema: true, hasPulseSchema: true, hasAlcoholSchema: true, hasFoodSchema: true, hasBls: true };
  const [profiles, categories, habits, logs, pauses, extra, strength, body, travel, reduce, food] = await Promise.all([
    client.from('profiles').select('*').then(check),
    fetchAll('categories', 'sort_order'),
    fetchAll('habits', 'sort_order'),
    fetchAll('habit_logs', 'day'),
    fetchAll('pauses', 'start_day'),
    loadWithingsData(),
    loadStrengthData(),
    loadBodyData(),
    loadTravelData(),
    loadReduceData(),
    loadFoodData()
  ]);
  return { profile: profiles[0] || null, categories, habits, logs, pauses, ...extra, ...strength, ...body, ...travel, ...reduce, ...food };
}

// Essen (Update 015). Fehlt es noch, läuft die App ohne weiter. hasBls: Lebensmittel-CSV eingespielt?
export async function loadFoodData() {
  try {
    const [meals, favorites] = await Promise.all([fetchAll('meals', 'at'), fetchAll('meal_favorites', 'sort_order')]);
    const probe = await client.from('bls_foods').select('code').limit(1);
    return { meals, mealFavorites: favorites, hasFoodSchema: true, hasBls: !probe.error && (probe.data || []).length > 0 };
  } catch (err) {
    console.warn('Essen nicht verfügbar (Datenbank-Update 015 schon ausgeführt?)', err);
    return { meals: [], mealFavorites: [], hasFoodSchema: false, hasBls: false };
  }
}

// Lebensmittel suchen: jedes Wort muss vorkommen (Reihenfolge egal), Mehrzahl/Synonyme siehe food.js
export async function searchFoods(q) {
  const terms = searchTerms(q);
  if (!terms.length) return [];
  let rows;
  if (isDemo) {
    rows = DEMO_FOODS.filter((f) => terms.every((alts) => alts.some((a) => f.name.toLowerCase().includes(a))));
  } else {
    let query = client.from('bls_foods').select('*');
    for (const alts of terms) {
      const pats = alts.map((a) => `*${a.replace(/[%_*,()]/g, '').replace(/ /g, '*')}*`);
      query = pats.length === 1 ? query.ilike('name', pats[0].replace(/\*/g, '%')) : query.or(pats.map((p) => `name.ilike.${p}`).join(','));
    }
    rows = check(await query.limit(80));
  }
  return rankFoods(rows || [], terms).slice(0, 25);
}

// Open Food Facts direkt vom Gerät – Antworten wie die Server-Funktion: { products } bzw. { product }
const OFF_FIELDS = 'code,product_name,product_name_de,brands,nutriments,ingredients_text_de,ingredients_text,serving_quantity';
const offCache = new Map();
async function offDirect(body) {
  let url;
  if (body.action === 'product') {
    const code = String(body.code || '').replace(/\D/g, '');
    url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}&app_name=Motivator`;
  } else {
    url = 'https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams({
      search_terms: String(body.q || '').trim().slice(0, 80), search_simple: '1', action: 'process', json: '1',
      page_size: '20', lc: 'de', fields: OFF_FIELDS, sort_by: 'unique_scans_n', app_name: 'Motivator'
    });
  }
  if (offCache.has(url)) return offCache.get(url);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429 || res.status === 503) {
    const e = new Error('Open Food Facts ist gerade ausgelastet – in einer Minute nochmal.');
    e.busy = true;
    throw e;
  }
  if (!res.ok) throw new Error(`Open Food Facts antwortet nicht (${res.status})`);
  const data = await res.json();
  const out = body.action === 'product' ? { product: data && data.status === 1 ? data.product : null } : { products: (data && data.products) || [] };
  offCache.set(url, out);
  return out;
}

// Open Food Facts: direkt, sonst über die Server-Funktion „openfoodfacts“ (setzt den Namen der App, den OFF verlangt)
export async function offRequest(body) {
  if (isDemo) {
    const demoP = { code: '4000417025005', product_name_de: 'Harzer Käse (Demo)', brands: 'Demo-Molkerei', serving_quantity: 40, ingredients_text_de: 'Sauermilchquark, Speisesalz, Kümmel', nutriments: { 'energy-kcal_100g': 115, proteins_100g: 27, fat_100g: 0.5, carbohydrates_100g: 0.1, salt_100g: 4.5, calcium_100g: 0.125 } };
    return body.action === 'product' ? { product: { ...demoP, code: body.code } } : { products: [demoP] };
  }
  // Erst über die Server-Funktion (mit OFF-Konto, falls als Secret hinterlegt), sonst direkt vom Gerät
  const { data, error } = await client.functions.invoke('openfoodfacts', { body });
  if (!error) return data;
  let detail = '';
  try { detail = (await error.context.json()).error || ''; } catch { /* egal */ }
  const missing = error.name === 'FunctionsFetchError' || (error.context && error.context.status === 404);
  try {
    return await offDirect(body);
  } catch (err) {
    console.warn('Open Food Facts direkt:', err);
    if (missing) throw new Error('Die Server-Funktion „openfoodfacts“ fehlt noch (einspielen).');
    throw new Error(detail || err.message || 'Open Food Facts nicht erreichbar');
  }
}

export async function saveMeal(meal) {
  const { id, user_id, created_at, ...fields } = meal;
  if (isDemo) return { ...fields, id: id || demoId() };
  if (id) return check(await client.from('meals').update(fields).eq('id', id).select().single());
  return check(await client.from('meals').insert(fields).select().single());
}

export async function deleteMeal(id) {
  if (isDemo || !id) return;
  check(await client.from('meals').delete().eq('id', id));
}

export async function saveFavorite(fav) {
  const { id, user_id, created_at, ...fields } = fav;
  if (isDemo) return { ...fields, id: id || demoId() };
  if (id) return check(await client.from('meal_favorites').update(fields).eq('id', id).select().single());
  return check(await client.from('meal_favorites').insert(fields).select().single());
}

export async function deleteFavorite(id) {
  if (isDemo || !id) return;
  check(await client.from('meal_favorites').delete().eq('id', id));
}

// „Weniger von …“ (Update 009). Fehlt es noch, läuft die App ohne weiter.
export async function loadReduceData() {
  try {
    const [settings, events] = await Promise.all([
      client.from('reduce_settings').select('*').then(check),
      fetchAll('reduce_events', 'at')
    ]);
    // „Alkoholfrei“ braucht Anzahl + Situation (Update 013)
    const probe = await client.from('reduce_events').select('qty, tags').limit(1);
    return { reduceSettings: settings || [], reduceEvents: events, hasReduceSchema: true, hasAlcoholSchema: !probe.error };
  } catch (err) {
    console.warn('„Weniger von …“ nicht verfügbar (Datenbank-Update 009 schon ausgeführt?)', err);
    return { reduceSettings: [], reduceEvents: [], hasReduceSchema: false, hasAlcoholSchema: false };
  }
}

export async function saveReduceSettings(row) {
  const { id, user_id, created_at, ...fields } = row;
  fields.updated_at = new Date().toISOString();
  if (isDemo) return { ...fields, id: id || demoId() };
  return check(await client.from('reduce_settings').upsert(fields, { onConflict: 'user_id,kind' }).select().single());
}

export async function addReduceEvent(event) {
  if (isDemo) return { ...event, id: demoId() };
  return check(await client.from('reduce_events').insert(event).select().single());
}

export async function deleteReduceEvent(id) {
  if (isDemo || !id) return;
  check(await client.from('reduce_events').delete().eq('id', id));
}

// Reiseziele. Fehlt das Datenbank-Update 006 noch, läuft die App ohne weiter.
export async function loadTravelData() {
  let travel = [];
  try {
    travel = await fetchAll('travel_goals', 'created_at');
  } catch (err) {
    console.warn('Reiseziele nicht verfügbar (Datenbank-Update 006 schon ausgeführt?)', err);
    return { travel: [], places: [], hasTravelSchema: false, hasPlacesSchema: false };
  }
  // Etappen (Update 008): Gibt es die Spalte schon?
  const hasStagesSchema = await client.from('travel_goals').select('stages_seen').limit(1).then(check).then(() => true, () => false);
  try {
    return { travel, places: await fetchAll('travel_places', 'name'), hasTravelSchema: true, hasPlacesSchema: true, hasStagesSchema };
  } catch (err) {
    console.warn('Eigene Orte nicht verfügbar (Datenbank-Update 007 schon ausgeführt?)', err);
    return { travel, places: [], hasTravelSchema: true, hasPlacesSchema: false, hasStagesSchema };
  }
}

export async function savePlace(place) {
  const { id, user_id, created_at, ...fields } = place;
  if (isDemo) return { ...fields, id: id || demoId() };
  return check(await client.from('travel_places').upsert(fields, { onConflict: 'user_id,name' }).select().single());
}

export async function deletePlace(id) {
  if (isDemo || !id) return;
  check(await client.from('travel_places').delete().eq('id', id));
}

// Wikipedia: Kurzfassung eines Artikels (Auszug + Bild) und Volltextsuche als Rückfall
export async function wikiSummary(title) {
  const res = await fetch('https://de.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Wikipedia nicht erreichbar (' + res.status + ')');
  return res.json();
}

export async function wikiSearch(query) {
  const url = 'https://de.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', list: 'search', srsearch: query, srlimit: '3', format: 'json', origin: '*' });
  const res = await fetch(url);
  if (!res.ok) throw new Error('Wikipedia-Suche nicht erreichbar (' + res.status + ')');
  const data = await res.json();
  return ((data.query && data.query.search) || []).map((r) => r.title);
}

// Orte suchen über OpenStreetMap (Nominatim). Nur auf Knopfdruck – die Nutzungsregeln erlauben max. 1 Anfrage/Sekunde.
export async function searchPlaces(query) {
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    q: query, format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': 'de'
  });
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Suche fehlgeschlagen (' + res.status + ')');
  return res.json();
}

export async function saveTravelGoal(goal) {
  const { id, user_id, created_at, ...fields } = goal;
  if (isDemo) return { ...fields, id: id || demoId() };
  if (id) return check(await client.from('travel_goals').update(fields).eq('id', id).select().single());
  return check(await client.from('travel_goals').insert(fields).select().single());
}

export async function deleteTravelGoal(id) {
  if (isDemo || !id) return;
  check(await client.from('travel_goals').delete().eq('id', id));
}

// Körperwerte (Renpho). Fehlt das Datenbank-Update 005 noch, läuft die App ohne weiter.
export async function loadBodyData() {
  if (isDemo) return { body: structuredClone(demo.body), hasBodySchema: true };
  try {
    return { body: await fetchAll('body_measurements', 'day'), hasBodySchema: true };
  } catch (err) {
    console.warn('Körperwerte nicht verfügbar (Datenbank-Update 005 schon ausgeführt?)', err);
    return { body: [], hasBodySchema: false };
  }
}

export async function importBody(measurements) {
  if (isDemo) return measurements.map((m) => ({ ...m, id: demoId() }));
  const saved = [];
  for (let i = 0; i < measurements.length; i += 200) {
    const rows = check(await client.from('body_measurements')
      .upsert(measurements.slice(i, i + 200), { onConflict: 'user_id,ext_id', ignoreDuplicates: true })
      .select());
    saved.push(...rows);
  }
  return saved;
}

// Krafttraining (Alpha Progression). Fehlt das Datenbank-Update 004 noch, läuft die App ohne weiter.
export async function loadStrengthData() {
  if (isDemo) {
    const { strength, plans } = structuredClone(demo);
    return { strength, plans, hasStrengthSchema: true };
  }
  try {
    const [strength, plans] = await Promise.all([
      fetchAll('strength_sessions', 'started_at'),
      fetchAll('exercise_plans', 'exercise')
    ]);
    return { strength, plans, hasStrengthSchema: true };
  } catch (err) {
    console.warn('Krafttraining nicht verfügbar (Datenbank-Update 004 schon ausgeführt?)', err);
    return { strength: [], plans: [], hasStrengthSchema: false };
  }
}

// Neue Einheiten speichern – in Paketen, bekannte (gleiche ext_id) werden übersprungen
export async function importStrength(sessions) {
  if (isDemo) return sessions.map((s) => ({ ...s, id: demoId() }));
  const saved = [];
  for (let i = 0; i < sessions.length; i += 50) {
    const chunk = sessions.slice(i, i + 50);
    const rows = check(await client.from('strength_sessions')
      .upsert(chunk, { onConflict: 'user_id,ext_id', ignoreDuplicates: true })
      .select());
    saved.push(...rows);
  }
  return saved;
}

export async function savePlan(plan) {
  const { id, user_id, created_at, ...fields } = plan;
  fields.updated_at = new Date().toISOString();
  if (isDemo) return { ...fields, id: id || demoId() };
  if (id) return check(await client.from('exercise_plans').update(fields).eq('id', id).select().single());
  return check(await client.from('exercise_plans').insert(fields).select().single());
}

export async function deletePlan(id) {
  if (isDemo) return;
  check(await client.from('exercise_plans').delete().eq('id', id));
}

// Withings-Daten. Fehlt das Datenbank-Update 003 noch, läuft die App ohne Withings weiter.
export async function loadWithingsData() {
  if (isDemo) {
    const { activity, workouts, dismissals, withings, sleep, heart } = structuredClone(demo);
    return { activity, workouts, dismissals, withings, sleep, heart, hasWithingsSchema: true, hasPulseSchema: true };
  }
  try {
    const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
    const [status, activity, workouts, dismissals] = await Promise.all([
      client.rpc('withings_status').then(check),
      fetchAll('daily_activity', 'day'), // alle Tage: die Strecke „seit Start“ darf nie schrumpfen
      client.from('workouts').select('*').gte('day', since).order('start_at').then(check),
      fetchAll('auto_dismissals', 'day')
    ]);
    const s = status && status[0];
    const pulse = await loadSleep(since);
    return {
      activity, workouts, dismissals, hasWithingsSchema: true, ...pulse,
      withings: s ? { connected: true, last_sync_at: s.last_sync_at, connected_at: s.connected_at } : { connected: false }
    };
  } catch (err) {
    console.warn('Withings-Daten nicht verfügbar (Datenbank-Update 003 schon ausgeführt?)', err);
    return { activity: [], workouts: [], dismissals: [], withings: { connected: false }, hasWithingsSchema: false, sleep: [], hasPulseSchema: false };
  }
}

// Schlaf + Ruhepuls (Update 010). Fehlt es noch, läuft alles andere weiter.
async function loadSleep(since) {
  try {
    const sleep = await client.from('sleep_summary').select('day, hr_avg, hr_min, hr_max, sleep_min').gte('day', since).order('day').then(check);
    // Ruhigste halbe Stunde pro Tag (Update 011) – fehlt es, bleibt die Karte einfach weg
    const heart = await client.from('daily_heart').select('day, rest_hr, samples').gte('day', since).order('day').then(check).catch((err) => { console.warn('Puls über den Tag fehlt noch (Update 011?)', err); return []; });
    return { sleep: sleep || [], heart: heart || [], hasPulseSchema: true };
  } catch (err) {
    console.warn('Puls nicht verfügbar (Datenbank-Update 010 schon ausgeführt?)', err);
    return { sleep: [], heart: [], hasPulseSchema: false };
  }
}

export async function withings(action, extra = {}) {
  if (isDemo) {
    if (action === 'sync') return { connected: true, last_sync_at: new Date().toISOString() };
    return { connected: action !== 'disconnect' };
  }
  // Funktionsnamen unterscheiden Groß-/Kleinschreibung – beide probieren, den funktionierenden merken
  let remembered = null;
  try { remembered = localStorage.getItem('motivator.withings.fn'); } catch { /* egal */ }
  const names = [...new Set([remembered, 'withings', 'Withings'].filter(Boolean))];
  let data = null;
  let error = null;
  for (const name of names) {
    ({ data, error } = await client.functions.invoke(name, { body: { action, ...extra } }));
    const notFound = error && (error.name === 'FunctionsFetchError' || (error.context && error.context.status === 404));
    if (!notFound) {
      if (!error) { try { localStorage.setItem('motivator.withings.fn', name); } catch { /* egal */ } }
      break;
    }
  }
  if (error && error.name === 'FunctionsFetchError') {
    throw new Error('Die Server-Funktion ist nicht erreichbar (Name „withings“? Deployt? „Verify JWT“ aus?).');
  }
  if (error) {
    let detail = '';
    try { detail = (await error.context.json()).error || ''; } catch { /* egal */ }
    const e = new Error(detail || error.message || 'Withings-Abgleich fehlgeschlagen');
    throw e;
  }
  if (data && data.error && !data.connected) throw new Error(data.error);
  return data;
}

export async function addDismissal(habitId, day) {
  if (isDemo) return;
  check(await client.from('auto_dismissals').upsert({ habit_id: habitId, day }, { onConflict: 'habit_id,day' }));
}

function demoId() {
  return 'demo-' + Math.random().toString(36).slice(2, 10);
}

export async function saveHabit(habit) {
  if (isDemo) return { ...habit, id: habit.id || demoId() };
  const { id, user_id, created_at, ...fields } = habit;
  if (id) return check(await client.from('habits').update(fields).eq('id', id).select().single());
  return check(await client.from('habits').insert(fields).select().single());
}

export async function archiveHabit(id) {
  if (isDemo) return;
  check(await client.from('habits').update({ archived: true }).eq('id', id));
}

// source wird nur mitgeschickt, wenn die Spalte existiert (Datenbank-Update 003)
export async function setLog(habitId, day, status, value = null, source = null) {
  const row = { habit_id: habitId, day, status, value };
  if (source) row.source = source;
  if (isDemo) return row;
  return check(await client.from('habit_logs')
    .upsert(row, { onConflict: 'habit_id,day' })
    .select().single());
}

export async function deleteLog(habitId, day) {
  if (isDemo) return;
  check(await client.from('habit_logs').delete().eq('habit_id', habitId).eq('day', day));
}

export async function addPause(habitId, startDay, endDay) {
  const row = { habit_id: habitId, start_day: startDay, end_day: endDay };
  if (isDemo) return { ...row, id: demoId() };
  return check(await client.from('pauses').insert(row).select().single());
}

export async function deletePause(id) {
  if (isDemo) return;
  check(await client.from('pauses').delete().eq('id', id));
}

export async function saveCategory(cat) {
  if (isDemo) return { ...cat, id: cat.id || demoId() };
  const { id, user_id, created_at, ...fields } = cat;
  if (id) return check(await client.from('categories').update(fields).eq('id', id).select().single());
  return check(await client.from('categories').insert(fields).select().single());
}

export async function deleteCategory(id) {
  if (isDemo) return;
  check(await client.from('categories').delete().eq('id', id));
}

// ───────────── Erinnerung (Web Push) ─────────────

export async function remindRequest(action) {
  if (isDemo) return action === 'key' ? { key: 'demo' } : { devices: 1, ok: 1, errors: [] };
  const { data, error } = await client.functions.invoke('erinnerung', { body: { action } });
  if (!error) return data;
  let detail = '';
  try { detail = (await error.context.json()).error || ''; } catch { /* egal */ }
  if (error.name === 'FunctionsFetchError' || (error.context && error.context.status === 404)) throw new Error('Die Server-Funktion „erinnerung“ fehlt noch (einspielen).');
  throw new Error(detail || error.message || 'Erinnerung: Server nicht erreichbar');
}

export async function savePushSub(sub, device) {
  if (isDemo) return;
  const row = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device };
  check(await client.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' }));
}

export async function deletePushSub(endpoint) {
  if (isDemo) return;
  check(await client.from('push_subscriptions').delete().eq('endpoint', endpoint));
}

export async function setHabitRemind(id, on) {
  if (isDemo) return;
  check(await client.from('habits').update({ remind: on }).eq('id', id));
}

export async function updateProfile(id, patch) {
  if (isDemo) return;
  check(await client.from('profiles').update(patch).eq('id', id));
}

// ───────────── Demo-Daten ─────────────

// Ein paar Lebensmittel aus dem BLS 4.0 (je 100 g, gerundet) – für die Demo-Suche
const DEMO_FOODS = [
  { code: 'C133000', name: 'Hafer Flocken', kcal: 348, protein: 13.2, fat: 6.7, carbs: 53.3, fiber: 11, sugar: 0.7, salt: 0, iron: 4.4, zinc: 3.6, magnesium: 121, calcium: 44, potassium: 382, folate: 93, vit_c: 0, vit_b12: 0, vit_d: 0, iodine: 0.8 },
  { code: 'F503100', name: 'Heidelbeere roh', kcal: 44, protein: 0.6, fat: 0.6, carbs: 7.4, fiber: 4.9, sugar: 7.4, salt: 0, iron: 0.7, zinc: 0.1, magnesium: 2, calcium: 10, potassium: 80, folate: 12, vit_c: 15, vit_b12: 0, vit_d: 0, iodine: 0.3 },
  { code: 'H850000', name: 'Walnuss', kcal: 709, protein: 15, fat: 70, carbs: 10, fiber: 6, sugar: 2.6, salt: 0, iron: 2.5, zinc: 2.7, magnesium: 160, calcium: 90, potassium: 440, folate: 77, vit_c: 3, vit_b12: 0, vit_d: 0, iodine: 3 },
  { code: 'M111300', name: 'Kuhmilch 3,5 % Fett', kcal: 64, protein: 3.3, fat: 3.5, carbs: 4.7, fiber: 0, sugar: 4.7, salt: 0.1, iron: 0, zinc: 0.4, magnesium: 12, calcium: 120, potassium: 155, folate: 6, vit_c: 1, vit_b12: 0.4, vit_d: 0.1, iodine: 11 },
  { code: 'B100000', name: 'Roggenvollkornbrot', kcal: 205, protein: 6.8, fat: 1.2, carbs: 38.8, fiber: 8.1, sugar: 2.9, salt: 1.1, iron: 2, zinc: 1.8, magnesium: 60, calcium: 23, potassium: 290, folate: 30, vit_c: 0, vit_b12: 0, vit_d: 0, iodine: 2 },
  { code: 'H960000', name: 'Hummus/Kichererbsenmus', kcal: 210, protein: 7.5, fat: 14, carbs: 12, fiber: 6, sugar: 0.5, salt: 1, iron: 2.3, zinc: 1.5, magnesium: 60, calcium: 40, potassium: 230, folate: 80, vit_c: 2, vit_b12: 0, vit_d: 0, iodine: 1 },
  { code: 'X4A8070', name: 'Rote-Linsensuppe mit Koriander', kcal: 76, protein: 4.2, fat: 2.1, carbs: 9.4, fiber: 1.9, sugar: 1.4, salt: 0.7, iron: 1.4, zinc: 0.6, magnesium: 19, calcium: 15, potassium: 210, folate: 30, vit_c: 3, vit_b12: 0, vit_d: 0, iodine: 2 },
  { code: 'X934412', name: 'Flammkuchen Elsässer Art', kcal: 233, protein: 8.7, fat: 11.3, carbs: 23, fiber: 1.9, sugar: 1.8, salt: 0.8, iron: 0.6, zinc: 0.6, magnesium: 12, calcium: 40, potassium: 150, folate: 13, vit_c: 1.3, vit_b12: 0.2, vit_d: 0.1, iodine: 9 },
  { code: 'X9A5000', name: 'Flammkuchen vegetarisch', kcal: 221, protein: 6.9, fat: 10.7, carbs: 23, fiber: 1.9, sugar: 2.2, salt: 0.5, iron: 0.6, zinc: 0.5, magnesium: 11, calcium: 41, potassium: 136, folate: 13, vit_c: 1.9, vit_b12: 0.2, vit_d: 0.1, iodine: 9 },
  { code: 'G480100', name: 'Speisezwiebel roh', kcal: 34, protein: 1.2, fat: 0.2, carbs: 6, fiber: 1.4, sugar: 6, salt: 0, iron: 0.7, zinc: 0.2, magnesium: 10, calcium: 25, potassium: 174, folate: 15, vit_c: 7.4, vit_b12: 0, vit_d: 0, iodine: 2 },
  { code: 'F110100', name: 'Apfel roh', kcal: 54, protein: 0.3, fat: 0.2, carbs: 11.4, fiber: 2, sugar: 10.3, salt: 0, iron: 0.2, zinc: 0.1, magnesium: 5, calcium: 6, potassium: 120, folate: 5, vit_c: 11, vit_b12: 0, vit_d: 0, iodine: 0.4 },
  { code: 'H440000', name: 'Linse rot, getrocknet', kcal: 330, protein: 24, fat: 1.5, carbs: 50, fiber: 11, sugar: 2, salt: 0, iron: 7.6, zinc: 3.6, magnesium: 90, calcium: 50, potassium: 680, folate: 180, vit_c: 0, vit_b12: 0, vit_d: 0, iodine: 2 }
];

const demo = (() => {
  const t = today();
  const cats = [
    { id: 'c-sport', name: 'Sport', color: 'blue', sort_order: 0 },
    { id: 'c-kopf', name: 'Kopf', color: 'orange', sort_order: 1 },
    { id: 'c-pflege', name: 'Pflege', color: 'teal', sort_order: 2 }
  ];
  const start = addDays(t, -60);
  const habits = [
    { id: 'h-sport', category_id: 'c-sport', name: 'Sport', icon: 'dumbbell', color: 'blue', kind: 'check', schedule: 'per_week', schedule_count: 5, schedule_min: 3, mini_text: '15 Minuten Bewegung', start_day: start, archived: false, sort_order: 0 },
    { id: 'h-skin', category_id: 'c-pflege', name: 'Hautpflege', icon: 'drop', color: 'teal', kind: 'check', schedule: 'daily', start_day: start, archived: false, sort_order: 1 },
    { id: 'h-duo', category_id: 'c-kopf', name: 'Duolingo', icon: 'chat', color: 'orange', kind: 'check', schedule: 'daily', mini_text: 'Eine Lektion', start_day: start, archived: false, sort_order: 2 },
    { id: 'h-brain', category_id: 'c-kopf', name: 'Hirntraining', icon: 'spark', color: 'orange', kind: 'check', schedule: 'per_week', schedule_count: 5, schedule_min: 3, mini_text: '5 Minuten', start_day: start, archived: false, sort_order: 3 },
    { id: 'h-push', category_id: 'c-sport', name: 'Liegestütze', icon: 'dumbbell', color: 'blue', kind: 'count', target: 22, unit: 'Wdh.', mini_value: 10, schedule: 'daily', start_day: start, archived: false, sort_order: 4 },
    { id: 'h-steps', category_id: 'c-sport', name: '5.000 Schritte', icon: 'steps', color: 'blue', kind: 'count', target: 5000, unit: 'Schritte', mini_value: 2000, schedule: 'daily', auto_metric: 'steps', start_day: addDays(t, -10), archived: false, sort_order: 5 }
  ];
  habits[0].auto_categories = [16, 17];
  habits[0].auto_min_minutes = 20;
  // deterministische Zufallsfolge, damit die Demo immer gleich aussieht
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const logs = [];
  for (let i = 60; i >= 1; i -= 1) {
    const d = addDays(t, -i);
    const r = () => rnd();
    if (r() < 0.45) logs.push({ habit_id: 'h-sport', day: d, status: 'done' });
    if (r() < 0.85) logs.push({ habit_id: 'h-skin', day: d, status: 'done' });
    const duo = r();
    if (duo < 0.7) logs.push({ habit_id: 'h-duo', day: d, status: 'done' });
    else if (duo < 0.85) logs.push({ habit_id: 'h-duo', day: d, status: 'mini' });
    // Hirntraining: immer genau Mo, Mi, Fr → lauter Mini-Wochen (zeigt den freundlichen Hinweis)
    if ([1, 3, 5].includes(new Date(d + 'T12:00').getDay())) logs.push({ habit_id: 'h-brain', day: d, status: 'done' });
    r();
    const p = r();
    if (p < 0.6) logs.push({ habit_id: 'h-push', day: d, status: 'done', value: 22 });
    else if (p < 0.75) logs.push({ habit_id: 'h-push', day: d, status: 'mini', value: 10 });
  }
  logs.push({ habit_id: 'h-skin', day: t, status: 'done' });
  logs.push({ habit_id: 'h-duo', day: t, status: 'mini' });
  // Wann abgehakt? Hautpflege morgens, Duolingo abends, Liegestütze nachmittags (für „meist gegen“)
  const clock = { 'h-skin': 7, 'h-duo': 21, 'h-push': 17, 'h-brain': 12 };
  logs.forEach((l, i) => { if (clock[l.habit_id] != null) l.created_at = new Date(`${l.day}T${String(clock[l.habit_id]).padStart(2, '0')}:${String(10 + (i * 7) % 40).padStart(2, '0')}:00`).toISOString(); });
  const pauses = [{ id: 'p1', habit_id: null, start_day: addDays(t, -20), end_day: addDays(t, -18) }];
  // Withings-Beispieldaten: Schritte täglich, Krafttraining Mo/Mi/Fr (+ heute früh), Spaziergänge
  const activity = [];
  const workouts = [];
  for (let i = 30; i >= 0; i -= 1) {
    const d = addDays(t, -i);
    const steps = i === 0 ? 6240 : 3000 + Math.round(rnd() * 7000);
    activity.push({ day: d, steps, distance_m: Math.round(steps * 0.75), active_minutes: 20 + Math.round(rnd() * 40) });
    const wd = new Date(d + 'T12:00').getDay();
    if ([1, 3, 5].includes(wd) || i === 0) {
      const startAt = new Date(d + (i === 0 ? 'T07:30:00' : 'T18:05:00'));
      const mins = 45 + Math.round(rnd() * 12);
      const z = mins * 60;
      workouts.push({ id: 'w' + i, ext_id: 'w' + i, day: d, start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + mins * 60000).toISOString(), category: 16, duration_min: mins, calories: 280 + Math.round(rnd() * 60), hr_avg: 112 + Math.round(rnd() * 12), hr_max: 145 + Math.round(rnd() * 15), data: { hr_zone_0: Math.round(z * 0.12), hr_zone_1: Math.round(z * 0.33), hr_zone_2: Math.round(z * 0.4), hr_zone_3: Math.round(z * 0.15) } });
      // wie bei Jans Uhr: gleichzeitig automatisch erkanntes „Sonstiges“ – darf nicht doppelt zählen
      if (i % 3 === 0) workouts.push({ id: 's' + i, ext_id: 's' + i, day: d, start_at: new Date(startAt.getTime() - 120000).toISOString(), end_at: new Date(startAt.getTime() + (mins + 2) * 60000).toISOString(), category: 36, duration_min: mins + 4, calories: 300, hr_avg: 114, hr_max: 150, data: {} });
    }
    if (rnd() < 0.4) {
      const startAt = new Date(d + 'T12:40:00');
      workouts.push({ id: 'g' + i, ext_id: 'g' + i, day: d, start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + 24 * 60000).toISOString(), category: 1, duration_min: 24, calories: 90, hr_avg: 96, hr_max: 112, data: {} });
    }
  }
  // Alpha Progression: zu jedem Krafttraining die passende Einheit (gleiche Startzeit),
  // dazu drei ältere Einheiten ohne Uhr
  const strength = [];
  const sets = (kg, reps, n = 3) => Array.from({ length: n }, () => ({ kg, reps }));
  const unit = (id, startAt, mins, k) => {
    const curls = k > 4 ? { kg: 4, reps: Math.min(40, 30 + Math.floor((30 - k) / 3)) } : { kg: 7, reps: 20 };
    strength.push({
      id, ext_id: 'alpha:' + id, source: 'alpha', title: k % 2 ? 'Oberkörper Kraft' : 'Oberkörper 2', program: 'Tag ' + (1 + (k % 5)) + ' · Woche 17 · Mini Gainz PT. II',
      started_at: startAt, day: toDay(new Date(startAt)), duration_min: mins,
      exercises: [
        { name: 'Seitheben', equipment: 'Kurzhanteln', kind: 'kg_reps', sets: sets(4, 22 + Math.floor((30 - k) / 7)) },
        { name: 'Curls', equipment: 'Kurzhanteln', kind: 'kg_reps', sets: sets(curls.kg, curls.reps) },
        { name: 'Trizepsdrücken über dem Kopf', equipment: 'Kurzhanteln', kind: 'kg_reps', sets: sets(4, 22) },
        { name: 'Plank', equipment: 'Körpergewicht', kind: 'time', sets: [{ sec: 55 }, { sec: 55 }] }
      ]
    });
  };
  for (const w of workouts) {
    if (w.category !== 16) continue;
    const k = Number(String(w.id).slice(1));
    unit('a' + k, w.start_at, Math.round(w.duration_min) - 1, k);
  }
  for (const k of [40, 44, 47]) unit('a' + k, new Date(addDays(t, -k) + 'T18:00:00').toISOString(), 48, k);
  // „Weniger rauchen“: vor 20 Tagen begonnen – erste Woche ~13 am Tag, danach langsam weniger
  const reduceEvents = [];
  for (let i = 20; i >= 0; i -= 1) {
    const d = addDays(t, -i);
    const n = i === 0 ? 4 : (i > 13 ? 12 + (i % 3) : 9 + (i % 3));
    for (let k = 0; k < n; k += 1) {
      const minutes = 7 * 60 + 20 + Math.round(k * (15 * 60) / n) + (k % 3) * 7;
      if (i === 0 && minutes > new Date().getHours() * 60 + new Date().getMinutes() - 30) break;
      const at = new Date(d + 'T00:00:00'); at.setMinutes(minutes);
      reduceEvents.push({ id: 'r' + i + '-' + k, kind: 'rauchen', at: at.toISOString(), day: d });
    }
  }
  // „Alkoholfrei“: seit 16 Tagen, zwei Biertage mit Situation
  const drinkAt = (i, time) => { const d = addDays(t, -i); const at = new Date(d + 'T' + time + ':00'); return { day: d, at: at.toISOString() }; };
  reduceEvents.push({ id: 'a1', kind: 'alkohol', qty: 4, tags: ['Feierabend', 'allein zu Hause'], ...drinkAt(11, '19:40') });
  reduceEvents.push({ id: 'a2', kind: 'alkohol', qty: 3, tags: ['Langeweile'], ...drinkAt(4, '21:10') });
  const reduceSettings = [{ id: 'rs2', kind: 'alkohol', started_on: addDays(t, -16), costs: { price: 2, per_week: 12, goal_start: 5, goal_every: 2 }, night_from: '23:00', night_to: '07:00', step_min: 0, adjust_min: 0, show_card: true }, { id: 'rs1', kind: 'rauchen', started_on: addDays(t, -20), costs: { tobacco_price: 6.75, tobacco_g: 30, paper_price: 2, paper_qty: 100, filter_price: 2, filter_qty: 120, g_per_unit: 0.6 }, night_from: '23:00', night_to: '07:00', step_min: 5, adjust_min: 0, show_card: true }];
  const plans = [{ id: 'plan-curls', exercise: 'Curls', equipment: 'Kurzhanteln', sets: 3, start_reps: 20, kg: 7, plus_reps: 2, every_weeks: 2, max_reps: 40, kg_step: 2, started_on: weekStart(addDays(t, -7)) }];
  // Körperwerte: alle 3–4 Tage eine Messung, leicht schwankend mit sanftem Trend
  const body = [];
  for (let i = 180; i >= 1; i -= 3 + Math.round(rnd())) {
    const d = addDays(t, -i);
    const trend = (180 - i) / 180;
    const w = Math.round((77.5 + trend * 3.5 + (rnd() - 0.5) * 1.6) * 100) / 100;
    const fat = Math.round((25.4 + trend * 1.6 + (rnd() - 0.5) * 0.8) * 10) / 10;
    const muscle = Math.round((54.8 + trend * 1.8 + (rnd() - 0.5) * 0.5) * 100) / 100;
    body.push({ id: 'b' + i, ext_id: 'renpho:' + d, source: 'renpho', day: d, measured_at: new Date(d + 'T07:05:00').toISOString(), weight: w,
      vals: { weight: w, bmi: Math.round((w / 1.75 / 1.75) * 10) / 10, fat_pct: fat, fat_kg: Math.round(w * fat) / 100, muscle_kg: muscle, muscle_pct: Math.round((muscle / w) * 1000) / 10, skeletal_kg: Math.round(muscle * 0.68 * 100) / 100, lean_kg: Math.round((w - (w * fat) / 100) * 100) / 100, subcut_pct: Math.round((fat - 3.2) * 10) / 10, visceral: fat > 26.5 ? 10 : 9, bmr: Math.round(1600 + muscle * 0.9 - 50), body_age: 37, water_pct: 53.2 } });
  }
  // Puls wie bei Jan: Uhr nur tagsüber → niedrigster Wert des Tages um 60, seit „Weniger rauchen“ etwas niedriger
  let s2 = 11;
  const rnd2 = () => { s2 = (s2 * 9301 + 49297) % 233280; return s2 / 233280; };
  const heart = [];
  for (let i = 90; i >= 0; i -= 1) {
    if (rnd2() < 0.06) continue; // Tag ohne Uhr
    const after = i < 20 ? (20 - i) / 20 : 0;
    heart.push({ day: addDays(t, -i), rest_hr: Math.round(66 + Math.sin(i / 9) * 1.2 + (rnd2() - 0.5) * 3 - after * 2.5), samples: 70 + Math.round(rnd2() * 20) });
  }
  const sleep = [];
  // Essen: Favoriten + Mahlzeiten der letzten 9 Tage (Werte je 100 g gerundet aus dem BLS)
  const F = Object.fromEntries(DEMO_FOODS.map((f) => [f.code, f]));
  const it = (code, grams) => ({ code, name: F[code].name, grams, n: (({ code: _c, name: _n, ...v }) => v)(F[code]) });
  const breakfast = { id: 'fav1', name: 'Frühstück wie immer', items: [it('C133000', 60), it('F503100', 80), it('H850000', 15), it('M111300', 200)], plants: ['Hafer', 'Heidelbeere', 'Walnuss'], home: true, sort_order: 0 };
  const hummus = { id: 'fav2', name: 'Brot mit Hummus', items: [it('B100000', 100), it('H960000', 60)], plants: ['Roggen', 'Kichererbse'], home: true, sort_order: 1 };
  const mealFavorites = [breakfast, hummus];
  const meals = [];
  const sum = (items, portion = 1) => { const n = {}; for (const x of items) for (const [k, v] of Object.entries(x.n)) n[k] = Math.round(((n[k] || 0) + v * x.grams * portion / 100) * 100) / 100; return n; };
  const add = (i, time, base, extra = {}) => { const d = addDays(t, -i); const m = { id: 'm' + i + time, at: new Date(d + 'T' + time + ':00').toISOString(), day: d, portion: 1, fav_id: base.id && base.id.startsWith('fav') ? base.id : null, ...base, ...extra }; m.id = 'm' + i + time; m.nutr = sum(m.items, m.portion); meals.push(m); };
  for (let i = 9; i >= 1; i -= 1) {
    add(i, '08:10', breakfast);
    if (i % 2) add(i, '13:00', hummus);
    if (i % 3 === 0) add(i, '19:30', { name: 'Rote-Linsensuppe', items: [it('X4A8070', 350)], plants: ['Rote Linse', 'Zwiebel', 'Karotte', 'Koriander'], home: true });
    else if (i % 3 === 1) add(i, '19:45', { name: 'Flammkuchen', items: [it('X934412', 350)], plants: ['Weizen', 'Zwiebel'], home: false, portion: 1.5 });
  }
  add(0, '08:05', breakfast);
  return {
    body, sleep, heart, meals, mealFavorites,
    profile: { id: 'demo', display_name: 'Jan', travel_queue: ['Paris', 'Rom', 'Wien'], travel_from: null, remind_on: true, remind_at: 1200, remind_tz: 'Europe/Berlin', remind_last: null, modules: ['habits', 'alpha', 'body', 'weniger', 'alkohol', 'essen'], tiles: ['steps', 'training', 'body'] },
    categories: cats, habits, logs, pauses,
    activity, workouts, dismissals: [], strength, plans, travel: [], places: [], reduceEvents, reduceSettings,
    withings: { connected: true, last_sync_at: new Date().toISOString(), connected_at: addDays(t, -30) + 'T10:00:00Z' }
  };
})();
