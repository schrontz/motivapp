// Essen – reine Funktionen, getestet.
// Leitlinien: Entdecken statt Diät. Pflanzen sammeln (5 am Tag, 30 verschiedene pro Woche), Hülsenfrüchte,
// Eiweiß und Mikronährstoffe als Prozent vom Tagesbedarf. Kalorien stehen da, aber nie im Mittelpunkt.
// Nährwerte: Bundeslebensmittelschlüssel (BLS 4.0) je 100 g – Schätzungen, gut für Trends.

import { addDays, weekStart } from './dates.js';

// ───────────── Pflanzen ─────────────
// [Name, Gruppe, Suchwörter im BLS-Namen (Wortanfang, klein)] – Hülsenfrüchte haben die Gruppe „Hülsenfrüchte“
const P = [
  // Gemüse
  ['Zwiebel', 'Gemüse', ['zwiebel', 'speisezwiebel', 'lauchzwiebel', 'frühlingszwiebel']], ['Knoblauch', 'Gemüse', ['knoblauch']],
  ['Lauch', 'Gemüse', ['lauch', 'porree']], ['Tomate', 'Gemüse', ['tomate', 'tomaten', 'cocktailtomate']],
  ['Paprika', 'Gemüse', ['paprika', 'gemüsepaprika']], ['Gurke', 'Gemüse', ['gurke', 'salatgurke']],
  ['Zucchini', 'Gemüse', ['zucchini']], ['Aubergine', 'Gemüse', ['aubergine']], ['Karotte', 'Gemüse', ['karotte', 'möhre', 'mohrrübe']],
  ['Kartoffel', 'Gemüse', ['kartoffel', 'kartoffeln']], ['Süßkartoffel', 'Gemüse', ['süßkartoffel']], ['Kürbis', 'Gemüse', ['kürbis', 'hokkaido', 'butternut']],
  ['Spinat', 'Gemüse', ['spinat', 'blattspinat']], ['Brokkoli', 'Gemüse', ['brokkoli', 'broccoli']], ['Blumenkohl', 'Gemüse', ['blumenkohl']],
  ['Weißkohl', 'Gemüse', ['weißkohl', 'weißkraut', 'sauerkraut', 'krautsalat']], ['Rotkohl', 'Gemüse', ['rotkohl', 'blaukraut']], ['Grünkohl', 'Gemüse', ['grünkohl']],
  ['Wirsing', 'Gemüse', ['wirsing']], ['Rosenkohl', 'Gemüse', ['rosenkohl']], ['Kohlrabi', 'Gemüse', ['kohlrabi']], ['Pak Choi', 'Gemüse', ['pak']],
  ['Champignon', 'Gemüse', ['champignon', 'champignons', 'pilz', 'pilze']], ['Rote Bete', 'Gemüse', ['rote bete', 'rote rübe']],
  ['Sellerie', 'Gemüse', ['sellerie', 'staudensellerie', 'knollensellerie']], ['Fenchel', 'Gemüse', ['fenchel']], ['Spargel', 'Gemüse', ['spargel']],
  ['Radieschen', 'Gemüse', ['radieschen', 'rettich']], ['Mais', 'Gemüse', ['mais', 'zuckermais']], ['Rucola', 'Gemüse', ['rucola']],
  ['Kopfsalat', 'Gemüse', ['kopfsalat', 'eisbergsalat', 'blattsalat', 'romanasalat', 'feldsalat', 'endiviensalat', 'lollo']], ['Oliven', 'Gemüse', ['olive', 'oliven']],
  ['Artischocke', 'Gemüse', ['artischocke']], ['Avocado', 'Gemüse', ['avocado']], ['Ingwer', 'Gemüse', ['ingwer']], ['Okra', 'Gemüse', ['okra']], ['Topinambur', 'Gemüse', ['topinambur']],
  // Hülsenfrüchte
  ['Linse', 'Hülsenfrüchte', ['linse', 'linsen', 'linsensuppe']], ['Rote Linse', 'Hülsenfrüchte', ['rote linse', 'rote-linsensuppe']],
  ['Kichererbse', 'Hülsenfrüchte', ['kichererbse', 'kichererbsen', 'hummus', 'falafel']], ['Kidneybohne', 'Hülsenfrüchte', ['kidneybohne', 'kidneybohnen']],
  ['Weiße Bohne', 'Hülsenfrüchte', ['weiße bohne', 'weiße bohnen', 'baked beans']], ['Schwarze Bohne', 'Hülsenfrüchte', ['schwarze bohne', 'schwarze bohnen']],
  ['Grüne Bohne', 'Hülsenfrüchte', ['grüne bohne', 'grüne bohnen', 'bohne grün', 'bohnen grün', 'brechbohne', 'buschbohne', 'stangenbohne']], ['Erbse', 'Hülsenfrüchte', ['erbse', 'erbsen']],
  ['Soja', 'Hülsenfrüchte', ['soja', 'sojabohne', 'tofu', 'tempeh', 'edamame', 'sojadrink']], ['Erdnuss', 'Hülsenfrüchte', ['erdnuss', 'erdnüsse', 'erdnussbutter', 'erdnussmus']],
  ['Lupine', 'Hülsenfrüchte', ['lupine']], ['Mungbohne', 'Hülsenfrüchte', ['mungbohne', 'mungobohne']],
  // Obst
  ['Apfel', 'Obst', ['apfel', 'äpfel', 'apfelmus']], ['Birne', 'Obst', ['birne']], ['Banane', 'Obst', ['banane']], ['Orange', 'Obst', ['orange', 'apfelsine']],
  ['Mandarine', 'Obst', ['mandarine', 'clementine']], ['Zitrone', 'Obst', ['zitrone', 'zitronensaft']], ['Limette', 'Obst', ['limette']],
  ['Erdbeere', 'Obst', ['erdbeere', 'erdbeeren', 'erdbeer']], ['Himbeere', 'Obst', ['himbeere', 'himbeeren', 'himbeer']], ['Heidelbeere', 'Obst', ['heidelbeere', 'heidelbeeren', 'blaubeere', 'blaubeeren']],
  ['Brombeere', 'Obst', ['brombeere']], ['Johannisbeere', 'Obst', ['johannisbeere']], ['Kirsche', 'Obst', ['kirsche', 'kirschen', 'sauerkirsche', 'süßkirsche']],
  ['Pflaume', 'Obst', ['pflaume', 'zwetschge']], ['Aprikose', 'Obst', ['aprikose']], ['Pfirsich', 'Obst', ['pfirsich', 'nektarine']],
  ['Weintraube', 'Obst', ['weintraube', 'weintrauben', 'traube', 'rosine', 'rosinen']], ['Kiwi', 'Obst', ['kiwi']], ['Mango', 'Obst', ['mango']],
  ['Ananas', 'Obst', ['ananas']], ['Melone', 'Obst', ['melone', 'wassermelone', 'honigmelone']], ['Granatapfel', 'Obst', ['granatapfel']],
  ['Dattel', 'Obst', ['dattel', 'datteln']], ['Feige', 'Obst', ['feige', 'feigen']],
  // Getreide
  ['Hafer', 'Getreide', ['hafer', 'haferflocken']], ['Weizen', 'Getreide', ['weizen', 'weizenbrot', 'weizenbrötchen', 'weißbrot', 'teigwaren', 'nudeln', 'spaghetti', 'flammkuchen', 'pizza', 'pizzateig', 'baguette', 'couscous', 'bulgur']],
  ['Roggen', 'Getreide', ['roggen', 'roggenbrot', 'roggenvollkornbrot', 'roggenmischbrot', 'pumpernickel']], ['Dinkel', 'Getreide', ['dinkel', 'grünkern']],
  ['Gerste', 'Getreide', ['gerste', 'graupen']], ['Reis', 'Getreide', ['reis', 'basmati', 'risotto']], ['Hirse', 'Getreide', ['hirse']],
  ['Buchweizen', 'Getreide', ['buchweizen']], ['Quinoa', 'Getreide', ['quinoa']],
  // Nüsse und Samen
  ['Walnuss', 'Nüsse & Samen', ['walnuss', 'walnüsse']], ['Haselnuss', 'Nüsse & Samen', ['haselnuss', 'haselnüsse']], ['Mandel', 'Nüsse & Samen', ['mandel', 'mandeln', 'mandeldrink']],
  ['Cashew', 'Nüsse & Samen', ['cashew', 'cashewkern', 'cashewkerne']], ['Pistazie', 'Nüsse & Samen', ['pistazie', 'pistazien']],
  ['Kürbiskerne', 'Nüsse & Samen', ['kürbiskern', 'kürbiskerne']], ['Sonnenblumenkerne', 'Nüsse & Samen', ['sonnenblumenkern', 'sonnenblumenkerne']],
  ['Leinsamen', 'Nüsse & Samen', ['leinsamen']], ['Chiasamen', 'Nüsse & Samen', ['chia', 'chiasamen']], ['Sesam', 'Nüsse & Samen', ['sesam', 'tahin', 'tahini']], ['Esskastanie', 'Nüsse & Samen', ['kastanie', 'esskastanie', 'marone', 'maronen', 'kastanienmehl']],
  // Kräuter und Gewürze
  ['Petersilie', 'Kräuter & Gewürze', ['petersilie']], ['Schnittlauch', 'Kräuter & Gewürze', ['schnittlauch']], ['Basilikum', 'Kräuter & Gewürze', ['basilikum']],
  ['Koriander', 'Kräuter & Gewürze', ['koriander']], ['Dill', 'Kräuter & Gewürze', ['dill']], ['Minze', 'Kräuter & Gewürze', ['minze', 'pfefferminze']],
  ['Rosmarin', 'Kräuter & Gewürze', ['rosmarin']], ['Thymian', 'Kräuter & Gewürze', ['thymian']], ['Oregano', 'Kräuter & Gewürze', ['oregano']],
  ['Kurkuma', 'Kräuter & Gewürze', ['kurkuma']], ['Kreuzkümmel', 'Kräuter & Gewürze', ['kreuzkümmel', 'cumin']], ['Zimt', 'Kräuter & Gewürze', ['zimt']],
  ['Chili', 'Kräuter & Gewürze', ['chili', 'peperoni', 'jalapeño']], ['Pfeffer', 'Kräuter & Gewürze', ['pfeffer']],
  ['Kakao', 'Kräuter & Gewürze', ['kakao', 'kakaopulver']], ['Kaffee', 'Kräuter & Gewürze', ['kaffee']]
];
export const PLANT_GROUPS = ['Gemüse', 'Hülsenfrüchte', 'Obst', 'Getreide', 'Nüsse & Samen', 'Kräuter & Gewürze'];
export const PLANTS = P.map(([name, group, keys]) => ({ name, group, keys, legume: group === 'Hülsenfrüchte' }));
const byName = new Map(PLANTS.map((p) => [p.name, p]));
export const isLegume = (name) => !!(byName.get(name) && byName.get(name).legume);

// Pflanzen aus BLS-Namen erraten (Vorschlag – man kann abwählen). Wortanfang, damit „Mais“ nicht in „Maische“ steckt.
const norm = (s) => String(s || '').toLowerCase();
export function guessPlants(names) {
  const found = [];
  for (const raw of names || []) {
    const n = norm(raw).replace(/[-/]/g, ' ');
    const words = n.split(/[^a-zäöüß]+/).filter(Boolean);
    for (const p of PLANTS) {
      if (found.includes(p.name)) continue;
      const hit = p.keys.some((k) => (k.includes(' ') ? n.includes(k) : words.some((w) => w === k || (w.startsWith(k) && k.length >= 5))));
      if (hit) found.push(p.name);
    }
  }
  // „Rote Linse“ statt zusätzlich „Linse“
  if (found.includes('Rote Linse')) return found.filter((x) => x !== 'Linse');
  return found;
}

export function searchPlants(q) {
  const n = norm(q).trim();
  if (!n) return [];
  return PLANTS.filter((p) => norm(p.name).includes(n) || p.keys.some((k) => k.startsWith(n))).slice(0, 12);
}

// ───────────── Nährstoffe und Tagesbedarf ─────────────
// Referenzwerte der DGE für Erwachsene (Männer 25–50), gerundet. Eiweiß: 0,8 g je kg Körpergewicht.
export const NUTRIENTS = [
  { key: 'protein', label: 'Eiweiß', unit: 'g', ref: null },
  { key: 'fiber', label: 'Ballaststoffe', unit: 'g', ref: 30 },
  { key: 'iron', label: 'Eisen', unit: 'mg', ref: 11 },
  { key: 'zinc', label: 'Zink', unit: 'mg', ref: 14 },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', ref: 350 },
  { key: 'calcium', label: 'Calcium', unit: 'mg', ref: 1000 },
  { key: 'potassium', label: 'Kalium', unit: 'mg', ref: 4000 },
  { key: 'folate', label: 'Folat', unit: 'µg', ref: 300 },
  { key: 'vit_c', label: 'Vitamin C', unit: 'mg', ref: 110 },
  { key: 'vit_b12', label: 'Vitamin B12', unit: 'µg', ref: 4 },
  { key: 'vit_d', label: 'Vitamin D', unit: 'µg', ref: 20 },
  { key: 'iodine', label: 'Jod', unit: 'µg', ref: 200 }
];
export const NUTR_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'salt', ...NUTRIENTS.slice(2).map((n) => n.key)];
export const proteinRef = (weightKg) => (Number(weightKg) > 30 ? Math.round(Number(weightKg) * 0.8) : 57);
export const refOf = (n, weightKg) => (n.key === 'protein' ? proteinRef(weightKg) : n.ref);

// Wo steckt's drin? Für die freundliche „Entdeckung“
export const TIPS = {
  protein: 'Linsen, Kichererbsen, Tofu, Quark, Eier',
  fiber: 'Haferflocken, Vollkornbrot, Linsen, Beeren',
  iron: 'Linsen, Haferflocken, Kürbiskerne, Spinat – mit Vitamin C dazu wird mehr aufgenommen',
  zinc: 'Kürbiskerne, Haferflocken, Linsen, Käse',
  magnesium: 'Kürbiskerne, Haferflocken, Nüsse, Vollkorn',
  calcium: 'Milchprodukte, Grünkohl, Brokkoli, calciumreiches Mineralwasser',
  potassium: 'Kartoffeln, Bananen, Hülsenfrüchte, Spinat',
  folate: 'Linsen, Kichererbsen, Spinat, Brokkoli',
  vit_c: 'Paprika, Brokkoli, Zitrusfrüchte, Kiwi',
  vit_b12: 'Milchprodukte, Eier, Fisch, Fleisch – rein pflanzlich nur über Angereichertes',
  vit_d: 'Sonne auf der Haut (im Winter kaum), fetter Fisch, Eier',
  iodine: 'Jodsalz, Seefisch, Milchprodukte'
};

// Nährwerte einer Mahlzeit: Summe über die Zutaten (Gramm je normaler Portion) × Portion.
// Je Zutat zählen die Werte je 100 g aus `foods` (Map) – sonst die mitgespeicherten (it.n)
export function nutrOf(items, foods = null, portion = 1) {
  const out = {};
  for (const k of NUTR_KEYS) out[k] = null;
  for (const it of items || []) {
    const f = (foods && (foods.get ? foods.get(it.code) : foods[it.code])) || it.n;
    if (!f) continue;
    const g = (Number(it.grams) || 0) * (Number(portion) || 1) / 100;
    for (const k of NUTR_KEYS) {
      const v = f[k];
      if (v == null || v === '') continue;
      out[k] = (out[k] || 0) + Number(v) * g;
    }
  }
  for (const k of NUTR_KEYS) if (out[k] != null) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

// Prozent vom Tagesbedarf
export function percentOf(nutr, weightKg) {
  return NUTRIENTS.map((n) => {
    const v = nutr ? nutr[n.key] : null;
    const ref = refOf(n, weightKg);
    return { ...n, ref, value: v, pct: v == null ? null : Math.round((v / ref) * 100) };
  });
}

// ───────────── Tag und Woche ─────────────

export const mealsOn = (meals, day) => (meals || []).filter((m) => m.day === day);
export function plantsOn(meals, day) {
  const s = new Set();
  for (const m of mealsOn(meals, day)) for (const p of m.plants || []) s.add(p);
  return [...s];
}
// Summe eines Werts – null, wenn ihn keine Mahlzeit kennt (unbekannt ≠ 0)
const sumKey = (list, k) => {
  let s = null;
  for (const m of list) if (m.nutr && m.nutr[k] != null) s = (s || 0) + Number(m.nutr[k]);
  return s;
};

export function dayFood(meals, T) {
  const list = mealsOn(meals, T);
  const protein = sumKey(list, 'protein');
  return { meals: list, plants: plantsOn(meals, T), protein: protein == null ? null : Math.round(protein) };
}

// Woche Mo–So: Sammelalbum, Pflanzen pro Tag, Hülsenfrüchte, Eiweiß, Nährstoffe (Ø je Tag mit Einträgen), selbst gekocht
export function week(meals, T, weightKg, start = weekStart(T)) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = (meals || []).filter((m) => m.day >= days[0] && m.day <= days[6]);
  const album = [];
  for (const m of [...inWeek].sort((a, b) => (a.at < b.at ? -1 : 1))) for (const p of m.plants || []) if (!album.includes(p)) album.push(p);
  const perDay = days.map((d) => {
    const list = mealsOn(inWeek, d);
    return { day: d, meals: list.length, plants: plantsOn(inWeek, d).length, home: list.filter((m) => m.home).length, out: list.filter((m) => !m.home).length, future: d > T };
  });
  const logged = perDay.filter((d) => d.meals > 0);
  const legumeMeals = (list) => list.filter((m) => (m.plants || []).some(isLegume)).length;
  const prevStart = addDays(start, -7);
  const prev = (meals || []).filter((m) => m.day >= prevStart && m.day < start);
  const totals = {};
  for (const k of NUTR_KEYS) totals[k] = sumKey(inWeek, k);
  const avg = {};
  for (const k of NUTR_KEYS) avg[k] = logged.length && totals[k] != null ? totals[k] / logged.length : null;
  return {
    start, days: perDay, album, logged: logged.length,
    plantsAvg: logged.length ? Math.round((logged.reduce((s, d) => s + d.plants, 0) / logged.length) * 10) / 10 : null,
    fiveDays: logged.filter((d) => d.plants >= 5).length,
    legumes: legumeMeals(inWeek), legumesPrev: legumeMeals(prev),
    proteinAvg: logged.length && totals.protein != null ? Math.round(totals.protein / logged.length) : null,
    percent: logged.length ? percentOf(avg, weightKg) : [],
    home: inWeek.filter((m) => m.home).length, out: inWeek.filter((m) => !m.home).length
  };
}

// Entdeckung: der knappste Nährstoff der Woche (unter 80 %) mit Tipp – freundlich, nie als Vorwurf
export function discovery(percent) {
  // Vitamin D (kommt v. a. aus der Sonne) und Jod (v. a. Jodsalz, das hier fehlt) wären immer „knapp“ – die lassen wir aus
  const low = (percent || []).filter((n) => n.pct != null && n.pct < 80 && !['vit_d', 'iodine'].includes(n.key)).sort((a, b) => a.pct - b.pct)[0];
  return low ? { key: low.key, label: low.label, pct: low.pct, tip: TIPS[low.key] } : null;
}

// Standard-Grammzahl für einen Treffer: Gerichte (BLS X/Y) eine Portion, sonst 100 g
export const defaultGrams = (code) => (/^[XY]/.test(code || '') ? 350 : 100);

// Werte je 100 g, die an einer Zutat mitgespeichert werden (damit Favoriten und Verlauf ohne Nachladen auskommen)
export const per100 = (food) => Object.fromEntries(NUTR_KEYS.filter((k) => food[k] != null && food[k] !== '').map((k) => [k, Number(food[k])]));

// Wikipedia-Titel für Pflanzen, wo der Name allein auf die falsche Seite führt
export const PLANT_WIKI = {
  Zwiebel: 'Speisezwiebel', Linse: 'Linse (Botanik)', 'Rote Linse': 'Linse (Botanik)', Soja: 'Sojabohne', Pfeffer: 'Schwarzer Pfeffer',
  Minze: 'Minzen', Gurke: 'Salatgurke', 'Weiße Bohne': 'Gartenbohne', 'Grüne Bohne': 'Gartenbohne', Orange: 'Orange (Frucht)',
  Cashew: 'Cashewnuss', Walnuss: 'Echte Walnuss', Haselnuss: 'Gemeine Hasel', Kürbiskerne: 'Kürbiskern', Sonnenblumenkerne: 'Sonnenblumenkern',
  Champignon: 'Champignons', Sellerie: 'Echter Sellerie', Oliven: 'Olive', Kiwi: 'Kiwifrucht', Melone: 'Wassermelone', Kopfsalat: 'Gartensalat',
  Paprika: 'Paprika', Chili: 'Chili', Weizen: 'Weizen', Kaffee: 'Kaffee', Kakao: 'Kakaobaum', Hafer: 'Saat-Hafer', Gerste: 'Gerste',
  Reis: 'Reis', Mais: 'Mais', Roggen: 'Roggen', Dinkel: 'Dinkel', Koriander: 'Koriander', Kurkuma: 'Kurkuma', Ingwer: 'Ingwer',
  Heidelbeere: 'Heidelbeere', Apfel: 'Kulturapfel', Birne: 'Birne', Kirsche: 'Süßkirsche', Pflaume: 'Pflaume', Erdnuss: 'Erdnuss',
  Mandel: 'Mandel', Lauch: 'Porree', Karotte: 'Karotte', Kartoffel: 'Kartoffel', Tomate: 'Tomate', Spinat: 'Spinat', Mungbohne: 'Mungbohne'
};
export const plantWikiTitle = (name) => PLANT_WIKI[name] || name;
