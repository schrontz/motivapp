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
  ['Kurkuma', 'Kräuter & Gewürze', ['kurkuma']], ['Kreuzkümmel', 'Kräuter & Gewürze', ['kreuzkümmel', 'cumin']], ['Kümmel', 'Kräuter & Gewürze', ['kümmel']], ['Zimt', 'Kräuter & Gewürze', ['zimt']],
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
    avg: logged.length ? avg : null,
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
export const defaultGrams = (code, serving = null) => (serving || (/^[XY]/.test(code || '') ? 350 : 100));

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

// ───────────── Suche im BLS ─────────────
// Mehrere Wörter in beliebiger Reihenfolge, Mehrzahl → Wortstamm, Alltagswörter → BLS-Namen.
// Ergebnis: je Wort eine Liste von Alternativen (eine davon muss im Namen vorkommen).
const SYNONYMS = {
  handkäse: ['sauermilchkäse'], harzer: ['sauermilchkäse'], mainzer: ['sauermilchkäse'], quargel: ['sauermilchkäse'],
  nudel: ['teigwaren', 'nudel'], nudeln: ['teigwaren', 'nudel'], pasta: ['teigwaren', 'pasta'],
  ei: ['hühnerei'], eier: ['hühnerei'], spiegelei: ['hühnerei'], rührei: ['rührei', 'hühnerei'],
  äpfel: ['apfel'], semmel: ['brötchen', 'semmel'], semmeln: ['brötchen', 'semmel'], schrippe: ['brötchen'],
  bulette: ['frikadelle', 'bulette'], buletten: ['frikadelle', 'bulette'], fleischpflanzerl: ['frikadelle'],
  pommes: ['pommes'], fritten: ['pommes'], haferflocken: ['hafer flocken', 'haferflocken'], müsli: ['müsli', 'muesli'],
  joghurt: ['joghurt', 'jogurt'], quark: ['quark'], frischkäse: ['frischkäse'], milch: ['milch'], brot: ['brot']
};
export function searchTerms(q) {
  const words = String(q || '').toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
  return words.map((w) => {
    if (SYNONYMS[w]) return SYNONYMS[w];
    // Mehrzahl/Endungen kürzen: „linsen“ → „lins“, „zwiebeln“ → „zwiebel“ – findet dann „Linse“, „Zwiebel“
    const stem = w.length >= 5 ? w.replace(/(en|n|e|s)$/, '') : w;
    return [stem.length >= 3 ? stem : w];
  });
}

// Reihenfolge der Treffer: alle Wörter am Wortanfang vor „irgendwo“, rohe Lebensmittel vor Zubereitetem, kurze Namen zuerst
export function rankFoods(rows, terms) {
  const score = (f) => {
    const n = String(f.name || '').toLowerCase();
    const words = n.split(/[^a-zäöüß]+/);
    let s = 0;
    for (const alts of terms) if (!alts.some((a) => words.some((w) => w.startsWith(a)))) s += 1;
    if (!/\broh\b/.test(n)) s += 0.5;
    return s + n.length / 200;
  };
  return [...rows].sort((a, b) => score(a) - score(b));
}

// ───────────── Open Food Facts ─────────────
// Produkt (Felder wie von OFF) → Lebensmittel mit Werten je 100 g. Mineralstoffe und Vitamine speichert OFF in g → umrechnen.
const OFF_MAP = [
  ['kcal', 'energy-kcal_100g', 1], ['protein', 'proteins_100g', 1], ['fat', 'fat_100g', 1], ['carbs', 'carbohydrates_100g', 1],
  ['fiber', 'fiber_100g', 1], ['sugar', 'sugars_100g', 1], ['salt', 'salt_100g', 1],
  ['iron', 'iron_100g', 1000], ['zinc', 'zinc_100g', 1000], ['magnesium', 'magnesium_100g', 1000], ['calcium', 'calcium_100g', 1000],
  ['potassium', 'potassium_100g', 1000], ['vit_c', 'vitamin-c_100g', 1000], ['folate', 'folates_100g', 1e6],
  ['vit_b12', 'vitamin-b12_100g', 1e6], ['vit_d', 'vitamin-d_100g', 1e6], ['iodine', 'iodine_100g', 1e6]
];
export function offToFood(p) {
  if (!p || !p.code) return null;
  const n = p.nutriments || {};
  const name = (p.product_name_de || p.product_name || '').trim();
  if (!name) return null;
  const food = { code: 'off:' + p.code, name, brand: (p.brands || '').split(',')[0].trim(), source: 'off', ingredients: p.ingredients_text_de || p.ingredients_text || '' };
  for (const [k, field, f] of OFF_MAP) {
    const v = Number(n[field]);
    food[k] = Number.isFinite(v) && n[field] !== '' && n[field] != null ? Math.round(v * f * 1000) / 1000 : null;
  }
  if (food.kcal == null && Number.isFinite(Number(n['energy_100g']))) food.kcal = Math.round(Number(n['energy_100g']) / 4.184);
  const sq = Number(p.serving_quantity);
  food.serving = Number.isFinite(sq) && sq > 0 && sq <= 1000 ? Math.round(sq) : null;
  return food;
}

// ───────────── Kohlenhydrate, Eiweiß, Fett ─────────────
// Aufteilung nach Energie (4 / 4 / 9 kcal je g) – ohne Wertung, nur wie sich die Mahlzeit zusammensetzt
export const MACROS = [
  { key: 'carbs', label: 'Kohlenhydrate', kcalPerG: 4 },
  { key: 'protein', label: 'Eiweiß', kcalPerG: 4 },
  { key: 'fat', label: 'Fett', kcalPerG: 9 }
];
export function macroSplit(nutr) {
  if (!nutr) return null;
  const parts = MACROS.map((m) => {
    const g = Number(nutr[m.key]);
    return { ...m, g: Number.isFinite(g) && g > 0 ? g : 0 };
  });
  const total = parts.reduce((s, p) => s + p.g * p.kcalPerG, 0);
  if (!(total > 0)) return null;
  const out = parts.map((p) => ({ ...p, g: Math.round(p.g), pct: Math.round(((p.g * p.kcalPerG) / total) * 100) }));
  // Rundung: Summe genau 100 (Rest beim größten Anteil)
  const diff = 100 - out.reduce((s, p) => s + p.pct, 0);
  if (diff) out.reduce((a, b) => (b.pct > a.pct ? b : a)).pct += diff;
  return out;
}

// ───────────── Übergabe aus Skillet ─────────────
// Skillet öffnet  …/motivapp/#/essen-neu/s1.<base64url(JSON)>  mit
//   { v: 1, t: 'Linsencurry', p: 4, z: [['G480100', 300, 'Zwiebeln'], …] }   (Gramm fürs ganze Rezept, p = Portionen)
// Motivator rechnet daraus eine Portion und alle Nährwerte selbst (gleicher BLS 4.0).
export function skilletDecode(payload) {
  try {
    const m = /^s1\.([A-Za-z0-9_-]+)$/.exec(String(payload || ''));
    if (!m) return null;
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((m[1].length + 3) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || data.v !== 1 || !Array.isArray(data.z)) return null;
    const portions = Math.max(1, Math.min(50, Number(data.p) || 1));
    const items = data.z
      .filter((z) => Array.isArray(z) && /^[A-Z][0-9A-Z]{3,10}$/.test(String(z[0])) && Number(z[1]) > 0)
      .slice(0, 60)
      .map((z) => ({ code: String(z[0]), grams: Math.max(1, Math.round(Number(z[1]) / portions)), name: String(z[2] || '').slice(0, 80) }));
    if (!items.length) return null;
    return { name: String(data.t || 'Aus Skillet').slice(0, 80), portions, items };
  } catch {
    return null;
  }
}
