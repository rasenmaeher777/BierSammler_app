/* Bier Sammler – Oberfläche.
   Aufbau:
   1. Grundlagen (Hilfsfunktionen, Darstellung hell/dunkel)
   2. Zustand (Bierdatenbank laden, Protokoll, daraus berechnete Sammlung)
   3. Darstellung (Karte, Kopfleiste mit Level-Ring, Startseite)
   4. Dialoge (Hinzufügen mit Aufdecken, Kartenansicht, Statistiken, Standort-Karte, Platzierung, Einstellungen, Bestätigung, Altershinweis, Willkommen)
   5. Bedienung (Klicks)
   6. Anmeldesperre (gesteuert über den Status aus js/store.js)
   7. Service Worker registrieren
   Die Spiellogik steht als reine Funktionen in js/game.js (window.GAME),
   Speichern und Sync in js/store.js (window.STORE). */
(() => {
  'use strict';

  const G = window.GAME;
  const STORE = window.STORE;
  const KARTE = window.KARTE; // STANDORT-KARTE (js/karte.js)
  const LS_THEME = 'biersammler-theme-v1'; // 'light' | 'dark' | fehlt = System (auch im Inline-Skript in index.html)
  const LS_AGE = 'biersammler-age-v1';     // Altershinweis bestätigt
  const LS_WELCOME = 'biersammler-welcome-v1'; // Kontokennungen (Komma-getrennt), die das Willkommensfenster schon gesehen haben; „local“ = lokaler Modus
  const LS_MOTION = 'biersammler-motion-v1'; // „0“ = Neigungssensor abgelehnt, nicht mehr fragen
  /* biere.json und kategorien.json tragen die Zahl der Stufen in der Adresse (?stufen=6). Der Service Worker liefert Bierdateien
     zuerst aus dem Cache (stale-while-revalidate); ohne diese Marke bekäme neuer Code beim ersten Start nach einer Änderung der
     Stufen noch die alten Daten (falsche Punkte und Farben, falsche Werte in der Rangliste). Muss zu DATA_FILES in sw.js passen
     und bei jeder Änderung der Stufen mitgeändert werden. */
  const STUFEN_MARKE = '?stufen=6';
  const BEER_FILES = {
    main: 'Datensammlung/biere.json' + STUFEN_MARKE,
    manual: 'Datensammlung/biere_manuell.json',
    kategorien: 'Datensammlung/kategorien.json' + STUFEN_MARKE,
    korrekturen: 'Datensammlung/biere_korrekturen.json',
    nachrichten: 'Datensammlung/nachrichten.json', // Glückskeks-Sprüche nach dem Bestätigen eines Biers
    spezial: 'Datensammlung/spezialkarten.json',   // Spezialkarten: eigener Titel, Aussehen und ggf. Punkte für einzelne Biere
  };
  const LS_MESSAGES = 'biersammler-messages-v1'; // JSON-Liste der schon gezeigten Spruch-IDs (je Gerät)
  const LS_MORE = 'biersammler-more-v1';   // „Alle weiteren Karten“ aufgeklappt
  const RECENT_MAX = 8; // zuletzt getrunkene Biere im leeren Suchfeld
  const TOP_COUNT = 6;  // beste Karten auf der Startseite

  /* ---------- 1. Grundlagen ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  // Alle Texte aus Bierdatenbank, Firestore und Eingaben gehen hier durch, bevor sie in innerHTML landen
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* Speicher nicht verfügbar */ } };

  // Darstellung: 'system' | 'light' | 'dark'. „System“ entfernt das Attribut, dann gilt prefers-color-scheme.
  // Die Farbe der Statusleiste (theme-color) folgt der gewählten Darstellung; bei „System“ gelten wieder die media-Angaben.
  const THEME_COLORS = { light: '#FAF6EE', dark: '#15130F' };
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const own = m.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light;
      m.content = THEME_COLORS[theme] || own;
    });
  }
  const currentTheme = () => { const t = lsGet(LS_THEME); return t === 'light' || t === 'dark' ? t : 'system'; };

  /* ---------- 2. Zustand ---------- */

  // Bierdatenbank aus biere.json und biere_manuell.json plus biere_korrekturen.json (zusammengeführt in js/game.js)
  const db = { list: [], map: new Map(), index: [], messages: [], ready: false, error: false };
  // Aus dem Protokoll berechnet; wird vor jedem Zeichnen neu bestimmt, nie gespeichert
  let drinks = [];
  let summary = G.summarize([], db.map);
  function recompute() {
    drinks = db.ready ? G.normalizeDrinks(STORE.drinks(), db.map) : [];
    summary = G.summarize(drinks, db.map);
  }
  const cardOf = (beerId) => summary.cards.find((c) => c.beer.id === beerId) || null;

  /* Bierdateien einmal laden. Fehlt biere_manuell.json oder biere_korrekturen.json oder ist sie fehlerhaft, geht es ohne sie weiter
     (Warnung in der Konsole). Ohne biere.json kann die App nichts anzeigen. */
  async function loadBeers() {
    const get = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    };
    const optional = (url, empty = []) => get(url).catch((err) => { console.warn(`${url} nicht lesbar, wird ignoriert:`, err.message); return empty; });
    try {
      const [main, manual, kategorien, korrekturen, nachrichten, spezial] = await Promise.all([get(BEER_FILES.main), optional(BEER_FILES.manual), optional(BEER_FILES.kategorien), optional(BEER_FILES.korrekturen, {}), optional(BEER_FILES.nachrichten), optional(BEER_FILES.spezial)]);
      db.messages = G.cleanMessages(nachrichten, (text) => console.warn(text));
      const r = G.mergeBeers(main, manual, kategorien, (text) => console.warn(text), korrekturen, spezial);
      db.list = r.list;
      db.map = r.map;
      db.index = G.buildIndex(r.list);
      // Je Kategorie: Name und Anzahl vorhandener Biere (für „gefunden / vorhanden“ in den Statistiken)
      db.kat = {};
      for (const b of r.list) {
        const k = db.kat[b.stufe] || (db.kat[b.stufe] = { name: b.kategorie, total: 0 });
        k.total++;
      }
      db.ready = true;
    } catch (err) {
      console.error('Bierdatenbank konnte nicht geladen werden', err);
      db.error = true;
    }
    render();
    if (add.dlg.open) add.paint();
  }

  /* ---------- 3. Darstellung ---------- */

  // Vierzackiger Stern mit Mittelpunkt (x, y) und Radius r
  const star = (x, y, r, delay) => `<path style="--d:${delay}s" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z"/>`;

  /* Flasche. tier = Kartenstufe (G.cardTier): 0 schlicht, 1 Glanz, 2 + Schaumkrone, 3 + (Strahlen im Hintergrund, per CSS),
     4 + Sterne, 5 goldene Flasche mit mehr Sternen. Die Kategorie bleibt davon unberührt. */
  function bottle(tier = 0) {
    const shine = tier >= 1 ? '<rect class="shine" x="9.5" y="40" width="3" height="44" rx="1.5"/>' : '';
    const foam = tier >= 2 ? '<g class="foam"><circle cx="14.5" cy="3" r="4"/><circle cx="20" cy="0.5" r="4.6"/><circle cx="25.5" cy="3" r="4"/></g>' : '';
    const stars = tier >= 4
      ? `<g class="stars">${star(-4, 34, 5, 0)}${star(45, 52, 6, 0.7)}${star(-1, 76, 3.5, 1.4)}${tier >= 5 ? star(46, 22, 4, 0.35) + star(-6, 56, 3, 1.05) + star(44, 82, 3.5, 1.75) : ''}</g>`
      : '';
    // Kronkorken nur, solange die Flasche noch zu ist (ab Stufe 2 steht Schaum darauf)
    const cap = tier < 2 ? '<path class="cap" d="M13.6 .4h12.8v4.4H13.6z"/>' : '';
    const hop = '<path class="hop" d="M20 54.6c-2.7 0-4 2-4 4.1 0 2.7 1.9 5 4 6.4 2.1-1.4 4-3.7 4-6.4 0-2.1-1.3-4.1-4-4.1z"/><path class="hop-scales" d="M16.9 58.2q3.1 1.7 6.2 0M17.2 61.4q2.8 1.5 5.6 0"/>';
    return `<svg class="bottle${tier ? ` t${tier}` : ''}" viewBox="0 0 40 96" aria-hidden="true"><path class="body" d="M15 2h10v6h-1v16c0 4 9 9 9 22v42c0 3-2 6-5 6H12c-3 0-5-3-5-6V46c0-13 9-18 9-22V8h-1z"/><rect class="shade" x="26.5" y="46" width="4" height="42" rx="2"/>${cap}<rect class="label" x="10" y="52" width="20" height="18" rx="3"/>${hop}${shine}${foam}${stars}</svg>`;
  }
  const BOTTLE = bottle();

  /* Berliner Bär (Spezialkarte „baer“) statt der Flasche: aufrecht schreitend, Zunge rot. Gleiche Kartenstufen wie die Flasche:
     ab 4 Sterne, bei 5 golden. Farbe folgt dem Theme (dunkel auf hell, hell auf dunkel), siehe .bear in css/style.css. */
  function bear(tier = 0) {
    const stars = tier >= 4
      ? `<g class="stars">${star(5, 30, 5, 0)}${star(55, 52, 6, 0.7)}${star(3, 70, 3.5, 1.4)}${tier >= 5 ? star(56, 14, 4, 0.35) + star(2, 50, 3, 1.05) + star(54, 76, 3.5, 1.75) : ''}</g>`
      : '';
    return `<svg class="bottle bear${tier ? ` t${tier}` : ''}" viewBox="0 0 60 86" aria-hidden="true">
      <path class="body" d="M19 58q-6 1-7 6q4-1 8-3z"/>
      <path class="limb leg" d="M25 58Q21 70 14 80M32 58Q37 68 44 78"/>
      <ellipse class="body" cx="11.5" cy="82" rx="7.5" ry="3.2" transform="rotate(-8 11.5 82)"/><ellipse class="body" cx="47.5" cy="80.5" rx="7.5" ry="3.2" transform="rotate(12 47.5 80.5)"/>
      <path class="body" d="M24 28C17 34 15 48 19 60C24 66 34 66 38 58C41 48 40 36 34 28C31 26 27 26 24 28z"/>
      <path class="limb arm" d="M34 34Q44 35 52 31M36 43Q45 49 52 46"/>
      <circle class="body" cx="33" cy="19" r="10.5"/><circle class="body" cx="27" cy="10" r="3.8"/><circle class="body" cx="38.5" cy="9" r="3.8"/>
      <ellipse class="body" cx="43.5" cy="22" rx="8.5" ry="5.4"/>
      <ellipse class="nose" cx="50" cy="20.5" rx="2" ry="1.5"/><circle class="eye" cx="38" cy="16" r="1.4"/>
      <path class="tongue" d="M41 26.4q3 7.2 6.2 0z"/>${stars}</svg>`;
  }

  /* Wahrzeichen der Länder-Legenden (Spezialkarten „kuckucksuhr“ … „bratwurst“) statt der Flasche, wie der Bär: gleiche Größe (60 × 86),
     gleiche Kartenstufen (ab 4 Sterne, bei 5 golden). Klassen: body (gefüllt, Farbe folgt dem Theme), limb (Strich), cut (Aussparung in
     Kartenfarbe), cutline (Aussparung als Strich). Siehe .bear in css/style.css. */
  const ICONS = {
    // BW: Kuckucksuhr mit Tannenzapfen-Gewichten
    kuckucksuhr: `<path class="body" d="M30 7L53 29H7z"/><rect class="body" x="12" y="28" width="36" height="31" rx="2"/>
      <rect class="cut" x="26" y="18" width="8" height="7" rx="3.5"/><circle class="cut" cx="30" cy="44" r="10.5"/>
      <path class="limb" style="stroke-width:2" d="M30 44V37M30 44L35 47"/>
      <path class="limb" style="stroke-width:1.6" d="M21 59V69M39 59V73"/>
      <ellipse class="body" cx="21" cy="73" rx="4.2" ry="6"/><ellipse class="body" cx="39" cy="77" rx="4.2" ry="6"/>
      <path class="cutline" style="stroke-width:1.1" d="M17.5 72.5l7 0M17.5 75.5l7 0M35.5 76.5l7 0M35.5 79.5l7 0"/>`,
    // Bayern: Brezel
    brezel: `<path class="limb" style="stroke-width:6.4" d="M30 30C28 8 5 10 9 33C12 47 28 52 40 63C44 67 49 67 51 63M30 30C32 8 55 10 51 33C48 47 32 52 20 63C16 67 11 67 9 63"/>
      <circle class="cut" cx="30" cy="48" r="1.3"/><circle class="cut" cx="15" cy="22" r="1.1"/><circle class="cut" cx="45" cy="22" r="1.1"/><circle class="cut" cx="17" cy="62" r="1.1"/><circle class="cut" cx="43" cy="62" r="1.1"/>`,
    // Brandenburg: Spreewaldgurke
    gurke: `<g transform="rotate(16 30 46)"><ellipse class="body" cx="30" cy="46" rx="13" ry="31"/>
      <path class="body" d="M28 16Q30 8 34 8Q33 12 33 16z"/>
      <path class="cutline" style="stroke-width:1.6" d="M24 28V62M30 22V70M36 28V62"/>
      <circle class="cut" cx="20" cy="36" r="1.1"/><circle class="cut" cx="40" cy="44" r="1.1"/><circle class="cut" cx="21" cy="56" r="1.1"/><circle class="cut" cx="39" cy="62" r="1.1"/><circle class="cut" cx="27" cy="22" r="1.1"/></g>`,
    // Bremen: Bremer Schlüssel
    schluessel: `<circle class="limb" style="stroke-width:6.5" cx="30" cy="19" r="10"/><path class="body" d="M27.4 29h5.2v43h-5.2z"/>
      <path class="body" d="M32.6 52h12v6.5h-12zM32.6 63h9v6.5h-9z"/>`,
    // Hamburg: Anker
    anker: `<circle class="limb" style="stroke-width:3.2" cx="30" cy="13" r="5"/><path class="limb" style="stroke-width:5" d="M30 18V68M20 28H40"/>
      <path class="limb" style="stroke-width:5.5" d="M10 50C12 64 22 72 30 72C38 72 48 64 50 50"/>
      <path class="body" d="M4 52L9.5 42L19 53zM56 52L50.5 42L41 53z"/>`,
    // Hessen: Bembel (Apfelwein-Krug)
    bembel: `<ellipse class="body" cx="30" cy="53" rx="18" ry="22"/><path class="body" d="M23 22h14v10H23z"/><rect class="body" x="20" y="16" width="20" height="7" rx="3"/>
      <path class="limb" style="stroke-width:4.5" d="M46 38C60 38 60 62 46 64"/>
      <ellipse class="cut" cx="30" cy="54" rx="11" ry="14"/><path class="body" d="M30 43l3.4 8.6 8.6.8-6.6 5.6 2 8.6L30 62l-7.4 4.6 2-8.6-6.6-5.6 8.6-.8z" transform="translate(0 -1) scale(1)" style="transform-origin:30px 54px;transform:scale(.55)"/>
      <path class="cutline" style="stroke-width:1.4" d="M13.5 40Q30 46 46.5 40M13 67Q30 73 47 67"/>`,
    // MV: Leuchtturm
    leuchtturm: `<path class="body" d="M30 8L41 21H19z"/><rect class="body" x="22" y="21" width="16" height="11" rx="1"/><rect class="cut" x="25.5" y="23.5" width="9" height="6" rx="1"/>
      <path class="body" d="M18 32h24v3.5H18z"/><path class="body" d="M23 35.5h14L41 76H19z"/>
      <path class="cutline" style="stroke-width:5" d="M22 49H38M21 63H39" transform="translate(0 0)"/>
      <path class="body" d="M13 76h34v5H13z"/><path class="limb" style="stroke-width:1.8" d="M5 24L16 27M5 31L16 31M55 24L44 27M55 31L44 31"/>`,
    // Niedersachsen: Heidschnucke
    schaf: `<g class="body"><circle cx="19" cy="45" r="10"/><circle cx="30" cy="38" r="11"/><circle cx="41" cy="44" r="10"/><circle cx="25" cy="54" r="10"/><circle cx="37" cy="54" r="10"/></g>
      <path class="limb" style="stroke-width:4" d="M22 62V77M37 62V77M43 60V76"/>
      <g style="stroke:var(--surface);stroke-width:1.8"><ellipse class="body" cx="49" cy="43" rx="7" ry="9" transform="rotate(14 49 43)"/></g>
      <path class="body" d="M43 36Q37 34 38 41Q41 41 45 40z"/><circle class="cut" cx="51" cy="40" r="1.4"/>`,
    // NRW: Kölner Dom
    dom: `<path class="body" d="M12 38L20 6L28 38zM32 38L40 6L48 38z"/><rect class="body" x="12" y="37" width="16" height="43"/><rect class="body" x="32" y="37" width="16" height="43"/><rect class="body" x="27" y="52" width="6" height="28"/>
      <path class="cut" d="M16.5 62v-10a3.5 3.5 0 0 1 7 0v10zM36.5 62v-10a3.5 3.5 0 0 1 7 0v10z"/><path class="cut" d="M16.5 49v-4a3.5 3.5 0 0 1 7 0v4zM36.5 49v-4a3.5 3.5 0 0 1 7 0v4z"/>
      <path class="cut" d="M26 80v-10a4 4 0 0 1 8 0v10z"/><path class="limb" style="stroke-width:1.8" d="M20 6V1M17.6 3H22.4M40 6V1M37.6 3H42.4"/>`,
    // RLP: Weintraube
    traube: `<g class="body" style="stroke:var(--surface);stroke-width:1.3"><circle cx="16" cy="32" r="5.6"/><circle cx="27" cy="32" r="5.6"/><circle cx="38" cy="32" r="5.6"/><circle cx="49" cy="32" r="5.6"/>
      <circle cx="21.5" cy="43" r="5.6"/><circle cx="32.5" cy="43" r="5.6"/><circle cx="43.5" cy="43" r="5.6"/>
      <circle cx="27" cy="54" r="5.6"/><circle cx="38" cy="54" r="5.6"/><circle cx="32.5" cy="65" r="5.6"/></g>
      <path class="limb" style="stroke-width:2.6" d="M29 25C28 18 31 13 35 9"/><path class="body" d="M33 17C38 6 52 6 54 14C47 21 38 21 33 17z"/><path class="cutline" style="stroke-width:1" d="M35 16C41 13 46 12 51 12"/>`,
    // Saarland: Schlägel und Eisen
    hammer: `<path class="limb" style="stroke-width:4.4" d="M14 21L45 70M46 21L15 70"/>
      <g transform="translate(14 21) rotate(-32.5)"><rect class="body" x="-11" y="-6" width="22" height="12" rx="1.5"/></g>
      <g transform="translate(46 21) rotate(32.5)"><path class="body" d="M-13 3L-7 -6H7L13 3L7 6H-7z"/></g>
      <rect class="body" x="42" y="67" width="8" height="6" rx="2" transform="rotate(-32.5 46 70)"/><rect class="body" x="10" y="67" width="8" height="6" rx="2" transform="rotate(32.5 14 70)"/>`,
    // Sachsen: Erzgebirgischer Schwibbogen mit Kerzen
    schwibbogen: `<path class="limb" style="stroke-width:5" d="M11 77V50A19 19 0 0 1 49 50V77"/><rect class="body" x="5" y="76" width="50" height="5" rx="1.5"/>
      <path class="body" d="M30 50l2.6 6.4 6.4.6-4.9 4.2 1.5 6.4L30 64.4l-5.6 3.2 1.5-6.4-4.9-4.2 6.4-.6z" transform="translate(0 -4)"/>
      <g class="body"><rect x="15.4" y="23" width="4.4" height="13"/><rect x="40.2" y="23" width="4.4" height="13"/><rect x="27.8" y="15" width="4.4" height="14"/></g>
      <path class="body" d="M17.6 21c-2.2-3.2 0-6.4 0-8.4c2.2 2 3.2 5.2 0 8.4zM42.4 21c-2.2-3.2 0-6.4 0-8.4c2.2 2 3.2 5.2 0 8.4zM30 13c-2.2-3.2 0-6.4 0-8.4c2.2 2 3.2 5.2 0 8.4z"/>`,
    // Sachsen-Anhalt: Himmelsscheibe von Nebra
    nebra: `<circle class="body" cx="30" cy="44" r="27"/><circle class="cut" cx="38" cy="30" r="6.5"/><circle class="cut" cx="21" cy="46" r="6"/><circle class="body" cx="24.2" cy="44.2" r="5.4"/>
      <g class="cut"><circle cx="24" cy="25" r="1.3"/><circle cx="30" cy="20" r="1.1"/><circle cx="19" cy="31" r="1.1"/><circle cx="44" cy="46" r="1.2"/><circle cx="36" cy="49" r="1.2"/><circle cx="40" cy="57" r="1.2"/><circle cx="33" cy="41" r="1.1"/></g>
      <path class="cutline" style="stroke-width:2.4" d="M5.5 38A27 27 0 0 0 11 60M54.5 38A27 27 0 0 1 49 60M21 66A27 27 0 0 0 39 66"/>`,
    // Schleswig-Holstein: Strandkorb
    strandkorb: `<path class="body" d="M11 72V37C11 14 49 14 49 37V72z"/>
      <path class="cutline" style="stroke-width:1.6" d="M22 20V28M30 18V27M38 20V28"/>
      <path class="cut" d="M17 62V40C17 30 43 30 43 40V62z"/>
      <path class="cutline" style="stroke-width:1.4" d="M18 46H42M18 52H42M18 58H42"/>
      <rect class="body" x="6" y="58" width="48" height="14" rx="4"/><path class="cutline" style="stroke-width:1.4" d="M9 64H51"/><path class="body" d="M9 72h7v7H9zM44 72h7v7h-7z"/>
      <path class="limb" style="stroke-width:1.6" d="M30 17V6"/><path class="body" d="M30 6L41 9.5L30 13z"/>`,
    // Thüringen: Rostbratwurst im Brötchen
    bratwurst: `<g transform="rotate(-38 30 44)"><rect class="body" x="7" y="36" width="46" height="26" rx="13"/>
      <path class="cutline" style="stroke-width:1.6" d="M12 47Q30 53 48 47"/>
      <rect class="body" x="1" y="32" width="58" height="15" rx="7.5" style="stroke:var(--surface);stroke-width:2.2"/>
      <path class="cutline" style="stroke-width:1.5" d="M14 35l5 9M23 35l5 9M32 35l5 9M41 35l5 9"/></g>`,
  };

  // Sterne um das Symbol (ab Kartenstufe 4, bei 5 mehr), gleiche Plätze wie beim Bär
  const heroStars = (tier) => tier >= 4
    ? `<g class="stars">${star(5, 30, 5, 0)}${star(55, 52, 6, 0.7)}${star(3, 70, 3.5, 1.4)}${tier >= 5 ? star(56, 14, 4, 0.35) + star(2, 50, 3, 1.05) + star(54, 76, 3.5, 1.75) : ''}</g>`
    : '';
  const icon = (name, tier = 0) => `<svg class="bottle bear icon ico-${name}${tier ? ` t${tier}` : ''}" viewBox="0 0 60 86" aria-hidden="true">${ICONS[name]}${heroStars(tier)}</svg>`;
  // Symbol in der Mitte der Karte: Flasche, bei Spezialkarten der Bär oder das Wahrzeichen
  const symbol = (b, tier) => {
    const design = b.spezial && b.spezial.design;
    if (design === 'baer') return bear(tier);
    return ICONS[design] ? icon(design, tier) : bottle(tier);
  };

  // Herkunft für den Fuß der Karte (Box, Farbe je Bundesland per CSS über data-o): Bundesland, bei Bieren aus dem Ausland das Land; sonst leer
  // Die beiden längsten Namen werden in der Box gekürzt, damit sie auch auf schmalen Smartphones ganz zu lesen sind
  const ORIGIN_SHORT = { 'Mecklenburg-Vorpommern': 'Meckl.-Vorpommern', 'Nordrhein-Westfalen': 'Nordrhein-Westf.' };
  function originOf(b) {
    const co = b.company || {};
    return co.land && co.land !== 'Deutschland' ? co.land : (co.region || '');
  }
  /* Sammelkarte. c = { beer, count } aus GAME.summarize (count 0 = noch nicht gesammelt).
     Innerhalb eines <button> sind nur <span> erlaubt; deshalb besteht die Karte nur aus <span>-Elementen. */
  function cardInner(c) {
    const b = c.beer;
    const chips = [G.fmtAlc(b.alc), G.fmtLiter(b.flasche)].filter(Boolean);
    const tier = G.cardTier(c.count);
    const origin = originOf(b);
    return `<span class="mat" aria-hidden="true"></span><span class="foil" aria-hidden="true"></span>
      <span class="band"><span class="kat">${esc(b.label)}</span></span>
      <span class="bcard-body${tier ? ` t${tier}` : ''}">
        ${c.count ? `<b class="count" title="${c.count}-mal getrunken">Lvl ${c.count}</b>` : ''}
        ${symbol(b, tier)}
        <span class="title">${esc(b.title)}</span>
        ${b.brand ? `<span class="brand">${esc(b.brand)}</span>` : ''}
        ${chips.length ? `<span class="chips">${chips.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
        ${b.sorten.length ? `<span class="sorte">${esc(b.sorten.join(' · '))}</span>` : ''}
      </span>
      <span class="origin">${origin ? `<span class="o" data-o="${esc(origin)}" title="${esc(origin)}">${esc(ORIGIN_SHORT[origin] || origin)}</span>` : ''}</span>
      ${b.spezial && b.spezial.design === 'sticker' ? '<span class="sticker" aria-hidden="true">BB</span>' : ''}`;
  }
  const cardHtml = (c) => `<div class="bcard ${c.beer.look}">${cardInner(c)}</div>`;
  // Karte im Raster der Startseite: Knopf, der die große Kartenansicht öffnet
  const cardButton = (c) => `<button class="bcard ${c.beer.look}" type="button" data-open="${esc(c.beer.id)}" data-focus="card:${esc(c.beer.id)}"
      aria-label="${esc(`${c.beer.name}, ${c.beer.label}, ${c.count}-mal getrunken`)}">${cardInner(c)}</button>`;

  // Datum und Uhrzeit in Ortszeit: "Mi., 18.11.2026, 14:05"
  const fmtWhen = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const RING_R = 22;
  const RING_C = 2 * Math.PI * RING_R;
  function renderLevel() {
    const sum = summary.sum;
    const lvl = G.level(sum);
    const el = $('#level');
    el.setAttribute('aria-label', `Level ${lvl}, ${G.fmt1(G.ringTenths(sum))} von ${G.LEVEL_POINTS / 10} Punkten`);
    el.title = `Level ${lvl} · ${G.fmtRing(sum)}`;
    el.innerHTML = `<svg viewBox="0 0 56 56" aria-hidden="true"><circle class="track" cx="28" cy="28" r="${RING_R}"/>`
      + `<circle class="fill" cx="28" cy="28" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${(RING_C * (1 - G.ring(sum))).toFixed(2)}"${sum % G.LEVEL_POINTS ? '' : ' style="stroke:none"'}/></svg>`
      + `<span class="num" aria-hidden="true">${lvl}</span>`;
  }

  /* Hinweis „Wird synchronisiert …“, solange Schreibvorgänge unbestätigt sind (hasPendingWrites).
     Erst nach einer Sekunde, damit er bei guter Verbindung nicht bei jedem Eintrag kurz aufblitzt. */
  const PENDING_DELAY = 1000;
  let pendingTimer = null;
  function paintSync() {
    const st = STORE.status();
    const el = $('#sync');
    if (st === 'local') { el.textContent = 'Nur auf diesem Gerät'; return; }
    if (!STORE.pending()) { clearTimeout(pendingTimer); pendingTimer = null; el.textContent = ''; return; }
    if (!pendingTimer && !el.textContent) {
      pendingTimer = setTimeout(() => { if (STORE.pending()) el.textContent = 'Wird synchronisiert, sobald Verbindung besteht'; }, PENDING_DELAY);
    }
  }

  function renderHeader() {
    const p = STORE.profile();
    $('#who').textContent = p.username ? '@' + p.username : 'Anonym';
    // Die Rangliste gibt es nur mit Anmeldung und nur für Spieler mit Benutzernamen
    const showRank = STORE.mode === 'firebase' && !!p.username;
    $('[data-act="ranking"]').hidden = !showRank;
    // STANDORT-KARTE: Der Knopf erscheint, sobald der Standort-Schalter an ist oder schon Einträge mit Ort da sind
    const showMap = KARTE.enabled() || drinks.some((d) => d.lat !== undefined);
    $('[data-act="map"]').hidden = !showMap;
    $('.tools').classList.toggle('has-rank', showRank || showMap);
    paintSync();
    renderLevel();
  }

  const EMPTY_ART = '<svg class="bottle-art" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M27 4h10v4h-1v10c0 3 7 6 7 15v24c0 2-2 4-4 4H25c-2 0-4-2-4-4V33c0-9 7-12 7-15V8h-1z" opacity=".9"/><rect x="24" y="34" width="16" height="12" rx="2" fill="var(--surface)"/></svg>';

  function renderMain() {
    const main = $('#main');
    if (db.error) {
      main.innerHTML = `<div class="empty"><h2>Bierdatenbank nicht erreichbar</h2>
          <p>Die Liste der Biere konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.</p>
          <button class="btn" type="button" data-act="reload">Neu laden</button></div>`;
      return;
    }
    if (!db.ready) {
      main.innerHTML = '<div class="loading" role="status"><span class="spinner"></span>Biere werden geladen …</div>';
      return;
    }
    if (!summary.cards.length) {
      main.innerHTML = `<div class="empty">${EMPTY_ART}
          <h2>Noch keine Karten</h2>
          <p>Tippe nach jedem Bier auf <b>+</b> und trage es ein. Jedes Bier wird zur Sammelkarte – manche sind seltene Funde.</p>
          <p class="note">${G.fmtInt(db.list.length)} Biere warten auf dich, entdeckt zu werden.</p>
        </div>`;
      return;
    }
    // Die 6 besten Karten (höhere Kategorie, öfter, zuletzt getrunken, Name), darunter alle weiteren zum Ausklappen
    const sorted = summary.cards.slice().sort(G.compareCards);
    const top = sorted.slice(0, TOP_COUNT);
    const rest = sorted.slice(TOP_COUNT);
    const found = summary.cards.length;
    main.innerHTML = `
      <div class="home-head">
        <h2>Beste Karten</h2>
        <p class="progress"><b>${G.fmtInt(found)}</b> / ${G.fmtInt(db.list.length)} entdeckt</p>
      </div>
      <div class="progress-bar" aria-hidden="true"><span style="width:${Math.max(0.5, (100 * found) / db.list.length).toFixed(2)}%"></span></div>
      <div class="grid top">${top.map(cardButton).join('')}</div>
      ${rest.length ? `<button class="more-toggle" type="button" data-act="more" data-focus="more" aria-expanded="${moreOpen}" aria-controls="more-grid">
          <span class="chev" aria-hidden="true"></span>Alle weiteren Karten (${G.fmtInt(rest.length)})</button>
        ${moreOpen ? `<div class="grid" id="more-grid">${rest.map(cardButton).join('')}</div>` : ''}` : ''}`;
  }

  // Ausgeklappt-Zustand von „Alle weiteren Karten“ bleibt in localStorage
  let moreOpen = lsGet(LS_MORE) === '1';

  function render() {
    if (locked) return;
    // Fokus merken und nach dem Neuzeichnen wiederherstellen (z. B. wenn ein Sync die Startseite neu zeichnet)
    const active = document.activeElement;
    const keep = active && active.closest && active.closest('#main') && active.dataset.focus;
    recompute();
    // Punkte und Anzahl für die Rangliste (erst wenn die Bierdatenbank geladen ist, sonst stünde dort 0)
    if (db.ready) STORE.publishScore(summary.sum, drinks.length);
    renderHeader();
    renderMain();
    if (keep) {
      const el = $(`#main [data-focus="${CSS.escape(keep)}"]`);
      if (el) el.focus({ preventScroll: true });
    }
    if (cardDlg.open) paintCard();
    if (statsDlg.open) paintStats();
    if (mapCtl) mapCtl.update(G.placeGroups(drinks)); // STANDORT-KARTE
    if (rankDlg.open) paintRanking();
    if (setDlg.open) paintSettings();
  }

  /* ---------- 4. Dialoge ---------- */

  // Dialog schließen bei Tipp auf den abgedunkelten Hintergrund oder einen Knopf mit data-close
  document.addEventListener('click', (e) => {
    const dlg = e.target.closest('dialog');
    if (!dlg) return;
    if (e.target === dlg && !dlg.hasAttribute('data-modal')) dlg.close();
    else if (e.target.closest('[data-close]')) dlg.close();
  });

  /* Glückskeks: nächsten Spruch wählen (jeder nur einmal, danach beginnt die Liste von vorn) und die Auswahl merken.
     Gemerkt wird je Gerät in localStorage; ohne Speicher oder ohne Sprüche gibt es keinen Text (null). */
  function nextFortune() {
    let shown = [];
    try { const v = JSON.parse(lsGet(LS_MESSAGES)); if (Array.isArray(v)) shown = v.filter((id) => typeof id === 'string'); } catch { /* leer beginnen */ }
    const pick = G.pickMessage(db.messages, shown);
    if (pick.message) lsSet(LS_MESSAGES, JSON.stringify(pick.shownIds));
    return pick.message ? pick.message.text : null;
  }

  /* Hinzufügen: suchen → ausgegraute Karte (nur der Name) → Bestätigen → Karte dreht sich um.
     Gespeichert wird genau einmal, beim Bestätigen. Schließen vorher speichert nichts.
     Kategorie und Details stehen vor dem Bestätigen NICHT im Dokument (auch nicht versteckt). */
  const add = {
    dlg: $('#add'),
    step: 'search',  // 'search' | 'preview' | 'done'
    q: '',
    beerId: null,
    saved: false,    // Schutz gegen doppelte Einträge (Doppelklick, Enter-Wiederholung)
    result: null,    // { gain, levelUp, level, isNew, count, fortune }

    open() {
      KARTE.prepare(); // STANDORT-KARTE: Standort im Hintergrund holen (nur bei eingeschaltetem Schalter), bis das Bier bestätigt wird
      this.step = 'search'; this.q = ''; this.beerId = null; this.saved = false; this.result = null;
      this.dlg.innerHTML = `<div class="sheet-head"><h2>Bier hinzufügen</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div>
        <div class="sheet-body add-body"></div>`;
      this.paint();
      this.dlg.showModal();
      this.focusSearch();
    },
    focusSearch() { const i = $('#add-q', this.dlg); if (i) i.focus(); },

    paint() {
      const body = $('.add-body', this.dlg);
      if (!body) return;
      if (this.step === 'search') {
        body.innerHTML = `<label class="search-field"><span class="sr-only">Bier oder Brauerei suchen</span>
            <input id="add-q" type="search" placeholder="Bier oder Brauerei suchen …" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(this.q)}"></label>
          <div id="add-results" class="results"></div>`;
        this.paintResults();
        return;
      }
      const beer = db.map.get(this.beerId);
      if (!beer) { this.step = 'search'; this.paint(); return; }
      const done = this.step === 'done';
      const r = this.result;
      body.innerHTML = `<div class="flip">
          <div class="flip-inner">
            <div class="face back"><div class="bcard hidden-card">${BOTTLE}<span class="title">${esc(beer.name)}</span><span class="ask">?</span></div></div>
            ${done ? `<div class="face front">${cardHtml({ beer, count: r.count })}</div>` : ''}
          </div>
        </div>
        ${done ? `<div class="reveal-info" role="status">
            <p class="gain">+${G.fmt1(r.gain)} Punkte</p>
            ${r.levelUp ? `<p class="levelup">Level ${r.level} erreicht!</p>` : ''}
            ${r.isNew ? '<p class="new">Neu in deiner Sammlung</p>' : ''}
          </div>
          ${r.fortune ? `<p class="fortune">${esc(r.fortune)}</p>` : ''}
          <div class="actions"><button class="btn primary" type="button" data-close>Fertig</button></div>`
        : `<p class="note center">Ist das dein Bier?</p>
          <div class="actions">
            <button class="btn ghost" type="button" data-add="again">Anderes Bier wählen</button>
            <button class="btn primary" type="button" data-add="confirm">Bestätigen</button>
          </div>`}`;
      if (done) {
        // Umdrehen erst im nächsten Bild, damit die Drehung als Übergang sichtbar ist
        const flip = $('.flip', body);
        requestAnimationFrame(() => requestAnimationFrame(() => flip.classList.add('revealed')));
        $('.actions .btn', body).focus({ preventScroll: true });
      } else {
        $('[data-add="confirm"]', body).focus({ preventScroll: true });
      }
    },

    // Nur die Trefferliste neu zeichnen; das Suchfeld bleibt unangetastet (Fokus und Cursor bleiben)
    paintResults() {
      const box = $('#add-results', this.dlg);
      if (!box) return;
      if (db.error) { box.innerHTML = '<p class="note">Die Bierdatenbank konnte nicht geladen werden.</p>'; return; }
      if (!db.ready) { box.innerHTML = '<div class="loading" role="status"><span class="spinner"></span>Biere werden geladen …</div>'; return; }
      const q = this.q.trim();
      let list;
      let head = '';
      if (!q) {
        list = summary.cards.slice().sort((a, b) => b.last - a.last).slice(0, RECENT_MAX).map((c) => c.beer);
        if (!list.length) { box.innerHTML = '<p class="note">Tippe den Namen des Biers oder der Brauerei ein, z. B. „Augustiner Hell“.</p>'; return; }
        head = '<h3 class="results-head">Zuletzt getrunken</h3>';
      } else if (q.length < 2) {
        box.innerHTML = '<p class="note">Noch ein Zeichen …</p>';
        return;
      } else {
        list = G.search(db.index, q, 10);
        if (!list.length) { box.innerHTML = '<p class="note">Kein Bier gefunden. Versuche es mit weniger oder anderen Wörtern.</p>'; return; }
      }
      // Treffer zeigen Name, Brauerei, Flaschengröße und Alkohol, aber keine Kategorie (Überraschung)
      box.innerHTML = head + `<ul class="hits">${list.map((b) => {
        const sub = [b.company.name, G.fmtLiter(b.flasche), G.fmtAlc(b.alc)].filter(Boolean).join(' · ');
        return `<li><button class="hit" type="button" data-pick="${esc(b.id)}"><span class="hit-name">${esc(b.name)}</span>${sub ? `<span class="hit-sub">${esc(sub)}</span>` : ''}</button></li>`;
      }).join('')}</ul>`;
    },

    pick(id) {
      if (!db.map.has(id)) return;
      this.beerId = id;
      this.step = 'preview';
      this.paint();
    },

    confirm() {
      if (this.saved || this.step !== 'preview') return;
      const beer = db.map.get(this.beerId);
      if (!beer) return;
      this.saved = true; // ab hier wird für diesen Dialog nichts mehr gespeichert
      // Stand VOR dem Speichern festhalten (im Firebase-Modus kommt der neue Stand erst kurz danach per Snapshot)
      const before = summary.sum;
      const old = cardOf(beer.id);
      const gain = G.beerPoints(beer);
      // Zeitpunkt = Geräteuhr beim Bestätigen. Nicht auf den Server warten: Die Anzeige kommt aus dem lokalen Stand.
      STORE.add(beer.id, Date.now(), KARTE.place()); // STANDORT-KARTE: place() ist null, wenn aus oder kein Standort da
      this.result = { gain, isNew: !old, count: (old ? old.count : 0) + 1, level: G.level(before + gain), levelUp: G.level(before + gain) > G.level(before), fortune: nextFortune() };
      this.step = 'done';
      this.paint();
    },

    back() {
      this.step = 'search';
      this.beerId = null;
      this.paint();
      this.focusSearch();
    },
  };

  add.dlg.addEventListener('input', (e) => {
    if (e.target.id !== 'add-q') return;
    add.q = e.target.value;
    add.paintResults();
  });
  add.dlg.addEventListener('keydown', (e) => {
    // Enter im Suchfeld wählt den ersten Treffer
    if (e.key === 'Enter' && e.target.id === 'add-q') {
      e.preventDefault();
      const first = $('[data-pick]', add.dlg);
      if (first) add.pick(first.dataset.pick);
    }
  });
  add.dlg.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { add.pick(pick.dataset.pick); return; }
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    if (btn.dataset.add === 'confirm') { btn.disabled = true; add.confirm(); }
    else if (btn.dataset.add === 'again') add.back();
  });
  // Nach dem Schließen alles verwerfen; gespeichert wurde, wenn überhaupt, schon beim Bestätigen
  // Das close-Ereignis kommt verzögert; wurde der Dialog inzwischen neu geöffnet, bleibt er unangetastet.
  add.dlg.addEventListener('close', () => {
    if (add.dlg.open) return;
    add.dlg.innerHTML = ''; add.step = 'search'; add.beerId = null;
  });

  /* Große Kartenansicht: alle Angaben zum Bier und zur eigenen Sammlung.
     Fehlende Werte (null, leere Listen) werden weggelassen, nie als „null“ angezeigt. */
  const cardDlg = $('#card');
  let descOpen = false; // Beschreibung aufgeklappt? Bleibt beim Neuzeichnen (z. B. durch Sync) erhalten
  function openCard(id) {
    if (!db.map.has(id)) return;
    cardDlg.dataset.id = id;
    descOpen = false;
    paintCard();
    if (!cardDlg.open) cardDlg.showModal();
    $('.sheet-body', cardDlg).scrollTop = 0;
    tilt.start();
  }
  function paintCard() {
    const beer = db.map.get(cardDlg.dataset.id);
    const c = beer && cardOf(beer.id);
    // Karte gibt es nicht mehr (z. B. auf einem anderen Gerät gelöscht): Ansicht schließen
    if (!c) { if (cardDlg.open) cardDlg.close(); return; }
    const co = beer.company;
    const fact = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : '');
    const scroll = $('.sheet-body', cardDlg)?.scrollTop || 0;
    cardDlg.innerHTML = `<div class="sheet-head"><h2>${esc(beer.title)}</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div>
      <div class="sheet-body">
        <div class="card-view">${cardHtml(c)}</div>
        <dl class="facts mine">
          ${fact('Getrunken', `${c.count}-mal`)}
          ${fact('Gesammelte Punkte', G.fmt1(c.points))}
          ${fact(c.count > 1 ? 'Zuerst getrunken' : 'Getrunken am', fmtWhen.format(new Date(c.first)))}
          ${c.count > 1 ? fact('Zuletzt getrunken', fmtWhen.format(new Date(c.last))) : ''}
        </dl>
        <h3>Über das Bier</h3>
        <dl class="facts">
          ${fact('Name', beer.name)}
          ${fact('Kategorie', beer.label)}
          ${fact(beer.sorten.length > 1 ? 'Sorten' : 'Sorte', beer.sorten.join(' · '))}
          ${fact('Alkohol', G.fmtAlc(beer.alc))}
          ${fact('Flaschengröße', G.fmtLiter(beer.flasche))}
          ${fact(co.typ, co.name)}
          ${fact('Adresse', co.adresse)}
          ${fact('Region', co.region)}
          ${fact('Land', co.land)}
          ${fact('Zutaten', beer.zutaten ? beer.zutaten.join(', ') : '')}
        </dl>
        ${beer.beschreibung ? `<details class="desc"${descOpen ? ' open' : ''}><summary>Beschreibung</summary><p>${esc(beer.beschreibung)}</p></details>` : ''}
      </div>`;
    $('.sheet-body', cardDlg).scrollTop = scroll;
  }
  cardDlg.addEventListener('toggle', (e) => { if (e.target.matches('details.desc')) descOpen = e.target.open; }, true);
  cardDlg.addEventListener('close', () => { if (!cardDlg.open) { cardDlg.innerHTML = ''; delete cardDlg.dataset.id; } });

  /* Neigung und Holo-Glanz der großen Karte. Solange der Dialog offen ist, läuft pro Bild eine kleine Rechnung. Das Ziel der
     Neigung kommt, in dieser Reihenfolge, von: Maus oder Finger über der Karte (waagerecht ziehen; senkrechtes Wischen
     scrollt weiter) → Neigungssensor des Telefons → ein leichtes Schwanken von selbst, damit der Glanz auch ohne Berührung
     lebt. Die Karte folgt dem Ziel mit zeitabhängiger Glättung (gleich schnell auf 60 und 120 Hz) und hebt sich bei
     Berührung leicht an (--lift). Das Skript setzt nur CSS-Variablen (--rx/--ry Neigung, --mx/--my Lichtreflex, --fx/--fy
     Folie, --tx/--ty Verschiebung der Flasche, --lift); gezeichnet wird per CSS. Bei „weniger Bewegung“ bleibt alles ruhig.
     Der Dialog zeichnet sich bei Sync neu (innerHTML); die Schleife sucht die Karte deshalb in jedem Bild neu.
     Neigungssensor: Android liefert ihn ohne Nachfrage. iOS fragt einmal nach, und zwar beim ersten Antippen der Karte
     (nur auf Berührung hin erlaubt). Lehnt der Nutzer ab, wird nicht mehr gefragt (LS_MOTION). */
  const tilt = (() => {
    const MAX = 15;       // größte Neigung in Grad
    const HAND = 30;      // Handneigung in Grad, die die volle Kartenneigung ergibt
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const s = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, amp: 0.4, touched: false, raf: 0, last: 0 };
    const g = { b0: null, g0: null, tx: 0.5, ty: 0.5, at: -1e9, asked: false };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    function frame(now) {
      s.raf = 0;
      if (!cardDlg.open || document.hidden || calm.matches) { s.last = 0; return; }
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0.016;
      s.last = now;
      const el = cardDlg.querySelector('.card-view .bcard');
      if (el) {
        if (!s.touched) {
          if (now - g.at < 800) { s.tx = g.tx; s.ty = g.ty; } else {
            const t = now / 1000;
            s.tx = 0.5 + 0.3 * Math.sin(t * 0.7);
            s.ty = 0.42 + 0.22 * Math.sin(t * 0.53 + 1.3);
          }
        }
        const k = 1 - Math.exp(-dt * 8);
        s.x += (s.tx - s.x) * k;
        s.y += (s.ty - s.y) * k;
        s.amp += ((s.touched || now - g.at < 800 ? 1 : 0.4) - s.amp) * (1 - Math.exp(-dt * 5));
        const nx = (s.x - 0.5) * 2, ny = (s.y - 0.5) * 2;
        const set = (name, v) => el.style.setProperty(name, v);
        set('--rx', `${(-ny * MAX * s.amp).toFixed(2)}deg`);
        set('--ry', `${(nx * MAX * s.amp).toFixed(2)}deg`);
        set('--mx', `${(s.x * 100).toFixed(1)}%`);
        set('--my', `${(s.y * 100).toFixed(1)}%`);
        set('--fx', s.x.toFixed(3));
        set('--fy', s.y.toFixed(3));
        set('--tx', (-nx).toFixed(3));
        set('--ty', (-ny).toFixed(3));
        set('--lift', ((s.amp - 0.4) / 0.6).toFixed(3));
        el.classList.add('live');
      }
      s.raf = requestAnimationFrame(frame);
    }
    // Neigungssensor: nur Hochformat; die Ruhelage wandert langsam mit, damit jede Haltung des Telefons passt
    function onOrient(e) {
      if (!cardDlg.open || calm.matches || e.beta == null || e.gamma == null) return;
      if (screen.orientation && screen.orientation.angle) return;
      if (g.b0 === null) { g.b0 = e.beta; g.g0 = e.gamma; }
      const t = performance.now();
      const k = 1 - Math.exp(-(t - g.at > 1000 ? 0.016 : (t - g.at) / 1000) / 4); // Ruhelage folgt mit ca. 4 s Zeitkonstante
      g.b0 += (e.beta - g.b0) * k;
      g.g0 += (e.gamma - g.g0) * k;
      g.tx = 0.5 + clamp(e.gamma - g.g0, -HAND, HAND) / (HAND * 2);
      g.ty = 0.5 + clamp(e.beta - g.b0, -HAND, HAND) / (HAND * 2);
      g.at = t;
    }
    async function enableMotion() {
      if (g.asked || typeof DeviceOrientationEvent === 'undefined' || lsGet(LS_MOTION) === '0') return;
      g.asked = true;
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          if (await DeviceOrientationEvent.requestPermission() !== 'granted') { lsSet(LS_MOTION, '0'); return; }
        }
        window.addEventListener('deviceorientation', onOrient);
      } catch { g.asked = false; /* kein Sensor oder keine Geste: bleibt bei Finger/Maus, beim nächsten Antippen erneut */ }
    }
    function start() {
      g.b0 = null; s.last = 0;
      if (!s.raf && !calm.matches) s.raf = requestAnimationFrame(frame);
      // Ohne Nachfrage-Pflicht (Android, Desktop) sofort einschalten; iOS erst nach dem ersten Antippen
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') enableMotion();
    }
    function aim(e) {
      const cv = e.target instanceof Element && e.target.closest('.card-view');
      if (!cv) { s.touched = false; return; }
      const r = cv.getBoundingClientRect();
      s.tx = clamp((e.clientX - r.left) / r.width, 0, 1);
      s.ty = clamp((e.clientY - r.top) / r.height, 0, 1);
      s.touched = true;
    }
    const release = () => { s.touched = false; };
    cardDlg.addEventListener('pointermove', aim);
    cardDlg.addEventListener('pointerdown', aim);
    cardDlg.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      release();
      if (e.target instanceof Element && e.target.closest('.card-view')) enableMotion(); // Berührung = erlaubte Geste für die iOS-Nachfrage
    });
    cardDlg.addEventListener('pointercancel', release);
    cardDlg.addEventListener('pointerleave', release);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && cardDlg.open) start(); });
    return { start };
  })();

  /* Statistiken. Alle Zahlen kommen aus GAME.stats (aus dem Protokoll berechnet).
     Bewusst keine Tages-Serien oder andere Werte, die tägliches Trinken belohnen. */
  const statsDlg = $('#stats');
  function openStats() {
    paintStats();
    statsDlg.showModal();
    $('.sheet-body', statsDlg).scrollTop = 0;
  }
  const plural = (n, one, many) => `${G.fmtInt(n)} ${n === 1 ? one : many}`;
  function paintStats() {
    const scroll = $('.sheet-body', statsDlg)?.scrollTop || 0;
    const head = '<div class="sheet-head"><h2>Statistiken</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div>';
    if (!db.ready) {
      statsDlg.innerHTML = head + '<div class="sheet-body"><div class="loading" role="status"><span class="spinner"></span>Biere werden geladen …</div></div>';
      return;
    }
    const now = Date.now();
    const s = G.stats(drinks, db.map, now);
    const lvl = G.level(summary.sum);
    const nowYear = G.isoWeek(now).year;
    const kw = (w) => `KW ${w.week}${w.year === nowYear ? '' : `/${w.year}`}`;
    const tile = (value, label, sub = '') => `<div class="tile"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const fact = (label, value, sub = '') => (value ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}${sub ? ` <span class="sub">${esc(sub)}</span>` : ''}</dd></div>` : '');
    const times = (n) => `(${n}-mal)`;

    const tiles = tile(G.fmtInt(s.total), s.total === 1 ? 'Bier insgesamt' : 'Biere insgesamt')
      + tile(G.fmt1(s.avgPerWeek), 'Ø pro Woche', s.total ? `über ${plural(s.weeks, 'Woche', 'Wochen')}` : '')
      + tile(G.fmtInt(s.thisWeek), 'diese Woche')
      + tile(G.fmtInt(s.lastWeek), 'letzte Woche')
      + tile(s.bestWeek ? G.fmtInt(s.bestWeek.count) : '–', 'beste Woche', s.bestWeek ? kw(s.bestWeek) : '')
      + tile(G.fmt1(G.toNext(summary.sum)), `Punkte bis Level ${lvl + 1}`);

    // Balkendiagramm der letzten 12 Wochen (reines CSS). Höhe relativ zur höchsten Woche.
    const max = Math.max(1, ...s.history.map((h) => h.count));
    const bars = s.history.map((h, i) => {
      const label = `${kw(h)}: ${plural(h.count, 'Bier', 'Biere')}${i === s.history.length - 1 ? ' (diese Woche)' : ''}`;
      return `<li class="${i === s.history.length - 1 ? 'now' : ''}" title="${esc(label)}"><span class="sr-only">${esc(label)}</span>
          <span class="bar-val" aria-hidden="true">${h.count || ''}</span>
          <span class="bar" style="height:${((100 * h.count) / max).toFixed(1)}%" aria-hidden="true"></span>
          <span class="bar-kw" aria-hidden="true">${h.week}</span></li>`;
    }).join('');

    // Kategorien: seltenste zuerst, nur Namen (keine Stufenzahlen)
    const kats = [...G.STUFEN].reverse().filter((st) => db.kat[st]).map((st) => {
      const k = db.kat[st];
      const found = s.foundByStufe[st] || 0;
      return `<li class="k${st}"><span class="kat-name">${esc(k.name)}</span>
          <span class="kat-bar" aria-hidden="true"><span style="width:${found ? Math.max(1.5, (100 * found) / k.total).toFixed(2) : 0}%"></span></span>
          <span class="kat-num">${G.fmtInt(found)} / ${G.fmtInt(k.total)}</span></li>`;
    }).join('');

    const states = G.BUNDESLAENDER.map((st) => `<li class="${s.states.includes(st) ? 'on' : ''}">${esc(st)}${s.states.includes(st) ? '<span class="sr-only"> (entdeckt)</span>' : ''}</li>`).join('');

    const body = !s.total
      ? '<p class="note center">Noch keine Einträge. Sobald du dein erstes Bier eingetragen hast, erscheinen hier deine Zahlen.</p>'
      : `<div class="tiles">${tiles}</div>
        <h3>Letzte 12 Wochen</h3>
        <ol class="weeks" aria-label="Biere pro Woche in den letzten 12 Wochen">${bars}</ol>
        <h3>Sammlung</h3>
        <p class="stat-line"><b>${G.fmtInt(s.distinct)}</b> / ${G.fmtInt(db.list.length)} verschiedene Biere entdeckt</p>
        <ul class="kats">${kats}</ul>
        <h3>Vorlieben</h3>
        <dl class="facts">
          ${fact('Lieblingsbier', s.favBeer && s.favBeer.beer.name, s.favBeer && times(s.favBeer.count))}
          ${fact('Lieblingssorte', s.favSorte && s.favSorte.name, s.favSorte && times(s.favSorte.count))}
          ${fact('Lieblingsbrauerei', s.favCompany && s.favCompany.name, s.favCompany && times(s.favCompany.count))}
          ${fact('Lieblings-Wochentag', s.favDay && s.favDay.name, s.favDay && times(s.favDay.count))}
        </dl>
        <h3>Genuss</h3>
        <dl class="facts">
          ${fact('Ø Alkoholgehalt', s.avgAlc === null ? '' : `${G.fmt1(s.avgAlc)} %`)}
          ${fact('Liter insgesamt', `${G.fmt1(s.liter)} l`, s.noSize ? `(${plural(s.noSize, 'Bier', 'Biere')} ohne Größenangabe nicht mitgezählt)` : '')}
          ${fact('Anteil alkoholfrei', `${s.freePct} %`)}
        </dl>
        <h3>Bundesländer <span class="h-sub">${s.states.length} / 16 entdeckt</span></h3>
        <ul class="states">${states}</ul>
        <p class="note">Gezählt werden Biere deutscher Brauereien und Vertriebe nach ihrem Sitz.</p>`;
    statsDlg.innerHTML = `${head}<div class="sheet-body">${body}</div>`;
    $('.sheet-body', statsDlg).scrollTop = scroll;
  }
  statsDlg.addEventListener('close', () => { if (!statsDlg.open) statsDlg.innerHTML = ''; });

  /* STANDORT-KARTE: Karte aller Orte, an denen Biere eingetragen wurden (Zeichnen und Bedienung in js/karte.js).
     Die Punkte kommen aus GAME.placeGroups; beim Antippen eines Punktes zeigt describeDrink je Eintrag Bier und Zeit. */
  const mapDlg = $('#karte');
  let mapCtl = null;
  const fmtDay = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const describeDrink = (d) => {
    const b = db.map.get(d.beerId);
    return `${b ? b.name : 'Unbekanntes Bier'} · ${fmtDay.format(d.at)}`;
  };
  function openMap() {
    if (mapCtl) return;
    mapDlg.innerHTML = '<div class="sheet-head"><h2>Karte</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div><div class="sheet-body map-body"></div>';
    const emptyText = KARTE.enabled()
      ? 'Noch keine Orte. Ab dem nächsten Eintrag erscheint hier ein Punkt.'
      : 'Noch keine Orte. Schalte unter Einstellungen → Standort ein, dann erscheinen Punkte für neue Einträge.';
    mapCtl = KARTE.mount($('.map-body', mapDlg), { groups: G.placeGroups(drinks), describe: describeDrink, emptyText });
    mapDlg.showModal();
  }
  mapDlg.addEventListener('close', () => {
    if (mapDlg.open) return;
    if (mapCtl) mapCtl.destroy();
    mapCtl = null;
    mapDlg.innerHTML = '';
  });

  /* Platzierung. Die besten GAME.BOARD_SIZE Spieler live aus leaderboard/ (STORE.watchRanking), dazu der eigene Rang,
     falls man nicht darunter ist. Zeilen prüft und sortiert GAME.rankBoard; alle Namen gehen durch esc().
     Den eigenen Rang außerhalb der Besten liefert eine Zählabfrage beim Server (STORE.countAbove); ohne Netz
     steht dort „–“. Die eigene Zeile zeigt immer die lokal berechneten Werte. */
  const rankDlg = $('#ranking');
  const rank = { rows: null, fromCache: false, failed: false, own: null, unwatch: null, seq: 0 };

  function stopRanking() {
    rank.seq++; // laufende Zählabfrage verwerfen
    if (rank.unwatch) { rank.unwatch(); rank.unwatch = null; }
  }
  function openRanking() {
    stopRanking();
    Object.assign(rank, { rows: null, fromCache: false, failed: false, own: null });
    rank.unwatch = STORE.watchRanking((rows, meta) => {
      rank.rows = G.rankBoard(rows);
      rank.fromCache = !!meta.fromCache;
      rank.failed = false;
      findOwnRank();
      if (rankDlg.open) paintRanking();
    }, () => {
      rank.failed = true;
      if (rankDlg.open) paintRanking();
    });
    paintRanking();
    rankDlg.showModal();
    $('.sheet-body', rankDlg).scrollTop = 0;
  }
  // Steht man nicht unter den Besten, den Rang beim Server zählen lassen: 1 + Anzahl Spieler mit mehr Punkten
  function findOwnRank() {
    const uid = STORE.uid();
    if (!rank.rows || rank.rows.some((r) => r.uid === uid)) { rank.own = null; return; }
    const seq = ++rank.seq;
    rank.own = { state: 'loading' };
    STORE.countAbove(summary.sum).then(
      (n) => { if (seq === rank.seq) { rank.own = { state: 'ok', rank: n + 1 }; if (rankDlg.open) paintRanking(); } },
      () => { if (seq === rank.seq) { rank.own = { state: 'err' }; if (rankDlg.open) paintRanking(); } },
    );
  }
  function paintRanking() {
    const scroll = $('.sheet-body', rankDlg)?.scrollTop || 0;
    const head = '<div class="sheet-head"><h2>Platzierung</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div>';
    const wait = (text) => `<div class="loading" role="status"><span class="spinner"></span>${text}</div>`;
    let body;
    if (rank.failed) {
      body = '<p class="note center">Die Rangliste konnte nicht geladen werden. Prüfe die Verbindung und öffne das Fenster noch einmal.</p>';
    } else if (!rank.rows || (!rank.rows.length && rank.fromCache && navigator.onLine !== false)) {
      body = wait('Rangliste wird geladen …');
    } else {
      const uid = STORE.uid();
      const me = STORE.profile().username || '';
      const row = (r, mine, label = String(r.rank)) => `<tr class="${mine ? 'me' : ''}">
          <td class="pos"><span class="badge${r.rank <= 3 ? ` p${r.rank}` : ''}">${esc(label)}</span></td>
          <td class="nm">${esc('@' + r.username)}${mine ? ' <span class="you">(du)</span>' : ''}</td>
          <td class="num">${G.fmtInt(r.level)}</td>
          <td class="num">${G.fmtInt(r.count)}</td></tr>`;
      const own = rank.own;
      let ownRow = '';
      if (own) {
        const label = own.state === 'ok' ? String(own.rank) : own.state === 'err' ? '–' : '…';
        ownRow = `<tr class="gap" aria-hidden="true"><td colspan="4">⋯</td></tr>`
          + row({ rank: own.state === 'ok' ? own.rank : 99, username: me, level: G.level(summary.sum), count: drinks.length }, true, label);
      }
      const list = rank.rows.map((r) => row(r, r.uid === uid)).join('');
      const stale = rank.fromCache && navigator.onLine === false ? '<p class="note center">Keine Verbindung – das ist der zuletzt bekannte Stand.</p>' : '';
      const err = own && own.state === 'err' ? '<p class="note center">Dein Rang konnte gerade nicht ermittelt werden (keine Verbindung).</p>' : '';
      body = `${stale}${rank.rows.length ? `<table class="rank">
          <caption class="sr-only">Die besten ${G.BOARD_SIZE} Spieler nach Punkten</caption>
          <thead><tr><th class="pos" scope="col">Platz</th><th class="nm" scope="col">Spieler</th><th class="num" scope="col">Level</th><th class="num" scope="col">Biere</th></tr></thead>
          <tbody>${list}${ownRow}</tbody></table>` : '<p class="note center">Noch niemand in der Rangliste.</p>'}
        ${err}
        <p class="note">Es zählen die Punkte. Wer gleich viele hat, teilt sich den Platz; danach entscheidet die Zahl der Biere.
          Gezeigt werden die besten ${G.BOARD_SIZE} Spieler und dein eigener Rang. Die Rangliste enthält nur Spieler mit Benutzernamen.</p>`;
    }
    rankDlg.innerHTML = `${head}<div class="sheet-body">${body}</div>`;
    $('.sheet-body', rankDlg).scrollTop = scroll;
  }
  rankDlg.addEventListener('close', () => { if (!rankDlg.open) { stopRanking(); rankDlg.innerHTML = ''; } });

  /* Bestätigung vor dem Löschen. Gibt ein Promise<boolean> zurück.
     html: bereits mit esc() aufbereiteter Text. typeWord: Wort, das zur Bestätigung eingetippt werden muss.
     Der Fokus startet auf „Abbrechen“ (bzw. im Eingabefeld), damit Enter nicht versehentlich löscht. */
  const confirmDlg = $('#confirm');
  function confirmBox({ title, html, ok, typeWord = '' }) {
    // Nie zwei Bestätigungen gleichzeitig: sonst könnten beide auslösen und doppelt löschen
    if (confirmDlg.open || confirmDlg.dataset.busy) return Promise.resolve(false);
    confirmDlg.dataset.busy = '1';
    return new Promise((resolve) => {
      confirmDlg.innerHTML = `<div class="sheet-body">
          <h2>${esc(title)}</h2>
          <p>${html}</p>
          ${typeWord ? `<label class="type-word"><span>Zum Bestätigen <b>${esc(typeWord)}</b> eingeben</span>
            <input type="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done"></label>` : ''}
          <div class="actions">
            <button class="btn ghost" type="button" data-confirm="no">Abbrechen</button>
            <button class="btn danger" type="button" data-confirm="yes"${typeWord ? ' disabled' : ''}>${esc(ok)}</button>
          </div>
        </div>`;
      const yes = $('[data-confirm="yes"]', confirmDlg);
      const input = $('input', confirmDlg);
      const typed = () => !typeWord || (input.value.trim().toLocaleUpperCase('de') === typeWord);
      // Genau einmal entscheiden: per Knopf sofort; Esc oder Tipp auf den Hintergrund (close-Ereignis) = Abbrechen.
      // Die Entscheidung hängt bewusst nicht am close-Ereignis allein, das manche Umgebungen verzögert ausliefern.
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        confirmDlg.removeEventListener('click', onClick);
        confirmDlg.removeEventListener('close', onClose);
        if (confirmDlg.open) confirmDlg.close();
        confirmDlg.innerHTML = '';
        delete confirmDlg.dataset.busy;
        resolve(result);
      };
      const onClick = (e) => {
        const b = e.target.closest('[data-confirm]');
        if (b) finish(b.dataset.confirm === 'yes' && typed());
      };
      const onClose = () => finish(false);
      confirmDlg.addEventListener('click', onClick);
      confirmDlg.addEventListener('close', onClose);
      if (input) input.addEventListener('input', () => { yes.disabled = !typed(); });
      confirmDlg.showModal();
      (input || $('[data-confirm="no"]', confirmDlg)).focus();
    });
  }

  /* Einstellungen. Das Gerüst wird beim Öffnen einmal gezeichnet; danach werden nur einzelne Bereiche
     (Benutzername, Sammlung) aktualisiert, damit Eingaben im Filter- oder Namensfeld nicht verloren gehen. */
  const setDlg = $('#settings');
  const set = { filter: '', nameMsg: '', nameMsgKind: '', shownName: '' };
  const fmtPoints = (tenths) => `${G.fmt1(tenths)} ${tenths === 10 ? 'Punkt' : 'Punkte'}`;

  function openSettings() {
    set.filter = ''; set.nameMsg = ''; set.nameMsgKind = '';
    const theme = currentTheme();
    const radio = (value, label) => `<label class="seg-opt"><input type="radio" name="theme" value="${value}"${theme === value ? ' checked' : ''}><span>${label}</span></label>`;
    const account = STORE.mode === 'firebase'
      ? `<section class="set-sec"><h3>Konto</h3><div id="set-account"></div></section>`
      : '';
    // STANDORT-KARTE: Schalter „Standort beim Eintragen speichern“ (standardmäßig aus); ohne Standort-Unterstützung entfällt der Abschnitt
    const standort = KARTE.supported() ? `<section class="set-sec"><h3>Standort</h3>
          <label class="check-row"><input type="checkbox" id="set-geo"${KARTE.enabled() ? ' checked' : ''}><span>Standort beim Eintragen speichern</span></label>
          <p class="note" id="set-geo-msg" role="status" aria-live="polite"></p>
          <p class="note">Ist der Schalter an, merkt sich die App bei jedem neuen Eintrag, wo du gerade bist (auf etwa 100 m gerundet), und zeigt die Orte
            als Punkte auf der Karte. Nur du siehst sie; die Rangliste bekommt keine Orte. Ohne Erlaubnis oder ohne Signal wird der Eintrag ohne Ort
            gespeichert. Ältere Einträge haben keinen Ort. Löschst du einen Eintrag oder setzt dein Profil zurück, verschwindet auch sein Ort.</p>
        </section>` : '';
    setDlg.innerHTML = `<div class="sheet-head"><h2>Einstellungen</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div>
      <div class="sheet-body">
        <section class="set-sec"><h3>Benutzername</h3><div id="set-name"></div></section>
        <section class="set-sec">
          <details class="set-details" id="set-coll-box"><summary>Sammlung verwalten <span class="h-sub" id="set-coll-count"></span></summary>
            <label class="search-field"><span class="sr-only">Sammlung filtern</span>
              <input type="search" id="set-filter" placeholder="Filtern …" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
            <ul class="coll" id="set-coll"></ul>
          </details>
        </section>
        <section class="set-sec">
          <details class="set-details"><summary>Spielanleitung</summary><div class="howto">${howtoHtml()}</div></details>
        </section>
        <section class="set-sec"><h3>Darstellung</h3>
          <div class="seg" role="radiogroup" aria-label="Darstellung">${radio('system', 'System')}${radio('light', 'Hell')}${radio('dark', 'Dunkel')}</div>
        </section>
        ${standort}
        ${account}
        <section class="set-sec"><h3>Profil zurücksetzen</h3>
          <p class="note">Löscht alle Einträge${STORE.mode === 'firebase' ? ' und gibt deinen Benutzernamen frei' : ''}. Punkte, Level und Sammlung beginnen wieder bei null.</p>
          <button class="btn danger-ghost" type="button" data-set="reset">Profil zurücksetzen …</button>
        </section>
        <section class="set-sec responsible">
          <p><b>Saufen, Saufen und Saufen</b> Trink nie, um Punkte zu sammeln, sondern nur, um zu Genießen.
            Bier Sammler ist nur für Personen ab 18 Jahren.</p>
        </section>
        <p class="legal"><a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></p>
      </div>`;
    paintSettings();
    setDlg.showModal();
    $('.sheet-body', setDlg).scrollTop = 0;
    $('.close', setDlg).focus();
  }

  // Aktualisiert die veränderlichen Teile (nach jeder Änderung am Protokoll oder Profil)
  function paintSettings() {
    paintName();
    paintCollection();
    paintAccount();
  }

  function paintName() {
    const box = $('#set-name', setDlg);
    if (!box) return;
    const p = STORE.profile();
    if (STORE.mode !== 'firebase') {
      box.innerHTML = `<p class="note">Du spielst anonym. Benutzernamen gibt es, sobald die App mit Anmeldung läuft;
        im lokalen Modus liegen alle Daten nur in diesem Browser.</p>`;
      return;
    }
    // Das Eingabefeld bleibt bestehen, wenn es schon da ist (angefangene Eingabe und Fokus bleiben erhalten)
    if (!$('#set-username', box)) {
      box.innerHTML = `<form class="name-form" id="set-name-form" novalidate>
          <label class="search-field"><span class="sr-only">Benutzername</span>
            <input id="set-username" name="username" type="text" maxlength="20" placeholder="z. B. hopfen_held" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" value="${esc(p.username || '')}"></label>
          <button class="btn primary" type="submit">Speichern</button>
        </form>
        <p class="name-msg" id="set-name-msg" role="status" aria-live="polite"></p>
        <p class="note">3–20 Zeichen: Buchstaben a–z, Ziffern und Unterstrich. Groß- und Kleinschreibung darfst du mischen;
          jeder Name ist nur einmal vergeben, egal wie geschrieben. Ohne Namen spielst du anonym; mit einem Namen kannst du später an der Rangliste teilnehmen.</p>`;
      set.shownName = p.username || '';
    }
    // Gespeicherter Name hat sich geändert (Zurücksetzen, anderes Gerät): Feld nachziehen, außer es wird gerade bearbeitet
    const field = $('#set-username', box);
    if ((p.username || '') !== set.shownName) {
      if (document.activeElement !== field) field.value = p.username || '';
      set.shownName = p.username || '';
    }
    const msg = $('#set-name-msg', box);
    msg.textContent = set.nameMsg;
    msg.className = `name-msg ${set.nameMsgKind}`;
  }

  function paintCollection() {
    const list = $('#set-coll', setDlg);
    if (!list) return;
    $('#set-coll-count', setDlg).textContent = `(${G.fmtInt(summary.cards.length)})`;
    if (!summary.cards.length) { list.innerHTML = '<li class="note">Noch keine Karten gesammelt.</li>'; return; }
    const q = set.filter.trim();
    const byName = (a, b) => a.beer.name.localeCompare(b.beer.name, 'de');
    let cards;
    if (G.fold(q).replace(/ /g, '').length >= 2) {
      const hits = G.search(G.buildIndex(summary.cards.map((c) => c.beer)), q, Infinity);
      cards = hits.map((b) => cardOf(b.id));
    } else {
      cards = summary.cards.slice().sort(byName);
    }
    if (!cards.length) { list.innerHTML = '<li class="note">Keine Karte passt zum Filter.</li>'; return; }
    list.innerHTML = cards.map((c) => `<li class="${c.beer.look}">
        <span class="coll-name"><span class="coll-title">${esc(c.beer.name)}</span>
          <span class="coll-sub">${esc(c.beer.label)} · Lvl ${c.count}${c.beer.flasche ? ` · ${esc(G.fmtLiter(c.beer.flasche))}` : ''}</span></span>
        <span class="coll-btns">
          <button class="btn small" type="button" data-set="minus" data-id="${esc(c.beer.id)}" aria-label="${esc(`Letzten Eintrag von ${c.beer.name} löschen`)}">−1</button>
          <button class="btn small danger-ghost" type="button" data-set="delete" data-id="${esc(c.beer.id)}" aria-label="${esc(`Karte ${c.beer.name} löschen`)}">Karte löschen</button>
        </span>
      </li>`).join('');
  }

  function paintAccount() {
    const box = $('#set-account', setDlg);
    if (!box) return;
    const p = STORE.profile();
    box.innerHTML = `<p class="note">Angemeldet mit Google${p.email ? ` als ${esc(p.email)}` : ''}. Beim Abmelden wird die Kopie deiner Daten auf diesem Gerät gelöscht;
        deine Sammlung bleibt im Konto gespeichert.</p>
      <button class="btn" type="button" data-set="signout">Abmelden</button>
      <p class="note del-note"><b>Konto löschen:</b> Entfernt dein Konto samt Sammlung, Benutzernamen und Platz in der Rangliste endgültig vom Server.</p>
      <button class="btn danger-ghost" type="button" data-set="deleteaccount">Konto löschen …</button>`;
  }

  function howtoHtml() {
    const kats = G.STUFEN.filter((st) => db.kat && db.kat[st])
      .map((st) => `<li class="k${st}"><span class="dot" aria-hidden="true"></span>${esc(db.kat[st].name)} <span class="h-sub">${fmtPoints(G.pointsFor(st))} pro Bier</span></li>`).join('');
    return `<p><b>So geht’s:</b> Tippe nach jedem Bier auf <b>+</b>, suche es und bestätige. Die Karte wird aufgedeckt –
        erst dann siehst du, wie selten dein Bier ist. Jedes Trinken zählt einzeln; das Level der Karte zeigt, wie oft (z. B. „Lvl 4“).</p>
      <p><b>Kategorien</b> von häufig bis sehr selten:</p>
      ${kats ? `<ul class="howto-kats">${kats}</ul>` : '<p class="note">Die Kategorien erscheinen, sobald die Bierdatenbank geladen ist.</p>'}
      <p>Ein neues Bier bringt keine Extrapunkte – es zählt nur seine Kategorie.</p>
      <p><b>Level:</b> 10 Punkte ergeben ein Level. Du startest bei Level 1; Punkte über 10 werden ins nächste Level mitgenommen.
        Der Ring oben rechts zeigt den Fortschritt im aktuellen Level. Löschst du Einträge, sinken die Punkte und notfalls auch das Level.</p>
      <p><b>Kein Nachtragen:</b> Ein Bier zählt mit dem Zeitpunkt, an dem du es bestätigst. Ein Datum lässt sich nicht auswählen.</p>`;
  }

  // Letzten Eintrag oder alle Einträge eines Biers löschen, jeweils nach Bestätigung mit Anzahl
  async function deleteFromCard(id, all) {
    const c = cardOf(id);
    if (!c) return;
    const name = `„${esc(c.beer.name)}“`;
    const p = G.beerPoints(c.beer);
    if (all) {
      const ok = await confirmBox({
        title: 'Karte löschen?',
        html: `${name}: ${c.count === 1 ? 'Der einzige Eintrag wird' : `Alle ${c.count} Einträge werden`} gelöscht (−${fmtPoints(p * c.count)}).
          Die Karte verschwindet aus deiner Sammlung. Das lässt sich nicht rückgängig machen.`,
        ok: c.count === 1 ? 'Karte löschen' : `${c.count} Einträge löschen`,
      });
      const now = cardOf(id); // kann sich in der Zwischenzeit (Sync) geändert haben
      if (ok && now) { STORE.remove(now.drinks); toast('Karte gelöscht'); }
    } else {
      const ok = await confirmBox({
        title: 'Letzten Eintrag löschen?',
        html: `${name}: Der zuletzt eingetragene von ${c.count} ${c.count === 1 ? 'Eintrag' : 'Einträgen'} wird gelöscht (−${fmtPoints(p)}).
          ${c.count === 1 ? 'Danach verschwindet die Karte aus deiner Sammlung.' : `Danach steht die Karte auf Lvl ${c.count - 1}.`}`,
        ok: '1 Eintrag löschen',
      });
      const now = cardOf(id);
      // Einträge sind nach Zeit sortiert: der letzte ist der jüngste
      if (ok && now) { STORE.remove([now.drinks[now.drinks.length - 1]]); toast('Eintrag gelöscht'); }
    }
  }

  async function resetProfile() {
    // Alle gespeicherten Einträge zählen, auch solche zu Bieren, die nicht (mehr) in der Datenbank stehen
    const n = STORE.drinks().length;
    if (!n && !STORE.profile().username) { toast('Es gibt nichts zurückzusetzen.'); return; }
    const ok = await confirmBox({
      title: 'Profil zurücksetzen?',
      html: `${n === 1 ? 'Der einzige Eintrag wird' : `Alle ${G.fmtInt(n)} Einträge werden`} gelöscht${STORE.mode === 'firebase' && STORE.profile().username ? ', dein Benutzername wird freigegeben' : ''}.
        Punkte, Level und Sammlung beginnen wieder bei null. Das lässt sich nicht rückgängig machen.`,
      ok: 'Endgültig zurücksetzen',
      typeWord: 'ZURÜCKSETZEN',
    });
    if (!ok) return;
    STORE.reset();
    toast('Profil zurückgesetzt');
  }

  async function saveUsername(form) {
    const input = form.elements.username;
    const name = input.value.trim();
    const say = (text, kind = '') => { set.nameMsg = text; set.nameMsgKind = kind; paintName(); };
    if (!G.usernameKey(name)) { say('Bitte 3–20 Zeichen verwenden: Buchstaben a–z, Ziffern oder _ (keine Umlaute, keine Leerzeichen).', 'err'); input.focus(); return; }
    if (name === (STORE.profile().username || '')) { say('Das ist schon dein Benutzername.'); return; }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    say('Wird gespeichert …');
    try {
      await STORE.setUsername(name);
      say(`Gespeichert: @${name}`, 'ok');
    } catch (err) {
      const text = {
        taken: 'Dieser Name ist schon vergeben. Bitte wähle einen anderen.',
        offline: 'Keine Verbindung. Einen Namen kannst du nur mit Internet wählen oder ändern.',
        invalid: 'Dieser Name ist nicht erlaubt (3–20 Zeichen: a–z, 0–9, _).',
        local: 'Im lokalen Modus gibt es keine Benutzernamen.',
      }[err && err.code] || 'Speichern hat nicht geklappt. Bitte später noch einmal versuchen.';
      if (!(err && err.code)) console.error(err);
      say(text, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  setDlg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    const act = b.dataset.set;
    if (act === 'minus' || act === 'delete') deleteFromCard(b.dataset.id, act === 'delete');
    else if (act === 'reset') resetProfile();
    else if (act === 'signout') signOutFlow();
    else if (act === 'deleteaccount') deleteAccountFlow();
  });
  setDlg.addEventListener('input', (e) => {
    if (e.target.id === 'set-filter') { set.filter = e.target.value; paintCollection(); }
  });
  // STANDORT-KARTE: Einschalten fragt sofort nach dem Standort (der Klick ist die Geste, die iOS dafür verlangt)
  async function toggleGeo(box) {
    const msg = $('#set-geo-msg', setDlg);
    const say = (text) => { if (msg) msg.textContent = text; };
    const on = box.checked;
    box.disabled = true;
    say(on ? 'Standort wird abgefragt …' : '');
    const r = await KARTE.setEnabled(on);
    box.disabled = false;
    if (!r.ok) {
      box.checked = false;
      say(r.reason === 'unsupported' ? 'Dieses Gerät oder dieser Browser kann keinen Standort bestimmen.'
        : 'Der Zugriff auf den Standort ist verweigert. Erlaube ihn in den Einstellungen deines Geräts und schalte dann wieder ein.');
    } else if (on) {
      say(r.note ? 'Eingeschaltet. Der Standort ließ sich gerade nicht bestimmen; die App versucht es beim nächsten Eintrag noch einmal.'
        : 'Eingeschaltet. Ab dem nächsten Eintrag wird der Ort gespeichert.');
    } else {
      say('Ausgeschaltet. Es wird nichts mehr gespeichert. Schon gespeicherte Orte bleiben bei ihren Einträgen.');
    }
    renderHeader(); // zeigt oder verbirgt den Knopf „Karte“
  }
  setDlg.addEventListener('change', (e) => {
    if (e.target.id === 'set-geo') { toggleGeo(e.target); return; }
    if (e.target.name === 'theme') {
      lsSet(LS_THEME, e.target.value === 'system' ? null : e.target.value);
      applyTheme(e.target.value);
    }
  });
  setDlg.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'set-name-form') saveUsername(e.target);
  });
  setDlg.addEventListener('close', () => { if (!setDlg.open) setDlg.innerHTML = ''; });

  /* Konto endgültig löschen (nur im Firebase-Modus, der Knopf steht unter „Konto“). Nach der Bestätigung mit Eintippen fragt Google
     noch einmal nach der Anmeldung (Pflicht für das Löschen), dann wird alles gelöscht und die Seite lädt neu (siehe STORE.deleteAccount). */
  let deletingAccount = false;
  async function deleteAccountFlow() {
    if (deletingAccount || STORE.mode !== 'firebase') return;
    const n = STORE.drinks().length;
    const ok = await confirmBox({
      title: 'Konto endgültig löschen?',
      html: `Dein Konto wird gelöscht, samt ${n === 0 ? 'allen gespeicherten Daten' : `${n === 1 ? 'dem einzigen Eintrag' : `allen ${G.fmtInt(n)} Einträgen`} und deiner Sammlung`}${STORE.profile().username ? ', deinem Benutzernamen und deinem Platz in der Rangliste' : ''}.
        Das lässt sich nicht rückgängig machen. Du brauchst dafür Internet und musst dich gleich noch einmal bei Google bestätigen.`,
      ok: 'Konto endgültig löschen',
      typeWord: 'LÖSCHEN',
    });
    if (!ok) return;
    deletingAccount = true;
    toast('Konto wird gelöscht …');
    try {
      await STORE.deleteAccount();
      // Erfolg: STORE meldet ab und lädt die Seite neu; dort erscheint „Konto gelöscht“
    } catch (err) {
      const text = {
        offline: 'Keine Verbindung. Zum Löschen brauchst du Internet. Es wurde nichts gelöscht.',
        cancelled: 'Abgebrochen. Dein Konto wurde nicht gelöscht.',
        popup: 'Das Anmeldefenster wurde blockiert. Bitte Popups erlauben und noch einmal versuchen.',
        mismatch: 'Bitte mit demselben Google-Konto bestätigen. Es wurde nichts gelöscht.',
        partial: 'Deine Daten sind gelöscht, das Konto selbst ließ sich aber noch nicht entfernen. Bitte noch einmal versuchen.',
      }[err && err.code] || 'Löschen hat nicht geklappt. Bitte später noch einmal versuchen.';
      if (!(err && err.code)) console.error(err);
      toast(text);
    } finally {
      deletingAccount = false;
    }
  }

  async function signOutFlow() {
    if (STORE.pending()) {
      const ok = await confirmBox({
        title: 'Noch nicht synchronisiert',
        html: 'Einige Einträge sind noch nicht beim Server angekommen (keine Verbindung). Meldest du dich jetzt ab, gehen sie verloren.',
        ok: 'Trotzdem abmelden',
      });
      if (!ok) return;
    }
    STORE.signOut();
  }

  // Einmaliger Hinweis beim ersten Start; lässt sich nur über den Knopf schließen
  function showAgeNotice() {
    if (lsGet(LS_AGE) === '1') return;
    const dlg = $('#age');
    dlg.setAttribute('data-modal', '');
    dlg.innerHTML = `<div class="sheet-body">
        <h2>Nur für Personen ab 18 Jahren</h2>
        <p>Bier Sammler ist ein Spiel rund um Bier und richtet sich ausschließlich an Erwachsene.
          Bitte genieße verantwortungsvoll.</p>
        <div class="actions"><button class="btn primary" type="button" data-act="age-ok">Ich bin mindestens 18 Jahre alt</button></div>
      </div>`;
    // Esc soll nicht schließen. Chrome lässt das Verhindern ohne vorherige Nutzeraktion nicht immer zu,
    // deshalb wird der Hinweis nach einem Schließen ohne Bestätigung sofort wieder geöffnet.
    // ok steht zusätzlich im Speicher, falls localStorage nicht verfügbar ist (dann erscheint der Hinweis beim nächsten Start erneut).
    let ok = false;
    dlg.addEventListener('cancel', (e) => e.preventDefault());
    dlg.addEventListener('close', () => { if (!ok) dlg.showModal(); });
    $('[data-act="age-ok"]', dlg).addEventListener('click', () => { ok = true; lsSet(LS_AGE, '1'); dlg.close(); maybeWelcome(); });
    dlg.showModal();
  }

  /* Willkommensfenster mit den wichtigsten Regeln: einmal je Konto und Gerät, direkt nach der ersten Anmeldung
     (im lokalen Modus nach dem Altershinweis). Es gilt als gesehen, sobald es geöffnet wurde. Der Hinweis, dass für die
     Platzierung ein Benutzername nötig ist, steht nur im Firebase-Modus (lokal gibt es weder Namen noch Rangliste). */
  const welcomeDlg = $('#welcome');
  function maybeWelcome() {
    if (locked || welcomeDlg.open) return;
    if ($('#age').open) return; // der Altershinweis kommt zuerst; sein Knopf ruft maybeWelcome() erneut auf
    const who = STORE.uid() || 'local';
    const seen = (lsGet(LS_WELCOME) || '').split(',');
    if (seen.includes(who)) return;
    lsSet(LS_WELCOME, seen.filter(Boolean).concat(who).join(','));
    showWelcome();
  }
  function showWelcome() {
    const online = STORE.mode === 'firebase';
    const lo = G.fmt1(G.pointsFor(1)), hi = fmtPoints(G.pointsFor(G.MAX_STUFE));
    welcomeDlg.innerHTML = `<div class="sheet-head"><h2>Willkommen bei Bier Sammler</h2><button class="close" type="button" data-close aria-label="Schließen">×</button></div>
      <div class="sheet-body welcome">
        <p>Das sind die wichtigsten Regeln:</p>
        <ul class="rules">
          <li><b>Sammeln:</b> Tippe nach jedem getrunkenen Bier auf <b>+</b>, suche es und bestätige. Die Karte wird aufgedeckt – erst dann siehst du, wie selten dein Bier ist.</li>
          <li><b>Punkte:</b> Je nach Kategorie bringt ein Bier ${esc(lo)} (häufig) bis ${esc(hi)} (sehr selten). Ein neues Bier bringt keine Extrapunkte.</li>
          <li><b>Level:</b> Schon ${G.LEVEL_POINTS / 10} Punkte ergeben ein Level. Der Ring oben rechts zeigt deinen Fortschritt.</li>
          <li><b>Kein Nachtragen:</b> Ein Bier zählt mit dem Zeitpunkt, an dem du es bestätigst.</li>
          <li><b>Verantwortung:</b> Trink nie, um Punkte zu sammeln, und nie, wenn du noch fahren musst.</li>
        </ul>
        ${online ? `<p class="welcome-name"><b>Wichtig:</b> Um an der Platzierung (Rangliste) teilzunehmen, musst du dir einen <b>Benutzernamen</b> erstellen.
            Das geht unter Einstellungen (Zahnrad oben rechts) → Benutzername. Ohne Namen spielst du anonym und erscheinst nicht in der Rangliste.</p>` : ''}
        <div class="actions">
          ${online ? '<button class="btn primary" type="button" data-welcome="name">Benutzernamen erstellen</button>' : ''}
          <button class="btn${online ? '' : ' primary'}" type="button" data-close>Verstanden</button>
        </div>
      </div>`;
    welcomeDlg.showModal();
    $('.sheet-body', welcomeDlg).scrollTop = 0;
    $('.close', welcomeDlg).focus();
  }
  welcomeDlg.addEventListener('click', (e) => {
    if (!e.target.closest('[data-welcome="name"]')) return;
    welcomeDlg.close();
    openSettings();
    const field = $('#set-username', setDlg);
    if (field) field.focus();
  });
  welcomeDlg.addEventListener('close', () => { if (!welcomeDlg.open) welcomeDlg.innerHTML = ''; });

  /* Kurzer Hinweis unten. Als Popover liegt er in der obersten Ebene und ist damit auch über offenen
     Dialogen sichtbar (z. B. „Eintrag gelöscht“ in den Einstellungen). Ohne Popover-Unterstützung: normales Element. */
  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    const pop = typeof el.showPopover === 'function';
    const hide = () => { if (pop) { if (el.matches(':popover-open')) el.hidePopover(); } else el.hidden = true; };
    hide();
    el.textContent = text;
    if (pop) { el.hidden = false; el.showPopover(); } else el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hide, 4000);
  }

  /* ---------- 5. Bedienung ---------- */

  $('#main').addEventListener('click', (e) => {
    const card = e.target.closest('[data-open]');
    if (card) openCard(card.dataset.open);
  });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || locked) return;
    const act = el.dataset.act;
    if (act === 'add') add.open();
    else if (act === 'more') {
      moreOpen = !moreOpen;
      lsSet(LS_MORE, moreOpen ? '1' : '0');
      render();
    }
    else if (act === 'reload') location.reload();
    else if (act === 'stats') openStats();
    else if (act === 'map') openMap(); // STANDORT-KARTE
    else if (act === 'ranking') openRanking();
    else if (act === 'settings') openSettings();
  });

  /* ---------- 6. Anmeldesperre ---------- */

  // Im Firebase-Modus bleibt die App gesperrt, bis jemand angemeldet ist. Dann steht nur #gate im Dokument,
  // #main ist leer. Die Sperre ist eine Sichtsperre; den Schutz der Daten übernehmen die Firestore-Regeln.
  let locked = document.documentElement.classList.contains('locked');
  function setLocked(on) {
    locked = on;
    document.documentElement.classList.toggle('locked', on);
    if (on) {
      $('#main').innerHTML = '';
      document.querySelectorAll('dialog.sheet:not(#age)').forEach((d) => { if (d.open) d.close(); d.innerHTML = ''; });
    }
  }
  function renderGate() {
    const st = STORE.status();
    const head = '<img class="gate-logo" src="icons/icon-192.png" alt="" width="96" height="96"><h1 class="gate-title">Bier Sammler</h1>'
      + '<p class="gate-sub">Sammle jedes Bier als Karte, entdecke seltene Funde und steige im Level auf.</p>';
    $('#gate').innerHTML = st === 'out' ? head + '<button class="btn primary" type="button" data-auth="in">Mit Google anmelden</button>'
      : st === 'error' ? head + `<p>${esc(STORE.error() || 'Die Anmeldung ist gerade nicht erreichbar.')}</p><button class="btn" type="button" data-auth="retry">Neu laden</button>`
      : ''; // beim Verbinden leer, damit bei angemeldeten Personen nichts aufblitzt
  }
  function onStoreChange() {
    const st = STORE.status();
    const shouldLock = STORE.mode === 'firebase' && st !== 'in';
    if (shouldLock !== locked) setLocked(shouldLock);
    if (locked) renderGate(); else { render(); maybeWelcome(); }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-auth]');
    if (!b) return;
    if (b.dataset.auth === 'retry') { location.reload(); return; }
    // Anmeldung im Popup (wie in orga_app). Selbst geschlossene Popups sind kein Fehler.
    b.disabled = true;
    STORE.signIn().catch((err) => {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err && err.code)) {
        console.error('Anmeldung fehlgeschlagen', err);
        toast(err && err.code === 'auth/popup-blocked' ? 'Das Anmeldefenster wurde blockiert. Bitte Popups erlauben.' : 'Anmeldung fehlgeschlagen. Bitte noch einmal versuchen.');
      }
    }).finally(() => { b.disabled = false; });
  });

  /* ---------- 7. Service Worker (Start ohne Netz, siehe sw.js) ---------- */

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
    });
  }

  applyTheme(currentTheme());
  // Nach dem Löschen des Kontos lädt STORE die Seite neu und merkt sich das in sessionStorage
  try { if (sessionStorage.getItem('biersammler-deleted-v1')) { sessionStorage.removeItem('biersammler-deleted-v1'); toast('Dein Konto wurde gelöscht.'); } } catch { /* ohne Speicher keine Meldung */ }
  showAgeNotice();
  STORE.start(onStoreChange);
  loadBeers();
})();
