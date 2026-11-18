/* Bier Sammler – Oberfläche.
   Aufbau:
   1. Grundlagen (Hilfsfunktionen, Darstellung hell/dunkel)
   2. Zustand (Bierdatenbank laden, Protokoll, daraus berechnete Sammlung)
   3. Darstellung (Karte, Kopfleiste mit Level-Ring, Startseite)
   4. Dialoge (Hinzufügen mit Aufdecken, Kartenansicht, Statistiken, Einstellungen, Bestätigung, Altershinweis)
   5. Bedienung (Klicks)
   6. Anmeldesperre (gesteuert über den Status aus js/store.js)
   7. Service Worker registrieren
   Die Spiellogik steht als reine Funktionen in js/game.js (window.GAME),
   Speichern und Sync in js/store.js (window.STORE). */
(() => {
  'use strict';

  const G = window.GAME;
  const STORE = window.STORE;
  const LS_THEME = 'biersammler-theme-v1'; // 'light' | 'dark' | fehlt = System (auch im Inline-Skript in index.html)
  const LS_AGE = 'biersammler-age-v1';     // Altershinweis bestätigt
  const BEER_FILES = {
    main: 'Datensammlung/biere.json',
    manual: 'Datensammlung/biere_manuell.json',
    kategorien: 'Datensammlung/kategorien.json',
  };
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

  // Bierdatenbank aus biere.json und biere_manuell.json (zusammengeführt in js/game.js)
  const db = { list: [], map: new Map(), index: [], ready: false, error: false };
  // Aus dem Protokoll berechnet; wird vor jedem Zeichnen neu bestimmt, nie gespeichert
  let drinks = [];
  let summary = G.summarize([], db.map);
  function recompute() {
    drinks = db.ready ? G.normalizeDrinks(STORE.drinks(), db.map) : [];
    summary = G.summarize(drinks, db.map);
  }
  const cardOf = (beerId) => summary.cards.find((c) => c.beer.id === beerId) || null;

  /* Bierdateien einmal laden. Fehlt biere_manuell.json oder ist sie fehlerhaft, geht es ohne sie weiter
     (Warnung in der Konsole). Ohne biere.json kann die App nichts anzeigen. */
  async function loadBeers() {
    const get = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    };
    const optional = (url) => get(url).catch((err) => { console.warn(`${url} nicht lesbar, wird ignoriert:`, err.message); return []; });
    try {
      const [main, manual, kategorien] = await Promise.all([get(BEER_FILES.main), optional(BEER_FILES.manual), optional(BEER_FILES.kategorien)]);
      const r = G.mergeBeers(main, manual, kategorien, (text) => console.warn(text));
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

  const BOTTLE = '<svg class="bottle" viewBox="0 0 40 96" aria-hidden="true"><path d="M15 2h10v6h-1v16c0 4 9 9 9 22v42c0 3-2 6-5 6H12c-3 0-5-3-5-6V46c0-13 9-18 9-22V8h-1z"/><rect class="label" x="10" y="52" width="20" height="18" rx="3"/></svg>';

  /* Sammelkarte. c = { beer, count } aus GAME.summarize (count 0 = noch nicht gesammelt).
     Innerhalb eines <button> sind nur <span> erlaubt; deshalb besteht die Karte nur aus <span>-Elementen. */
  function cardInner(c) {
    const b = c.beer;
    const chips = [G.fmtAlc(b.alc), G.fmtLiter(b.flasche)].filter(Boolean);
    return `<span class="band"><span class="kat">${esc(b.kategorie)}</span></span>
      <span class="bcard-body">
        ${c.count ? `<b class="count" title="${c.count}-mal getrunken">×${c.count}</b>` : ''}
        ${BOTTLE}
        <span class="title">${esc(b.title)}</span>
        ${b.brand ? `<span class="brand">${esc(b.brand)}</span>` : ''}
        ${chips.length ? `<span class="chips">${chips.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
        ${b.sorten.length ? `<span class="sorte">${esc(b.sorten.join(' · '))}</span>` : ''}
      </span>`;
  }
  const cardHtml = (c) => `<div class="bcard k${c.beer.stufe}">${cardInner(c)}</div>`;
  // Karte im Raster der Startseite: Knopf, der die große Kartenansicht öffnet
  const cardButton = (c) => `<button class="bcard k${c.beer.stufe}" type="button" data-open="${esc(c.beer.id)}" data-focus="card:${esc(c.beer.id)}"
      aria-label="${esc(`${c.beer.name}, ${c.beer.kategorie}, ${c.count}-mal getrunken`)}">${cardInner(c)}</button>`;

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
          <p class="note">${G.fmtInt(db.list.length)} Biere warten darauf, entdeckt zu werden.</p>
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
    renderHeader();
    renderMain();
    if (keep) {
      const el = $(`#main [data-focus="${CSS.escape(keep)}"]`);
      if (el) el.focus({ preventScroll: true });
    }
    if (cardDlg.open) paintCard();
    if (statsDlg.open) paintStats();
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

  /* Hinzufügen: suchen → ausgegraute Karte (nur der Name) → Bestätigen → Karte dreht sich um.
     Gespeichert wird genau einmal, beim Bestätigen. Schließen vorher speichert nichts.
     Kategorie und Details stehen vor dem Bestätigen NICHT im Dokument (auch nicht versteckt). */
  const add = {
    dlg: $('#add'),
    step: 'search',  // 'search' | 'preview' | 'done'
    q: '',
    beerId: null,
    saved: false,    // Schutz gegen doppelte Einträge (Doppelklick, Enter-Wiederholung)
    result: null,    // { gain, levelUp, level, isNew }

    open() {
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
      const gain = G.pointsFor(beer.stufe);
      // Zeitpunkt = Geräteuhr beim Bestätigen. Nicht auf den Server warten: Die Anzeige kommt aus dem lokalen Stand.
      STORE.add(beer.id, Date.now());
      this.result = { gain, isNew: !old, count: (old ? old.count : 0) + 1, level: G.level(before + gain), levelUp: G.level(before + gain) > G.level(before) };
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
          ${fact('Kategorie', beer.kategorie)}
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
    const kats = [5, 4, 3, 2, 1].filter((st) => db.kat[st]).map((st) => {
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
        ${account}
        <section class="set-sec"><h3>Profil zurücksetzen</h3>
          <p class="note">Löscht alle Einträge${STORE.mode === 'firebase' ? ' und gibt deinen Benutzernamen frei' : ''}. Punkte, Level und Sammlung beginnen wieder bei null.</p>
          <button class="btn danger-ghost" type="button" data-set="reset">Profil zurücksetzen …</button>
        </section>
        <section class="set-sec responsible">
          <p><b>Verantwortungsvoll genießen.</b> Trink nie, um Punkte zu sammeln, und nie, wenn du noch fahren musst.
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
    list.innerHTML = cards.map((c) => `<li class="k${c.beer.stufe}">
        <span class="coll-name"><span class="coll-title">${esc(c.beer.name)}</span>
          <span class="coll-sub">${esc(c.beer.kategorie)} · ×${c.count}${c.beer.flasche ? ` · ${esc(G.fmtLiter(c.beer.flasche))}` : ''}</span></span>
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
      <button class="btn" type="button" data-set="signout">Abmelden</button>`;
  }

  function howtoHtml() {
    const kats = [1, 2, 3, 4, 5].filter((st) => db.kat && db.kat[st])
      .map((st) => `<li class="k${st}"><span class="dot" aria-hidden="true"></span>${esc(db.kat[st].name)} <span class="h-sub">${fmtPoints(G.pointsFor(st))} pro Bier</span></li>`).join('');
    return `<p><b>So geht’s:</b> Tippe nach jedem Bier auf <b>+</b>, suche es und bestätige. Die Karte wird aufgedeckt –
        erst dann siehst du, wie selten dein Bier ist. Jedes Trinken zählt einzeln; die Karte zeigt, wie oft (z. B. „×4“).</p>
      <p><b>Kategorien</b> von häufig bis sehr selten:</p>
      ${kats ? `<ul class="howto-kats">${kats}</ul>` : '<p class="note">Die Kategorien erscheinen, sobald die Bierdatenbank geladen ist.</p>'}
      <p>Ein neues Bier bringt keine Extrapunkte – es zählt nur seine Kategorie.</p>
      <p><b>Level:</b> 20 Punkte ergeben ein Level. Du startest bei Level 1; Punkte über 20 werden ins nächste Level mitgenommen.
        Der Ring oben rechts zeigt den Fortschritt im aktuellen Level. Löschst du Einträge, sinken die Punkte und notfalls auch das Level.</p>
      <p><b>Kein Nachtragen:</b> Ein Bier zählt mit dem Zeitpunkt, an dem du es bestätigst. Ein Datum lässt sich nicht auswählen.</p>`;
  }

  // Letzten Eintrag oder alle Einträge eines Biers löschen, jeweils nach Bestätigung mit Anzahl
  async function deleteFromCard(id, all) {
    const c = cardOf(id);
    if (!c) return;
    const name = `„${esc(c.beer.name)}“`;
    const p = G.pointsFor(c.beer.stufe);
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
          ${c.count === 1 ? 'Danach verschwindet die Karte aus deiner Sammlung.' : `Danach steht die Karte auf ×${c.count - 1}.`}`,
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
  });
  setDlg.addEventListener('input', (e) => {
    if (e.target.id === 'set-filter') { set.filter = e.target.value; paintCollection(); }
  });
  setDlg.addEventListener('change', (e) => {
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
    $('[data-act="age-ok"]', dlg).addEventListener('click', () => { ok = true; lsSet(LS_AGE, '1'); dlg.close(); });
    dlg.showModal();
  }

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
    if (locked) renderGate(); else render();
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
  showAgeNotice();
  STORE.start(onStoreChange);
  loadBeers();
})();
