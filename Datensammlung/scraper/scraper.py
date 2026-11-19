#!/usr/bin/env python3
"""
BierSammler – Datensammler für bier-universum.de

Lädt alle Biere aus https://www.bier-universum.de/datenbank/biersuche und
erzeugt daraus:
    Datensammlung/biere.json       (alle Biere)
    Datensammlung/kategorien.json  (die 6 Seltenheits-Kategorien)
    Datensammlung/biere.csv        (dieselben Daten für Excel/Numbers)

Nur Python-Standardbibliothek, keine Installation nötig.

Aufruf (im Ordner Datensammlung/scraper):
    python3 scraper.py                 # alles laden bzw. abgebrochenen Lauf fortsetzen
    python3 scraper.py --test 10       # Probelauf mit 10 Bieren (schreibt nur test_ausgabe.json)
    python3 scraper.py --aktualisieren # Liste neu laden und nur neue Biere ergänzen
    python3 scraper.py --nur-export    # nichts laden, nur JSON/CSV neu erzeugen

Zwischenstände liegen in Datensammlung/scraper/cache/. Ein abgebrochener Lauf
macht beim nächsten Start dort weiter, wo er aufgehört hat.
"""

import argparse
import csv
import html
import json
import math
import random
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASIS_URL = "https://www.bier-universum.de"
LISTEN_URL = BASIS_URL + "/datenbank/biersuche"
USER_AGENT = "Mozilla/5.0 (compatible; BierSammler-Datensammler/1.0; privates Projekt)"

SKRIPT_ORDNER = Path(__file__).resolve().parent
DATEN_ORDNER = SKRIPT_ORDNER.parent
CACHE_ORDNER = SKRIPT_ORDNER / "cache"
LINKS_DATEI = CACHE_ORDNER / "links.json"          # interne Quell-Nr. -> Detail-URL
DETAILS_DATEI = CACHE_ORDNER / "details.jsonl"     # Rohdaten je Bier (eine Zeile pro Bier)
FEHLER_DATEI = CACHE_ORDNER / "fehler.json"        # Seiten, die nicht geladen werden konnten
ID_DATEI = CACHE_ORDNER / "id_zuordnung.json"      # interne Quell-Nr. -> BierSammler-ID (bleibt stabil!)

KATEGORIEN = [  # Reihenfolge = Stufe (Punkte und Sortierung in der App hängen daran)
    {"stufe": 1, "name": "Standardgebräu", "anteil": 0.50},
    {"stufe": 2, "name": "Klassiker", "anteil": 0.15},
    {"stufe": 3, "name": "Spezialität", "anteil": 0.15},
    {"stufe": 4, "name": "Raddelfuß", "anteil": 0.10},
    {"stufe": 5, "name": "Zaubertrank", "anteil": 0.07},
    {"stufe": 6, "name": "Heiligtum", "anteil": 0.03},
]

# Reihenfolge, in der der Zufallswert (0 bis 1) auf die Kategorien verteilt wird. Sie weicht von der Stufenreihenfolge ab:
# Raddelfuß wurde aus dem hinteren Teil der früheren Klassiker (damals 25 %) herausgeschnitten und liegt deshalb im
# Zufallsbereich zwischen Klassiker und Spezialität. Nur so behält jedes andere Bier seine bisherige Kategorie.
# NICHT umsortieren und die Anteile nur ändern, wenn bewusst Biere die Kategorie wechseln sollen.
ZIEH_REIHENFOLGE = ["Standardgebräu", "Klassiker", "Raddelfuß", "Spezialität", "Zaubertrank", "Heiligtum"]

# Biere, die unabhängig vom Zufall in einer festen Kategorie bleiben (ID -> Name der Kategorie)
FESTE_KATEGORIE = {
    "BS-000887": "Klassiker",  # Sternburg - Export (läge sonst im Raddelfuß-Bereich)
}

PRO_SEITE = 20


# --------------------------------------------------------------------------- Netzwerk

def lade(url, versuche=4):
    """Lädt eine Seite als Text. Bei Fehlern mehrfach mit wachsender Pause neu versuchen."""
    letzter_fehler = None
    for versuch in range(versuche):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as antwort:
                return antwort.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            letzter_fehler = e
        except Exception as e:  # Timeout, Verbindungsabbruch, ...
            letzter_fehler = e
        time.sleep(5 * (versuch + 1))
    raise letzter_fehler


# --------------------------------------------------------------------------- Hilfsfunktionen

def text(s):
    """HTML-Schnipsel -> sauberer Text."""
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def quell_nr(href):
    """Interne Nummer der Quelle aus einem Detail-Link (wird nur intern verwendet)."""
    href = html.unescape(href)
    m = re.search(r"beerproduct%5D=(\d+)|beerproduct\]=(\d+)", href)
    if m:
        return int(m.group(1) or m.group(2))
    m = re.search(r"-(\d+)/?$", href.split("?")[0])
    return int(m.group(1)) if m else None


def lade_json(pfad, standard):
    if pfad.exists():
        with open(pfad, encoding="utf-8") as f:
            return json.load(f)
    return standard


def speichere_json(pfad, daten, kompakt=False):
    pfad.parent.mkdir(parents=True, exist_ok=True)
    tmp = pfad.with_suffix(pfad.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        if kompakt:
            json.dump(daten, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(daten, f, ensure_ascii=False, indent=2)
    tmp.replace(pfad)


def fortschritt(aktuell, gesamt, start, prefix):
    vergangen = time.time() - start
    rest = (vergangen / aktuell) * (gesamt - aktuell) if aktuell else 0
    print(f"\r{prefix} {aktuell}/{gesamt}  (noch ca. {int(rest // 60)} min)   ", end="", flush=True)


# --------------------------------------------------------------------------- Schritt 1: Liste

def links_aus_liste(seite_html):
    links = {}
    for href in re.findall(r'href="(/datenbank/biersuche/detail[^"]*)"', seite_html):
        nr = quell_nr(href)
        if nr is not None:
            links[nr] = BASIS_URL + html.unescape(href)
    return links


def sammle_links(pause, neu=False):
    stand = lade_json(LINKS_DATEI, {"fertige_seiten": [], "gesamt": None, "links": {}})
    if neu:
        stand["fertige_seiten"] = []

    if stand["gesamt"] is None or neu:
        erste = lade(LISTEN_URL)
        m = re.search(r"Suchergebnisse\s+\d+\s+bis\s+\d+\s+von\s+(\d+)", erste)
        if not m:
            sys.exit("Konnte die Gesamtzahl der Biere nicht lesen – hat sich die Website geändert?")
        stand["gesamt"] = int(m.group(1))
        for nr, url in links_aus_liste(erste).items():
            stand["links"][str(nr)] = url
        stand["fertige_seiten"] = [1]
        speichere_json(LINKS_DATEI, stand)
        time.sleep(pause)

    seiten = math.ceil(stand["gesamt"] / PRO_SEITE)
    offen = [s for s in range(1, seiten + 1) if s not in stand["fertige_seiten"]]
    print(f"Biere laut Website: {stand['gesamt']}  |  Ergebnisseiten: {seiten}  |  noch offen: {len(offen)}")

    start = time.time()
    for i, s in enumerate(offen, 1):
        try:
            seite = lade(LISTEN_URL if s == 1 else f"{LISTEN_URL}/{s}")
        except Exception as e:
            print(f"\n  Seite {s} übersprungen ({e}) – wird beim nächsten Start erneut versucht.")
            continue
        for nr, url in links_aus_liste(seite).items():
            stand["links"][str(nr)] = url
        stand["fertige_seiten"].append(s)
        if i % 10 == 0 or i == len(offen):
            speichere_json(LINKS_DATEI, stand)
        fortschritt(i, len(offen), start, "Listenseiten:")
        time.sleep(pause)
    speichere_json(LINKS_DATEI, stand)
    print(f"\nGefundene Bier-Links: {len(stand['links'])}")
    return stand


# --------------------------------------------------------------------------- Schritt 2: Details

def parse_detail(seite_html):
    """Liest alle Rohdaten einer Detailseite aus. Die Umwandlung ins Endformat passiert später."""
    roh = {}

    m = re.search(r"<h1>(.*?)</h1>", seite_html, re.S)
    roh["titel"] = text(m.group(1)) if m else None

    # Strukturierte Daten (schema.org), enthalten die Firmenadresse sauber getrennt
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', seite_html, re.S):
        try:
            d = json.loads(block)
        except ValueError:
            continue
        haupt = d.get("mainEntity") if isinstance(d, dict) else None
        if isinstance(haupt, dict) and haupt.get("@type") == "Product":
            roh["ld_name"] = haupt.get("name")
            hersteller = haupt.get("manufacturer")
            if isinstance(hersteller, dict):
                adr = hersteller.get("address") or {}
                roh["ld_firma"] = {
                    "typ": hersteller.get("@type"),
                    "name": hersteller.get("name"),
                    "strasse": adr.get("streetAddress"),
                    "plz": adr.get("postalCode"),
                    "ort": adr.get("addressLocality"),
                    "region": adr.get("addressRegion"),
                    "land": adr.get("addressCountry"),
                }

    # Nur den Bier-Bereich der Seite betrachten
    start = seite_html.find("<h1>")
    ende = seite_html.find("counter.php", start)
    bereich = seite_html[start:ende if ende > 0 else None]

    m = re.search(r"<b>\s*Beschreibung laut Etikett:\s*</b>\s*(?:<br\s*/?>)?\s*<p>(.*?)</p>", bereich, re.S)
    roh["beschreibung"] = text(m.group(1)) if m else None

    # Alle "<b>Bezeichnung:</b> Wert"-Felder
    felder = {}
    for m in re.finditer(r"<(b|strong)>\s*([^<]+?):\s*</\1>(.*?)(?=<(?:b|strong)>|<hr|<p>|$)", bereich, re.S):
        bezeichnung = text(m.group(2))
        if bezeichnung != "Beschreibung laut Etikett":
            felder[bezeichnung] = text(m.group(3))
    roh["felder"] = felder

    # Firmenblöcke: <p><b>Brauerei</b><br/> Zeile<br/> Zeile ...</p>
    firmen = []
    for m in re.finditer(r"<p>\s*<b>([^<:]+)</b>\s*<br\s*/?>(.*?)</p>", bereich, re.S):
        inhalt = re.sub(r"<a\b[^>]*>.*?</a>", "", m.group(2), flags=re.S)
        zeilen = [text(z) for z in re.split(r"<br\s*/?>", inhalt)]
        firmen.append({"typ": text(m.group(1)), "zeilen": [z for z in zeilen if z]})
    roh["firmen"] = firmen
    return roh


def lade_details_cache():
    fertig = {}
    if DETAILS_DATEI.exists():
        with open(DETAILS_DATEI, encoding="utf-8") as f:
            for zeile in f:
                zeile = zeile.strip()
                if zeile:
                    d = json.loads(zeile)
                    fertig[d["quelle"]] = d
    return fertig


def sammle_details(links, pause, limit=None, cache=True):
    fertig = lade_details_cache() if cache else {}
    fehler = lade_json(FEHLER_DATEI, {}) if cache else {}
    offen = sorted((int(nr), url) for nr, url in links.items() if int(nr) not in fertig)
    if limit:
        offen = offen[:limit]
    print(f"Detailseiten: {len(fertig)} schon geladen, {len(offen)} noch offen")

    ergebnisse = dict(fertig)
    start = time.time()
    datei = open(DETAILS_DATEI, "a", encoding="utf-8") if cache else None
    try:
        for i, (nr, url) in enumerate(offen, 1):
            try:
                roh = parse_detail(lade(url))
                roh["quelle"] = nr
                ergebnisse[nr] = roh
                fehler.pop(str(nr), None)
                if datei:
                    datei.write(json.dumps(roh, ensure_ascii=False) + "\n")
                    datei.flush()
            except Exception as e:
                fehler[str(nr)] = {"url": url, "fehler": str(e)}
            fortschritt(i, len(offen), start, "Detailseiten:")
            time.sleep(pause)
    finally:
        if datei:
            datei.close()
        if cache:
            speichere_json(FEHLER_DATEI, fehler)
    print()
    if fehler:
        print(f"Achtung: {len(fehler)} Seiten konnten nicht geladen werden (siehe cache/fehler.json). "
              f"Einfach das Skript nochmal starten, dann werden sie erneut versucht.")
    return ergebnisse


# --------------------------------------------------------------------------- Schritt 3: Endformat

def zahl(s):
    m = re.search(r"(\d+(?:[.,]\d+)?)", s or "")
    return float(m.group(1).replace(",", ".")) if m else None


def flaschengroesse_liter(s):
    """'0,5 Liter' -> 0.5 ; '12 fl. oz' -> 0.355 ; '1 Imperial Pint' -> 0.568"""
    wert = zahl(s)
    if wert is None:
        return None
    s = s.lower()
    if "fl" in s and "oz" in s:
        wert *= 0.0295735
    elif "pint" in s:
        wert *= 0.568261
    elif re.search(r"\bml\b", s):
        wert /= 1000
    elif re.search(r"\bcl\b", s):
        wert /= 100
    return round(wert, 3)


def liste(s):
    if not s:
        return []
    return [t.strip() for t in re.split(r",(?![^()]*\))", s) if t.strip()]


def firma(roh):
    """Brauerei bzw. Vertrieb – bevorzugt aus den strukturierten Daten."""
    block = roh["firmen"][0] if roh.get("firmen") else None
    typ = block["typ"] if block else None
    ld = roh.get("ld_firma")
    if not typ and ld:
        # Manche Seiten haben keine Überschrift -> Art aus den strukturierten Daten ableiten
        ld_typ = ld.get("typ") or []
        ld_typ = ld_typ if isinstance(ld_typ, list) else [ld_typ]
        typ = "Brauerei" if ("Brewery" in ld_typ or "BarOrPub" in ld_typ) else "Vertrieb"
    if ld and ld.get("name"):
        ort = " ".join(x for x in [ld.get("plz"), ld.get("ort")] if x)
        adresse = ", ".join(x for x in [ld.get("strasse"), ort] if x) or None
        return {"typ": typ, "name": ld["name"], "adresse": adresse,
                "region": ld.get("region") or None, "land": ld.get("land") or None}
    if block and block["zeilen"]:
        z = block["zeilen"]
        return {"typ": typ, "name": z[0], "adresse": ", ".join(z[1:-1]) or None,
                "region": None, "land": z[-1] if len(z) > 1 else None}
    return None


def kategorie(bier_id):
    """Zufällige, aber feste Kategorie je Bier (gleiche ID -> immer gleiche Kategorie)."""
    nach_name = {k["name"]: k for k in KATEGORIEN}
    if bier_id in FESTE_KATEGORIE:
        k = nach_name[FESTE_KATEGORIE[bier_id]]
    else:
        rng = random.Random(f"biersammler-{bier_id}")
        name = rng.choices(ZIEH_REIHENFOLGE, weights=[nach_name[n]["anteil"] for n in ZIEH_REIHENFOLGE])[0]
        k = nach_name[name]
    return k["name"], k["stufe"]


def baue_bier(bier_id, roh):
    f = roh.get("felder", {})
    kat_name, kat_stufe = kategorie(bier_id)
    return {
        "id": bier_id,
        "name": roh.get("titel"),
        "biersorte": liste(f.get("Biersorte(n)") or f.get("Biersorte")),
        "alkoholgehalt": zahl(f.get("Alkoholgehalt")),
        "brauerei_vertrieb": firma(roh),
        "beschreibung": roh.get("beschreibung") or None,
        "zutaten": liste(f.get("Zutaten")),
        "flaschengroesse": flaschengroesse_liter(f.get("Flaschengröße")),
        "kategorie_name": kat_name,
        "kategorie_stufe": kat_stufe,
    }


def vergebe_ids(quell_nrn, id_map):
    """Neue Biere bekommen die nächste freie Nummer, bestehende behalten ihre ID für immer."""
    naechste = max((int(v.split("-")[1]) for v in id_map.values()), default=0) + 1
    for nr in sorted(quell_nrn):
        if str(nr) not in id_map:
            id_map[str(nr)] = f"BS-{naechste:06d}"
            naechste += 1
    return id_map


def exportiere(details, test=False):
    if test:
        id_map = vergebe_ids(details.keys(), {})
    else:
        id_map = vergebe_ids(details.keys(), lade_json(ID_DATEI, {}))
        speichere_json(ID_DATEI, id_map)

    biere = [baue_bier(id_map[str(nr)], roh) for nr, roh in details.items()]
    biere.sort(key=lambda b: b["id"])

    if test:
        speichere_json(SKRIPT_ORDNER / "test_ausgabe.json", biere)
        print(f"Test-Ausgabe: {SKRIPT_ORDNER / 'test_ausgabe.json'}")
        return biere

    speichere_json(DATEN_ORDNER / "biere.json", biere)
    speichere_json(DATEN_ORDNER / "kategorien.json",
                   [{"stufe": k["stufe"], "name": k["name"], "anteil": k["anteil"]} for k in KATEGORIEN])

    spalten = ["id", "name", "biersorte", "alkoholgehalt", "brauerei_typ", "brauerei_name",
               "brauerei_adresse", "brauerei_region", "brauerei_land", "beschreibung", "zutaten",
               "flaschengroesse", "kategorie_name", "kategorie_stufe"]
    with open(DATEN_ORDNER / "biere.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(spalten)
        for b in biere:
            fi = b["brauerei_vertrieb"] or {}
            w.writerow([b["id"], b["name"], ", ".join(b["biersorte"]), b["alkoholgehalt"],
                        fi.get("typ"), fi.get("name"), fi.get("adresse"), fi.get("region"), fi.get("land"),
                        b["beschreibung"], ", ".join(b["zutaten"]), b["flaschengroesse"],
                        b["kategorie_name"], b["kategorie_stufe"]])

    verteilung = {}
    for b in biere:
        verteilung[b["kategorie_name"]] = verteilung.get(b["kategorie_name"], 0) + 1
    print(f"Fertig: {len(biere)} Biere -> {DATEN_ORDNER / 'biere.json'}")
    for k in KATEGORIEN:
        print(f"  {k['stufe']} {k['name']:<15} {verteilung.get(k['name'], 0)}")
    return biere


# --------------------------------------------------------------------------- Start

def main():
    p = argparse.ArgumentParser(description="Lädt alle Biere von bier-universum.de")
    p.add_argument("--test", type=int, metavar="N", help="Probelauf mit N Bieren")
    p.add_argument("--aktualisieren", action="store_true", help="Liste neu laden, neue Biere ergänzen")
    p.add_argument("--nur-export", action="store_true", help="Nur JSON/CSV aus dem Cache neu erzeugen")
    p.add_argument("--pause", type=float, default=1.0, help="Sekunden zwischen zwei Anfragen (Standard 1)")
    a = p.parse_args()

    CACHE_ORDNER.mkdir(parents=True, exist_ok=True)

    if a.nur_export:
        exportiere(lade_details_cache())
        return

    if a.test:
        seite = lade(LISTEN_URL)
        links = {str(k): v for k, v in links_aus_liste(seite).items()}
        details = sammle_details(links, a.pause, limit=a.test, cache=False)
        exportiere(details, test=True)
        return

    stand = sammle_links(a.pause, neu=a.aktualisieren)
    details = sammle_details(stand["links"], a.pause)
    exportiere(details)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAbgebrochen. Beim nächsten Start geht es an derselben Stelle weiter.")
