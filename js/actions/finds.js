// Aktionen: Fundstücke – Buchstaben aufdecken, finden, weiterwandern oder abzweigen.

import * as db from '../db.js';
import { S, render, persist, toast, go } from '../core.js';
import { letterCount, earnedOn, rollover, revealed, pickOptions, branchCandidates } from '../finds.js';
import { addDays } from '../dates.js';
import { wikiTitle, activeGoal, reachedGoals } from '../distance.js';
import { plantWikiTitle } from '../food.js';
import { categoryName } from '../auto.js';

const byCreated = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0);
export const openFind = (S) => (S.finds || []).find((f) => !f.found_day) || null;
export const foundFinds = (S) => (S.finds || []).filter((f) => f.found_day).sort(byCreated);
export const latestFound = (S) => { const l = foundFinds(S); return l[l.length - 1] || null; };
export const earnedFor = (title) => (d) => earnedOn(S.habits, S.idx, S.pauses, d, letterCount(title));
export const revealedNow = (f, T) => revealed(f, T, earnedFor(f.title));

let creating = false;
let retryAt = 0; // offline: nicht bei jedem Neuzeichnen erneut versuchen
const loadingOptions = new Set();

// Wird bei jedem Darstellen aufgerufen: abgeschlossene Tage übernehmen, Fund erkennen, Nächstes anlegen
export function tick(T) {
  if (!S.loaded || !S.hasFindSchema || creating) return;
  const open = openFind(S);
  if (!open) {
    if (mayCreate(T) && Date.now() >= retryAt) createNext(T);
    return;
  }
  const r = rollover(open, T, earnedFor(open.title));
  if (r.changed) {
    open.base = r.base;
    open.base_day = r.base_day;
    persist(() => db.updateFind(open.id, { base: r.base, base_day: r.base_day }));
  }
  if (revealedNow(open, T) >= letterCount(open.title)) complete(open, T);
}

// Nächstes erst, wenn heute gewählt oder weitergeklickt wurde – oder ab morgen
function mayCreate(T) {
  const last = latestFound(S);
  if (!last) return true;
  return !!last.chosen || last.found_day < T || S.findReleased === last.id;
}

function complete(f, T) {
  f.found_day = T;
  S.findCelebrate = f.id;
  persist(() => db.updateFind(f.id, { found_day: T }));
  ensureDetails(f);
}

// Fehlender Text (offline angelegt) und Ziele für „Wohin geht es weiter?“ nachladen
export async function ensureDetails(f) {
  if (!f || loadingOptions.has(f.id)) return;
  const needsText = !f.extract;
  const needsOptions = f.found_day && !(f.options || []).length && f === latestFound(S);
  if (!needsText && !needsOptions) return;
  loadingOptions.add(f.id);
  const patch = {};
  try {
    if (needsText) {
      const s = await db.findSummary(f.title);
      if (s) Object.assign(patch, summaryFields(s, f));
    }
    if (needsOptions) {
      const used = new Set((S.finds || []).map((x) => x.title));
      patch.options = pickOptions(await db.wikiLinks(f.title), used);
    }
  } catch (err) {
    console.warn('Fundstück: Wikipedia nicht erreichbar', err);
  }
  if (Object.keys(patch).length) {
    Object.assign(f, patch);
    render();
    await persist(() => db.updateFind(f.id, patch));
  }
  loadingOptions.delete(f.id);
}

function summaryFields(s, fallback = {}) {
  return {
    description: s.description || fallback.description || '',
    extract: s.extract || fallback.extract || '',
    image: (s.thumbnail && s.thumbnail.source) || fallback.image || null,
    url: (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || fallback.url || null
  };
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Kandidaten in Reihenfolge: deine Wahl → Abzweig aus deinen Bereichen → zufällig weiterwandern → Start
async function candidates(T) {
  const used = new Set((S.finds || []).map((f) => f.title));
  const last = latestFound(S);
  const out = [];
  let walk = [];
  if (last) {
    let opts = last.options || [];
    if (!opts.length) {
      try {
        opts = pickOptions(await db.wikiLinks(last.title), used, 6);
        last.options = opts.slice(0, 3);
        persist(() => db.updateFind(last.id, { options: last.options }));
      } catch (err) { console.warn('Fundstück: Links nicht erreichbar', err); }
    }
    walk = opts.filter((o) => !used.has(o.title)).map((o) => ({ ...o, source: 'walk', origin: `über „${last.title}“` }));
  }
  const chosen = last && last.chosen ? walk.find((o) => o.title === last.chosen) : null;
  if (chosen) out.push(chosen);
  const branch = branchCandidates({ travel: S.travel, meals: S.meals, strength: S.strength, workouts: S.workouts }, addDays(T, -14), used, { wikiTitle, plantWikiTitle, categoryName });
  out.push(...branch.map((b) => ({ title: b.title, source: 'branch', origin: b.origin, area: b.area })));
  out.push(...shuffle(walk.filter((o) => o !== chosen)));
  if (!last) {
    const g = reachedGoals(S.travel)[0] || activeGoal(S.travel);
    const city = g ? g.city : (S.distStart || 'Frankfurt am Main');
    out.push({ title: wikiTitle(city), source: 'start', origin: g && g.reached_on ? 'Start · dein erreichtes Reiseziel' : 'Start · deine Strecke' });
  }
  return out;
}

export async function createNext(T) {
  if (creating || openFind(S)) return;
  creating = true;
  try {
    const list = await candidates(T);
    const taken = new Set((S.finds || []).map((f) => f.title.toLowerCase()));
    let row = null;
    for (const c of list.slice(0, 8)) {
      let s = null;
      try { s = await db.findSummary(c.title); } catch (err) {
        // offline: mit Titel und Beschreibung anlegen, Text kommt beim Finden
        if (c.description) { row = { title: c.title, description: c.description, extract: '', image: null, url: null }; } else continue;
      }
      if (!row) {
        if (!s || s.type === 'disambiguation' || !s.extract) continue;
        const title = s.title || c.title;
        if (taken.has(title.toLowerCase())) continue;
        row = { title, ...summaryFields(s, c) };
      }
      row = { ...row, source: c.source, origin: c.origin };
      break;
    }
    if (!row) { retryAt = Date.now() + 60000; return; }
    // Was heute schon abgehakt ist, gehörte dem vorigen Fundstück – das neue startet bei 0 (das allererste bekommt den Tag geschenkt)
    row.base = (S.finds || []).length ? -earnedFor(row.title)(T) : 0;
    row.base_day = T;
    row.created_day = T;
    row.options = [];
    const saved = await persist(() => db.addFind(row));
    if (saved && !openFind(S)) S.finds = (S.finds || []).concat(saved);
  } finally {
    creating = false;
    render();
  }
}

export const clicks = {
  // „Wohin geht es weiter?“ – nach Beschreibung gewählt, der Titel bleibt ein Rätsel
  'find-choose': async ({ id, el, T }) => {
    const f = (S.finds || []).find((x) => x.id === el.dataset.find);
    if (!f || openFind(S)) return;
    f.chosen = id;
    S.findReleased = f.id;
    render();
    toast('Gemerkt – den Titel spielst du dir frei.');
    await persist(() => db.updateFind(f.id, { chosen: id }));
    await createNext(T);
  },
  'find-done': async ({ id, T }) => {
    S.findCelebrate = null;
    S.findReleased = id;
    go('#/');
    await createNext(T);
  },
  'find-celebrate-ok': () => { S.findCelebrate = null; render(); }
};
