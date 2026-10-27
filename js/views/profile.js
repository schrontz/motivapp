// Profil: Verbindungen, Module, Kacheln, Installieren, Login.

import { APP_VERSION } from '../config.js';
import { reduceProfileCard } from './reduce.js';
import { alcoholProfileCard } from './alcohol.js';
import { foodProfileCard } from './food.js';
import { remindProfileCard } from './remind.js';
import { reduceOn } from './reduce.js';
import { alcoholOn } from './alcohol.js';
import { foodOn } from './food.js';
import { HOME_BLOCKS, homeOrder } from '../home.js';
import { svg, UI_ICONS, COLORS } from '../icons.js';
import { ago, alphaOn, bodyOn, esc, nav, shortDate } from './ui.js';

export function withingsCard(S) {
  if (!S.hasWithingsSchema) {
    return `<section class="card pad"><b>Withings</b><p class="hint" style="margin-top: 4px">Bitte zuerst das Datenbank-Update <code>003_withings.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const w = S.withings || {};
  const status = S.syncing ? 'Gleicht gerade ab …' : (w.connected ? `Verbunden · zuletzt abgeglichen ${ago(w.last_sync_at)}` : 'Nicht verbunden');
  return `<section style="display: flex; flex-direction: column; gap: 10px">
    <h2 class="h3">Verbindungen</h2>
    <div class="card pad" style="display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; align-items: center; gap: 12px">
        <div class="hicon" style="width: 44px; height: 44px; border-radius: 14px; background: var(--soft)">${svg('M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 6V3h6v3M9 18v3h6v-3M12 9v3l2 1', 22)}</div>
        <div style="flex: 1"><div style="font-size: 16px; font-weight: 700">Withings</div><div class="small" style="color: ${w.connected ? 'var(--mini-fg)' : 'var(--muted)'}">${status}</div></div>
      </div>
      ${w.connected
        ? `<div class="grid2">
            <button type="button" class="btn ghost" data-action="withings-sync"${S.syncing ? ' disabled' : ''}>Jetzt abgleichen</button>
            <button type="button" class="btn danger" data-action="withings-disconnect">Trennen</button>
          </div>
          <p class="hint">Abgleich passiert automatisch, wenn du die App öffnest.</p>`
        : `<p class="hint">Schritte und Trainings deiner Uhr kommen dann automatisch in die App. Du meldest dich dafür einmal bei Withings an und tippst auf „Erlauben“.</p>
          ${S.ios && S.standalone ? '<p class="hint"><b>iPhone:</b> Die Verbindung bitte einmal im <b>Browser</b> herstellen (Chrome oder Safari: Motivator-Seite öffnen, anmelden, hier verbinden) – nicht in der installierten App. Danach gleicht auch die App ab.</p>' : ''}
          <button type="button" class="btn" data-action="withings-connect">Mit Withings verbinden</button>`}
    </div>
  </section>`;
}

export function tilesCard(S) {
  const tiles = new Set((S.profile && S.profile.tiles) || ['steps', 'training']);
  const defs = [];
  if (S.hasWithingsSchema && ((S.withings && S.withings.connected) || S.activity.length)) {
    defs.push(['steps', 'Schritte', 'heute · Withings'], ['training', 'Training', 'letzte 7 Tage · Withings'], ['active', 'Aktive Minuten', 'heute · Withings'], ['distance', 'Strecke', 'heute · Withings']);
  }
  if (bodyOn(S)) defs.push(['body', 'Körper', 'Gewicht · Renpho']);
  if (!defs.length) return '';
  return `<section style="display: flex; flex-direction: column; gap: 10px">
    <h2 class="h3">Kacheln auf der Übersicht</h2>
    <div class="card list">
      ${defs.map(([id, label, src]) => `<div class="cat-row" style="justify-content: space-between">
        <div><div style="font-size: 16px; font-weight: 600">${label}</div><div class="small muted">${src}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${tiles.has(id)}" aria-label="${label} anzeigen" data-action="tile-toggle" data-id="${id}"></button>
      </div>`).join('')}
    </div>
  </section>`;
}

export function bodyCard(S) {
  if (!S.hasBodySchema) {
    return `<section class="card pad"><b>Körperwerte (Renpho)</b><p class="hint" style="margin-top: 4px">Für den Import bitte zuerst das Datenbank-Update <code>005_koerper.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const on = bodyOn(S);
  const n = (S.body || []).length;
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
      <div class="switch-row" style="cursor: default">
        <div><div style="font-size: 16px; font-weight: 700">Körperwerte (Renpho)</div>
          <div class="small muted">${on ? (n ? `${n} Messtage · zuletzt ${shortDate(S.body[n - 1].day)}` : 'Noch nichts importiert') : 'Gewicht, Körperfett, Muskeln als Trend'}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Körperwerte nutzen" data-action="module-toggle" data-id="body"></button>
      </div>
      ${on ? '<a class="btn ghost" href="#/body-import">Renpho importieren</a>' : ''}
    </section>`;
}

export function alphaCard(S) {
  if (!S.hasStrengthSchema) {
    return `<section class="card pad"><b>Alpha Progression</b><p class="hint" style="margin-top: 4px">Für den Import bitte zuerst das Datenbank-Update <code>004_kraft.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const on = alphaOn(S);
  const n = (S.strength || []).length;
  const lastDay = n ? S.strength.map((x) => x.day).sort().pop() : null;
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
      <div class="switch-row" style="cursor: default">
        <div><div style="font-size: 16px; font-weight: 700">Alpha Progression</div>
          <div class="small muted">${on ? (n ? `${n} Einheiten · zuletzt ${shortDate(lastDay)}` : 'Noch nichts importiert') : 'Übungen, Sätze und Steigerung aus der App'}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Alpha Progression nutzen" data-action="module-toggle" data-id="alpha"></button>
      </div>
      ${on ? '<a class="btn ghost" href="#/import">Trainings importieren</a>' : ''}
    </section>`;
}

export function installCard(S) {
  if (S.standalone) return '';
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; align-items: center; gap: 12px">
        <img src="icons/icon-192.png" width="44" height="44" alt="" style="border-radius: 12px">
        <div><div style="font-size: 16px; font-weight: 700">Als App installieren</div><div class="small muted">${S.ios ? 'Eigenes Symbol auf dem Home-Bildschirm, ohne Adressleiste.' : 'Eigenes Symbol, ohne Adressleiste – und „Teilen → Motivator“ klappt.'}</div></div>
      </div>
      ${S.ios
        ? `<ol class="ios-steps">
            <li>${S.iosSafari ? 'Unten' : (S.iosChrome ? 'Oben in der Adressleiste' : 'Im Browser')} auf <b>Teilen</b> tippen ${svg('M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7', 16)}</li>
            <li>Nach unten wischen: <b>„Zum Home-Bildschirm“</b></li>
            <li>Oben rechts <b>„Hinzufügen“</b> – fertig.</li>
          </ol>
          ${S.iosSafari || S.iosChrome ? '' : '<p class="hint">Klappt es hier nicht, die Seite in Safari oder Chrome öffnen.</p>'}`
        : S.canInstall
        ? '<button type="button" class="btn" data-action="install">Motivator installieren</button>'
        : '<p class="hint">Chrome: Menü ⋮ → „App installieren“ (oder „Zum Startbildschirm hinzufügen“ → „Installieren“). Erscheint das nicht, die Seite einmal neu laden und kurz warten.</p>'}
    </section>`;
}

// Welche Blöcke gerade auf dem Startbildschirm stehen können
export function homeVisible(S) {
  const v = new Set(['rings', 'heute', 'gesamt', 'werte']);
  if (S.hasFindSchema) v.add('fund');
  if (reduceOn(S)) v.add('weniger');
  if (alcoholOn(S)) v.add('alkohol');
  if (foodOn(S)) v.add('essen');
  return v;
}

export function homeCard(S) {
  if (!S.profile) return '';
  if (!('home_order' in S.profile)) {
    return `<section class="card pad"><b>Startbildschirm anordnen</b><p class="hint" style="margin-top: 4px">Bitte zuerst das Datenbank-Update <code>020_startbildschirm.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const visible = homeVisible(S);
  const list = homeOrder(S.profile.home_order).filter((id) => visible.has(id));
  const label = Object.fromEntries(HOME_BLOCKS.map((b) => [b.id, b]));
  const move = (id, i, dir) => {
    const off = dir < 0 ? i === 0 : i === list.length - 1;
    return `<button type="button" class="queue-move" data-action="home-move" data-id="${id}" data-dir="${dir}"${off ? ' disabled' : ''} aria-label="${esc(label[id].label)} ${dir < 0 ? 'nach oben' : 'nach unten'}">${svg(dir < 0 ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6', 18, 2.2)}</button>`;
  };
  return `<section style="display: flex; flex-direction: column; gap: 10px">
    <div class="section-head" style="margin: 0"><h2 class="h3">Startbildschirm</h2>${S.profile.home_order ? '<button type="button" class="link-btn" data-action="home-reset">Zurücksetzen</button>' : ''}</div>
    <div class="card list">
      ${list.map((id, i) => `<div class="cat-row" style="justify-content: space-between">
        <div style="min-width: 0"><div style="font-size: 16px; font-weight: 600">${esc(label[id].label)}</div><div class="small muted">${esc(label[id].sub)}</div></div>
        <span class="queue-moves">${move(id, i, -1)}${move(id, i, 1)}</span>
      </div>`).join('')}
    </div>
    <p class="hint" style="padding: 0 4px">Von oben nach unten, wie auf der Übersicht. Ein- und ausblenden geht bei den Modulen.</p>
  </section>`;
}

// ───────────── Profil ─────────────

export function profile(S, email) {
  const cats = S.categories.map((c) => `<div class="cat-row">
      <input class="input" value="${esc(c.name)}" maxlength="40" aria-label="Name der Kategorie" data-action="cat-rename" data-id="${esc(c.id)}">
      <select class="input" aria-label="Farbe" data-action="cat-color" data-id="${esc(c.id)}">
        ${COLORS.map((x) => `<option value="${x.id}"${c.color === x.id ? ' selected' : ''}>${x.label}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn" data-action="cat-delete" data-id="${esc(c.id)}" aria-label="Kategorie ${esc(c.name)} löschen" style="border: 0">${svg('M6 6l12 12M18 6L6 18', 18)}</button>
    </div>`).join('');
  return `<div class="app">
    <header class="top"><div><h1>Profil</h1><div class="small muted" style="margin-top: 4px">${esc(email || '')}</div></div></header>
    <div class="wrap" style="margin-top: 8px; gap: 16px">
      <section class="card pad field">
        <label for="p-name">Wie soll ich dich nennen?</label>
        <input id="p-name" class="input" value="${esc((S.profile && S.profile.display_name) || '')}" maxlength="40" data-action="profile-name">
      </section>
      <section style="display: flex; flex-direction: column; gap: 10px">
        <h2 class="h3">Kategorien</h2>
        ${S.categories.length ? `<div class="card list">${cats}</div>` : '<p class="hint" style="padding: 0 4px">Noch keine Kategorien. Du kannst sie hier oder beim Anlegen einer Gewohnheit erstellen.</p>'}
        <form class="card pad" data-form="new-cat" style="display: flex; gap: 10px">
          <input class="input" name="name" maxlength="40" placeholder="Neue Kategorie" aria-label="Neue Kategorie">
          <button type="submit" class="icon-btn" aria-label="Kategorie hinzufügen">${svg(UI_ICONS.plus)}</button>
        </form>
      </section>
      ${installCard(S)}
      ${remindProfileCard(S)}
      ${withingsCard(S)}
      ${alphaCard(S)}
      ${bodyCard(S)}
      ${reduceProfileCard(S)}
      ${alcoholProfileCard(S)}
      ${foodProfileCard(S)}
      ${homeCard(S)}
      ${tilesCard(S)}
      <section style="display: flex; flex-direction: column; gap: 10px">
        <h2 class="h3">Deine Daten</h2>
        <button type="button" class="btn ghost" data-action="export">Alle Daten herunterladen</button>
        <p class="hint" style="padding: 0 4px">Speichert alles als Datei – als Sicherung oder zum Mitnehmen.</p>
      </section>
      <button type="button" class="btn danger" data-action="logout">Abmelden</button>
      <p class="small muted" style="text-align: center">Version ${APP_VERSION}</p>
    </div>
    ${nav('profile')}
  </div>`;
}

// ───────────── Willkommen zurück ─────────────

export function login(error) {
  return `<form class="login" data-form="login">
    <div>
      <h1>Motivator</h1>
      <p class="muted" style="margin-top: 6px">Schön, dass du da bist.</p>
    </div>
    <div class="field"><label for="l-mail">E-Mail</label><input id="l-mail" class="input" type="email" name="email" autocomplete="username" required></div>
    <div class="field"><label for="l-pw">Passwort</label><input id="l-pw" class="input" type="password" name="password" autocomplete="current-password" required></div>
    <p class="small" style="color: var(--danger); min-height: 18px" role="alert">${esc(error || '')}</p>
    <button type="submit" class="btn">Anmelden</button>
  </form>`;
}
