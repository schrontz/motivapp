// Aktionen: Erinnerung – Nachrichten auf diesem Gerät erlauben, Uhrzeit, woran erinnern, Probe.

import * as db from '../db.js';
import { S, render, persist, toast, local } from '../core.js';
import { parseTime, DEFAULT_TIME } from '../remind.js';

const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; } catch { return 'Europe/Berlin'; } };

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}

function keyBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function setDevice(state) {
  const changed = !S.pushDevice || S.pushDevice.state !== state;
  S.pushDevice = { state };
  return changed;
}

// Kann dieses Gerät Nachrichten empfangen, und hat es schon erlaubt?
export async function checkDevice() {
  if (S.pushChecking) return;
  S.pushChecking = true;
  let state = 'off';
  try {
    if (db.isDemo) state = local.get('demoPush') === 'on' ? 'on' : 'off';
    else if (S.ios && !S.standalone) state = 'ios-browser';
    else if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) state = 'unsupported';
    else if (Notification.permission === 'denied') state = 'denied';
    else {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      state = sub && Notification.permission === 'granted' ? 'on' : 'off';
      // Abo neu speichern (falls der Browser es erneuert hat oder die Zeile fehlt) – leise
      if (sub && state === 'on') db.savePushSub(sub.toJSON(), deviceName()).catch(() => {});
    }
  } catch (err) {
    console.warn('Erinnerung: Gerät prüfen', err);
    state = 'unsupported';
  } finally {
    S.pushChecking = false;
  }
  if (setDevice(state)) render();
}

async function allow() {
  if (db.isDemo) { local.set('demoPush', 'on'); setDevice('on'); render(); toast('Demo: Erinnerungen erlaubt.'); return; }
  // requestPermission muss als Erstes laufen – iOS erlaubt das nur direkt nach dem Tippen
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    setDevice(perm === 'denied' ? 'denied' : 'off');
    render();
    toast(perm === 'denied' ? 'Nachrichten blockiert – in den Einstellungen des Handys erlauben.' : 'Nicht erlaubt – du kannst es jederzeit nochmal versuchen.');
    return;
  }
  S.pushBusy = true;
  render();
  try {
    const reg = await navigator.serviceWorker.ready;
    const { key } = await db.remindRequest('key');
    const appKey = keyBytes(key);
    let sub = await reg.pushManager.getSubscription();
    try {
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    } catch (err) {
      // altes Abo mit anderem Schlüssel → einmal neu
      if (sub) await sub.unsubscribe();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      if (!sub) throw err;
    }
    await db.savePushSub(sub.toJSON(), deviceName());
    setDevice('on');
    // Wer erlaubt, will wohl auch erinnert werden
    if (S.profile && !S.profile.remind_on) await saveProfile({ remind_on: true, remind_at: S.profile.remind_at == null ? DEFAULT_TIME : S.profile.remind_at, remind_tz: zone() });
    toast('Erlaubt. Mit „Probe schicken“ kannst du es gleich testen.');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Hat nicht geklappt – bitte nochmal versuchen.');
  } finally {
    S.pushBusy = false;
    render();
  }
}

async function deviceOff() {
  S.pushBusy = true;
  render();
  try {
    if (db.isDemo) local.set('demoPush', 'off');
    else {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await db.deletePushSub(sub.endpoint);
        await sub.unsubscribe();
      }
    }
    setDevice('off');
    toast('Dieses Gerät bekommt keine Erinnerung mehr.');
  } catch (err) {
    console.error(err);
    toast('Ausschalten hat nicht geklappt – bitte nochmal versuchen.');
  } finally {
    S.pushBusy = false;
    render();
  }
}

async function sendTest() {
  S.pushBusy = true;
  render();
  try {
    const r = await db.remindRequest('test');
    if (!r.devices) toast('Kein Gerät gefunden – bitte „Erinnerungen erlauben“ nochmal tippen.');
    else if (r.ok === r.devices) toast(r.devices === 1 ? 'Probe ist unterwegs.' : `Probe an ${r.devices} Geräte geschickt.`);
    else { console.warn('Probe:', r.errors); toast(`Probe: ${r.ok} von ${r.devices} Geräten erreicht.`); }
  } catch (err) {
    console.error(err);
    toast(err.message || 'Probe hat nicht geklappt.');
  } finally {
    S.pushBusy = false;
    render();
  }
}

function saveProfile(patch) {
  Object.assign(S.profile, patch);
  return persist(() => db.updateProfile(S.profile.id, patch));
}

export const clicks = {
  'remind-allow': () => allow(),
  'remind-device-off': () => deviceOff(),
  'remind-test': () => sendTest(),
  'remind-toggle': async () => {
    if (!S.profile) return;
    const on = !S.profile.remind_on;
    const patch = { remind_on: on, remind_tz: zone() };
    if (on && S.profile.remind_at == null) patch.remind_at = DEFAULT_TIME;
    const saving = saveProfile(patch);
    render();
    await saving;
  }
};

export const changes = {
  'remind-time': async ({ el }) => {
    const min = parseTime(el.value);
    if (min == null || !S.profile) return;
    const saving = saveProfile({ remind_at: min, remind_tz: zone() });
    render();
    await saving;
  },
  'remind-habit': async ({ el }) => {
    const h = S.habits.find((x) => x.id === el.dataset.id);
    if (!h) return;
    h.remind = el.checked;
    render();
    await persist(() => db.setHabitRemind(h.id, h.remind));
  }
};
