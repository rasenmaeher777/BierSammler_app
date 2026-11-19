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
test('10 × Stufe 6 = 160 → Level 2, 6,0 / 10', () => check(sumOf([10, 6]), 160, 2, '6,0 / 10 Punkte'));
test('10 × Stufe 1 = 100 → Level 2, 0,0 / 10', () => { check(sumOf([10, 1]), 100, 2, '0,0 / 10 Punkte'); assert.strictEqual(G.ring(100), 0); assert.strictEqual(G.level(99), 1); });
test('20 × Stufe 1 = 200 → Level 3, 0,0 / 10', () => { check(sumOf([20, 1]), 200, 3, '0,0 / 10 Punkte'); assert.strictEqual(G.ring(200), 0); });
test('19 × Stufe 4 = 266 → Level 3, 6,6 / 10', () => check(sumOf([19, 4]), 266, 3, '6,6 / 10 Punkte'));
test('13 × Stufe 1 + 5 × Stufe 6 = 210 → Level 3, 1,0 / 10', () => check(sumOf([13, 1], [5, 6]), 210, 3, '1,0 / 10 Punkte'));
test('3 × Stufe 2 = 33 → 3,3', () => { assert.strictEqual(sumOf([3, 2]), 33); assert.strictEqual(G.fmt1(33), '3,3'); });
test('Überschuss: 9,6 + 1,4 → Level steigt, Ring 1,0', () => {
  const s = 96 + G.pointsFor(4);
  assert.strictEqual(G.level(96), 1); assert.strictEqual(G.level(s), 2); assert.strictEqual(G.fmtRing(s), '1,0 / 10 Punkte');
});
test('Sechs Stufen: Raddelfuß (4) bringt so viel wie Zaubertrank (5), Heiligtum (6) am meisten', () => {
  assert.deepStrictEqual(G.STUFEN, [1, 2, 3, 4, 5, 6]);
  assert.strictEqual(G.MAX_STUFE, 6);
  assert.deepStrictEqual(G.STUFEN.map(G.pointsFor), [10, 11, 12, 14, 14, 16]);
  assert.strictEqual(G.pointsFor(4), G.pointsFor(5));
  assert.strictEqual(G.pointsFor(7), 0); assert.strictEqual(G.pointsFor(0), 0);
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

const KAT = [{ stufe: 1, name: 'Standardgebräu' }, { stufe: 2, name: 'Klassiker' }, { stufe: 3, name: 'Spezialität' }, { stufe: 4, name: 'Raddelfuß' }, { stufe: 5, name: 'Zaubertrank' }, { stufe: 6, name: 'Heiligtum' }];
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
  assert.strictEqual(s.sum, 5 * 10 + 11);
  assert.strictEqual(s.count, 6);
  const order = s.cards.slice().sort(G.compareCards).map((c) => c.beer.id);
  // Stufe 2 zuerst; dann je 2× (10 und 12): 12 zuletzt getrunken (400) vor 10 (300); dann 13 (1×)
  assert.deepStrictEqual(order, ['BS-000011', 'BS-000012', 'BS-000010', 'BS-000013']);
  const c10 = s.cards.find((c) => c.beer.id === 'BS-000010');
  assert.deepStrictEqual([c10.count, c10.first, c10.last, c10.points], [2, 100, 300, 20]);
});
test('Eintrag löschen senkt Punkte und Level', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: 'x' + i, beerId: 'BS-000010', at: 1000 + i }));
  assert.strictEqual(G.level(G.summarize(G.normalizeDrinks(many, map), map).sum), 2);
  assert.strictEqual(G.level(G.summarize(G.normalizeDrinks(many.slice(1), map), map).sum), 1);
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
  assert.strictEqual(G.summarize(d, map).sum, 5 * 10);
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
  assert.deepStrictEqual(s.foundByStufe, { 1: 2, 2: 1, 3: 1, 4: 0, 5: 0, 6: 0 });
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

test('Rangliste: sortiert nach Punkten, dann Bieren, dann Name; gleiche Punkte teilen den Platz', () => {
  const rows = [
    { uid: 'u1', username: 'Anna', sum: 200, count: 20 },       // Level 3
    { uid: 'u2', username: 'bernd', sum: 266, count: 19 },      // Level 3
    { uid: 'u3', username: 'Carl', sum: 200, count: 18 },       // gleiche Punkte wie Anna, weniger Biere
    { uid: 'u4', username: 'dora_1', sum: 0, count: 0 },
    { uid: 'u5', username: 'Emil', sum: 200, count: 18 },       // gleich wie Carl → nach Name
  ];
  const b = G.rankBoard(rows);
  assert.deepStrictEqual(b.map((r) => r.username), ['bernd', 'Anna', 'Carl', 'Emil', 'dora_1']);
  assert.deepStrictEqual(b.map((r) => r.rank), [1, 2, 2, 2, 5]);
  assert.deepStrictEqual(b.map((r) => r.level), [3, 3, 3, 3, 1]);
  assert.strictEqual(b[0].count, 19); assert.strictEqual(b[0].uid, 'u2');
});

test('Rangliste: ungültige Zeilen fallen weg', () => {
  const bad = [
    null, 'x', {},
    { uid: 'a', username: 'ab', sum: 10, count: 1 },            // Name zu kurz
    { uid: 'b', username: '<b>hacker</b>', sum: 10, count: 1 }, // Name ungültig
    { uid: 'c', username: 'Hans', sum: 10.5, count: 1 },        // keine Ganzzahl
    { uid: 'd', username: 'Hans', sum: 9, count: 1 },           // weniger als 1,0 Punkte je Bier
    { uid: 'e', username: 'Hans', sum: 17, count: 1 },          // mehr als 1,6 Punkte je Bier
    { uid: 'f', username: 'Hans', sum: 10, count: -1 },
    { uid: 'g', username: 'Hans', sum: '10', count: 1 },
    { username: 'Hans', sum: 10, count: 1 },                    // ohne uid
  ];
  assert.deepStrictEqual(G.rankBoard(bad), []);
  assert.deepStrictEqual(G.rankBoard(undefined), []);
  assert.strictEqual(G.rankBoard([...bad, { uid: 'ok', username: 'Hans', sum: 16, count: 1 }]).length, 1);
  assert.strictEqual(G.BOARD_SIZE, 15);
});

test('Kartenstufe: Veränderung ab 4, 8, 16, 24 und 40 Mal getrunken', () => {
  const expected = [[0, 0], [1, 0], [3, 0], [4, 1], [7, 1], [8, 2], [15, 2], [16, 3], [23, 3], [24, 4], [39, 4], [40, 5], [41, 5], [500, 5]];
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

test('Spezialkarten: cleanSpecials prüft Titel, Aussehen, Punkte und doppelte IDs', () => {
  const warns = [];
  const list = G.cleanSpecials([
    { id: 'a', titel: ' Titel A ', design: 'baer', biere: ['BS-000001', 5] },
    { id: 'b', titel: 'B', design: 'sticker', punkte: 1.0, biere: [] },
    { id: 'a', titel: 'doppelt', design: 'baer', biere: [] },                 // doppelte ID
    { id: 'c', titel: 'C', design: 'unbekannt', biere: [] },                  // Aussehen unbekannt
    { id: 'd', titel: '', design: 'baer', biere: [] },                        // kein Titel
    { id: 'e', titel: 'E', design: 'sanchi', punkte: 2.5, biere: [] },        // Punkte außerhalb 1,0 … 1,6
    { id: 'f', titel: 'F', design: 'sanchi', punkte: 1.25, biere: [] },       // keine Zehntel
    { id: 'g', titel: 'G', design: 'sanchi', biere: 'x' },                    // biere keine Liste
    null,
  ], (t) => warns.push(t));
  assert.deepStrictEqual(list.map((s) => [s.id, s.titel, s.design, s.punkte, s.biere]), [
    ['a', 'Titel A', 'baer', null, ['BS-000001']], ['b', 'B', 'sticker', 10, []], ['e', 'E', 'sanchi', null, []], ['f', 'F', 'sanchi', null, []],
  ]);
  assert.strictEqual(warns.length, 7, warns.join(' | ')); // doppelte ID, Aussehen, Titel, 2 × Punkte, biere, null
  assert.deepStrictEqual(G.cleanSpecials(undefined), []);
  assert.deepStrictEqual(G.cleanSpecials({}, () => {}), []);
});

test('Spezialkarten: mergeBeers legt Titel, Aussehen und Punkte auf die Biere (Stufe bleibt)', () => {
  const warns = [];
  const r = G.mergeBeers([raw('BS-000001', 'A - Eins', 1), raw('BS-000002', 'A - Zwei', 2), raw('BS-000003', 'A - Drei', 1)], [], KAT, (t) => warns.push(t), {}, [
    { id: 'x', titel: 'Erste', design: 'sticker', punkte: 1.0, biere: ['BS-000002', 'BS-000099'] },  // 099 unbekannt
    { id: 'y', titel: 'Zweite', design: 'sanchi', biere: ['BS-000002', 'BS-000003'] },                // 002 schon vergeben
  ]);
  const b1 = r.map.get('BS-000001'), b2 = r.map.get('BS-000002'), b3 = r.map.get('BS-000003');
  assert.strictEqual(warns.length, 2, warns.join(' | '));
  // Ohne Spezialkarte: Kategorie als Beschriftung, Klasse nach Stufe, Punkte der Stufe
  assert.strictEqual(b1.label, 'Standardgebräu'); assert.strictEqual(b1.look, 'k1'); assert.strictEqual(b1.spezial, null); assert.strictEqual(G.beerPoints(b1), 10);
  // Spezialkarte 2 auf ein Klassiker-Bier: Titel, Standardgebräu-Aussehen, 1,0 statt 1,1 Punkte, Kategorie unverändert
  assert.strictEqual(b2.label, 'Erste'); assert.strictEqual(b2.look, 'k1 sp-sticker'); assert.strictEqual(b2.stufe, 2);
  assert.strictEqual(b2.kategorie, 'Klassiker'); assert.strictEqual(G.beerPoints(b2), 10); assert.strictEqual(b2.spezial.design, 'sticker');
  // Ohne eigene Punkte gelten die der Stufe
  assert.strictEqual(b3.label, 'Zweite'); assert.strictEqual(b3.look, 'sp-sanchi'); assert.strictEqual(G.beerPoints(b3), 10);
  // Summe richtet sich nach den Bierpunkten (Sternburg-Fall: 3 × 1,0 statt 3 × 1,1)
  const s = G.summarize([{ id: 'd1', beerId: 'BS-000002', at: 1 }, { id: 'd2', beerId: 'BS-000002', at: 2 }, { id: 'd3', beerId: 'BS-000002', at: 3 }], r.map);
  assert.strictEqual(s.sum, 30); assert.strictEqual(s.cards[0].points, 30);
  // Fehlt die Datei oder ist sie fehlerhaft, bleibt alles beim Alten
  const plain = G.mergeBeers([raw('BS-000002', 'A - Zwei', 2)], [], KAT, () => {}, {}, 'kaputt');
  assert.strictEqual(plain.map.get('BS-000002').label, 'Klassiker'); assert.strictEqual(G.beerPoints(plain.map.get('BS-000002')), 11);
});

test('Spezialkarten: echte Dateien – Legenden, Bierball, Sanchi und die beiden 40er-Karten', () => {
  const dir = path.join(__dirname, '..', 'Datensammlung');
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const warns = [];
  const r = G.mergeBeers(rd('biere.json'), rd('biere_manuell.json'), rd('kategorien.json'), (t) => warns.push(t), rd('biere_korrekturen.json'), rd('spezialkarten.json'));
  assert.strictEqual(warns.length, 0, warns.join(' | '));
  const by = {}; for (const b of r.list) if (b.spezial) (by[b.spezial.id] = by[b.spezial.id] || []).push(b);
  // 16 Legenden (Berlin + 15 weitere Bundesländer), je 4 bis 10 Biere (Berlin 4, die übrigen 5 bis 10), Schwarze Nachtigal und Spezial-Edition 04 je 40
  const legenden = Object.keys(by).filter((k) => k === 'legende' || k.startsWith('legende-'));
  assert.strictEqual(legenden.length, 16);
  for (const k of legenden) assert.ok(by[k].length >= (k === 'legende' ? 4 : 5) && by[k].length <= 10, `${k}: ${by[k].length} Biere`);
  assert.deepStrictEqual(Object.keys(by).filter((k) => !legenden.includes(k)).sort().map((k) => [k, by[k].length]), [['bierball', 2], ['regenbogen', 40], ['sanchi', 40], ['schwarzweiss', 40]]);
  assert.ok(by.schwarzweiss.every((b) => b.stufe === 1 && b.label === 'Schwarze Nachtigal' && b.look === 'sp-noir' && G.beerPoints(b) === 10), 'Schwarze Nachtigal nur Standardgebräu');
  assert.ok(by.regenbogen.every((b) => b.stufe === 1 && b.label === 'Spezial-Edition 04' && b.look === 'sp-regenbogen' && G.beerPoints(b) === 10), 'Spezial-Edition 04 nur Standardgebräu');
  // Länder-Legenden: Titel „… Legende“ (höchstens 40 Zeichen, kurz genug fürs Band), Standardgebräu-Look, eigenes Wahrzeichen; Punkte bleiben die der Stufe
  const titel = legenden.map((k) => by[k][0].label);
  assert.ok(titel.every((t) => /Legende$/.test(t) && t.length <= 22), titel.join(', '));
  assert.strictEqual(new Set(legenden.map((k) => by[k][0].spezial.design)).size, 16, 'jedes Land hat sein eigenes Symbol');
  for (const k of legenden) assert.ok(by[k].every((b) => b.look === 'k1 sp-baer' || b.look === 'k1 sp-icon'));
  assert.ok(legenden.filter((k) => k !== 'legende').every((k) => G.LEGEND_ICONS.includes(by[k][0].spezial.design)));
  assert.deepStrictEqual(by.legende.map((b) => b.id).sort(), ['BS-000882', 'BS-000885', 'BS-001490', 'BS-002764']);
  assert.deepStrictEqual(by.bierball.map((b) => b.id).sort(), ['BS-000057', 'BS-000887']);
  assert.strictEqual(r.map.get('BS-000887').kategorie, 'Klassiker'); assert.strictEqual(r.map.get('BS-000887').stufe, 2);
  assert.strictEqual(G.beerPoints(r.map.get('BS-000887')), 10); assert.strictEqual(G.beerPoints(r.map.get('BS-000057')), 10);
  assert.ok(by.sanchi.every((b) => b.stufe === 1), 'Sanchi nur aus Standardgebräu');
  assert.ok(by.legende.every((b) => b.label === 'Berliner Legende' && G.beerPoints(b) === 10));
  assert.ok(by.sanchi.every((b) => b.label === 'Sanchi' && b.look === 'sp-sanchi'));
});

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
  // Sechs Kategorien in der Reihenfolge der Stufen; Zahl der Biere je Stufe (Raddelfuß aus den früheren Klassikern, Sternburg - Export bleibt Klassiker)
  assert.deepStrictEqual(kat.map((k) => [k.stufe, k.name]), [[1, 'Standardgebräu'], [2, 'Klassiker'], [3, 'Spezialität'], [4, 'Raddelfuß'], [5, 'Zaubertrank'], [6, 'Heiligtum']]);
  const proStufe = {}; for (const b of r.list) proStufe[b.stufe] = (proStufe[b.stufe] || 0) + 1;
  assert.deepStrictEqual(proStufe, { 1: 3200, 2: 933, 3: 983, 4: 599, 5: 459, 6: 194 });
  const sternburg = r.map.get('BS-000887');
  assert.ok(sternburg && sternburg.title === 'Export' && sternburg.brand === 'Sternburg');
  assert.strictEqual(sternburg.kategorie, 'Klassiker'); assert.strictEqual(sternburg.stufe, 2);
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

console.log(`\n${passed} Tests bestanden${process.exitCode ? ', es gab FEHLER' : ''}.`);
