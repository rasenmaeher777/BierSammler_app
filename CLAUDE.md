# Bier Sammler – Kontext für Claude Code

Diese Datei fasst zusammen, was entschieden, gebaut und gelernt wurde. Einrichtung und Bedienung stehen in `README.md`;
dort nachlesen statt hier doppeln. Stand: 19.11.2026.

## Worum es geht

Spielerische Web-App: Nach jedem getrunkenen Bier trägt der Spieler es ein. Jedes Bier ist eine Sammelkarte in einer von
fünf Seltenheits-Kategorien (nach Erhältlichkeit); Punkte lassen das Level steigen. Eigenes Konto per Google-Anmeldung, Fortschritt in
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
| `js/info.js` | `window.INFO` (INFO-FENSTER): Text des Info-Fensters „Bierwissen“, siehe „Info-Fenster“ |
| `js/firebase-config.js` | Konfiguration; leerer `apiKey` = lokaler Modus. Werte nicht ausgeben |
| `sw.js` | Service Worker |
| `firestore.rules` | Regeln (Nutzer fügt sie in der Konsole ein) |
| `tests/game.test.js` | Node-Tests der Spiellogik |
| `impressum.html`, `datenschutz.html` | Nur Platzhalter, KEINE Rechtstexte erfinden |
| `Datensammlung/karte/` | Kartendaten (`welt.json`, `deutschland.json`, `berlin.json`) und `bauen.py` (erzeugt sie aus den Grenzdaten) |
| `Datensammlung/` | `biere.json` (Scraper, nie ändern), `biere_manuell.json` (Nachträge), `biere_korrekturen.json` (Korrekturen), `kategorien.json`, `spezialkarten.json`, `scraper/` |

Ladereihenfolge: `firebase-config.js`, `game.js`, `store.js`, `karte.js`, `info.js`, `app.js`.

## Bierdaten

- `biere.json`: 6.368 Biere, IDs `BS-000001` … `BS-006368`, erzeugt von `Datensammlung/scraper/scraper.py`
  (Kategorie aus `scraper/stufen_zuordnung.json`, siehe „Kategorien“; `scraper/cache/id_zuordnung.json` hält die IDs stabil). NIE von Hand oder per
  Skript verändern.
- `biere_manuell.json`: gleiches Format, IDs `BM-000001` fortlaufend. Doppelte ID → Warnung, `biere.json` gilt.
  Stand 18.11.2026: `BM-000001`…`BM-000004` = die vier Kosmonaut-Biere (REWE-Marke, Quelle rewe-kosmonaut.de/de): Helles Flasche,
  Helles Dose (je 5,1 %, 0,5 l, Stufe 1), Helles alkoholfrei (0 = „alkoholfrei“, Stufe 2), Naturtrübes Radler (2,2 %, Saisonartikel, Stufe 2; bis 19.11.2026 Stufe 3).
  Die Stufen sind eine Annahme (Seite nennt keine Seltenheit); Vertrieb „REWE“, Brauerei auf der Seite nicht genannt, Beschreibungen selbst formuliert.
  Stufe nachträglich ändern verschiebt die Punkte aller Spieler, die das Bier schon haben.
  Nachtrag 20.11.2026: `BM-000005`…`BM-000007` = die übrigen Sorten von berliner-pilsner.de neben dem schon vorhandenen `BS-001490` (Berliner - Pilsner): Mildes Lager (4,8 %),
  Pranke (Vollbier, 6 %), Natur Radler (2,5 %); alle Klassiker/Stufe 2, Brauerei Berliner-Kindl-Schultheiss wie beim Pilsner. Mildes Lager = Klassiker auf Wunsch des Nutzers, die anderen von Claude gewählt.
  Die Seite nennt weder Flaschengröße (angenommen 0,5 l wie beim Pilsner) noch den Alkohol des Radlers (2,5 % = halb Pilsner mit 5,0 %, abgeleitet); Beschreibungen sind gekürzt aus dem Seitentext.
  Nachtrag 21.11.2026 (Wunsch des Nutzers): `BM-000008` = „Unbekanntes Bier“, Standardgebräu/Stufe 1, Alkohol 4,9 %, sonst alles leer (keine Sorte, Brauerei, Zutaten, Flaschengröße);
  die Beschreibung sagt, dass man es wählen darf, wenn ein Bier nicht in der Datenbank steht (z. B. Kneipenbiere ohne Angaben im Netz). Es ist eine gewöhnliche Karte: 1,0 Punkte je Trinken,
  einmal 3,5 Bonus für die neue Karte. Ohne Flaschengröße zählt es in der Alkohol-Auswertung nicht mit (siehe dort). Findbar über die Suche („unbek“); die Spielanleitung (`howtoHtml` in `js/app.js`) hat dazu den Absatz „Bier nicht gefunden?“. Auf der Karte steht unter dem Alkohol ein großes Fragezeichen (`.mystery` in `css/style.css`, `UNKNOWN_BEER_ID` in `js/app.js`), damit sie so hoch ist wie Karten mit Marke, Sorte und Herkunft (bei 390 px beide 247 px; ändert sich der Kartenaufbau, die 51 px neu messen). Keine neue Datei, `CACHE_VERSION` unverändert.
  Getestet: Node-Tests (58), Zusammenführen ohne Warnung (6.376 Biere), Suche, Eintragen, Kartenansicht samt Beschreibung im eingebauten Browser (390 px, lokaler Modus). NICHT getestet: iPhone/Safari, echte Firestore-Regeln (ID passt zu `^B[SM]-[0-9]{6}$`).
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

## Kategorien (19.11.2026, Umbau auf Erhältlichkeit am Abend)

- Fünf Stufen nach Erhältlichkeit (Wunsch des Nutzers: Seltenheit soll „jagbar“ sein statt Zufall): 1 Standardgebräu (in fast jedem Supermarkt),
  2 Klassiker (Supermarkt, aber nur regional oder nicht überall), 3 Spezialität (Getränkemarkt/Kneipe), 4 Zaubertrank (selten), 5 Heiligtum (kaum im Handel).
  Punkte 10, 12, 13, 15, 25 (Zehntel; vom Nutzer so festgelegt). Zahlen in `biere.json`: 107 / 333 / 1.810 / 2.447 / 1.671 (+ Kosmonaut 2× Stufe 1, 2× Stufe 2).
  Die Verteilung kippt bewusst nach oben: Die Datenbank (bier-universum.de) besteht überwiegend aus kleinen bayerischen/BW-Brauereien und Importen.
- Raddelfuß ist KEINE Kategorie mehr, sondern eine Zufalls-Spezialkarte (Design `raddelfuss`, Klasse `sp-raddel`, siehe Spezialkarten).
  CSS dafür umbenannt: alte `.k4`/`--k4`/`--on-k4` (Raddelfuß) → `.sp-raddel`/`--rd`/`--on-rd`; alte `k5` → `k4` (Zaubertrank), alte `k6` → `k5` (Heiligtum), ebenso `--foil-k…`.
- Einordnung (von Claude geschätzt, Nutzer weiß, dass sie nicht exakt ist): alle Biere der bundes- und landesweiten Marken (rund 900) einzeln,
  rund 860 Brauereien von Hand, die übrigen ~570 nach Regel (Ausland → 5, Gasthaus-/Hausbrauerei → 5, deutsche Brauerei nach Zahl der Biere: ≥ 15 → 3, 3–14 → 4, ≤ 2 → 5);
  Sonder-/limitierte Editionen +1, Saisonbiere +1 bei Brauerei ≤ 3. Ergebnis in `Datensammlung/scraper/`: `stufen_zuordnung.json` (ID → Stufe, gilt),
  `stufen_brauereien.json` (Brauerei → Stufe, für neue Biere), `stufen_vorschlag.csv` (Übersicht mit Begründung, wird nicht gelesen). Die Hilfsskripte lagen nur im Scratchpad.
- Scraper (`kategorie(bier_id, name, firma)`): erst `stufen_zuordnung.json`, sonst Brauerei-Stufe + Regeln wie oben; kein Zufall mehr (`ZIEH_REIHENFOLGE`, `FESTE_KATEGORIE`, `anteil` entfernt).
  `biere.json` neu erzeugt mit `python3 scraper.py --nur-export`; geprüft: nur `kategorie_name`/`kategorie_stufe` geändert, alle 6.368 passen zur Zuordnung.
- Auswirkung auf Spieler: Fast jedes Bier hat die Stufe gewechselt (von 3.200 früheren Standardgebräu-Bieren sind 52 geblieben); Punkte und Level ändern sich
  rückwirkend, die Rangliste korrigiert sich beim Öffnen. In Firestore ist nichts zu migrieren, aber `firestore.rules` erlaubt jetzt 10…35 je Bier (vorher 16):
  NEUE REGELN VOR DER APP VERÖFFENTLICHEN, sonst lehnt Firestore die Ranglisten-Einträge von Spielern mit Heiligtum/Spezialkarten ab.
- Daten-Cache: Marke `?stufen=5` an `biere.json`, `biere_manuell.json`, `kategorien.json` und `spezialkarten.json` (`STUFEN_MARKE` in `js/app.js`, `DATA_FILES` in `sw.js`),
  `CACHE_VERSION` = `v11` (seit dem Kartenbonus; vorher `v10`). Vorher `?stufen=6` (nur biere/kategorien). Bei jeder weiteren Änderung der Stufen beide Stellen hochsetzen.
- Stufenlisten im Code stammen aus `GAME.STUFEN` (aus `POINTS`); `MAX_BONUS` = 10, `MAX_BEER_POINTS` = 35 (Rangliste, Regeln).
- Sicherung des Stands vor dem Umbau: damals nur im Scratchpad der Sitzung. Inzwischen ist das Projekt ein Git-Repository (Branch `main`); der Nutzer committet selbst.

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
  Nachtrag 19.11.2026 (Wunsch des Nutzers): `BS-004132` Astra - Rakete ist eine Hamburger Legende mit festen 1,0 Punkten. Weil `punkte` immer für eine ganze
  Karte gilt, liegt sie auf einer EIGENEN Karte `hh-rakete` (Titel „Hamburger Legende“, Design `anker`, `"punkte": 1.0`, direkt nach `legende-hh`; dort bleiben 8 Biere).
  Sieht für Spieler gleich aus. Stufe bleibt intern Spezialität (nur über `stufen_zuordnung.json` + Scraper-Export änderbar), sichtbar ist nur „Hamburger Legende“.
  Die ID beginnt bewusst nicht mit `legende-`: Der Test der echten Datei zählt 16 Legenden mit Stufenpunkten; `hh-rakete` prüft er gesondert.
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
  `--k` = Kartenfarbe, damit der Farbstreifen in der Sammlungsliste (`border-left: var(--k)`) stimmt. `CACHE_VERSION` damals `v7` bis `v9` (aktueller Stand siehe „Kategorien“: `v11`).
  Getestet: Node-Tests (48, die Spezialkarten-Prüfung der echten Datei um die vier Karten erweitert), eingebauter Browser mit Kopie ohne Schlüssel (430 px, hell und dunkel, Lvl 1/5/8/16/24/40, große Ansicht). NICHT getestet: iPhone/Safari, Desktop-Breite, Sammlungsliste (Streifenfarbe).
- Feste Punkte (`punkte`) haben nur Bierball-Bier und `hh-rakete` (je 1,0); die Legenden behalten die Punkte ihrer Stufe, die elf Zufallskarten haben `bonus` 1,0 (siehe unten).
- **Neu gezogen und Bonus (19.11.2026, abends, mit dem Umbau auf 5 Stufen):** Die elf Zufallskarten (Sanchi, Schwarze Nachtigal, Spezial-Edition 04, Heiliger Hopfen,
  Bierkönig, Außenseiter, Spezial Rot/Türkis/Orange/Rosa und NEU Raddelfuß, id/Design `raddelfuss`, ans Ende der Datei) haben jetzt je 40 Biere und `"bonus": 1.0`
  (Wunsch: Punkte der Hauptkategorie + 1 Punkt). Gezogen mit `random.Random("<id>-2026-11-19-stufen5").sample` in Dateireihenfolge aus den freien `BS`-Bieren der
  Stufen 2–5 (ohne Legenden/Bierball), je Karte 9 Klassiker / 10 Spezialität / 10 Zaubertrank / 11 Heiligtum („gleichmäßig mit ganz leichter Tendenz zu selteneren“).
  Die ÄLTEREN Angaben oben zu „je 40/35 Standardgebräu-Biere“ und den Samen `…-2026-11-19` sind damit überholt. Legenden und Bierball unverändert (Bierball: feste 1,0;
  Sternburg und Oettinger Export sind jetzt Standardgebräu). `cleanSpecials` prüft `bonus` (0,0…1,0 in Zehnteln); `beerPoints` = `punkte` falls gesetzt, sonst Stufe + `bonus`.
  Die echte Kategorie ist auf Spezialkarten nicht sichtbar (Band und „Kategorie“ in der Kartenansicht zeigen den Titel); die Statistik „Sammlung“ zählt weiter nach Stufe.
- **Sonderedition 10 bis 60 (20.11.2026, Wunsch des Nutzers: „hebt sich deutlich ab und sieht hochwertig aus“ wie die Farbkarten, aber je eigenes Design):** sechs Karten
  (ids/Designs `sonderedition-10` … `-60`, Titel „Sonderedition 10“ … „60“, `"bonus": 1.0`, ans Ende der Datei) mit je 40 Bieren NUR aus Stufe 3 (Spezialität), gezogen mit
  `random.Random("sonderedition-<n>-2026-11-20").sample(pool, 40)` (sortiert) in der Reihenfolge 10…60 aus den nach ID sortierten freien `BS`-Spezialitäten (1.641 frei, danach 1.401); nicht neu würfeln.
  Klassen `sp-se sp-se10` … `sp-se60` (CSS-Abschnitt „Sonderedition 10 bis 60“ nach den Farbkarten), kein JS nötig (Flasche bleibt das Symbol), alle Farben fest in hell und dunkel, `--k`/`--on-k`
  auf der Klasse selbst (Sammlungsliste). Gemeinsam: Sans-Titel, keine Kategorie-Muster; die Zahl steckt teils als Gestaltung in `.mat::before { content }` (aria-hidden).
  10 Bauhaus: Creme, schwarze Kontur, rote Scheibe mit „10“, gelbes Dreieck, blauer Viertelkreis, linksbündig (eigene Level-Scheine links, keine Strahlen). 20 Neon: Schwarz, Messraster, „20“ als Limetten-Umriss
  hinter der Flasche, Sucher-Ecken, Monospace, Flasche als Kontur (Lvl 40 gefüllt), Level-Schein gedämpft. 30 Risographie: Papier, Pink/Blau mit `background-blend-mode: multiply`, „30“ überdruckt,
  versetzte Schatten, ausgesparte Flasche. 40 Höhenlinien: SVG 280 × 420 in fester Größe, Gipfel bei (140, 78) hinter der Flasche, „▲ 40“. 50 Terrazzo: ein SVG (cover), in der Textmitte nur kleine helle Steine
  (dunkle Splitter neben dem Text wirkten wie Satzzeichen), „Nº 50“-Schildchen, Level-Schein gedämpft. 60 Art déco: Petrol/Kupfer, Strahlenfächer vom Band (maskierter `repeating-conic-gradient`) mit zwei Bögen,
  gestufte Rahmenecken über eigene `--corner-*`, Band in Didot, keine Strahlen. Die SVGs (40, 50) erzeugte ein Skript im Scratchpad; bei Änderungen die Data-URIs im CSS von Hand anpassen.
  Bänder: bei 375 px Breite (Karten ca. 165 px) passen alle Titel; unter 360 px enger gesetzt (`@media (max-width: 359px)`), geprüft bei 320 px. Keine neue `CACHE_VERSION` (keine neue Datei).
  Getestet: Node-Tests (49; Test der echten Datei um die sechs Karten erweitert: je 40, nur Stufe 3, Titel, Aussehen, Punkte 1,3 + 1,0), eingebauter Browser mit Kopie ohne Schlüssel
  (430/375/320 px, hell und dunkel, Lvl 1/8/40, große Ansicht 10 und 40 mit „+2,3“, Farbstreifen der Sammlungsliste per berechnetem Stil).
  NICHT getestet: iPhone/Safari (`background-blend-mode`, `mix-blend-mode`, `-webkit-text-stroke`, Didot), Desktop-Breite, „Sammlung verwalten“ als echter Dialog.
- **Punkte je Bier in der Kartenansicht (19.11.2026):** neben „Gesammelte Punkte“ eine Pille `.per-beer` mit „+1,5“ (= `GAME.beerPoints`), für jede Karte;
  Spielanleitung erwähnt, dass Sonderkarten einen Punkt mehr bringen.
- Getestet (Umbau): Node-Tests (48), eingebauter Browser mit Kopie ohne Schlüssel (375 px hell/dunkel): Raddelfuß-, Sanchi-, Spezial-Rot-, Heiligtum-, Zaubertrank-Karten,
  Kartenansicht mit „+3,5“/„+2,5“/„+1,5“/„+1,3“ und richtigen Summen, Kategorie verborgen, Statistik „Sammlung“ mit 5 Stufen, Spielanleitung, keine Konsolenfehler.
  NICHT getestet: iPhone/Safari, echtes Firebase mit den neuen Regeln, Service-Worker-Wechsel von v9 auf v10.
- `CACHE_VERSION` wurde damals auf `v5` erhöht (neue Datei in `DATA_FILES`; aktueller Stand `v11`). Im Zuge dessen behoben: Die Willkommenstext-Obergrenze der Punkte nutzte nach der Umnummerierung noch
  `pointsFor(5)` (1,4 statt 1,6); jetzt `G.MAX_STUFE`.
- Getestet: Node-Tests (44), eingebauter Browser mit Kopie ohne Schlüssel (hell/dunkel, 390 px und Desktop, große Kartenansicht, Karten-Level 1/4/8/24/40).
  NICHT getestet: iPhone/Safari (Masken, `clip-path`, Verlaufsrahmen mit `border-box`), Service Worker mit der neuen Datei, echtes Firebase.

- **Neuer Berliner Bär (19.11.2026, Wunsch des Nutzers):** Der gezeichnete Bär (Zunge, Nase, Auge, Strich-Gliedmaßen) wurde durch die Silhouette aus einer
  Vorlage des Nutzers ersetzt (schwarzer Wappenbär, schaut nach LINKS). Wichtig für den Nutzer: Es ist ein Berliner Wahrzeichen, die Form muss exakt der
  Vorlage entsprechen – `BEAR_PATH` in `js/app.js` NIE von Hand ändern oder „verschönern“. Erzeugt per Skript (nur im Scratchpad): Marching Squares auf der
  Helligkeit des Bildes (509 × 360 px), ein Ring, Douglas-Peucker mit 0,35 px, auf Höhe 82 im Bildfeld 60 × 86 skaliert (x 6…54, y 2…84), 161 Punkte.
  Geprüft: gegen das Originalbild gerastert 99,4 % deckungsgleich (146 von 24.946 Pixeln abweichend, davon 144 im Kantensaum).
  Farbe wie die Wahrzeichen (Theme, golden bei Lvl 40; Entscheidung des Nutzers). Eigene Sternplätze `BEAR_STARS`/`BEAR_STARS_MORE` (die üblichen
  `HERO_STARS` lagen auf den Pfoten); geprüft, dass kein Stern den Bären berührt. CSS-Regeln `.leg`, `.arm`, `.tongue`, `.nose`, `.eye` entfernt.
  Getestet: eingebauter Browser 375 px hell/dunkel, Lvl 1/24/40, große Ansicht. NICHT getestet: iPhone/Safari.

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

## Info-Fenster „Bierwissen“ (20.11.2026)

Alles trägt die Markierung `INFO-FENSTER` (`index.html`, `js/app.js`, `css/style.css`, `sw.js`) und liegt im Übrigen in `js/info.js` (`window.INFO`). Auf Wunsch des Nutzers.

- Knopf `[data-act="info"]` (runder `.icon-btn.info-btn` mit „i“-Symbol) in `.tools`, zwischen „Platzierung“ und dem Sync-Hinweis (also links von den Einstellungen). Unter 480 px mit Platzierung:
  nur der Einstellungs-Knopf rutscht per `[data-act="settings"]` (order 2, margin-left auto) hinter den Sync-Hinweis, der Info-Knopf bleibt neben „Platzierung“ (vorher traf die Regel `.icon-btn` beide).
- Dialog `#info` (`openInfo` in `js/app.js`, hinter dem Ranglisten-Block): Kopf wie die anderen Blätter, Inhalt = `INFO.html()`. Der Text ist fest im Code (keine Eingaben, deshalb kein `esc()`).
  Aufbau: Biersorten (sechs aufklappbare Gruppen `.info-group`: Helle Lagerbiere, Weizenbiere, Dunkle und kräftige Biere, Ales und Craft-Biere, Mischgetränke und Alkoholfreies, Bier mit besonderer Zutat),
  Geschmack (21 Begriffe), Wissenswertes (11 Einträge). Die Sortennamen decken alle Werte von `biersorte` in `biere.json` ab (Fruchtbiere usw. als Sammeleinträge); neue Sorten: Zeile in `SORTEN` ergänzen.
- Inhaltlich von Claude aus Allgemeinwissen formuliert (nicht aus Quellen der Bierdatenbank). Der Nutzer sollte die Angaben gegenlesen, besonders Zahlen (Stammwürze, Trinktemperaturen, IBU) und Herkunftsangaben.
  Bewusst nicht aufgenommen: Hinweise zu Seltenheitsstufen (stehen in der Spielanleitung; die Stufenzahl darf nie sichtbar sein).
- `CACHE_VERSION` = `v12` (neue Datei `js/info.js` in `APP_FILES`).
- Entfernen: Knopf und Dialog in `index.html`, `<script src="js/info.js">`, `INFO`/`openInfo`/`act === 'info'` in `js/app.js`, Abschnitt am Ende von `css/style.css`, Zeile in `sw.js` (`CACHE_VERSION` erhöhen), `js/info.js` löschen.
- Untertitel der Gruppen (`.info-group > summary .h-sub`) stehen in eigener Zeile (sonst brachen sie mitten im Satz um). Bei < 360 px mit Platzierung sind die beiden Textknöpfe kleiner
  (14 px, Innenabstand 9 px, Abstand 5 px), damit alle vier Knöpfe auch bei 320 px in einer Zeile stehen (ohne das rutschte der Einstellungs-Knopf in eine zweite Zeile).
- Getestet: `node --check` aller JS-Dateien, Node-Tests (49), `INFO.html()` auf paarige Tags geprüft, Abdeckung der Werte von `biersorte`; eingebauter Browser mit Kopie ohne Schlüssel
  (375 px hell/dunkel, 320 px, schmale Desktop-Breite): Knopf, Öffnen/Schließen, aufklappbare Gruppen, Geschmack/Wissenswertes, keine Konsolenfehler. Die Platzierung wurde nur per Skript
  eingeblendet (`hidden` entfernt, `has-rank` gesetzt), weil dafür eine Anmeldung nötig wäre. NICHT getestet: Safari/iPhone (`<details>`-Pfeil, Dialog), Service Worker mit `js/info.js`, Tastaturbedienung.

## Alkohol-Auswertung (20.11.2026)

Alles trägt die Markierung `ALKOHOL-AUSWERTUNG` (`js/game.js`, `js/app.js`, `js/store.js`, `css/style.css`). Auf Wunsch des Nutzers, nach einer Recherche am selben Tag
(Quellen unten). Es gibt KEINE neue Datei; deshalb keine neue `CACHE_VERSION` (bleibt `v12`).

- **Einstellungen → „Körperdaten“** (`openSettings` in `js/app.js`, Abschnitt `koerper`): Segmentschalter „männlich/weiblich“ (Optionsfelder `name="sex"`) und Gewichtsfeld `#set-kg`
  (freiwillig, 30–250 kg, `GAME.parseKg`: „64“, „64,5“, „64 kg“); jede Änderung wird sofort gespeichert (`change`), ein ungültiges Gewicht wird NICHT gespeichert (altes bleibt, Meldung rot),
  leeres Feld entfernt das Gewicht; „Körperdaten löschen“ (`data-set="bodyclear"`) leert beides. Die Bezeichnung „Natürliches Geschlecht“ stammt vom Nutzer.
- **Speicher:** localStorage `biersammler-koerper-v1` = `{ sex: 'm' | 'w', kg }` (je Gerät, `readBody`/`writeBody` in `js/app.js`, Prüfung immer über `GAME.cleanBody`). Bewusst NICHT in Firestore
  und nicht in der Rangliste (Gesundheitsangaben; keine Regeländerung nötig). `wipeAndReload` in `js/store.js` löscht den Schlüssel beim Abmelden und beim Kontowechsel (damit erbt kein anderes Konto
  auf demselben Gerät die Angaben); im lokalen Modus (ohne Anmeldung) bleibt er stehen. „Profil zurücksetzen“ lässt ihn unberührt. `datenschutz.html` (Arbeitshilfe) hat einen Punkt dazu;
  der eigentliche Datenschutztext ist Sache des Nutzers.
- **Statistik:** `alcoholHtml` in `js/app.js` (zwischen „Genuss“ und „Bundesländer“), nur wenn `GAME.alcoholReport` nicht `null` ist, also erst nach Wahl des Geschlechts und mit mindestens einem Eintrag.
  Inhalt: Satz mit Schnitt in g und Flaschen-Gegenwert, Label-Leiter A–D (Pfeilbalken wie beim Energielabel, eigener Bereich „◀ du“, die anderen gedämpft), vier bzw. sechs Kacheln
  (Ø pro Woche, diese Woche, stärkster Abend, Rauschtrink-Abende; mit Gewicht zusätzlich Promille des stärksten Abends und Stunden bis 0,0 ‰), Hinweise, aufklappbares „So wird gerechnet“.
  Label-Farben fest in hell und dunkel (`--lab-a` … `--on-lab-d` im ersten Farbblock; Kontrast ≥ 4,9 : 1).
- **Rechnung (`js/game.js`, Abschnitt „Alkohol und Körper“, Gramm in Zehnteln, Promille in Hundertsteln):** Reinalkohol = `flasche × alc × 78,9` (Zehntel g; Dichte 0,789), Biere ohne Größe zählen nicht (Hinweis in der Anzeige).
  Schnitt = Summe der letzten 28 Tage ÷ Wochen (`min(4, max(1, Tage seit dem ersten Eintrag / 7))`). Label: `LABEL_LIMITS` `{ m: [27, 81, 210], w: [27, 81, 140] }` g pro Woche (A ≤ 27, B ≤ 81, C ≤ dritte Zahl, D darüber).
  A/B = DGE-Positionspapier 2024 (27 / 81 g pro Woche, beide Geschlechter gleich; übernimmt die kanadischen Zonen). C/D-Grenze = 20 g (w) bzw. 30 g (m) pro Tag (Zirrhoserisiko steigt laut Deutscher Leberstiftung bei Männern über 30 g/Tag;
  apotheken.de nennt 20 g/Tag als Schwelle für Frauen; Deutsche Leberhilfe 10/20 g; Quellen uneinheitlich, es sind Richtwerte). Das Gewicht fließt bewusst NICHT ins Label ein (Leitlinien gelten nicht je kg).
  Abend = Einträge mit höchstens 6 Stunden Abstand (`SESSION_GAP`), alkoholfreie Biere (0 g) machen keinen Abend. Rauschtrinken ab 60 g (m) / 48 g (w) an einem Abend (5 bzw. 4 Gläser zu 12 g; die Literatur nennt 50–60 g).
  Promille nach Widmark: g ÷ (kg × r), r = 0,7 (m) / 0,6 (w), Abbau 0,1 ‰/h (`ELIMINATION`), kein Abzug für unvollständige Aufnahme (Schätzung eher zu hoch). Beispiel: 80 kg, Mann, 1 × 0,5 l Pils (19,7 g) → 0,35 ‰, nach 3,5 h abgebaut.
- **Nicht (weiter) belegt:** Die Grenzen stammen aus Suchzusammenfassungen und Sekundärquellen, nicht aus den Originaltabellen der DGE/S3-Leitlinie; der Nutzer sollte sie gegenlesen (Zahlen in `LABEL_LIMITS`, `BINGE_GRAMS`, Texte in `alcoholHtml`).
  Die Meta-Analyse zur Zirrhose (Llamosas-Falcón u. a. 2023: RR 1,8 bei 25 g/Tag) wird in der App NICHT angezeigt; eine Prozentzahl „Leberschaden“ gibt es bewusst nicht (Scheingenauigkeit).
- Zielkonflikt Spiel/Gesundheit: Die Auswertung ist Information, kein Spielelement (keine Punkte, nicht in der Rangliste). Der Satz „Wer getrunken hat, fährt nicht“ und der Hinweis „keine medizinische Beratung“ müssen bleiben.
- Tests: 9 neue in `tests/game.test.js` (Reinalkohol, `cleanBody`/`parseKg`, Label-Grenzen, Bericht mit festem `now`, Frauen/Männer, Widmark, Abendgrenze 5 h/7 h, kurze Nutzung, nur alte/alkoholfreie Einträge) → 58 Tests, auch mit `TZ=America/New_York` und `TZ=Pacific/Auckland`.
  Im eingebauten Browser mit Kopie ohne Schlüssel (Scratchpad) geprüft: Abschnitt fehlt ohne Geschlecht, Auswahl und Gewicht per echtem Klick/Tipp, ungültige Werte (abc, 20), „64,5“, leeres Feld, Löschen, Männer und Frauen,
  375 px hell, 390 px dunkel und 320 px (kein Überlauf), keine Konsolenfehler. NICHT getestet: iPhone/Safari (`clip-path`-Pfeile, Eingabe mit Dezimaltastatur `inputmode="decimal"`), echtes Firebase (Löschen beim Abmelden),
  Desktop-Breite, Bildschirmleser.
- Entfernen: Abschnitt `koerper` und `bodyMsg`/`saveKg`/`clearBody` samt `change`-/`click`-Zweigen in `js/app.js`, `alcoholHtml` samt Aufruf in `paintStats`, `LS_BODY`/`readBody`/`writeBody`, Abschnitt „Alkohol und Körper“ in `js/game.js` samt Export und Tests,
  `LS_BODY` in `js/store.js`, CSS-Abschnitt am Ende und die `--lab-…`-Zeilen, Punkt in `datenschutz.html`, Abschnitt in README.

## Glückskeks-Sprüche (18.11.2026)

- `Datensammlung/nachrichten.json`: Liste `{ id, nachricht }` (id = Ganzzahl > 0 oder Text, eindeutig; Nutzer trägt die Sprüche selbst ein,
  vorhanden ist nur ein Probe-Spruch). Nach „Bestätigen“ steht der Spruch (`<p class="fortune">`) zwischen den Punkte-Zeilen und „Fertig“.
- Auswahl: `GAME.pickMessage` (zufällig unter den noch nicht gezeigten; alle gezeigt → von vorn, der zuletzt gezeigte nicht gleich wieder).
  Merker: localStorage `biersammler-messages-v1` (Liste der gezeigten IDs), also je Gerät/Browser, NICHT je Konto und nicht in Firestore
  (keine Regeländerung nötig). Entfernte IDs fallen aus dem Merker, neue Sprüche gelten als ungezeigt. Datei fehlt/leer → kein Spruch, kein Fehler.
- `CACHE_VERSION` wurde beim Anlegen auf `v3` erhöht (neue Datei in `DATA_FILES`). Tests: `cleanMessages`, `pickMessage`, echte Datei.
- NICHT im Browser getestet (kein Server startbar): Anzeige/Abstände, Umbruch langer Sprüche, hell/dunkel, 375 px.

## Spielregeln und Rechnen

- **Bonus für eine neue Karte (19.11.2026, Wunsch des Nutzers: neue Biere ausprobieren soll sich lohnen):** `NEW_CARD_BONUS` = 35 (3,5 Punkte) in `js/game.js`,
  einmal je Karte, in `summarize` beim Anlegen der Karte addiert (steckt in `summary.sum` und in `card.points`). Hängt an der Karte, nicht an einem Eintrag:
  bleibt, solange noch ein Eintrag des Biers da ist. Gilt rückwirkend (Nutzer: im Testlauf egal). Anzeige: Aufdecken „+4,7 Punkte“ und „Neu in deiner Sammlung ·
  davon +3,5 Bonus“; Löschen der Karte bzw. des letzten Eintrags nennt den Abzug samt Bonus; Spielanleitung und Willkommensfenster erklären ihn (vorher stand dort
  ausdrücklich „Ein neues Bier bringt keine Extrapunkte“). Die Pille „+1,2“ in der Kartenansicht bleibt der Wert je Trinken (ohne Bonus).
- Punkte in Zehnteln: Stufe 1–5 = 10, 12, 13, 15, 25; Zufalls-Spezialkarten + 10 (`bonus`); je neue Karte + 35. Level = floor(summe/100)+1, Ring = (summe mod 100)/100 (10 Punkte = 1 Level,
  seit 18.11.2026; vorher 20). `LEVEL_POINTS` in `js/game.js`; Text in Spielanleitung, Willkommensfenster, `aria-label` in `index.html` und README mitändern.
- Alles (Punkte, Level, Sammlung, Statistiken) wird aus dem Protokoll berechnet, nie gespeichert.
- Kein Nachtragen: Zeitpunkt = Geräteuhr beim Bestätigen. Keine Tages-Serien.
- Pflicht-Beispiele (reine Summen über `level`/`fmtRing`, ohne Kartenbonus), die nach jeder Änderung exakt herauskommen müssen (`node tests/game.test.js`):
  0 → Level 1, Ring 0 · 10×Stufe 5 = 250 → Level 3, 5,0/10 · 10×Stufe 1 = 100 → Level 2, 0,0/10 · 20×Stufe 1 = 200 → Level 3, 0,0/10 ·
  19×Stufe 4 = 285 → Level 3, 8,5/10 · 13×Stufe 1 + 5×Stufe 5 = 255 → Level 3, 5,5/10 · 3×Stufe 3 = 39 → „3,9“ (seit 19.11.2026, vorher mit 6 Stufen).
- Karten-Level: Die Plakette auf der Karte zeigt „Lvl n“ (n = wie oft das Bier getrunken wurde; vorher „×n“). Seit 20.11.2026 verändert sich die Optik der Karte
  ab Lvl 3, 7, 10, 15, 20, 25, 30, 35 und 40 in NEUN Stufen (`GAME.cardTier`, `CARD_TIER_AT`; vorher 4, 8, 16, 24, 40 in fünf Stufen), Klassen `t1`…`t9` auf `.bcard-body` und
  `.bottle`, ab t6 zusätzlich `.g` (goldenes Symbol; die Spezialkarten-Regeln `:not(.g)` / `.g` ersetzen die früheren `:not(.t5)` / `.t5`). Jede Stufe soll deutlich
  anders aussehen als die vorige (Wunsch des Nutzers): t1 Glanz, Leuchten, ein funkelnder Stern · t2 Schaumkrone, stärkeres Leuchten · t3 aufsteigende Bläschen + Strahlen ·
  t4 Sterne (3), atmende Strahlen · t5 silberne Flasche, 6 Sterne, heller Kern · t6 goldene Flasche, goldener Pulsring (`::after`) · t7 kreisender Heiligenschein
  (gestrichelter Kreis im SVG), goldener Kometenring, dichte Strahlen · t8 Krone statt Schaum, Regenbogen-Ring, 9 Sterne, kräftigstes Leuchten.
  t9 (Lvl 40, am selben Tag nachgelegt, „riesige Veränderung, alles grundsätzlich anders“): dunkles kosmisches Portal mit Sternpunkten (Hintergrund), drehende Galaxie mit vier
  Farbarmen (`::before`), auslaufende Lichtwellen (`::after`), Glanzstreifen, Kristall-Flasche mit Facetten im Farbwechsel (`hue-rotate`, Verlauf `#lv40-grad` in `index.html` neben `#rb-grad`),
  Saturnring (Hinterteil + Vorderbogen), zwei Umlaufbahn-Kugeln, schwebender Diamant statt Krone, Regenbogen-Plakette `.count`, Regenbogen-Schein um die Karte (`:has`). Auch Bär und Wahrzeichen
  bekommen Kristall, Ring und Bahnen. Mittelpunkt über `--bx`/`--by` (mono und se10 haben die Flasche links). Mono bleibt einfarbig (Flasche in Schriftfarbe).
  Bär und Wahrzeichen: Sterne ab t4, silbern t5, golden ab t6, Heiligenschein ab t7, kein Schaum/Krone/Bläschen. Bewegung läuft per CSS-Animation (Bläschen, Sterne, Glanz,
  Strahlen atmen, Ringe, Heiligenschein, Krone); bei „weniger Bewegung“ stehen alle still (Block am Ende von `css/style.css`). Strahlen/Ring kreisen nicht per Verlauf,
  sondern nur Deckkraft/Drehung kleiner Elemente (Leistung auf dem iPhone bei vielen Karten). Variablen `--spark`, `--gold`, `--gold-d`, `--ring` auf `.bottle`/`.bcard-body`
  lassen Spezialkarten die Farben ändern (mono = Schriftfarbe, se10 gelb, se20 limette, se30 pink). Spezialkarten mit eigenem Hintergrund (mono, se10, se20, se50) haben ihre acht
  Stufen einzeln in `css/style.css`; mono, se10 und se60 blenden Strahlen/Ring aus. Rahmen und Band (Kategorie) bleiben unverändert. Die Stufen werden in der App NICHT erklärt (so gewünscht).
  Alles wird aus dem Protokoll berechnet, beim Löschen von Einträgen fällt die Karte also zurück. Ab Lvl 35 zählt die Zahl weiter.
  Getestet 20.11.2026: Node-Tests (58; `cardTier` bis 40), eingebauter Browser mit Testseite (Karten aus den echten Funktionen von `js/app.js`, alle Designs, Lvl 3–35, hell und dunkel; Testseite wieder gelöscht).
  NICHT getestet: iPhone/Safari (Animationen, `mask`, Leistung bei vielen hohen Karten), „weniger Bewegung“, große Kartenansicht mit Neigung.
  „Level“ ohne Zusatz bleibt das Spieler-Level in der Kopfleiste.
  Plakette `.count` (19.11.2026): sitzt INNERHALB des Zierrahmens (`top`/`right` 13 px, Schrift 12,5 px), damit sie Linie und Ecke des Rahmens nicht mehr überdeckt (vorher 8 px, schnitt die Ecke).
  Ausnahmen mit eigenem Abstand: Bierkönig (Eckornamente, 22/20 px, 11,5 px) und Schwarze Nachtigal (Doppelrahmen, 17 px, 11,5 px); Spezial-Karten `sp-mono` haben keinen Rahmen (9/12 px). Der BB-Sticker der Bierball-Karte darf den Rahmen bewusst überdecken.
  Getestet 430 und 375 px (Karten ca. 193 bzw. 165 px breit), Lvl 40 auf allen Designs, große Ansicht Bierkönig; NICHT auf iPhone/Safari.
- Kartenoptik (18.11.2026, alle Karten gleicher Aufbau, nur das Material wechselt je Kategorie; Schrift unverändert):
  Ebenen `.mat` (Tönung, Muster als SVG-Maske, Körnung), `.foil` (Holo-Folie, nur Zaubertrank/Heiligtum), Zierrahmen
  (`.bcard::before`), Schriftband (`.band`, ein glatter durchgehender Balken oben, bewusst ohne Zacken und Naht), Herkunft im Fuß (`.origin .o`: kleine Box mit weißer Schrift, seit 19.11.2026 für alle Bundesländer und Länder EINE Farbe: warmes Graubraun `#5B5246`, Kontrast zu Weiß 7,7 : 1; die frühere Farbe je Bundesland per `data-o` ist entfernt; Mecklenburg-Vorpommern und
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
leaderboard/<uid>            { username, sum, count, cards }   Rangliste: Punkte in Zehnteln, Anzahl Biere, verschiedene Karten (nur mit Benutzername)
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
- Veröffentlichen: `render()` meldet `STORE.publishScore(summary.sum, summary.count, summary.cards.length)` (seit 19.11.2026 mit `cards`; alle drei aus `summary`,
  damit sie zu den Regeln passen; erst wenn die Bierdatenbank geladen
  ist). `store.js` schreibt `leaderboard/<uid>` gebündelt (1,5 s), nur bei Änderung, nur mit Namen und erst nach der
  Serverbestätigung des Protokolls (`snap.metadata.fromCache` false), damit ein leerer Zwischenspeicher nichts Falsches
  veröffentlicht. Beim Zurücksetzen löscht derselbe Batch das Dokument; ein Namenswechsel schreibt es neu.
- Anzeige: `STORE.watchRanking` = `orderBy('sum','desc')` + `limit(15)` (nur Einzelfeld-Index, kein zusammengesetzter nötig),
  `GAME.rankBoard` prüft (Name, Ganzzahlen, `count·10 + cards·35 ≤ sum ≤ count·35 + cards·35`, `0 ≤ cards ≤ count`, `cards > 0` sobald `count > 0`; Zeilen ohne
  `cards` von alten App-Versionen fallen weg, bis der Spieler die neue Version öffnet), sortiert (Punkte, Biere, Name) und vergibt Ränge (gleiche
  Punkte = gleicher Platz). Eigener Rang außerhalb der Besten: `getCountFromServer(where('sum','>',eigene Punkte)) + 1`;
  ohne Netz „–“. Entscheidung des Nutzers: Top 15 + eigener Rang, Sortierung nach Punkten, keine Wochen-Rangliste.
  19.11.2026: Der Nutzer wollte nach Profillevel statt nach Anzahl Bieren sortieren. Das war schon so (Punkte bestimmen das Level, Sortierung nach Punkten =
  nach Level, feiner); deshalb nicht geändert, nur der Hinweistext sagt jetzt „Es zählt das Level, bei gleichem Level die Punkte“.
  Spalte „Karten“ zeigt nur die eigene Zahl (z. B. `16`; bis 19.11.2026 `16/6.372`, die Gesamtzahl steht nur noch im Hinweistext). Tabelle mit `table-layout: fixed`:
  Platz (52 px, mittig) und Level/Biere/Karten (je 54 px, rechtsbündig) gleich breit, der Name bekommt den Rest; unter 420 px 44 bzw. 46 px. Getestet mit nachgebildetem `STORE.watchRanking` in einer Kopie ohne Schlüssel
  (375 px hell/dunkel, 4-stellige Werte, eigener Rang 23, Zeile ohne `cards` fällt weg).
- Werte kommen vom Client und sind fälschbar; das ist gewollt hingenommen („es ist ein Spiel“).
- Getestet mit nachgebildetem Firebase (siehe „Testen“): Veröffentlichen, Namenswechsel, Zurücksetzen, Top 15 + Rang 23,
  Gleichstand, eigener Platz unter den Besten, offline, Ladefehler, ungültige Zeilen, lokaler Modus, 375 px hell/dunkel
  und Desktop. NICHT getestet: echte Regeln/Firestore (Regeln gedanklich geprüft, kein Emulator).

## Firestore-Regeln (`firestore.rules`)

Gedanklich gegen jeden Schreibvorgang der App geprüft (Eintrag anlegen, −1, Karte löschen, Zurücksetzen mit/ohne Namen,
Name wählen, ändern, nur Groß/klein ändern). Nicht automatisch getestet: Es gibt keinen Emulator (bräuchte npm/Java).
Rangliste (19.11.2026): `cards` Pflichtfeld (int, 0…count, > 0 sobald count > 0), `sum` zwischen `count·10 + cards·35` und `count·35 + cards·35`.
NEUE REGELN VOR DER APP VERÖFFENTLICHEN, sonst lehnt Firestore jeden Ranglisten-Eintrag ab (das Feld `cards` ist mit den alten Regeln nicht erlaubt).
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
- Gesamtprüfung 19.11.2026 (Code-Aufräumen ohne Funktionsänderung): doppelte Sternen-Funktion (Bär nutzt jetzt `heroStars`), `tenths` und
  Kategoriename in `js/game.js` nur noch einmal, `db.kat` von Anfang an `{}`, sessionStorage-Schlüssel als Konstante `SS_DELETED` auch in `js/app.js`,
  `toggleGeo` zeichnet statt der Kopfleiste ggf. die Statistiken neu (der Karten-Knopf steht dort), ungenutzte CSS-Klasse `.rounded` entfernt, veraltete
  Kommentare berichtigt, zwei Tippfehler in Oberflächentexten. Getestet: Node-Tests (49, auch mit anderen Zeitzonen), Kopie ohne Schlüssel im eingebauten
  Browser (Startseite mit Bär/Brezel auf Kartenstufe 4, Einstellungen, Standort-Schalter mit nachgebildetem Standort, Statistiken, Karte, Hinzufügen, Kartenansicht).
  Der Service Worker ließ sich im eingebauten Browser nicht registrieren (Einschränkung der Umgebung; `sw.js` unverändert).
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
