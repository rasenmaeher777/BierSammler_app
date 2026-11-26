/* Bier Sammler – Speicherschicht (window.STORE).
   Eine Schnittstelle für beide Betriebsarten, damit js/app.js nicht wissen muss, wo die Daten liegen:
   - lokal:    leerer apiKey in js/firebase-config.js → Einträge nur in localStorage dieses Browsers
   - firebase: Google-Anmeldung, Cloud Firestore mit dauerhaftem Zwischenspeicher (IndexedDB)

   Gespeichert wird nur das Protokoll: ein Eintrag je getrunkenem Bier { id, beerId, at } (optional mit Ort: lat, lng, siehe unten).
   Punkte, Level, Sammlung und Statistiken berechnet js/app.js daraus (js/game.js), nichts davon wird gespeichert.

   Firestore (Regeln: firestore.rules):
     users/<uid>                 { username?, usernameKey? }   (optionale Felder fehlen, nie undefined/null)
     users/<uid>/drinks/<autoId> { beerId: "BS-000001", at: <Millisekunden, Ganzzahl>, lat?, lng? }
                                 lat/lng (STANDORT-KARTE): nur wenn die Person den Standort-Schalter eingeschaltet hat; auf 3 Nachkommastellen
                                 gerundet (rund 100 m); beide oder keiner
     usernames/<usernameKey>     { uid }                         (sorgt für eindeutige Namen)
     leaderboard/<uid>           { username, sum, count, cards } (Rangliste; nur mit Benutzernamen, siehe publishScore)
     sammlung/<uid>              { beers: { "<Bier-ID>": Anzahl } } (gesammelte Biere, für andere in der Platzierung sichtbar;
                                 nur mit Benutzernamen, siehe publishCollection; ohne Zeitpunkte und Orte)

   Schreibvorgänge werden NICHT abgewartet: Ihre Promises erfüllen sich erst nach Bestätigung durch den Server und
   hängen ohne Netz. Die Anzeige kommt sofort aus dem lokalen Snapshot; ohne Netz landen die Schreibvorgänge in der
   Warteschlange des dauerhaften Zwischenspeichers, überstehen das Schließen der App und werden später übertragen.

   Schnittstelle:
     start(onChange)    Laden beginnen; onChange() wird nach jeder Änderung aufgerufen
     drinks()           Rohdaten des Protokolls (js/app.js bereinigt sie mit GAME.normalizeDrinks)
     add(beerId, at, place)  einen Eintrag anlegen (sofort sichtbar, ohne auf den Server zu warten); place = { lat, lng } oder fehlt
     remove(ids)        Einträge löschen
     reset()            alle Einträge löschen und den Benutzernamen freigeben
     setUsername(name)  Promise; Fehler mit err.code: 'local' | 'invalid' | 'taken' | 'offline' | 'error'
     signIn()           Promise; Anmeldung mit Google (Popup)
     signOut()          Promise; abmelden, Kopie auf diesem Gerät löschen, Seite neu laden
     deleteAccount()    Promise; Konto endgültig löschen (erneute Google-Bestätigung, alle Daten, dann das Konto selbst), danach neu laden.
                        Fehler mit err.code: 'local' | 'offline' | 'cancelled' | 'popup' | 'mismatch' | 'partial' | 'error'
     status()           'local' | 'loading' | 'out' | 'in' | 'error'
     error()            Text zum Status 'error'
     pending()          true, solange Änderungen noch nicht beim Server angekommen sind
     profile()          { username?, usernameKey?, email? }
     profileReady()     true, sobald das Profil (Benutzername) sicher geladen ist; lokal immer true
     publishScore(sum, count, cards) Punkte (Zehntel), Anzahl Biere und Zahl der verschiedenen Karten für die Rangliste veröffentlichen (gebündelt, im Hintergrund)
     watchRanking(onData, onError)   die besten Plätze live lesen; gibt eine Funktion zum Beenden zurück
     countAbove(sum)    Promise<Anzahl Spieler mit mehr Punkten> (nur mit Server), für den eigenen Rang
     publishCollection(beers)        eigene Sammlung { Bier-ID: Anzahl } veröffentlichen (gebündelt, im Hintergrund; GAME.collectionCounts)
     loadCollection(uid)             Promise<{ Bier-ID: Anzahl } | null> (ungeprüft; null = noch nichts veröffentlicht)
     uid()              Kennung des angemeldeten Kontos oder null */
window.STORE = (() => {
  'use strict';

  const FIREBASE_SDK = '10.12.2'; // muss zu den modulepreload-Links in index.html und zu sw.js passen
  const cfg = window.FIREBASE_CONFIG || {};
  const MODE = cfg.apiKey ? 'firebase' : 'local';
  const LS_DRINKS = 'biersammler-drinks-v1'; // nur lokaler Modus
  const LS_OWNER = 'biersammler-uid-v1';     // Konto, dem der Zwischenspeicher auf diesem Gerät gehört
  const LS_BODY = 'biersammler-koerper-v1';  // ALKOHOL-AUSWERTUNG: Körperdaten (Geschlecht, Gewicht), von js/app.js geschrieben; hier nur zum Löschen
  const BATCH_MAX = 500;                      // Höchstzahl Vorgänge je Firestore-Batch
  const NAME_TIMEOUT = 10000;                 // ms; danach gilt der Server als nicht erreichbar
  const WATCHDOG_MS = 12000;                  // ms; so lange darf der Start der Anmeldung dauern, bevor eine Fehlermeldung statt der leeren Seite erscheint
  const SCORE_DELAY = 1500;                  // ms; Änderungen der Rangliste werden so lange gebündelt
  const DELETE_TIMEOUT = 30000;               // ms je Schritt beim Löschen des Kontos; danach gilt der Server als nicht erreichbar
  const SS_DELETED = 'biersammler-deleted-v1'; // sessionStorage: nach dem Neuladen „Konto gelöscht“ melden

  let onChange = () => {};
  const s = { status: MODE === 'local' ? 'local' : 'loading', error: '', drinks: [], pending: false, profile: {}, profileReady: false, score: null, coll: null, synced: false };
  const emit = () => onChange();
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const fail = (code, message) => Object.assign(new Error(message || code), { code });
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* Speicher nicht verfügbar */ } };
  // STANDORT-KARTE: Ortsfelder eines neuen Eintrags. Nochmals geprüft und gerundet (GAME.cleanPlace); ohne gültigen Ort kommt nichts dazu.
  const placeFields = (place) => {
    const c = place && window.GAME.cleanPlace(place.lat, place.lng);
    return c ? { lat: c.lat, lng: c.lng } : {};
  };

  /* ---------- Lokaler Modus ---------- */

  function loadLocal() {
    try { const v = JSON.parse(localStorage.getItem(LS_DRINKS)); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_DRINKS, JSON.stringify(s.drinks)); return true; } catch { return false; }
  }

  const local = {
    start() {
      s.drinks = loadLocal();
      // Änderungen aus einem anderen Tab desselben Browsers übernehmen
      window.addEventListener('storage', (e) => { if (e.key === LS_DRINKS) { s.drinks = loadLocal(); emit(); } });
      emit();
    },
    add(beerId, at, place) {
      const d = { id: newId(), beerId, at, ...placeFields(place) };
      s.drinks = s.drinks.concat(d);
      if (!saveLocal()) console.error('Speichern im Browser fehlgeschlagen');
      emit();
      return d;
    },
    remove(ids) {
      const drop = new Set(ids);
      s.drinks = s.drinks.filter((d) => !drop.has(d.id));
      saveLocal();
      emit();
    },
    reset() {
      s.drinks = [];
      lsSet(LS_DRINKS, null);
      emit();
    },
    // Benutzernamen brauchen den Server (Eindeutigkeit); im lokalen Modus gibt es keine
    setUsername() { return Promise.reject(fail('local', 'Benutzernamen gibt es nur mit Anmeldung')); },
    signIn() { return Promise.resolve(); },
    signOut() { return Promise.resolve(); },
    deleteAccount() { return Promise.reject(fail('local', 'Im lokalen Modus gibt es kein Konto')); },
    // Eine Rangliste gibt es nur mit Anmeldung
    publishScore() {},
    watchRanking(onData, onError) { onError(fail('local')); return () => {}; },
    countAbove() { return Promise.reject(fail('local')); },
    publishCollection() {},
    loadCollection() { return Promise.reject(fail('local')); },
    uid() { return null; },
  };

  /* ---------- Firebase ---------- */

  let fb = null;          // Funktionen aus den Firebase-Modulen
  let auth = null;
  let db = null;
  let user = null;
  let unsubs = [];        // laufende onSnapshot-Abos
  let scoreTimer = null;  // gebündeltes Veröffentlichen der Rangliste
  let lastScore = '';     // zuletzt veröffentlichter Stand („Name|Punkte|Anzahl|Karten“)
  let scoreWanted = '';   // Stand, für den gerade ein Timer läuft
  let deleting = false;   // Konto wird gerade gelöscht: nichts mehr in die Rangliste schreiben
  let collTimer = null;   // gebündeltes Veröffentlichen der Sammlung (sammlung/<uid>)
  let lastColl = '';      // zuletzt veröffentlichter Stand der Sammlung (JSON)
  let collWanted = '';    // Stand, für den gerade ein Timer läuft
  const stopListening = () => { unsubs.forEach((u) => u()); unsubs = []; };
  const drinksCol = () => fb.collection(db, 'users', user.uid, 'drinks');
  const failed = (text) => (err) => {
    console.error(text, err);
    s.status = 'error';
    s.error = err && err.code === 'permission-denied'
      ? 'Zugriff verweigert. Sind die Firestore-Regeln eingetragen? (siehe README)'
      : 'Verbindung zur Datenbank fehlgeschlagen.';
    emit();
  };
  // Schreibvorgänge laufen im Hintergrund; ein Fehler (z. B. abgelehnt durch die Regeln) wird nur protokolliert,
  // die Anzeige korrigiert sich über den nächsten Snapshot von selbst.
  const background = (p, what) => { p.catch((err) => console.error(`${what} fehlgeschlagen`, err)); };

  // Kopie der Daten auf diesem Gerät löschen (Firestore-Zwischenspeicher in IndexedDB) und neu laden.
  // Gelingt das Löschen nicht (z. B. weil die App noch in einem anderen Tab offen ist), wird trotzdem neu geladen.
  // newOwner: Konto, dem der (dann leere) Zwischenspeicher danach gehört; null nach dem Abmelden.
  async function wipeAndReload(newOwner) {
    try { await fb.terminate(db); await fb.clearIndexedDbPersistence(db); } catch (err) { console.warn('Zwischenspeicher konnte nicht gelöscht werden', err); }
    lsSet(LS_OWNER, newOwner); // auch bei Fehlschlag setzen, sonst würde nach dem Neuladen endlos weiter gelöscht
    lsSet(LS_DRINKS, null);
    lsSet(LS_BODY, null); // ALKOHOL-AUSWERTUNG: Geschlecht und Gewicht gehören zur Person, nicht zum Gerät
    location.reload();
  }

  function onUser(u) {
    stopListening();
    const before = user;
    user = u;
    s.drinks = [];
    s.pending = false;
    s.profile = {};
    s.profileReady = false;
    s.score = null;
    s.synced = false;
    clearTimeout(scoreTimer);
    lastScore = '';
    scoreWanted = '';
    s.coll = null;
    clearTimeout(collTimer);
    lastColl = '';
    collWanted = '';
    if (!u) {
      // Gerade abgemeldet (hier oder in einem anderen Tab): Kopie auf diesem Gerät löschen und neu laden.
      // Beim Start ohne Anmeldung bleibt LS_OWNER stehen, damit ein anderes Konto später erkannt wird.
      if (before) { wipeAndReload(null); return; }
      s.status = 'out';
      emit();
      return;
    }
    // Ein anderes Konto als zuletzt auf diesem Gerät (z. B. nach abgelaufener Anmeldung ohne Abmelden):
    // dessen Zwischenspeicher löschen, das neue Konto beginnt leer
    const owner = lsGet(LS_OWNER);
    if (owner && owner !== u.uid) { wipeAndReload(u.uid); return; }
    lsSet(LS_OWNER, u.uid);

    s.profile = { email: u.email || '' };
    s.status = 'loading'; // bis der erste Snapshot da ist (sonst blitzt kurz die leere Sammlung auf)
    emit();
    unsubs.push(fb.onSnapshot(drinksCol(), { includeMetadataChanges: true }, (snap) => {
      // Nur beerId, at (und lat/lng) übernehmen; die eigentliche Prüfung macht GAME.normalizeDrinks
      s.drinks = snap.docs.map((d) => { const v = d.data() || {}; return { id: d.id, beerId: v.beerId, at: v.at, lat: v.lat, lng: v.lng }; });
      s.pending = snap.metadata.hasPendingWrites;
      // Erst veröffentlichen, wenn der Server die Einträge bestätigt hat; ein unvollständiger Zwischenspeicher
      // (z. B. neues Gerät) würde sonst kurz zu niedrige Werte in die Rangliste schreiben
      s.synced = !snap.metadata.fromCache;
      s.status = 'in';
      emit();
      scheduleScore();
      scheduleColl();
    }, failed('Einträge konnten nicht geladen werden')));
    unsubs.push(fb.onSnapshot(fb.doc(db, 'users', u.uid), (snap) => {
      const v = (snap.exists() && snap.data()) || {};
      const key = window.GAME.usernameKey(v.username);
      // Nur einen stimmigen Namen anzeigen (Anzeigeform passt zum Schlüssel)
      s.profile = key && key === v.usernameKey ? { email: u.email || '', username: v.username, usernameKey: key } : { email: u.email || '' };
      // Erst gesichert, wenn der Server geantwortet hat oder das Profil schon im Zwischenspeicher steht (sonst fehlt der Name kurz)
      s.profileReady = !snap.metadata.fromCache || snap.exists();
      emit();
      scheduleScore();
      scheduleColl();
    }, (err) => console.error('Profil konnte nicht geladen werden', err)));
  }

  /* Rangliste veröffentlichen: leaderboard/<uid> = { username, sum, count, cards }. Nur mit Benutzernamen und erst nach der
     Bestätigung durch den Server (s.synced). Änderungen werden gebündelt und nur gesendet, wenn sich etwas geändert hat.
     Beim Auslösen wird der Zustand neu geprüft, damit nach einem Zurücksetzen nichts mehr geschrieben wird. */
  const scoreKey = () => (s.score && s.profile.username ? `${s.profile.username}|${s.score.sum}|${s.score.count}|${s.score.cards}` : '');
  function scheduleScore() {
    const key = scoreKey();
    // Läuft für genau diesen Stand schon ein Timer, nicht neu starten (sonst würde häufiges Neuzeichnen ihn ewig verschieben)
    if (!user || deleting || !s.synced || !key || key === lastScore || key === scoreWanted) return;
    scoreWanted = key;
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(flushScore, SCORE_DELAY);
  }
  function flushScore() {
    scoreWanted = '';
    const key = scoreKey();
    if (!user || deleting || !s.synced || !key || key === lastScore) return;
    lastScore = key;
    background(fb.setDoc(fb.doc(db, 'leaderboard', user.uid), { username: s.profile.username, sum: s.score.sum, count: s.score.count, cards: s.score.cards }), 'Rangliste veröffentlichen');
  }

  /* Sammlung veröffentlichen: sammlung/<uid> = { beers }. Gleiche Bedingungen wie bei der Rangliste (Benutzername, vom Server
     bestätigte Einträge), gebündelt und nur bei Änderungen. Ein eigenes Dokument statt eines Felds in leaderboard, damit die
     Rangliste weiterläuft, falls die Regeln für sammlung noch nicht eingetragen sind (dann scheitert nur dieser Schreibvorgang). */
  const collKey = () => (s.coll && s.profile.username ? JSON.stringify(s.coll) : '');
  function scheduleColl() {
    const key = collKey();
    if (!user || deleting || !s.synced || !key || key === lastColl || key === collWanted) return;
    collWanted = key;
    clearTimeout(collTimer);
    collTimer = setTimeout(flushColl, SCORE_DELAY);
  }
  function flushColl() {
    collWanted = '';
    const key = collKey();
    if (!user || deleting || !s.synced || !key || key === lastColl) return;
    lastColl = key;
    background(fb.setDoc(fb.doc(db, 'sammlung', user.uid), { beers: s.coll }), 'Sammlung veröffentlichen');
  }
  // Sammlung vom Server entfernen. Einzeln statt im Batch: Fehlen die Regeln für sammlung (alte Regeln), darf das
  // Zurücksetzen bzw. Löschen des Kontos daran nicht scheitern.
  const dropColl = (uid) => fb.deleteDoc(fb.doc(db, 'sammlung', uid));

  // Löschvorgänge in Batches mit höchstens 500 Vorgängen; extra = zusätzliche Vorgänge für den ersten Batch
  function deleteInBatches(ids, extra = []) {
    const refs = ids.map((id) => fb.doc(drinksCol(), id));
    const first = Math.max(0, BATCH_MAX - extra.length);
    const chunks = [refs.slice(0, first)];
    for (let i = first; i < refs.length; i += BATCH_MAX) chunks.push(refs.slice(i, i + BATCH_MAX));
    chunks.forEach((chunk, n) => {
      const batch = fb.writeBatch(db);
      if (n === 0) extra.forEach((op) => op(batch));
      chunk.forEach((ref) => batch.delete(ref));
      background(batch.commit(), 'Löschen');
    });
  }

  const firebase = {
    async start() {
      // Wächter gegen die leere weiße Seite: Solange der Status 'loading' ist, zeigt die App nichts. Hängt einer der
      // Schritte unten (z. B. Laden der Module von gstatic.com oder IndexedDB in Safari), käme nie eine Meldung.
      // Nach WATCHDOG_MS wird der Status zum Fehler mit dem Schritt, an dem es hängt; kommt die Antwort doch noch,
      // überschreibt der normale Ablauf den Fehler wieder (onUser/onSnapshot setzen den Status neu).
      let step = 'Module laden';
      setTimeout(() => {
        if (s.status !== 'loading') return;
        console.error('Firebase antwortet nicht, hängt bei:', step);
        s.status = 'error';
        s.error = `Die Verbindung kommt nicht zustande (hängt bei: ${step}). Bitte Werbe-/Inhaltsblocker, VPN oder iCloud Privat-Relay ausschalten, sonst die Website-Daten in den Safari-Einstellungen löschen.`;
        emit();
      }, WATCHDOG_MS);
      try {
        const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}/`;
        const [appM, authM, fsM] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
        fb = { ...authM, ...fsM };
        step = 'Anmeldung starten';
        const app = appM.initializeApp(cfg);
        auth = authM.getAuth(app);
        // Dauerhafter Zwischenspeicher, auch über mehrere Tabs. Ohne IndexedDB (z. B. manche private Fenster)
        // fällt Firestore von selbst auf einen Speicher im Arbeitsspeicher zurück.
        step = 'Zwischenspeicher öffnen';
        db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) });
        step = 'Anmeldestatus lesen';
        authM.onAuthStateChanged(auth, (u) => { step = 'Einträge laden'; onUser(u); }, failed('Anmeldestatus nicht lesbar'));
      } catch (err) {
        console.error('Firebase konnte nicht geladen werden', err);
        s.status = 'error';
        s.error = 'Die Anmeldung ist gerade nicht erreichbar.';
        emit();
      }
    },

    add(beerId, at, place) {
      if (!user) return null;
      const ref = fb.doc(drinksCol()); // neue automatische ID, schon vor dem Senden bekannt
      const data = { beerId, at, ...placeFields(place) };
      background(fb.setDoc(ref, data), 'Speichern');
      return { id: ref.id, ...data };
    },

    remove(ids) {
      if (!user || !ids.length) return;
      deleteInBatches(ids);
    },

    // Alle Einträge löschen und den Namen freigeben (Name im ersten Batch, damit beides zusammen passiert)
    reset() {
      if (!user) return;
      const key = s.profile.usernameKey;
      const extra = key ? [
        (b) => b.delete(fb.doc(db, 'usernames', key)),
        (b) => b.delete(fb.doc(db, 'leaderboard', user.uid)),
        (b) => b.set(fb.doc(db, 'users', user.uid), {}),
      ] : [];
      clearTimeout(scoreTimer);
      lastScore = '';
      scoreWanted = '';
      clearTimeout(collTimer);
      lastColl = '';
      collWanted = '';
      background(dropColl(user.uid), 'Sammlung entfernen');
      deleteInBatches(s.drinks.map((d) => d.id), extra);
    },

    /* Benutzername wählen oder ändern. Braucht den Server: Eine Transaktion liest usernames/<neu> direkt vom Server
       und schlägt ohne Netz fehl, statt in der Warteschlange zu hängen. In EINEM Vorgang: alten Namen freigeben,
       neuen belegen, users/<uid> setzen. firestore.rules prüft dasselbe noch einmal. */
    setUsername(name) {
      if (!user) return Promise.reject(fail('error', 'nicht angemeldet'));
      const key = window.GAME.usernameKey(name);
      if (!key) return Promise.reject(fail('invalid'));
      if (navigator.onLine === false) return Promise.reject(fail('offline'));
      const uid = user.uid;
      const old = s.profile.usernameKey;
      const run = fb.runTransaction(db, async (tx) => {
        const newRef = fb.doc(db, 'usernames', key);
        const snap = await tx.get(newRef);
        if (snap.exists() && snap.data().uid !== uid) throw fail('taken');
        if (old && old !== key) tx.delete(fb.doc(db, 'usernames', old));
        if (!snap.exists()) tx.set(newRef, { uid });
        tx.set(fb.doc(db, 'users', uid), { username: name, usernameKey: key });
      });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(fail('offline')), NAME_TIMEOUT));
      return Promise.race([run, timeout]).catch((err) => {
        if (err && (err.code === 'taken' || err.code === 'offline')) throw err;
        if (err && (err.code === 'unavailable' || err.code === 'deadline-exceeded')) throw fail('offline');
        console.error('Benutzername konnte nicht gespeichert werden', err);
        throw fail('error');
      });
    },

    publishScore(sum, count, cards) {
      s.score = { sum, count, cards };
      scheduleScore();
    },

    // Beste Plätze live lesen. Jede Zeile: { uid, username, sum, count, cards } (ungeprüft; GAME.rankBoard prüft und sortiert).
    watchRanking(onData, onError) {
      if (!user) { onError(fail('error', 'nicht angemeldet')); return () => {}; }
      const q = fb.query(fb.collection(db, 'leaderboard'), fb.orderBy('sum', 'desc'), fb.limit(window.GAME.BOARD_SIZE));
      return fb.onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => { const v = d.data() || {}; return { uid: d.id, username: v.username, sum: v.sum, count: v.count, cards: v.cards }; });
        onData(rows, { fromCache: snap.metadata.fromCache });
      }, (err) => { console.error('Rangliste konnte nicht geladen werden', err); onError(err); });
    },

    publishCollection(beers) {
      s.coll = beers && typeof beers === 'object' ? beers : null;
      scheduleColl();
    },

    // Sammlung eines anderen Spielers einmal lesen (vom Server, ohne Netz aus dem Zwischenspeicher, sonst Fehler)
    async loadCollection(uid) {
      if (!user) throw fail('error', 'nicht angemeldet');
      const snap = await fb.getDoc(fb.doc(db, 'sammlung', uid));
      return snap.exists() ? (snap.data() || {}).beers || null : null;
    },

    // Wie viele Spieler haben mehr Punkte? (Zählabfrage direkt beim Server; ohne Netz Fehler.) Rang = Ergebnis + 1.
    async countAbove(sum) {
      const q = fb.query(fb.collection(db, 'leaderboard'), fb.where('sum', '>', sum));
      return (await fb.getCountFromServer(q)).data().count;
    },

    uid() { return user ? user.uid : null; },

    signIn() {
      return fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
    },

    /* Konto endgültig löschen. Reihenfolge ist wichtig:
       1. Erneute Anmeldung per Popup (Firebase verlangt für das Löschen eine frische Anmeldung; so schlägt der letzte Schritt nicht fehl,
          nachdem schon alles gelöscht ist). Ein anderes Google-Konto wird abgelehnt.
       2. Alle Daten löschen, mit Bestätigung des Servers (nichts im Hintergrund): Einträge, zuletzt in EINEM Batch Namensfreigabe,
          Ranglisten-Eintrag und Profil (die Regeln verlangen, dass der Name im selben Vorgang freigegeben wird).
       3. Erst danach das Anmeldekonto selbst. Danach wäre kein Zugriff auf die Daten mehr erlaubt.
       Klappt Schritt 3 nicht, sind die Daten weg, das Konto besteht noch (err.code 'partial'); ein neuer Versuch ist gefahrlos. */
    async deleteAccount() {
      if (!user) throw fail('error', 'nicht angemeldet');
      if (navigator.onLine === false) throw fail('offline');
      const u = user;
      const withTimeout = (p) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(fail('offline')), DELETE_TIMEOUT))]);
      try {
        await fb.reauthenticateWithPopup(u, new fb.GoogleAuthProvider());
      } catch (err) {
        const code = err && err.code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') throw fail('cancelled');
        if (code === 'auth/popup-blocked') throw fail('popup');
        if (code === 'auth/user-mismatch') throw fail('mismatch');
        if (code === 'auth/network-request-failed') throw fail('offline');
        console.error('Erneute Anmeldung fehlgeschlagen', err);
        throw fail('error');
      }
      deleting = true;
      clearTimeout(scoreTimer);
      scoreWanted = '';
      clearTimeout(collTimer);
      collWanted = '';
      // Sammlung zuerst; ein Fehler (z. B. alte Regeln ohne sammlung) hält das Löschen des Kontos nicht auf
      try { await withTimeout(dropColl(u.uid)); } catch (err) { console.warn('Sammlung konnte nicht entfernt werden', err); }
      try {
        // Alle Einträge vom Server (nicht nur den lokalen Stand) plus noch nicht übertragene lokale
        const [serverDrinks, serverProfile] = await withTimeout(Promise.all([fb.getDocsFromServer(drinksCol()), fb.getDocFromServer(fb.doc(db, 'users', u.uid))]));
        const ids = [...new Set([...s.drinks.map((d) => d.id), ...serverDrinks.docs.map((d) => d.id)])];
        const stored = serverProfile.exists() ? serverProfile.data().usernameKey : null;
        const key = typeof stored === 'string' && /^[a-z0-9_]{3,20}$/.test(stored) ? stored : null;
        const SIZE = BATCH_MAX - 3; // im letzten Batch kommen drei weitere Vorgänge dazu
        const chunks = [];
        for (let i = 0; i < ids.length; i += SIZE) chunks.push(ids.slice(i, i + SIZE));
        if (!chunks.length) chunks.push([]);
        for (let n = 0; n < chunks.length; n++) {
          const batch = fb.writeBatch(db);
          chunks[n].forEach((id) => batch.delete(fb.doc(drinksCol(), id)));
          if (n === chunks.length - 1) {
            if (key) batch.delete(fb.doc(db, 'usernames', key));
            batch.delete(fb.doc(db, 'leaderboard', u.uid));
            batch.delete(fb.doc(db, 'users', u.uid));
          }
          await withTimeout(batch.commit());
        }
      } catch (err) {
        deleting = false;
        lastScore = '';
        if (err && err.code === 'offline') throw err;
        if (err && (err.code === 'unavailable' || err.code === 'deadline-exceeded')) throw fail('offline');
        console.error('Daten konnten nicht gelöscht werden', err);
        throw fail('error');
      }
      try {
        stopListening();
        await fb.deleteUser(u);
      } catch (err) {
        deleting = false;
        lastScore = '';
        console.error('Konto konnte nicht gelöscht werden', err);
        throw fail('partial');
      }
      try { sessionStorage.setItem(SS_DELETED, '1'); } catch { /* ohne Speicher entfällt nur die Meldung */ }
      // Normalerweise meldet onAuthStateChanged das Ende der Anmeldung schon selbst (löscht den Zwischenspeicher und lädt neu)
      if (user) onUser(null);
    },

    async signOut() {
      stopListening();
      try { await fb.signOut(auth); } catch (err) { console.error('Abmelden fehlgeschlagen', err); }
      // onUser(null) übernimmt Löschen und Neuladen
    },
  };

  const impl = MODE === 'local' ? local : firebase;

  return {
    mode: MODE,
    sdk: FIREBASE_SDK,
    start(fn) { onChange = typeof fn === 'function' ? fn : () => {}; impl.start(); },
    drinks: () => s.drinks,
    add: (beerId, at, place) => impl.add(beerId, at, place),
    remove: (ids) => impl.remove(ids),
    reset: () => impl.reset(),
    setUsername: (name) => impl.setUsername(name),
    signIn: () => impl.signIn(),
    signOut: () => impl.signOut(),
    deleteAccount: () => impl.deleteAccount(),
    status: () => s.status,
    error: () => s.error,
    pending: () => s.pending,
    profile: () => s.profile,
    profileReady: () => MODE === 'local' || s.profileReady,
    publishScore: (sum, count, cards) => impl.publishScore(sum, count, cards),
    watchRanking: (onData, onError) => impl.watchRanking(onData, onError),
    countAbove: (sum) => impl.countAbove(sum),
    publishCollection: (beers) => impl.publishCollection(beers),
    loadCollection: (uid) => impl.loadCollection(uid),
    uid: () => impl.uid(),
  };
})();
