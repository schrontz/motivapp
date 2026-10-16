// Aktionen: CSV-Importe (Alpha Progression, Renpho) – eine gemeinsame Strecke:
// Datei wählen oder „Teilen → Motivator“ → Vorschau → Import. Die App erkennt selbst, welche App die Datei geschrieben hat.

import * as db from '../db.js';
import { S, go, render, toast, persist } from '../core.js';
import { parseAlphaCsv, importPreview, mergeTrainings } from '../strength.js';
import { parseRenphoCsv, bodyPreview, looksLikeRenpho } from '../body.js';
import { alphaOn, bodyOn } from '../views.js';
import { setModule } from './profile.js';

// Pro Quelle: wo der Zustand liegt, welche Seite, wie gelesen und gespeichert wird
const SOURCES = {
  alpha: {
    key: 'imp',
    route: 'import',
    label: 'Alpha Progression',
    unit: 'Einheiten',
    read(text) {
      const { sessions } = parseAlphaCsv(text);
      return sessions.length ? { parsed: sessions, preview: importPreview(sessions, S.strength, S.workouts) } : null;
    },
    save: (fresh) => db.importStrength(fresh),
    async after(saved) {
      S.strength = [...S.strength, ...saved].sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
      if (!alphaOn(S)) await setModule('alpha', true);
      const newest = saved.slice().sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
      let latest = null;
      if (newest) {
        const w = mergeTrainings(S.workouts, S.strength).find((x) => x.strength && x.strength.id === newest.id);
        latest = w ? w.id : null;
      }
      return { done: saved.length, latest };
    }
  },
  body: {
    key: 'bimp',
    route: 'body-import',
    label: 'Renpho',
    unit: 'Messtage',
    read(text) {
      const parsed = parseRenphoCsv(text);
      return parsed.measurements.length ? { preview: bodyPreview(parsed, S.body) } : null;
    },
    save: (fresh) => db.importBody(fresh),
    async after(saved) {
      S.body = [...S.body, ...saved].sort((a, b) => (a.day < b.day ? -1 : 1));
      if (!bodyOn(S)) await setModule('body', true);
      return { done: saved.length };
    }
  }
};

// Welche App hat die Datei geschrieben?
function detect(text) {
  if (looksLikeRenpho(text)) return 'body';
  if (parseAlphaCsv(text).sessions.length) return 'alpha';
  return null;
}

function showText(id, text, name) {
  const src = SOURCES[id];
  const res = src.read(text);
  S[src.key] = res
    ? { name, ...res }
    : { error: `Das sieht nicht nach einem Export aus ${src.label} aus. Bitte die CSV aus „Daten exportieren“ wählen.` };
  render();
}

async function readFile(id, el) {
  const src = SOURCES[id];
  const file = el.files && el.files[0];
  if (!file) return;
  S[src.key] = { busy: 'Lese Datei …' };
  render();
  try {
    const text = await file.text();
    // Versehentlich die Datei der anderen App gewählt? Dann dorthin.
    const other = detect(text);
    if (other && other !== id) {
      S[src.key] = null;
      go('#/' + SOURCES[other].route);
      showText(other, text, file.name);
      return;
    }
    showText(id, text, file.name);
  } catch (err) {
    console.error(err);
    S[src.key] = { error: 'Die Datei konnte nicht gelesen werden.' };
    render();
  }
}

async function runImport(id) {
  const src = SOURCES[id];
  const p = S[src.key] && S[src.key].preview;
  if (!p || !p.fresh.length) return;
  S[src.key] = { ...S[src.key], busy: `Importiere ${p.fresh.length} ${src.unit} …` };
  render();
  const saved = await persist(() => src.save(p.fresh), 'Import hat nicht geklappt – bitte Verbindung prüfen.');
  if (!saved) { S[src.key] = null; render(); return; }
  S[src.key] = await src.after(saved);
  render();
}

// Beim Verlassen einer Import-Seite den Zwischenstand vergessen
export function resetImportsExcept(routeName) {
  for (const src of Object.values(SOURCES)) if (src.route !== routeName) S[src.key] = null;
}

// Über „Teilen → Motivator“ geschickte Datei: Der Service Worker hat sie zwischengelagert.
export async function consumeShared() {
  if (!('caches' in window) || !S.loaded) return;
  try {
    const cache = await caches.open('motivator-share');
    const res = await cache.match('./shared-file');
    if (!res) return;
    const name = decodeURIComponent(res.headers.get('X-Name') || '') || 'geteilte Datei';
    const text = await res.text();
    await cache.delete('./shared-file');
    const id = detect(text) === 'body' ? 'body' : 'alpha';
    history.replaceState(null, '', location.pathname + location.search + '#/' + SOURCES[id].route);
    showText(id, text, name);
  } catch (err) {
    console.error(err);
    toast('Die geteilte Datei konnte nicht gelesen werden – bitte über „CSV-Datei auswählen“.');
  }
}

export const clicks = {
  'import-go': () => runImport('alpha'),
  'import-reset': () => { S.imp = null; render(); },
  'bimport-go': () => runImport('body'),
  'bimport-reset': () => { S.bimp = null; render(); }
};

export const changes = {
  'import-file': ({ el }) => readFile('alpha', el),
  'bimport-file': ({ el }) => readFile('body', el)
};
