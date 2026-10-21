// „Alkoholfrei“: Karte auf der Übersicht, Bereich, Einrichten, Fenster „Getrunken“.
// Grün statt Rot: Alkoholfreie Tage wachsen nur, ein Biertag nimmt nichts weg.

import { KIND, TAGS, costsOf, freeDays, goalFor, weeks, weekDays, savings, patterns, dayAfter } from '../alcohol.js';
import { restValues } from '../pulse.js';
import { WEEKDAYS_SHORT } from '../dates.js';
import { svg } from '../icons.js';
import { backBar, esc, nav, numTxt, shortDate } from './ui.js';

export function alcoholOn(S) {
  return !!(S.hasReduceSchema && S.profile && (S.profile.modules || []).includes('alkohol'));
}

const euro = (v) => `${numTxt(v, 2)} €`;
const GLASS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10l-1 9a4 4 0 0 1-8 0L7 3z"></path><path d="M12 16v5M8 21h8"></path></svg>';

export function alcoholState(S, T) {
  const settings = (S.reduceSettings || []).find((r) => r.kind === KIND) || null;
  if (!settings) return { settings: null };
  const events = (S.reduceEvents || []).filter((e) => e.kind === KIND && !e.cancelled);
  return {
    settings, events, c: costsOf(settings),
    free: freeDays(events, settings, T),
    goal: goalFor(settings, T),
    weeks: weeks(events, settings, T),
    days: weekDays(events, settings, T),
    saved: savings(events, settings, T),
    week: Math.max(1, weeks(events, settings, T).length)
  };
}

function weekStrip(st, T) {
  const cur = st.weeks[st.weeks.length - 1] || { free: 0, days: 0 };
  const cells = st.days.map((d, i) => `<span class="alc-day" data-state="${d.state}"><span></span><small>${WEEKDAYS_SHORT[i]}</small></span>`).join('');
  const todayDrink = st.days.some((d) => d.state === 'drink' && d.day === T);
  const runs = st.days.some((d) => d.state === 'today');
  const tail = runs ? ' · heute läuft noch' : (todayDrink ? ' · heute mit Bier – zählt einfach nicht mit' : '');
  return `<div class="alc-week" role="img" aria-label="Diese Woche ${cur.free} von ${cur.days} Tagen alkoholfrei">${cells}</div>
    <div class="small muted">Diese Woche ${cur.free} von ${cur.days} alkoholfrei${tail} · Ziel ${st.goal} von 7</div>`;
}

function undoLink(S) {
  return S.drinkUndo ? '<button type="button" class="link-btn" data-action="alc-undo">Gezählt · Rückgängig</button>' : '';
}

// ───────────── Karte auf der Übersicht ─────────────

export function alcoholCard(S, T) {
  if (!alcoholOn(S)) return '';
  const st = alcoholState(S, T);
  if (!st.settings) {
    return `<section class="card pad reduce-card">
      <div class="reduce-head"><span class="reduce-ico">${GLASS}</span><b>Alkoholfrei</b></div>
      <p class="small muted">Ab heute zählen die alkoholfreien Tage – ganz von selbst. Nur wenn du doch mal trinkst, tippst du auf „Getrunken“.</p>
      <button type="button" class="btn" data-action="alc-start" style="height: 48px; font-size: 16px; background: var(--c-teal)">Los geht's</button>
    </section>`;
  }
  if (st.settings.show_card === false) return '';
  return `<section class="card pad reduce-card">
    <a class="reduce-head" href="#/alkohol"><span class="reduce-ico">${GLASS}</span><b style="flex: 1">Alkoholfrei</b><span class="small muted">gespart <b style="color: var(--c-teal)">${euro(st.saved.euro)}</b></span></a>
    <div class="alc-big"><b>${st.free}</b><span class="muted">alkoholfreie ${st.free === 1 ? 'Tag' : 'Tage'} seit Start</span></div>
    ${weekStrip(st, T)}
    <button type="button" class="btn ghost reduce-btn" data-action="alc-open">Getrunken</button>
    ${undoLink(S)}
  </section>`;
}

// ───────────── Fenster „Getrunken“ ─────────────

export function alcoholSheet(S) {
  const d = S.drinkSheet;
  if (!d) return '';
  const chips = TAGS.map((t) => `<button type="button" class="chip" data-action="alc-tag" data-id="${esc(t)}" aria-pressed="${d.tags.includes(t)}">${esc(t)}</button>`).join('');
  return `<button type="button" class="scrim" data-action="alc-close" aria-label="Schließen"></button>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="Getrunken">
    <div class="handle"></div>
    <div style="display: flex; justify-content: space-between; align-items: center">
      <h2 style="font-size: 22px">Getrunken</h2>
      <button type="button" class="goal-del" data-action="alc-close" aria-label="Schließen" style="border: 0">${svg('M6 6l12 12M18 6L6 18', 20)}</button>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center">
      <b style="font-size: 16px">Wie viele Bier?</b>
      <div style="display: flex; align-items: center; gap: 10px">
        <button type="button" class="mini-round" data-action="alc-qty" data-id="-1" aria-label="Eins weniger">−</button>
        <b style="min-width: 28px; text-align: center; font-size: 24px">${d.qty}</b>
        <button type="button" class="mini-round" data-action="alc-qty" data-id="1" aria-label="Eins mehr">+</button>
      </div>
    </div>
    <div>
      <div><b style="font-size: 16px">Was war los?</b> <span class="small muted">· freiwillig, mehrere gehen</span></div>
      <div class="alc-chips">${chips}</div>
    </div>
    <button type="button" class="btn" data-action="alc-save" style="background: var(--c-teal)">Zählen</button>
    <p class="small muted" style="text-align: center">Ehrlich zählen ist kein Rückschritt – es sind deine Daten für deine Thesen.</p>
  </section>`;
}

// ───────────── Bereich ─────────────

const bpm = (v) => (v == null ? '–' : `${Math.round(v)} <span style="font-size: 12px; font-weight: 500">bpm</span>`);
const stepsTxt = (v) => (v == null ? '–' : numTxt(Math.round(v / 100) * 100, 0));

export function alcoholView(S, T) {
  if (!alcoholOn(S)) {
    return `<div class="app">${backBar('#/', 'Übersicht')}<div class="wrap"><p class="hint-card">Schalte „Alkoholfrei“ im Profil ein.</p></div>${nav('overview')}</div>`;
  }
  const st = alcoholState(S, T);
  if (!st.settings) {
    return `<div class="app">${backBar('#/', 'Übersicht')}<div class="wrap" style="gap: 14px">
      <h1 style="font-size: 28px; padding: 0 4px">Alkoholfrei</h1>
      <section class="hint-card"><div style="font-size: 16px; font-weight: 700">Die Tage zählen sich selbst</div><p>Ab dem Start zählt jeder Tag ohne Eintrag als alkoholfrei. Trinkst du doch mal, tippst du auf „Getrunken“ und sagst kurz, was los war – das sind dann Daten für deine Thesen.</p>
      <button type="button" class="btn" data-action="alc-start" style="background: var(--c-teal)">Los geht's</button></section>
    </div>${nav('overview')}${alcoholSheet(S)}</div>`;
  }
  const top = `<div style="display: flex; justify-content: space-between; align-items: center">${backBar('#/', 'Übersicht')}<a class="link-btn" href="#/alkohol-einrichten" style="margin-right: 12px; display: inline-flex; align-items: center; text-decoration: none">Einrichten</a></div>`;
  const drinkDays = new Set(st.events.map((e) => e.day)).size;

  // Quote: letzte 6 Wochen
  const ws = st.weeks.slice(-6);
  const quote = `<div class="alc-bars">${ws.map((w, i) => `<div class="alc-bar"><span class="small" style="font-weight: 600">${w.days ? w.free : ''}</span>
      <span class="alc-bar-fill" style="height: ${w.days ? Math.max(4, Math.round((w.free / 7) * 80)) : 4}px${w.days ? '' : '; background: var(--border)'}"></span>
      <span class="small muted">${w.current ? 'jetzt' : `W${st.weeks.length - ws.length + i + 1}`}</span></div>`).join('')}</div>`;

  // Wann und warum
  const p = patterns(st.events);
  const why = p ? `${p.tags.length ? p.tags.map((t) => `<div class="alc-tagrow"><span>${esc(t.label)}</span><span class="alc-track"><span style="width: ${Math.round((t.n / p.tags[0].n) * 100)}%"></span></span><b>${t.n}</b></div>`).join('') : '<p class="small muted">Noch keine Situationen angetippt.</p>'}
      <div class="stat3 inner">
        <div><div class="small muted">meist</div><b>${p.part || '–'}</b></div>
        <div><div class="small muted">häufigster Tag</div><b>${p.weekday || '–'}</b></div>
        <div><div class="small muted">Ø an Biertagen</div><b>${numTxt(p.avg, p.avg % 1 ? 1 : 0)}</b></div>
      </div>
      <p class="small muted" style="line-height: 1.45">Deine Thesen im Test – aus ${p.entries} ${p.entries === 1 ? 'Eintrag' : 'Einträgen'}. Ein Trend, kein Urteil.</p>`
    : '<p class="small muted" style="line-height: 1.45">Noch nichts gezählt – gut so. Falls doch mal: Hier siehst du dann, wann und warum, aus deinen eigenen Angaben.</p>';

  // Am Tag danach
  const rest = restValues(S.sleep, S.heart, T);
  const a = dayAfter(st.events, st.settings, T, rest ? rest.vals : [], S.activity);
  const after = a && a.afterDays
    ? `<div class="grid2 inner">
        <div><div class="small muted">Ruhepuls nach Biertag</div><b>${bpm(a.rest.after)}</b><div class="small muted">sonst ${a.rest.other == null ? '–' : Math.round(a.rest.other)}</div></div>
        <div><div class="small muted">Schritte nach Biertag</div><b>${stepsTxt(a.steps.after)}</b><div class="small muted">sonst ${stepsTxt(a.steps.other)}</div></div>
      </div>
      <p class="small muted" style="line-height: 1.45">Aus ${a.afterDays} ${a.afterDays === 1 ? 'Tag' : 'Tagen'} nach einem Biertag${a.afterDays < 10 ? ' – ab etwa 10 wird’s aussagekräftiger' : ''}. Ein Trend, kein Urteil.</p>`
    : '<p class="small muted" style="line-height: 1.45">Vergleicht Ruhepuls und Schritte am Tag nach einem Biertag mit deinen anderen Tagen – sobald es welche gibt.</p>';

  return `<div class="app">${top}<div class="wrap" style="gap: 14px">
    <div style="padding: 0 4px"><h1 style="font-size: 28px">Alkoholfrei</h1>
      <div class="small muted" style="font-size: 14px">seit ${shortDate(st.settings.started_on)} · Woche ${st.week}</div></div>
    <section class="reduce-saved">
      <div style="font-size: 14px; font-weight: 600; opacity: 0.9">Alkoholfreie Tage seit Start</div>
      <div class="reduce-euro" style="font-size: 44px">${st.free}</div>
      <p>Diese Zahl wächst nur.${drinkDays ? ` ${drinkDays} ${drinkDays === 1 ? 'Tag' : 'Tage'} mit Bier – die nehmen nichts weg.` : ' Heute zählt mit, sobald der Tag vorbei ist.'}</p>
      <div class="alc-saved-row"><span>gespart</span><b>${euro(st.saved.euro)}</b></div>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      ${weekStrip(st, T)}
      <button type="button" class="btn ghost reduce-btn" data-action="alc-open">Getrunken</button>
      ${undoLink(S)}
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">Quote</h2><span class="small muted">Ziel gerade ${st.goal} von 7</span></div>
      ${quote}
      <p class="small muted" style="line-height: 1.45">Alkoholfreie Tage pro Woche. Ein Tag mit Bier nimmt nichts weg – er zählt nur nicht mit.${st.c.goal_every ? ` Das Ziel wächst alle ${st.c.goal_every === 1 ? 'Woche' : `${st.c.goal_every} Wochen`} um einen Tag, bis 7.` : ''}</p>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 17px">Wann und warum?</h2>
      ${why}
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 17px">Am Tag danach</h2>
      ${after}
    </section>
    <p class="hint" style="padding: 0 4px">Jeder alkoholfreie Tag spart etwa ${euro(st.saved.perDay)} (${numTxt(st.c.per_week, 0)} Bier pro Woche bisher × ${euro(st.c.price)}).</p>
  </div>${nav('overview')}${alcoholSheet(S)}</div>`;
}

// ───────────── Einrichten ─────────────

export function alcoholSettingsView(S, T) {
  const s = (S.reduceSettings || []).find((r) => r.kind === KIND);
  if (!s) return alcoholView(S, T);
  const c = costsOf(s);
  const dec = (v) => String(v).replace('.', ',');
  const perDay = (c.per_week / 7) * c.price;
  const every = [[1, 'jede Woche'], [2, 'alle 2 Wochen'], [3, 'alle 3 Wochen'], [4, 'alle 4 Wochen'], [0, 'gar nicht']]
    .map(([v, l]) => `<option value="${v}"${c.goal_every === v ? ' selected' : ''}>${l}</option>`).join('');
  const goals = [1, 2, 3, 4, 5, 6, 7].map((v) => `<option value="${v}"${c.goal_start === v ? ' selected' : ''}>${v} von 7</option>`).join('');
  return `<div class="app">${backBar('#/alkohol', 'Alkoholfrei')}
  <form class="wrap" data-form="alc-settings" style="gap: 14px">
    <h1 style="font-size: 28px; padding: 0 4px">Einrichten</h1>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <h2 style="font-size: 17px">Gespartes</h2>
      <div class="reduce-grid two"><b>Ein Bier kostet</b><label class="field"><span>Euro</span><input class="input" name="price" inputmode="decimal" value="${esc(dec(c.price))}"></label></div>
      <div class="reduce-grid two"><span><b>Bier pro Woche bisher</b><br><span class="small muted">ehrlich geschätzt – daraus wird der Tageswert</span></span><label class="field"><span>Bier</span><input class="input" name="per_week" inputmode="decimal" value="${esc(dec(c.per_week))}"></label></div>
      <div class="reduce-cost"><span>Jeder alkoholfreie Tag spart etwa</span><b>${euro(perDay)}</b></div>
      <div class="small muted">Ein ganzes alkoholfreies Jahr wären ≈ ${numTxt(Math.round(perDay * 365), 0)} €. Gespartes wächst nur: Biertage nehmen nichts weg.</div>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <h2 style="font-size: 17px">Quote</h2>
      <label class="field"><span>Alkoholfrei seit</span><input class="input" type="date" name="started_on" max="${T}" value="${esc(s.started_on)}"></label>
      <div class="grid2">
        <label class="field"><span>Ziel am Anfang</span><select class="input" name="goal_start">${goals}</select></label>
        <label class="field"><span>Ziel wächst um 1</span><select class="input" name="goal_every">${every}</select></label>
      </div>
    </section>
    <section class="card pad">
      <label class="switch-row" style="cursor: pointer">
        <span><span style="display: block; font-size: 15px; font-weight: 600">Auf der Übersicht zeigen</span><span class="small muted">Aus: nur hier im Bereich sichtbar – unauffälliger</span></span>
        <input type="checkbox" name="show_card" class="reduce-check" ${s.show_card === false ? '' : 'checked'}>
      </label>
    </section>
    <p class="small" style="color: var(--danger); min-height: 18px" id="alc-error" role="alert"></p>
    <button type="submit" class="btn">Speichern</button>
    <p class="hint" style="padding: 0 4px">Das Modul schaltest du im Profil ein oder aus – jede Person für sich.</p>
  </form>${nav('overview')}</div>`;
}

// ───────────── Profil ─────────────

export function alcoholProfileCard(S) {
  if (!S.hasReduceSchema) return '';
  const on = alcoholOn(S);
  const needs = on && !S.hasAlcoholSchema ? '<p class="hint">Für das Zählen bitte noch das Datenbank-Update <code>013_alkohol.sql</code> ausführen.</p>' : '';
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
    <div class="switch-row" style="cursor: default">
      <div><div style="font-size: 16px; font-weight: 700">Alkoholfrei</div>
        <div class="small muted">Alkoholfreie Tage zählen sich selbst, Quote, Gespartes – ohne Vorwürfe</div></div>
      <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Alkoholfrei nutzen" data-action="module-toggle" data-id="alkohol"></button>
    </div>
    ${needs}
    ${on ? '<a class="btn ghost" href="#/alkohol">Öffnen</a>' : ''}
  </section>`;
}

