// Gemeinsame Bausteine: Escaping, Zahlen, Navigation, Leisten, Modul-Schalter.

import { monthShort, parseDay } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { isoWeek } from '../stats.js';
import { mergeTrainings } from '../strength.js';

// Alpha Progression eingeschaltet (und Datenbank-Update 004 da)?
export function alphaOn(S) {
  return !!(S.hasStrengthSchema && S.profile && (S.profile.modules || []).includes('alpha'));
}

// Trainings für alle Ansichten: mit Alpha zusammengeführt, sonst nur Withings
export function trainings(S) {
  if (!alphaOn(S)) return S.workouts;
  if (S._mergedFor !== S.workouts || S._mergedStrength !== S.strength) {
    S._merged = mergeTrainings(S.workouts, S.strength || []);
    S._mergedFor = S.workouts;
    S._mergedStrength = S.strength;
  }
  return S._merged;
}

export function kgTxt(n) {
  return String(Math.round(Number(n) * 100) / 100).replace('.', ',');
}

export function hm(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmt(n) {
  if (n == null || n === '') return '';
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function colorOf(S, h) {
  const cat = S.categories.find((c) => c.id === h.category_id);
  return (cat && cat.color) || h.color || 'blue';
}

export function nav(active) {
  const item = (href, key, icon, label) =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${svg(icon, 22)}${label}</a>`;
  return `<nav class="nav" aria-label="Hauptnavigation"><div class="nav-inner">
    ${item('#/', 'overview', UI_ICONS.home, 'Übersicht')}
    ${item('#/habits', 'habits', UI_ICONS.list, 'Gewohnheiten')}
    ${item('#/profile', 'profile', UI_ICONS.user, 'Profil')}
  </div></nav>`;
}

export function dayShift(T, n) {
  const dt = parseDay(T);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function backBar(href, label) {
  return `<div class="bar"><a class="link-btn" href="${href}">${svg(UI_ICONS.back, 20, 2.2)}${label}</a><span></span></div>`;
}

export function zonesBar(zones) {
  if (!zones) return '';
  const total = zones.reduce((s, z) => s + z.minutes, 0) || 1;
  const cols = ['var(--z0)', 'var(--z1)', 'var(--z2)', 'var(--z3)'];
  return `<div class="zones-bar" aria-hidden="true">${zones.map((z, i) => `<span style="width: ${(z.minutes / total) * 100}%; background: ${cols[i]}"></span>`).join('')}</div>`;
}

export function isoWeekOf(day) {
  return isoWeek(day);
}

export function shortDate(day) {
  const d = parseDay(day);
  return `${d.getDate()}. ${monthShort(day.slice(0, 7))}`;
}

export function bodyOn(S) {
  return !!(S.hasBodySchema && S.profile && (S.profile.modules || []).includes('body'));
}

export function numTxt(n, digits) {
  if (n == null) return '–';
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function ago(iso) {
  if (!iso) return 'noch nie';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Minute${min === 1 ? '' : 'n'}`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Stunde${h === 1 ? '' : 'n'}`;
  const d = Math.round(h / 24);
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
}

export function notFound() {
  return `<div class="app"><div class="wrap" style="padding-top: 60px; text-align: center; gap: 16px">
    <p>Das gibt es (nicht mehr).</p><a class="btn" href="#/">Zur Übersicht</a></div></div>`;
}

export function loading(text = 'Lädt …') {
  return `<div class="loading">${esc(text)}</div>`;
}

export function ladderChips(items) {
  return `<div class="ladder">${items.map((l) => `<span data-state="${l.state}">${esc(l.txt)}</span>`).join('')}</div>`;
}
