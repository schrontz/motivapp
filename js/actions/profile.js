// Aktionen: Profil – Module an/aus, Kacheln, Datenexport, Installieren, Abmelden.

import * as db from '../db.js';
import { S, render, toast, persist } from '../core.js';
import { today } from '../dates.js';
import { alphaOn, bodyOn, reduceOn, alcoholOn, foodOn } from '../views.js';

const TILE_ORDER = ['steps', 'training', 'body', 'active', 'distance'];

export function setModule(id, on) {
  if (!S.profile) return null;
  const mods = new Set(S.profile.modules || ['habits']);
  if (on) mods.add(id); else mods.delete(id);
  S.profile.modules = [...mods];
  const patch = { modules: S.profile.modules };
  // Körperwerte einschalten → Kachel gleich mit anzeigen
  if (id === 'body' && on && S.hasWithingsSchema) {
    const tiles = new Set(S.profile.tiles || ['steps', 'training']);
    tiles.add('body');
    S.profile.tiles = TILE_ORDER.filter((k) => tiles.has(k));
    patch.tiles = S.profile.tiles;
  }
  return persist(() => db.updateProfile(S.profile.id, patch));
}

function exportData() {
  const data = {
    exportiert_am: new Date().toISOString(),
    profil: S.profile,
    kategorien: S.categories,
    gewohnheiten: S.habits,
    eintraege: S.logs,
    pausen: S.pauses,
    krafteinheiten: S.strength,
    koerperwerte: S.body,
    steigerungsplaene: S.plans,
    reiseziele: S.travel,
    eigene_orte: S.places,
    weniger_einstellungen: S.reduceSettings,
    weniger_ereignisse: S.reduceEvents,
    ruhepuls_naechte: S.sleep,
    ruhepuls_tage: S.heart,
    mahlzeiten: S.meals,
    essen_favoriten: S.mealFavorites,
    fundstuecke: S.finds
    // „Alkoholfrei“ steckt in weniger_einstellungen / weniger_ereignisse (Art „alkohol“)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `motivator-export-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Installieren: Chrome meldet per „beforeinstallprompt“, dass die App installierbar ist
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  S.canInstall = true;
  if (S.loaded) render();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  S.canInstall = false;
  toast('Installiert – Motivator liegt jetzt auf deinem Startbildschirm.');
  if (S.loaded) render();
});

export const clicks = {
  export: () => exportData(),
  'tile-toggle': async ({ id }) => {
    if (!S.profile) return;
    const tiles = new Set(S.profile.tiles || ['steps', 'training']);
    if (tiles.has(id)) tiles.delete(id); else tiles.add(id);
    S.profile.tiles = TILE_ORDER.filter((k) => tiles.has(k));
    render();
    if (S.hasWithingsSchema) await persist(() => db.updateProfile(S.profile.id, { tiles: S.profile.tiles }));
  },
  'module-toggle': async ({ id }) => {
    const on = id === 'body' ? bodyOn(S) : id === 'weniger' ? reduceOn(S) : id === 'alkohol' ? alcoholOn(S) : id === 'essen' ? foodOn(S) : alphaOn(S);
    const p = setModule(id, !on);
    render();
    await p;
  },
  install: async () => {
    if (!installEvent) { toast('Bitte über das Chrome-Menü ⋮ → „App installieren“.'); return; }
    installEvent.prompt();
    try { await installEvent.userChoice; } catch { /* egal */ }
    installEvent = null;
    S.canInstall = false;
    render();
  },
  logout: async () => {
    // Erinnerungen für dieses Gerät abbestellen – sonst kämen sie nach dem Abmelden weiter
    try {
      if (!db.isDemo && 'serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && await reg.pushManager.getSubscription();
        if (sub) { await db.deletePushSub(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
      }
    } catch { /* egal – abmelden geht vor */ }
    S.pushDevice = null;
    return db.signOut();
  }
};

export const changes = {
  'profile-name': async ({ el }) => {
    const name = el.value.trim();
    if (!S.profile) return;
    S.profile.display_name = name || null;
    const ok = await persist(() => db.updateProfile(S.profile.id, { display_name: name || null }));
    if (ok !== null) toast('Gespeichert');
  }
};
