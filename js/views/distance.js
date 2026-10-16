// „Wie weit bin ich gekommen?“ – Strecke als Kreis auf der Karte, zusammengezählt. Dazu ein Reiseziel ohne Termin.

import { STARTS, walked, journey, pace, city, startOf, activeGoal, reachedGoals, goalStatus, goalChoices, nextSuggestions, duration } from '../distance.js';
import { monthName, monthStart } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { backBar, esc, nav, numTxt, shortDate } from './ui.js';

const kmTxt = (v) => `${numTxt(v, v >= 100 || Number.isInteger(v) ? 0 : 1)} km`;
const short = (name) => name.replace(' am Main', '');

// Ein Ziel als Auswahl-Knopf (Auswahl-Sheet und Vorschläge nach der Ankunft)
function goalOption(c, p, label = '', on = false) {
  return `<button type="button" class="goal-opt" data-action="travel-pick" data-id="${esc(c.name)}"${on ? ' aria-pressed="true"' : ''}>
    <span>${label ? `<span class="goal-opt-label">${label}</span>` : ''}<span class="goal-opt-name">${esc(c.name)}</span></span>
    <span class="small muted" style="text-align: right">noch ${kmTxt(c.left)}${p ? `<br>${duration(c.left / p.perDay)}` : ''}</span>
  </button>`;
}

function goalCard(S, total, p) {
  if (!S.hasTravelSchema) {
    return '<p class="hint" style="padding: 0 4px">Für Reiseziele bitte das Datenbank-Update 006 im SQL-Editor ausführen.</p>';
  }
  const goal = activeGoal(S.travel);
  if (goal) {
    const st = goalStatus(goal, total);
    const pct = Math.round(st.share * 100);
    return `<section class="card pad goal-card">
      <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px">
        <div><div class="small muted" style="font-weight: 600">Dein Reiseziel</div><div class="goal-name">${esc(goal.city)}</div></div>
        <button type="button" class="link-btn" data-action="travel-open">Ändern</button>
      </div>
      <div class="goal-bar" role="img" aria-label="${pct} Prozent des Wegs nach ${esc(goal.city)}"><span style="width: ${pct}%"></span></div>
      <div style="display: flex; justify-content: space-between; font-size: 14px"><span><b>${kmTxt(Math.min(total, st.dist))}</b> von ${kmTxt(st.dist)}</span><span class="muted">noch ${kmTxt(st.left)}</span></div>
      ${p ? `<p class="small" style="line-height: 1.45">Bei deinem Schnitt ${duration(st.left / p.perDay, true)}. Kein Termin – nur eine Schätzung.</p>` : ''}
    </section>`;
  }
  const done = S.celebrateId && S.travel.find((g) => g.id === S.celebrateId);
  if (done) {
    const st = goalStatus(done, total);
    const sug = nextSuggestions(startOf(S), total, p && p.perDay);
    const first = reachedGoals(S.travel).length === 1;
    return `<section class="celebrate">
      <svg class="confetti" viewBox="0 0 350 210" preserveAspectRatio="none" aria-hidden="true">
        <rect x="18" y="20" width="9" height="4" rx="1.5" fill="#FFD27A" transform="rotate(-25 22 22)"></rect>
        <rect x="70" y="10" width="7" height="7" rx="3.5" fill="#FFFFFF" opacity="0.7"></rect>
        <rect x="300" y="18" width="10" height="4" rx="1.5" fill="#9FE3D2" transform="rotate(30 305 20)"></rect>
        <rect x="250" y="40" width="6" height="6" rx="3" fill="#FFD27A"></rect>
        <rect x="325" y="70" width="9" height="4" rx="1.5" fill="#FFFFFF" opacity="0.8" transform="rotate(-40 329 72)"></rect>
        <rect x="200" y="12" width="8" height="3.5" rx="1.5" fill="#FFFFFF" opacity="0.6" transform="rotate(15 204 14)"></rect>
        <rect x="150" y="30" width="5" height="5" rx="2.5" fill="#9FE3D2"></rect>
        <rect x="285" y="120" width="7" height="7" rx="3.5" fill="#FFD27A" opacity="0.8"></rect>
        <rect x="12" y="110" width="8" height="3.5" rx="1.5" fill="#9FE3D2" transform="rotate(50 16 112)"></rect>
      </svg>
      <div class="celebrate-ico">${svg(UI_ICONS.flag, 28)}</div>
      <div style="font-size: 14px; font-weight: 600; opacity: 0.9">Angekommen!</div>
      <div class="celebrate-city">${esc(done.city)}</div>
      <p>${kmTxt(st.dist)} zu Fuß von ${esc(short(done.start_city))}${first ? ' – dein erstes Reiseziel' : ''}. Das bleibt, egal was kommt.</p>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
      <h2 style="font-size: 17px">Wie geht's weiter?</h2>
      ${sug.near ? goalOption(sug.near, p, 'Nah') : ''}
      ${sug.far ? goalOption(sug.far, p, 'Fern') : ''}
      <div style="display: flex; justify-content: space-between">
        <button type="button" class="link-btn" data-action="travel-open">Anderes Ziel</button>
        <button type="button" class="link-btn muted" data-action="travel-none">Erst mal ohne</button>
      </div>
    </section>`;
  }
  return `<section class="hint-card">
    <div style="font-size: 16px; font-weight: 600">Wohin soll's gehen?</div>
    <p>${p ? `Du läufst etwa ${kmTxt(p.perWeek)} in der Woche. ` : ''}Such dir ein Ziel aus – kein Termin, nur eine Richtung. Du kommst mit jedem Schritt näher.</p>
    <button type="button" class="btn" data-action="travel-open" style="height: 48px; font-size: 16px">Ziel wählen</button>
  </section>`;
}

// Monatsansicht: was dieser Monat zum Reiseziel beigetragen hat – ein Beitrag, keine Latte
function monthGoalCard(S, monthKm, total) {
  const goal = S.hasTravelSchema && activeGoal(S.travel);
  if (!goal || monthKm <= 0) return '';
  const st = goalStatus(goal, total);
  const pct = Math.round((monthKm / st.dist) * 100);
  return `<section class="card pad goal-card">
    <div class="small muted" style="font-weight: 600">Dein Reiseziel</div>
    <div style="font-size: 17px">Diesen Monat <b>${kmTxt(monthKm)}</b> Richtung <b>${esc(goal.city)}</b>${pct >= 1 ? ` – ${pct >= 50 ? 'mehr als die Hälfte' : `${pct} %`} des ganzen Wegs` : ''}.</div>
    <div class="goal-bar" role="img" aria-label="Dieser Monat: ${pct} Prozent des Wegs nach ${esc(goal.city)}"><span style="width: ${Math.min(100, pct)}%"></span></div>
    <div class="small muted">Noch ${kmTxt(st.left)} bis ${esc(goal.city)}.</div>
  </section>`;
}

function goalSheet(S, total, p) {
  const goal = activeGoal(S.travel);
  const opts = (items) => `<div style="display: flex; flex-direction: column; gap: 6px">${items.map((c) => goalOption(c, p, '', goal && goal.city === c.name)).join('')}</div>`;
  const groups = goalChoices(startOf(S), total, p && p.perWeek).map((g) => {
    if (!g.regions) return `<div class="goal-group">${g.title}</div>${opts(g.items)}`;
    // Fernziele nach Kontinent: gewählter Kontinent, sonst der des aktuellen Ziels, sonst Europa
    const goalRegion = goal && (g.regions.find((r) => r.items.some((c) => c.name === goal.city)) || {}).name;
    const region = g.regions.find((r) => r.name === S.travelRegion) || g.regions.find((r) => r.name === goalRegion) || g.regions[0];
    const chips = g.regions.map((r) => `<button type="button" class="chip" data-action="travel-region" data-id="${esc(r.name)}" aria-pressed="${r === region}">${esc(r.name)}</button>`).join('');
    return `<div class="goal-group">${g.title}</div>
      <div class="goal-regions" role="group" aria-label="Kontinent">${chips}</div>
      ${opts(region.items)}
      ${region.name !== 'Europa' ? '<p class="small muted" style="margin-top: 6px">Luftlinie – übers Wasser zählt einfach mit.</p>' : ''}`;
  }).join('');
  return `<button type="button" class="scrim" data-action="travel-close" aria-label="Schließen"></button>
  <section class="sheet goal-sheet" role="dialog" aria-modal="true" aria-label="Reiseziel wählen">
    <div class="handle"></div>
    <div>
      <h2 style="font-size: 22px">Reiseziel wählen</h2>
      <p class="small muted" style="margin-top: 2px">${p ? `Du läufst etwa ${kmTxt(p.perWeek)} in der Woche. Die Zeiten sind Schätzungen.` : 'Von ' + esc(short(startOf(S))) + ' aus, Luftlinie.'}</p>
    </div>
    <div>${groups || '<p class="muted">Alle Ziele erreicht. Wahnsinn.</p>'}</div>
    ${goal ? '<button type="button" class="btn ghost" data-action="travel-clear">Ohne Ziel weiterlaufen</button>' : ''}
  </section>`;
}

export function distanceView(S, T) {
  const startName = startOf(S);
  const month = S.distRange === 'month';
  const all = walked(S.activity || []);
  const span = month ? walked(S.activity || [], monthStart(T), T) : all;
  const j = journey(startName, span.km);
  const pc = pace(S.activity || [], T);
  const p = pc && pc.days >= 5 ? pc : null; // Schätzungen erst mit ein paar Tagen Daten

  if (!all.first) {
    return `<div class="app">
      ${backBar('#/', 'Übersicht')}
      <div class="wrap" style="gap: 14px">
        <h1 style="font-size: 28px; padding: 0 4px">Wie weit bin ich gekommen?</h1>
        <p class="hint-card"><span>Hier zählt die App deine Strecke aus Withings zusammen und zeigt, bis wohin du hättest laufen können. Verbinde Withings im Profil – dann geht's los.</span></p>
      </div>
      ${nav('overview')}
    </div>`;
  }

  const seg = [['all', 'Seit Start'], ['month', 'Dieser Monat']].map(([id, label]) =>
    `<label><input type="radio" name="drange" value="${id}"${(month ? 'month' : 'all') === id ? ' checked' : ''} data-action="dist-range"><span>${label}</span></label>`).join('');

  const headline = j.last
    ? `Von ${esc(short(startName))} bis <b>${esc(j.last.name)}</b>`
    : `Noch nicht ganz bis ${esc(j.next.name)}`;
  const nextLine = j.next
    ? `Nächste Stadt: <b>${esc(j.next.name)}</b> – noch ${kmTxt(j.toNext)}`
    : 'Alle Ziele auf der Karte erreicht. Respekt.';

  // Karte: Daten für js/map.js
  const mapData = {
    start: { name: j.start.name, lat: j.start.lat, lng: j.start.lng },
    km: span.km,
    reached: j.reached.map((c) => ({ name: c.name, lat: c.lat, lng: c.lng })),
    next: j.next ? { name: j.next.name, lat: j.next.lat, lng: j.next.lng } : null,
    goal: null
  };
  const goal = !month && activeGoal(S.travel);
  if (goal && goal.start_city === j.start.name) {
    const g = city(goal.city);
    mapData.goal = { name: goal.city, lat: g.lat, lng: g.lng, share: goalStatus(goal, span.km).share };
    mapData.next = null;
  }

  const recent = j.reached.slice(-4).reverse();
  const rows = [
    ...j.ahead.slice(0, 2).reverse().map((c) => ({ c, state: 'ahead' })),
    ...recent.map((c) => ({ c, state: 'done' }))
  ].map(({ c, state }) => `<div class="dest-row" data-state="${state}">
      <span class="dest-dot"></span><span class="dest-name">${esc(c.name)}</span>
      <span class="small muted">${state === 'done' ? kmTxt(c.dist) : `noch ${kmTxt(Math.round((c.dist - span.km) * 10) / 10)}`}</span>
    </div>`).join('');
  const more = j.reached.length > recent.length ? `<div class="small muted" style="padding: 4px 0 0 22px">und ${j.reached.length - recent.length} weitere davor</div>` : '';

  const startOpts = STARTS.map((n) => `<option value="${esc(n)}"${n === startName ? ' selected' : ''}>${esc(n)}</option>`).join('');

  return `<div class="app">
    ${backBar('#/', 'Übersicht')}
    <div class="wrap" style="gap: 14px">
      <h1 style="font-size: 28px; padding: 0 4px">Wie weit bin ich gekommen?</h1>
      <div class="seg" role="radiogroup" aria-label="Zeitraum">${seg}</div>
      <section class="card pad dist-head">
        <div class="dist-km">${kmTxt(span.km)}</div>
        <div class="small muted">${month ? `im ${monthName(T)}` : `zu Fuß seit ${shortDate(all.first)}`}</div>
        <div class="dist-line">${headline}</div>
      </section>
      ${month ? monthGoalCard(S, span.km, all.km) : goalCard(S, span.km, p)}
      <div id="dist-map" class="dist-map" data-map='${esc(JSON.stringify(mapData))}' role="img" aria-label="Karte: Kreis mit ${kmTxt(span.km)} um ${esc(j.start.name)}"><div class="dist-map-msg small muted">Karte lädt …</div></div>
      <section class="card pad">
        <div class="dist-next">${nextLine}</div>
        <div class="dest-list">${rows}${more}</div>
      </section>
      ${reachedList(S)}
      <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
        <label class="small muted" for="dist-start">Startort</label>
        <select id="dist-start" class="input" data-action="dist-start">${startOpts}</select>
      </section>
      <p class="hint" style="padding: 0 4px">Luftlinie – zu Fuß wäre der Weg etwas länger. Die Strecke kommt aus Withings und reicht so weit zurück wie deine Withings-Daten.</p>
    </div>
    ${nav('overview')}
    ${S.travelSheet && !month ? goalSheet(S, span.km, p) : ''}
  </div>`;
}

function reachedList(S) {
  const done = reachedGoals(S.travel);
  if (!done.length) return '';
  return `<section class="card pad">
    <div class="small muted" style="font-weight: 600; margin-bottom: 6px">Deine Reiseziele</div>
    ${done.map((g) => `<div class="dest-row"><span class="goal-flag">${svg(UI_ICONS.flag, 16, 2.4)}</span><span class="dest-name">${esc(g.city)}</span><span class="small muted">${shortDate(g.reached_on)}</span></div>`).join('')}
  </section>`;
}

// Kleine Karte auf der Übersicht, bis die Ankunft einmal angesehen wurde
export function travelArrivedCard(S) {
  const g = (S.travel || []).find((x) => x.reached_on && !x.seen);
  if (!g) return '';
  return `<a class="card pad dist-link travel-arrived" href="#/distance">
    <span class="goal-flag big">${svg(UI_ICONS.flag, 20, 2.4)}</span>
    <span style="flex: 1"><b>Angekommen in ${esc(g.city)}!</b><br><span class="small muted">Dein Reiseziel – ansehen</span></span>
    <span aria-hidden="true">›</span>
  </a>`;
}
