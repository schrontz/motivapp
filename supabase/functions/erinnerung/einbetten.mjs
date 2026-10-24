// Kopiert js/remind.js (mit den benutzten Teilen aus stats.js und dates.js) in index.ts.
// Supabase erlaubt beim Bereitstellen keine Importe von beliebigen Adressen – darum steckt die Logik in der Datei selbst.
// Nach jeder Änderung an js/remind.js, js/stats.js oder js/dates.js:  node supabase/functions/erinnerung/einbetten.mjs
// (npm test meldet, wenn die Kopie veraltet ist.)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const file = new URL('supabase/functions/erinnerung/index.ts', root);
const js = execFileSync('npx', ['-y', 'esbuild@0.24.0', 'js/remind.js', '--bundle', '--format=esm', '--log-level=warning'], { cwd: root, encoding: 'utf8' });
const body = js.replace(/\nexport \{[\s\S]*?\};\s*$/, '\n').replace(/^\/\/ js\/.*\n/gm, '').trim();
const BEGIN = '// ── BEGIN Kopie von js/remind.js (nicht hier ändern – einbetten.mjs) ──';
const END = '// ── END Kopie von js/remind.js ──';
const src = readFileSync(file, 'utf8');
const a = src.indexOf(BEGIN);
const b = src.indexOf(END);
if (a < 0 || b < 0) throw new Error('Markierungen in index.ts fehlen');
writeFileSync(file, src.slice(0, a + BEGIN.length) + '\n' + body + '\n' + src.slice(b));
console.log('eingebettet:', body.split('\n').length, 'Zeilen');
