// Essen: Karte auf der Übersicht, Woche mit Sammelalbum, Eintragen, eine Mahlzeit.
// Entdecken statt Diät: Pflanzen sammeln, Nährstoffe als Prozent, Kalorien nur klein.

import { PLANTS, PLANT_GROUPS, isLegume, nutrOf, percentOf, dayFood, week, discovery, proteinRef } from '../food.js';
import { series } from '../body.js';
import { WEEKDAYS_SHORT } from '../dates.js';
import { svg } from '../icons.js';
import { backBar, esc, nav, numTxt, shortDate } from './ui.js';

export function foodOn(S) {
  return !!(S.hasFoodSchema && S.profile && (S.profile.modules || []).includes('essen'));
}

const LEAF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21c0-9 6-15 15-16-1 9-7 15-15 16z"></path><path d="M5 21l8-8"></path></svg>';
const X = (size = 16) => svg('M6 6l12 12M18 6L6 18', size);
const timeTxt = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const PORTIONS = [[0.75, 'klein'], [1, 'normal'], [1.5, 'groß']];
const portionTxt = (p) => (PORTIONS.find(([v]) => v === Number(p)) || [0, `${numTxt(p, 2)}×`])[1];

export function weightOf(S) {
  const s = series(S.body || [], 'weight');
  return s.length ? s[s.length - 1].v : null;
}

function bar(pct, color = 'var(--food)') {
  return `<span class="food-track"><span style="width: ${Math.min(100, pct || 0)}%; background: ${color}"></span></span>`;
}

// ───────────── Karte auf der Übersicht ─────────────

export function foodCard(S, T) {
  if (!foodOn(S)) return '';
  const d = dayFood(S.meals, T);
  const w = week(S.meals, T, weightOf(S));
  const pref = proteinRef(weightOf(S));
  const eaten = d.meals.map((m) => `<a class="food-row" href="#/essen/${esc(m.id)}"><span><b>${esc(m.name)}</b> <span class="muted">· ${timeTxt(m.at)}</span></span><span class="food-plus">+${(m.plants || []).length} 🌱</span></a>`).join('');
  return `<section class="card pad food-card">
    <a class="reduce-head" href="#/essen"><span class="reduce-ico food-ico">${LEAF}</span><b style="flex: 1">Essen heute</b><span class="small" style="color: var(--c-blue)">Woche ›</span></a>
    <div class="stat3 inner">
      <div><div class="small muted">Pflanzen</div><b>${d.plants.length}<span class="small muted" style="font-weight: 500"> / 5</span></b>${bar((d.plants.length / 5) * 100)}</div>
      <div><div class="small muted food-label">Hülsen&shy;früchte</div><b>${w.legumes}<span class="small muted" style="font-weight: 500"> × Woche</span></b></div>
      <div><div class="small muted">Eiweiß</div><b>${d.protein == null ? 0 : d.protein}<span class="small muted" style="font-weight: 500"> g</span></b>${bar(((d.protein || 0) / pref) * 100, 'var(--c-blue)')}</div>
    </div>
    ${eaten ? `<div class="food-list">${eaten}</div>` : ''}
    ${S.foodUndo ? '<button type="button" class="link-btn" data-action="food-undo">Gezählt · Rückgängig</button>' : ''}
    <a class="btn ghost food-btn" href="#/essen-neu">Essen eintragen</a>
  </section>`;
}

// ───────────── Woche ─────────────

function nutrBars(list) {
  return list.map((n) => `<div class="food-nrow"><span>${esc(n.label)}${n.pct != null && n.pct >= 100 ? ' ★' : ''}</span>${bar(n.pct, n.pct == null ? 'var(--border)' : 'var(--food)')}<b>${n.pct == null ? '–' : `${n.pct} %`}</b></div>`).join('');
}

export function foodView(S, T) {
  if (!foodOn(S)) {
    return `<div class="app">${backBar('#/', 'Übersicht')}<div class="wrap"><p class="hint-card">Schalte „Essen“ im Profil ein.</p></div>${nav('overview')}</div>`;
  }
  const kg = weightOf(S);
  const w = week(S.meals, T, kg);
  const slots = Array.from({ length: Math.max(30, w.album.length) }, (_, i) => w.album[i]
    ? `<button type="button" class="album-slot" data-action="plant-info" data-id="${esc(w.album[i])}" title="${esc(w.album[i])}">${esc(w.album[i])}</button>`
    : '<span class="album-slot empty"></span>').join('');
  const disc = discovery(w.percent);
  const end = w.days[6].day;
  const days = w.days.map((d, i) => `<div class="food-day"><span data-state="${d.future ? 'future' : (d.home ? 'home' : (d.out ? 'out' : 'none'))}">${d.home ? d.home : ''}</span><small>${WEEKDAYS_SHORT[i]}</small></div>`).join('');
  const favs = (S.mealFavorites || []).map((f) => `<div class="queue-row"><span style="flex: 1; min-width: 0"><b>${esc(f.name)}</b> <span class="small muted">· ${(f.plants || []).length} Pflanzen</span></span>
    <button type="button" class="goal-del" data-action="food-fav-del" data-id="${esc(f.id)}" aria-label="Favorit ${esc(f.name)} löschen">${X()}</button></div>`).join('');
  return `<div class="app">${backBar('#/', 'Übersicht')}<div class="wrap" style="gap: 14px">
    <div style="padding: 0 4px"><h1 style="font-size: 28px">Essen</h1>
      <div class="small muted" style="font-size: 14px">Woche ${shortDate(w.start)} – ${shortDate(end)}</div></div>
    ${!S.hasBls ? '<p class="hint-card">Die Lebensmittel-Daten fehlen noch: <code>bls_motivator.csv</code> in die Tabelle <code>bls_foods</code> importieren. Pflanzen zählen geht schon.</p>' : ''}
    <section class="album">
      <div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 14px; font-weight: 600; opacity: 0.9">Sammelalbum: verschiedene Pflanzen</span><b style="font-size: 22px">${w.album.length} / 30</b></div>
      <div class="album-grid">${slots}</div>
      <p>Jede Pflanze zählt einmal pro Woche – Gemüse, Obst, Hülsenfrüchte, Nüsse, Samen, Getreide, Kräuter. Antippen für ein Wikipedia-Häppchen.</p>
    </section>
    <section class="stat3">
      <div class="card"><div class="small muted">Pflanzen am Tag</div><b>${w.plantsAvg == null ? '–' : `Ø ${numTxt(w.plantsAvg, w.plantsAvg % 1 ? 1 : 0)}`}</b><div class="small muted">5 an ${w.fiveDays} von ${w.logged} Tagen</div></div>
      <div class="card"><div class="small muted">Hülsenfrüchte</div><b>${w.legumes} ×</b><div class="small muted">letzte Woche ${w.legumesPrev} ×</div></div>
      <div class="card"><div class="small muted">Eiweiß</div><b>${w.proteinAvg == null ? '–' : `Ø ${w.proteinAvg} g`}</b><div class="small muted">Richtwert ~${proteinRef(kg)} g</div></div>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">Nährstoffe der Woche</h2><span class="small muted">Ø vom Tagesbedarf</span></div>
      ${w.percent.length ? nutrBars(w.percent) : '<p class="small muted">Sobald du etwas einträgst, steht hier, was drinsteckt.</p>'}
      ${disc ? `<div class="food-disc"><b>Entdeckung:</b> ${esc(disc.label)} ist bei dir gerade eher knapp (${disc.pct} %). Steckt z. B. in ${esc(disc.tip)}.</div>` : ''}
      <p class="small muted" style="line-height: 1.45">★ = Woche im Schnitt voll. Werte aus dem Bundeslebensmittelschlüssel (BLS 4.0, Max Rubner-Institut), Tagesbedarf nach DGE, Eiweiß 0,8 g je kg${kg ? ` (${numTxt(kg, 1)} kg)` : ''}. Schätzungen – für Trends gut, für Diagnosen nicht.</p>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
      <h2 style="font-size: 17px">Selbst gekocht</h2>
      <div class="food-days">${days}</div>
      <p class="small muted">${w.home} ${w.home === 1 ? 'Mahlzeit' : 'Mahlzeiten'} selbst gekocht, ${w.out} sonst – einfach so, ohne Ziel.</p>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">Favoriten</h2><a class="link-btn" href="#/essen-neu">+ Neu</a></div>
      ${favs || '<p class="small muted">Beim Eintragen „Als Favorit merken“ ankreuzen – dann reicht künftig ein Tipp unter „Essen eintragen“.</p>'}
    </section>
  </div>${nav('overview')}${plantSheet(S)}</div>`;
}

// ───────────── Wikipedia-Häppchen zu einer Pflanze ─────────────

export function plantSheet(S) {
  const name = S.plantInfo;
  if (!name) return '';
  const w = S.wiki['p:' + name];
  let body = '<p class="muted">Lädt …</p>';
  if (w && w.state === 'ok') {
    const d = w.data;
    body = `${d.image ? `<img class="city-img" src="${esc(d.image)}" alt="" loading="lazy">` : ''}<p style="line-height: 1.5">${esc(d.extract)}</p>
      <a class="btn ghost" href="${esc(d.url)}" target="_blank" rel="noopener">Weiterlesen auf Wikipedia</a><p class="small muted">Text: Wikipedia, Lizenz CC BY-SA 4.0</p>`;
  } else if (w && (w.state === 'none' || w.state === 'error')) {
    body = `<p class="muted">${w.state === 'error' ? 'Wikipedia ist gerade nicht erreichbar.' : 'Dazu hat Wikipedia gerade keinen kurzen Text.'}</p>`;
  }
  const legume = isLegume(name) ? '<span class="pill">Hülsenfrucht</span>' : '';
  return `<button type="button" class="scrim" data-action="plant-close" aria-label="Schließen"></button>
  <section class="sheet goal-sheet" role="dialog" aria-modal="true" aria-label="${esc(name)}">
    <div class="handle"></div>
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px">
      <h2 style="font-size: 24px">${esc(name)} ${legume}</h2>
      <button type="button" class="goal-del" data-action="plant-close" aria-label="Schließen" style="border: 0">${X(20)}</button>
    </div>
    ${body}
  </section>`;
}

// ───────────── Eintragen ─────────────

function plantPicker(S, chosen) {
  const group = S.foodGroup || PLANT_GROUPS[0];
  const tabs = PLANT_GROUPS.map((g) => `<button type="button" class="chip" data-action="food-group" data-id="${esc(g)}" aria-pressed="${g === group}">${esc(g)}</button>`).join('');
  const chips = PLANTS.filter((p) => p.group === group).map((p) => `<button type="button" class="chip" data-action="food-plant" data-id="${esc(p.name)}" aria-pressed="${chosen.includes(p.name)}">${esc(p.name)}</button>`).join('');
  return `<div class="goal-regions" role="group" aria-label="Pflanzen-Gruppe">${tabs}</div><div class="food-chips">${chips}</div>`;
}

export function foodForm(S, T) {
  if (!foodOn(S)) return foodView(S, T);
  const d = S.foodDraft;
  if (!d) return foodView(S, T);
  const n = nutrOf(d.items, null, d.portion);
  const pct = percentOf(n, weightOf(S)).filter((x) => x.pct != null).sort((a, b) => b.pct - a.pct).slice(0, 4);
  const results = S.foodResults
    ? (S.foodResults.length
      ? S.foodResults.map((f, i) => `<button type="button" class="food-hit" data-action="food-add" data-idx="${i}"><span>${esc(f.name)}</span><span class="small muted">${Math.round(Number(f.kcal) || 0)} kcal/100 g</span></button>`).join('')
      : `<p class="small muted">${S.hasBls ? 'Nichts gefunden – anders schreiben, z. B. „Linse“ statt „Linsen“.' : 'Die Lebensmittel-Daten fehlen noch (CSV importieren).'}</p>`)
    : '';
  const items = d.items.map((it, i) => `<div class="food-item"><span style="flex: 1; min-width: 0"><b>${esc(it.name)}</b></span>
      <button type="button" class="mini-round small" data-action="food-grams" data-idx="${i}" data-id="-1" aria-label="Weniger">−</button>
      <b class="food-g">${it.grams} g</b>
      <button type="button" class="mini-round small" data-action="food-grams" data-idx="${i}" data-id="1" aria-label="Mehr">+</button>
      <button type="button" class="goal-del" data-action="food-item-del" data-idx="${i}" aria-label="${esc(it.name)} entfernen">${X()}</button></div>`).join('');
  const portions = PORTIONS.map(([v, l]) => `<label><input type="radio" name="fportion" value="${v}"${Number(d.portion) === v ? ' checked' : ''} data-action="food-portion"><span>${l}</span></label>`).join('');
  // Favoriten zuerst – nur beim neuen Eintrag und solange noch nichts gesucht/gewählt ist
  const todays = dayFood(S.meals, T).meals;
  const favs = (S.mealFavorites || []).map((f) => {
    const done = todays.some((m) => m.fav_id === f.id);
    return `<button type="button" class="chip food-fav" data-action="food-fav" data-id="${esc(f.id)}" aria-pressed="${done}">${done ? '✓ ' : ''}${esc(f.name)}</button>`;
  }).join('');
  const favBlock = d.editId || d.items.length || S.foodResults ? '' : `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 17px">Wie immer – ein Tipp</h2>
      ${favs ? `<div class="food-chips">${favs}</div>` : '<p class="small muted">Noch keine Favoriten. Unten beim Eintragen „Als Favorit merken“ ankreuzen – dann steht die Mahlzeit künftig hier.</p>'}
    </section>`;
  return `<div class="app">${backBar(d.editId ? `#/essen/${esc(d.editId)}` : '#/', d.editId ? 'Mahlzeit' : 'Übersicht')}<div class="wrap" style="gap: 14px">
    <h1 style="font-size: 28px; padding: 0 4px">${d.editId ? 'Bearbeiten' : 'Essen eintragen'}</h1>
    ${favBlock}
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <h2 style="font-size: 17px">${d.items.length ? 'Noch etwas dazu?' : ((S.mealFavorites || []).length && !d.editId ? 'Etwas anderes?' : 'Was hast du gegessen?')}</h2>
      <form class="goal-search" data-form="food-search" role="search">
        <input class="input" type="search" name="q" value="${esc(S.foodQuery)}" placeholder="Gericht oder Zutat, z. B. Flammkuchen" aria-label="Gericht oder Zutat suchen" enterkeyhint="search" autocomplete="off">
        <button type="submit" class="btn" ${S.foodSearching ? 'disabled' : ''}>${S.foodSearching ? '…' : 'Suchen'}</button>
      </form>
      ${results ? `<div class="food-hits">${results}</div>` : ''}
      ${items ? `<div class="food-items">${items}</div>` : (results ? '' : '<p class="small muted">Für Auswärts reicht oft ein ganzes Gericht – z. B. „Flammkuchen“, „Döner“, „Pizza“. Treffer antippen, dann steht es unten drin.</p>')}
      ${d.items.length || d.name || d.plants.length || d.showName ? `<label class="field"><span>Name des Eintrags</span><input class="input" name="fname" value="${esc(d.name)}" placeholder="z. B. Flammkuchen" data-action="food-name" autocomplete="off"></label>` : ''}
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 17px">Portion</h2>
      <div class="seg small-seg" role="radiogroup" aria-label="Portion">${portions}</div>
      <p class="small muted">Klein = ¾, groß = 1½. Genauer muss es nicht sein.</p>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">Pflanzen · ${d.plants.length}</h2><span class="small muted">Vorschlag – antippen zum Ändern</span></div>
      ${d.plants.length ? `<div class="food-chips">${d.plants.map((p) => `<button type="button" class="chip" data-action="food-plant" data-id="${esc(p)}" aria-pressed="true">${isLegume(p) ? '🫘 ' : ''}${esc(p)} ×</button>`).join('')}</div>` : ''}
      ${plantPicker(S, d.plants)}
    </section>
    ${d.items.length ? `<section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">Was drinsteckt</h2><span class="small muted">${n.kcal == null ? '' : `${Math.round(n.kcal)} kcal`}</span></div>
      ${nutrBars(pct)}
    </section>` : ''}
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <label class="switch-row" style="cursor: pointer"><span><b>Selbst gekocht</b></span><input type="checkbox" class="reduce-check food-check" data-action="food-home" ${d.home ? 'checked' : ''}></label>
      ${d.editId ? '' : `<label class="switch-row" style="cursor: pointer"><span><b>Als Favorit merken</b><br><span class="small muted">Dann reicht künftig ein Tipp – ganz oben beim Eintragen</span></span><input type="checkbox" class="reduce-check food-check" data-action="food-fav-mark" ${d.fav ? 'checked' : ''}></label>`}
    </section>
    <p class="small" style="color: var(--danger); min-height: 18px" id="food-error" role="alert"></p>
    <button type="button" class="btn" data-action="food-save" style="background: var(--food)">${d.editId ? 'Speichern' : 'Eintragen'}</button>
  </div>${nav('overview')}</div>`;
}

// ───────────── Eine Mahlzeit ─────────────

export function mealView(S, T, id) {
  const m = (S.meals || []).find((x) => x.id === id);
  if (!foodOn(S) || !m) return foodView(S, T);
  const pct = percentOf(m.nutr, weightOf(S));
  const portions = PORTIONS.map(([v, l]) => `<label><input type="radio" name="mportion" value="${v}"${Number(m.portion) === v ? ' checked' : ''} data-action="meal-portion" data-id="${esc(m.id)}"><span>${l}</span></label>`).join('');
  const day = m.day === T ? 'heute' : shortDate(m.day);
  return `<div class="app">${backBar('#/essen', 'Essen')}<div class="wrap" style="gap: 14px">
    <div style="padding: 0 4px"><h1 style="font-size: 28px">${esc(m.name)}</h1>
      <div class="small muted" style="font-size: 14px">${day} ${timeTxt(m.at)} · ${m.home ? 'selbst gekocht' : 'auswärts / gekauft'} · ${portionTxt(m.portion)}e Portion</div></div>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">${(m.plants || []).length} ${(m.plants || []).length === 1 ? 'Pflanze' : 'Pflanzen'}</h2><span class="small muted">antippen: Wusstest du …?</span></div>
      ${(m.plants || []).length ? `<div class="food-chips">${m.plants.map((p) => `<button type="button" class="chip" data-action="plant-info" data-id="${esc(p)}">${isLegume(p) ? '🫘 ' : ''}${esc(p)}</button>`).join('')}</div>` : '<p class="small muted">Keine Pflanzen eingetragen.</p>'}
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">Was drinsteckt</h2><span class="small muted">vom Tagesbedarf</span></div>
      ${(m.items || []).length ? nutrBars(pct) : '<p class="small muted">Ohne Zutaten keine Nährwerte – nur Pflanzen gezählt.</p>'}
      ${m.nutr && m.nutr.kcal != null ? `<p class="small muted">${Math.round(m.nutr.kcal)} kcal – steht hier, aber nicht im Mittelpunkt. Werte geschätzt aus dem BLS 4.0.</p>` : ''}
      ${(m.items || []).length ? `<p class="small muted">${m.items.map((it) => `${esc(it.name)} ${it.grams} g`).join(' · ')}</p>` : ''}
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 17px">Portion</h2>
      <div class="seg small-seg" role="radiogroup" aria-label="Portion">${portions}</div>
    </section>
    <div style="display: flex; gap: 10px">
      <button type="button" class="btn ghost" style="flex: 1" data-action="meal-edit" data-id="${esc(m.id)}">Bearbeiten</button>
      ${m.fav_id || (S.mealFavorites || []).some((f) => f.name === m.name) ? '' : `<button type="button" class="btn ghost" style="flex: 1" data-action="meal-to-fav" data-id="${esc(m.id)}">Als Favorit</button>`}
    </div>
    <button type="button" class="link-btn" style="color: var(--danger); align-self: center" data-action="meal-del" data-id="${esc(m.id)}">Eintrag löschen</button>
  </div>${nav('overview')}${plantSheet(S)}</div>`;
}

// ───────────── Profil ─────────────

export function foodProfileCard(S) {
  if (!S.hasFoodSchema) {
    return '<section class="card pad"><b>Essen</b><p class="hint" style="margin-top: 4px">Dafür bitte zuerst das Datenbank-Update <code>015_essen.sql</code> ausführen.</p></section>';
  }
  const on = foodOn(S);
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
    <div class="switch-row" style="cursor: default">
      <div><div style="font-size: 16px; font-weight: 700">Essen</div>
        <div class="small muted">Pflanzen sammeln, Hülsenfrüchte, Eiweiß und Nährstoffe – Entdecken statt Diät</div></div>
      <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Essen nutzen" data-action="module-toggle" data-id="essen"></button>
    </div>
    ${on && !S.hasBls ? '<p class="hint">Noch fehlen die Lebensmittel-Daten: <code>bls_motivator.csv</code> in die Tabelle <code>bls_foods</code> importieren.</p>' : ''}
    ${on ? '<a class="btn ghost" href="#/essen">Öffnen</a>' : ''}
  </section>`;
}

