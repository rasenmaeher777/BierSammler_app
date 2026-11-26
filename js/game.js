/* Bier Sammler – Spiellogik als reine Funktionen.
   Ohne DOM und ohne Zugriff auf den App-Zustand, damit alles einzeln prüfbar ist
   (im Browser als window.GAME, in Node per require('./js/game.js')).

   Punkte werden NUR als ganze Zahlen in Zehnteln gerechnet (1,4 Punkte = 14), sonst entstehen
   Rundungsfehler (3 × 1,1 wäre sonst 3,3000000000000003). Geteilt wird erst bei der Ausgabe.
   Datumswerte sind Millisekunden (Ganzzahl); gerechnet wird immer in Ortszeit, nie mit toISOString(). */
(function () {
  'use strict';

  /* ---------- Punkte und Level ---------- */

  // Punkte pro Trinken je Kategorie-Stufe, in Zehnteln (Stufe 4 = 1,5 Punkte).
  // Stufen nach Erhältlichkeit: 1 Standardgebräu, 2 Klassiker, 3 Spezialität, 4 Zaubertrank, 5 Heiligtum
  const POINTS = { 1: 10, 2: 12, 3: 13, 4: 15, 5: 25 };
  const STUFEN = Object.keys(POINTS).map(Number).sort((a, b) => a - b); // [1 … 5]
  const MAX_STUFE = STUFEN[STUFEN.length - 1];
  const LEVEL_POINTS = 100; // 10 Punkte = 1 Level
  // Extrapunkte einer Spezialkarte ("bonus" in spezialkarten.json), höchstens 1 Punkt; ein Bier bringt also höchstens 3,5
  const MAX_BONUS = 10;
  const MAX_BEER_POINTS = POINTS[MAX_STUFE] + MAX_BONUS;
  // Extrapunkte für eine NEUE Karte (das erste Trinken eines Biers, das man noch nicht hat): 3,5 Punkte, einmal je Karte.
  // Sie hängen an der Karte, nicht an einem bestimmten Eintrag: Solange noch ein Eintrag des Biers da ist, bleiben sie.
  const NEW_CARD_BONUS = 35;

  const pointsFor = (stufe) => POINTS[stufe] || 0;
  // Punkte eines Biers in Zehnteln: feste Punkte der Spezialkarte ("punkte"), sonst Punkte der Stufe plus Extrapunkte der Spezialkarte ("bonus")
  const beerPoints = (beer) => {
    if (!beer) return 0;
    if (Number.isInteger(beer.punkte)) return beer.punkte;
    return pointsFor(beer.stufe) + (Number.isInteger(beer.bonus) ? beer.bonus : 0);
  };
  // Man startet bei Level 1; Überschuss wird ins nächste Level mitgenommen
  const level = (sum) => Math.floor(sum / LEVEL_POINTS) + 1;
  const ringTenths = (sum) => sum % LEVEL_POINTS;          // Punkte im laufenden Level (Zehntel)
  const ring = (sum) => ringTenths(sum) / LEVEL_POINTS;     // 0 … <1, Füllstand des Rings
  const toNext = (sum) => LEVEL_POINTS - ringTenths(sum);   // Zehntel bis zum nächsten Level

  /* ---------- Zahlen anzeigen (deutsch) ---------- */

  // Zehntel → "6,6"
  const fmt1 = (tenths) => `${Math.floor(tenths / 10)},${tenths % 10}`;
  // Ganzzahl mit Tausenderpunkt: 6368 → "6.368"
  const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Dezimalzahl aus der Datenbank: 0.355 → "0,355"
  const fmtDec = (x) => String(x).replace('.', ',');
  // Alkohol: 5.3 → "5,3 %", 5 → "5,0 %", 0 → "alkoholfrei"
  function fmtAlc(x) {
    if (typeof x !== 'number') return '';
    if (x === 0) return 'alkoholfrei';
    return `${Number.isInteger(x) ? x + ',0' : fmtDec(x)} %`;
  }
  // Flaschengröße: 0.5 → "0,5 l", 1 → "1 l"
  const fmtLiter = (x) => (typeof x === 'number' ? `${fmtDec(x)} l` : '');
  // Fortschrittsanzeige: "6,6 / 10 Punkte"
  const fmtRing = (sum) => `${fmt1(ringTenths(sum))} / ${LEVEL_POINTS / 10} Punkte`;

  /* ---------- Bierdatenbank prüfen und zusammenführen ---------- */

  const ID_RE = /^B[SM]-\d{6}$/;
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const strList = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

  // Name in Marke und eigentlichen Biernamen trennen, am ERSTEN " - ":
  // "Schneider Weisse - TAP6 - unser Aventinus" → Marke "Schneider Weisse", Titel "TAP6 - unser Aventinus".
  // Ohne " - " ist der ganze Name der Titel; als Marke dient dann der Firmenname.
  function splitName(name, company) {
    const i = name.indexOf(' - ');
    if (i > 0 && i < name.length - 3) return { title: name.slice(i + 3).trim(), brand: name.slice(0, i).trim() };
    return { title: name, brand: company || '' };
  }

  /* Ein Bier aus biere.json / biere_manuell.json prüfen. Gibt ein bereinigtes Objekt zurück oder null.
     katNames: { stufe: name } aus kategorien.json. Fehlende Werte werden null bzw. [] (nie "null" anzeigen). */
  function cleanBeer(raw, katNames) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' && ID_RE.test(raw.id) ? raw.id : null;
    const name = str(raw.name);
    const stufe = raw.kategorie_stufe;
    if (!id || !name || !Number.isInteger(stufe) || stufe < 1 || stufe > MAX_STUFE) return null;
    const bv = raw.brauerei_vertrieb && typeof raw.brauerei_vertrieb === 'object' ? raw.brauerei_vertrieb : {};
    const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
    const flasche = num(raw.flaschengroesse, 20);
    const zutaten = strList(raw.zutaten);
    const company = str(bv.name);
    const parts = splitName(name, company);
    const katName = (katNames && katNames[stufe]) || str(raw.kategorie_name) || '';
    return {
      id,
      name,
      title: parts.title,
      brand: parts.brand,
      sorten: strList(raw.biersorte),
      alc: num(raw.alkoholgehalt, 100),
      company: {
        typ: bv.typ === 'Vertrieb' ? 'Vertrieb' : 'Brauerei',
        name: company,
        adresse: str(bv.adresse),
        region: str(bv.region),
        land: str(bv.land),
      },
      beschreibung: str(raw.beschreibung),
      zutaten: zutaten.length ? zutaten : null,
      flasche: flasche > 0 ? flasche : null,
      stufe,
      kategorie: katName,
      // Darstellung: Beschriftung im Band, CSS-Klassen der Karte, eigene Punkte; bei Spezialkarten von applySpecials überschrieben
      label: katName,
      look: `k${stufe}`,
      punkte: null,
      bonus: 0,
      spezial: null,
    };
  }

  /* ---------- Spezialkarten (Datensammlung/spezialkarten.json) ---------- */

  /* Jede Spezialkarte hat einen Titel (steht im Band statt der Kategorie), ein Aussehen und eine Liste von Bier-IDs:
       baer     wie Standardgebräu, aber statt der Flasche der Berliner Bär
       sticker  wie Standardgebräu, mit dem Sternburg-Zeichen (roter Kreis, weißer Stern) als Sticker (Karte „STERNI“)
       sanchi   eigenständiges Design (nachtviolett)
       noir     eigenständiges Design in Schwarz-Weiß (Comic-Raster)
       regenbogen  eigenständiges Design mit Regenbogen und Glitzer
       hopfen   eigenständiges Design: ganz in Grün mit großen abstrakten Blättern (Heiliger Hopfen)
       koenig   eigenständiges Design: gesteppter roter Samt, Edelsteine und Gold (Bierkönig)
       weltall  eigenständiges Design: Weltall mit glitzernden Sternen (Außenseiter)
       spezial-rot | spezial-tuerkis | spezial-orange | spezial-rosa  eigenständiges, ganz schlichtes Einfarb-Design (Klasse sp-mono + Farbe), linksbündig, ohne Rahmen und Muster
       raddelfuss  eigenständiges Design: rot-weißes Karo mit Zuckerstangen-Rahmen (früher die Kategorie Raddelfuß)
       sonderedition-10 … sonderedition-60  sechs eigenständige Designs der Reihe „Sonderedition“ (Klasse sp-se + sp-se10 … sp-se60):
         10 Bauhaus (Creme, rote Scheibe mit der Zahl), 20 Neon (Schwarz und Limette, Umriss-Zahl), 30 Risographie (Papier, Pink und Blau übereinander gedruckt),
         40 Höhenlinien (Nachtblau und Sand, Gipfel hinter der Flasche), 50 Terrazzo (Steinboden mit bunten Splittern), 60 Art déco (Petrol und Kupfer, Strahlenfächer)
       mischa    eigenständiges Zeichentrick-Design: ein kleiner Junge im Comic-Stil auf blauem Himmel mit Wolken und Wiese
       rollmops  eigenständiges Design: Sonnenaufgang über dem Meer mit einer Bockwurst auf dem Wasser
       penner    eigenständiges Design: schmutzige Karte, überall Müll (Dosen, Papierknäuel, Kippen, Bananenschale)
       rosemary  romantisches Design: Rosé mit feinem Herzmuster, weinrotes Band in Schreibschrift, Rosmarinzweig
       killer    unheimliches Design: fast schwarz mit roter Lampe, Strichlisten, Band mit Tropfkante und flackernder Schrift
       fckafd    die Karte ist das „FCK AFD“-Logo: Schwarz, zwei rote Balken mit „FCK / AFD“ in weißen Blockbuchstaben statt Band und Flasche
       Legenden der Bundesländer: wie Standardgebräu, aber statt der Flasche ein Wahrzeichen des Landes (ICONS in js/app.js):
       kuckucksuhr (BW), brezel (Bayern), gurke (Brandenburg), schluessel (Bremen), anker (Hamburg), bembel (Hessen),
       leuchtturm (MV), schaf (Niedersachsen), dom (NRW), traube (RLP), hammer (Saarland), schwibbogen (Sachsen),
       nebra (Sachsen-Anhalt), strandkorb (SH), bratwurst (Thüringen)
     Optional "punkte" (z. B. 1.0): ersetzt die Punkte der Stufe für diese Biere.
     Optional "bonus" (z. B. 1.0, höchstens 1,0): Extrapunkte zusätzlich zu den Punkten der Stufe (gilt nicht, wenn "punkte" gesetzt ist).
     Kategorie (Stufe) und Sammlung bleiben in jedem Fall unberührt; sichtbar ist nur der Titel der Spezialkarte. */
  const LEGEND_ICONS = ['kuckucksuhr', 'brezel', 'gurke', 'schluessel', 'anker', 'bembel', 'leuchtturm', 'schaf', 'dom', 'traube', 'hammer', 'schwibbogen', 'nebra', 'strandkorb', 'bratwurst'];
  const SPECIAL_DESIGNS = { baer: 'k1 sp-baer', sticker: 'k1 sp-sticker', sanchi: 'sp-sanchi', noir: 'sp-noir', regenbogen: 'sp-regenbogen', hopfen: 'sp-hopfen', koenig: 'sp-koenig', weltall: 'sp-weltall',
    'spezial-rot': 'sp-mono sp-rot', 'spezial-tuerkis': 'sp-mono sp-tuerkis', 'spezial-orange': 'sp-mono sp-orange', 'spezial-rosa': 'sp-mono sp-rosa',
    raddelfuss: 'sp-raddel',
    'sonderedition-10': 'sp-se sp-se10', 'sonderedition-20': 'sp-se sp-se20', 'sonderedition-30': 'sp-se sp-se30',
    'sonderedition-40': 'sp-se sp-se40', 'sonderedition-50': 'sp-se sp-se50', 'sonderedition-60': 'sp-se sp-se60',
    mischa: 'sp-mischa', rollmops: 'sp-rollmops', penner: 'sp-penner', rosemary: 'sp-rosemary', killer: 'sp-killer', fckafd: 'sp-fckafd' };
  for (const icon of LEGEND_ICONS) SPECIAL_DESIGNS[icon] = 'k1 sp-icon';
  const DESIGNS = Object.keys(SPECIAL_DESIGNS);

  // Zahl in Zehntel umrechnen, wenn sie genau auf Zehntel endet und im erlaubten Bereich liegt, sonst null
  const tenths = (v, lo, hi) => {
    const t = Math.round(v * 10);
    return typeof v === 'number' && Math.abs(v * 10 - t) < 1e-9 && t >= lo && t <= hi ? t : null;
  };

  // Rohdaten prüfen; ungültige Karten fallen mit Warnung weg. Ergebnis: [{ id, titel, design, punkte (Zehntel oder null), bonus (Zehntel), biere }]
  function cleanSpecials(raw, warn = () => {}) {
    if (raw == null) return [];
    if (!Array.isArray(raw)) { warn('spezialkarten.json: keine Liste, wird ignoriert'); return []; }
    const out = [];
    const seen = new Set();
    raw.forEach((r, i) => {
      const where = `spezialkarten.json: Eintrag ${i + 1}`;
      const id = r && typeof r.id === 'string' ? r.id.trim() : '';
      const titel = r && str(r.titel);
      if (!id || !titel || titel.length > 40 || !DESIGNS.includes(r.design) || !Array.isArray(r.biere)) { warn(`${where} ungültig, wird ignoriert`); return; }
      if (seen.has(id)) { warn(`${where}: doppelte ID „${id}“, wird ignoriert`); return; }
      seen.add(id);
      let punkte = null;
      if (r.punkte != null) {
        punkte = tenths(r.punkte, POINTS[1], POINTS[MAX_STUFE]);
        if (punkte === null) warn(`${where}: ungültige Punkte (erlaubt: ${fmt1(POINTS[1])} bis ${fmt1(POINTS[MAX_STUFE])} in Zehnteln), Standardpunkte der Stufe gelten`);
      }
      let bonus = 0;
      if (r.bonus != null) {
        const t = tenths(r.bonus, 0, MAX_BONUS);
        if (t === null) warn(`${where}: ungültiger Bonus (erlaubt: 0,0 bis ${fmt1(MAX_BONUS)} in Zehnteln), kein Bonus`);
        else bonus = t;
      }
      out.push({ id, titel, design: r.design, punkte, bonus, biere: r.biere.filter((b) => typeof b === 'string') });
    });
    return out;
  }

  // Spezialkarten auf die Biere legen. Ein Bier gehört höchstens zu einer Karte (die erste gilt); unbekannte IDs werden gemeldet.
  function applySpecials(map, specials, warn = () => {}) {
    for (const sp of specials) {
      for (const id of sp.biere) {
        const beer = map.get(id);
        if (!beer) { warn(`spezialkarten.json: „${sp.titel}“: unbekannte ID ${id}, wird ignoriert`); continue; }
        if (beer.spezial) { warn(`spezialkarten.json: ${id} steht schon auf „${beer.spezial.titel}“, „${sp.titel}“ wird ignoriert`); continue; }
        beer.spezial = { id: sp.id, titel: sp.titel, design: sp.design };
        beer.label = sp.titel;
        beer.look = SPECIAL_DESIGNS[sp.design];
        beer.punkte = sp.punkte;
        beer.bonus = sp.bonus || 0;
      }
    }
  }

  /* Korrekturen (biere_korrekturen.json): { "BS-000001": { feld: wert, … } } mit den Feldnamen aus biere.json.
     Erlaubt sind nur Felder, die keine Spielwerte berühren; id, kategorie_stufe und kategorie_name nie (an der Stufe
     hängen Punkte und Level aller Spieler). null entfernt eine Angabe (z. B. "beschreibung": null).
     Jeder Wert wird auf den passenden Typ geprüft; ein falscher Wert wird mit Warnung ignoriert und
     lässt den bisherigen stehen. brauerei_vertrieb wird je Unterfeld zusammengeführt. */
  const FIX_TYPES = {
    name: (v) => typeof v === 'string' && v.trim() !== '',
    beschreibung: (v) => v === null || typeof v === 'string',
    biersorte: (v) => v === null || Array.isArray(v),
    zutaten: (v) => v === null || Array.isArray(v),
    alkoholgehalt: (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100),
    flaschengroesse: (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 20),
    brauerei_vertrieb: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  };
  const FIX_COMPANY = ['typ', 'name', 'adresse', 'region', 'land'];

  // Rohdatensatz mit den Korrekturen für seine ID überlagern (neues Objekt; das Original bleibt unverändert)
  function applyFix(raw, fix, warn) {
    if (!fix || typeof fix !== 'object' || Array.isArray(fix)) { warn(`biere_korrekturen.json: ${raw.id}: erwartet { feld: wert }, wird ignoriert`); return raw; }
    const out = { ...raw };
    for (const [key, value] of Object.entries(fix)) {
      if (!FIX_TYPES[key]) { warn(`biere_korrekturen.json: ${raw.id}: Feld „${key}“ ist nicht änderbar, wird ignoriert`); continue; }
      if (!FIX_TYPES[key](value)) { warn(`biere_korrekturen.json: ${raw.id}: ungültiger Wert für „${key}“, wird ignoriert`); continue; }
      if (key === 'brauerei_vertrieb') {
        const base = raw.brauerei_vertrieb && typeof raw.brauerei_vertrieb === 'object' ? raw.brauerei_vertrieb : {};
        const merged = { ...base };
        for (const [k, v] of Object.entries(value)) {
          if (FIX_COMPANY.includes(k) && (v === null || typeof v === 'string')) merged[k] = v;
          else warn(`biere_korrekturen.json: ${raw.id}: brauerei_vertrieb.${k} wird ignoriert`);
        }
        out.brauerei_vertrieb = merged;
      } else out[key] = value;
    }
    return out;
  }

  /* biere.json und biere_manuell.json zusammenführen, danach die Korrekturen darüberlegen.
     Ungültige Einträge werden weggelassen; bei doppelter ID gilt der erste Eintrag (biere.json kommt zuerst).
     warn(text) wird für jede Auffälligkeit aufgerufen (im Browser: console.warn).
     fixes: Objekt aus biere_korrekturen.json oder undefined. specials: Liste aus spezialkarten.json oder undefined.
     beerdb: Liste aus biere_beerdb.json (Nachtrag aus beer-db.org, IDs BM-100001 …) oder undefined; kommt nach biere_manuell.json.
     Ergebnis: { list, map } mit map = Map(id → Bier). */
  function mergeBeers(main, manual, kategorien, warn = () => {}, fixes, specials, beerdb) {
    const katNames = {};
    for (const k of Array.isArray(kategorien) ? kategorien : []) if (k && Number.isInteger(k.stufe)) katNames[k.stufe] = String(k.name || '');
    const fixMap = fixes && typeof fixes === 'object' && !Array.isArray(fixes) ? fixes : {};
    if (fixes != null && fixMap !== fixes) warn('biere_korrekturen.json: erwartet ein Objekt { "ID": { … } }, wird ignoriert');
    const map = new Map();
    const take = (arr, file) => {
      if (!Array.isArray(arr)) { if (arr != null) warn(`${file}: keine Liste, wird ignoriert`); return; }
      arr.forEach((raw0, i) => {
        const raw = raw0 && typeof raw0 === 'object' && Object.prototype.hasOwnProperty.call(fixMap, raw0.id) ? applyFix(raw0, fixMap[raw0.id], warn) : raw0;
        const beer = cleanBeer(raw, katNames);
        if (!beer) { warn(`${file}: Eintrag ${i + 1} ungültig, wird ignoriert (${raw && raw.id})`); return; }
        if (map.has(beer.id)) { warn(`${file}: doppelte ID ${beer.id}, es gilt der Eintrag aus ${map.get(beer.id)._file}`); return; }
        Object.defineProperty(beer, '_file', { value: file }); // nicht aufzählbar, nur für die Warnung
        map.set(beer.id, beer);
      });
    };
    take(main, 'biere.json');
    take(manual, 'biere_manuell.json');
    take(beerdb, 'biere_beerdb.json');
    for (const id of Object.keys(fixMap)) if (!map.has(id)) warn(`biere_korrekturen.json: unbekannte ID ${id}, wird ignoriert`);
    applySpecials(map, cleanSpecials(specials, warn), warn);
    return { list: [...map.values()], map };
  }

  /* ---------- Suche ---------- */

  // Buchstaben, die Unicode nicht in Grundbuchstabe + Akzent zerlegt
  const SPECIAL = { 'ß': 'ss', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ł': 'l', 'ð': 'd', 'đ': 'd', 'þ': 'th' };
  /* Grundform für die Suche: klein, ß → ss, Umlaute und Akzente → Grundbuchstabe (ä → a),
     Bindestriche und Apostrophe entfernt (Hefe-Weizen → hefeweizen, Beck's → becks),
     alle übrigen Zeichen → Leerzeichen. */
  function fold(s) {
    return String(s ?? '').toLowerCase()
      .replace(/[ßøæœłðđþ]/g, (c) => SPECIAL[c])
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[-‐-―'’`´]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  // Zweite Form: ae/oe/ue → a/o/u, damit "muenchner" auch "Münchner" findet (und umgekehrt)
  const unumlaut = (s) => s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');

  /* Suchtext eines Biers einmal vorberechnen: Name und Firmenname.
     Ein führendes Leerzeichen erlaubt die Prüfung auf Wortanfang mit includes(' ' + wort). */
  function searchEntry(beer) {
    const h1 = ' ' + fold(`${beer.name} ${beer.company.name || ''}`);
    const n1 = ' ' + fold(beer.name);
    return { beer, h1, h2: unumlaut(h1), n1, n2: unumlaut(n1) };
  }
  const buildIndex = (beers) => beers.map(searchEntry);

  /* Treffer für die Eingabe q: ab 2 Zeichen, höchstens limit.
     Jedes eingegebene Wort muss vorkommen (in Biername oder Firmenname), Groß/klein, Umlaute (ä = a = ae),
     ß = ss und Bindestriche werden ignoriert. Reihenfolge: mehr Wörter an Wortanfängen zuerst,
     dann Treffer am Anfang des Biernamens, dann Name. */
  function search(index, q, limit = 10) {
    const folded = fold(q);
    if (folded.replace(/ /g, '').length < 2) return [];
    const words = [...new Set(folded.split(' '))].map((w) => [...new Set([w, unumlaut(w)])]);
    const hits = [];
    for (const e of index) {
      let starts = 0;
      let ok = true;
      for (const vs of words) {
        if (!vs.some((v) => e.h1.includes(v) || e.h2.includes(v))) { ok = false; break; }
        if (vs.some((v) => e.h1.includes(' ' + v) || e.h2.includes(' ' + v))) starts++;
      }
      if (!ok) continue;
      const first = words[0];
      const nameStart = first.some((v) => e.n1.startsWith(' ' + v) || e.n2.startsWith(' ' + v)) ? 1 : 0;
      hits.push({ e, starts, nameStart });
    }
    hits.sort((a, b) => b.starts - a.starts || b.nameStart - a.nameStart
      || a.e.beer.name.localeCompare(b.e.beer.name, 'de') || (a.e.beer.id < b.e.beer.id ? -1 : 1));
    return hits.slice(0, limit).map((h) => h.e.beer);
  }

  /* ---------- Trink-Protokoll ---------- */

  const MAX_AT = 8.64e15; // größte gültige Date-Zeit

  /* STANDORT-KARTE: Ort eines Eintrags. Gespeichert wird auf drei Nachkommastellen gerundet (rund 100 m), nie genauer.
     Gültig sind nur endliche Zahlen im Bereich -90…90 / -180…180; sonst null (der Eintrag zählt trotzdem, nur ohne Ort).
     Beide Werte müssen da sein. */
  const PLACE_DECIMALS = 3;
  function cleanPlace(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const k = 10 ** PLACE_DECIMALS;
    // + 0 macht aus -0 eine 0
    return { lat: Math.round(lat * k) / k + 0, lng: Math.round(lng * k) / k + 0 };
  }

  /* Einträge aus localStorage oder Firestore bereinigen: [{ id, beerId, at, lat?, lng? }].
     Verworfen wird alles ohne gültige ID, mit unbekannter beerId (falls known übergeben) oder ungültigem Zeitpunkt.
     lat/lng (STANDORT-KARTE) bleiben nur erhalten, wenn beide gültig sind; ein ungültiger Ort verwirft den Eintrag nicht.
     Ergebnis aufsteigend nach Zeitpunkt sortiert. */
  function normalizeDrinks(list, known) {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    for (const d of list) {
      if (!d || typeof d !== 'object') continue;
      const id = typeof d.id === 'string' && d.id ? d.id : null;
      const beerId = typeof d.beerId === 'string' && ID_RE.test(d.beerId) ? d.beerId : null;
      const at = Number.isInteger(d.at) && d.at > 0 && d.at < MAX_AT ? d.at : null;
      if (!id || !beerId || at === null || seen.has(id)) continue;
      if (known && !known.has(beerId)) continue;
      seen.add(id);
      const place = cleanPlace(d.lat, d.lng);
      out.push(place ? { id, beerId, at, lat: place.lat, lng: place.lng } : { id, beerId, at });
    }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  }

  /* STANDORT-KARTE: Einträge mit Ort nach genau gleichem (gerundetem) Ort zusammenfassen, für die Punkte auf der Karte.
     Ergebnis: [{ lat, lng, count, last, drinks: [Eintrag, …] }], die Einträge jeweils neueste zuerst. Reihenfolge der Orte:
     erster Eintrag zuerst (stabil). */
  function placeGroups(list) {
    const groups = new Map();
    for (const d of Array.isArray(list) ? list : []) {
      if (!d || typeof d.lat !== 'number' || typeof d.lng !== 'number') continue;
      const key = `${d.lat},${d.lng}`;
      let g = groups.get(key);
      if (!g) { g = { lat: d.lat, lng: d.lng, count: 0, last: 0, drinks: [] }; groups.set(key, g); }
      g.count++;
      if (d.at > g.last) g.last = d.at;
      g.drinks.push(d);
    }
    const out = [...groups.values()];
    for (const g of out) g.drinks.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
    return out;
  }

  /* Sammlung und Punkte aus dem Protokoll berechnen (nie gespeichert).
     beerMap: Map(id → Bier). Einträge mit unbekannter beerId zählen nicht.
     Jede Karte bringt einmal NEW_CARD_BONUS zusätzlich; points einer Karte enthält diesen Bonus.
     Ergebnis: { sum (Zehntel), count, cards: [{ beer, count, first, last, points, drinks: [ids] }] } */
  function summarize(drinks, beerMap) {
    const cards = new Map();
    let sum = 0;
    let count = 0;
    for (const d of drinks) {
      const beer = beerMap.get(d.beerId);
      if (!beer) continue;
      const p = beerPoints(beer);
      sum += p;
      count++;
      let c = cards.get(beer.id);
      if (!c) {
        c = { beer, count: 0, first: d.at, last: d.at, points: NEW_CARD_BONUS, drinks: [] };
        cards.set(beer.id, c);
        sum += NEW_CARD_BONUS;
      }
      c.count++;
      c.points += p;
      if (d.at < c.first) c.first = d.at;
      if (d.at >= c.last) c.last = d.at;
      c.drinks.push(d.id);
    }
    return { sum, count, cards: [...cards.values()] };
  }

  // Reihenfolge der Karten: höhere Kategorie, öfter getrunken, zuletzt getrunken, Name
  const compareCards = (a, b) => b.beer.stufe - a.beer.stufe || b.count - a.count || b.last - a.last
    || a.beer.name.localeCompare(b.beer.name, 'de') || (a.beer.id < b.beer.id ? -1 : 1);

  /* ---------- Wochen (Montag bis Sonntag, Ortszeit) ---------- */

  // Montag 00:00 Ortszeit der Woche, in der ms liegt
  function weekStart(ms) {
    const d = new Date(ms);
    const back = (d.getDay() + 6) % 7; // Montag = 0
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  }
  // Fortlaufende Kalendertag-Nummer eines lokalen Datums. Date.UTC wird hier nur als Rechenhilfe für
  // Tag/Monat/Jahr benutzt, damit die Sommerzeitumstellung (23- oder 25-Stunden-Tag) nicht stört.
  const dayNumber = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  // Kennzahl der Woche: Tag-Nummer ihres Montags (aufeinanderfolgende Wochen unterscheiden sich um 7)
  const weekKey = (ms) => dayNumber(weekStart(ms));
  // Anzahl Wochen von der Woche von a bis zur Woche von b, beide eingeschlossen
  const weeksInclusive = (a, b) => (weekKey(b) - weekKey(a)) / 7 + 1;

  /* Kalenderwoche nach ISO 8601 (Woche 1 enthält den 4. Januar), in Ortszeit.
     Ergebnis { week, year }; das Jahr der Woche kann vom Kalenderjahr abweichen (1.1.2027 liegt in KW 53/2026). */
  function isoWeek(ms) {
    const monday = weekStart(ms);
    const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
    const year = thursday.getFullYear();
    const week1 = weekStart(new Date(year, 0, 4).getTime());
    return { week: (dayNumber(thursday) - 3 - dayNumber(week1)) / 7 + 1, year };
  }

  /* ---------- Statistiken ---------- */

  const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const HISTORY_WEEKS = 12;

  // Häufigster Wert: meiste Einträge, bei Gleichstand der zuletzt getrunkene, dann alphabetisch
  function favorite(tally) {
    let best = null;
    for (const [key, t] of tally) {
      if (!best || t.count > best.count || (t.count === best.count && (t.last > best.last
        || (t.last === best.last && String(key).localeCompare(String(best.key), 'de') < 0)))) best = { key, ...t };
    }
    return best;
  }
  function count(tally, key, at) {
    const t = tally.get(key);
    if (t) { t.count++; if (at > t.last) t.last = at; } else tally.set(key, { count: 1, last: at });
  }

  /* Alle Kennzahlen für das Fenster „Statistiken“, aus dem Protokoll berechnet.
     drinks: bereinigte Einträge, beerMap: Map(id → Bier), now: aktuelle Zeit in ms (für Tests übergeben).
     Wochen beginnen montags in Ortszeit. Ø pro Woche = Anzahl / Wochen von der Woche des ersten Eintrags
     bis zur aktuellen Woche (beide eingeschlossen). Bewusst KEINE Tages-Serien.
     Zahlen in ganzen Einheiten: Zehntel (avgPerWeek, avgAlc, liter), Prozent (freePct). */
  function stats(drinks, beerMap, now) {
    const list = drinks.filter((d) => beerMap.has(d.beerId));
    const n = list.length;
    const nowKey = weekKey(now);
    const nowMonday = weekStart(now);
    const perWeek = new Map();
    let firstAt = Infinity;
    const beers = new Map();
    const sorten = new Map();
    const companies = new Map();
    const days = new Map();
    let alcSum = 0; let alcN = 0; let ml = 0; let noSize = 0; let free = 0;
    const states = new Set();
    for (const d of list) {
      const b = beerMap.get(d.beerId);
      const k = weekKey(d.at);
      const w = perWeek.get(k);
      if (w) w.count++; else perWeek.set(k, { count: 1, at: d.at }); // at: ein Zeitpunkt in dieser Woche (für die KW)
      if (d.at < firstAt) firstAt = d.at;
      count(beers, b.id, d.at);
      for (const s of b.sorten) count(sorten, s, d.at);
      if (b.company.name) count(companies, b.company.name, d.at);
      count(days, (new Date(d.at).getDay() + 6) % 7, d.at);
      if (typeof b.alc === 'number') { alcSum += Math.round(b.alc * 10); alcN++; if (b.alc === 0) free++; }
      if (typeof b.flasche === 'number') ml += Math.round(b.flasche * 1000); else noSize++;
      if (b.company.land === 'Deutschland' && BUNDESLAENDER.includes(b.company.region)) states.add(b.company.region);
    }
    // Wochen seit dem ersten Eintrag; mindestens 1, falls die Geräteuhr einmal zurückgestellt wurde
    const weeks = n ? Math.max(1, (nowKey - weekKey(firstAt)) / 7 + 1) : 0;
    // Beste Woche: meiste Einträge, bei Gleichstand die jüngere Woche
    let best = null;
    for (const [key, w] of perWeek) if (!best || w.count > best.count || (w.count === best.count && key > best.key)) best = { key, count: w.count, at: w.at };
    const weekCount = (key) => (perWeek.get(key) ? perWeek.get(key).count : 0);
    const history = [];
    for (let i = HISTORY_WEEKS - 1; i >= 0; i--) {
      const monday = new Date(nowMonday.getFullYear(), nowMonday.getMonth(), nowMonday.getDate() - 7 * i);
      history.push({ monday, ...isoWeek(monday.getTime()), count: weekCount(nowKey - 7 * i) });
    }
    const foundByStufe = Object.fromEntries(STUFEN.map((st) => [st, 0]));
    for (const id of beers.keys()) foundByStufe[beerMap.get(id).stufe]++;
    const favBeer = favorite(beers);
    const favDay = (() => { // Gleichstand: früherer Wochentag
      let b = null;
      for (const [day, t] of days) if (!b || t.count > b.count || (t.count === b.count && day < b.day)) b = { day, count: t.count };
      return b;
    })();
    const favSorte = favorite(sorten);
    const favCompany = favorite(companies);
    return {
      total: n,
      weeks,
      avgPerWeek: n ? Math.round((n * 10) / weeks) : 0,          // Zehntel
      thisWeek: weekCount(nowKey),
      lastWeek: weekCount(nowKey - 7),
      bestWeek: best ? { count: best.count, ...isoWeek(best.at) } : null,
      history,
      distinct: beers.size,
      foundByStufe,
      favBeer: favBeer ? { beer: beerMap.get(favBeer.key), count: favBeer.count } : null,
      favSorte: favSorte ? { name: favSorte.key, count: favSorte.count } : null,
      favCompany: favCompany ? { name: favCompany.key, count: favCompany.count } : null,
      favDay: favDay ? { name: WEEKDAYS[favDay.day], count: favDay.count } : null,
      avgAlc: alcN ? Math.round(alcSum / alcN) : null,            // Zehntel Prozent
      liter: Math.round(ml / 100),                                // Zehntel Liter
      noSize,
      freePct: n ? Math.round((100 * free) / n) : 0,
      states: BUNDESLAENDER.filter((s) => states.has(s)),
    };
  }

  /* ---------- Alkohol und Körper (ALKOHOL-AUSWERTUNG) ---------- */

  /* Auswertung „Alkohol und Körper“ in den Statistiken. Sie erscheint erst, wenn in den Einstellungen das Geschlecht gewählt
     ist; das Gewicht ist freiwillig (ohne Gewicht keine Promille-Schätzung). Alles ist eine grobe Schätzung aus den EINGETRAGENEN
     Bieren (nicht eingetragene Getränke fehlen) und keine medizinische Beratung.
     Gramm werden in Zehnteln gerechnet (197 = 19,7 g), Promille in Hundertsteln (85 = 0,85 ‰), wie die Punkte.
     Reinalkohol (g) = Flaschengröße (l) × Vol.-% × 0,789 × 10 (Dichte von Ethanol); Biere ohne Größenangabe zählen nicht mit.

     Label (Schnitt der letzten 4 Wochen, Gramm Reinalkohol pro Woche; obere Grenzen A, B, C):
       A  bis 27 g   risikoarm      (DGE-Positionspapier 2024, für beide Geschlechter gleich)
       B  bis 81 g   moderat        (DGE 2024)
       C  bis 140 g (w) / 210 g (m)  erhöht; das sind 20 g (w) bzw. 30 g (m) pro Tag, ab dort steigt das Leberrisiko deutlich
          (apotheken.de / Deutsche Leberstiftung; die Quellen nennen je nach Stelle 10–20 g (w) und 20–40 g (m))
       D  darüber    hoch
     Das Gewicht fließt NICHT ins Label ein (die Leitlinien gelten nicht je Kilogramm), sondern nur in die Promille-Schätzung.
     Promille nach Widmark: g / (kg × r), r = 0,7 (m) bzw. 0,6 (w); Abbau 0,1 ‰ pro Stunde (rechtsmedizinischer Mindestwert, das
     schätzt eher zu hoch); kein Abzug für unvollständige Aufnahme. Ein „Abend“ = Einträge mit höchstens 6 Stunden Abstand.
     Rauschtrinken: ab 60 g (m) bzw. 48 g (w) an einem Abend (5 bzw. 4 Gläser; die Literatur nennt 50–60 g). */
  const LABELS = ['A', 'B', 'C', 'D'];
  const LABEL_LIMITS = { m: [27, 81, 210], w: [27, 81, 140] };
  const BINGE_GRAMS = { m: 60, w: 48 };
  const WIDMARK_R = { m: 0.7, w: 0.6 };
  const ELIMINATION = 0.1;            // ‰ pro Stunde
  const SESSION_GAP = 6 * 3600000;    // ms
  const ALC_WINDOW_DAYS = 28;
  const KG_MIN = 30;
  const KG_MAX = 250;
  const HALBE_G10 = 197;              // Zehntel Gramm in 0,5 l Bier mit 5 %

  // Zehntel Gramm Reinalkohol eines Biers; null ohne Größenangabe
  const gramsTenths = (beer) => (beer && typeof beer.alc === 'number' && typeof beer.flasche === 'number'
    ? Math.round(beer.flasche * beer.alc * 78.9) : null);

  // Gespeicherte Körperdaten prüfen: { sex: 'm' | 'w' | null, kg: Zahl (30 … 250, eine Nachkommastelle) | null }
  function cleanBody(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const sex = r.sex === 'm' || r.sex === 'w' ? r.sex : null;
    const kg = typeof r.kg === 'number' && Number.isFinite(r.kg) && r.kg >= KG_MIN && r.kg <= KG_MAX ? Math.round(r.kg * 10) / 10 : null;
    return { sex, kg };
  }
  // Eingabe „64“, „64,5“, „64.5“ oder „64 kg“ → Zahl; alles andere und Werte außerhalb von 30 … 250 → null
  function parseKg(text) {
    const t = String(text).trim().replace(/\s*kg$/i, '').replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
    const v = Math.round(Number(t) * 10) / 10;
    return v >= KG_MIN && v <= KG_MAX ? v : null;
  }
  // 'A' … 'D' für Gramm pro Woche (in Zehnteln); ohne Geschlecht null
  function labelFor(weekG10, sex) {
    const lim = LABEL_LIMITS[sex];
    if (!lim) return null;
    const i = lim.findIndex((l) => weekG10 <= l * 10);
    return LABELS[i === -1 ? lim.length : i];
  }
  const fmtPermille = (h100) => `${fmtDec((h100 / 100).toFixed(2))} ‰`;

  /* Promille eines Abends: Einträge der Reihe nach, zwischen zwei Einträgen baut der Körper ab, jeder Eintrag erhöht den Wert.
     Gibt { peak100, soberHours } zurück (Stunden vom letzten Eintrag bis 0,0 ‰) oder null ohne Gewicht. */
  function permilleOf(items, body) {
    if (!body.kg) return null;
    const r = WIDMARK_R[body.sex];
    let c = 0; let peak = 0; let last = null;
    for (const e of items) {
      if (last !== null) c = Math.max(0, c - (ELIMINATION * (e.at - last)) / 3600000);
      c += (e.g / 10) / (body.kg * r);
      if (c > peak) peak = c;
      last = e.at;
    }
    return { peak100: Math.round(peak * 100), soberHours: c / ELIMINATION };
  }

  /* Alle Zahlen der Auswertung. drinks/beerMap/now wie bei stats(), body = gespeicherte Körperdaten.
     Gibt null zurück ohne Geschlecht oder ohne Einträge. Fenster = letzte 28 Tage; bei kürzerer Nutzung seit dem ersten Eintrag,
     mindestens eine Woche (so wirkt ein einzelner Abend am Anfang nicht wie ein ganzer Monat). */
  function alcoholReport(drinks, beerMap, body, now) {
    const b = cleanBody(body);
    if (!b.sex) return null;
    const list = drinks.filter((d) => beerMap.has(d.beerId)).sort((x, y) => x.at - y.at);
    if (!list.length) return null;
    const from = now - ALC_WINDOW_DAYS * 86400000;
    const weeks = Math.min(ALC_WINDOW_DAYS / 7, Math.max(1, (now - list[0].at) / (7 * 86400000)));
    const monday = weekStart(now).getTime();
    let noSize = 0; let windowG10 = 0; let thisWeekG10 = 0;
    const inWin = [];
    for (const d of list) {
      if (d.at <= from) continue;
      const g = gramsTenths(beerMap.get(d.beerId));
      if (g === null) noSize++;
      windowG10 += g || 0;
      if (d.at >= monday) thisWeekG10 += g || 0;
      if (g > 0) inWin.push({ at: d.at, g });
    }
    const weekG10 = Math.round(windowG10 / weeks);
    // Abende bilden (alkoholfreie Biere machen keinen Trinkabend)
    const sessions = [];
    for (const e of inWin) {
      const cur = sessions[sessions.length - 1];
      if (cur && e.at - cur.end <= SESSION_GAP) { cur.end = e.at; cur.g += e.g; cur.n++; cur.items.push(e); }
      else sessions.push({ start: e.at, end: e.at, g: e.g, n: 1, items: [e] });
    }
    let top = null; // meiste Gramm, bei Gleichstand der jüngere Abend
    for (const s of sessions) if (!top || s.g >= top.g) top = s;
    const bingeLimit = BINGE_GRAMS[b.sex];
    return {
      sex: b.sex, kg: b.kg, weeks,
      label: labelFor(weekG10, b.sex), limits: LABEL_LIMITS[b.sex],
      weekG10, thisWeekG10, windowG10,
      halbe: Math.round((weekG10 * 10) / HALBE_G10),   // Zehntel: Schnitt in 0,5-l-Flaschen mit 5 %
      binge: { limit: bingeLimit, count: sessions.filter((s) => s.g >= bingeLimit * 10).length },
      peak: top ? { g10: top.g, n: top.n, start: top.start, end: top.end, ...permilleOf(top.items, b) } : null,
      noSize,
    };
  }

  /* ---------- Kartenstufe ---------- */

  // Das Karten-Level ist die Anzahl, wie oft ein Bier getrunken wurde. Ab diesen Levels verändert sich die Optik
  // der Karte (Stufe 1 … 9); dazwischen bleibt sie gleich. Die Kategorie ist davon unabhängig.
  const CARD_TIER_AT = [3, 7, 10, 15, 20, 25, 30, 35, 40];
  function cardTier(count) {
    let tier = 0;
    for (const n of CARD_TIER_AT) if (count >= n) tier++;
    return tier;
  }

  /* ---------- Glückskeks-Nachrichten ---------- */

  /* Rohdaten aus Datensammlung/nachrichten.json: Liste von { id, nachricht }. id = Ganzzahl > 0 oder nicht leerer Text,
     nachricht = nicht leerer Text. Ungültige Einträge und doppelte IDs (die erste gilt) werden gemeldet und übersprungen. */
  function cleanMessages(raw, warn = () => {}) {
    if (!Array.isArray(raw)) { if (raw !== undefined) warn('nachrichten.json: Es muss eine Liste sein'); return []; }
    const seen = new Set();
    const out = [];
    raw.forEach((m, i) => {
      const idOk = m && ((Number.isInteger(m.id) && m.id > 0) || (typeof m.id === 'string' && m.id.trim()));
      const text = m && typeof m.nachricht === 'string' ? m.nachricht.trim() : '';
      if (!idOk || !text) { warn(`nachrichten.json: Eintrag ${i + 1} ungültig (id und nachricht nötig), wird ignoriert`); return; }
      const id = String(m.id).trim();
      if (seen.has(id)) { warn(`nachrichten.json: ID ${id} kommt doppelt vor, die erste gilt`); return; }
      seen.add(id);
      out.push({ id, text });
    });
    return out;
  }

  /* Nächste Nachricht wählen: zufällig unter denen, die noch nicht ausgegeben wurden. Sind alle ausgegeben, beginnt die
     Liste von vorn (die zuletzt gezeigte Nachricht kommt dann nicht gleich wieder, sofern es mehrere gibt).
     messages = bereinigte Liste, shownIds = bisher ausgegebene IDs (Reihenfolge = Ausgabe), rand = Zufallsfunktion [0, 1).
     Gibt { message, shownIds } zurück; shownIds ist der neue Stand zum Speichern. Ohne Nachrichten: message = null.
     IDs, die es nicht mehr gibt, fallen aus shownIds heraus; neu hinzugekommene Nachrichten gelten als nicht ausgegeben. */
  function pickMessage(messages, shownIds, rand = Math.random) {
    if (!Array.isArray(messages) || !messages.length) return { message: null, shownIds: [] };
    const known = new Set(messages.map((m) => m.id));
    let shown = (Array.isArray(shownIds) ? shownIds : []).filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
    let pool = messages.filter((m) => !shown.includes(m.id));
    if (!pool.length) {
      const last = shown[shown.length - 1];
      shown = [];
      pool = messages.length > 1 ? messages.filter((m) => m.id !== last) : messages;
    }
    const message = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
    return { message, shownIds: shown.concat(message.id) };
  }

  /* ---------- Bundesländer ---------- */

  const BUNDESLAENDER = ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen',
    'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
    'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'];

  /* ---------- Benutzername ---------- */

  const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  // Anzeigeform darf Groß/klein mischen; eindeutig ist die kleingeschriebene Form (usernameKey)
  const usernameKey = (name) => (typeof name === 'string' && USERNAME_RE.test(name) ? name.toLowerCase() : null);

  /* ---------- Challenges ---------- */

  /* Zwei Challenges gleichzeitig (Liste: Datensammlung/challenges.json, geprüft von cleanChallenges):
       W  Wochen-Challenge: wechselt jeden Sonntag um 0:00 Uhr Ortszeit, egal ob geschafft oder nicht. Alle Spieler haben in einer
          Woche dieselbe (Auswahl aus der Kalenderwoche berechnet, kein Zufall zur Laufzeit). Geschafft = abgehakt bis Wochenende.
       N  Challenge ohne Frist: bleibt, bis sie geschafft ist, und wird dann sofort durch die nächste ersetzt (Reihenfolge der Datei;
          nach der letzten beginnt die Liste von vorn, die Benutzernamen-Challenge kommt nur einmal).
     Wie alles andere wird der Stand NUR aus dem Protokoll berechnet, nie gespeichert. Wird ein Eintrag gelöscht, ist eine damit
     geschaffte Challenge also von selbst wieder offen (und die Punkte sind weg).
     Es zählen nur Einträge ab CHALLENGE_START. Eine N-Challenge zählt nur Einträge NACH dem Eintrag, der die vorige abgeschlossen hat
     (ein Eintrag schließt höchstens eine N-Challenge ab). W und N zählen unabhängig: ein Eintrag kann beide voranbringen.
     „neu“ = das erste Trinken dieses Biers überhaupt (auch vor CHALLENGE_START getrunkene Biere sind nicht mehr neu). */
  const CHALLENGE_START = new Date(2026, 10, 22).getTime(); // Sonntag, 22.11.2026, 0:00 Ortszeit: erste Wochen-Challenge
  const CHALLENGE_MAX_POINTS = 40;  // höchstens 4,0 Punkte je Challenge (Grenze der Rangliste und der Firestore-Regeln)
  const WEEK_MS = 7 * 86400000;
  // Fester Startwert der Wochen-Auswahl. NIE ändern: sonst bekämen alle vergangenen Wochen eine andere Challenge (Punkte ändern sich rückwirkend).
  // „bs3:“ gewählt, damit die erste Woche (22.11.2026) nicht „kein Bier“ ist (die Woche lief schon; es wäre sofort verloren gewesen).
  const WEEK_SALT = 'bs3:';
  const CHALLENGE_TYPES = ['biere', 'gleiches', 'punkte', 'keins', 'benutzername'];
  const CHALLENGE_FIELDS = ['id', 'art', 'text', 'punkte', 'typ', 'ziel', 'ab', 'neu', 'stufe', 'spezial', 'region', 'land', 'ausland', 'alkUeber', 'alkUnter', 'sorten'];

  // Sonntag 0:00 Ortszeit der Challenge-Woche, in der ms liegt (Sonntag bis Samstag)
  function challengeWeekStart(ms) {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  }
  const challengeWeekKey = (ms) => dayNumber(challengeWeekStart(ms));

  // FNV-1a (32 Bit): gleichmäßige, feste „Zufallszahl“ aus einem Text, für die Auswahl der Wochen-Challenge
  function hash32(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }

  /* Rohdaten aus challenges.json prüfen. Ungültige Einträge fallen mit Warnung weg. Ergebnis je Challenge:
     { id, art: 'W' | 'N', text, punkte (Zehntel), typ, ziel (Anzahl bzw. Zehntel bei typ „punkte“), ab (Tag-Nummer des Sonntags oder null), filter }
     Typen: biere (mindestens ziel passende Biere), gleiches (ziel-mal dasselbe passende Bier), punkte (mindestens ziel Punkte aus Bieren,
     ohne Challenge-Punkte), keins (kein einziges Bier in der Woche, nur W), benutzername (einen Benutzernamen haben, nur N).
     Filter (alle optional, werden mit UND verknüpft): neu, stufe, spezial, region, land, ausland, alkUeber, alkUnter, sorten. */
  function cleanChallenges(raw, warn = () => {}) {
    if (raw == null) return [];
    if (!Array.isArray(raw)) { warn('challenges.json: keine Liste, wird ignoriert'); return []; }
    const out = [];
    const seen = new Set();
    raw.forEach((r, i) => {
      const where = `challenges.json: Eintrag ${i + 1}`;
      const bad = (why) => warn(`${where} (${r && r.id}): ${why}, wird ignoriert`);
      if (!r || typeof r !== 'object' || Array.isArray(r)) { bad('kein Objekt'); return; }
      const id = typeof r.id === 'string' ? r.id.trim() : '';
      const text = str(r.text);
      if (!id) { bad('id fehlt'); return; }
      if (seen.has(id)) { bad('doppelte id'); return; }
      if (r.art !== 'W' && r.art !== 'N') { bad('art muss "W" oder "N" sein'); return; }
      if (!text || text.length > 80) { bad('text fehlt oder ist länger als 80 Zeichen'); return; }
      if (!CHALLENGE_TYPES.includes(r.typ)) { bad(`unbekannter typ (erlaubt: ${CHALLENGE_TYPES.join(', ')})`); return; }
      if (r.typ === 'keins' && r.art !== 'W') { bad('typ "keins" gibt es nur als Wochen-Challenge'); return; }
      if (r.typ === 'benutzername' && r.art !== 'N') { bad('typ "benutzername" gibt es nur als N-Challenge'); return; }
      const unknown = Object.keys(r).filter((k) => !CHALLENGE_FIELDS.includes(k));
      if (unknown.length) { bad(`unbekannte Felder: ${unknown.join(', ')}`); return; }
      const punkte = tenths(r.punkte, 1, CHALLENGE_MAX_POINTS);
      if (punkte === null) { bad(`punkte ungültig (0,1 bis ${fmt1(CHALLENGE_MAX_POINTS)}, in Zehnteln)`); return; }
      let ziel = 1;
      if (r.typ === 'punkte') {
        ziel = tenths(r.ziel, 1, 100000);
        if (ziel === null) { bad('ziel (Punkte) ungültig'); return; }
      } else if (r.ziel != null) {
        if (!Number.isInteger(r.ziel) || r.ziel < 1 || r.ziel > 1000) { bad('ziel muss eine ganze Zahl ab 1 sein'); return; }
        ziel = r.ziel;
      }
      let ab = null;
      if (r.ab != null) {
        const m = typeof r.ab === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.ab);
        const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (!d || d.getMonth() !== Number(m[2]) - 1) { bad('ab muss ein Datum "JJJJ-MM-TT" sein'); return; }
        ab = challengeWeekKey(d.getTime());
      }
      const f = {};
      const bool = (k) => { if (r[k] != null) { if (typeof r[k] !== 'boolean') throw new Error(`${k} muss true oder false sein`); f[k] = r[k]; } };
      const text1 = (k) => { if (r[k] != null) { if (!str(r[k])) throw new Error(`${k} muss ein Text sein`); f[k] = str(r[k]); } };
      const num = (k) => { if (r[k] != null) { if (typeof r[k] !== 'number' || !Number.isFinite(r[k])) throw new Error(`${k} muss eine Zahl sein`); f[k] = r[k]; } };
      try {
        bool('neu'); bool('spezial'); bool('ausland');
        text1('region'); text1('land');
        num('alkUeber'); num('alkUnter');
        if (r.stufe != null) { if (!STUFEN.includes(r.stufe)) throw new Error(`stufe muss ${STUFEN.join(', ')} sein`); f.stufe = r.stufe; }
        if (r.sorten != null) { const l = strList(r.sorten); if (!Array.isArray(r.sorten) || !l.length) throw new Error('sorten muss eine Liste von Texten sein'); f.sorten = l; }
      } catch (err) { bad(err.message); return; }
      if ((r.typ === 'keins' || r.typ === 'benutzername') && Object.keys(f).length) { bad(`typ "${r.typ}" kennt keine Filter`); return; }
      seen.add(id);
      out.push({ id, art: r.art, text, punkte, typ: r.typ, ziel, ab, filter: f });
    });
    return out;
  }

  // Passt ein Eintrag (Bier, erstes Trinken ja/nein) zum Filter einer Challenge?
  function challengeMatch(f, beer, isNew) {
    if (f.neu && !isNew) return false;
    if (f.stufe != null && beer.stufe !== f.stufe) return false;
    if (f.spezial && !beer.spezial) return false;
    if (f.region != null && beer.company.region !== f.region) return false;
    if (f.land != null && beer.company.land !== f.land) return false;
    if (f.ausland && !(beer.company.land && beer.company.land !== 'Deutschland')) return false;
    if (f.alkUeber != null && !(typeof beer.alc === 'number' && beer.alc > f.alkUeber)) return false;
    if (f.alkUnter != null && !(typeof beer.alc === 'number' && beer.alc < f.alkUnter)) return false;
    if (f.sorten && !beer.sorten.some((s) => f.sorten.includes(s))) return false;
    return true;
  }

  // Zähler für den Fortschritt einer Challenge über eine Folge von Einträgen; progress() ist auf ziel gedeckelt
  function challengeCounter(ch) {
    let n = 0;
    const per = new Map();
    return {
      add(e) {
        if (!challengeMatch(ch.filter, e.beer, e.isNew)) return;
        if (ch.typ === 'biere') n++;
        else if (ch.typ === 'punkte') n += e.points;
        else if (ch.typ === 'gleiches') { const c = (per.get(e.beer.id) || 0) + 1; per.set(e.beer.id, c); if (c > n) n = c; }
      },
      progress: () => Math.min(n, ch.ziel),
      done: () => n >= ch.ziel,
    };
  }

  // Wochen-Challenges der Wochen ab CHALLENGE_START bis zur Woche von now: [{ key, start (Date), ch }]
  // Je Woche gewinnt die Challenge mit dem kleinsten hash32("<Woche>:<id>") unter denen, die in den letzten
  // (Anzahl ÷ 2) Wochen nicht dran waren; so wechseln sie sich ab, ohne eine feste Reihenfolge.
  // Eine neue Challenge (mit „ab“ in der Zukunft) verändert deshalb keine vergangene Woche.
  function weekPicks(list, now) {
    const pool = list.filter((c) => c.art === 'W');
    const out = [];
    const first = challengeWeekStart(CHALLENGE_START);
    const lastKey = challengeWeekKey(now);
    for (let i = 0; ; i++) {
      const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * i);
      const key = dayNumber(start);
      if (key > lastKey) break;
      const avail = pool.filter((c) => c.ab === null || c.ab <= key);
      const back = Math.floor(avail.length / 2);
      const recent = new Set(back ? out.slice(-back).map((p) => p.ch && p.ch.id) : []);
      let best = null; let bestH = 0;
      for (const c of avail) {
        if (recent.has(c.id)) continue;
        const h = hash32(`${WEEK_SALT}${key}:${c.id}`);
        if (!best || h < bestH || (h === bestH && c.id < best.id)) { best = c; bestH = h; }
      }
      out.push({ key, start, ch: best });
    }
    return out;
  }

  /* Stand der Challenges, aus dem Protokoll berechnet.
     drinks: bereinigte Einträge (GAME.normalizeDrinks), beerMap: Map(id → Bier), list: GAME.cleanChallenges(…), now: ms,
     hasName: true/false = Konto mit/ohne Benutzernamen, null = es gibt keine Benutzernamen (lokaler Modus; die Challenge entfällt).
     Wer schon einen Namen hat, bekommt die Benutzernamen-Challenge sofort gutgeschrieben (sie erscheint nie).
     Ergebnis: {
       week: { ch, start, end, progress, done, failed, count } | null    (aktuelle Wochen-Challenge; failed nur bei „keins“)
       open: { ch, since, progress } | null                             (aktuelle N-Challenge)
       done: [{ ch, at, week? }]                                        (alle geschafften, älteste zuerst; at = Zeitpunkt)
       points: Zehntel aus allen geschafften Challenges }             */
  function challengeState(drinks, beerMap, list, now, hasName) {
    const chs = Array.isArray(list) ? list : [];
    const seenBeer = new Set();
    const ev = [];
    for (const d of Array.isArray(drinks) ? drinks : []) {
      const beer = beerMap.get(d.beerId);
      if (!beer) continue;
      const isNew = !seenBeer.has(beer.id);
      seenBeer.add(beer.id);
      if (d.at < CHALLENGE_START || d.at > now) continue;
      ev.push({ id: d.id, at: d.at, beer, isNew, points: beerPoints(beer) + (isNew ? NEW_CARD_BONUS : 0) });
    }
    ev.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    const done = [];
    let week = null;

    // Wochen-Challenges: jede Woche für sich
    let j = 0;
    const picks = now >= CHALLENGE_START ? weekPicks(chs, now) : [];
    for (const p of picks) {
      const end = new Date(p.start.getFullYear(), p.start.getMonth(), p.start.getDate() + 7).getTime();
      const startMs = p.start.getTime();
      while (j < ev.length && ev[j].at < startMs) j++;
      const counter = p.ch ? challengeCounter(p.ch) : null;
      let count = 0; let doneAt = null;
      for (; j < ev.length && ev[j].at < end; j++) {
        count++;
        if (!counter) continue;
        counter.add(ev[j]);
        if (doneAt === null && p.ch.typ !== 'keins' && counter.done()) doneAt = ev[j].at;
      }
      const isNow = now < end;
      let failed = false;
      if (p.ch && p.ch.typ === 'keins') {
        if (count) failed = true;
        else if (!isNow) doneAt = end - 1;
      }
      if (p.ch && doneAt !== null) done.push({ ch: p.ch, at: doneAt, week: p.key });
      if (isNow) {
        week = p.ch ? { ch: p.ch, start: startMs, end, progress: p.ch.typ === 'keins' ? count : counter.progress(), done: doneAt !== null, failed, count } : null;
      }
    }

    // N-Challenges: eine Kette; die nächste beginnt nach dem Eintrag, der die vorige abgeschlossen hat
    const order = chs.filter((c) => c.art === 'N');
    let open = null;
    if (order.length && now >= CHALLENGE_START) {
      let i = 0; let since = CHALLENGE_START; let pos = 0; let round = 0; let skipped = 0;
      while (skipped < order.length) {
        const ch = order[pos];
        const chRound = round; // Durchgang, zu dem diese Challenge gehört (0 = erster)
        pos++;
        if (pos === order.length) { pos = 0; round++; }
        // Benutzernamen-Challenge nur im ersten Durchgang und nur, wenn es Benutzernamen gibt; „ab“ = erst ab dieser Woche
        const usable = (ch.ab === null || ch.ab <= challengeWeekKey(since)) && !(ch.typ === 'benutzername' && (hasName === null || chRound > 0));
        if (!usable) { skipped++; continue; }
        skipped = 0;
        if (ch.typ === 'benutzername') {
          if (hasName) { done.push({ ch, at: since }); continue; }
          open = { ch, since, progress: 0 };
          break;
        }
        const counter = challengeCounter(ch);
        let at = null;
        for (; i < ev.length; i++) {
          counter.add(ev[i]);
          if (counter.done()) { at = ev[i].at; i++; break; }
        }
        if (at === null) { open = { ch, since, progress: counter.progress() }; break; }
        done.push({ ch, at });
        since = at;
      }
    }
    done.sort((a, b) => a.at - b.at);
    return { week, open, done, points: done.reduce((s, d) => s + d.ch.punkte, 0) };
  }

  // Höchstmögliche Challenge-Punkte (Zehntel), für die Plausibilitätsprüfung der Rangliste (gleiche Rechnung wie firestore.rules):
  // je Bier höchstens eine N-Challenge, je Woche eine W-Challenge, dazu zwei als Reserve (Benutzername, angebrochene Woche).
  // Die Wochen werden als (now − CHALLENGE_START) / WEEK_MS gerechnet; die Regeln vergleichen dasselbe ohne Division.
  // Gezählt ab ALLOWANCE_FROM = 21.11.2026, 0:00 UTC (ein Tag vor CHALLENGE_START, damit keine Zeitzone zu knapp rechnet); dieselbe Zahl steht in firestore.rules.
  const ALLOWANCE_FROM = 1795219200000;
  const challengeAllowance = (count, now) => ((count + 2) * CHALLENGE_MAX_POINTS) + Math.max(0, ((now - ALLOWANCE_FROM) * CHALLENGE_MAX_POINTS) / WEEK_MS);

  /* ---------- Rangliste ---------- */

  const BOARD_SIZE = 15; // so viele Plätze zeigt die Rangliste (zusätzlich der eigene Rang)

  /* Rohdaten der Rangliste (Dokumente aus leaderboard/<uid>: { uid, username, sum, count, cards }) prüfen, sortieren und
     mit Rängen versehen. Ungültige Zeilen (Name ungültig, Zahlen keine Ganzzahlen oder unmöglich) fallen weg.
     cards = Zahl der verschiedenen Karten; jede bringt einmal NEW_CARD_BONUS, deshalb gehört sie in die Grenzen von sum
     (gleiche Prüfung wie in firestore.rules). Zeilen ohne cards (alte App-Version) fallen ebenfalls weg.
     sum enthält die Challenge-Punkte; dafür ist nach oben challengeAllowance(count, now) Spielraum (now = jetzt in ms).
     Sortierung: Punkte absteigend, dann Anzahl Biere, dann Name. Gleiche Punkte teilen sich den Platz
     (1, 2, 2, 4 …); der Rang eines Spielers ist 1 + Anzahl der Spieler mit MEHR Punkten. Das Level folgt aus den
     Punkten, die Reihenfolge ist also zugleich die nach Level (bei gleichem Level entscheiden die Punkte). */
  function rankBoard(rows, now = Date.now()) {
    const ok = (r) => r && typeof r.uid === 'string' && usernameKey(r.username)
      && Number.isInteger(r.sum) && Number.isInteger(r.count) && Number.isInteger(r.cards)
      && r.count >= 0 && r.cards >= 0 && r.cards <= r.count && (r.cards > 0 || r.count === 0)
      && r.sum >= r.count * POINTS[1] + r.cards * NEW_CARD_BONUS
      && r.sum <= r.count * MAX_BEER_POINTS + r.cards * NEW_CARD_BONUS + challengeAllowance(r.count, now);
    const list = (Array.isArray(rows) ? rows : []).filter(ok)
      .sort((a, b) => b.sum - a.sum || b.count - a.count || (usernameKey(a.username) < usernameKey(b.username) ? -1 : 1));
    let rank = 0;
    return list.map((r, i) => {
      if (i === 0 || r.sum !== list[i - 1].sum) rank = i + 1;
      return { uid: r.uid, username: r.username, sum: r.sum, count: r.count, cards: r.cards, level: level(r.sum), rank };
    });
  }

  /* ---------- Sammlung anderer Spieler (sammlung/<uid>: { beers: { "<Bier-ID>": Anzahl } }) ---------- */

  // Eigene Sammlung zum Veröffentlichen: aus summary.cards ein Objekt Bier-ID → Anzahl (Schlüssel sortiert, damit der Vergleich stabil ist)
  function collectionCounts(cards) {
    const out = {};
    (Array.isArray(cards) ? cards : []).map((c) => [c.beer.id, c.count]).sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .forEach(([id, n]) => { out[id] = n; });
    return out;
  }
  // Anzeigename ohne „ - “ zwischen Marke und Sorte: „Sternburg - Export“ → „Sternburg Export“
  const listName = (beer) => beer.name.replace(' - ', ' ');
  /* Fremde Sammlung (ungeprüft vom Server) in eine Liste [{ id, name, count }] verwandeln. Unbekannte IDs (z. B. Bier aus einer
     neueren Datenbank) und ungültige Anzahlen fallen weg. Sortierung: öfter getrunken zuerst, dann Name. */
  function collectionList(beers, beerMap) {
    if (!beers || typeof beers !== 'object' || Array.isArray(beers)) return [];
    const list = [];
    for (const [id, n] of Object.entries(beers)) {
      const beer = beerMap.get(id);
      if (!beer || !Number.isInteger(n) || n < 1) continue;
      list.push({ id, name: listName(beer), count: n });
    }
    return list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de') || (a.id < b.id ? -1 : 1));
  }

  const api = {
    POINTS, STUFEN, MAX_STUFE, MAX_BONUS, MAX_BEER_POINTS, NEW_CARD_BONUS, LEVEL_POINTS, BUNDESLAENDER, ID_RE,
    BOARD_SIZE, rankBoard, collectionCounts, collectionList, listName,
    pointsFor, beerPoints, SPECIAL_DESIGNS, LEGEND_ICONS, cleanSpecials, level, ring, ringTenths, toNext,
    fmt1, fmtInt, fmtDec, fmtAlc, fmtLiter, fmtRing,
    splitName, cleanBeer, mergeBeers,
    fold, unumlaut, searchEntry, buildIndex, search,
    normalizeDrinks, summarize, compareCards, CARD_TIER_AT, cardTier,
    cleanPlace, placeGroups, PLACE_DECIMALS, // STANDORT-KARTE
    cleanMessages, pickMessage,
    weekStart, weekKey, weeksInclusive, dayNumber, isoWeek,
    WEEKDAYS, stats,
    LABELS, LABEL_LIMITS, BINGE_GRAMS, KG_MIN, KG_MAX, gramsTenths, cleanBody, parseKg, labelFor, fmtPermille, alcoholReport, // ALKOHOL-AUSWERTUNG
    usernameKey,
    CHALLENGE_START, CHALLENGE_MAX_POINTS, challengeWeekStart, challengeWeekKey, cleanChallenges, challengeMatch, weekPicks, challengeState, challengeAllowance,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GAME = api;
})();
