import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessPlants, searchPlants, isLegume, nutrOf, percentOf, proteinRef, dayFood, week, discovery, defaultGrams, PLANTS } from '../js/food.js';

test('Pflanzen aus BLS-Namen erraten', () => {
  assert.deepEqual(guessPlants(['Speisezwiebel roh', 'Hafer Flocken', 'Heidelbeere roh']), ['Zwiebel', 'Hafer', 'Heidelbeere']);
  assert.deepEqual(guessPlants(['Rote-Linsensuppe mit Koriander']), ['Rote Linse', 'Koriander']);
  assert.deepEqual(guessPlants(['Flammkuchen Elsässer Art']), ['Weizen']);
  assert.deepEqual(guessPlants(['Salatgurke roh']), ['Gurke'], 'keine falsche „Salat“-Pflanze');
  assert.deepEqual(guessPlants(['Hummus/Kichererbsenmus']), ['Kichererbse']);
  assert.ok(!guessPlants(['Maischbrot']).includes('Mais'));
  assert.equal(new Set(PLANTS.map((p) => p.name)).size, PLANTS.length, 'keine doppelten Namen');
});

test('Pflanzen suchen und Hülsenfrüchte', () => {
  assert.equal(searchPlants('kich')[0].name, 'Kichererbse');
  assert.ok(isLegume('Linse') && isLegume('Soja') && !isLegume('Hafer'));
  assert.deepEqual(searchPlants(''), []);
});

const FOODS = new Map([
  ['C133000', { kcal: 348, protein: 13.22, fiber: 10.983, iron: 4.4366, zinc: 3.6421, vit_c: 0, vit_d: null }],
  ['X934412', { kcal: 233, protein: 8.74, fiber: 1.9, iron: 0.6, zinc: 0.6, vit_c: 1.349 }]
]);

test('Nährwerte: Gramm × Portion, unbekannt bleibt leer', () => {
  const n = nutrOf([{ code: 'C133000', grams: 60 }], FOODS, 1);
  assert.equal(n.kcal, 208.8);
  assert.equal(n.protein, 7.93);
  assert.equal(n.vit_d, null, 'nicht bestimmt ≠ 0');
  const big = nutrOf([{ code: 'X934412', grams: 350 }], FOODS, 1.5);
  assert.equal(big.kcal, 1223.25);
  assert.equal(nutrOf([{ code: 'gibtsnicht', grams: 100 }], FOODS).kcal, null);
});

test('Prozent vom Tagesbedarf, Eiweiß nach Gewicht', () => {
  assert.equal(proteinRef(84), 67);
  assert.equal(proteinRef(null), 57);
  const p = percentOf({ protein: 33.5, iron: 5.5, vit_d: null }, 84);
  assert.equal(p.find((x) => x.key === 'protein').pct, 50);
  assert.equal(p.find((x) => x.key === 'iron').pct, 50);
  assert.equal(p.find((x) => x.key === 'vit_d').pct, null);
});

const meal = (day, plants, protein, home = false, at = '12:00') => ({ day, at: `${day}T${at}:00Z`, plants, home, nutr: { protein, iron: 3, zinc: 2 } });

test('Tag und Woche: Sammelalbum, 5 am Tag, Hülsenfrüchte, selbst gekocht', () => {
  const meals = [
    meal('2026-10-19', ['Hafer', 'Heidelbeere', 'Walnuss'], 15, true, '08:00'),
    meal('2026-10-19', ['Linse', 'Zwiebel', 'Tomate'], 25, true, '19:00'),
    meal('2026-10-20', ['Hafer', 'Apfel'], 12, false),
    meal('2026-10-14', ['Kichererbse'], 20, true) // Vorwoche
  ];
  const d = dayFood(meals, '2026-10-19');
  assert.equal(d.plants.length, 6);
  assert.equal(d.protein, 40);
  const w = week(meals, '2026-10-21', 84);
  assert.deepEqual(w.album, ['Hafer', 'Heidelbeere', 'Walnuss', 'Linse', 'Zwiebel', 'Tomate', 'Apfel']);
  assert.equal(w.logged, 2);
  assert.equal(w.plantsAvg, 4);
  assert.equal(w.fiveDays, 1);
  assert.equal(w.legumes, 1);
  assert.equal(w.legumesPrev, 1);
  assert.equal(w.proteinAvg, 26);
  assert.equal(w.home, 2);
  assert.equal(w.out, 1);
  assert.equal(w.days[3].future, true);
  const iron = w.percent.find((x) => x.key === 'iron');
  assert.equal(iron.pct, Math.round((4.5 / 11) * 100));
  const disc = discovery(w.percent);
  assert.equal(disc.key, 'zinc'); // 3/14 ≈ 21 % < Eisen 41 %
  assert.ok(disc.tip.includes('Kürbiskerne'));
});

test('Standard-Gramm: Gerichte eine Portion', () => {
  assert.equal(defaultGrams('X934412'), 350);
  assert.equal(defaultGrams('G480100'), 100);
});

import { searchTerms, rankFoods, offToFood } from '../js/food.js';

test('Suche: Wörter, Mehrzahl, Synonyme', () => {
  assert.deepEqual(searchTerms('Handkäse'), [['sauermilchkäse']]);
  assert.deepEqual(searchTerms('Linsen'), [['lins']]);
  assert.deepEqual(searchTerms('Brötchen Dinkel'), [['brötch'], ['dinkel']]);
  assert.deepEqual(searchTerms('Zwiebeln'), [['zwiebel']]);
  assert.deepEqual(searchTerms('Eier'), [['hühnerei']]);
  assert.deepEqual(searchTerms('Käse'), [['käse']]);
  assert.deepEqual(searchTerms('  '), []);
  const rows = [{ name: 'Linsensuppe mit Gemüse' }, { name: 'Linse rot, getrocknet' }, { name: 'Linse braun roh' }];
  assert.equal(rankFoods(rows, searchTerms('linsen'))[0].name, 'Linse braun roh');
});

test('Open Food Facts → Lebensmittel', () => {
  const f = offToFood({ code: '4000417025005', product_name_de: 'Harzer Käse', brands: 'Loose, Gutes', serving_quantity: '40',
    ingredients_text_de: 'Sauermilchquark, Speisesalz, Kümmel',
    nutriments: { 'energy-kcal_100g': 115, proteins_100g: 27, fat_100g: 0.5, salt_100g: 4.5, calcium_100g: 0.125, 'vitamin-b12_100g': 0.0000012 } });
  assert.equal(f.code, 'off:4000417025005');
  assert.equal(f.brand, 'Loose');
  assert.equal(f.kcal, 115);
  assert.equal(f.calcium, 125, 'g → mg');
  assert.equal(f.vit_b12, 1.2, 'g → µg');
  assert.equal(f.iron, null, 'fehlt → unbekannt');
  assert.equal(f.serving, 40);
  assert.equal(offToFood({ code: '1', product_name: '' }), null);
  assert.equal(offToFood({ code: '2', product_name: 'X', nutriments: { energy_100g: 418.4 } }).kcal, 100);
});

import { macroSplit } from '../js/food.js';

test('Ring: Kohlenhydrate, Eiweiß, Fett nach Energie, Summe 100', () => {
  const m = macroSplit({ carbs: 50, protein: 25, fat: 10 }); // 200 / 100 / 90 kcal
  assert.deepEqual(m.map((x) => [x.key, x.g, x.pct]), [['carbs', 50, 51], ['protein', 25, 26], ['fat', 10, 23]]);
  assert.equal(m.reduce((s, x) => s + x.pct, 0), 100);
  assert.equal(macroSplit({ carbs: 0, protein: 0, fat: 0 }), null);
  assert.equal(macroSplit(null), null);
  assert.equal(macroSplit({ protein: 10, carbs: null, fat: null })[1].pct, 100);
});
