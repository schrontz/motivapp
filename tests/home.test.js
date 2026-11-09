import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeOrder, moveBlock, homeTiles, toggleTile, groupToday, nameHint, DEFAULT_ORDER } from '../js/home.js';

test('Reihenfolge: leer = Standard, Unbekanntes (alte Blöcke) raus, Neues an seinen Platz', () => {
  assert.deepEqual(homeOrder(null), DEFAULT_ORDER);
  // fehlendes hinter seinen Standard-Vorgänger: Fundstück hinter Rauchen, Alkohol hinter Essen
  assert.deepEqual(homeOrder(['heute', 'essen', 'rings', 'weniger', 'quatsch']), ['essen', 'alkohol', 'weniger', 'fund']);
});

test('Verschieben springt über Ausgeblendetes', () => {
  const visible = new Set(['weniger', 'fund', 'essen']); // Alkohol aus
  assert.deepEqual(moveBlock(null, visible, 'essen', -1), ['weniger', 'essen', 'fund', 'alkohol']);
  assert.deepEqual(moveBlock(null, visible, 'weniger', -1), DEFAULT_ORDER, 'oben bleibt oben');
});

test('Kacheln: Standard = erste drei sichtbaren, eigene Wahl höchstens drei', () => {
  const all = new Set(DEFAULT_ORDER);
  assert.deepEqual(homeTiles(null, all, null), ['weniger', 'fund', 'essen']);
  assert.deepEqual(homeTiles(null, new Set(['fund', 'alkohol']), null), ['fund', 'alkohol']);
  assert.deepEqual(homeTiles(['essen', 'weniger', 'fund', 'alkohol'], all, ['fund', 'essen']), ['essen', 'fund'], 'in Reihenfolge');
  assert.deepEqual(homeTiles(null, all, []), [], 'bewusst keine');
  // an/aus
  assert.deepEqual(toggleTile(null, all, null, 'fund'), ['weniger', 'essen']);
  assert.equal(toggleTile(null, all, null, 'alkohol'), null, 'schon drei');
  assert.deepEqual(toggleTile(null, all, ['weniger'], 'alkohol'), ['weniger', 'alkohol']);
});

test('Heute aufteilen: Jetzt nach Uhrzeit, Später ab 90 Min., Erledigt/Pause unten', () => {
  const it = (name, extra = {}) => ({ habit: { id: name, name }, hit: false, paused: false, period: null, ...extra });
  const usual = { Sport: 460, Hautpflege: 450, Duolingo: 1290, Liegestuetze: 1030, Lesen: null };
  const items = [it('Duolingo'), it('Sport'), it('Lesen'), it('Liegestuetze'), it('Hautpflege'), it('Wasser', { hit: true }), it('Laufen', { period: { state: 'goal' } }), it('Yoga', { paused: true })];
  const g = groupToday(items, (h) => usual[h.id] ?? null, 450); // 7:30
  assert.deepEqual(g.now.map((e) => e.item.habit.id), ['Hautpflege', 'Sport', 'Lesen']);
  assert.deepEqual(g.later.map((e) => e.item.habit.id), ['Liegestuetze', 'Duolingo']);
  assert.deepEqual(g.done.map((e) => e.item.habit.id), ['Wasser', 'Laufen', 'Yoga']);
  // abends: Überfälliges vom Morgen bleibt in „Jetzt“
  const e = groupToday(items, (h) => usual[h.id] ?? null, 1200);
  assert.deepEqual(e.now.map((x) => x.item.habit.id), ['Hautpflege', 'Sport', 'Liegestuetze', 'Duolingo', 'Lesen']);
  assert.equal(e.later.length, 0);
});

test('Ohne gelernte Zeit: Name verrät die Tageszeit, Automatisches ans Ende von „Jetzt“', () => {
  assert.equal(nameHint('Skincare Abends'), 1200);
  assert.equal(nameHint('Skincare morgens'), 420);
  assert.equal(nameHint('Spaziergang Nachmittag'), 960);
  assert.equal(nameHint('Lesen'), null);
  const it = (name, extra = {}) => ({ habit: { id: name, name, ...extra }, hit: false, paused: false, period: null });
  const items = [it('Schritte', { auto_metric: 'steps' }), it('Skincare Abends'), it('Skincare morgens'), it('Gehirntraining')];
  const g = groupToday(items, () => null, 10 * 60 + 35); // 10:35 wie auf Jans Bild
  assert.deepEqual(g.now.map((e) => e.item.habit.id), ['Skincare morgens', 'Gehirntraining', 'Schritte']);
  assert.deepEqual(g.later.map((e) => e.item.habit.id), ['Skincare Abends']);
  assert.equal(g.later[0].usual, null, 'Hinweis aus dem Namen wird nicht als „meist gegen“ angezeigt');
  // abends rutscht es nach „Jetzt“
  assert.deepEqual(groupToday(items, () => null, 19 * 60).now.map((e) => e.item.habit.id), ['Skincare morgens', 'Skincare Abends', 'Gehirntraining', 'Schritte']);
});
