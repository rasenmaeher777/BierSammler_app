# Bier Sammler – Kontext für Claude Code

Diese Datei fasst zusammen, was entschieden, gebaut und gelernt wurde. Einrichtung und Bedienung stehen in `README.md`;
dort nachlesen statt hier doppeln. Stand: 18.11.2026.

## Worum es geht

Spielerische Web-App: Nach jedem getrunkenen Bier trägt der Spieler es ein. Jedes Bier ist eine Sammelkarte in einer von
sechs Seltenheits-Kategorien; Punkte lassen das Level steigen. Eigenes Konto per Google-Anmeldung, Fortschritt in
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
| `index.html` | Gerüst, Dialoge (`#add`, `#card`, `#stats`, `#ranking`, `#settings`, `#confirm`, `#age`, `#welcome`), Hinweis `#toast` (Popover), modulepreload |
| `css/style.css` | Farbvariablen oben: hell, dunkel per System (`:root:not([data-theme=light])`) und dunkel per Auswahl (`[data-theme=dark]`) – beide Dunkel-Blöcke gleich halten |
| `js/game.js` | Reine Funktionen (`window.GAME`, in Node per `require`): Punkte, Level, Formatierung, Bierdaten prüfen/zusammenführen, Suche, Protokoll, Sortierung, Wochen, Statistiken, Benutzername, Rangliste (`rankBoard`) |
| `js/store.js` | `window.STORE`: lokaler Modus (localStorage) oder Firebase (Auth, Firestore, Warteschlange, Namen) |
| `js/app.js` | Oberfläche (eine IIFE, sieben nummerierte Abschnitte) |
| `js/karte.js` | `window.KARTE` (STANDORT-KARTE): Standort beim Eintragen und die Vektorkarte der Orte, siehe „Standort-Karte“ |
| `js/firebase-config.js` | Konfiguration; leerer `apiKey` = lokaler Modus. Werte nicht ausgeben |
| `sw.js` | Service Worker |
| `firestore.rules` | Regeln (Nutzer fügt sie in der Konsole ein) |
| `tests/game.test.js` | Node-Tests der Spiellogik |
| `impressum.html`, `datenschutz.html` | Nur Platzhalter, KEINE Rechtstexte erfinden |
| `Datensammlung/karte/` | Kartendaten (`welt.json`, `deutschland.json`, `berlin.json`) und `bauen.py` (erzeugt sie aus den Grenzdaten) |
| `Datensammlung/` | `biere.json` (Scraper, nie ändern), `biere_manuell.json` (Nachträge), `biere_korrekturen.json` (Korrekturen), `kategorien.json`, `spezialkarten.json`, `scraper/` |

Ladereihenfolge: `firebase-config.js`, `game.js`, `store.js`, `karte.js`, `app.js`.

## Bierdaten

- `biere.json`: 6.368 Biere, IDs `BS-000001` … `BS-006368`, erzeugt von `Datensammlung/scraper/scraper.py`
  (Kategorie fest aus der ID abgeleitet, siehe „Kategorien“; `scraper/cache/id_zuordnung.json` hält die IDs stabil). NIE von Hand oder per
  Skript verändern.
- `biere_manuell.json`: gleiches Format, IDs `BM-000001` fortlaufend. Doppelte ID → Warnung, `biere.json` gilt.
  Stand 18.11.2026: `BM-000001`…`BM-000004` = die vier Kosmonaut-Biere (REWE-Marke, Quelle rewe-kosmonaut.de/de): Helles Flasche,
  Helles Dose (je 5,1 %, 0,5 l, Stufe 1), Helles alkoholfrei (0 = „alkoholfrei“, Stufe 2), Naturtrübes Radler (2,2 %, Saisonartikel, Stufe 3).
  Die Stufen sind eine Annahme (Seite nennt keine Seltenheit); Vertrieb „REWE“, Brauerei auf der Seite nicht genannt, Beschreibungen selbst formuliert.
  Stufe nachträglich ändern verschiebt die Punkte aller Spieler, die das Bier schon haben.
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
- Die Kategorie-STUFE ist intern (Sortierung, Punkte, Farbe `.k1`…`.k6`) und wird NIE angezeigt, nur der Name.
- Eigenheiten: 1.092× keine Beschreibung, 252× 0,0 % Alkohol, 2.064× mehrere Sorten, 1.082× keine Region,
  18 doppelte Namen (Treffer zeigen deshalb Flaschengröße und Alkohol), 2.379× Marke ≠ Firmenname, 1.518 ausländische Biere.

## Kategorien (19.11.2026)

- Sechs Stufen: 1 Standardgebräu (50 %), 2 Klassiker (15 %), 3 Spezialität (15 %), 4 **Raddelfuß** (10 %), 5 Zaubertrank (7 %), 6 Heiligtum (3 %).
  Punkte 10, 11, 12, 14, 14, 16 (Raddelfuß = Zaubertrank). Raddelfuß wurde am 19.11.2026 aus den früheren Klassikern (25 %) herausgeschnitten;
  Zaubertrank wurde Stufe 5, Heiligtum Stufe 6. Tatsächliche Zahlen in `biere.json`: 3.200 / 933 / 983 / 599 / 459 / 194.
- Zuordnung im Scraper (`kategorie()`): fester Zufallswert je ID, Bereiche in der Reihenfolge `ZIEH_REIHENFOLGE` (Raddelfuß liegt im Zufallsbereich
  zwischen Klassiker und Spezialität, NICHT bei Stufe 4 in der Reihe). Nur so behielt jedes andere Bier seine Kategorie – geprüft gegen die alte
  `biere.json`: 599 Klassiker → Raddelfuß, alle übrigen nur umnummeriert (4→5, 5→6), alle anderen Felder unverändert. `FESTE_KATEGORIE` hält einzelne
  Biere unabhängig vom Zufall: `BS-000887` Sternburg - Export bleibt Klassiker (wäre sonst Raddelfuß geworden; Wunsch des Nutzers).
  Neu erzeugt mit `python3 scraper.py --nur-export` (aus dem Cache, ohne Netz). `biere.json` weiter NIE von Hand ändern.
- Auswirkung auf Spieler: Die Umnummerierung (Zaubertrank 4→5, Heiligtum 5→6) ändert keine Punkte, denn die Punkte hängen am Wert, nicht an der Nummer
  (1,4 und 1,6 wie vorher). Geändert hat sich nur bei den 599 Bieren, die von Klassiker (1,1) auf Raddelfuß (1,4) gewechselt sind: Wer eines davon
  getrunken hat, bekommt rückwirkend 0,3 Punkte mehr je Eintrag. Die Rangliste korrigiert sich beim Öffnen selbst. In Firestore ist nichts zu migrieren.
- Firestore-Regeln unverändert nötig (Spanne 10…16 je Bier bleibt); nur der Kommentar in `firestore.rules` wurde angepasst.
- Daten-Cache: `biere.json` und `kategorien.json` werden mit `?stufen=6` geladen (`STUFEN_MARKE` in `js/app.js`, `DATA_FILES` in `sw.js`), `CACHE_VERSION` = `v4`.
  Ohne die Marke hätte der Service Worker (stale-while-revalidate) neuem Code einmal die alten Daten geliefert (falsche Punkte/Farben/Rangliste).
  Bei jeder weiteren Änderung der Stufen beide Stellen hochsetzen.
- Stufenlisten im Code stammen aus `GAME.STUFEN` (aus `POINTS`); Neue Stufe = `POINTS`, `kategorien.json`/Scraper, CSS (`--kN`, `.kN`, Muster, Rahmen, Band, drei Farbblöcke), Tests.
- Design Raddelfuß (`.k4`): Rot `--k4` (hell `#C62F2F`, dunkel `#F08A82`), rot-weißes Karo als Material (Maske aus zwei Streifenscharen), Zuckerstangen-Rahmen
  (rot-weiße Schrägstreifen, 3 px), Band rot mit zwei weißen Zierlinien, keine Holo-Folie und kein wandernder Glanz (die bleiben Zaubertrank und Heiligtum).

## Spezialkarten (19.11.2026)

- `Datensammlung/spezialkarten.json` (Format und Regeln in der README): Liste `{ id, titel, design, punkte?, biere[] }`. Der Nutzer pflegt sie selbst.
  Verarbeitung in `GAME.cleanSpecials` / `applySpecials` (innerhalb von `mergeBeers`, 6. Parameter). Jedes Bier bekommt `label` (Band-Text), `look`
  (CSS-Klassen der Karte, z. B. `k1 sp-baer`), `punkte` (Zehntel oder null) und `spezial` (null oder `{ id, titel, design }`). `GAME.beerPoints(beer)` gilt
  überall statt `pointsFor(beer.stufe)`. Kategorie/Stufe, Statistik „Sammlung“ und Sortierung bleiben unberührt (nur Band, Aussehen, ggf. Punkte).
- Drei Karten (ursprünglicher Stand; danach kamen die Länder-Legenden, Schwarz-Weiß und Regenbogen hinzu, siehe unten): **Berliner Legende** (`baer`, wie Standardgebräu `k1`, statt der Flasche der Berliner Bär, `bear()` in `js/app.js`; Farbe folgt dem Theme, ab 24 Mal
  Sterne, bei Lvl 40 golden): `BS-001490` Berliner - Pilsner, `BS-002764` Kindl Jubiläums Pilsener Premium, `BS-000885` Kindl Bock (nur „Bock“, nicht „Bock dunkel“
  `BS-000896`; der Nutzer hat die Frage nicht beantwortet, empfohlene Lesart), `BS-000882` Schultheiss Pilsener. **Bierball-Bier** (`sticker`, wie Standardgebräu, flacher
  „BB“-Stempel in Marineblau mit Creme-Innenring auf der linken oberen Ecke des Zierrahmens, Kartengrund als Rand, kein Glanz/Schatten; sitzt direkt in der Karte statt im
  Inhalt, damit er über dem Rahmen liegt; `punkte` 1.0): `BS-000887` Sternburg - Export (bleibt Klassiker, bringt aber nur 1,0 statt 1,1 Punkte; rückwirkend für Spieler,
  die es getrunken haben) und `BS-000057` Oettinger - Export. **Sanchi** (`sanchi`, eigenständig: nachtviolett mit abstrakten Kreisen und Bändern, Schrägband mit
  Verlauf und Großbuchstaben, gestrichelter Innenrahmen, bunter Verlaufsrahmen, feste Farben in hell und dunkel): 40 zufällig gezogene Standardgebräu-Biere
  (`random.Random("sanchi-2026-11-19").sample`, aus den 3.195 übrigen `BS`-Standardgebräu-Bieren, einmalig gezogen und fest in der Datei; nicht neu würfeln).
- **Länder-Legenden und zwei Designkarten (19.11.2026, später am Tag):** 15 weitere Legenden (ids `legende-bw|by|bb|hb|hh|he|mv|ni|nw|rp|sl|sn|st|sh|th`), je 5–10 bekannte Biere des
  Landes (Region laut `biere.json`; Astra hat dort keine Region, steht aber bei Hamburg; Sachsen-Anhalt hat nur 6 passende Biere). Look `k1 sp-icon` (wie Standardgebräu), statt der Flasche ein
  Wahrzeichen aus `ICONS` in `js/app.js` (SVG 60 × 86 wie der Bär; `icon()`/`symbol()`/`heroStars()`; Klassen `body`/`limb`/`cut`/`cutline`, CSS `.bear` in `style.css`):
  Kuckucksuhr BW, Brezel Bayern, Spreewaldgurke Brandenburg („Märkische Legende“), Schlüssel Bremen, Anker Hamburg, Bembel Hessen, Leuchtturm MV, Heidschnucke Niedersachsen („Nieders. Legende“),
  Kölner Dom NRW, Weintraube RLP, Schlägel und Eisen Saarland, Schwibbogen Sachsen, Himmelsscheibe von Nebra Sachsen-Anhalt („Anhalt Legende“), Strandkorb SH, Rostbratwurst Thüringen.
  Die Legenden haben KEIN `punkte`: Die Biere behalten die Punkte ihrer Stufe (die Biere sind bunt gemischt, nur Berlin ist reines Standardgebräu); Legende ändert also nur Band und Aussehen.
  Wer Standardpunkte für alle will, trägt `"punkte": 1.0` ein (wirkt rückwirkend).
  **Schwarze Nachtigal** (Design `noir`, id `schwarzweiss`; zuerst „Schwarz-Weiß“) und **Spezial-Edition 04** (Design `regenbogen`, id `regenbogen`; zuerst „Regenbogen“) – Titel am 19.11.2026 auf Wunsch umbenannt, IDs unverändert: je 40 Standardgebräu-Biere, gezogen mit `random.Random("schwarzweiss-2026-11-19" / "regenbogen-2026-11-19").sample`
  aus den noch freien `BS`-Standardgebräu-Bieren (nach Sanchi und Legenden, in dieser Reihenfolge; nicht neu würfeln). Noir: fest Papierweiß/Tinte, Comic-Raster, Strahlenkranz, harter Schatten,
  `filter: grayscale(1)` (macht auch die Herkunfts-Box grau). Regenbogen: Pastell mit Regenbogenbögen, funkelnde Glitzer-Sterne (`@keyframes glitter`, bei „weniger Bewegung“ ruhig),
  Regenbogenrahmen, Flasche mit Verlauf `#rb-grad` (SVG-Defs ganz oben in `index.html`; `fill: url(#rb-grad)`). Beide Farbsätze fest in hell und dunkel.
  Getestet: Node-Tests (44), eingebauter Browser mit Kopie ohne Schlüssel (390 px hell/dunkel, große Ansicht, Lvl 1/8/24/40). NICHT getestet: iPhone/Safari (Filter, Maske, `url(#…)`-Füllung), Glitzer-Animation (zeichnet der eingebaute Browser bei verdecktem Bereich nicht).
- **Heiliger Hopfen, Bierkönig, Außenseiter (19.11.2026, später am Tag):** drei weitere Karten mit je 35 Standardgebräu-Bieren (ids `heiliger-hopfen`, `bierkoenig`, `aussenseiter`, Designs `hopfen`, `koenig`, `weltall`,
  CSS `sp-hopfen|sp-koenig|sp-weltall`, wie Sanchi/Noir/Regenbogen eigenständig, feste Farben in hell und dunkel, Flasche bleibt das Symbol). Gezogen mit `random.Random("heiligerhopfen-2026-11-19" / "bierkoenig-2026-11-19" / "aussenseiter-2026-11-19").sample`
  (in dieser Reihenfolge) aus den dann noch freien `BS`-Standardgebräu-Bieren (3.003 frei); nicht neu würfeln.
  **Überarbeitet (19.11.2026, auf Wunsch: erste Fassung wirkte „KI-generiert“; Außenseiter blieb unverändert):** Grundsatz jetzt flach und konkret statt Verlauf + Glitzer + gekachelte Muster.
  Hopfen: tiefgrüner Grund, großer „Blattschnitt“ als EIN SVG (`background: cover`, `preserveAspectRatio slice`, kein Kacheln): zweifarbige Blätter in zwei Fächern (unten links, oben rechts), unter dem Text nur dunkle Töne,
  hellgrünes Band, flache Linie als Rahmen, helle Schrift. Bierkönig: gesteppter Samt wie ein Chesterfield-Sofa (40-px-SVG-Kachel: gewölbte Raute, Goldknöpfe an den Ecken), drei geschliffene Edelsteine
  (`.mat::after`, Animation `gem-glint`, leichtes Glimmen), flaches Gold ohne Metallverläufe: Doppellinie mit Eckornamenten, Band mit Krönchen, Schrift Creme. Die SVGs wurden mit einem Skript erzeugt und ins CSS
  eingebettet (Skript liegt nur im Scratchpad, nicht im Projekt; bei Änderungen die Data-URIs im CSS von Hand anpassen).
  Außenseiter: Nachthimmel mit Nebeln, Ringplanet, zwei Sternschichten (`twinkle-sky`), Band ohne `text-transform` (sonst würde „Außenseiter“ zu „AUSSENSEITER“). Bei „weniger Bewegung“ stehen die Animationen.
  Getestet: Node-Tests, eingebauter Browser (430 px, hell/dunkel, Lvl 1–40, große Ansicht, lange Titel);
  NICHT getestet: iPhone/Safari (SVG-Hintergründe mit `cover`/Mehrfachhintergründen, `outline-offset` negativ), Glimmen/Funkeln.
- **Spezial Rot / Türkis / Orange / Rosa (19.11.2026, später am Tag):** vier weitere Karten mit je 40 Standardgebräu-Bieren (ids `spezial-rot|tuerkis|orange|rosa`, Designs gleichen Namens → Klassen `sp-mono sp-rot|tuerkis|orange|rosa`,
  Titel „Spezial Rot“ usw., keine `punkte`). Gezogen mit `random.Random("<id>-2026-11-19").sample` (in der Reihenfolge Rot, Türkis, Orange, Rosa) aus den dann noch freien `BS`-Standardgebräu-Bieren (2.898 frei, danach 2.738); nicht neu würfeln.
  Design bewusst das Gegenteil aller anderen Karten: eine flache Einfarbfläche (`--c`, Schrift/Zeichnung `--ink`, Farben fest in hell und dunkel: Rot `#BD3B44`/Weiß, Türkis `#46B3AC`/`#062F2D`, Orange `#F0883A`/`#3A1A04`, Rosa `#F0A3BC`/`#4A1429`),
  kein Rahmen, Muster, Körnung, Verlauf, Zierrand, keine Folie, kein Balken; alles linksbündig, Band = kleine Großbuchstaben mit kurzem Strich, Titel in System-Sans statt Rounded, Chips und Herkunft nur als Umriss in der Schriftfarbe,
  Flasche einfarbig in der Schriftfarbe (auch auf der höchsten Stufe nicht golden), Karten-Level nur als heller Schimmer hinter der Flasche (`.sp-mono .bcard-body.t1…t5`) plus Glanz/Schaum/Sterne der Flasche. Kein JS nötig (Flasche bleibt das Symbol), nur `SPECIAL_DESIGNS` in `js/game.js`.
  `--k` = Kartenfarbe, damit der Farbstreifen in der Sammlungsliste (`border-left: var(--k)`) stimmt. `CACHE_VERSION` = `v7` (CSS und Spiellogik geändert; sonst bekäme der Service Worker einmal das alte CSS).
  Getestet: Node-Tests (48, die Spezialkarten-Prüfung der echten Datei um die vier Karten erweitert), eingebauter Browser mit Kopie ohne Schlüssel (430 px, hell und dunkel, Lvl 1/5/8/16/24/40, große Ansicht). NICHT getestet: iPhone/Safari, Desktop-Breite, Sammlungsliste (Streifenfarbe).
- Punkte `punkte` nur bei Bierball-Bier angegeben; Legende und Sanchi gelten nur für Standardgebräu-Biere (1,0), also ohne Punktänderung.
- `CACHE_VERSION` = `v5` (neue Datei in `DATA_FILES`). Im Zuge dessen behoben: Die Willkommenstext-Obergrenze der Punkte nutzte nach der Umnummerierung noch
  `pointsFor(5)` (1,4 statt 1,6); jetzt `G.MAX_STUFE`.
- Getestet: Node-Tests (44), eingebauter Browser mit Kopie ohne Schlüssel (hell/dunkel, 390 px und Desktop, große Kartenansicht, Karten-Level 1/4/8/24/40).
  NICHT getestet: iPhone/Safari (Masken, `clip-path`, Verlaufsrahmen mit `border-box`), Service Worker mit der neuen Datei, echtes Firebase.

## Standort-Karte (19.11.2026)

Alles trägt die Markierung `STANDORT-KARTE` (Kommentare in `js/app.js`, `js/store.js`, `js/game.js`, `index.html`, `sw.js`, `css/style.css`, `firestore.rules`).
Der Nutzer wollte ausdrücklich, dass sich die Funktion wieder entfernen lässt (z. B. wenn die Standortabfrage nervt); deshalb liegt das Meiste in eigenen Dateien.

- **Standort (js/karte.js, Teil 1):** Schalter in Einstellungen → „Standort“ (localStorage `biersammler-standort-v1`, **standardmäßig aus**). `KARTE.prepare()` holt beim Öffnen von
  „Bier hinzufügen“ im Hintergrund den Standort (`getCurrentPosition`, ohne hohe Genauigkeit, Zeitlimit 10 s, `maximumAge` 2 min; vorher Permissions-API: bei „denied“
  wird nicht noch einmal gefragt; ein frischer Wert < 3 min wird nicht neu geholt), `KARTE.place()` gibt beim Bestätigen { lat, lng } (gerundet, nicht älter als 10 min) oder `null`.
  Es wird NIE auf den Standort gewartet und nie beim Öffnen der App gefragt. Einschalten fragt sofort (Klick = Geste für iOS); verweigert → Schalter bleibt aus, Hinweistext;
  Zeitüberschreitung/kein Signal → bleibt an, Hinweis. Ausschalten vergisst die zwischengespeicherte Position.
- **Speichern:** `STORE.add(beerId, at, place)` hängt `lat`/`lng` an den Eintrag (`GAME.cleanPlace`: nur endliche Zahlen im gültigen Bereich, auf 3 Nachkommastellen = ca. 100 m gerundet;
  ungültig → Eintrag ohne Ort). `GAME.normalizeDrinks` reicht gültige Orte durch (ein ungültiger Ort verwirft den Eintrag NICHT). `GAME.placeGroups` fasst Einträge am selben gerundeten Ort zusammen.
  `firestore.rules`: `hasOnly(['beerId','at','lat','lng'])`, Funktion `validPlace` (beide oder keiner, Zahlen im Bereich). Es gibt KEINEN Update-Weg: Orte verschwinden nur mit dem Eintrag
  (Eintrag löschen, Zurücksetzen, Konto löschen). Ein Knopf „Standortdaten löschen“ wurde vom Nutzer abgelehnt (bräuchte eine Update-Regel).
- **Karte (js/karte.js, Teil 2):** Knopf `.map-open` „Karte der Orte öffnen“ mit `data-act="map"` ganz oben im Statistik-Dialog (`paintStats`; seit 19.11.2026 NICHT mehr auf der Startseite, Wunsch des Nutzers; sichtbar, wenn der Schalter an ist oder Einträge mit Ort existieren; die Karte öffnet sich über den Statistiken, Schließen führt dorthin zurück), Dialog `#karte` (feste Höhe 92 dvh bzw. 86 vh, die Karte füllt ihn). Eigene Vektorkarte auf einem `<canvas>` (Web-Mercator, Zoom 0,8…15, stufenlos), keine Kacheln, kein Dienst von außen.
  Ebenen nach Zoom: Staaten (ohne Deutschland), Bundesländer, Landkreise ab Zoom ≈ 6,2, Berliner Ortsteile ab ≈ 9 (Namen ab 10,2; Landkreisnamen 8,2–10,2; Bundesländer 4,6–8,6; Staaten bis 6,8).
  Farben (19.11.2026 überarbeitet): kühles Graugrün für Berlin (`--map-ort`), neutrales Grau für Land/Grenzen, milde graue Namen (Schriftschnitt 500), damit die orangenen Punkte (`--map-dot`) herausstechen; die Textumrandung der Namen hat je Ebene die Flächenfarbe. Namen weichen Punkten, Knöpfen, Quellenangabe und einander aus (11 Ausweichstellen); Gebiete mit Punkt werden zuerst beschriftet. Ab Zoom 10 entfällt die gröbere Berlin-Linie von BKG (sonst doppelte Grenze).
  Punkte: Radius `3,3 + 1,9·√(n−1)`, höchstens 14 px; je mehr Einträge am selben gerundeten Ort, desto größer. Tipp auf einen Punkt: Ort (Berliner Ortsteil, sonst Landkreis + Bundesland, sonst Staat), Anzahl und bis zu 4 Biere mit Datum in einem Info-Feld UNTER der Karte
  (`.map-info`, kein Überlagern mehr: ein früheres Feld über der Karte überdeckte Namen und Quellenangabe; die Karte wird dabei niedriger, der obere Rand bleibt, der gewählte Punkt wird bei Bedarf in Sicht geschoben; Texte per `textContent`, nie `innerHTML`). Bedienung: Ziehen, Zwei-Finger-Zoom (Pointer Events, `touch-action: none`), Mausrad, Doppeltippen, Knöpfe +/−/◎ („Alle Punkte“), Pfeiltasten und +/−.
  Startansicht: alle Punkte (höchstens Zoom 12), ohne Punkte Deutschland. Ohne Kartendaten (offline beim ersten Mal) werden die Punkte trotzdem auf leerem Grund gezeigt.
- **Kartendaten:** `Datensammlung/karte/*.json`, erzeugt von `bauen.py` (nur Standardbibliothek, Douglas-Peucker je Ring, Koordinaten als Ganzzahl-Differenzen; Format im Kopf des Skripts). Quellen: Natural Earth 1:50 Mio. (gemeinfrei),
  BKG VG250 `vg250_lan`/`vg250_krs`, nur Landflächen GF = 4 (dl-de/by-2-0, Quellenvermerk „© BKG (2025)“), Geoportal Berlin ALKIS Ortsteile (dl-de/zero-2-0). Die Rohdaten liegen NICHT im Projekt (Download-Adressen im Kopf von `bauen.py`).
  Größe: 169 + 394 + 41 KB, übertragen rund 220 KB. Die Quellenangabe steht unten in der Karte (`ATTRIBUTION` in `js/karte.js`) und muss dort bleiben. Nachbargrenzen werden einzeln vereinfacht: Linien über einer Grundfläche, keine sichtbaren Lücken.
  Der Service Worker legt die Kartendateien erst beim ersten Öffnen der Karte im Cache ab (`isData` in `sw.js`); `js/karte.js` steht in `APP_FILES`, `CACHE_VERSION` wurde dafür auf `v6` erhöht (inzwischen `v7`, siehe Spezialkarten).
- **Weitere Städte nachrüsten:** Rohdaten der Stadtteile laden, in `bauen.py` eine weitere Ebene erzeugen (eigene Datei), in `FILES`/`loadGeo`/`draw` von `js/karte.js` ergänzen (Zoomschwelle, Name in `placeName`).
- **Datenschutz:** Standort ist sensibel. Standardmäßig aus, nur auf ca. 100 m gerundet, nur für den Besitzer lesbar (Rangliste ohne Orte). `datenschutz.html`: nur in der „Technischen Arbeitshilfe“ ein Punkt ergänzt; der eigentliche Datenschutztext
  stammt vom Nutzer und wurde NICHT angefasst, er muss um Standortdaten ergänzt werden.
- **Entfernen der Funktion (Anleitung):**
  1. Neue Dateien löschen: `js/karte.js`, `Datensammlung/karte/` (Ordner), den Abschnitt „Standort und Karte“ in README/CLAUDE.md und den Punkt „Standort …“ in `datenschutz.html`.
  2. `index.html`: Dialog `#karte`, `<script src="js/karte.js">` (alle mit `STANDORT-KARTE` markiert).
  3. `js/app.js` (alle Stellen mit `STANDORT-KARTE`): `const KARTE`, in `paintStats` die Variable `mapBtn` (samt `mapBtn +` vor dem Rumpf), in `render` die Zeile `mapCtl.update`, in `add.open` `KARTE.prepare()`, in `add.confirm` `KARTE.place()`
     (zurück zu `STORE.add(beer.id, Date.now())`), Block „Karte“ mit `mapDlg`/`openMap`, in `openSettings` die Variable `standort` samt `${standort}`, die Funktion `toggleGeo` samt Zeile im `change`-Handler, `act === 'map'`.
  4. `css/style.css`: Abschnitt „Standort-Karte“ am Ende samt `.map-open` und die drei `--map-…`-Zeilen in den Farbblöcken.
  5. `sw.js`: `'js/karte.js'` aus `APP_FILES`, `CACHE_VERSION` erhöhen.
  6. Optional (die Regeln dürfen ruhig bleiben, sie sind nur großzügiger): `firestore.rules` (`validPlace` und `lat`/`lng` in `hasOnly`), `js/store.js` (`placeFields`, `place`-Parameter, `lat`/`lng` im Snapshot), `js/game.js` (`cleanPlace`, `placeGroups`, Orte in `normalizeDrinks`), die Tests „Standort-Karte“.
  Schon gespeicherte Orte bleiben in Firestore an den Einträgen; ohne die App-Funktion werden `lat`/`lng` einfach ignoriert (`normalizeDrinks` wäre ohne Schritt 6 weiter harmlos). Wer sie ganz loswerden will, löscht die Einträge oder das Profil.
- **Getestet:** Node-Tests (48, davon 4 zu Standort/Karte inkl. Kartendateien), eingebauter Browser (390 px hell/dunkel, Desktop): Karte öffnen, Zoom per Mausrad auf Berlin, Namen mit Ausweichstellen, Tipp auf Punkt, Wischen,
  simulierter Zwei-Finger-Zoom, Schalter an/aus/verweigert/Zeitüberschreitung (nachgebildetes `navigator.geolocation`), Eintrag mit und ohne Ort, Knopf „Karte“ je nach Zustand, leere Karte.
  NICHT getestet: echtes iPhone/Safari (Standortfrage in der installierten Web-App, wie oft sie kommt; echter Pinch; Canvas), echte Firestore-Regeln (kein Emulator), Service Worker mit den Kartendateien, > 100 Orte (Leistung der Namenssuche je Bild),
  Offline-Start mit noch nie geöffneter Karte (dann nur Punkte auf leerem Grund).

## Glückskeks-Sprüche (18.11.2026)

- `Datensammlung/nachrichten.json`: Liste `{ id, nachricht }` (id = Ganzzahl > 0 oder Text, eindeutig; Nutzer trägt die Sprüche selbst ein,
  vorhanden ist nur ein Probe-Spruch). Nach „Bestätigen“ steht der Spruch (`<p class="fortune">`) zwischen den Punkte-Zeilen und „Fertig“.
- Auswahl: `GAME.pickMessage` (zufällig unter den noch nicht gezeigten; alle gezeigt → von vorn, der zuletzt gezeigte nicht gleich wieder).
  Merker: localStorage `biersammler-messages-v1` (Liste der gezeigten IDs), also je Gerät/Browser, NICHT je Konto und nicht in Firestore
  (keine Regeländerung nötig). Entfernte IDs fallen aus dem Merker, neue Sprüche gelten als ungezeigt. Datei fehlt/leer → kein Spruch, kein Fehler.
- `CACHE_VERSION` wurde beim Anlegen auf `v3` erhöht (neue Datei in `DATA_FILES`). Tests: `cleanMessages`, `pickMessage`, echte Datei.
- NICHT im Browser getestet (kein Server startbar): Anzeige/Abstände, Umbruch langer Sprüche, hell/dunkel, 375 px.

## Spielregeln und Rechnen

- Punkte in Zehnteln: Stufe 1–6 = 10, 11, 12, 14, 14, 16. Level = floor(summe/100)+1, Ring = (summe mod 100)/100 (10 Punkte = 1 Level,
  seit 18.11.2026; vorher 20). `LEVEL_POINTS` in `js/game.js`; Text in Spielanleitung, Willkommensfenster, `aria-label` in `index.html` und README mitändern.
- Alles (Punkte, Level, Sammlung, Statistiken) wird aus dem Protokoll berechnet, nie gespeichert.
- Kein Nachtragen: Zeitpunkt = Geräteuhr beim Bestätigen. Keine Tages-Serien.
- Pflicht-Beispiele, die nach jeder Änderung exakt herauskommen müssen (`node tests/game.test.js`):
  0 → Level 1, Ring 0 · 10×Stufe 6 = 160 → Level 2, 6,0/10 · 10×Stufe 1 = 100 → Level 2, 0,0/10 · 20×Stufe 1 = 200 → Level 3, 0,0/10 ·
  19×Stufe 4 = 266 (Stufe 4 = Raddelfuß, 1,4) → Level 3, 6,6/10 · 13×Stufe 1 + 5×Stufe 6 = 210 → Level 3, 1,0/10 · 3×Stufe 2 = 33 → „3,3“.
- Karten-Level: Die Plakette auf der Karte zeigt „Lvl n“ (n = wie oft das Bier getrunken wurde; vorher „×n“). Ab 4, 8, 16,
  24 und 40 Mal verändert sich die Optik der Karte in fünf Stufen (`GAME.cardTier`, Klassen `t1`…`t5` auf `.bcard-body`
  und `.bottle`): Farbschimmer in der Mitte, Glanz, Schaumkrone, Strahlen, Sterne, goldene Flasche mit Funkeln. Rahmen
  und Band (Kategorie) bleiben unverändert. Die Stufen werden in der App NICHT erklärt (so gewünscht). Alles wird aus dem
  Protokoll berechnet, beim Löschen von Einträgen fällt die Karte also zurück. Ab Lvl 40 zählt die Zahl weiter.
  „Level“ ohne Zusatz bleibt das Spieler-Level in der Kopfleiste.
- Kartenoptik (18.11.2026, alle Karten gleicher Aufbau, nur das Material wechselt je Kategorie; Schrift unverändert):
  Ebenen `.mat` (Tönung, Muster als SVG-Maske, Körnung), `.foil` (Holo-Folie, nur Zaubertrank/Heiligtum), Zierrahmen
  (`.bcard::before`), Schriftband (`.band`, ein glatter durchgehender Balken oben, bewusst ohne Zacken und Naht), Herkunft im Fuß (`.origin .o`: kleine Box mit weißer Schrift, Farbe je Bundesland per
  `data-o` in `style.css` (Berlin rot, alle ≥ 4,5 : 1 zu Weiß), Ausland dunkles Blaugrau; Mecklenburg-Vorpommern und
  Nordrhein-Westfalen werden in der Box gekürzt), Lichtreflex (`::after`). Materialien: Standardgebräu Karton, Klassiker Leinen, Spezialität
  Kreisgeflecht, Zaubertrank Sternenstaub, Heiligtum gebürstetes Gold. Die Stufe (1–5) darf weiterhin NIE sichtbar sein
  (keine Sterne/Ziffern zum Zählen). Holo-Deckkraft je Theme über `--foil-k4/-k5` (dunkel schwächer, sonst unleserlich;
  beide Dunkel-Blöcke gleich halten). Große Ansicht: `tilt` in `js/app.js` setzt pro Bild nur CSS-Variablen (Maus/Finger
  neigt, sonst leichtes Schwanken; `.live` auf der Karte); `touch-action: pan-y`, damit der Dialog weiter scrollt; bei
  „weniger Bewegung“ keine Schleife. Zeitabhängige Glättung, Anheben (`--lift`) und Neigungssensor: Android sofort, iOS fragt beim ersten Antippen der
  Karte einmal nach (Ablehnung → `biersammler-motion-v1` = `0`, nie wieder fragen).
  Seit 19.11.2026 zusätzlich Einstellungen → „Neigung“ → Knopf „Neigungssensor aktivieren“ (`data-set="tilt"`, `enableTilt` → `tilt.enable()` in `js/app.js`): fragt ausdrücklich nach (läuft ohne `await` davor
  direkt im Klick, sonst lehnt iOS die Geste ab), hebt die Ablehnung `-motion-v1` auf, wartet bis 1,5 s auf einen echten Messwert und meldet `ok`/`nosensor`/`denied`/`unsupported`/`error`; der Abschnitt entfällt ohne `DeviceOrientationEvent`.
  Das Antippen der Karte fragt weiterhin von selbst (so belassen; Rückfrage des Nutzers dazu blieb offen). Getestet mit nachgebildetem `requestPermission` (abgelehnt, erlaubt ohne/mit Messwert, Fehler) und nachgebildetem Ereignis; NICHT auf echtem iPhone (ob iOS in der installierten Web-App nachfragt, wie oft, und ob nach Ablehnung ein Neustart nötig ist). Getestet im eingebauten
  Browser (hell/dunkel, 390 px, Desktop, Aufdecken, Sensor per nachgebildeten Ereignissen); NICHT auf echtem iPhone/Safari
  (Masken, `isolation`, Neigung per Finger, echter Sensor und dessen Richtung). Der eingebaute Browser zeichnet bei
  ausgeblendetem Bereich keine Animationen (Schleife steht).
- Wochen beginnen montags in Ortszeit (`weekStart`, `weekKey` über Kalendertage, DST-fest), KW nach ISO 8601.
  Ø/Woche = Anzahl / Wochen von der Woche des ersten Eintrags bis heute (beide eingeschlossen). Nie `toISOString()`.
- Suche: `fold` (klein, ß→ss, Akzente weg, Bindestriche/Apostrophe weg) und `unumlaut` (ae/oe/ue → a/o/u); ein Wort
  passt, wenn eine seiner beiden Formen in einer der beiden Formen des Suchtexts (Name + Firmenname) steht.
  So bleiben auch Zwischenstände beim Tippen erhalten („brau“ → „Brauerei“). Wortanfänge zuerst, höchstens 10 Treffer.

## Datenmodell und Sync (`js/store.js`)

```
users/<uid>                  { username?, usernameKey? }      optionale Felder fehlen, nie undefined/null
users/<uid>/drinks/<autoId>  { beerId: "BS-000001", at: <ms, Ganzzahl>, lat?, lng? }   nur create/delete; lat/lng nur mit Standort-Schalter (siehe „Standort-Karte“)
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
- localStorage-Schlüssel: `biersammler-drinks-v1` (nur lokaler Modus), `-theme-v1`, `-age-v1`, `-more-v1`, `-uid-v1`, `-motion-v1`, `-welcome-v1`, `-standort-v1` (Standort-Schalter, „1“ = an); sessionStorage `-deleted-v1`.

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

## Konto löschen (18.11.2026)

- Einstellungen → Konto → „Konto löschen …“ (`deleteAccountFlow` in `js/app.js`, `STORE.deleteAccount` in `js/store.js`), nur im Firebase-Modus.
  Bestätigung mit Eintippen von „LÖSCHEN“. Reihenfolge im Store: (1) `reauthenticateWithPopup` (Firebase verlangt frische Anmeldung;
  vorher, damit der letzte Schritt nicht scheitert, wenn schon alles weg ist; anderes Google-Konto → `user-mismatch`), (2) Daten löschen
  MIT Serverbestätigung (`getDocsFromServer` für die Einträge, plus lokal noch nicht übertragene; Batches zu je ≤ 497 Einträgen, im
  LETZTEN Batch zusammen Namensfreigabe `usernames/<key>`, `leaderboard/<uid>`, `users/<uid>`, weil die Regeln die Namensfreigabe im
  selben Vorgang verlangen; Schlüssel aus `users/<uid>.usernameKey` vom Server), (3) `deleteUser`. Danach meldet `onAuthStateChanged` ab,
  `wipeAndReload` leert den Zwischenspeicher, nach dem Neuladen erscheint „Dein Konto wurde gelöscht.“ (sessionStorage `biersammler-deleted-v1`).
- Fehlercodes: `offline`, `cancelled`, `popup`, `mismatch`, `partial` (Daten weg, Konto besteht noch; erneuter Versuch ist gefahrlos), `error`.
  `deleting` verhindert währenddessen das Neu-Veröffentlichen in der Rangliste.
- Keine Regeländerung nötig (Besitzer darf alle eigenen Dokumente löschen). Neue Spieler-UID entsteht bei erneuter Anmeldung.
- Getestet mit nachgebildetem Firebase (Import-Map auf lokale Module in einer Scratchpad-Kopie): Abbruch beim Google-Popup (nichts gelöscht),
  Fehler bei `deleteUser` (Daten weg, Meldung „partial“, Wiederholung klappt), Erfolg (Abmelden, Neuladen, Meldung), Namensfreigabe im selben
  Batch (nachgebildete Regel), 375 px. NICHT getestet: echtes Firebase (Popup, `requires-recent-login`, echte Regeln), Offline-Fall, > 497 Einträge
  im echten Firestore, iPhone/Safari (Popup nach der Bestätigung im Dialog könnte dort blockiert werden → Meldung „Popups erlauben“).

## Willkommensfenster (18.11.2026)

- `#welcome` (`maybeWelcome`/`showWelcome` in `js/app.js`): öffnet sich einmal je Konto und Gerät direkt nach der ersten Anmeldung,
  zeigt die wichtigsten Regeln (Sammeln, Punkte, Level, Kein Nachtragen, Verantwortung) und den Hinweis, dass man für die
  Platzierung einen Benutzernamen braucht (Einstellungen → Benutzername). Knöpfe: „Benutzernamen erstellen“ (öffnet die
  Einstellungen mit Fokus im Namensfeld) und „Verstanden“. Im lokalen Modus nur die Regeln, ohne Namenshinweis.
- Merker: localStorage `biersammler-welcome-v1` = Komma-Liste der Konto-IDs (lokal: `local`); gilt als gesehen, sobald geöffnet.
  Ein anderes Konto auf demselben Gerät sieht es einmal selbst. Bestehende Spieler sehen es nach dem Update ebenfalls einmal.
- Reihenfolge: Altershinweis (`#age`) zuerst; ist er noch offen, wartet das Willkommensfenster (Knopf ruft `maybeWelcome()` auf).
- Getestet in einer Kopie mit leerem `apiKey` (lokaler Modus; Online-Variante per umgestelltem `STORE.mode`/`status`/`uid`),
  375 px. NICHT getestet: echte Google-Anmeldung, iPhone, Dunkelmodus.

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

- Icons (19.11.2026, ersetzt die vom 18.11.): `icons/` aus dem neuen Bild des Nutzers (512 × 512, cremefarbener Grund mit Höhenlinien, braune Bierflasche)
  erzeugt, mit `sips` skaliert, Alphakanal entfernt (Umweg über JPEG; iOS zeichnet sonst Schwarz). `icon-maskable-512.png` = dasselbe Bild unverändert:
  Der Grund füllt schon das ganze Quadrat und die Flasche liegt innerhalb der Sicherheitszone (Kreis, Radius 40 %). Auf dem iPhone erscheint das neue Symbol erst, wenn die
  Web-App vom Home-Bildschirm entfernt und neu hinzugefügt wird.
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
