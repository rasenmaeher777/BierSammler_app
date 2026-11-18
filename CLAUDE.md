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
| `index.html` | Gerüst, Dialoge (`#add`, `#card`, `#stats`, `#settings`, `#confirm`, `#age`), Hinweis `#toast` (Popover), modulepreload |
| `css/style.css` | Farbvariablen oben: hell, dunkel per System (`:root:not([data-theme=light])`) und dunkel per Auswahl (`[data-theme=dark]`) – beide Dunkel-Blöcke gleich halten |
| `js/game.js` | Reine Funktionen (`window.GAME`, in Node per `require`): Punkte, Level, Formatierung, Bierdaten prüfen/zusammenführen, Suche, Protokoll, Sortierung, Wochen, Statistiken, Benutzername |
| `js/store.js` | `window.STORE`: lokaler Modus (localStorage) oder Firebase (Auth, Firestore, Warteschlange, Namen) |
| `js/app.js` | Oberfläche (eine IIFE, sieben nummerierte Abschnitte) |
| `js/firebase-config.js` | Konfiguration; leerer `apiKey` = lokaler Modus. Werte nicht ausgeben |
| `sw.js` | Service Worker |
| `firestore.rules` | Regeln (Nutzer fügt sie in der Konsole ein) |
| `tests/game.test.js` | Node-Tests der Spiellogik |
| `impressum.html`, `datenschutz.html` | Nur Platzhalter, KEINE Rechtstexte erfinden |
| `Datensammlung/` | `biere.json` (Scraper, nie ändern), `biere_manuell.json` (Nachträge), `kategorien.json`, `scraper/` |

Ladereihenfolge: `firebase-config.js`, `game.js`, `store.js`, `app.js`.

## Bierdaten

- `biere.json`: 6.368 Biere, IDs `BS-000001` … `BS-006368`, erzeugt von `Datensammlung/scraper/scraper.py`
  (Kategorie fest aus der ID abgeleitet; `scraper/cache/id_zuordnung.json` hält die IDs stabil). NIE von Hand oder per
  Skript verändern.
- `biere_manuell.json`: gleiches Format, IDs `BM-000001` fortlaufend. Doppelte ID → Warnung, `biere.json` gilt.
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
- Rangliste noch nicht gebaut; `usernames` ist dafür einzeln lesbar, Punkte müssten später z. B. in `users/<uid>`
  oder einer eigenen Sammlung veröffentlicht werden.
- „Kein Nachtragen“ ist serverseitig nur nach oben begrenzt; eine Untergrenze würde die Offline-Warteschlange brechen.
- Geräteuhr > 5 min vor → Firestore lehnt neue Einträge ab (Eintrag verschwindet nach kurzem Aufblitzen wieder).
- Der Listener liest nach längerer Pause alle Trink-Dokumente neu (Firestore-Lesekosten); für wenige Spieler unkritisch.
- Bei mehreren offenen Tabs kann `clearIndexedDbPersistence` scheitern; dann bleibt die Kopie bis zum nächsten Löschen.
- Benutzername: Läuft das Zeitlimit (10 s) ab, kann die Transaktion im Hintergrund trotzdem noch gelingen; dann steht
  „Keine Verbindung“ da, und kurz darauf erscheint der neue Name in der Kopfzeile.
- `prefers-reduced-motion` ist im CSS berücksichtigt, ließ sich im eingebauten Browser aber nicht nachstellen.
- Rechtliches: Impressum/Datenschutz sind Platzhalter; die Nutzung der gesammelten Bierdaten muss der Nutzer klären.
