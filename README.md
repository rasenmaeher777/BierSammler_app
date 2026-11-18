# Bier Sammler

Spielerische Web-App: Nach jedem getrunkenen Bier trägst du es ein. Jedes Bier ist eine Sammelkarte in einer von fünf
Seltenheits-Kategorien (Standardgebräu, Klassiker, Spezialität, Zaubertrank, Heiligtum). Punkte lassen dein Level steigen.
Anmeldung mit Google, Speicherung in Cloud Firestore, nutzbar auf iPhone und Mac, auch als installierte Web-App und ohne Netz.

Reines HTML, CSS und JavaScript – kein Framework, kein Build-Schritt, keine npm-Abhängigkeiten.

## Inhalt

1. [Dateien](#dateien)
2. [Lokal testen](#lokal-testen)
3. [Firebase einrichten](#firebase-einrichten)
4. [Veröffentlichen mit GitHub Pages](#veröffentlichen-mit-github-pages)
5. [Biere nachtragen](#biere-nachtragen)
6. [Service Worker und Cache-Version](#service-worker-und-cache-version)
7. [Spielregeln](#spielregeln)
8. [Rechtliches](#rechtliches)
9. [Bekannte Grenzen](#bekannte-grenzen)

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Seitengerüst, Dialoge, Vorab-Laden der Firebase-Module |
| `css/style.css` | Gestaltung; alle Farben als Variablen ganz oben (hell/dunkel, Kategorien `--k1` … `--k5`) |
| `js/game.js` | Spiellogik als reine Funktionen (Punkte, Level, Suche, Statistiken) – in Node testbar |
| `js/store.js` | Speichern: lokal (localStorage) oder Firebase (Anmeldung, Firestore, Warteschlange ohne Netz) |
| `js/app.js` | Oberfläche und Bedienung |
| `js/firebase-config.js` | Firebase-Konfiguration; leerer `apiKey` = lokaler Modus |
| `sw.js` | Service Worker (Start ohne Netz) |
| `manifest.webmanifest`, `icons/` | Web-App-Manifest und Symbole (vorerst Platzhalter) |
| `firestore.rules` | Sicherheitsregeln zum Einfügen in die Firebase-Konsole |
| `impressum.html`, `datenschutz.html` | Platzhalterseiten – **noch auszufüllen** |
| `Datensammlung/biere.json` | Bierdatenbank (vom Scraper erzeugt, **nie von Hand ändern**) |
| `Datensammlung/biere_manuell.json` | Selbst nachgetragene Biere |
| `Datensammlung/kategorien.json` | Die fünf Kategorien |
| `Datensammlung/scraper/` | Scraper für die Bierdatenbank (eigene README) |
| `tests/game.test.js` | Tests der Spiellogik: `node tests/game.test.js` |

## Lokal testen

Im Projektordner:

```bash
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000` öffnen.

- Solange `apiKey` in `js/firebase-config.js` leer ist, läuft die App **im lokalen Modus**: keine Anmeldung, alle Einträge
  liegen nur im Browser (localStorage). In der Kopfzeile steht „Nur auf diesem Gerät“.
- Spiellogik prüfen: `node tests/game.test.js` (benötigt Node.js, z. B. `brew install node`).
- Der Service Worker wird auch auf `localhost` registriert. Nutzt du Port 8000 auch für andere Projekte (z. B. orga_app),
  entferne ihn danach in den Entwicklertools unter **Application → Service Workers → Unregister** oder nimm einen
  anderen Port, z. B. `python3 -m http.server 8010`.

## Firebase einrichten

### 1. Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) → **Projekt hinzufügen**, Name z. B. `bier-sammler`.
   Google Analytics wird nicht gebraucht.
2. In der Projektübersicht **Web-App hinzufügen** (Symbol `</>`), Name „Bier Sammler“, *ohne* Firebase Hosting.
3. Die angezeigten Werte `apiKey`, `authDomain`, `projectId` und `appId` in `js/firebase-config.js` eintragen.
   Sie sind nicht geheim; geschützt werden die Daten durch die Firestore-Regeln.

### 2. Google-Anmeldung aktivieren

1. **Build → Authentication → Jetzt starten**.
2. Reiter **Sign-in method** → **Google** → aktivieren, Support-E-Mail wählen, speichern.
3. Reiter **Einstellungen → Autorisierte Domains** → **Domain hinzufügen**: `<dein-github-name>.github.io`
   (nur die Domain, ohne `https://` und ohne Pfad). `localhost` steht dort bereits.

### 3. Firestore anlegen

1. **Build → Firestore Database → Datenbank erstellen**.
2. Standort **europe-west3 (Frankfurt)** wählen. Der Standort lässt sich später nicht mehr ändern.
3. Im **Produktionsmodus** starten.
4. Reiter **Regeln**: den gesamten Inhalt von `firestore.rules` einfügen und **Veröffentlichen**.
   Ohne diese Regeln zeigt die App nach der Anmeldung „Zugriff verweigert“.

### 4. API-Schlüssel beschränken

In der [Google Cloud Console](https://console.cloud.google.com) dasselbe Projekt wählen →
**APIs & Dienste → Anmeldedaten** → den Schlüssel „Browser key (auto created by Firebase)“ öffnen:

- **Anwendungseinschränkungen: Websites**, erlaubt:
  - `https://<dein-github-name>.github.io/*`
  - `http://localhost:8000/*` (nur, wenn du lokal mit Firebase testen willst)
  - `https://<projekt-id>.firebaseapp.com/*` (wird für das Anmelde-Popup gebraucht)
- **API-Einschränkungen: Schlüssel einschränken** auf
  **Identity Toolkit API**, **Token Service API** und **Cloud Firestore API**.

Danach ein paar Minuten warten und die Anmeldung testen. Schlägt sie fehl, zuerst die Website-Einschränkungen prüfen.

## Veröffentlichen mit GitHub Pages

1. Öffentliches Repository anlegen und alle Dateien pushen. **Neue Dateien zu Git hinzufügen** – fehlt eine Datei
   (z. B. `js/store.js` oder `sw.js`), bleibt die veröffentlichte Seite leer, obwohl lokal alles läuft.
2. Repository → **Settings → Pages** → Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → Save.
3. Nach ein bis zwei Minuten ist die App unter `https://<dein-github-name>.github.io/<repository>/` erreichbar.
4. GitHub Pages unterscheidet Groß- und Kleinschreibung: `Datensammlung/` genau so schreiben.
5. Auf dem iPhone: Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**.

## Biere nachtragen

Fehlt ein Bier, trägst du es in `Datensammlung/biere_manuell.json` ein. **`biere.json` nie ändern** – der Scraper
überschreibt sie bei jedem Lauf.

- Gleiches Format wie in `biere.json`. Die Datei ist eine Liste (`[ … ]`), Einträge durch Komma getrennt.
- IDs fortlaufend `BM-000001`, `BM-000002`, … Eine vergebene ID **nie ändern oder neu vergeben**: Sie ist der Schlüssel
  für die Einträge aller Spieler. Auch ein gelöschtes Bier behält seine ID für immer.
- `kategorie_stufe` 1 bis 5 bestimmt Seltenheit und Punkte; der angezeigte Name kommt aus `kategorien.json`.
- Unbekannte Werte als `null` (bzw. bei `biersorte` eine leere Liste); die App lässt fehlende Angaben einfach weg.
- Hat ein Eintrag dieselbe ID wie ein Bier aus `biere.json`, gilt das aus `biere.json` (Warnung in der Browser-Konsole).

Beispiel:

```json
[
  {
    "id": "BM-000001",
    "name": "Brauerei Beispiel - Kellerbier",
    "biersorte": ["Kellerbier"],
    "alkoholgehalt": 5.2,
    "brauerei_vertrieb": { "typ": "Brauerei", "name": "Brauerei Beispiel", "adresse": null, "region": "Bayern", "land": "Deutschland" },
    "beschreibung": null,
    "zutaten": null,
    "flaschengroesse": 0.5,
    "kategorie_name": "Klassiker",
    "kategorie_stufe": 2
  }
]
```

Prüfen, ob alles lesbar ist (zeigt Warnungen oder „alles in Ordnung“):

```bash
node -e "const G=require('./js/game.js'),fs=require('fs'),r=(f)=>JSON.parse(fs.readFileSync('Datensammlung/'+f,'utf8')),w=[];const m=G.mergeBeers(r('biere.json'),r('biere_manuell.json'),r('kategorien.json'),(t)=>w.push(t));console.log(w.length?w.join('\n'):'alles in Ordnung: '+m.list.length+' Biere')"
```

Nach dem Push erscheinen neue Biere ab dem **übernächsten** Start der App (siehe nächster Abschnitt).

## Service Worker und Cache-Version

`sw.js` sorgt dafür, dass die App ohne Netz startet:

- **Eigene Dateien** (HTML, CSS, JS, Symbole): erst aus dem Netz, nur ohne Netz aus dem Cache. Nach einem Push kommt
  also beim nächsten Laden der neue Code.
- **Bierdateien**: sofort aus dem Cache, im Hintergrund aktualisiert. Änderungen an `biere.json` oder
  `biere_manuell.json` sind deshalb erst beim übernächsten Start sichtbar.
- **Firebase-Module** von gstatic: einmal geladen, dann aus dem Cache (die Adresse enthält die Version).

**`CACHE_VERSION` in `sw.js` erhöhen** (`'v1'` → `'v2'` …), wenn

- eine Datei **neu hinzukommt, umbenannt oder gelöscht** wird, die ohne Netz verfügbar sein soll (dann auch in die
  Liste `APP_FILES` bzw. `DATA_FILES` in `sw.js` eintragen),
- die **Firebase-Version** wechselt (an drei Stellen gleich halten: `FIREBASE_SDK` in `js/store.js` und `sw.js` sowie die
  drei `modulepreload`-Links in `index.html`).

Für normale Änderungen an vorhandenen Dateien ist das **nicht** nötig. Alte Caches löscht der Service Worker selbst.

## Spielregeln

- Eine Karte pro Bier; jedes Trinken wird einzeln gespeichert, die Karte zeigt, wie oft (z. B. „×4“).
- Punkte pro Bier: Standardgebräu 1,0 · Klassiker 1,1 · Spezialität 1,2 · Zaubertrank 1,4 · Heiligtum 1,6.
  Keine Extrapunkte für neue Biere.
- 20 Punkte = 1 Level; Start bei Level 1; Überschuss wird mitgenommen.
- Punkte, Level, Sammlung und Statistiken werden immer aus den Einträgen berechnet. Wird ein Eintrag gelöscht,
  sinken Punkte und notfalls das Level.
- Kein Nachtragen: Es zählt der Zeitpunkt des Bestätigens.
- Eine Rangliste gibt es noch nicht; Benutzernamen sind dafür schon vorbereitet.

## Rechtliches

- `impressum.html` und `datenschutz.html` enthalten nur **Platzhalter**. Sie müssen vor dem Veröffentlichen selbst
  ausgefüllt bzw. rechtlich geprüft werden. Die Datenschutzseite enthält eine technische Liste, was die App verarbeitet,
  als Arbeitshilfe – keinen Rechtstext.
- Die Bierdaten stammen von einer externen Website (siehe `Datensammlung/scraper/README.md`). Ob sie öffentlich
  verwendet werden dürfen, bitte vor dem Veröffentlichen klären.

## Bekannte Grenzen

- Ohne echtes Firebase-Projekt wurde Firebase nur mit einer Nachbildung getestet (siehe `CLAUDE.md`).
- Die Anmeldung erfolgt per Popup (wie in orga_app). In der installierten Web-App auf dem iPhone ist sie ungetestet;
  die installierte App hat dort einen eigenen, von Safari getrennten Speicher, eine Anmeldung in Safari gilt also nicht
  automatisch auch für sie.
- Liegt die Geräteuhr mehr als 5 Minuten vor, lehnt Firestore neue Einträge ab (Schutz gegen Einträge in der Zukunft).
- Ist die App beim Abmelden in einem zweiten Tab offen, kann die lokale Kopie erst gelöscht werden, wenn dieser Tab
  ebenfalls neu lädt.
