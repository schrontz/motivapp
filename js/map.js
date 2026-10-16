// Karte für „Wie weit bin ich gekommen?“: Leaflet + OpenStreetMap, erst beim Öffnen der Seite geladen.
// Kein Standortzugriff – der Startort ist fest gewählt.

const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
let loading = null;
let current = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET + 'leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = LEAFLET + 'leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = () => { loading = null; reject(new Error('Leaflet nicht geladen')); };
    document.head.appendChild(js);
  });
  return loading;
}

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Vor jedem Neuzeichnen: alte Karte sauber abbauen (sonst feuern Leaflet-Ereignisse ins Leere)
export function unmountDistanceMap() {
  if (current) { try { current.remove(); } catch { /* Element schon weg */ } current = null; }
}

export async function mountDistanceMap() {
  unmountDistanceMap();
  const el = document.getElementById('dist-map');
  if (!el) return;
  let data;
  try { data = JSON.parse(el.dataset.map); } catch { return; }
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    const msg = el.querySelector('.dist-map-msg');
    if (msg) msg.textContent = 'Karte braucht Internet – die Zahlen oben stimmen trotzdem.';
    return;
  }
  if (!el.isConnected) return; // inzwischen weiternavigiert
  el.innerHTML = '';
  const pink = cssVar('--c-pink') || '#B8336A';
  const ink = cssVar('--text') || '#1A1F1E';
  const center = [data.start.lat, data.start.lng];
  // Erst eine Ansicht setzen – der Kreis braucht sie, um seine Grenzen zu berechnen
  const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView(center, 8);
  current = map;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const radius = Math.max(0, data.km) * 1000;
  const circle = L.circle(center, { radius, color: pink, weight: 2, fillColor: pink, fillOpacity: 0.14 }).addTo(map);
  L.circleMarker(center, { radius: 6, color: '#fff', weight: 2, fillColor: pink, fillOpacity: 1 })
    .bindTooltip(data.start.name).addTo(map);
  for (const c of data.reached) {
    L.circleMarker([c.lat, c.lng], { radius: 4, color: pink, weight: 1, fillColor: pink, fillOpacity: 0.85 })
      .bindTooltip(c.name).addTo(map);
  }
  let bounds = radius > 0 ? circle.getBounds() : L.latLngBounds([center, center]);
  if (data.next) {
    L.circleMarker([data.next.lat, data.next.lng], { radius: 5, color: ink, weight: 2, dashArray: '2 3', fillOpacity: 0 })
      .bindTooltip(`Nächstes Ziel: ${data.next.name}`).addTo(map);
    bounds = bounds.extend([data.next.lat, data.next.lng]);
  }
  if (data.goal) {
    // Reiseziel: geschaffter Teil durchgezogen, der Rest gestrichelt
    const g = [data.goal.lat, data.goal.lng];
    const f = Math.max(0, Math.min(1, data.goal.share));
    const mid = [center[0] + (g[0] - center[0]) * f, center[1] + (g[1] - center[1]) * f];
    L.polyline([center, mid], { color: pink, weight: 4, opacity: 0.95 }).addTo(map);
    if (f < 1) L.polyline([mid, g], { color: ink, weight: 2, dashArray: '4 6' }).addTo(map);
    L.circleMarker(g, { radius: 7, color: ink, weight: 2.5, fillColor: '#fff', fillOpacity: 1 })
      .bindTooltip(data.goal.name, { permanent: true, direction: 'top', offset: [0, -6], className: 'goal-tip' }).addTo(map);
    bounds = bounds.extend(g);
  }
  map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10, animate: false });
}
