/* Tests der Spiellogik (js/game.js). Aufruf im Projektordner:
     node tests/game.test.js
   Ohne npm-Abhängigkeiten (nur das eingebaute assert). Liest zusätzlich die echte Bierdatenbank,
   um Zusammenführen und Suche mit den echten Daten zu prüfen. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../js/game.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (err) { console.error('FEHLER ' + name + '\n  ' + err.message); process.exitCode = 1; }
}

/* ---------- Pflicht-Beispiele aus dem Auftrag ---------- */

// Summe aus Anzahl × Stufe, nur über pointsFor (so rechnet auch die App)
const sumOf = (...pairs) => pairs.reduce((s, [n, stufe]) => s + n * G.pointsFor(stufe), 0);
function check(sum, wantSum, wantLevel, wantRing) {
  assert.strictEqual(sum, wantSum, 'Summe');
  assert.strictEqual(G.level(sum), wantLevel, 'Level');
  assert.strictEqual(G.fmtRing(sum), wantRing, 'Ring-Anzeige');
}

test('0 Einträge → Level 1, Ring 0', () => { check(0, 0, 1, '0,0 / 10 Punkte'); assert.strictEqual(G.ring(0), 0); });
test('10 × Stufe 5 = 250 → Level 3, 5,0 / 10', () => check(sumOf([10, 5]), 250, 3, '5,0 / 10 Punkte'));
test('10 × Stufe 1 = 100 → Level 2, 0,0 / 10', () => { check(sumOf([10, 1]), 100, 2, '0,0 / 10 Punkte'); assert.strictEqual(G.ring(100), 0); assert.strictEqual(G.level(99), 1); });
test('20 × Stufe 1 = 200 → Level 3, 0,0 / 10', () => { check(sumOf([20, 1]), 200, 3, '0,0 / 10 Punkte'); assert.strictEqual(G.ring(200), 0); });
test('19 × Stufe 4 = 285 → Level 3, 8,5 / 10', () => check(sumOf([19, 4]), 285, 3, '8,5 / 10 Punkte'));
test('13 × Stufe 1 + 5 × Stufe 5 = 255 → Level 3, 5,5 / 10', () => check(sumOf([13, 1], [5, 5]), 255, 3, '5,5 / 10 Punkte'));
test('3 × Stufe 3 = 39 → 3,9', () => { assert.strictEqual(sumOf([3, 3]), 39); assert.strictEqual(G.fmt1(39), '3,9'); });
test('Überschuss: 9,6 + 1,5 → Level steigt, Ring 1,1', () => {
  const s = 96 + G.pointsFor(4);
  assert.strictEqual(G.level(96), 1); assert.strictEqual(G.level(s), 2); assert.strictEqual(G.fmtRing(s), '1,1 / 10 Punkte');
});
test('Fünf Stufen nach Erhältlichkeit: 1,0 / 1,2 / 1,3 / 1,5 / 2,5 Punkte, Spezialkarten bis 1,0 Extrapunkt', () => {
  assert.deepStrictEqual(G.STUFEN, [1, 2, 3, 4, 5]);
  assert.strictEqual(G.MAX_STUFE, 5);
  assert.deepStrictEqual(G.STUFEN.map(G.pointsFor), [10, 12, 13, 15, 25]);
  assert.strictEqual(G.MAX_BONUS, 10); assert.strictEqual(G.MAX_BEER_POINTS, 35);
  assert.strictEqual(G.NEW_CARD_BONUS, 35); // 3,5 Punkte einmal je neuer Karte
  assert.strictEqual(G.pointsFor(6), 0); assert.strictEqual(G.pointsFor(0), 0);
  // beerPoints: Stufe + Bonus; feste Punkte gehen vor (dann kein Bonus)
  assert.strictEqual(G.beerPoints({ stufe: 5, punkte: null, bonus: 10 }), 35);
  assert.strictEqual(G.beerPoints({ stufe: 2, punkte: 10, bonus: 10 }), 10);
  assert.strictEqual(G.beerPoints({ stufe: 3 }), 13);
  assert.strictEqual(G.beerPoints(null), 0);
});
test('Punkte bis zum nächsten Level', () => { assert.strictEqual(G.toNext(266), 34); assert.strictEqual(G.toNext(200), 100); });

/* ---------- Anzeige ---------- */

test('Zahlen deutsch', () => {
  assert.strictEqual(G.fmtInt(6368), '6.368');
  assert.strictEqual(G.fmtInt(37), '37');
  assert.strictEqual(G.fmtAlc(5.3), '5,3 %');
  assert.strictEqual(G.fmtAlc(5), '5,0 %');
  assert.strictEqual(G.fmtAlc(0), 'alkoholfrei');
  assert.strictEqual(G.fmtAlc(null), '');
  assert.strictEqual(G.fmtLiter(0.355), '0,355 l');
  assert.strictEqual(G.fmtLiter(1), '1 l');
  assert.strictEqual(G.fmtLiter(null), '');
});

/* ---------- Bierdaten ---------- */

const KAT = [{ stufe: 1, name: 'Standardgebräu' }, { stufe: 2, name: 'Klassiker' }, { stufe: 3, name: 'Spezialität' }, { stufe: 4, name: 'Zaubertrank' }, { stufe: 5, name: 'Heiligtum' }];
const raw = (id, name, stufe, extra = {}) => ({
  id, name, biersorte: ['Pils'], alkoholgehalt: 4.9,
  brauerei_vertrieb: { typ: 'Brauerei', name: 'Testbrauerei GmbH', adresse: 'Weg 1', region: 'Bayern', land: 'Deutschland' },
  beschreibung: null, zutaten: null, flaschengroesse: 0.5, kategorie_name: 'x', kategorie_stufe: stufe, ...extra,
});

test('Name trennen am ersten " - "', () => {
  assert.deepStrictEqual(G.splitName('Schneider Weisse - TAP6 - unser Aventinus', 'X'), { title: 'TAP6 - unser Aventinus', brand: 'Schneider Weisse' });
  assert.deepStrictEqual(G.splitName("Beck's", 'Brauerei Beck GmbH'), { title: "Beck's", brand: 'Brauerei Beck GmbH' });
});

test('Zusammenführen: ungültig weg, doppelte ID → biere.json gilt, Warnung', () => {
  const warns = [];
  const r = G.mergeBeers(
    [raw('BS-000001', 'A - Eins', 1), raw('BS-000002', 'B - Zwei', 9), { id: 'kaputt' }],
    [raw('BS-000001', 'Fremd - Doppelt', 5), raw('BM-000001', 'C - Manuell', 3, { biersorte: null, flaschengroesse: null, alkoholgehalt: 0 })],
    KAT, (t) => warns.push(t));
  assert.deepStrictEqual(r.list.map((b) => b.id), ['BS-000001', 'BM-000001']);
  assert.strictEqual(r.map.get('BS-000001').name, 'A - Eins');
  assert.strictEqual(r.map.get('BM-000001').kategorie, 'Spezialität');
  assert.deepStrictEqual(r.map.get('BM-000001').sorten, []);
  assert.strictEqual(r.map.get('BM-000001').flasche, null);
  assert.strictEqual(r.map.get('BM-000001').alc, 0);
  assert.strictEqual(warns.length, 3, warns.join(' | '));
  assert.ok(warns.some((w) => w.includes('doppelte ID BS-000001')));
});

test('Korrekturen: überlagern einzelne Felder, Original bleibt unverändert', () => {
  const warns = [];
  const main = [raw('BS-000001', 'A - Eins', 2, { beschreibung: 'alt', zutaten: ['Wasser'] }), raw('BS-000002', 'B - Zwei', 3)];
  const manual = [raw('BM-000001', 'C - Manuell', 1)];
  const copy = JSON.stringify(main);
  const r = G.mergeBeers(main, manual, KAT, (w) => warns.push(w), {
    'BS-000001': { beschreibung: 'Neu geschrieben.', zutaten: null, alkoholgehalt: 5.5, brauerei_vertrieb: { region: 'Sachsen' } },
    'BM-000001': { name: 'C - Umbenannt' },
  });
  const a = r.map.get('BS-000001');
  assert.strictEqual(a.beschreibung, 'Neu geschrieben.');
  assert.strictEqual(a.zutaten, null);           // null entfernt die Angabe
  assert.strictEqual(a.alc, 5.5);
  assert.strictEqual(a.company.region, 'Sachsen');
  assert.strictEqual(a.company.name, 'Testbrauerei GmbH'); // übrige Unterfelder bleiben
  assert.strictEqual(a.stufe, 2);
  assert.strictEqual(r.map.get('BS-000002').beschreibung, null); // andere Biere unberührt
  assert.strictEqual(r.map.get('BM-000001').name, 'C - Umbenannt');
  assert.strictEqual(r.map.get('BM-000001').title, 'Umbenannt');
  assert.strictEqual(JSON.stringify(main), copy, 'Eingabe darf nicht verändert werden');
  assert.deepStrictEqual(warns, []);
});

test('Korrekturen: Stufe/ID nie änderbar, falsche Typen und unbekannte IDs → Warnung, Wert bleibt', () => {
  const warns = [];
  const r = G.mergeBeers([raw('BS-000001', 'A - Eins', 2, { beschreibung: 'alt' })], [], KAT, (w) => warns.push(w), {
    'BS-000001': { kategorie_stufe: 5, kategorie_name: 'Z', id: 'BS-999999', beschreibung: 42, alkoholgehalt: 'viel', biersorte: 'Pils', name: '  ', brauerei_vertrieb: { plz: '1' } },
    'BS-424242': { beschreibung: 'x' },
    'BS-000002': 'kaputt',
  });
  const a = r.map.get('BS-000001');
  assert.strictEqual(a.stufe, 2); assert.strictEqual(a.id, 'BS-000001');
  assert.strictEqual(a.beschreibung, 'alt'); assert.strictEqual(a.alc, 4.9); assert.deepStrictEqual(a.sorten, ['Pils']);
  assert.strictEqual(a.name, 'A - Eins');
  assert.strictEqual(r.list.length, 1);
  for (const w of ['„kategorie_stufe“', '„kategorie_name“', '„id“', 'ungültiger Wert für „beschreibung“', 'ungültiger Wert für „alkoholgehalt“',
    'ungültiger Wert für „biersorte“', 'ungültiger Wert für „name“', 'brauerei_vertrieb.plz', 'unbekannte ID BS-424242', 'unbekannte ID BS-000002']) {
    assert.ok(warns.some((x) => x.includes(w)), `Warnung fehlt: ${w}\n${warns.join('\n')}`);
  }
});

test('Korrekturen: fehlend, leer oder keine Objektform → nichts passiert', () => {
  const base = [raw('BS-000001', 'A - Eins', 2)];
  for (const fx of [undefined, null, {}]) {
    const w = []; const r = G.mergeBeers(base, [], KAT, (x) => w.push(x), fx);
    assert.strictEqual(r.list.length, 1); assert.deepStrictEqual(w, []);
  }
  const w = []; const r = G.mergeBeers(base, [], KAT, (x) => w.push(x), []);
  assert.strictEqual(r.list.length, 1); assert.strictEqual(w.length, 1);
});

/* ---------- Suche ---------- */

test('Normalisierung', () => {
  assert.strictEqual(G.fold('Münchner Hefe-Weißbier'), 'munchner hefeweissbier');
  assert.strictEqual(G.fold("Beck's"), 'becks');
  assert.strictEqual(G.fold('Ožujsko'), 'ozujsko');
  assert.strictEqual(G.fold('Allgäuer Brauhaus - Urtyp'), 'allgauer brauhaus urtyp');
});

const mini = G.mergeBeers([
  raw('BS-000010', 'Löwenbräu - Münchner Hell', 1),
  raw('BS-000011', 'Paulaner - Hefe-Weißbier', 2),
  raw('BS-000012', 'Muenchner Kindl - Dunkel', 1),
  raw('BS-000013', "Beck's", 1, { brauerei_vertrieb: { typ: 'Brauerei', name: 'Brauerei Beck GmbH', adresse: null, region: null, land: 'Deutschland' } }),
  raw('BS-000014', 'Altenmünster - Brauer Bier', 2, { brauerei_vertrieb: { typ: 'Brauerei', name: 'Allgäuer Brauhaus AG', adresse: null, region: null, land: 'Deutschland' } }),
], [], KAT).list;
const idx = G.buildIndex(mini);
const ids = (q) => G.search(idx, q).map((b) => b.id);

test('ä = a = ae, beide Richtungen', () => {
  const want = ['BS-000010', 'BS-000012'];
  assert.deepStrictEqual(ids('münchner').sort(), want);
  assert.deepStrictEqual(ids('muenchner').sort(), want);
  assert.deepStrictEqual(ids('munchner').sort(), want);
  assert.deepStrictEqual(ids('MÜNCHNER').sort(), want);
});
test('ß = ss, Bindestriche egal', () => {
  assert.deepStrictEqual(ids('weissbier'), ['BS-000011']);
  assert.deepStrictEqual(ids('hefeweißbier'), ['BS-000011']);
  assert.deepStrictEqual(ids('hefe weiss'), ['BS-000011']);
  assert.deepStrictEqual(ids('becks'), ['BS-000013']);
});
test('Jedes Wort muss vorkommen; Firmenname wird durchsucht', () => {
  assert.deepStrictEqual(ids('münchner dunkel'), ['BS-000012']);
  assert.deepStrictEqual(ids('allgäuer brauer'), ['BS-000014']);
  assert.deepStrictEqual(ids('münchner pils'), []);
});
test('Zwischenstände beim Tippen gehen nicht verloren', () => {
  for (const q of ['br', 'bra', 'brau', 'braue', 'brauer']) assert.ok(ids(q).includes('BS-000014'), q);
});
test('Unter 2 Zeichen keine Treffer, höchstens 10', () => {
  assert.deepStrictEqual(ids('m'), []);
  assert.deepStrictEqual(ids(' - '), []);
});
test('Wortanfänge zuerst', () => {
  // "bra" steht bei Altenmünster am Wortanfang ("Brauer", "Brauhaus"), bei Löwenbräu nur mittendrin
  const r = G.search(idx, 'bra');
  assert.strictEqual(r[0].id, 'BS-000014');
  assert.ok(r.some((b) => b.id === 'BS-000010'));
});

/* ---------- Protokoll, Sammlung, Sortierung ---------- */

const map = new Map(mini.map((b) => [b.id, b]));
test('Einträge bereinigen', () => {
  const d = G.normalizeDrinks([
    { id: 'a', beerId: 'BS-000010', at: 2000 },
    { id: 'b', beerId: 'BS-999999', at: 1000 },      // unbekannt
    { id: 'c', beerId: 'BS-000010', at: 1.5 },       // keine Ganzzahl
    { id: 'd', beerId: '<img>', at: 1000 },          // ungültig
    null, 'x', { id: 'a', beerId: 'BS-000011', at: 3000 }, // doppelte id
    { id: 'e', beerId: 'BS-000011', at: 1000, extra: 1 },
  ], map);
  assert.deepStrictEqual(d, [{ id: 'e', beerId: 'BS-000011', at: 1000 }, { id: 'a', beerId: 'BS-000010', at: 2000 }]);
  assert.deepStrictEqual(G.normalizeDrinks('kaputt'), []);
});
test('Sammlung aus dem Protokoll und Sortierung', () => {
  const d = G.normalizeDrinks([
    { id: '1', beerId: 'BS-000010', at: 100 }, { id: '2', beerId: 'BS-000010', at: 300 },
    { id: '3', beerId: 'BS-000012', at: 200 }, { id: '4', beerId: 'BS-000012', at: 400 },
    { id: '5', beerId: 'BS-000011', at: 50 }, { id: '6', beerId: 'BS-000013', at: 500 },
  ], map);
  const s = G.summarize(d, map);
  assert.strictEqual(s.sum, 5 * 10 + 12 + 4 * 35); // 6 Einträge + 4 neue Karten zu je 3,5
  assert.strictEqual(s.count, 6);
  assert.strictEqual(s.cards.length, 4);
  const order = s.cards.slice().sort(G.compareCards).map((c) => c.beer.id);
  // Stufe 2 zuerst; dann je 2× (10 und 12): 12 zuletzt getrunken (400) vor 10 (300); dann 13 (1×)
  assert.deepStrictEqual(order, ['BS-000011', 'BS-000012', 'BS-000010', 'BS-000013']);
  const c10 = s.cards.find((c) => c.beer.id === 'BS-000010');
  assert.deepStrictEqual([c10.count, c10.first, c10.last, c10.points], [2, 100, 300, 20 + 35]);
});
test('Neue Karte: einmal 3,5 Punkte extra, unabhängig von Reihenfolge und Anzahl', () => {
  const one = [{ id: 'a', beerId: 'BS-000011', at: 100 }];
  assert.strictEqual(G.summarize(one, map).sum, 12 + 35);
  assert.strictEqual(G.summarize(one, map).cards[0].points, 12 + 35);
  const three = G.normalizeDrinks([
    { id: 'b', beerId: 'BS-000011', at: 300 }, { id: 'a', beerId: 'BS-000011', at: 100 }, { id: 'c', beerId: 'BS-000011', at: 200 },
  ], map);
  assert.strictEqual(G.summarize(three, map).sum, 3 * 12 + 35);
  // Ein unbekanntes Bier bringt weder Punkte noch Bonus
  assert.strictEqual(G.summarize([{ id: 'x', beerId: 'BS-999999', at: 1 }], map).sum, 0);
  assert.strictEqual(G.summarize([], map).sum, 0);
  // Gleich viele Einträge: zwei verschiedene Biere bringen mehr als zweimal dasselbe
  const same = G.summarize([{ id: 'a', beerId: 'BS-000010', at: 1 }, { id: 'b', beerId: 'BS-000010', at: 2 }], map).sum;
  const diff = G.summarize([{ id: 'a', beerId: 'BS-000010', at: 1 }, { id: 'b', beerId: 'BS-000012', at: 2 }], map).sum;
  assert.deepStrictEqual([same, diff], [2 * 10 + 35, 2 * 10 + 2 * 35]);
});
test('Eintrag löschen senkt Punkte und Level', () => {
  // 7 × 1,0 + 3,5 Bonus = 10,5 → Level 2; ein Eintrag weniger: 9,5 → Level 1
  const many = Array.from({ length: 7 }, (_, i) => ({ id: 'x' + i, beerId: 'BS-000010', at: 1000 + i }));
  assert.strictEqual(G.level(G.summarize(G.normalizeDrinks(many, map), map).sum), 2);
  assert.strictEqual(G.level(G.summarize(G.normalizeDrinks(many.slice(1), map), map).sum), 1);
  // Letzter Eintrag weg: Karte und Bonus verschwinden
  assert.strictEqual(G.summarize(G.normalizeDrinks(many.slice(6), map), map).sum, 10 + 35);
  assert.strictEqual(G.summarize([], map).cards.length, 0);
});

/* ---------- Standort-Karte (STANDORT-KARTE) ---------- */

test('Ort wird geprüft und auf drei Nachkommastellen gerundet', () => {
  assert.deepStrictEqual(G.cleanPlace(52.520008, 13.404954), { lat: 52.52, lng: 13.405 });
  assert.deepStrictEqual(G.cleanPlace(-33.8688, 151.2093), { lat: -33.869, lng: 151.209 });
  assert.deepStrictEqual(G.cleanPlace(-0.0001, 0.0004), { lat: 0, lng: 0 }); // kein -0
  assert.strictEqual(G.cleanPlace(91, 10), null);
  assert.strictEqual(G.cleanPlace(10, 181), null);
  assert.strictEqual(G.cleanPlace(NaN, 10), null);
  assert.strictEqual(G.cleanPlace(Infinity, 10), null);
  assert.strictEqual(G.cleanPlace('52.5', '13.4'), null);
  assert.strictEqual(G.cleanPlace(52.5, undefined), null);
  assert.strictEqual(G.cleanPlace(null, null), null);
});
test('Einträge mit Ort: gültiger Ort bleibt, ungültiger entfällt, der Eintrag zählt immer', () => {
  const d = G.normalizeDrinks([
    { id: 'a', beerId: 'BS-000010', at: 1000, lat: 52.5201, lng: 13.4049 },
    { id: 'b', beerId: 'BS-000010', at: 2000, lat: 52.52 },            // nur ein Wert
    { id: 'c', beerId: 'BS-000010', at: 3000, lat: 500, lng: 13 },     // außerhalb
    { id: 'd', beerId: 'BS-000010', at: 4000, lat: '52', lng: '13' },  // Text
    { id: 'e', beerId: 'BS-000010', at: 5000 },
  ], map);
  assert.deepStrictEqual(d.map((x) => [x.id, x.lat, x.lng]), [['a', 52.52, 13.405], ['b', undefined, undefined], ['c', undefined, undefined], ['d', undefined, undefined], ['e', undefined, undefined]]);
  assert.ok(!('lat' in d[1]) && !('lng' in d[4]));
  // Punkte und Sammlung ändern sich durch Orte nicht
  assert.strictEqual(G.summarize(d, map).sum, 5 * 10 + 35);
});
test('Orte zusammenfassen: gleicher gerundeter Ort = ein Punkt mit Anzahl', () => {
  const d = G.normalizeDrinks([
    { id: 'a', beerId: 'BS-000010', at: 1000, lat: 52.5201, lng: 13.4049 },
    { id: 'b', beerId: 'BS-000011', at: 3000, lat: 52.5199, lng: 13.4051 },  // rundet auf denselben Ort
    { id: 'c', beerId: 'BS-000012', at: 2000, lat: 52.4, lng: 13.1 },
    { id: 'x', beerId: 'BS-000010', at: 4000 },                              // ohne Ort
  ], map);
  const g = G.placeGroups(d);
  assert.strictEqual(g.length, 2);
  assert.deepStrictEqual([g[0].lat, g[0].lng, g[0].count, g[0].last], [52.52, 13.405, 2, 3000]);
  assert.deepStrictEqual(g[0].drinks.map((x) => x.id), ['b', 'a']); // neueste zuerst
  assert.deepStrictEqual([g[1].count, g[1].last], [1, 2000]);
  assert.deepStrictEqual(G.placeGroups([]), []);
  assert.deepStrictEqual(G.placeGroups('x'), []);
});
test('Kartendateien (Datensammlung/karte): Format, Anzahl, Lage', () => {
  const dir = path.join(__dirname, '..', 'Datensammlung', 'karte');
  const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  // Ring entschlüsseln: [x0, y0, dx, dy, …] / Skalierung → [lng, lat]
  const decode = (flat, sc) => { const out = []; let x = 0, y = 0; for (let i = 0; i < flat.length; i += 2) { x = i === 0 ? flat[0] : x + flat[i]; y = i === 0 ? flat[1] : y + flat[i + 1]; out.push([x / sc, y / sc]); } return out; };
  const inBox = (layer, box) => layer.f.every((f) => f.p.every((poly) => poly.every((ring) => decode(ring, layer.s).every(([lng, lat]) => lng >= box[0] && lng <= box[2] && lat >= box[1] && lat <= box[3]))));
  const berlin = load('berlin.json').ebenen.ortsteile;
  const de = load('deutschland.json').ebenen;
  const welt = load('welt.json').ebenen.laender;
  assert.ok(berlin.f.length >= 96 && berlin.f.length <= 100);
  assert.ok(berlin.f.some((f) => f.n === 'Kreuzberg') && berlin.f.some((f) => f.n === 'Neukölln') && berlin.f.some((f) => f.n === 'Prenzlauer Berg'));
  assert.ok(inBox(berlin, [13.0, 52.3, 13.8, 52.7]), 'Ortsteile liegen in Berlin');
  assert.strictEqual(de.bundeslaender.f.length, 16);
  assert.ok(de.kreise.f.length >= 395 && de.kreise.f.length <= 405);
  assert.ok(inBox(de.bundeslaender, [5.5, 47, 15.5, 55.2]), 'Bundesländer liegen in Deutschland');
  assert.ok(welt.f.length > 150 && !welt.f.some((f) => f.n === 'Deutschland'), 'Staaten ohne Deutschland');
  // Beschriftungspunkt liegt im Kartenausschnitt des Objekts
  for (const f of berlin.f) { const [lng, lat] = [f.c[0] / berlin.s, f.c[1] / berlin.s]; assert.ok(lng > 13 && lng < 13.8 && lat > 52.3 && lat < 52.7, f.n); }
});

test('Echte biere_beerdb.json (Nachtrag aus beer-db.org): alle gültig, IDs BM-100001 fortlaufend, keine Warnung beim Zusammenführen', () => {
  const dir = path.join(__dirname, '..', 'Datensammlung');
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const beerdb = rd('biere_beerdb.json');
  const main = rd('biere.json'); const manual = rd('biere_manuell.json');
  const warns = [];
  const r = G.mergeBeers(main, manual, rd('kategorien.json'), (w) => warns.push(w), rd('biere_korrekturen.json'), rd('spezialkarten.json'), beerdb);
  assert.deepStrictEqual(warns, []);
  assert.strictEqual(r.list.length, main.length + manual.length + beerdb.length);
  beerdb.forEach((b, i) => {
    assert.strictEqual(b.id, `BM-${String(100001 + i).padStart(6, '0')}`);
    const x = r.map.get(b.id);
    assert.ok(x && x._file === 'biere_beerdb.json' && x.stufe === b.kategorie_stufe && x.kategorie === b.kategorie_name, b.id);
    assert.ok(x.company.name && /^https:\/\/beer-db\.org\/bier\//.test(b.quelle), b.id);
  });
  assert.ok(manual.every((b) => Number(b.id.slice(3)) < 100001), 'biere_manuell.json bleibt unter BM-100001');
});

/* ---------- Wochen ---------- */

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
test('Woche beginnt Montag 00:00 Ortszeit', () => {
  const ws = G.weekStart(at(2026, 11, 22, 23)); // Sonntag 22.11.2026
  assert.deepStrictEqual([ws.getFullYear(), ws.getMonth() + 1, ws.getDate(), ws.getHours()], [2026, 11, 16, 0]);
  assert.strictEqual(G.weekKey(at(2026, 11, 16, 0)), G.weekKey(at(2026, 11, 22, 23)));
  assert.notStrictEqual(G.weekKey(at(2026, 11, 22, 23)), G.weekKey(at(2026, 11, 23, 0)));
});
test('Wochenzählung über Sommerzeit und Jahreswechsel', () => {
  assert.strictEqual(G.weeksInclusive(at(2026, 3, 23), at(2026, 3, 30)), 2);  // Umstellung 29.03.
  assert.strictEqual(G.weeksInclusive(at(2026, 10, 19), at(2026, 10, 26)), 2); // Umstellung 25.10.
  assert.strictEqual(G.weeksInclusive(at(2026, 12, 28), at(2027, 1, 4)), 2);
  assert.strictEqual(G.weeksInclusive(at(2026, 11, 18), at(2026, 11, 18)), 1);
  assert.strictEqual(G.weeksInclusive(at(2026, 1, 1), at(2026, 12, 31)), 53); // Do 1.1. bis Do 31.12.
});

/* ---------- Kalenderwoche und Statistiken ---------- */

test('Kalenderwoche nach ISO 8601', () => {
  assert.deepStrictEqual(G.isoWeek(at(2026, 11, 18)), { week: 47, year: 2026 });
  assert.deepStrictEqual(G.isoWeek(at(2026, 1, 1)), { week: 1, year: 2026 });   // Donnerstag
  assert.deepStrictEqual(G.isoWeek(at(2025, 12, 29)), { week: 1, year: 2026 });
  assert.deepStrictEqual(G.isoWeek(at(2026, 12, 28)), { week: 53, year: 2026 });
  assert.deepStrictEqual(G.isoWeek(at(2027, 1, 1)), { week: 53, year: 2026 });  // Freitag
  assert.deepStrictEqual(G.isoWeek(at(2027, 1, 4)), { week: 1, year: 2027 });
  assert.deepStrictEqual(G.isoWeek(at(2026, 3, 29, 23)), { week: 13, year: 2026 }); // Sonntag der Zeitumstellung
});

test('Statistiken: leeres Protokoll', () => {
  const s = G.stats([], map, at(2026, 11, 18));
  assert.strictEqual(s.total, 0); assert.strictEqual(s.avgPerWeek, 0); assert.strictEqual(s.bestWeek, null);
  assert.strictEqual(s.history.length, 12); assert.ok(s.history.every((h) => h.count === 0));
  assert.strictEqual(s.favBeer, null); assert.strictEqual(s.avgAlc, null); assert.strictEqual(s.liter, 0);
  assert.deepStrictEqual(s.states, []);
});

test('Statistiken: Wochen, Ø, Lieblinge, Liter, Bundesländer', () => {
  // now = Mi 18.11.2026 (KW 47). Einträge: KW 45 (2), KW 46 (3), KW 47 (1). Erster Eintrag in KW 45 → 3 Wochen.
  const extra = G.mergeBeers([
    raw('BS-000020', 'X - Alkoholfrei', 3, { alkoholgehalt: 0, flaschengroesse: 0.33, biersorte: ['Pils', 'Alkoholfrei'], brauerei_vertrieb: { typ: 'Brauerei', name: 'Nordbräu', adresse: null, region: 'Hamburg', land: 'Deutschland' } }),
    raw('BS-000021', 'Y - Ohne Größe', 1, { alkoholgehalt: 7.5, flaschengroesse: null, brauerei_vertrieb: { typ: 'Brauerei', name: 'Wien AG', adresse: null, region: 'Wien', land: 'Österreich' } }),
  ], [], KAT).list;
  const m2 = new Map([...map, ...extra.map((b) => [b.id, b])]);
  const d = G.normalizeDrinks([
    { id: '1', beerId: 'BS-000010', at: at(2026, 11, 2, 20) },  // Mo KW 45, 4,9 %, 0,5 l, Bayern
    { id: '2', beerId: 'BS-000020', at: at(2026, 11, 6, 20) },  // Fr KW 45, alkoholfrei, 0,33 l, Hamburg
    { id: '3', beerId: 'BS-000010', at: at(2026, 11, 13, 20) }, // Fr KW 46
    { id: '4', beerId: 'BS-000021', at: at(2026, 11, 13, 21) }, // Fr KW 46, 7,5 %, ohne Größe, Österreich
    { id: '5', beerId: 'BS-000010', at: at(2026, 11, 15, 22) }, // So KW 46
    { id: '6', beerId: 'BS-000011', at: at(2026, 11, 16, 0, 30) }, // Mo KW 47 (kurz nach Mitternacht)
  ], m2);
  const s = G.stats(d, m2, at(2026, 11, 18, 12));
  assert.strictEqual(s.total, 6);
  assert.strictEqual(s.weeks, 3);
  assert.strictEqual(s.avgPerWeek, 20);           // 6 / 3 = 2,0
  assert.strictEqual(s.thisWeek, 1);
  assert.strictEqual(s.lastWeek, 3);
  assert.deepStrictEqual(s.bestWeek, { count: 3, week: 46, year: 2026 });
  assert.deepStrictEqual(s.history.map((h) => h.count).slice(-4), [0, 2, 3, 1]);
  assert.strictEqual(s.history[11].week, 47); assert.strictEqual(s.history[0].week, 36);
  assert.strictEqual(s.distinct, 4);
  assert.deepStrictEqual(s.foundByStufe, { 1: 2, 2: 1, 3: 1, 4: 0, 5: 0 });
  assert.strictEqual(s.favBeer.beer.id, 'BS-000010'); assert.strictEqual(s.favBeer.count, 3);
  // Alle Testbiere haben (u. a.) die Sorte "Pils"; "Alkoholfrei" kommt nur einmal vor
  assert.deepStrictEqual(s.favSorte, { name: 'Pils', count: 6 });
  assert.deepStrictEqual(s.favCompany, { name: 'Testbrauerei GmbH', count: 4 });
  assert.deepStrictEqual(s.favDay, { name: 'Freitag', count: 3 });
  // Ø Alkohol: (49 + 0 + 49 + 75 + 49 + 49) / 6 = 271 / 6 = 45,17 → 45 Zehntel = 4,5 %
  assert.strictEqual(s.avgAlc, 45);
  // Liter: 0,5 + 0,33 + 0,5 + 0,5 + 0,5 = 2,33 l → 23 Zehntel; ein Eintrag ohne Größe
  assert.strictEqual(s.liter, 23); assert.strictEqual(s.noSize, 1);
  assert.strictEqual(s.freePct, 17); // 1 von 6
  assert.deepStrictEqual(s.states, ['Bayern', 'Hamburg']); // Wien zählt nicht
});

test('Statistiken: Gleichstand bei Lieblingsbier → zuletzt getrunken', () => {
  const d = G.normalizeDrinks([
    { id: 'a', beerId: 'BS-000010', at: 1000 }, { id: 'b', beerId: 'BS-000012', at: 2000 },
  ], map);
  assert.strictEqual(G.stats(d, map, 3000).favBeer.beer.id, 'BS-000012');
});

/* ---------- Benutzername ---------- */

test('Benutzername', () => {
  assert.strictEqual(G.usernameKey('Max_Mustermann'), 'max_mustermann');
  assert.strictEqual(G.usernameKey('ab'), null);
  assert.strictEqual(G.usernameKey('a'.repeat(21)), null);
  assert.strictEqual(G.usernameKey('Müller'), null);
  assert.strictEqual(G.usernameKey('max-1'), null);
});

/* ---------- Rangliste ---------- */

test('Rangliste: sortiert nach Punkten (= Level), dann Bieren, dann Name; gleiche Punkte teilen den Platz', () => {
  const rows = [
    { uid: 'u1', username: 'Anna', sum: 270, count: 20, cards: 2 },   // Level 3
    { uid: 'u2', username: 'bernd', sum: 266, count: 12, cards: 3 },  // Level 3, weniger Punkte als Anna
    { uid: 'u3', username: 'Carl', sum: 270, count: 18, cards: 2 },   // gleiche Punkte wie Anna, weniger Biere
    { uid: 'u4', username: 'dora_1', sum: 0, count: 0, cards: 0 },
    { uid: 'u5', username: 'Emil', sum: 270, count: 18, cards: 1 },   // gleich wie Carl → nach Name
    { uid: 'u6', username: 'Fritz', sum: 400, count: 10, cards: 8 },  // Level 5 mit halb so vielen Bieren wie Anna: steht trotzdem vorn
  ];
  const b = G.rankBoard(rows);
  assert.deepStrictEqual(b.map((r) => r.username), ['Fritz', 'Anna', 'Carl', 'Emil', 'bernd', 'dora_1']);
  assert.deepStrictEqual(b.map((r) => r.rank), [1, 2, 2, 2, 5, 6]);
  assert.deepStrictEqual(b.map((r) => r.level), [5, 3, 3, 3, 3, 1]);
  assert.deepStrictEqual(b.map((r) => r.cards), [8, 2, 2, 1, 3, 0]);
  assert.strictEqual(b[4].count, 12); assert.strictEqual(b[4].uid, 'u2');
});

test('Rangliste: ungültige Zeilen fallen weg', () => {
  const bad = [
    null, 'x', {},
    { uid: 'a', username: 'ab', sum: 45, count: 1, cards: 1 },            // Name zu kurz
    { uid: 'b', username: '<b>hacker</b>', sum: 45, count: 1, cards: 1 }, // Name ungültig
    { uid: 'c', username: 'Hans', sum: 45.5, count: 1, cards: 1 },        // keine Ganzzahl
    { uid: 'd', username: 'Hans', sum: 44, count: 1, cards: 1 },          // weniger als 1,0 je Bier + 3,5 je Karte
    { uid: 'e', username: 'Hans', sum: 191, count: 1, cards: 1 },         // mehr als 3,5 je Bier + 3,5 je Karte + (1 + 2) × 4,0 Challenge-Spielraum (zur Zeit T0)
    { uid: 'f', username: 'Hans', sum: 10, count: -1, cards: 0 },
    { uid: 'g', username: 'Hans', sum: '45', count: 1, cards: 1 },
    { username: 'Hans', sum: 45, count: 1, cards: 1 },                    // ohne uid
    { uid: 'h', username: 'Hans', sum: 35, count: 1 },                    // ohne cards (alte App-Version)
    { uid: 'i', username: 'Hans', sum: 80, count: 1, cards: 2 },          // mehr Karten als Biere
    { uid: 'j', username: 'Hans', sum: 20, count: 2, cards: 0 },          // Biere, aber keine Karte
    { uid: 'k', username: 'Hans', sum: 45, count: 1, cards: '1' },
  ];
  // T0 = Beginn des Challenge-Spielraums (21.11.2026, 0:00 UTC); dann gibt es noch keine Wochen-Reserve
  const T0 = 1795219200000;
  assert.deepStrictEqual(G.rankBoard(bad, T0), []);
  assert.deepStrictEqual(G.rankBoard(undefined), []);
  // Grenzen genau: 1 × 1,0 + 3,5 und 1 × 3,5 + 3,5 + (1 + 2) × 4,0 Challenge-Spielraum
  assert.strictEqual(G.rankBoard([...bad, { uid: 'ok', username: 'Hans', sum: 45, count: 1, cards: 1 }], T0).length, 1);
  assert.strictEqual(G.rankBoard([{ uid: 'ok', username: 'Hans', sum: 70, count: 1, cards: 1 }], T0).length, 1);
  assert.strictEqual(G.rankBoard([{ uid: 'ok', username: 'Hans', sum: 190, count: 1, cards: 1 }], T0).length, 1);
  // Je Woche kommen 4,0 Punkte Spielraum dazu (eine Wochen-Challenge)
  assert.strictEqual(G.rankBoard([{ uid: 'ok', username: 'Hans', sum: 230, count: 1, cards: 1 }], T0 + 7 * 86400000).length, 1);
  assert.strictEqual(G.rankBoard([{ uid: 'ok', username: 'Hans', sum: 231, count: 1, cards: 1 }], T0 + 7 * 86400000).length, 0);
  assert.strictEqual(G.BOARD_SIZE, 15);
});

test('Kartenstufe: Veränderung ab 3, 7, 10, 15, 20, 25, 30, 35 und 40 Mal getrunken', () => {
  const expected = [[0, 0], [1, 0], [2, 0], [3, 1], [6, 1], [7, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4], [20, 5], [24, 5], [25, 6], [29, 6], [30, 7], [34, 7], [35, 8], [39, 8], [40, 9], [41, 9], [500, 9]];
  for (const [count, tier] of expected) assert.strictEqual(G.cardTier(count), tier, `count ${count}`);
});

/* ---------- Glückskeks-Nachrichten ---------- */

test('cleanMessages: gültige behalten, ungültige und doppelte IDs melden', () => {
  const warns = [];
  const list = G.cleanMessages([
    { id: 1, nachricht: ' Hallo ' }, { id: 2, nachricht: '' }, { nachricht: 'ohne id' }, { id: 1, nachricht: 'doppelt' },
    { id: 'a', nachricht: 'Text' }, null, { id: 0, nachricht: 'null ist keine ID' },
  ], (t) => warns.push(t));
  assert.deepStrictEqual(list, [{ id: '1', text: 'Hallo' }, { id: 'a', text: 'Text' }]);
  assert.strictEqual(warns.length, 5);
  assert.deepStrictEqual(G.cleanMessages({}, () => {}), []);
  assert.deepStrictEqual(G.cleanMessages(undefined), []);
});

test('pickMessage: jede Nachricht genau einmal, dann von vorn, ohne direkte Wiederholung', () => {
  const msgs = G.cleanMessages(Array.from({ length: 5 }, (_, i) => ({ id: i + 1, nachricht: 'N' + (i + 1) })));
  for (const rand of [Math.random, () => 0, () => 0.999999]) {
    let shown = [];
    let last = null;
    for (let round = 0; round < 3; round++) {
      const got = [];
      for (let i = 0; i < msgs.length; i++) {
        const p = G.pickMessage(msgs, shown, rand);
        shown = p.shownIds;
        got.push(p.message.id);
        if (i === 0 && last) assert.notStrictEqual(p.message.id, last, 'direkt nach dem Neustart keine Wiederholung');
      }
      assert.deepStrictEqual(got.slice().sort(), msgs.map((m) => m.id).sort(), `Runde ${round + 1}: jede genau einmal`);
      last = got[got.length - 1];
    }
  }
});

test('pickMessage: leere Liste, eine Nachricht, neue und entfernte Nachrichten', () => {
  assert.deepStrictEqual(G.pickMessage([], ['1']), { message: null, shownIds: [] });
  const one = G.cleanMessages([{ id: 1, nachricht: 'A' }]);
  assert.strictEqual(G.pickMessage(one, []).message.text, 'A');
  assert.strictEqual(G.pickMessage(one, ['1']).message.text, 'A'); // nur eine: darf sich wiederholen
  assert.deepStrictEqual(G.pickMessage(one, ['1']).shownIds, ['1']);
  // Neue Nachricht kommt als Nächste dran, entfernte ID fällt aus dem Merker
  const two = G.cleanMessages([{ id: 1, nachricht: 'A' }, { id: 2, nachricht: 'B' }]);
  const p = G.pickMessage(two, ['1', '99']);
  assert.strictEqual(p.message.id, '2');
  assert.deepStrictEqual(p.shownIds, ['1', '2']);
  // Kaputter Merker (kein Array) = von vorn
  assert.ok(G.pickMessage(two, 'x').message);
});

test('Echte nachrichten.json: gültig, mindestens eine Nachricht', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Datensammlung', 'nachrichten.json'), 'utf8'));
  const warns = [];
  const list = G.cleanMessages(raw, (t) => warns.push(t));
  assert.strictEqual(warns.length, 0, warns.join(' | '));
  assert.ok(list.length >= 1);
});

/* ---------- Spezialkarten ---------- */

test('Spezialkarten: cleanSpecials prüft Titel, Aussehen, Punkte, Bonus und doppelte IDs', () => {
  const warns = [];
  const list = G.cleanSpecials([
    { id: 'a', titel: ' Titel A ', design: 'baer', biere: ['BS-000001', 5] },
    { id: 'b', titel: 'B', design: 'sticker', punkte: 1.0, biere: [] },
    { id: 'a', titel: 'doppelt', design: 'baer', biere: [] },                 // doppelte ID
    { id: 'c', titel: 'C', design: 'unbekannt', biere: [] },                  // Aussehen unbekannt
    { id: 'd', titel: '', design: 'baer', biere: [] },                        // kein Titel
    { id: 'e', titel: 'E', design: 'sanchi', punkte: 2.6, biere: [] },        // Punkte außerhalb 1,0 … 2,5
    { id: 'f', titel: 'F', design: 'sanchi', punkte: 1.25, biere: [] },       // keine Zehntel
    { id: 'g', titel: 'G', design: 'sanchi', biere: 'x' },                    // biere keine Liste
    { id: 'h', titel: 'H', design: 'raddelfuss', bonus: 1.0, biere: [] },     // Bonus 1,0 → 10 Zehntel
    { id: 'i', titel: 'I', design: 'noir', bonus: 1.5, biere: [] },           // Bonus über 1,0 → kein Bonus
    null,
  ], (t) => warns.push(t));
  assert.deepStrictEqual(list.map((s) => [s.id, s.titel, s.design, s.punkte, s.bonus, s.biere]), [
    ['a', 'Titel A', 'baer', null, 0, ['BS-000001']], ['b', 'B', 'sticker', 10, 0, []], ['e', 'E', 'sanchi', null, 0, []], ['f', 'F', 'sanchi', null, 0, []],
    ['h', 'H', 'raddelfuss', null, 10, []], ['i', 'I', 'noir', null, 0, []],
  ]);
  assert.strictEqual(warns.length, 8, warns.join(' | ')); // doppelte ID, Aussehen, Titel, 2 × Punkte, biere, Bonus, null
  assert.deepStrictEqual(G.cleanSpecials(undefined), []);
  assert.deepStrictEqual(G.cleanSpecials({}, () => {}), []);
});

test('Spezialkarten: mergeBeers legt Titel, Aussehen und Punkte auf die Biere (Stufe bleibt)', () => {
  const warns = [];
  const r = G.mergeBeers([raw('BS-000001', 'A - Eins', 1), raw('BS-000002', 'A - Zwei', 2), raw('BS-000003', 'A - Drei', 1), raw('BS-000004', 'A - Vier', 5)], [], KAT, (t) => warns.push(t), {}, [
    { id: 'x', titel: 'Erste', design: 'sticker', punkte: 1.0, bonus: 1.0, biere: ['BS-000002', 'BS-000099'] },  // 099 unbekannt; feste Punkte gehen vor Bonus
    { id: 'y', titel: 'Zweite', design: 'sanchi', biere: ['BS-000002', 'BS-000003'] },                // 002 schon vergeben
    { id: 'z', titel: 'Raddelfuß', design: 'raddelfuss', bonus: 1.0, biere: ['BS-000004'] },          // Heiligtum + 1 Punkt
  ]);
  const b1 = r.map.get('BS-000001'), b2 = r.map.get('BS-000002'), b3 = r.map.get('BS-000003'), b4 = r.map.get('BS-000004');
  assert.strictEqual(warns.length, 2, warns.join(' | '));
  // Ohne Spezialkarte: Kategorie als Beschriftung, Klasse nach Stufe, Punkte der Stufe
  assert.strictEqual(b1.label, 'Standardgebräu'); assert.strictEqual(b1.look, 'k1'); assert.strictEqual(b1.spezial, null); assert.strictEqual(G.beerPoints(b1), 10);
  // Spezialkarte 2 auf ein Klassiker-Bier: Titel, Standardgebräu-Aussehen, 1,0 statt 1,2 Punkte (auch mit Bonus), Kategorie unverändert
  assert.strictEqual(b2.label, 'Erste'); assert.strictEqual(b2.look, 'k1 sp-sticker'); assert.strictEqual(b2.stufe, 2);
  assert.strictEqual(b2.kategorie, 'Klassiker'); assert.strictEqual(G.beerPoints(b2), 10); assert.strictEqual(b2.spezial.design, 'sticker');
  // Ohne eigene Punkte gelten die der Stufe
  assert.strictEqual(b3.label, 'Zweite'); assert.strictEqual(b3.look, 'sp-sanchi'); assert.strictEqual(G.beerPoints(b3), 10);
  // Bonus: Punkte der Stufe + 1,0; Kategorie bleibt intern Heiligtum, sichtbar ist nur der Titel der Spezialkarte
  assert.strictEqual(b4.label, 'Raddelfuß'); assert.strictEqual(b4.look, 'sp-raddel'); assert.strictEqual(b4.stufe, 5);
  assert.strictEqual(b4.kategorie, 'Heiligtum'); assert.strictEqual(b4.bonus, 10); assert.strictEqual(G.beerPoints(b4), 35);
  // Summe richtet sich nach den Bierpunkten (3 × 1,0 statt 3 × 1,2)
  const s = G.summarize([{ id: 'd1', beerId: 'BS-000002', at: 1 }, { id: 'd2', beerId: 'BS-000002', at: 2 }, { id: 'd3', beerId: 'BS-000002', at: 3 }], r.map);
  assert.strictEqual(s.sum, 30 + 35); assert.strictEqual(s.cards[0].points, 30 + 35);
  // Fehlt die Datei oder ist sie fehlerhaft, bleibt alles beim Alten
  const plain = G.mergeBeers([raw('BS-000002', 'A - Zwei', 2)], [], KAT, () => {}, {}, 'kaputt');
  assert.strictEqual(plain.map.get('BS-000002').label, 'Klassiker'); assert.strictEqual(G.beerPoints(plain.map.get('BS-000002')), 12);
});

test('Spezialkarten: echte Dateien (Verteilung vom 24.11.2026) – kein Standardgebräu/Klassiker außer STERNI und Legenden, Legenden = bekannteste Biere (5 bis 10), 11 Zufallskarten (36 Zaubertrank + 47 Heiligtum), 9 Spezialität-Karten (je 55), Rosemary und Killer (34 + 115), FCKAFD (94), Zufallskarten 1 Punkt extra', () => {
  const dir = path.join(__dirname, '..', 'Datensammlung');
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const warns = [];
  const r = G.mergeBeers(rd('biere.json'), rd('biere_manuell.json'), rd('kategorien.json'), (t) => warns.push(t), rd('biere_korrekturen.json'), rd('spezialkarten.json'), rd('biere_beerdb.json'));
  assert.strictEqual(warns.length, 0, warns.join(' | '));
  const by = {}; for (const b of r.list) if (b.spezial) (by[b.spezial.id] = by[b.spezial.id] || []).push(b);
  // 16 Legenden (Berlin + 15 weitere Bundesländer), je 5 bis 10 der bekanntesten Biere des Landes (seit 25.11.2026 wieder jede Stufe)
  const legenden = Object.keys(by).filter((k) => k === 'legende' || k.startsWith('legende-'));
  assert.strictEqual(legenden.length, 16);
  for (const k of legenden) assert.ok(by[k].length >= 5 && by[k].length <= 10, `${k}: ${by[k].length} Biere`);
  // Kein Standardgebräu und kein Klassiker auf Spezialkarten, Ausnahmen nur STERNI (Sternburg - Export) und die Legenden
  assert.deepStrictEqual(r.list.filter((b) => b.spezial && b.stufe <= 2 && !legenden.includes(b.spezial.id)).map((b) => b.id), ['BS-000887']);
  const zufall = [['aussenseiter', 'Außenseiter', 'sp-weltall'], ['bierkoenig', 'Bierkönig', 'sp-koenig'], ['heiliger-hopfen', 'Heiliger Hopfen', 'sp-hopfen'],
    ['raddelfuss', 'Raddelfuß', 'sp-raddel'], ['regenbogen', 'Spezial-Edition 04', 'sp-regenbogen'], ['sanchi', 'Sanchi', 'sp-sanchi'], ['schwarzweiss', 'Schwarze Nachtigal', 'sp-noir'],
    ['spezial-orange', 'Spezial Orange', 'sp-mono sp-orange'], ['spezial-rosa', 'Spezial Rosa', 'sp-mono sp-rosa'], ['spezial-rot', 'Spezial Rot', 'sp-mono sp-rot'], ['spezial-tuerkis', 'Spezial Türkis', 'sp-mono sp-tuerkis']];
  // Sonderedition 10 bis 60 (20.11.2026): je 55 Biere (seit 24.11.2026, vorher 40, kurz 30), nur Spezialität (Stufe 3), eigenes Design, Punkte der Stufe + 1,0
  const sonder = [10, 20, 30, 40, 50, 60].map((n) => [`sonderedition-${n}`, `Sonderedition ${n}`, `sp-se sp-se${n}`]);
  // Mischa, Rollmops, Penner (22.11.2026): je 55 Biere (vorher 40, kurz 30), nur Spezialität (Stufe 3), eigenes Design, Punkte der Stufe + 1,0
  sonder.push(['mischa', 'Mischa', 'sp-mischa'], ['rollmops', 'Rollmops', 'sp-rollmops'], ['penner', 'Penner', 'sp-penner']);
  // Rosemary und Killer (24.11.2026): je 149 Biere, 34 Spezialität (Stufe 3) und 115 Zaubertrank (Stufe 4), eigenes Design, Punkte der Stufe + 1,0
  const gross = [['rosemary', 'Rosemary', 'sp-rosemary'], ['killer', 'Killer', 'sp-killer']];
  for (const [k, titel, look] of gross) {
    const proStufe = {}; for (const b of by[k]) proStufe[b.stufe] = (proStufe[b.stufe] || 0) + 1;
    assert.deepStrictEqual(proStufe, { 3: 34, 4: 115 }, k);
    assert.ok(by[k].every((b) => b.label === titel && b.look === look && G.beerPoints(b) === G.pointsFor(b.stufe) + 10), `${titel}: Titel, Aussehen, Punkte`);
  }
  // FCKAFD (24.11.2026): 94 Biere (vorher 69), nur Zaubertrank (Stufe 4), eigenes Design, Punkte der Stufe + 1,0
  assert.strictEqual(by.fckafd.length, 94);
  assert.ok(by.fckafd.every((b) => b.stufe === 4 && b.label === 'FCKAFD' && b.look === 'sp-fckafd' && G.beerPoints(b) === G.pointsFor(4) + 10), 'FCKAFD: Stufe, Titel, Aussehen, Punkte');
  assert.deepStrictEqual(Object.keys(by).filter((k) => !legenden.includes(k)).sort(), ['bierball', 'hh-rakete', ...zufall.map((z) => z[0]), ...sonder.map((z) => z[0]), ...gross.map((z) => z[0]), 'fckafd'].sort());
  for (const [k, titel, look] of sonder) {
    assert.strictEqual(by[k].length, 55, k);
    assert.ok(by[k].every((b) => b.stufe === 3 && b.label === titel && b.look === look && G.beerPoints(b) === G.pointsFor(3) + 10), `${titel}: Stufe, Titel, Aussehen, Punkte`);
  }
  // Astra - Rakete: eigene Karte, sieht aus wie die Hamburger Legende, bringt aber feste 1,0 statt 1,3 (Stufe bleibt Spezialität)
  assert.deepStrictEqual(by['hh-rakete'].map((b) => b.id), ['BS-004132']);
  const rakete = r.map.get('BS-004132');
  assert.deepStrictEqual([rakete.label, rakete.look, rakete.spezial.design, rakete.stufe, G.beerPoints(rakete)], ['Hamburger Legende', 'k1 sp-icon', 'anker', 3, 10]);
  assert.ok(!by['legende-hh'].some((b) => b.id === 'BS-004132'));
  // Zufallskarten: je 83 Biere, nur Zaubertrank (36) und Heiligtum (47), Punkte der Stufe + 1,0
  for (const [k, titel, look] of zufall) {
    const proStufe = {}; for (const b of by[k]) proStufe[b.stufe] = (proStufe[b.stufe] || 0) + 1;
    assert.deepStrictEqual(proStufe, { 4: 36, 5: 47 }, k);
    assert.ok(by[k].every((b) => b.label === titel && b.look === look && G.beerPoints(b) === G.pointsFor(b.stufe) + 10), `${titel}: Titel, Aussehen, Punkte`);
  }
  // Länder-Legenden: Titel „… Legende“ (kurz genug fürs Band), Standardgebräu-Look, eigenes Wahrzeichen; Punkte nur die der Stufe (kein Bonus)
  const titel = legenden.map((k) => by[k][0].label);
  assert.ok(titel.every((t) => /Legende$/.test(t) && t.length <= 22), titel.join(', '));
  assert.strictEqual(new Set(legenden.map((k) => by[k][0].spezial.design)).size, 16, 'jedes Land hat sein eigenes Symbol');
  for (const k of legenden) assert.ok(by[k].every((b) => (b.look === 'k1 sp-baer' || b.look === 'k1 sp-icon') && G.beerPoints(b) === G.pointsFor(b.stufe)));
  assert.ok(legenden.filter((k) => k !== 'legende').every((k) => G.LEGEND_ICONS.includes(by[k][0].spezial.design)));
  assert.deepStrictEqual(by.legende.map((b) => b.id).sort(), ['BS-000169', 'BS-000822', 'BS-000882', 'BS-000885', 'BS-000943', 'BS-001490', 'BS-002764']);
  assert.strictEqual(r.map.get('BS-002764').stufe, 1); // Berliner Kindl Jubiläums Pilsener: Standardgebräu (seit 25.11.2026), Berliner Legende
  assert.ok(by.legende.every((b) => b.label === 'Berliner Legende'));
  // STERNI (früher Bierball-Bier, id bierball): nur noch Sternburg - Export (Oettinger - Export am 24.11.2026 entfernt), Standardgebräu, feste 1,0 Punkte
  assert.deepStrictEqual(by.bierball.map((b) => b.id), ['BS-000887']);
  assert.ok(by.bierball.every((b) => b.label === 'STERNI' && b.look === 'k1 sp-sticker'));
  assert.strictEqual(r.map.get('BS-000057').spezial, null);
  assert.strictEqual(r.map.get('BS-000887').kategorie, 'Standardgebräu'); assert.strictEqual(r.map.get('BS-000887').stufe, 1);
  assert.strictEqual(G.beerPoints(r.map.get('BS-000887')), 10); assert.strictEqual(G.beerPoints(r.map.get('BS-000057')), 10);
});

/* ---------- Alkohol-Auswertung (ALKOHOL-AUSWERTUNG) ---------- */

test('Reinalkohol: Größe × Prozent × 0,789, in Zehntel Gramm', () => {
  assert.strictEqual(G.gramsTenths({ alc: 5, flasche: 0.5 }), 197);       // 19,7 g
  assert.strictEqual(G.gramsTenths({ alc: 4.8, flasche: 0.33 }), 125);    // 12,5 g
  assert.strictEqual(G.gramsTenths({ alc: 0, flasche: 0.5 }), 0);         // alkoholfrei
  assert.strictEqual(G.gramsTenths({ alc: 5, flasche: null }), null);     // ohne Größe: nicht mitgezählt
  assert.strictEqual(G.gramsTenths({ alc: null, flasche: 0.5 }), null);
  assert.strictEqual(G.gramsTenths(null), null);
});

test('Körperdaten: cleanBody und parseKg prüfen streng', () => {
  assert.deepStrictEqual(G.cleanBody(null), { sex: null, kg: null });
  assert.deepStrictEqual(G.cleanBody({ sex: 'w', kg: 64 }), { sex: 'w', kg: 64 });
  assert.deepStrictEqual(G.cleanBody({ sex: 'x', kg: 10 }), { sex: null, kg: null });
  assert.deepStrictEqual(G.cleanBody({ sex: 'm', kg: 'viel' }), { sex: 'm', kg: null });
  assert.deepStrictEqual(G.cleanBody({ sex: 'm', kg: 64.26 }), { sex: 'm', kg: 64.3 });
  assert.deepStrictEqual(G.cleanBody({ kg: 64 }), { sex: null, kg: 64 }); // Gewicht allein bleibt, die Auswertung braucht aber das Geschlecht
  assert.strictEqual(G.parseKg('64'), 64);
  assert.strictEqual(G.parseKg(' 64,5 '), 64.5);
  assert.strictEqual(G.parseKg('64.5'), 64.5);
  assert.strictEqual(G.parseKg('64 kg'), 64);
  for (const bad of ['', 'abc', '29,9', '251', '-5', '6 4', '64,555', '1e2', '0x40']) assert.strictEqual(G.parseKg(bad), null, bad);
  assert.strictEqual(G.parseKg('30'), 30); assert.strictEqual(G.parseKg('250'), 250);
});

test('Label A bis D: Grenzen für Frauen und Männer (Gramm pro Woche in Zehnteln)', () => {
  assert.deepStrictEqual(G.LABELS, ['A', 'B', 'C', 'D']);
  const want = [[0, 'A'], [270, 'A'], [271, 'B'], [810, 'B'], [811, 'C']];
  for (const sex of ['m', 'w']) for (const [g, l] of want) assert.strictEqual(G.labelFor(g, sex), l, `${sex} ${g}`);
  assert.strictEqual(G.labelFor(1400, 'w'), 'C'); assert.strictEqual(G.labelFor(1401, 'w'), 'D'); // 20 g pro Tag
  assert.strictEqual(G.labelFor(2100, 'm'), 'C'); assert.strictEqual(G.labelFor(2101, 'm'), 'D'); // 30 g pro Tag
  assert.strictEqual(G.labelFor(1500, 'w'), 'D'); assert.strictEqual(G.labelFor(1500, 'm'), 'C'); // dasselbe Trinken, anderer Bereich
  assert.strictEqual(G.labelFor(100, null), null);
});

{
  // Mi 18.11.2026 12:00. P = 0,5 l 5 % (19,7 g), H = 0,33 l 4,8 % (12,5 g), F = alkoholfrei, X = ohne Größe
  const NOW = at(2026, 11, 18, 12);
  const abeers = new Map([
    ['P', { id: 'P', alc: 5, flasche: 0.5 }], ['H', { id: 'H', alc: 4.8, flasche: 0.33 }],
    ['F', { id: 'F', alc: 0, flasche: 0.5 }], ['X', { id: 'X', alc: 5, flasche: null }],
    ['S', { id: 'S', alc: 6.4, flasche: 0.5 }], // 25,3 g
  ]);
  const e = (id, y, m, d, h) => ({ beerId: id, at: at(y, m, d, h) });
  const entries = [
    e('P', 2026, 10, 9, 20),                                                   // 40 Tage her: außerhalb der 28 Tage, zählt aber für die Wochenzahl
    e('P', 2026, 11, 6, 20), e('P', 2026, 11, 6, 21),                          // Abend 1: 39,4 g
    e('P', 2026, 11, 14, 20), e('P', 2026, 11, 14, 21), e('H', 2026, 11, 14, 22), // Abend 2: 51,9 g (Samstag)
    e('P', 2026, 11, 16, 19), e('F', 2026, 11, 16, 20),                        // Abend 3 (Montag, diese Woche): 19,7 g; alkoholfrei zählt nicht
    e('X', 2026, 11, 17, 18),                                                  // ohne Größe
  ];

  test('Auswertung: ohne Geschlecht oder ohne Einträge gibt es keine', () => {
    assert.strictEqual(G.alcoholReport(entries, abeers, null, NOW), null);
    assert.strictEqual(G.alcoholReport(entries, abeers, { kg: 80 }, NOW), null);
    assert.strictEqual(G.alcoholReport([], abeers, { sex: 'm' }, NOW), null);
    assert.strictEqual(G.alcoholReport([{ beerId: 'unbekannt', at: NOW - 1000 }], abeers, { sex: 'm' }, NOW), null);
  });

  test('Auswertung: Schnitt, diese Woche, Label, Abende', () => {
    const r = G.alcoholReport(entries, abeers, { sex: 'm' }, NOW);
    assert.strictEqual(r.weeks, 4);
    assert.strictEqual(r.windowG10, 394 + 519 + 197);   // 111,0 g in 28 Tagen
    assert.strictEqual(r.weekG10, 278);                  // 27,8 g pro Woche (277,5 gerundet)
    assert.strictEqual(r.label, 'B');
    assert.strictEqual(r.thisWeekG10, 197);              // seit Montag 16.11.
    assert.strictEqual(r.noSize, 1);
    assert.deepStrictEqual(r.limits, [27, 81, 210]);
    assert.strictEqual(r.halbe, 14);                     // 1,4 Flaschen à 0,5 l
    assert.strictEqual(r.peak.g10, 519); assert.strictEqual(r.peak.n, 3);
    assert.strictEqual(r.peak.start, at(2026, 11, 14, 20)); assert.strictEqual(r.peak.end, at(2026, 11, 14, 22));
    assert.strictEqual(r.peak.peak100, undefined);       // ohne Gewicht keine Promille
    assert.deepStrictEqual(r.binge, { limit: 60, count: 0 });
  });

  test('Auswertung: Frauen haben niedrigere Rauschtrink-Grenze, anderes Label bei gleichem Trinken', () => {
    const w = G.alcoholReport(entries, abeers, { sex: 'w' }, NOW);
    assert.deepStrictEqual(w.binge, { limit: 48, count: 1 }); // Abend 2 mit 51,9 g
    assert.deepStrictEqual(w.limits, [27, 81, 140]);
    const many = [e('P', 2026, 10, 9, 20)]; for (let i = 0; i < 32; i++) many.push(e('P', 2026, 11, 10 + (i % 8), 8 + (i % 12))); // 6.304 / 4 Wochen = 157,6 g pro Woche
    const m = G.alcoholReport(many, abeers, { sex: 'm' }, NOW); const f = G.alcoholReport(many, abeers, { sex: 'w' }, NOW);
    assert.strictEqual(m.weekG10, f.weekG10);
    assert.ok(m.weekG10 > 1400 && m.weekG10 <= 2100, String(m.weekG10));
    assert.strictEqual(m.label, 'C'); assert.strictEqual(f.label, 'D');
  });

  test('Auswertung: Promille nach Widmark mit Gewicht (0,7 Männer, 0,6 Frauen, Abbau 0,1 ‰/h)', () => {
    const m = G.alcoholReport(entries, abeers, { sex: 'm', kg: 80 }, NOW).peak;
    // 19,7 g/(80·0,7)=0,3518; nach 1 h −0,1; zweites Bier; nach 1 h −0,1; drittes (12,5 g): 0,7268 ‰
    assert.strictEqual(m.peak100, 73);
    assert.ok(Math.abs(m.soberHours - 7.268) < 0.001, String(m.soberHours));
    const f = G.alcoholReport(entries, abeers, { sex: 'w', kg: 64 }, NOW).peak;
    assert.ok(f.peak100 > m.peak100, 'leichter und kleinerer Faktor → höherer Wert');
    // Ein einzelnes Bier: 19,7 g, 80 kg, Mann → 0,35 ‰, in 3,5 Stunden abgebaut
    const one = G.alcoholReport([e('P', 2026, 11, 18, 10)], abeers, { sex: 'm', kg: 80 }, NOW).peak;
    assert.strictEqual(one.peak100, 35); assert.ok(Math.abs(one.soberHours - 3.518) < 0.001);
    assert.strictEqual(G.fmtPermille(73), '0,73 ‰'); assert.strictEqual(G.fmtPermille(100), '1,00 ‰');
  });

  test('Auswertung: Abend endet nach 6 Stunden Pause; kurze Nutzung zählt mindestens eine Woche', () => {
    const w = { sex: 'w' };
    const close = [e('S', 2026, 11, 17, 12), e('S', 2026, 11, 17, 17)];   // 5 h Abstand: ein Abend mit 50,6 g
    const far = [e('S', 2026, 11, 17, 12), e('S', 2026, 11, 17, 19)];     // 7 h Abstand: zwei Abende
    assert.strictEqual(G.alcoholReport(close, abeers, w, NOW).binge.count, 1);
    assert.strictEqual(G.alcoholReport(far, abeers, w, NOW).binge.count, 0);
    assert.strictEqual(G.alcoholReport(far, abeers, w, NOW).peak.n, 1);
    // Erster Eintrag vor einem Tag: Fenster = 1 Woche, kein Hochrechnen
    const r = G.alcoholReport([e('P', 2026, 11, 17, 12)], abeers, { sex: 'm' }, NOW);
    assert.strictEqual(r.weeks, 1); assert.strictEqual(r.weekG10, 197); assert.strictEqual(r.label, 'A');
    // Erster Eintrag vor 14 Tagen: Fenster = 2 Wochen
    const r2 = G.alcoholReport([e('P', 2026, 11, 4, 12), e('P', 2026, 11, 5, 12)], abeers, { sex: 'm' }, NOW);
    assert.ok(r2.weeks > 1.9 && r2.weeks < 2.1, String(r2.weeks));
    assert.strictEqual(r2.weekG10, Math.round(394 / r2.weeks));
  });

  test('Auswertung: nur alkoholfreie oder alte Einträge → Bereich A, kein Abend', () => {
    const r = G.alcoholReport([e('F', 2026, 11, 17, 12), e('P', 2026, 9, 1, 12)], abeers, { sex: 'm', kg: 70 }, NOW);
    assert.strictEqual(r.weekG10, 0); assert.strictEqual(r.label, 'A'); assert.strictEqual(r.peak, null);
    assert.deepStrictEqual(r.binge, { limit: 60, count: 0 });
  });
}

/* ---------- Echte Datenbank ---------- */

test('Echte biere.json: alle 6.368 gültig, Eigenheiten sauber', () => {
  const dir = path.join(__dirname, '..', 'Datensammlung');
  const main = JSON.parse(fs.readFileSync(path.join(dir, 'biere.json'), 'utf8'));
  const kat = JSON.parse(fs.readFileSync(path.join(dir, 'kategorien.json'), 'utf8'));
  const warns = [];
  const fixes = JSON.parse(fs.readFileSync(path.join(dir, 'biere_korrekturen.json'), 'utf8'));
  const r = G.mergeBeers(main, [], kat, (t) => warns.push(t), fixes);
  assert.strictEqual(warns.length, 0, warns.slice(0, 3).join(' | '));
  assert.strictEqual(r.list.length, 6368);
  // Fünf Kategorien nach Erhältlichkeit; Zahl der Biere je Stufe (Einordnung vom 19.11.2026, nachgebessert am 25.11.2026, scraper/stufen_zuordnung.json)
  assert.deepStrictEqual(kat.map((k) => [k.stufe, k.name]), [[1, 'Standardgebräu'], [2, 'Klassiker'], [3, 'Spezialität'], [4, 'Zaubertrank'], [5, 'Heiligtum']]);
  const proStufe = {}; for (const b of r.list) proStufe[b.stufe] = (proStufe[b.stufe] || 0) + 1;
  assert.deepStrictEqual(proStufe, { 1: 122, 2: 324, 3: 1804, 4: 2447, 5: 1671 });
  assert.strictEqual(r.map.get('BS-002764').stufe, 1); // Berliner Kindl - Jubiläums Pilsener Premium: in fast jedem Supermarkt
  const zuordnung = JSON.parse(fs.readFileSync(path.join(dir, 'scraper', 'stufen_zuordnung.json'), 'utf8'));
  assert.ok(r.list.every((b) => zuordnung[b.id] === b.stufe), 'biere.json passt zu stufen_zuordnung.json');
  const sternburg = r.map.get('BS-000887');
  assert.ok(sternburg && sternburg.title === 'Export' && sternburg.brand === 'Sternburg');
  assert.strictEqual(sternburg.kategorie, 'Standardgebräu'); assert.strictEqual(sternburg.stufe, 1);
  // Stichproben: Supermarktbier unten, Kleinstbrauerei oben
  assert.strictEqual(r.map.get('BS-000081').stufe, 1); // Krombacher - Pils
  assert.strictEqual(r.map.get('BS-000023').stufe, 2); // Rothaus - Tannenzäpfle Pils (regional)
  assert.strictEqual(r.map.get('BS-000001').stufe, main.find((b) => b.id === 'BS-000001').kategorie_stufe);
  const t0 = Date.now();
  const index = G.buildIndex(r.list);
  const tIndex = Date.now() - t0;
  const t1 = Date.now();
  const hits = G.search(index, 'münchner hell');
  const tSearch = Date.now() - t1;
  assert.ok(hits.length > 0 && hits.length <= 10);
  assert.strictEqual(G.search(index, 'bier').length, 10); // höchstens 10 Treffer
  assert.strictEqual(G.search(index, 'bier', 3).length, 3);
  // Nichts darf als Text "null" oder "undefined" enthalten
  for (const b of r.list) for (const v of [b.title, b.brand, b.kategorie, ...b.sorten]) assert.ok(v && !/^(null|undefined)$/.test(v), b.id);
  console.log(`     Index ${tIndex} ms, Suche ${tSearch} ms, Treffer „münchner hell“: ${hits.length}`);
});

/* ---------- Challenges ---------- */

{
  // Kleine Bierdatenbank für die Challenge-Tests
  const mk = (id, stufe, extra = {}) => ({ id, stufe, sorten: extra.sorten || [], alc: extra.alc ?? 5, spezial: extra.spezial || null, punkte: null, bonus: 0,
    company: { region: extra.region ?? 'Bayern', land: extra.land ?? 'Deutschland' } });
  const beers = new Map([
    ['BS-000001', mk('BS-000001', 1)],
    ['BS-000002', mk('BS-000002', 4, { region: 'Hamburg', alc: 7.5 })],
    ['BS-000003', mk('BS-000003', 5, { land: 'Polen', region: null, alc: 3.5 })],
    ['BS-000004', mk('BS-000004', 2, { sorten: ['Helles'], spezial: { id: 'x', titel: 'X', design: 'baer' } })],
  ]);
  const DAY = 86400000;
  const S = G.CHALLENGE_START; // Sonntag 22.11.2026, 0:00 Ortszeit
  const at = (days, h = 20) => new Date(new Date(S).getFullYear(), new Date(S).getMonth(), new Date(S).getDate() + days, h).getTime();
  let n = 0;
  const dr = (beerId, t) => ({ id: `d${String(++n).padStart(4, '0')}`, beerId, at: t });
  const raw = [
    { id: 'n-name', art: 'N', punkte: 1.0, text: 'Name', typ: 'benutzername' },
    { id: 'n-hh', art: 'N', punkte: 1.0, text: 'Hamburg', typ: 'biere', region: 'Hamburg' },
    { id: 'n-2', art: 'N', punkte: 2.0, text: 'Zwei Biere', typ: 'biere', ziel: 2 },
    { id: 'w-3', art: 'W', punkte: 2.0, text: 'Drei Biere', typ: 'biere', ziel: 3 },
  ];
  const list = G.cleanChallenges(raw);

  test('Challenges: Woche beginnt Sonntag 0:00 Uhr Ortszeit', () => {
    assert.strictEqual(new Date(S).getDay(), 0);
    assert.strictEqual(G.challengeWeekStart(at(6, 23)).getTime(), S);        // Samstag 23 Uhr: noch dieselbe Woche
    assert.strictEqual(G.challengeWeekStart(at(7, 0)).getTime(), at(7, 0));  // Sonntag 0 Uhr: neue Woche
    assert.strictEqual(G.challengeWeekKey(at(7, 0)) - G.challengeWeekKey(at(0, 1)), 7);
  });

  test('Challenges: echte Datei challenges.json ist gültig (26 Stück, 11 N, 15 W)', () => {
    const warns = [];
    const real = G.cleanChallenges(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Datensammlung', 'challenges.json'), 'utf8')), (t) => warns.push(t));
    assert.deepStrictEqual(warns, []);
    assert.strictEqual(real.length, 26);
    assert.strictEqual(real.filter((c) => c.art === 'N').length, 11);
    assert.strictEqual(real.filter((c) => c.art === 'W').length, 15);
    assert.ok(real.every((c) => c.punkte > 0 && c.punkte <= G.CHALLENGE_MAX_POINTS));
    assert.strictEqual(real.find((c) => c.id === 'w-biere-10').punkte, 40);
    assert.strictEqual(real.find((c) => c.id === 'w-punkte-5').ziel, 50);
    // Erste Woche (22.11.2026) ist „Trinke ein Helles“, nicht „kein Bier“ (fester Startwert der Auswahl)
    assert.strictEqual(G.weekPicks(real, at(1)).map((p) => p.ch.id).join(), 'w-helles');
  });

  test('Challenges: ungültige Einträge fallen mit Warnung weg', () => {
    const warns = [];
    const out = G.cleanChallenges([
      { id: 'a', art: 'X', punkte: 1, text: 't', typ: 'biere' },
      { id: 'b', art: 'W', punkte: 5, text: 't', typ: 'biere' },          // mehr als 4,0
      { id: 'c', art: 'N', punkte: 1, text: 't', typ: 'keins' },          // keins nur W
      { id: 'd', art: 'W', punkte: 1, text: 't', typ: 'benutzername' },   // benutzername nur N
      { id: 'e', art: 'W', punkte: 1, text: 't', typ: 'biere', farbe: 1 }, // unbekanntes Feld
      { id: 'f', art: 'W', punkte: 1, text: 't', typ: 'biere', ziel: 0 },
      { id: 'g', art: 'W', punkte: 1, text: 't', typ: 'biere', stufe: 9 },
      { id: 'h', art: 'W', punkte: 1.05, text: 't', typ: 'biere' },        // keine Zehntel
      { id: 'ok', art: 'W', punkte: 1, text: 't', typ: 'biere' },
      { id: 'ok', art: 'W', punkte: 1, text: 't', typ: 'biere' },         // doppelt
    ], (t) => warns.push(t));
    assert.deepStrictEqual(out.map((c) => c.id), ['ok']);
    assert.strictEqual(warns.length, 9);
    assert.deepStrictEqual(G.cleanChallenges(undefined), []);
  });

  test('Challenges: Filter (neu, Stufe, Region, Ausland, Land, Alkohol, Sorte, Spezialkarte)', () => {
    const m = G.challengeMatch;
    const b2 = beers.get('BS-000002'); const b3 = beers.get('BS-000003'); const b4 = beers.get('BS-000004');
    assert.ok(m({ neu: true, stufe: 4 }, b2, true)); assert.ok(!m({ neu: true, stufe: 4 }, b2, false));
    assert.ok(m({ region: 'Hamburg' }, b2, false)); assert.ok(!m({ region: 'Hamburg' }, b3, false));
    assert.ok(m({ ausland: true }, b3, false)); assert.ok(!m({ ausland: true }, b2, false));
    assert.ok(m({ land: 'Polen' }, b3, false));
    assert.ok(m({ alkUeber: 7.0 }, b2, false)); assert.ok(!m({ alkUeber: 7.5 }, b2, false)); // „mehr als“ = echt größer
    assert.ok(m({ alkUnter: 4.0 }, b3, false)); assert.ok(!m({ alkUnter: 4.0 }, { ...b3, alc: null }, false)); // ohne Angabe zählt nicht
    assert.ok(m({ sorten: ['Helles'] }, b4, false)); assert.ok(!m({ sorten: ['Helles'] }, b2, false));
    assert.ok(m({ spezial: true }, b4, false)); assert.ok(!m({ spezial: true }, b2, false));
  });

  test('Challenges: Wochen-Challenge geschafft, abgehakt, wechselt am Sonntag', () => {
    const d = [dr('BS-000001', at(1)), dr('BS-000001', at(2)), dr('BS-000001', at(3))];
    const st = G.challengeState(d, beers, list, at(4), true);
    assert.strictEqual(st.week.ch.id, 'w-3');
    assert.ok(st.week.done); assert.strictEqual(st.week.progress, 3);
    assert.strictEqual(st.week.end, at(7, 0));
    // Nächste Woche: wieder offen, die Punkte der letzten Woche bleiben
    const next = G.challengeState(d, beers, list, at(8), true);
    assert.ok(!next.week.done); assert.strictEqual(next.week.progress, 0);
    assert.ok(next.done.some((x) => x.ch.id === 'w-3' && x.week === G.challengeWeekKey(S)));
    // 2 Biere: nicht geschafft
    assert.ok(!G.challengeState(d.slice(0, 2), beers, list, at(4), true).week.done);
  });

  test('Challenges: N-Kette – Benutzername sofort, dann der Reihe nach, Folge-Challenge zählt erst danach', () => {
    const d = [dr('BS-000001', at(1)), dr('BS-000002', at(1, 21)), dr('BS-000001', at(2))];
    const st = G.challengeState(d, beers, list, at(3), true);
    // Name schon da → n-name sofort geschafft; Hamburg mit dem 2. Eintrag; „Zwei Biere“ zählt erst ab dem 3. Eintrag
    assert.deepStrictEqual(st.done.filter((x) => !x.week).map((x) => x.ch.id), ['n-name', 'n-hh']);
    assert.strictEqual(st.open.ch.id, 'n-2'); assert.strictEqual(st.open.progress, 1);
    // Punkte: 1,0 (Name) + 1,0 (Hamburg) + 2,0 (Woche, 3 Biere)
    assert.strictEqual(st.points, 40);
  });

  test('Challenges: ohne Benutzernamen bleibt die Namens-Challenge offen, im lokalen Modus entfällt sie', () => {
    const d = [dr('BS-000002', at(1))];
    const noName = G.challengeState(d, beers, list, at(2), false);
    assert.strictEqual(noName.open.ch.id, 'n-name'); assert.strictEqual(noName.points, 0);
    const local = G.challengeState(d, beers, list, at(2), null);
    assert.deepStrictEqual(local.done.map((x) => x.ch.id), ['n-hh']);
    assert.strictEqual(local.open.ch.id, 'n-2');
  });

  test('Challenges: Löschen des abschließenden Eintrags macht die Challenge wieder offen', () => {
    const d = [dr('BS-000001', at(1)), dr('BS-000001', at(2)), dr('BS-000002', at(3))];
    const before = G.challengeState(d, beers, list, at(4), true);
    assert.ok(before.week.done);
    assert.ok(before.done.some((x) => x.ch.id === 'n-hh'));
    const after = G.challengeState(d.slice(0, 2), beers, list, at(4), true);
    assert.ok(!after.week.done);
    assert.strictEqual(after.open.ch.id, 'n-hh');
    assert.strictEqual(before.points - after.points, 30); // 2,0 Woche + 1,0 Hamburg
  });

  test('Challenges: nach der letzten N-Challenge beginnt die Liste von vorn (ohne Benutzername)', () => {
    const d = [dr('BS-000002', at(1)), dr('BS-000001', at(1, 21)), dr('BS-000001', at(1, 22)), dr('BS-000002', at(2))];
    const st = G.challengeState(d, beers, list, at(3), true);
    assert.deepStrictEqual(st.done.filter((x) => !x.week).map((x) => x.ch.id), ['n-name', 'n-hh', 'n-2', 'n-hh']);
    assert.strictEqual(st.open.ch.id, 'n-2');
  });

  test('Challenges: „kein Bier“ zählt erst nach Wochenende, ein Bier macht sie unmöglich', () => {
    const only = G.cleanChallenges([{ id: 'w-keins', art: 'W', punkte: 1.5, text: 'Kein Bier', typ: 'keins' }]);
    const empty = G.challengeState([], beers, only, at(3), true);
    assert.ok(!empty.week.done && !empty.week.failed); assert.strictEqual(empty.points, 0);
    assert.strictEqual(G.challengeState([], beers, only, at(8), true).points, 15);   // Woche vorbei, kein Bier → geschafft
    const one = G.challengeState([dr('BS-000001', at(2))], beers, only, at(3), true);
    assert.ok(one.week.failed);
    assert.strictEqual(G.challengeState([dr('BS-000001', at(2))], beers, only, at(8), true).points, 0);
  });

  test('Challenges: „gleiches“, „punkte“, „neu“ und Einträge vor dem Start', () => {
    const l = G.cleanChallenges([
      { id: 'w-g', art: 'W', punkte: 2, text: 'g', typ: 'gleiches', ziel: 2 },
    ]);
    assert.ok(G.challengeState([dr('BS-000001', at(1)), dr('BS-000001', at(2))], beers, l, at(3), true).week.done);
    assert.ok(!G.challengeState([dr('BS-000001', at(1)), dr('BS-000004', at(2))], beers, l, at(3), true).week.done);
    const p = G.cleanChallenges([{ id: 'w-p', art: 'W', punkte: 1, text: 'p', typ: 'punkte', ziel: 5.0 }]);
    // Neues Bier Stufe 1: 1,0 + 3,5 = 4,5 → noch nicht; zweites Trinken +1,0 → 5,5
    assert.strictEqual(G.challengeState([dr('BS-000001', at(1))], beers, p, at(3), true).week.progress, 45);
    assert.ok(G.challengeState([dr('BS-000001', at(1)), dr('BS-000001', at(2))], beers, p, at(3), true).week.done);
    // „Entdecke“: vor dem Start schon getrunken → nicht mehr neu; Einträge vor dem Start zählen nicht
    const z = G.cleanChallenges([{ id: 'n-z', art: 'N', punkte: 1, text: 'z', typ: 'biere', neu: true, stufe: 4 }]);
    assert.strictEqual(G.challengeState([dr('BS-000002', S - DAY), dr('BS-000002', at(1))], beers, z, at(2), true).points, 0);
    assert.strictEqual(G.challengeState([dr('BS-000002', at(1))], beers, z, at(2), true).points, 10);
  });

  test('Challenges: Wochen-Auswahl ist fest, für alle gleich und wiederholt sich nicht direkt', () => {
    const real = G.cleanChallenges(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Datensammlung', 'challenges.json'), 'utf8')));
    const a = G.weekPicks(real, at(400)).map((p) => p.ch.id);
    const b = G.weekPicks(real, at(400)).map((p) => p.ch.id);
    assert.deepStrictEqual(a, b);
    assert.strictEqual(a.length, 58);
    // innerhalb von 7 Wochen keine Challenge doppelt (15 W-Challenges → die letzten 7 sind gesperrt)
    for (let i = 0; i < a.length; i++) assert.ok(!a.slice(Math.max(0, i - 7), i).includes(a[i]), `Woche ${i}`);
    // Eine neue Challenge mit „ab“ ändert vergangene Wochen nicht
    const more = G.cleanChallenges([...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Datensammlung', 'challenges.json'), 'utf8')),
      { id: 'w-neu', art: 'W', punkte: 1, text: 'neu', typ: 'biere', ab: '2027-03-07' }]);
    const c = G.weekPicks(more, at(400)).map((p) => p.ch.id);
    const cut = G.weekPicks(real, new Date(2027, 2, 6).getTime()).length;
    assert.deepStrictEqual(c.slice(0, cut), a.slice(0, cut));
    assert.ok(c.slice(cut).includes('w-neu'));
  });

  test('Challenges: Spielraum der Rangliste wächst je Bier und je Woche um 4,0', () => {
    const T0 = 1795219200000;
    assert.strictEqual(G.challengeAllowance(0, T0), 80);
    assert.strictEqual(G.challengeAllowance(3, T0), 200);
    assert.strictEqual(G.challengeAllowance(0, T0 + 14 * DAY), 160);
    assert.strictEqual(G.challengeAllowance(0, T0 - DAY), 80);
  });
}

console.log(`\n${passed} Tests bestanden${process.exitCode ? ', es gab FEHLER' : ''}.`);
