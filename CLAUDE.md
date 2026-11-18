# Bier Sammler – Kontext für Claude Code

Diese Datei fasst zusammen, was entschieden, gebaut und gelernt wurde. Einrichtung und Bedienung stehen in `README.md`;
dort nachlesen statt hier doppeln. Stand: 18.11.2026.

## Worum es geht

Spielerische Web-App: Nach jedem getrunkenen Bier trägt der Spieler es ein. Jedes Bier ist eine Sammelkarte in einer von
fünf Seltenheits-Kategorien; Punkte lassen das Level steigen. Eigenes Konto per Google-Anmeldung, Fortschritt in
Firestore. Genutzt auf iPhone und MacBook, auch als installierte Web-App und ohne Netz.

- Hosting: GitHub Pages aus einem öffentlichen Repository, Branch `main`, Ordner `/ (root)`.
- Firebase Authentication (Google) und Cloud Firestore, eigenes Projekt (nicht das von orga_app).
- Kein Framework, kein Build-Schritt, keine npm-Abhängigkeiten. Das soll so bleiben.
- Technik und Arbeitsweise stammen aus `../orga_app` (dort nichts verändern, deren Firebase-Konfiguration nie übernehmen).

## Arbeitsweise mit dem Nutzer

- Sprache: Deutsch, in Antworten, Oberflächentexten, Kommentaren und der README.
- Er legt Wert auf Genauigkeit und Nachvollziehbarkeit. Bei Unklarheit erst fragen, dann bauen. Aufträge wörtlich nehmen.
- Er committet und pusht selbst. Nicht committen oder pushen.
- Am Ende jeder Aufgabe: geänderte Dateien nennen und NEU ANGELEGTE Dateien ausdrücklich auflisten (in einem anderen
  Projekt fehlte einmal eine neue Datei in Git; die veröffentlichte Seite blieb leer).
- Nach jeder Änderung den Dateiinhalt ansehen, nicht nur der Erfolgsmeldung trauen; `node --check` für jede JS-Datei.
- Ehrlich sagen, was nicht getestet werden konnte.
- Node.js wurde am 18.11.2026 auf seinen Wunsch per Homebrew installiert (`/opt/homebrew/bin/node`).

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Gerüst, Dialoge (`#add`, `#card`, `#stats`, `#ranking`, `#settings`, `#confirm`, `#age`), Hinweis `#toast` (Popover), modulepreload |
| `css/style.css` | Farbvariablen oben: hell, dunkel per System (`:root:not([data-theme=light])`) und dunkel per Auswahl (`[data-theme=dark]`) – beide Dunkel-Blöcke gleich halten |
| `js/game.js` | Reine Funktionen (`window.GAME`, in Node per `require`): Punkte, Level, Formatierung, Bierdaten prüfen/zusammenführen, Suche, Protokoll, Sortierung, Wochen, Statistiken, Benutzername, Rangliste (`rankBoard`) |
| `js/store.js` | `window.STORE`: lokaler Modus (localStorage) oder Firebase (Auth, Firestore, Warteschlange, Namen) |
| `js/app.js` | Oberfläche (eine IIFE, sieben nummerierte Abschnitte) |
| `js/firebase-config.js` | Konfiguration; leerer `apiKey` = lokaler Modus. Werte nicht ausgeben |
| `sw.js` | Service Worker |
| `firestore.rules` | Regeln (Nutzer fügt sie in der Konsole ein) |
| `tests/game.test.js` | Node-Tests der Spiellogik |
| `impressum.html`, `datenschutz.html` | Nur Platzhalter, KEINE Rechtstexte erfinden |
| `Datensammlung/` | `biere.json` (Scraper, nie ändern), `biere_manuell.json` (Nachträge), `biere_korrekturen.json` (Korrekturen), `kategorien.json`, `scraper/` |

Ladereihenfolge: `firebase-config.js`, `game.js`, `store.js`, `app.js`.

## Bierdaten

- `biere.json`: 6.368 Biere, IDs `BS-000001` … `BS-006368`, erzeugt von `Datensammlung/scraper/scraper.py`
  (Kategorie fest aus der ID abgeleitet; `scraper/cache/id_zuordnung.json` hält die IDs stabil). NIE von Hand oder per
  Skript verändern.
- `biere_manuell.json`: gleiches Format, IDs `BM-000001` fortlaufend. Doppelte ID → Warnung, `biere.json` gilt.
- `biere_korrekturen.json` (18.11.2026): Objekt `{ "<ID>": { feld: wert } }` mit den Feldnamen aus `biere.json`, wird in
  `GAME.mergeBeers` (5. Parameter, `applyFix`) auf den Rohdatensatz gelegt, bevor `cleanBeer` läuft. Änderbar: name,
  beschreibung, biersorte, zutaten, alkoholgehalt, flaschengroesse, brauerei_vertrieb (je Unterfeld). NIE id,
  kategorie_stufe, kategorie_name (Punkte/Level). `null` entfernt eine Angabe; falscher Typ, unzulässiges Feld,
  unbekannte ID → Warnung und ignoriert. Fehlt die Datei, startet die App trotzdem. Beim Anlegen wurde `CACHE_VERSION`
  in `sw.js` auf `v2` erhöht (neue Datei in `DATA_FILES`). Aktuell ist die Datei leer (`{}`); der Nutzer trägt selbst ein.
- Die ID ist der Schlüssel für die Spielerdaten: nie ändern oder neu vergeben.
- `GAME.cleanBeer` macht aus jedem Rohdatensatz ein bereinigtes Objekt: `title`/`brand` (Trennung am ERSTEN „ - “;
  ohne „ - “ ganzer Name als Titel, Firmenname als Marke), `sorten` (Liste, evtl. leer), `alc` (0 = „alkoholfrei“),
  `flasche`, `company { typ, name, adresse, region, land }`, `beschreibung`, `zutaten`, `stufe`, `kategorie`.
  Fehlende Werte sind `null` bzw. `[]` und werden in der Oberfläche weggelassen.
- Die Kategorie-STUFE ist intern (Sortierung, Punkte, Farbe `.k1`…`.k5`) und wird NIE angezeigt, nur der Name.
- Eigenheiten: 1.092× keine Beschreibung, 252× 0,0 % Alkohol, 2.064× mehrere Sorten, 1.082× keine Region,
  18 doppelte Namen (Treffer zeigen deshalb Flaschengröße und Alkohol), 2.379× Marke ≠ Firmenname, 1.518 ausländische Biere.

## Spielregeln und Rechnen

- Punkte in Zehnteln: Stufe 1–5 = 10, 11, 12, 14, 16. Level = floor(summe/200)+1, Ring = (summe mod 200)/200.
- Alles (Punkte, Level, Sammlung, Statistiken) wird aus dem Protokoll berechnet, nie gespeichert.
- Kein Nachtragen: Zeitpunkt = Geräteuhr beim Bestätigen. Keine Tages-Serien.
- Pflicht-Beispiele, die nach jeder Änderung exakt herauskommen müssen (`node tests/game.test.js`):
  0 → Level 1, Ring 0 · 10×Stufe 5 = 160 → Level 1, 16,0/20 · 20×Stufe 1 = 200 → Level 2, 0,0/20 ·
  19×Stufe 4 = 266 → Level 2, 6,6/20 · 13×Stufe 1 + 5×Stufe 5 = 210 → Level 2, 1,0/20 · 3×Stufe 2 = 33 → „3,3“.
- Karten-Level: Die Plakette auf der Karte zeigt „Lvl n“ (n = wie oft das Bier getrunken wurde; vorher „×n“). Ab 4, 8, 16,
  24 und 40 Mal verändert sich die Optik der Karte in fünf Stufen (`GAME.cardTier`, Klassen `t1`…`t5` auf `.bcard-body`
  und `.bottle`): Farbschimmer in der Mitte, Glanz, Schaumkrone, Strahlen, Sterne, goldene Flasche mit Funkeln. Rahmen
  und Band (Kategorie) bleiben unverändert. Die Stufen werden in der App NICHT erklärt (so gewünscht). Alles wird aus dem
  Protokoll berechnet, beim Löschen von Einträgen fällt die Karte also zurück. Ab Lvl 40 zählt die Zahl weiter.
  „Level“ ohne Zusatz bleibt das Spieler-Level in der Kopfleiste.
- Wochen beginnen montags in Ortszeit (`weekStart`, `weekKey` über Kalendertage, DST-fest), KW nach ISO 8601.
  Ø/Woche = Anzahl / Wochen von der Woche des ersten Eintrags bis heute (beide eingeschlossen). Nie `toISOString()`.
- Suche: `fold` (klein, ß→ss, Akzente weg, Bindestriche/Apostrophe weg) und `unumlaut` (ae/oe/ue → a/o/u); ein Wort
  passt, wenn eine seiner beiden Formen in einer der beiden Formen des Suchtexts (Name + Firmenname) steht.
  So bleiben auch Zwischenstände beim Tippen erhalten („brau“ → „Brauerei“). Wortanfänge zuerst, höchstens 10 Treffer.

## Datenmodell und Sync (`js/store.js`)

```
users/<uid>                  { username?, usernameKey? }      optionale Felder fehlen, nie undefined/null
users/<uid>/drinks/<autoId>  { beerId: "BS-000001", at: <ms, Ganzzahl> }   nur create/delete
usernames/<usernameKey>      { uid }
leaderboard/<uid>            { username, sum, count }   Rangliste: Punkte in Zehnteln, Anzahl Biere (nur mit Benutzername)
```

- `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.
- Schreib-Promises werden NIE abgewartet (sie hängen offline). Anzeige aus dem lokalen Snapshot; der Hinweis
  „Wird synchronisiert, sobald Verbindung besteht“ erscheint, wenn `hasPendingWrites` länger als 1 s anhält.
- Löschen und Zurücksetzen per `writeBatch`, höchstens 500 Vorgänge; beim Zurücksetzen stehen Namensfreigabe und
  `users/<uid> = {}` im ersten Batch.
- Benutzername per `runTransaction` (braucht den Server, Zeitlimit 10 s → „Keine Verbindung“): neuen Namen lesen,
  alten löschen, neuen anlegen, Profil setzen – ein Vorgang. Anzeige darf Groß/klein mischen, eindeutig ist `usernameKey`.
- `normalizeDrinks` verwirft unbekannte beerIds, ungültige Zeitpunkte und Zusatzfelder. Profilnamen werden nur angezeigt,
  wenn `usernameKey(username) === usernameKey`.
- Abmelden: `signOut` → `terminate` + `clearIndexedDbPersistence` → neu laden. Ein anderes Konto als zuletzt
  (`biersammler-uid-v1`) löscht ebenfalls den Zwischenspeicher, das neue Konto beginnt leer.
- Firebase-SDK-Version `10.12.2` steht in `js/store.js`, `sw.js` und den drei `modulepreload`-Links in `index.html`.
- localStorage-Schlüssel: `biersammler-drinks-v1` (nur lokaler Modus), `-theme-v1`, `-age-v1`, `-more-v1`, `-uid-v1`.

## Rangliste („Platzierung“, 18.11.2026)

- Knopf `[data-act="ranking"]` neben „Statistiken“, sichtbar nur im Firebase-Modus MIT Benutzernamen (`renderHeader`,
  Klasse `has-rank` auf `.tools`: auf < 480 px rutscht der Sync-Hinweis in eine eigene Zeile, sonst würde er abgeschnitten).
- Veröffentlichen: `render()` meldet `STORE.publishScore(summary.sum, drinks.length)` (erst wenn die Bierdatenbank geladen
  ist). `store.js` schreibt `leaderboard/<uid>` gebündelt (1,5 s), nur bei Änderung, nur mit Namen und erst nach der
  Serverbestätigung des Protokolls (`snap.metadata.fromCache` false), damit ein leerer Zwischenspeicher nichts Falsches
  veröffentlicht. Beim Zurücksetzen löscht derselbe Batch das Dokument; ein Namenswechsel schreibt es neu.
- Anzeige: `STORE.watchRanking` = `orderBy('sum','desc')` + `limit(15)` (nur Einzelfeld-Index, kein zusammengesetzter nötig),
  `GAME.rankBoard` prüft (Name, Ganzzahlen, 10…16 je Bier), sortiert (Punkte, Biere, Name) und vergibt Ränge (gleiche
  Punkte = gleicher Platz). Eigener Rang außerhalb der Besten: `getCountFromServer(where('sum','>',eigene Punkte)) + 1`;
  ohne Netz „–“. Entscheidung des Nutzers: Top 15 + eigener Rang, Sortierung nach Punkten, keine Wochen-Rangliste.
- Werte kommen vom Client und sind fälschbar; das ist gewollt hingenommen („es ist ein Spiel“).
- Getestet mit nachgebildetem Firebase (siehe „Testen“): Veröffentlichen, Namenswechsel, Zurücksetzen, Top 15 + Rang 23,
  Gleichstand, eigener Platz unter den Besten, offline, Ladefehler, ungültige Zeilen, lokaler Modus, 375 px hell/dunkel
  und Desktop. NICHT getestet: echte Regeln/Firestore (Regeln gedanklich geprüft, kein Emulator).

## Firestore-Regeln (`firestore.rules`)

Gedanklich gegen jeden Schreibvorgang der App geprüft (Eintrag anlegen, −1, Karte löschen, Zurücksetzen mit/ohne Namen,
Name wählen, ändern, nur Groß/klein ändern). Nicht automatisch getestet: Es gibt keinen Emulator (bräuchte npm/Java).
Wesentlich: drinks nur create/delete mit genau `beerId` (`^B[SM]-[0-9]{6}$`) und `at` (int, ≤ jetzt + 5 min);
usernames nur anlegen, wenn frei, für sich selbst, mit passendem `users/<uid>.usernameKey` (getAfter) und nur, wenn ein
bisheriger Name im selben Vorgang freigegeben wird (auch beim Leeren/Löschen des Profils).

## Darstellung und Bedienung

- `render()` zeichnet `#main` neu; Fokus über `data-focus` + `CSS.escape()` wiederherstellen. Offene Dialoge werden
  gezielt aktualisiert (`paintCard`, `paintStats`, `paintSettings`), Eingabefelder darin bleiben bestehen.
- Alle Texte aus Bierdatenbank, Firestore und Eingaben gehen durch `esc()`. Getestet mit Schadcode in einem
  vorübergehenden Eintrag in `biere_manuell.json` (Name, Firma, Adresse, Sorte, Beschreibung, Zutaten) und mit
  manipulierten Firestore-Dokumenten (nachgebildet). Muss so bleiben.
- Hinzufügen: Vor dem Bestätigen stehen Kategorie und Details NICHT im Dokument; Doppelklick-Schutz über `add.saved`.
- Bestätigungen (`confirmBox`) entscheiden direkt beim Klick; höchstens eine gleichzeitig.
- `close`-Ereignisse von Dialogen nur zum Aufräumen nutzen und prüfen, ob der Dialog inzwischen wieder offen ist
  (das Ereignis kommt verzögert).
- Smartphone zuerst: 375/390 px prüfen, Eingabefelder 16 px, Safe-Area-Abstände; Kopfleiste und Werkzeugzeile dürfen
  nicht höher werden.
- Dialog-Inhalt `.sheet-body`: `flex: 1 1 auto`, NIE `flex: 1` (Grundgröße 0 %). Safari rechnet 0 % im Dialog ohne
  feste Höhe als 0; auf dem iPhone zeigten Karte, Statistiken und Einstellungen dann nur die Kopfzeile (18.11.2026).
  Chromium (auch der eingebaute Browser) zeigt den Fehler nicht; nachstellbar mit `.sheet-body { flex-basis: 0px }`.

## Testen

- Lokal: `python3 -m http.server 8000`, dann `http://localhost:8000` (lokaler Modus bei leerem `apiKey`).
- Logik: `node tests/game.test.js` (auch mit `TZ=America/New_York` bzw. `TZ=Pacific/Auckland`).
- Firebase ohne echtes Projekt: Kopie von `index.html` mit Import-Map, die die drei gstatic-Adressen auf nachgebildete
  Module umlenkt (Server und Warteschlange in localStorage, offline schaltbar, Teilprüfung der Regeln). Der Produktivcode
  braucht dafür keine Änderung. Getestet am 18.11.2026: Sperre, Popup blockiert/geschlossen, Anmelden, Eintrag online,
  offline (Warteschlange übersteht Neuladen, Hinweis, spätere Übertragung), Namen (Format, belegt, Wechsel, nur Groß/klein,
  offline), −1, Karte löschen, Zurücksetzen mit 1.101 Einträgen (Batches 500/500/103), Abmelden, Kontowechsel ohne
  Abmelden, verweigerter Lesezugriff, SDK nicht ladbar, Schadcode in Firestore-Dokumenten.
- Offline mit Service Worker: Server stoppen, Seite neu laden → App startet aus dem Cache.
- Service-Worker-Update: in einer Kopie `CACHE_VERSION` auf `v2` gesetzt → alter Cache gelöscht, neuer mit allen Dateien.
- Gesamtprüfung 18.11.2026: Schadcode in allen Textfeldern eines Biers (Startseite, Kartenansicht samt Beschreibung,
  Statistiken, Einstellungen, Bestätigung) und als Eingabe (Suche inkl. Zurückschreiben ins Feld, Filter, Name) –
  nichts eingeschleust; 375/390 px und Desktop in hell/dunkel; „+“-Knopf verdeckt unten gescrollt nichts.
- Im eingebauten Browser von Claude kommen bei ausgeblendetem Bereich keine `close`-Ereignisse von Dialogen an.
- Nicht getestet: echtes Firebase-Projekt (Regeln, Popup, Persistenz) und echtes iPhone / installierte Web-App.

## Bekannte Grenzen und offene Punkte

- Logo fehlt: `icons/` enthält Platzhalter (Bernstein-Fläche mit Flasche), erzeugt per Python-Skript.
- Rangliste: Werte vom Client, fälschbar (bewusst hingenommen). Neue Regeln müssen VOR der neuen App-Version in der
  Konsole stehen. Ein Spieler ohne Netz erscheint erst nach der ersten Serverbestätigung. Eine Wochen-Rangliste gibt es nicht.
- „Kein Nachtragen“ ist serverseitig nur nach oben begrenzt; eine Untergrenze würde die Offline-Warteschlange brechen.
- Geräteuhr > 5 min vor → Firestore lehnt neue Einträge ab (Eintrag verschwindet nach kurzem Aufblitzen wieder).
- Der Listener liest nach längerer Pause alle Trink-Dokumente neu (Firestore-Lesekosten); für wenige Spieler unkritisch.
- Bei mehreren offenen Tabs kann `clearIndexedDbPersistence` scheitern; dann bleibt die Kopie bis zum nächsten Löschen.
- Benutzername: Läuft das Zeitlimit (10 s) ab, kann die Transaktion im Hintergrund trotzdem noch gelingen; dann steht
  „Keine Verbindung“ da, und kurz darauf erscheint der neue Name in der Kopfzeile.
- `prefers-reduced-motion` ist im CSS berücksichtigt, ließ sich im eingebauten Browser aber nicht nachstellen.
- Rechtliches: Impressum/Datenschutz sind Platzhalter; die Nutzung der gesammelten Bierdaten muss der Nutzer klären.
