// Fundstücke: Karte auf der Übersicht (Buchstaben), Feier/Artikel, Sammlung als Pfad.

import { svg, UI_ICONS } from '../icons.js';
import { esc, nav, shortDate } from './ui.js';
import { letterCount, maskTitle, fullDays, AREA_LABEL } from '../finds.js';
import { openFind, foundFinds, latestFound, revealedNow } from '../actions/finds.js';

const COMPASS = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z';
const areaOf = (f) => (f.origin || '').startsWith('Essen') ? 'essen' : (f.origin || '').startsWith('Training') ? 'sport' : (f.origin || '').startsWith('Strecke') ? 'strecke' : null;

function tiles(f, n) {
  return `<div class="find-tiles" aria-label="${n} von ${letterCount(f.title)} Buchstaben aufgedeckt">${maskTitle(f.title, n).map((x) => (x.letter
    ? `<span class="find-tile${x.shown ? ' on' : ''}">${x.shown ? esc(x.c) : ''}</span>`
    : (x.c === ' ' ? '<span class="find-gap"></span>' : `<span class="find-sep">${esc(x.c)}</span>`))).join('')}</div>`;
}

function hint(f) {
  const area = f.source === 'branch' && areaOf(f) ? `Abzweig aus ${AREA_LABEL[areaOf(f)]}` : 'Nächstes Fundstück';
  return `${area}${f.description ? ' · ' + esc(f.description) : ''}`;
}

const confetti = `<svg class="confetti" viewBox="0 0 350 210" preserveAspectRatio="none" aria-hidden="true">
  <rect x="18" y="20" width="9" height="4" rx="1.5" fill="#FFD27A" transform="rotate(-25 22 22)"></rect>
  <rect x="70" y="10" width="7" height="7" rx="3.5" fill="#FFFFFF" opacity="0.7"></rect>
  <rect x="300" y="18" width="10" height="4" rx="1.5" fill="#9FE3D2" transform="rotate(30 305 20)"></rect>
  <rect x="250" y="40" width="6" height="6" rx="3" fill="#FFD27A"></rect>
  <rect x="325" y="70" width="9" height="4" rx="1.5" fill="#FFFFFF" opacity="0.8" transform="rotate(-40 329 72)"></rect>
  <rect x="200" y="12" width="8" height="3.5" rx="1.5" fill="#FFFFFF" opacity="0.6" transform="rotate(15 204 14)"></rect>
  <rect x="150" y="30" width="5" height="5" rx="2.5" fill="#9FE3D2"></rect>
  <rect x="285" y="120" width="7" height="7" rx="3.5" fill="#FFD27A" opacity="0.8"></rect>
  <rect x="12" y="110" width="8" height="3.5" rx="1.5" fill="#9FE3D2" transform="rotate(50 16 112)"></rect>
</svg>`;

// Übersicht: Feier (gerade gefunden), Fundstück des Tages, das nächste mit Buchstaben
export function findCard(S, T) {
  if (!S.hasFindSchema) return '';
  const open = openFind(S);
  const last = latestFound(S);
  let html = '';
  if (S.findCelebrate && last && last.id === S.findCelebrate) {
    html += `<section class="celebrate celebrate-small find-cel">
      ${confetti}
      <button type="button" class="celebrate-x" data-action="find-celebrate-ok" aria-label="Feier schließen">${svg('M6 6l12 12M18 6L6 18', 16)}</button>
      <div style="font-size: 14px; font-weight: 600; opacity: 0.9">Fundstück gefunden 🎉</div>
      <div class="celebrate-city">${esc(last.title)}</div>
      <p>Alle Buchstaben frei – es gehört dir. <a class="find-cel-link" href="#/fund/${esc(last.id)}">Antippen zum Lesen ›</a></p>
    </section>`;
  } else if (last && last.found_day === T) {
    html += `<a class="card pad find-today" href="#/fund/${esc(last.id)}">
      <span class="find-ico">${svg(COMPASS, 26)}</span>
      <span style="flex: 1; min-width: 0"><span class="find-kicker">Fundstück des Tages</span><b class="find-title">${esc(last.title)}</b></span>
      <span aria-hidden="true">›</span>
    </a>`;
  }
  if (open) {
    const n = revealedNow(open, T);
    html += `<a class="card pad find-open" href="#/fundstuecke">
      <span class="find-kicker">${svg(COMPASS, 14)} ${hint(open)}</span>
      ${tiles(open, n)}
      <span class="small muted">${n ? 'Schon eine Idee? Raten erlaubt.' : 'Jede erledigte Gewohnheit deckt Buchstaben auf.'}</span>
    </a>`;
  }
  return html;
}

// Ein Fundstück: Artikel, bei frisch Gefundenem mit Feier und „Wohin geht es weiter?“
export function findView(S, T, id) {
  const f = (S.finds || []).find((x) => x.id === id);
  const back = `<div class="bar"><a class="link-btn" href="#/fundstuecke">${svg(UI_ICONS.back, 20, 2.2)}Fundstücke</a></div>`;
  if (!f || !f.found_day) {
    return `<div class="app">${back}<div class="wrap"><p class="hint-card">Dieses Fundstück ist noch nicht freigespielt.</p></div>${nav('overview')}</div>`;
  }
  const isLatest = latestFound(S) === f;
  const choosing = isLatest && !openFind(S);
  const opts = (f.options || []).map((o) => `<button type="button" class="find-opt${f.chosen === o.title ? ' on' : ''}" data-action="find-choose" data-id="${esc(o.title)}" data-find="${esc(f.id)}"${choosing ? '' : ' disabled'}><b>${esc(o.description || `Ein Artikel mit ${letterCount(o.title)} Buchstaben`)}</b></button>`).join('');
  const fresh = f.found_day === T && isLatest;
  return `<div class="app">${back}
    <div class="wrap" style="gap: 14px">
      ${fresh ? `<div style="text-align: center; padding: 4px 0"><div style="font-size: 28px; font-weight: 700">Gefunden 🎉</div><div class="small muted" style="font-size: 15px">${fullDays(S.habits, S.idx, S.pauses, T)} volle Tage bisher – diese Zahl wächst nur.</div></div>` : ''}
      <article class="card find-article">
        ${f.image ? `<img src="${esc(f.image)}" alt="" class="find-img" loading="lazy">` : `<div class="find-img find-img-empty">${svg(COMPASS, 40)}</div>`}
        <div class="pad" style="display: flex; flex-direction: column; gap: 8px">
          <span class="find-kicker">${f.source === 'branch' && areaOf(f) ? `Abzweig aus ${AREA_LABEL[areaOf(f)]}` : f.source === 'start' ? 'Start deiner Wanderung' : 'Deine Wanderung'} · ${esc(shortDate(f.found_day))}</span>
          <h1 style="font-size: 26px">${esc(f.title)}</h1>
          ${f.description ? `<div class="small muted">${esc(f.description)}</div>` : ''}
          <p class="find-extract">${esc(f.extract || 'Der Text wird geladen, sobald Wikipedia erreichbar ist.')}</p>
          ${f.origin ? `<div class="small muted">${esc(f.origin)}</div>` : ''}
          ${f.url ? `<a class="link-btn" href="${esc(f.url)}" target="_blank" rel="noopener" style="padding: 0">Weiterlesen auf Wikipedia ›</a>` : ''}
        </div>
      </article>
      ${isLatest ? `<section style="display: flex; flex-direction: column; gap: 8px">
        <h2 class="h3">Wohin geht es weiter?</h2>
        ${opts || `<p class="hint" style="padding: 0 4px">${choosing ? 'Ziele werden geladen …' : 'Es geht schon weiter – siehe Übersicht.'}</p>`}
        <p class="hint" style="padding: 0 4px">${f.chosen ? 'Gemerkt. Den Titel spielst du dir mit deinen Gewohnheiten frei – Buchstabe für Buchstabe.' : (choosing ? 'Du wählst nach Beschreibung – der Titel bleibt ein Rätsel. Ohne Wahl geht es zufällig weiter. Bringt dein Tag etwas Neues (Strecke, Training, Essen), zweigt der Pfad dorthin ab.' : '')}</p>
      </section>` : ''}
      ${fresh ? `<button type="button" class="btn" data-action="find-done" data-id="${esc(f.id)}">In die Sammlung</button>` : ''}
      <p class="small muted" style="text-align: center">Quelle: Wikipedia (CC BY-SA)</p>
    </div>
    ${nav('overview')}
  </div>`;
}

// Sammlung: volle Tage, das nächste Rätsel, der Pfad
export function findsView(S, T) {
  const back = `<div class="bar"><a class="link-btn" href="#/">${svg(UI_ICONS.back, 20, 2.2)}Übersicht</a></div>`;
  if (!S.hasFindSchema) {
    return `<div class="app">${back}<div class="wrap"><h1 style="padding: 0 4px">Fundstücke</h1><section class="card pad"><p class="hint">Bitte zuerst das Datenbank-Update <code>018_fundstuecke.sql</code> im Supabase SQL-Editor ausführen.</p></section></div>${nav('overview')}</div>`;
  }
  const found = foundFinds(S).slice().reverse();
  const open = openFind(S);
  const rows = found.map((f, i) => `<a class="find-row" href="#/fund/${esc(f.id)}">
      <span class="find-rail"><span class="find-dot${f.source !== 'walk' ? ' branch' : ''}"></span>${i < found.length - 1 ? '<span class="find-line"></span>' : ''}</span>
      <span style="flex: 1; min-width: 0; padding-bottom: 12px"><span style="display: flex; justify-content: space-between; gap: 8px"><b>${esc(f.title)}</b><span class="small muted" style="white-space: nowrap">${f.found_day === T ? 'heute' : esc(shortDate(f.found_day))}</span></span>
        <span class="small muted">${esc(f.origin || '')}</span></span>
    </a>`).join('');
  return `<div class="app">${back}
    <div class="wrap" style="gap: 14px">
      <h1 style="padding: 0 4px">Fundstücke</h1>
      <section class="grid2">
        <div class="card stat"><div class="small muted">volle Tage</div><div class="num">${fullDays(S.habits, S.idx, S.pauses, T)}</div></div>
        <div class="card stat"><div class="small muted">gefunden</div><div class="num">${found.length}</div></div>
      </section>
      ${open ? `<section class="card pad find-open"><span class="find-kicker">${svg(COMPASS, 14)} ${hint(open)}</span>${tiles(open, revealedNow(open, T))}
        <span class="small muted">Jede erledigte Gewohnheit deckt Buchstaben auf – ist alles frei, gehört das Fundstück dir. Aufgedecktes bleibt, auch über Nacht.</span></section>` : ''}
      ${found.length ? `<section class="card pad"><div class="section-head" style="margin: 0 0 12px"><h2 style="font-size: 17px">Deine Wanderung</h2><span class="small muted">neueste oben</span></div>${rows}</section>
        <p class="hint" style="padding: 0 4px">Blau: weitergewandert. Grün: abgezweigt, weil dein Tag etwas Neues brachte. Ein Tag ohne Haken lässt die Wanderung einfach warten – nichts geht verloren.</p>` : '<p class="hint" style="padding: 0 4px">Noch nichts gefunden – dein erstes Fundstück wartet oben.</p>'}
    </div>
    ${nav('overview')}
  </div>`;
}
