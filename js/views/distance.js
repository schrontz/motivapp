// „Wie weit bin ich gekommen?“ – Strecke als Kreis auf der Karte, zusammengezählt. Dazu ein Reiseziel ohne Termin.

import { STARTS, walkedFor, travelFrom, journey, pace, city, km, placeOf, startOf, activeGoal, reachedGoals, goalStatus, goalChoices, nextSuggestions, duration, stagesFor, stageStatus, teaser } from '../distance.js';
import { monthName, monthStart } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { backBar, esc, nav, numTxt, shortDate } from './ui.js';

const kmTxt = (v) => `${numTxt(v, v >= 100 || Number.isInteger(v) ? 0 : 1)} km`;
const short = (name) => name.replace(' am Main', '');

// Ein Ziel als Auswahl-Knopf (Auswahl-Sheet und Vorschläge nach der Ankunft)
function goalOption(c, p, label = '', on = false) {
  if (c.inside) {
    return `<div class="goal-opt" aria-disabled="true">
      <span><span class="goal-opt-name">${esc(c.name)}</span>${c.label ? `<span class="small muted">${esc(c.label)}</span>` : ''}</span>
      <span class="small muted" style="text-align: right">${kmTxt(c.dist)}<br>schon im Kreis</span>
    </div>`;
  }
  return `<button type="button" class="goal-opt" data-action="travel-pick" data-id="${esc(c.name)}"${on ? ' aria-pressed="true"' : ''}>
    <span>${label ? `<span class="goal-opt-label">${label}</span>` : ''}<span class="goal-opt-name">${esc(c.name)}</span>${c.label ? `<span class="small muted">${esc(c.label)}</span>` : ''}</span>
    <span class="small muted" style="text-align: right">noch ${kmTxt(c.left)}${p ? `<br>${duration(c.left / p.perDay)}` : ''}</span>
  </button>`;
}

// „Wusstest du …?“ – kurzer Wikipedia-Anriss in Feiern
function didYouKnow(S, name) {
  const w = S.wiki[name];
  if (!w || w.state === 'none' || w.state === 'error') return '';
  if (w.state === 'loading') return '<p class="small" style="opacity: 0.85">Wusstest du …? Einen Moment, ich schlage nach.</p>';
  return `<div class="did-you-know">
    <div class="small" style="font-weight: 700">Wusstest du …?</div>
    <p class="small">${esc(teaser(w.data.extract))}</p>
    <button type="button" class="dyk-more" data-action="city-info" data-id="${esc(name)}">Mehr über ${esc(name)}</button>
  </div>`;
}

// Stadt-Infos als Sheet: Bild, Kurzbeschreibung, Auszug, Link zu Wikipedia (Quelle + Lizenz Pflicht)
function citySheet(S) {
  const name = S.cityInfo;
  const w = S.wiki[name] || { state: 'loading' };
  let body;
  if (w.state === 'loading') body = '<p class="muted">Schlage bei Wikipedia nach …</p>';
  else if (w.state === 'error') body = '<p class="muted">Wikipedia ist gerade nicht erreichbar – Internet da? Später nochmal antippen.</p>';
  else if (w.state === 'none') body = `<p class="muted">Dazu habe ich keinen passenden Artikel gefunden.</p><a class="link-btn" href="https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}" target="_blank" rel="noopener">Bei Wikipedia suchen</a>`;
  else {
    const d = w.data;
    body = `${d.image ? `<img class="city-img" src="${esc(d.image)}" alt="" loading="lazy">` : ''}
      ${d.description ? `<div class="small muted">${esc(d.description)}</div>` : ''}
      <p class="city-text">${esc(d.extract)}</p>
      <a class="btn ghost" href="${esc(d.url)}" target="_blank" rel="noopener">Weiterlesen auf Wikipedia</a>
      <p class="small muted">Text: Wikipedia, Lizenz CC BY-SA 4.0</p>`;
  }
  return `<button type="button" class="scrim" data-action="city-close" aria-label="Schließen"></button>
  <section class="sheet goal-sheet" role="dialog" aria-modal="true" aria-label="${esc(name)}">
    <div class="handle"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px">
      <h2 style="font-size: 24px">${esc(name)}</h2>
      <button type="button" class="goal-del" data-action="city-close" aria-label="Schließen" style="border: 0">${svg('M6 6l12 12M18 6L6 18', 20)}</button>
    </div>
    ${body}
  </section>`;
}

// Alle Etappen als Punktreihe – erreichte gefüllt, die nächste umrandet, Namen nur für letzte und nächste
function stageStrip(stages, ss) {
  const dots = stages.map((s, i) => {
    const state = i < ss.reached ? 'done' : (i === ss.reached ? 'next' : 'ahead');
    return `<span class="stage-dot" data-state="${state}"${s.final ? ' data-final="true"' : ''} title="${esc(s.name)} · ${kmTxt(s.dist)}"></span>`;
  }).join('<span class="stage-line"></span>');
  const names = stages.map((s) => esc(s.name)).join(' → ');
  return `<div class="stage-strip" role="img" aria-label="Etappen: ${names}. ${ss.reached} geschafft.">${dots}</div>
    <div class="small muted stage-names">${names}</div>`;
}

function goalCard(S, total, p) {
  if (!S.hasTravelSchema) {
    return '<p class="hint" style="padding: 0 4px">Für Reiseziele bitte das Datenbank-Update 006 im SQL-Editor ausführen.</p>';
  }
  const goal = activeGoal(S.travel);
  if (goal) {
    const st = goalStatus(goal, total);
    const stages = stagesFor(goal, S.places);
    const ss = stageStatus(stages, total);
    const pct = Math.round(st.share * 100);
    const legPct = Math.round(ss.legShare * 100);
    const multi = stages.length > 1;
    const party = S.stageCelebrate && S.stageCelebrate.goalId === goal.id ? S.stageCelebrate.name : null;
    return `<section class="card pad goal-card">
      <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px">
        <div><div class="small muted" style="font-weight: 600">Dein Reiseziel</div><div class="goal-name">${esc(goal.city)}</div></div>
        <button type="button" class="link-btn" data-action="travel-open">Ändern</button>
      </div>
      ${party ? `<div class="stage-party" role="status">
        <span class="goal-flag">${svg(UI_ICONS.flag, 16, 2.4)}</span>
        <span style="flex: 1"><b>Etappe geschafft: ${esc(party)}!</b><br><span class="small">Weiter nach ${esc(ss.next ? ss.next.name : goal.city)}.</span></span>
        <button type="button" class="goal-del" data-action="travel-stage-ok" aria-label="Schließen">${svg('M6 6l12 12M18 6L6 18', 16)}</button>
      </div>${didYouKnow(S, party) ? `<div class="stage-dyk">${didYouKnow(S, party)}</div>` : ''}` : ''}
      ${multi ? `<div class="small muted" style="font-weight: 600">${ss.next && ss.next.final ? 'Letzte Etappe' : `Etappe ${ss.reached + 1} von ${stages.length}`} · nach <b style="color: var(--text)">${esc(ss.next ? ss.next.name : goal.city)}</b></div>` : ''}
      <div class="goal-bar" role="img" aria-label="${multi ? `${legPct} Prozent der Etappe nach ${esc(ss.next.name)}` : `${pct} Prozent des Wegs nach ${esc(goal.city)}`}"><span style="width: ${multi ? legPct : pct}%"></span></div>
      <div style="display: flex; justify-content: space-between; font-size: 14px">${multi
        ? `<span>noch <b>${kmTxt(ss.left)}</b> bis ${esc(ss.next.name)}</span>${p ? `<span class="muted">${duration(ss.left / p.perDay)}</span>` : ''}`
        : `<span><b>${kmTxt(Math.min(total, st.dist))}</b> von ${kmTxt(st.dist)}</span><span class="muted">noch ${kmTxt(st.left)}</span>`}</div>
      ${multi ? stageStrip(stages, ss) : ''}
      <p class="small" style="line-height: 1.45">${multi ? `Ganze Reise: <b>${kmTxt(Math.min(total, st.dist))}</b> von ${kmTxt(st.dist)} (${pct} %)${p ? `, bei deinem Schnitt ${duration(st.left / p.perDay, true)}` : ''}.` : (p ? `Bei deinem Schnitt ${duration(st.left / p.perDay, true)}.` : '')} Kein Termin – nur eine Schätzung.</p>
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
      ${didYouKnow(S, done.city)}
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
  const stages = stagesFor(goal, S.places);
  const ss = stageStatus(stages, total, monthKm);
  const passed = ss.passedThisMonth.filter((x) => !x.final).map((x) => esc(x.name));
  const before = Math.round(ss.legBeforeMonth * 100);
  const now = Math.round(ss.legShare * 100);
  const next = ss.next ? ss.next.name : goal.city;
  return `<section class="card pad goal-card">
    <div class="small muted" style="font-weight: 600">Unterwegs nach ${esc(goal.city)}</div>
    <div style="font-size: 17px">Diesen Monat <b>${kmTxt(monthKm)}</b>${passed.length ? ` – geschafft: <b>${passed.join(', ')}</b>` : ''}.</div>
    <div class="goal-bar two" role="img" aria-label="Etappe nach ${esc(next)}: ${now} Prozent, davon ${now - before} Prozentpunkte diesen Monat">
      <span class="before" style="width: ${before}%"></span><span style="width: ${Math.max(0, now - before)}%"></span>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 14px"><span>noch <b>${kmTxt(ss.left)}</b> bis ${esc(next)}</span><span class="small muted">kräftig = dieser Monat</span></div>
    ${stages.length > 1 ? stageStrip(stages, ss) : ''}
  </section>`;
}

// Suchergebnisse: erst die eigene Liste, dann OpenStreetMap
function searchResults(S, total, p) {
  const r = S.travelResults;
  const start = city(startOf(S));
  const withDist = (c) => {
    const dist = Math.round(km(start, c));
    return { ...c, dist, left: Math.max(0, Math.round((dist - total) * 10) / 10), inside: dist <= total };
  };
  const goal = activeGoal(S.travel);
  const local = r.local.map(withDist);
  let osm = '';
  if (S.travelSearching) osm = '<p class="small muted">Suche bei OpenStreetMap …</p>';
  else if (r.error) osm = `<p class="small" style="color: var(--danger)">${esc(r.error)}</p>`;
  else if (r.osm && !r.osm.length) osm = '<p class="small muted">Nichts gefunden. Vielleicht anders schreiben?</p>';
  else if (r.osm) {
    osm = r.osm.map((c, i) => {
      const d = withDist(c);
      return `<button type="button" class="goal-opt" data-action="travel-add" data-idx="${i}">
        <span><span class="goal-opt-name">${esc(c.name)}</span>${c.label ? `<span class="small muted">${esc(c.label)}</span>` : ''}</span>
        <span class="small muted" style="text-align: right">${d.inside ? `${kmTxt(d.dist)}<br>schon im Kreis` : `noch ${kmTxt(d.left)}${p ? `<br>${duration(d.left / p.perDay)}` : ''}`}</span>
      </button>`;
    }).join('');
  }
  return `${local.length ? `<div class="goal-group">Aus der Liste</div><div class="goal-list">${local.map((c) => goalOption(c, p, '', goal && goal.city === c.name)).join('')}</div>` : ''}
    <div class="goal-group">OpenStreetMap</div>
    ${S.hasPlacesSchema ? `<div class="goal-list">${osm}</div>
    <p class="small muted" style="margin-top: 6px">Antippen speichert den Ort unter „Meine Orte“ und macht ihn zum Ziel. Suche: © OpenStreetMap-Mitwirkende.</p>`
    : '<p class="small muted">Für eigene Orte bitte das Datenbank-Update 007 im SQL-Editor ausführen.</p>'}
    <button type="button" class="link-btn" data-action="travel-search-clear">Zurück zur Auswahl</button>`;
}

function goalSheet(S, total, p) {
  const goal = activeGoal(S.travel);
  const opts = (items, removable = false) => `<div class="goal-list">${items.map((c) => removable
    ? `<div class="goal-row">${goalOption(c, p, '', goal && goal.city === c.name)}<button type="button" class="goal-del" data-action="travel-place-delete" data-id="${esc(c.name)}" aria-label="${esc(c.name)} aus Meine Orte entfernen">${svg('M6 6l12 12M18 6L6 18', 18)}</button></div>`
    : goalOption(c, p, '', goal && goal.city === c.name)).join('')}</div>`;
  const search = `<form class="goal-search" data-form="travel-search" role="search">
    <input class="input" type="search" name="q" value="${esc(S.travelQuery)}" placeholder="Ort suchen, z. B. Sylt" aria-label="Ort suchen" enterkeyhint="search" autocomplete="off">
    <button type="submit" class="btn" ${S.travelSearching ? 'disabled' : ''}>Suchen</button>
  </form>`;
  if (S.travelResults) {
    return `<button type="button" class="scrim" data-action="travel-close" aria-label="Schließen"></button>
    <section class="sheet goal-sheet" role="dialog" aria-modal="true" aria-label="Reiseziel suchen">
      <div class="handle"></div>
      <h2 style="font-size: 22px">Reiseziel suchen</h2>
      ${search}
      <div>${searchResults(S, total, p)}</div>
    </section>`;
  }
  const groups = goalChoices(startOf(S), total, p && p.perWeek, S.places).map((g) => {
    if (g.key === 'mine') return `<div class="goal-group">${g.title}</div>${opts(g.items, true)}`;
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
    ${search}
    <div>${groups || '<p class="muted">Alle Ziele erreicht. Wahnsinn.</p>'}</div>
    ${goal ? '<button type="button" class="btn ghost" data-action="travel-clear">Ohne Ziel weiterlaufen</button>' : ''}
  </section>`;
}

export function distanceView(S, T) {
  const startName = startOf(S);
  const month = S.distRange === 'month';
  const all = walkedFor(S);
  const span = month ? walkedFor(S, monthStart(T), T) : all;
  const j = journey(startName, span.km, S.places);
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
    ? `Rund um ${esc(short(startName))} – nächste Stadt: <b>${esc(j.next.name)}</b>, noch ${kmTxt(j.toNext)}`
    : 'Alle Ziele auf der Karte erreicht. Respekt.';

  // Karte: Daten für js/map.js
  const mapData = {
    start: { name: j.start.name, lat: j.start.lat, lng: j.start.lng },
    km: span.km,
    reached: j.reached.map((c) => ({ name: c.name, lat: c.lat, lng: c.lng })),
    next: j.next ? { name: j.next.name, lat: j.next.lat, lng: j.next.lng } : null,
    goal: null
  };
  const goal = S.hasTravelSchema && activeGoal(S.travel);
  if (goal && goal.start_city === j.start.name) {
    // Linie zum Ziel immer seit Start gerechnet; im Monat ist das Stück dieses Monats hervorgehoben
    const g = placeOf(goal);
    const D = goalStatus(goal, all.km).dist || 1;
    const stages = stagesFor(goal, S.places);
    mapData.goal = {
      name: goal.city, lat: g.lat, lng: g.lng,
      share: Math.min(1, all.km / D),
      shareFrom: month ? Math.min(1, Math.max(0, all.km - span.km) / D) : null,
      focusNext: month // im Monat auf das Monatsstück und die nächste Etappe zoomen, nicht aufs ganze Ziel
    };
    mapData.stages = stages.filter((s) => !s.final).map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, done: s.dist <= all.km }));
    const nextStage = stages.find((s) => s.dist > all.km);
    mapData.nextStage = nextStage ? { lat: nextStage.lat, lng: nextStage.lng } : null;
    mapData.next = null;
  }

  // Erreichte Städte: die letzten vier, auf Wunsch alle
  const recent = (S.distAll ? j.reached : j.reached.slice(-4)).slice().reverse();
  const rows = [
    ...j.ahead.slice(0, 2).reverse().map((c) => ({ c, state: 'ahead' })),
    ...recent.map((c) => ({ c, state: 'done' }))
  ].map(({ c, state }) => state === 'done'
    ? `<button type="button" class="dest-row" data-state="done" data-action="city-info" data-id="${esc(c.name)}" aria-label="${esc(c.name)}: mehr erfahren">
      <span class="dest-dot"></span><span class="dest-name">${esc(c.name)}</span>
      <span class="small muted">${kmTxt(c.dist)}</span><span class="dest-more" aria-hidden="true">›</span>
    </button>`
    : `<div class="dest-row" data-state="ahead">
      <span class="dest-dot"></span><span class="dest-name">${esc(c.name)}</span>
      <span class="small muted">noch ${kmTxt(Math.round((c.dist - span.km) * 10) / 10)}</span>
    </div>`).join('');
  const more = j.reached.length > 4
    ? `<button type="button" class="link-btn" data-action="dist-all" style="margin-left: 14px">${S.distAll ? 'Weniger zeigen' : `Alle ${j.reached.length} erreichten Städte zeigen`}</button>`
    : '';

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
        ${j.reached.length ? '<p class="small muted" style="margin-top: 6px">Tipp: Erreichte Städte antippen – dann erfährst du etwas über sie.</p>' : ''}
      </section>
      ${reachedList(S)}
      <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
        <label class="small muted" for="dist-start">Startort</label>
        <select id="dist-start" class="input" data-action="dist-start">${startOpts}</select>
        ${S.profile && 'travel_from' in S.profile ? `<label class="small muted" for="dist-from" style="margin-top: 6px">Strecke zählt ab</label>
        <input id="dist-from" class="input" type="date" max="${T}" value="${esc(travelFrom(S))}" data-action="dist-from">
        <span class="small muted">Früher gelaufene Tage holt Withings zwar nach – hier zählt, was du ab diesem Tag läufst.</span>` : ''}
      </section>
      <p class="hint" style="padding: 0 4px">Deine Kilometer sind echt gelaufen – aus deinen Schritten bei Withings. Nur der Weg zum Ziel ist Luftlinie.</p>
    </div>
    ${nav('overview')}
    ${S.travelSheet && !month ? goalSheet(S, span.km, p) : ''}
    ${S.cityInfo ? citySheet(S) : ''}
  </div>`;
}

function reachedList(S) {
  const done = reachedGoals(S.travel);
  if (!done.length) return '';
  return `<section class="card pad">
    <div class="small muted" style="font-weight: 600; margin-bottom: 6px">Deine Reiseziele</div>
    ${done.map((g) => `<button type="button" class="dest-row" data-action="city-info" data-id="${esc(g.city)}" aria-label="${esc(g.city)}: mehr erfahren"><span class="goal-flag">${svg(UI_ICONS.flag, 16, 2.4)}</span><span class="dest-name">${esc(g.city)}</span><span class="small muted">${shortDate(g.reached_on)}</span><span class="dest-more" aria-hidden="true">›</span></button>`).join('')}
  </section>`;
}

// Kleine Karte auf der Übersicht, bis die Ankunft einmal angesehen wurde
export function travelArrivedCard(S) {
  const g = (S.travel || []).find((x) => x.reached_on && !x.seen);
  if (!g) {
    // Neue Etappe geschafft?
    const goal = S.hasStagesSchema && activeGoal(S.travel);
    if (!goal || !goal.id) return '';
    const stages = stagesFor(goal, S.places);
    const ss = stageStatus(stages, walkedFor(S).km);
    if (ss.reached <= (goal.stages_seen || 0) || !ss.prev) return '';
    return `<a class="card pad dist-link travel-arrived" href="#/distance">
      <span class="goal-flag big">${svg(UI_ICONS.flag, 20, 2.4)}</span>
      <span style="flex: 1"><b>Etappe geschafft: ${esc(ss.prev.name)}!</b><br><span class="small muted">Weiter Richtung ${esc(goal.city)} – ansehen</span></span>
      <span aria-hidden="true">›</span>
    </a>`;
  }
  return `<a class="card pad dist-link travel-arrived" href="#/distance">
    <span class="goal-flag big">${svg(UI_ICONS.flag, 20, 2.4)}</span>
    <span style="flex: 1"><b>Angekommen in ${esc(g.city)}!</b><br><span class="small muted">Dein Reiseziel – ansehen</span></span>
    <span aria-hidden="true">›</span>
  </a>`;
}
