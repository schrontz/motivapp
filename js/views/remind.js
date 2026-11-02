// Erinnerung: Einstellungen (eine Uhrzeit, woran erinnern, dieses Gerät) und „meist gegen“ bei der Gewohnheit.

import { svg, UI_ICONS } from '../icons.js';
import { esc } from './ui.js';
import { openForReminder, reminderText, timeText, usualFor, isAuto, remindable, MIN_USUAL, DEFAULT_TIME, USUAL_LEAD, weekChanges } from '../remind.js';
import { isPeriodic } from '../stats.js';

export const hasRemindSchema = (S) => !!(S.profile && 'remind_on' in S.profile);
// Eigene Erinnerung pro Gewohnheit kommt mit 022 (zusammen mit den Startbildschirm-Kacheln)
export const hasUsualSchema = (S) => !!(S.profile && 'home_tiles' in S.profile);

const dayPart = (min) => (min < 11 * 60 ? 'morgens' : min < 14 * 60 ? 'mittags' : min < 17 * 60 + 30 ? 'nachmittags' : 'abends');

// Zeile unter einer Gewohnheit auf der Erinnerungs-Seite: eigene Erinnerung zur üblichen Zeit
function ownRow(S, h, T) {
  if (!hasUsualSchema(S) || !remindable(h)) return '';
  const u = usualFor(h, S.logs, S.workouts, T);
  const on = h.remind_mode === 'usual';
  const sub = u.min != null
    ? (on ? `kommt um ${timeText(u.min - USUAL_LEAD)} statt am Abend` : `um ${timeText(u.min - USUAL_LEAD)} – meist gegen ${timeText(u.min)}`)
    : `sobald die Zeit gelernt ist (${u.n} von ${MIN_USUAL})${on ? ' – bis dahin am Abend' : ''}`;
  return `<div class="switch-row remind-own">
    <span><span style="display: block; font-size: 15px">Eigene Erinnerung</span><span class="small muted">${sub}</span></span>
    <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${esc(h.name)}: eigene Erinnerung zur üblichen Zeit" data-action="remind-mode" data-id="${esc(h.id)}" data-mode="${on ? 'daily' : 'usual'}"></button>
  </div>`;
}

// Angebot bei der Gewohnheit (Mockup „meist gegen“): nur wenn die übliche Zeit deutlich vor der Abend-Erinnerung liegt
export function usualOffer(S, h, T) {
  if (!hasUsualSchema(S) || !S.profile.remind_on || !remindable(h)) return '';
  const u = usualFor(h, S.logs, S.workouts, T);
  if (u.min == null) return '';
  const at = timeText(u.min - USUAL_LEAD);
  if (h.remind_mode === 'usual') {
    return `<div class="small muted usual" style="padding: 0 4px">${svg('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0', 15)}Eigene Erinnerung um ${at} · <a href="#/erinnerung" class="link-inline">ändern</a></div>`;
  }
  const evening = S.profile.remind_at == null ? DEFAULT_TIME : S.profile.remind_at;
  if (h.remind_mode === 'daily' || u.min > evening - 120) return '';
  return `<section class="offer">
    <div style="font-size: 15px; line-height: 1.4">${esc(h.name)} machst du meist <b>${dayPart(u.min)}</b> – die Abend-Erinnerung kommt da spät. Eigene Erinnerung um <b>${at}</b>?</div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <button type="button" class="btn small" data-action="remind-mode" data-id="${esc(h.id)}" data-mode="usual">Ja, um ${at}</button>
      <button type="button" class="link-btn" data-action="remind-mode" data-id="${esc(h.id)}" data-mode="daily">Passt so</button>
    </div>
  </section>`;
}

const CLOCK = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2';

function deviceText(d) {
  switch (d && d.state) {
    case 'on': return ['Dieses Gerät bekommt die Erinnerung', 'erlaubt ✓', true];
    case 'denied': return ['Nachrichten sind für Motivator blockiert – in den Einstellungen des Handys erlauben', 'blockiert', false];
    case 'ios-browser': return ['Auf dem iPhone nur in der App vom Home-Bildschirm', 'nicht hier', false];
    case 'unsupported': return ['Dieser Browser kann keine Nachrichten empfangen', 'geht nicht', false];
    case 'checking': return ['Wird geprüft …', '…', false];
    default: return ['Noch nicht erlaubt', 'aus', false];
  }
}

function deviceCard(S) {
  const d = S.pushDevice || { state: 'checking' };
  const [sub, tag, ok] = deviceText(d);
  const busy = !!S.pushBusy;
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px">
      <div><div style="font-size: 16px; font-weight: 700">Auf diesem Gerät</div><div class="small muted">${sub}</div></div>
      <span class="remind-tag${ok ? ' on' : ''}">${tag}</span>
    </div>
    ${d.state === 'off' ? `<button type="button" class="btn" data-action="remind-allow"${busy ? ' disabled' : ''}>${busy ? 'Einen Moment …' : 'Erinnerungen erlauben'}</button>` : ''}
    ${d.state === 'on' ? `<div class="grid2">
        <button type="button" class="btn ghost" data-action="remind-test"${busy ? ' disabled' : ''}>Probe schicken</button>
        <button type="button" class="btn ghost" data-action="remind-device-off"${busy ? ' disabled' : ''}>Hier ausschalten</button>
      </div>` : ''}
    <p class="hint">${S.ios ? 'iPhone: geht nur in der App vom Home-Bildschirm (ab iOS 16.4), nicht im Browser-Tab. ' : ''}Jedes Gerät erlaubt für sich.</p>
  </section>`;
}

export function remindView(S, T) {
  const back = `<div class="bar"><a class="link-btn" href="#/profile">${svg(UI_ICONS.back, 20, 2.2)}Profil</a></div>`;
  if (!hasRemindSchema(S)) {
    return `<div class="app">${back}<div class="wrap"><h1 style="padding: 0 4px">Erinnerung</h1>
      <section class="card pad"><p class="hint">Bitte zuerst das Datenbank-Update <code>017_erinnerung.sql</code> im Supabase SQL-Editor ausführen und die Funktion „erinnerung“ einspielen.</p></section></div></div>`;
  }
  const p = S.profile;
  const on = !!p.remind_on;
  const at = p.remind_at == null ? DEFAULT_TIME : p.remind_at;
  const habits = S.habits.filter((h) => !h.archived);
  const rows = habits.map((h) => {
    const auto = isAuto(h);
    const sched = isPeriodic(h) ? 'nur wenn es in der Woche knapp wird' : (Array.isArray(h.auto_categories) && h.auto_categories.length ? 'hakt sich nach dem Training selbst ab' : '');
    return `<label class="switch-row remind-row${auto ? ' is-auto' : ''}">
      <span><span style="display: block; font-size: 16px; font-weight: 600">${esc(h.name)}</span>
        <span class="small muted">${auto ? 'kommt von der Uhr' : sched}</span></span>
      <input type="checkbox" class="reduce-check" data-action="remind-habit" data-id="${esc(h.id)}"${!auto && h.remind !== false ? ' checked' : ''}${auto ? ' disabled' : ''} aria-label="${esc(h.name)} in die Erinnerung">
    </label>${ownRow(S, h, T)}`;
  }).join('');
  const text = reminderText(openForReminder(S.habits, S.logs, S.pauses, T), S.plans ? weekChanges(S.plans, S.strength || [], T) : []);
  const preview = text
    ? `<div class="remind-note"><span class="remind-app">M</span><div style="min-width: 0; flex: 1">
        <div style="display: flex; justify-content: space-between; font-size: 13px"><b>Motivator</b><span class="muted">${timeText(at)}</span></div>
        <div style="font-size: 15px; font-weight: 600">${esc(text.title)}</div><div style="font-size: 15px">${esc(text.body)}</div></div></div>`
    : '<p class="hint" style="padding: 0 4px">Gerade ist alles erledigt – heute käme keine Nachricht.</p>';
  return `<div class="app">${back}
    <div class="wrap remind-page" style="gap: 14px">
      <div style="padding: 0 4px"><h1>Erinnerung</h1>
        <p class="small muted" style="margin-top: 4px">Einmal am Tag, nur wenn noch etwas offen ist. Ist alles erledigt oder ist Pause, bleibt das Handy still.</p></div>
      ${deviceCard(S)}
      <section class="card list">
        <div class="switch-row">
          <div><div style="font-size: 16px; font-weight: 600">Tägliche Erinnerung</div><div class="small muted">an Pausentagen still</div></div>
          <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Tägliche Erinnerung" data-action="remind-toggle"></button>
        </div>
        <div class="switch-row${on ? '' : ' is-off'}">
          <label for="remind-at" style="font-size: 16px; font-weight: 600">Um</label>
          <input id="remind-at" class="input remind-time" type="time" step="900" value="${timeText(at).padStart(5, '0')}" data-action="remind-time"${on ? '' : ' disabled'}>
        </div>
      </section>
      <section style="display: flex; flex-direction: column; gap: 10px${on ? '' : '; opacity: .5'}">
        <h2 class="h3">Woran erinnern?</h2>
        ${habits.length ? `<div class="card list">${rows}</div>` : '<p class="hint" style="padding: 0 4px">Noch keine Gewohnheiten.</p>'}
      </section>
      <section style="display: flex; flex-direction: column; gap: 8px${on ? '' : '; opacity: .5'}">
        <h2 class="h3">So sähe es heute aus</h2>
        ${preview}
      </section>
    </div>
  </div>`;
}

export function remindProfileCard(S) {
  if (!hasRemindSchema(S)) {
    return `<section class="card pad"><b>Erinnerung</b><p class="hint" style="margin-top: 4px">Bitte zuerst das Datenbank-Update <code>017_erinnerung.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const p = S.profile;
  const sub = p.remind_on ? `täglich um ${timeText(p.remind_at == null ? DEFAULT_TIME : p.remind_at)}, wenn etwas offen ist` : 'aus – einmal am Tag, nur wenn etwas offen ist';
  return `<a class="card pad remind-link" href="#/erinnerung">
      <div class="hicon" style="width: 44px; height: 44px; border-radius: 14px; background: var(--soft)">${svg('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0', 22)}</div>
      <div style="flex: 1"><div style="font-size: 16px; font-weight: 700">Erinnerung</div><div class="small muted">${sub}</div></div>
      ${svg('M9 5l7 7-7 7', 18, 2.2)}
    </a>`;
}

// Zeile unter dem Namen einer Gewohnheit: „meist gegen 7:40“
export function usualLine(S, h, T) {
  if (isAuto(h)) return '';
  const u = usualFor(h, S.logs, S.workouts, T);
  if (u.min != null) return `<div class="small muted usual">${svg(CLOCK, 15)}meist gegen ${timeText(u.min)}</div>`;
  if (u.n > 0) return `<div class="small usual faint">${svg(CLOCK, 15)}Zeit lernt sich noch – ${u.n} von ${MIN_USUAL} Einträgen</div>`;
  return '';
}
