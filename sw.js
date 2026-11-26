/* Bier Sammler – Service Worker: damit die App ohne Netz startet.

   Strategien:
   - Eigene Dateien (HTML, CSS, JS, Symbole): network-first mit Cache als Rückfall. Nach einem Push kommt also sofort
     der neue Code (der HTTP-Zwischenspeicher wird dabei umgangen); ohne Netz die zuletzt geladene Fassung.
   - Bier-Dateien (Datensammlung/*.json): stale-while-revalidate. Sofort aus dem Cache, im Hintergrund aktualisiert;
     Änderungen an der Datenbank erscheinen deshalb ab dem übernächsten Start.
   - Firebase-SDK von www.gstatic.com: cache-first. Die Adressen enthalten die Versionsnummer und ändern sich nie.
   - Alles andere (Firestore, Google-Anmeldung) geht ungefiltert ans Netz; das regelt Firebase selbst.

   CACHE_VERSION erhöhen, wenn sich die LISTE der vorab gespeicherten Dateien ändert (neue, umbenannte oder
   gelöschte Datei) oder die Firebase-Version. Für normale Änderungen am Code ist das nicht nötig.
   Ändern sich die Seltenheitsstufen (Anzahl oder Bedeutung), zusätzlich die Marke ?stufen=… in DATA_FILES UND in
   js/app.js (STUFEN_MARKE) hochsetzen, sonst läuft neuer Code einmal mit alten Bierdaten. */
'use strict';

const CACHE_VERSION = 'v14'; // v14: neue Datei Datensammlung/challenges.json (v13: biere_beerdb.json, v12: js/info.js)
const CACHE = `biersammler-${CACHE_VERSION}`;
const FIREBASE_SDK = '10.12.2'; // muss zu js/store.js und den modulepreload-Links in index.html passen
const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/`;

// Pfade relativ zum Ort von sw.js (GitHub Pages liefert die App unter /<repository>/ aus)
const APP_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/firebase-config.js',
  'js/game.js',
  'js/store.js',
  'js/karte.js', // STANDORT-KARTE (die Kartendaten Datensammlung/karte/*.json kommen erst beim ersten Öffnen der Karte in den Cache)
  'js/info.js', // INFO-FENSTER
  'js/app.js',
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png',
  'impressum.html',
  'datenschutz.html',
];
// Bierdateien mit der Marke ?stufen=5 wie in js/app.js (STUFEN_MARKE): fünf Stufen nach Erhältlichkeit seit 19.11.2026
// (biere_manuell.json und spezialkarten.json tragen die Marke ebenfalls, weil sich dort Stufen und Karten mitgeändert haben)
const DATA_FILES = [
  'Datensammlung/biere.json?stufen=5',
  'Datensammlung/biere_manuell.json?stufen=5',
  'Datensammlung/biere_beerdb.json?stufen=5', // Nachtrag aus beer-db.org (24.11.2026)
  'Datensammlung/kategorien.json?stufen=5',
  'Datensammlung/biere_korrekturen.json',
  'Datensammlung/challenges.json', // CHALLENGES
  'Datensammlung/nachrichten.json',
  'Datensammlung/spezialkarten.json?stufen=5',
];
const SDK_FILES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => SDK_BASE + f);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Eigene Dateien und Bierdaten müssen da sein; die SDK-Dateien sind ein Bonus (im lokalen Modus unnötig)
    await cache.addAll(APP_FILES.concat(DATA_FILES).map((u) => new Request(u, { cache: 'reload' })));
    await Promise.all(SDK_FILES.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('biersammler-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const scope = new URL(self.registration.scope);
const isData = (url) => url.origin === scope.origin && url.pathname.startsWith(scope.pathname + 'Datensammlung/') && url.pathname.endsWith('.json');

// Eigene Dateien: erst das Netz (ohne HTTP-Zwischenspeicher), sonst der Cache. Seitenaufrufe fallen auf index.html zurück.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  // Seitenaufrufe lassen sich nicht mit geänderten Optionen weiterreichen; deshalb eine neue Anfrage auf dieselbe Adresse
  const fresh = request.mode === 'navigate'
    ? new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(request, { cache: 'no-cache' });
  try {
    const response = await fetch(fresh);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const index = await cache.match('index.html');
      if (index) return index;
    }
    throw err;
  }
}

// Bier-Dateien: sofort aus dem Cache, im Hintergrund nachladen
async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  const update = fetch(event.request, { cache: 'no-cache' })
    .then((response) => { if (response.ok) return cache.put(event.request, response.clone()).then(() => response); return response; });
  if (hit) {
    event.waitUntil(update.catch(() => {}));
    return hit;
  }
  return update;
}

// Firebase-SDK: unveränderliche, versionierte Adressen
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.href.startsWith(SDK_BASE)) { event.respondWith(cacheFirst(request)); return; }
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (isData(url)) event.respondWith(staleWhileRevalidate(event));
  else event.respondWith(networkFirst(request));
});
