import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRenphoCsv, bodyPreview, series, change, latest, lastChange, looksLikeRenpho, valueOf, FIELDS } from '../js/body.js';

// Ausschnitt im echten Renpho-Format (Kopfzeile gekürzt auf die echten Spaltennamen)
const HEAD = 'Nr.,Datum,Zeitraum,Gewicht(kg),BMI,Körperfettanteil(%),Körperfettmasse(kg),Muskelanteil(%),Muskelmasse(kg),Skelettmuskelanteil(%),Skelettmuskelmasse(kg),Knochenanteil(%),Knochenmasse(kg),Proteinanteil(%),Proteinmasse(kg),Körperwasseranteil(%),Körperwassermasse(kg),Fettfreies Körpergewicht(kg),Subkutanes Fett(%),Viszeralfett,Grundumsatz(kcal),Stoffwechselalter,WHR (Taille-Hüfte-Verhältnis),Optimales Gewicht(kg),Gewichtsstufe,Körpertyp,Ziel zum optimalen Gewicht(kg),Ziel zur optimalen Muskelmasse(kg),Ziel zur optimalen Fettmasse(kg),Bemerkungen,';
const CSV = '﻿' + [
  HEAD,
  '1,2026.10.08,07:02:13,83.35,27.2,27.8,23.17,68.6,57.18,46.5,38.76,3.6,3.00,16.5,13.75,52.1,43.43,60.18,24.6,10,1665,39,--,--,--,--,--,--,--,,',
  '2,2026.10.05,06:54:50,81.20,26.5,27.0,21.92,69.4,56.35,47.0,38.16,3.6,2.93,16.6,13.48,52.7,42.79,59.28,24.0,9,1635,38,--,--,--,--,--,--,--,,',
  '3,2026.10.04,20:56:31,81.20,26.5,27.0,21.92,69.4,56.35,47.0,38.16,3.6,2.93,16.6,13.48,52.7,42.79,59.28,24.0,9,1635,38,--,--,--,--,--,--,--,--,',
  '4,2025.11.06,07:07:36,77.20,25.2,25.4,19.61,70.9,54.73,48.1,37.13,3.7,2.86,17.0,13.12,53.9,41.61,57.59,22.7,8,1605,36,--,--,--,--,--,--,--,--,',
  '5,2025.11.06,07:07:18,77.20,25.2,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,',
  '6,2025.11.06,07:07:14,77.30,25.2,25.4,19.61,70.9,54.73,48.1,37.13,3.7,2.86,17.0,13.12,53.9,41.61,57.59,22.7,8,1605,36,--,--,--,--,--,--,--,--,',
  '7,2025.05.02,07:58:36,78.65,25.7,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,--,,'
].join('\r\n');

test('Renpho-CSV: ein Eintrag pro Tag, alle Spalten gespeichert', () => {
  assert.equal(looksLikeRenpho(CSV), true);
  assert.equal(looksLikeRenpho('"Oberkörper";"2026-10-09 7:42 Uhr";"18 Min."'), false);
  const p = parseRenphoCsv(CSV);
  assert.equal(p.rows, 7);
  assert.equal(p.measurements.length, 5);
  assert.equal(p.merged, 2);
  const [may, nov, oct4, , oct8] = p.measurements;
  assert.deepEqual(may.vals, { weight: 78.65, bmi: 25.7 }, 'nur Gewicht → reine Gewichtsmessung');
  assert.equal(nov.weight, 77.3, 'früheste vollständige Messung des Tages');
  assert.equal(nov.ext_id, 'renpho:2025-11-06');
  assert.equal(oct4.day, '2026-10-04');
  assert.equal(new Date(oct8.measured_at).getHours(), 7);
  assert.deepEqual(
    [oct8.vals.weight, oct8.vals.fat_pct, oct8.vals.muscle_kg, oct8.vals.visceral, oct8.vals.bmr, oct8.vals.body_age, oct8.vals.water_pct, oct8.vals.lean_kg],
    [83.35, 27.8, 57.18, 10, 1665, 39, 52.1, 60.18]
  );
  assert.equal(oct8.vals.whr, undefined, '-- bleibt leer');
  assert.equal(Object.keys(oct8.vals).some((k) => k.startsWith('x_')), false, 'alle Spalten erkannt, Ziel-/Optimal-Spalten übersprungen');
});

test('Englische Spalten, Semikolon und Pfund', () => {
  const p = parseRenphoCsv('Date;Time;Weight(lb);BMI;Body Fat(%)\n2026/10/08;07:02;183.8;27.2;27.8\n');
  assert.equal(p.measurements.length, 1);
  assert.equal(p.measurements[0].weight, 83.37);
  assert.equal(p.measurements[0].vals.fat_pct, 27.8);
});

test('Import-Vorschau überspringt bekannte Tage', () => {
  const p = parseRenphoCsv(CSV);
  const v = bodyPreview(p, [{ ext_id: 'renpho:2026-10-08' }]);
  assert.equal(v.fresh.length, 4);
  assert.equal(v.known, 1);
  assert.equal(v.from, '2025-05-02');
  assert.equal(v.to, '2026-10-08');
});

test('Verlauf mit 2-Wochen-Schnitt, Änderung, letzter Wert', () => {
  const list = [
    { day: '2026-09-01', weight: 80, vals: { fat_pct: 26 } },
    { day: '2026-09-10', weight: 82, vals: { fat_pct: 27 } },
    { day: '2026-09-20', weight: 84, vals: {} },
    { day: '2026-10-01', weight: 83, vals: { fat_pct: 28 } }
  ];
  const s = series(list, 'weight', '2026-09-10');
  assert.deepEqual(s.map((p) => [p.day, p.v, p.avg]), [['2026-09-10', 82, 81], ['2026-09-20', 84, 83], ['2026-10-01', 83, 83.5]]);
  assert.equal(change(s), 2.5);
  assert.equal(series(list, 'fat_pct').length, 3, 'fehlende Werte werden übersprungen');
  assert.deepEqual(latest(list, 'weight', '2026-10-05'), { day: '2026-10-01', v: 83, avg2w: 83 });
  assert.equal(valueOf(list[2], 'fat_pct'), null);
  assert.deepEqual(lastChange(list, 'weight'), { day: '2026-10-01', prevDay: '2026-09-20', delta: -1 });
  assert.deepEqual(lastChange(list, 'fat_pct'), { day: '2026-10-01', prevDay: '2026-09-10', delta: 1 }, 'Tage ohne den Wert werden übersprungen');
  assert.equal(lastChange(list.slice(0, 1), 'weight'), null);
  assert.ok(FIELDS.filter((f) => f.show === 'main').length === 3);
});
