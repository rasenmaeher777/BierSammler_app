/* Bier Sammler – Spiellogik als reine Funktionen.
   Ohne DOM und ohne Zugriff auf den App-Zustand, damit alles einzeln prüfbar ist
   (im Browser als window.GAME, in Node per require('./js/game.js')).

   Punkte werden NUR als ganze Zahlen in Zehnteln gerechnet (1,4 Punkte = 14), sonst entstehen
   Rundungsfehler (3 × 1,1 wäre sonst 3,3000000000000003). Geteilt wird erst bei der Ausgabe.
   Datumswerte sind Millisekunden (Ganzzahl); gerechnet wird immer in Ortszeit, nie mit toISOString(). */
(function () {
  'use strict';

  /* ---------- Punkte und Level ---------- */

  // Punkte pro Trinken je Kategorie-Stufe, in Zehnteln (Stufe 4 = 1,4 Punkte).
  // Stufen: 1 Standardgebräu, 2 Klassiker, 3 Spezialität, 4 Raddelfuß, 5 Zaubertrank, 6 Heiligtum (Raddelfuß = Zaubertrank)
  const POINTS = { 1: 10, 2: 11, 3: 12, 4: 14, 5: 14, 6: 16 };
  const STUFEN = Object.keys(POINTS).map(Number).sort((a, b) => a - b); // [1 … 6]
  const MAX_STUFE = STUFEN[STUFEN.length - 1];
  const LEVEL_POINTS = 100; // 10 Punkte = 1 Level

  const pointsFor = (stufe) => POINTS[stufe] || 0;
  // Punkte eines Biers in Zehnteln: eigene Punkte der Spezialkarte, sonst die Punkte seiner Stufe
  const beerPoints = (beer) => (beer && Number.isInteger(beer.punkte) ? beer.punkte : pointsFor(beer && beer.stufe));
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
      kategorie: (katNames && katNames[stufe]) || str(raw.kategorie_name) || '',
      // Darstellung: Beschriftung im Band, CSS-Klassen der Karte, eigene Punkte; bei Spezialkarten von applySpecials überschrieben
      label: (katNames && katNames[stufe]) || str(raw.kategorie_name) || '',
      look: `k${stufe}`,
      punkte: null,
      spezial: null,
    };
  }

  /* ---------- Spezialkarten (Datensammlung/spezialkarten.json) ---------- */

  /* Jede Spezialkarte hat einen Titel (steht im Band statt der Kategorie), ein Aussehen und eine Liste von Bier-IDs:
       baer     wie Standardgebräu, aber statt der Flasche der Berliner Bär
       sticker  wie Standardgebräu, mit rundem blauem „BB“-Sticker
       sanchi   eigenständiges Design (nachtviolett)
       noir     eigenständiges Design in Schwarz-Weiß (Comic-Raster)
       regenbogen  eigenständiges Design mit Regenbogen und Glitzer
       Legenden der Bundesländer: wie Standardgebräu, aber statt der Flasche ein Wahrzeichen des Landes (ICONS in js/app.js):
       kuckucksuhr (BW), brezel (Bayern), gurke (Brandenburg), schluessel (Bremen), anker (Hamburg), bembel (Hessen),
       leuchtturm (MV), schaf (Niedersachsen), dom (NRW), traube (RLP), hammer (Saarland), schwibbogen (Sachsen),
       nebra (Sachsen-Anhalt), strandkorb (SH), bratwurst (Thüringen)
     Optional "punkte" (z. B. 1.0): ersetzt die Punkte der Stufe für diese Biere. Kategorie (Stufe) und Sammlung bleiben unberührt. */
  const LEGEND_ICONS = ['kuckucksuhr', 'brezel', 'gurke', 'schluessel', 'anker', 'bembel', 'leuchtturm', 'schaf', 'dom', 'traube', 'hammer', 'schwibbogen', 'nebra', 'strandkorb', 'bratwurst'];
  const SPECIAL_DESIGNS = { baer: 'k1 sp-baer', sticker: 'k1 sp-sticker', sanchi: 'sp-sanchi', noir: 'sp-noir', regenbogen: 'sp-regenbogen' };
  for (const icon of LEGEND_ICONS) SPECIAL_DESIGNS[icon] = 'k1 sp-icon';
  const DESIGNS = Object.keys(SPECIAL_DESIGNS);

  // Rohdaten prüfen; ungültige Karten fallen mit Warnung weg. Ergebnis: [{ id, titel, design, punkte (Zehntel oder null), biere }]
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
        const t = Math.round(r.punkte * 10);
        if (typeof r.punkte === 'number' && Math.abs(r.punkte * 10 - t) < 1e-9 && t >= POINTS[1] && t <= POINTS[MAX_STUFE]) punkte = t;
        else warn(`${where}: ungültige Punkte (erlaubt: 1,0 bis 1,6 in Zehnteln), Standardpunkte der Stufe gelten`);
      }
      out.push({ id, titel, design: r.design, punkte, biere: r.biere.filter((b) => typeof b === 'string') });
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
     Ergebnis: { list, map } mit map = Map(id → Bier). */
  function mergeBeers(main, manual, kategorien, warn = () => {}, fixes, specials) {
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

  /* Einträge aus localStorage oder Firestore bereinigen: [{ id, beerId, at }].
     Verworfen wird alles ohne gültige ID, mit unbekannter beerId (falls known übergeben) oder ungültigem Zeitpunkt.
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
      out.push({ id, beerId, at });
    }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  }

  /* Sammlung und Punkte aus dem Protokoll berechnen (nie gespeichert).
     beerMap: Map(id → Bier). Einträge mit unbekannter beerId zählen nicht.
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
      if (!c) { c = { beer, count: 0, first: d.at, last: d.at, points: 0, drinks: [] }; cards.set(beer.id, c); }
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

  /* ---------- Kartenstufe ---------- */

  // Das Karten-Level ist die Anzahl, wie oft ein Bier getrunken wurde. Ab diesen Levels verändert sich die Optik
  // der Karte (Stufe 1 … 5); dazwischen bleibt sie gleich. Die Kategorie ist davon unabhängig.
  const CARD_TIER_AT = [4, 8, 16, 24, 40];
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

  /* ---------- Rangliste ---------- */

  const BOARD_SIZE = 15; // so viele Plätze zeigt die Rangliste (zusätzlich der eigene Rang)

  /* Rohdaten der Rangliste (Dokumente aus leaderboard/<uid>: { uid, username, sum, count }) prüfen, sortieren und
     mit Rängen versehen. Ungültige Zeilen (Name ungültig, Zahlen keine Ganzzahlen oder unmöglich) fallen weg.
     Sortierung: Punkte absteigend, dann Anzahl Biere, dann Name. Gleiche Punkte teilen sich den Platz
     (1, 2, 2, 4 …); der Rang eines Spielers ist 1 + Anzahl der Spieler mit MEHR Punkten. */
  function rankBoard(rows) {
    const ok = (r) => r && typeof r.uid === 'string' && usernameKey(r.username)
      && Number.isInteger(r.sum) && Number.isInteger(r.count) && r.count >= 0
      && r.sum >= r.count * POINTS[1] && r.sum <= r.count * POINTS[MAX_STUFE];
    const list = (Array.isArray(rows) ? rows : []).filter(ok)
      .sort((a, b) => b.sum - a.sum || b.count - a.count || (usernameKey(a.username) < usernameKey(b.username) ? -1 : 1));
    let rank = 0;
    return list.map((r, i) => {
      if (i === 0 || r.sum !== list[i - 1].sum) rank = i + 1;
      return { uid: r.uid, username: r.username, sum: r.sum, count: r.count, level: level(r.sum), rank };
    });
  }

  const api = {
    POINTS, STUFEN, MAX_STUFE, LEVEL_POINTS, BUNDESLAENDER, ID_RE,
    BOARD_SIZE, rankBoard,
    pointsFor, beerPoints, SPECIAL_DESIGNS, LEGEND_ICONS, cleanSpecials, level, ring, ringTenths, toNext,
    fmt1, fmtInt, fmtDec, fmtAlc, fmtLiter, fmtRing,
    splitName, cleanBeer, mergeBeers,
    fold, unumlaut, searchEntry, buildIndex, search,
    normalizeDrinks, summarize, compareCards, CARD_TIER_AT, cardTier,
    cleanMessages, pickMessage,
    weekStart, weekKey, weeksInclusive, dayNumber, isoWeek,
    WEEKDAYS, stats,
    usernameKey,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GAME = api;
})();
