// CSV-Importe (Alpha Progression, Renpho): eine gemeinsame Seite mit drei Zuständen –
// Anleitung · Vorschau („Neu / Schon da“) · fertig. Unterschiede stehen in den Einstellungen unten.

import { monthShort } from '../dates.js';
import { backBar, esc, nav, shortDate } from './ui.js';

function importScreen(cfg, imp, hasSchema) {
  const many = (n) => `${n} ${n === 1 ? cfg.one : cfg.many}`;
  let body;
  if (imp.busy) {
    body = `<section class="card pad"><p>${esc(imp.busy)}</p></section>`;
  } else if (imp.done != null) {
    body = `<section class="total" style="flex-direction: column; align-items: flex-start; gap: 6px">
        <div style="font-size: 18px; font-weight: 700">${many(imp.done)} importiert</div>
        <div class="small">${cfg.doneText}</div>
      </section>
      ${cfg.doneLink(imp)}`;
  } else if (imp.preview) {
    const p = imp.preview;
    const range = p.from ? `${monthShort(p.from.slice(0, 7))} ${p.from.slice(0, 4)} bis ${shortDate(p.to)}${p.to.slice(0, 4) !== String(new Date().getFullYear()) ? ' ' + p.to.slice(0, 4) : ''}` : '';
    body = `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <div class="small muted">${esc(imp.name || 'CSV-Datei')}</div>
        <div class="grid2" style="gap: 8px">
          <div class="imp-box" style="background: var(--soft)"><div class="small">Neu</div><b>${p.fresh.length}</b><div class="small">${cfg.many}</div></div>
          <div class="imp-box" style="background: var(--bg)"><div class="small muted">Schon da</div><b>${p.known}</b><div class="small muted">werden übersprungen</div></div>
        </div>
        <div style="font-size: 14px; line-height: 1.5">${cfg.detail(p, range)}</div>
        ${p.fresh.length
          ? `<button type="button" class="btn" data-action="${cfg.action}-go">${many(p.fresh.length)} importieren</button>`
          : '<p class="hint">Alles schon da – nichts zu tun.</p>'}
        <button type="button" class="btn ghost" data-action="${cfg.action}-reset">Andere Datei</button>
      </section>`;
  } else {
    body = `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <b>So geht's</b>
        <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.6">
          ${cfg.steps.map((s) => `<li>${s}</li>`).join('\n          ')}
          <li>Fertig – oder die Datei hier auswählen:</li>
        </ol>
        <label class="btn" style="cursor: pointer">CSV-Datei auswählen<input type="file" accept=".csv,text/csv,text/comma-separated-values,text/plain" data-action="${cfg.action}-file" style="position: absolute; opacity: 0; width: 1px; height: 1px"></label>
        ${cfg.after}${imp.error ? `<p class="small" style="color: var(--danger)" role="alert">${esc(imp.error)}</p>` : ''}
      </section>`;
  }
  return `<div class="app">
    ${backBar(cfg.back[0], cfg.back[1])}
    <div class="wrap" style="gap: 16px">
      <h1 style="font-size: 26px; padding: 0 4px; line-height: 1.2">${cfg.title}</h1>
      ${hasSchema ? body : `<section class="card pad"><p class="hint">Bitte zuerst das Datenbank-Update <code>${cfg.sql}</code> im Supabase SQL-Editor ausführen.</p></section>`}
    </div>
    ${nav('overview')}
  </div>`;
}

const ALPHA = {
  action: 'import',
  title: 'Trainings aus Alpha Progression holen',
  back: ['#/training', 'Training'],
  sql: '004_kraft.sql',
  one: 'Einheit',
  many: 'Einheiten',
  steps: ['In Alpha Progression: Einstellungen → Daten exportieren (CSV)', '„Teilen“ → <b>Motivator</b> wählen'],
  after: '<p class="hint">„Teilen → Motivator“ klappt, wenn die App auf dem Startbildschirm installiert ist.</p>\n        ',
  detail: (p, range) => `${range} · ${p.exercises} ${p.exercises === 1 ? 'Übung' : 'Übungen'}${p.fresh.length ? ` · <b>${p.matched}</b> davon passen zu Trainings von Withings` : ''}`,
  doneText: 'Beim nächsten Mal einfach wieder die ganze CSV schicken – bekannte Einheiten werden übersprungen.',
  doneLink: (imp) => (imp.latest ? `<a class="btn" href="#/training/${encodeURIComponent(imp.latest)}">Letzte Einheit ansehen</a>` : '<a class="btn" href="#/training">Zum Training</a>')
};

const RENPHO = {
  action: 'bimport',
  title: 'Messungen aus Renpho holen',
  back: ['#/body', 'Körper'],
  sql: '005_koerper.sql',
  one: 'Messtag',
  many: 'Messtage',
  steps: ['In Renpho: Waage → Verlauf → ganz unten „Daten exportieren“', 'Zeitraum „alles“ → „Teilen“ → <b>Motivator</b>'],
  after: '',
  detail: (p, range) => `${range} · ${p.rows} Zeilen.${p.merged ? ' Mehrfach-Messungen am selben Tag werden zu einer zusammengefasst.' : ''}`,
  doneText: 'Alle Spalten sind gespeichert – auch die, die du gerade nicht siehst. Nächstes Mal einfach wieder alles exportieren.',
  doneLink: () => '<a class="btn" href="#/body">Zu den Körperwerten</a>'
};

export function importView(S) {
  return importScreen(ALPHA, S.imp || {}, S.hasStrengthSchema);
}

export function bodyImportView(S) {
  return importScreen(RENPHO, S.bimp || {}, S.hasBodySchema);
}
