// Körperwerte (Renpho-Waage): CSV einlesen, Verlauf berechnen. Reine Funktionen, testbar.

import { addDays } from './dates.js';

// Bekannte Spalten. show: 'main' = groß mit Verlauf, 'more' = unter „Weitere Werte“, 'hidden' = gespeichert, nicht angezeigt.
export const FIELDS = [
  { key: 'weight', label: 'Gewicht', unit: 'kg', digits: 1, show: 'main', color: 'purple', names: ['gewicht(kg)', 'weight(kg)', 'gewicht(lb)', 'weight(lb)'] },
  { key: 'fat_pct', label: 'Körperfett', unit: '%', digits: 1, show: 'main', color: 'orange', names: ['körperfettanteil(%)', 'bodyfat(%)', 'body fat(%)'] },
  { key: 'muscle_kg', label: 'Muskelmasse', unit: 'kg', digits: 1, show: 'main', color: 'teal', names: ['muskelmasse(kg)', 'muscle mass(kg)', 'muscle mass(lb)'] },
  { key: 'bmi', label: 'BMI', unit: '', digits: 1, show: 'more', names: ['bmi'] },
  { key: 'fat_kg', label: 'Körperfettmasse', unit: 'kg', digits: 1, show: 'more', names: ['körperfettmasse(kg)', 'fat mass(kg)', 'body fat mass(kg)', 'fat mass(lb)'] },
  { key: 'muscle_pct', label: 'Muskelanteil', unit: '%', digits: 1, show: 'more', names: ['muskelanteil(%)', 'muscle(%)', 'muscle rate(%)'] },
  { key: 'skeletal_kg', label: 'Skelettmuskelmasse', unit: 'kg', digits: 1, show: 'more', names: ['skelettmuskelmasse(kg)', 'skeletal muscle mass(kg)', 'skeletal muscle(kg)', 'skeletal muscle mass(lb)'] },
  { key: 'skeletal_pct', label: 'Skelettmuskelanteil', unit: '%', digits: 1, show: 'more', names: ['skelettmuskelanteil(%)', 'skeletal muscle(%)'] },
  { key: 'lean_kg', label: 'Fettfreie Masse', unit: 'kg', digits: 1, show: 'more', names: ['fettfreies körpergewicht(kg)', 'fat-free body weight(kg)', 'fat-free mass(kg)', 'fat-free body weight(lb)'] },
  { key: 'subcut_pct', label: 'Subkutanes Fett', unit: '%', digits: 1, show: 'more', names: ['subkutanes fett(%)', 'subcutaneous fat(%)'] },
  { key: 'visceral', label: 'Viszeralfett', unit: '', digits: 0, show: 'more', names: ['viszeralfett', 'visceral fat'] },
  { key: 'bmr', label: 'Grundumsatz', unit: 'kcal', digits: 0, show: 'more', names: ['grundumsatz(kcal)', 'bmr(kcal)'] },
  { key: 'whr', label: 'Taille-Hüfte-Verhältnis', unit: '', digits: 2, show: 'more', names: ['whr(taille-hüfte-verhältnis)', 'whr'] },
  { key: 'bone_kg', label: 'Knochenmasse', unit: 'kg', digits: 1, show: 'hidden', names: ['knochenmasse(kg)', 'bone mass(kg)', 'bone mass(lb)'] },
  { key: 'bone_pct', label: 'Knochenanteil', unit: '%', digits: 1, show: 'hidden', names: ['knochenanteil(%)', 'bone mass(%)'] },
  { key: 'protein_kg', label: 'Proteinmasse', unit: 'kg', digits: 1, show: 'hidden', names: ['proteinmasse(kg)', 'protein mass(kg)'] },
  { key: 'protein_pct', label: 'Proteinanteil', unit: '%', digits: 1, show: 'hidden', names: ['proteinanteil(%)', 'protein(%)'] },
  { key: 'water_kg', label: 'Körperwassermasse', unit: 'kg', digits: 1, show: 'hidden', names: ['körperwassermasse(kg)', 'body water mass(kg)'] },
  { key: 'water_pct', label: 'Körperwasseranteil', unit: '%', digits: 1, show: 'hidden', names: ['körperwasseranteil(%)', 'body water(%)'] },
  { key: 'body_age', label: 'Stoffwechselalter', unit: '', digits: 0, show: 'hidden', names: ['stoffwechselalter', 'metabolic age', 'body age'] }
];
const BY_NAME = new Map(FIELDS.flatMap((f) => f.names.map((n) => [n, f])));
const SKIP = /^(nr\.?|no\.?|datum|date|zeitraum|zeit|time|bemerkungen|remarks|notes?)$|optimal|ziel zu|gewichtsstufe|körpertyp|body type|weight level/;

function norm(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')');
}

function splitCsv(line, sep) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(s) {
  const t = String(s ?? '').trim();
  if (!t || t === '--' || t === '-') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function pad(n) { return String(n).padStart(2, '0'); }

// "2026.10.08", "2026-10-08", "2026/10/08", "08.10.2026"
function parseDate(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = t.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]);
    return t.includes('/') && a <= 12 && b > 12 ? [Number(m[3]), a, b] : [Number(m[3]), b, a];
  }
  return null;
}

export function looksLikeRenpho(text) {
  const first = String(text || '').replace(/^﻿/, '').split(/\r?\n/)[0] || '';
  return /gewicht\s*\(|weight\s*\(/i.test(first) && /bmi/i.test(first);
}

// Liefert { measurements, rows, merged } – ein Eintrag pro Tag (die erste vollständige Messung des Tages)
export function parseRenphoCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { measurements: [], rows: 0, merged: 0 };
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const head = splitCsv(lines[0], sep).map(norm);
  const iDate = head.findIndex((h) => h === 'datum' || h === 'date');
  const iTime = head.findIndex((h) => /^(zeitraum|zeit|time)$/.test(h));
  if (iDate < 0) return { measurements: [], rows: 0, merged: 0 };
  const cols = head.map((h, i) => {
    if (i === iDate || i === iTime || !h || SKIP.test(h)) return null;
    const f = BY_NAME.get(h);
    const lb = /\(lb\)$/.test(h);
    return { key: f ? f.key : 'x_' + h.replace(/[^a-z0-9äöüß]+/g, '_').replace(/^_|_$/g, ''), lb };
  });
  const byDay = new Map();
  let rows = 0;
  for (const line of lines.slice(1)) {
    const f = splitCsv(line, sep);
    const d = parseDate(f[iDate]);
    if (!d) continue;
    const tm = String(f[iTime] || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const [h, mi, se] = tm ? [Number(tm[1]), Number(tm[2]), Number(tm[3] || 0)] : [12, 0, 0];
    const vals = {};
    cols.forEach((c, i) => {
      if (!c) return;
      let v = num(f[i]);
      if (v == null) return;
      if (c.lb) v = Math.round(v * 0.453592 * 100) / 100;
      vals[c.key] = v;
    });
    if (vals.weight == null) continue;
    rows += 1;
    const day = `${d[0]}-${pad(d[1])}-${pad(d[2])}`;
    const m = { ext_id: `renpho:${day}`, source: 'renpho', measured_at: new Date(d[0], d[1] - 1, d[2], h, mi, se).toISOString(), day, weight: vals.weight, vals };
    const prev = byDay.get(day);
    const full = (x) => x.vals.fat_pct != null;
    // vollständige Messung schlägt reine Gewichtsmessung, sonst gilt die frühere des Tages
    if (!prev || (full(m) && !full(prev)) || (full(m) === full(prev) && m.measured_at < prev.measured_at)) byDay.set(day, m);
  }
  const measurements = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  return { measurements, rows, merged: rows - measurements.length };
}

export function bodyPreview(parsed, existing) {
  const known = new Set(existing.map((m) => m.ext_id));
  const fresh = parsed.measurements.filter((m) => !known.has(m.ext_id));
  const days = parsed.measurements.map((m) => m.day);
  return { fresh, known: parsed.measurements.length - fresh.length, rows: parsed.rows, merged: parsed.merged, from: days[0] || null, to: days[days.length - 1] || null };
}

export function valueOf(m, key) {
  if (key === 'weight') return m.weight != null ? Number(m.weight) : (m.vals && m.vals.weight != null ? Number(m.vals.weight) : null);
  const v = m.vals ? m.vals[key] : null;
  return v == null ? null : Number(v);
}

// Verlauf ab fromDay: jede Messung + Schnitt der letzten 14 Tage (über alle Messungen, auch vor fromDay)
export function series(list, key, fromDay = '0000-00-00', windowDays = 14) {
  const all = list.map((m) => ({ day: m.day, v: valueOf(m, key) })).filter((p) => p.v != null).sort((a, b) => (a.day < b.day ? -1 : 1));
  const out = [];
  for (let i = 0; i < all.length; i += 1) {
    const p = all[i];
    if (p.day < fromDay) continue;
    const start = addDays(p.day, -(windowDays - 1));
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && all[j].day >= start; j -= 1) { sum += all[j].v; n += 1; }
    out.push({ day: p.day, v: p.v, avg: Math.round((sum / n) * 1000) / 1000 });
  }
  return out;
}

// Änderung des Schnitts im Zeitraum (erster → letzter Punkt)
export function change(points) {
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].avg - points[0].avg) * 100) / 100;
}

// Für die Kachel: letzter Wert + Schnitt der letzten 14 Tage
export function latest(list, key, T) {
  const s = series(list, key);
  if (!s.length) return null;
  const last = s[s.length - 1];
  const from = addDays(T, -13);
  const recent = s.filter((p) => p.day >= from);
  const avg2w = recent.length ? Math.round((recent.reduce((a, p) => a + p.v, 0) / recent.length) * 10) / 10 : null;
  return { day: last.day, v: last.v, avg2w };
}

// Vergleich zur Messung davor (nur Information – schwankt von Tag zu Tag)
export function lastChange(list, key) {
  const s = series(list, key);
  if (s.length < 2) return null;
  const a = s[s.length - 1];
  const b = s[s.length - 2];
  return { day: a.day, prevDay: b.day, delta: Math.round((a.v - b.v) * 100) / 100 };
}
