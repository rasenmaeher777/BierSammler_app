#!/usr/bin/env python3
"""Erzeugt die Kartendateien für die Standort-Karte (js/karte.js) aus frei verfügbaren Grenzdaten.

Aufruf:   python3 bauen.py <Ordner mit den Rohdaten>
Ergebnis: welt.json, deutschland.json, berlin.json (neben diesem Skript)

Rohdaten (GeoJSON, WGS84), Namen im Ordner genau so:
  ne_50m_admin_0_countries.geojson  Natural Earth, Staaten 1:50 Mio. (gemeinfrei)
      https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
  vg250_lan.json, vg250_krs.json    © BKG, Verwaltungsgebiete 1:250 000 (VG250), Datenlizenz Deutschland – Namensnennung 2.0
      https://sgx.geodatenzentrum.de/wfs_vg250?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=vg250:vg250_lan (bzw. vg250_krs)&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326
  berlin_ortsteile.json             Geoportal Berlin, ALKIS Berlin Ortsteile, Datenlizenz Deutschland – Zero 2.0
      https://gdi.berlin.de/services/wfs/alkis_ortsteile?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=alkis_ortsteile:ortsteile&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326

Format der Ausgabe (kompakt, damit die Dateien klein bleiben):
  { "v": 1, "quelle": "...", "ebenen": { "<name>": { "s": <Skalierung>, "f": [ Objekte ] } } }
  Objekt: { "n": Name, "c": [x, y] (Beschriftungspunkt), "p": [ Polygon, ... ] }
  Polygon: Liste von Ringen (außen, dann Löcher); Ring: flache Liste ganzer Zahlen [x0, y0, dx1, dy1, ...].
  Koordinaten = Grad * s, gerundet; Anfang absolut, danach jeweils der Unterschied zum Vorgänger.
Nur Standardbibliothek (kein shapely o. ä.). Vereinfachung: Douglas-Peucker je Ring (Nachbargrenzen werden einzeln
vereinfacht; die Karte zeichnet deshalb nur Linien über einer Grundfläche, keine Flächen-Lücken sichtbar).
"""
import json
import math
import os
import sys

HIER = os.path.dirname(os.path.abspath(__file__))


def lade(ordner, name):
    with open(os.path.join(ordner, name), encoding='utf-8') as f:
        return json.load(f)['features']


def polygone(geom):
    """GeoJSON-Geometrie → Liste von Polygonen (je Liste von Ringen aus (lng, lat))."""
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []


def dp(punkte, tol):
    """Douglas-Peucker für eine offene Kette (iterativ). Rechnet in Grad, Längengrad mit cos(Breite) gestaucht."""
    n = len(punkte)
    if n < 3:
        return list(punkte)
    k = math.cos(math.radians(sum(p[1] for p in punkte) / n))
    xy = [(p[0] * k, p[1]) for p in punkte]
    behalten = [False] * n
    behalten[0] = behalten[-1] = True
    stapel = [(0, n - 1)]
    while stapel:
        a, b = stapel.pop()
        ax, ay = xy[a]
        bx, by = xy[b]
        dx, dy = bx - ax, by - ay
        laenge2 = dx * dx + dy * dy
        best, best_i = -1.0, -1
        for i in range(a + 1, b):
            px, py = xy[i]
            if laenge2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / laenge2))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > best:
                best, best_i = d, i
        if best > tol:
            behalten[best_i] = True
            stapel.append((a, best_i))
            stapel.append((best_i, b))
    return [p for p, k_ in zip(punkte, behalten) if k_]


def ring_vereinfachen(ring, tol):
    """Geschlossenen Ring vereinfachen: an der weitesten Stelle vom Anfang teilen, beide Hälften einzeln."""
    pts = ring[:-1] if ring[0] == ring[-1] else list(ring)
    if len(pts) < 4:
        return None
    a = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - a[0]) ** 2 + (pts[i][1] - a[1]) ** 2)
    if far == 0:
        return None
    h1 = dp(pts[:far + 1], tol)
    h2 = dp(pts[far:] + [pts[0]], tol)
    out = h1[:-1] + h2[:-1]
    return out if len(out) >= 3 else None


def flaeche(ring):
    """Vorzeichenlose Fläche in Grad² (Schnürsenkel)."""
    s = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def kodieren(ring, s):
    """Ring → flache Liste mit Differenzen; doppelte Nachbarn nach dem Runden entfallen."""
    q = []
    for lng, lat in ring:
        p = (round(lng * s), round(lat * s))
        if not q or q[-1] != p:
            q.append(p)
    if len(q) > 1 and q[0] == q[-1]:
        q.pop()
    if len(q) < 3:
        return None
    flach = [q[0][0], q[0][1]]
    for (x0, y0), (x1, y1) in zip(q, q[1:]):
        flach += [x1 - x0, y1 - y0]
    return flach


def schwerpunkt(ring):
    a = x = y = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        c = x1 * y2 - x2 * y1
        a += c
        x += (x1 + x2) * c
        y += (y1 + y2) * c
    if a == 0:
        return ring[0]
    return (x / (3 * a), y / (3 * a))


def innen(pt, ring):
    x, y = pt
    drin = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            drin = not drin
    return drin


def beschriftungspunkt(ring):
    """Schwerpunkt; liegt er außerhalb (gebogene Form), der innere Rasterpunkt, der ihm am nächsten liegt."""
    c = schwerpunkt(ring)
    if innen(c, ring):
        return c
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    best, bd = c, float('inf')
    n = 24
    for i in range(1, n):
        for j in range(1, n):
            p = (min(xs) + (max(xs) - min(xs)) * i / n, min(ys) + (max(ys) - min(ys)) * j / n)
            if innen(p, ring):
                d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2
                if d < bd:
                    best, bd = p, d
    return best


def objekt(name, polys, tol, s, label=None, klein=0.0):
    """Ein Objekt (Land, Kreis, Ortsteil …) in das Ausgabeformat bringen. klein = Mindestfläche (Grad²) für Nebenstücke."""
    out = []
    groesste = None
    ausmass = []
    for poly in polys:
        ringe = []
        for i, ring in enumerate(poly):
            v = ring_vereinfachen([tuple(p[:2]) for p in ring], tol)
            if v is None:
                continue
            if i > 0 and flaeche(v) < (tol * 2) ** 2:
                continue  # winziges Loch
            ringe.append(v)
        if not ringe:
            continue
        ausmass.append((flaeche(ringe[0]), ringe))
    if not ausmass:
        return None
    ausmass.sort(key=lambda t: -t[0])
    groesste = ausmass[0][1][0]
    pol = []
    for i, (fl, ringe) in enumerate(ausmass):
        if i > 0 and fl < max(klein, (tol * 2) ** 2):
            continue  # winzige Insel
        kod = [kodieren(r, s) for r in ringe]
        kod = [k for k in kod if k]
        if kod:
            pol.append(kod)
    if not pol:
        return None
    c = label if label else beschriftungspunkt(groesste)
    return {'n': name, 'c': [round(c[0] * s), round(c[1] * s)], 'p': pol}


def schreibe(datei, quelle, ebenen):
    pfad = os.path.join(HIER, datei)
    with open(pfad, 'w', encoding='utf-8') as f:
        json.dump({'v': 1, 'quelle': quelle, 'ebenen': ebenen}, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{datei}: {os.path.getsize(pfad) / 1024:.0f} KB', {k: len(v['f']) for k, v in ebenen.items()})


def main(roh):
    # ---- Welt: Staaten ohne Deutschland (das kommt genauer von der BKG) und ohne Antarktis ----
    laender = []
    for f in lade(roh, 'ne_50m_admin_0_countries.geojson'):
        p = f['properties']
        iso = p.get('ADM0_A3') or ''
        if iso in ('DEU', 'ATA'):
            continue
        name = p.get('NAME_DE') or p.get('NAME') or iso
        label = (p['LABEL_X'], p['LABEL_Y']) if p.get('LABEL_X') is not None else None
        o = objekt(name, polygone(f['geometry']), 0.04, 100, label, klein=0.15)
        if o:
            laender.append(o)
    schreibe('welt.json', 'Natural Earth (gemeinfrei), 1:50 Mio., vereinfacht', {'laender': {'s': 100, 'f': laender}})

    # ---- Deutschland: Bundesländer und Landkreise (nur Landflächen, GF = 4) ----
    lan = []
    for f in lade(roh, 'vg250_lan.json'):
        p = f['properties']
        if p.get('gf') != 4:
            continue
        o = objekt(p['gen'], polygone(f['geometry']), 0.004, 1000, klein=0.0004)
        if o:
            lan.append(o)
    krs = []
    for f in lade(roh, 'vg250_krs.json'):
        p = f['properties']
        if p.get('gf') != 4:
            continue
        o = objekt(p['gen'], polygone(f['geometry']), 0.0025, 1000, klein=0.0002)
        if o:
            krs.append(o)
    schreibe('deutschland.json', '© BKG (2025), dl-de/by-2-0, Verwaltungsgebiete 1:250 000 (VG250), vereinfacht',
             {'bundeslaender': {'s': 1000, 'f': lan}, 'kreise': {'s': 1000, 'f': krs}})

    # ---- Berlin: Ortsteile ----
    ots = []
    for f in lade(roh, 'berlin_ortsteile.json'):
        o = objekt(f['properties']['nam'], polygone(f['geometry']), 0.00012, 10000, klein=0.000003)
        if o:
            ots.append(o)
    schreibe('berlin.json', 'Geoportal Berlin, ALKIS Berlin Ortsteile, dl-de/zero-2-0, vereinfacht', {'ortsteile': {'s': 10000, 'f': ots}})


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
