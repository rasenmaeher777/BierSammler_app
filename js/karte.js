/* Bier Sammler – Standort und Karte (window.KARTE). STANDORT-KARTE: Alles dazu steht in dieser Datei und in den mit
   „STANDORT-KARTE“ markierten Stellen (siehe CLAUDE.md, Abschnitt „Standort-Karte“, dort auch die Anleitung zum Entfernen).

   1. Standort: Schalter in den Einstellungen (localStorage, standardmäßig aus). Ist er an, holt die App den Standort, sobald der
      Dialog „Bier hinzufügen“ aufgeht (prepare), und hängt ihn beim Bestätigen an den Eintrag (place). Es wird NIE auf den Standort
      gewartet und nie beim Öffnen der App gefragt. Ohne Erlaubnis, ohne Signal oder bei ausgeschaltetem Schalter wird der Eintrag
      einfach ohne Ort gespeichert. Gespeichert wird auf rund 100 m gerundet (GAME.cleanPlace).
   2. Karte: eigene Vektorkarte auf einem Canvas, ohne Kacheln und ohne Dienst von außen. Die Grenzdaten liegen als kleine
      JSON-Dateien in Datensammlung/karte/ (erzeugt von bauen.py) und werden erst beim ersten Öffnen der Karte geladen:
      Staaten (welt.json), Bundesländer und Landkreise (deutschland.json), Berliner Ortsteile (berlin.json).
      Bedienung: Ziehen, Zwei-Finger-Zoom, Mausrad, Doppeltippen, Knöpfe +/−/„Alle Punkte“, Pfeiltasten. Ein Tipp auf einen Punkt
      zeigt Ort und Biere. Punkte werden größer, je mehr Einträge am selben (gerundeten) Ort liegen. */
window.KARTE = (() => {
  'use strict';

  const G = window.GAME;
  const LS_ON = 'biersammler-standort-v1'; // „1“ = Standort beim Eintragen speichern
  const FILES = ['Datensammlung/karte/welt.json', 'Datensammlung/karte/deutschland.json', 'Datensammlung/karte/berlin.json'];
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* Speicher nicht verfügbar */ } };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ---------- 1. Standort ---------- */

  const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const enabled = () => supported() && lsGet(LS_ON) === '1';
  const loc = { pos: null, pending: null, denied: false }; // pos = { lat, lng, t }
  const fresh = (ms) => !!loc.pos && Date.now() - loc.pos.t <= ms;

  // Einmal den Standort holen. Antwort: { ok: true } oder { ok: false, reason: 'unsupported' | 'denied' | 'timeout' | 'unavailable' }
  function ask() {
    if (!supported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
    if (loc.pending) return loc.pending;
    loc.pending = new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition((p) => {
          const c = G.cleanPlace(p.coords.latitude, p.coords.longitude);
          if (c) loc.pos = { lat: c.lat, lng: c.lng, t: Date.now() };
          resolve(c ? { ok: true } : { ok: false, reason: 'unavailable' });
        }, (err) => {
          const code = err && err.code;
          if (code === 1) loc.denied = true;
          resolve({ ok: false, reason: code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable' });
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
      } catch { resolve({ ok: false, reason: 'unavailable' }); }
    }).finally(() => { loc.pending = null; });
    return loc.pending;
  }

  // Beim Öffnen von „Bier hinzufügen“ im Hintergrund den Standort holen (nur bei eingeschaltetem Schalter)
  async function prepare() {
    if (!enabled() || fresh(3 * 60 * 1000)) return;
    let state = null;
    try { state = navigator.permissions && navigator.permissions.query ? await navigator.permissions.query({ name: 'geolocation' }) : null; } catch { state = null; }
    if (state ? state.state === 'denied' : loc.denied) return; // abgelehnt: nicht noch einmal fragen
    ask();
  }

  // Standort für den Eintrag, der jetzt gespeichert wird: { lat, lng } (gerundet) oder null
  function place() {
    if (!enabled() || !fresh(10 * 60 * 1000)) return null;
    return { lat: loc.pos.lat, lng: loc.pos.lng };
  }

  /* Schalter in den Einstellungen. Einschalten fragt sofort (der Klick ist die Geste, die iOS für die Abfrage braucht):
     Antwort { ok: true, note? } oder { ok: false, reason }. Bei verweigertem Zugriff bleibt der Schalter aus. */
  async function setEnabled(on) {
    if (!on) { lsSet(LS_ON, null); loc.pos = null; return { ok: true }; }
    if (!supported()) return { ok: false, reason: 'unsupported' };
    loc.denied = false;
    const r = await ask();
    if (!r.ok && r.reason === 'denied') return r;
    lsSet(LS_ON, '1');
    return r.ok ? { ok: true } : { ok: true, note: r.reason };
  }

  /* ---------- 2. Kartendaten ---------- */

  // Web-Mercator: Länge/Breite → Weltkoordinaten 0…1 (x nach rechts, y nach unten)
  function project(lng, lat) {
    const s = Math.sin(clamp(lat, -85.0511, 85.0511) * Math.PI / 180);
    return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
  }
  const unproject = (x, y) => [x * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI];

  // Eine Ebene aus der Datei (siehe Datensammlung/karte/bauen.py) in Weltkoordinaten umrechnen
  function decodeLayer(layer) {
    const s = layer.s;
    const feats = [];
    for (const f of layer.f) {
      const polys = [];
      for (const poly of f.p) {
        const rings = [];
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (const flat of poly) {
          const r = new Float64Array(flat.length);
          let x = 0, y = 0;
          for (let i = 0; i < flat.length; i += 2) {
            x = i === 0 ? flat[0] : x + flat[i];
            y = i === 0 ? flat[1] : y + flat[i + 1];
            const p = project(x / s, y / s);
            r[i] = p[0]; r[i + 1] = p[1];
            if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
            if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
          }
          rings.push(r);
        }
        polys.push({ rings, bbox: [minx, miny, maxx, maxy] });
      }
      const bb = polys.reduce((b, p) => [Math.min(b[0], p.bbox[0]), Math.min(b[1], p.bbox[1]), Math.max(b[2], p.bbox[2]), Math.max(b[3], p.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
      feats.push({ name: f.n, c: project(f.c[0] / s, f.c[1] / s), polys, bbox: bb });
    }
    // Große Flächen zuerst, damit ihre Namen bei Überschneidungen den Vorrang haben
    feats.sort((a, b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) - (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]));
    return feats;
  }

  let geo = null;        // { laender, bundeslaender, kreise, ortsteile } oder null
  let geoLoading = null; // Promise
  function loadGeo() {
    if (geo) return Promise.resolve(geo);
    if (!geoLoading) {
      geoLoading = Promise.all(FILES.map(async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.json();
      })).then(([welt, de, berlin]) => {
        geo = {
          laender: decodeLayer(welt.ebenen.laender),
          bundeslaender: decodeLayer(de.ebenen.bundeslaender),
          kreise: decodeLayer(de.ebenen.kreise),
          ortsteile: decodeLayer(berlin.ebenen.ortsteile),
        };
        return geo;
      }).catch((err) => { geoLoading = null; throw err; });
    }
    return geoLoading;
  }

  function inPoly(poly, x, y) {
    const b = poly.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
    let inside = false;
    for (const r of poly.rings) {
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }
  const findFeature = (feats, x, y) => feats.find((f) => x >= f.bbox[0] && x <= f.bbox[2] && y >= f.bbox[1] && y <= f.bbox[3] && f.polys.some((p) => inPoly(p, x, y))) || null;

  // Ortsname zu einem Weltpunkt: Berliner Ortsteil, sonst Landkreis und Bundesland, sonst Staat; ohne Daten ''
  function placeName(x, y) {
    if (!geo) return '';
    const ot = findFeature(geo.ortsteile, x, y);
    if (ot) return `${ot.name}, Berlin`;
    const kr = findFeature(geo.kreise, x, y);
    if (kr) {
      const land = findFeature(geo.bundeslaender, x, y);
      return land && land.name !== kr.name ? `${kr.name}, ${land.name}` : kr.name;
    }
    const st = findFeature(geo.laender, x, y);
    return st ? st.name : '';
  }

  /* ---------- 3. Ansicht ---------- */

  const ATTRIBUTION = 'Karten: © BKG (2025), dl-de/by-2-0 · Natural Earth · Geoportal Berlin';
  const Z_MAX = 15;
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const CSS_VARS = ['bg', 'land', 'de', 'line', 'ort', 'label', 'dot', 'ring'];

  function mount(host, opts) {
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    const wrap = el('div', 'map-wrap');
    const canvas = el('canvas', 'map-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    const ctl = el('div', 'map-ctl');
    const btn = (text, label, fn) => { const b = el('button', 'map-btn', text); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); ctl.append(b); return b; };
    const info = el('div', 'map-info');
    info.setAttribute('role', 'status');
    info.setAttribute('aria-live', 'polite');
    const load = el('div', 'map-load');
    const spin = el('span', 'spinner'); spin.setAttribute('aria-hidden', 'true');
    load.append(spin, document.createTextNode('Karte wird geladen …'));
    const attr = el('p', 'map-attr', ATTRIBUTION);
    wrap.append(canvas, ctl, info, load, attr);
    host.replaceChildren(wrap);

    const ctx = canvas.getContext('2d');
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const V = { cx: 0.5, cy: 0.5, z: 5, w: 300, h: 300, s: 1, dpr: 1 }; // s = Pixel pro Welteinheit
    let groups = [];       // Punkte: { lat, lng, count, last, drinks, x, y }
    let selected = null;
    let raf = 0;
    let anim = null;
    let dead = false;
    let fitted = false;

    const scaleOf = (z) => 256 * Math.pow(2, z);
    const zMin = () => Math.max(0.8, Math.log2(Math.max(V.w, V.h) / 256));
    function setView(cx, cy, z) {
      V.z = clamp(z, zMin(), Z_MAX);
      V.s = scaleOf(V.z);
      V.cx = clamp(cx, 0, 1);
      V.cy = clamp(cy, 0.02, 0.98);
    }
    function zoomAt(px, py, z) { // Weltpunkt unter (px, py) bleibt dort
      const wx = V.cx + (px - V.w / 2) / V.s, wy = V.cy + (py - V.h / 2) / V.s;
      const nz = clamp(z, zMin(), Z_MAX), ns = scaleOf(nz);
      setView(wx - (px - V.w / 2) / ns, wy - (py - V.h / 2) / ns, nz);
    }

    function animateTo(cx, cy, z, ms = 280) {
      if (calm.matches) { setView(cx, cy, z); draw(); return; }
      anim = { t0: performance.now(), ms, from: { cx: V.cx, cy: V.cy, z: V.z }, to: { cx, cy, z: clamp(z, zMin(), Z_MAX) } };
      schedule();
    }
    function step(now) {
      if (!anim) return;
      const t = clamp((now - anim.t0) / anim.ms, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const a = anim.from, b = anim.to;
      setView(a.cx + (b.cx - a.cx) * e, a.cy + (b.cy - a.cy) * e, a.z + (b.z - a.z) * e);
      if (t >= 1) anim = null;
    }

    function fitAll(animate) {
      if (!groups.length) {
        // Ohne Punkte: Deutschland
        const a = project(5.8, 55.1), b = project(15.1, 47.2);
        const z = Math.log2(Math.min(V.w / ((b[0] - a[0]) * 256), V.h / ((b[1] - a[1]) * 256))) - 0.1;
        const t = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z];
        if (animate) animateTo(...t); else setView(...t);
        return;
      }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const g of groups) { x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x); y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y); }
      const pad = 0.78; // Rand um die Punkte
      const dx = Math.max(x1 - x0, 1e-9), dy = Math.max(y1 - y0, 1e-9);
      const z = Math.min(12, Math.log2(Math.min((V.w * pad) / (dx * 256), (V.h * pad) / (dy * 256))));
      const t = [(x0 + x1) / 2, (y0 + y1) / 2, z];
      if (animate) animateTo(...t); else setView(...t);
    }

    function resize() {
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      V.w = r.width; V.h = r.height;
      V.dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(V.w * V.dpr);
      canvas.height = Math.round(V.h * V.dpr);
      if (!fitted) { fitAll(false); fitted = true; } else setView(V.cx, V.cy, V.z);
      schedule();
    }

    /* ----- Zeichnen ----- */

    function colors() {
      const cs = getComputedStyle(wrap);
      const c = {};
      for (const k of CSS_VARS) c[k] = cs.getPropertyValue(`--map-${k}`).trim() || '#888';
      return c;
    }

    // Umrisse in den Pfad legen. Nahe Punkte (< 0,7 px) entfallen, Flächen ganz außerhalb oder unter 1 px werden übersprungen
    function trace(feats, skip) {
      const { cx, cy, s, w, h } = V;
      for (const f of feats) {
        if (skip && f.name === skip) continue;
        const fb = f.bbox;
        if ((fb[2] - cx) * s + w / 2 < 0 || (fb[0] - cx) * s + w / 2 > w || (fb[3] - cy) * s + h / 2 < 0 || (fb[1] - cy) * s + h / 2 > h) continue;
        for (const poly of f.polys) {
          const b = poly.bbox;
          const x0 = (b[0] - cx) * s + w / 2, x1 = (b[2] - cx) * s + w / 2, y0 = (b[1] - cy) * s + h / 2, y1 = (b[3] - cy) * s + h / 2;
          if (x1 < 0 || x0 > w || y1 < 0 || y0 > h || (x1 - x0 < 1 && y1 - y0 < 1)) continue;
          for (const r of poly.rings) {
            let lx = 0, ly = 0;
            const last = r.length - 2;
            for (let i = 0; i <= last; i += 2) {
              const x = (r[i] - cx) * s + w / 2, y = (r[i + 1] - cy) * s + h / 2;
              if (i === 0) { ctx.moveTo(x, y); lx = x; ly = y; } else if (Math.abs(x - lx) + Math.abs(y - ly) >= 0.7 || i === last) { ctx.lineTo(x, y); lx = x; ly = y; }
            }
            ctx.closePath();
          }
        }
      }
    }
    // skip: Name eines Objekts, dessen LINIE entfällt (Fläche bleibt). Berlin: Ab starkem Zoom zeichnen die Ortsteile die Stadtgrenze
    // genauer, die gröbere Linie der Landkreise/Bundesländer würde daneben doppelt erscheinen.
    function layer(feats, fill, stroke, width, skip) {
      if (fill) { ctx.beginPath(); trace(feats); ctx.fillStyle = fill; ctx.fill('evenodd'); }
      if (stroke) { ctx.beginPath(); trace(feats, skip); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
    }

    const dotRadius = (n) => Math.min(13, 2.6 + 1.9 * Math.sqrt(n - 1));

    function draw() {
      raf = 0;
      if (dead || !V.w) return;
      const C = colors();
      const { cx, cy, s, w, h, z } = V;
      ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, w, h);
      if (geo) {
        layer(geo.laender, C.land, C.line, 0.8);
        const noBerlin = z >= 10 ? 'Berlin' : null;
        layer(geo.bundeslaender, C.de, C.line, z < 6 ? 0.8 : 1.3, noBerlin);
        if (z >= 6.2) { ctx.globalAlpha = clamp((z - 6.2) / 1, 0, 1) * 0.9; layer(geo.kreise, null, C.line, 0.6, noBerlin); ctx.globalAlpha = 1; }
        if (z >= 9) { ctx.globalAlpha = clamp((z - 9) / 0.8, 0, 1); layer(geo.ortsteile, C.ort, C.line, 1); ctx.globalAlpha = 1; }
        drawLabels(C);
      }
      // Punkte: große zuerst, damit kleine darüber liegen
      const order = groups.slice().sort((a, b) => b.count - a.count);
      for (const g of order) {
        const x = (g.x - cx) * s + w / 2, y = (g.y - cy) * s + h / 2;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
        const r = dotRadius(g.count);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = C.dot;
        ctx.globalAlpha = 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = C.ring;
        ctx.stroke();
        if (g === selected) {
          ctx.beginPath();
          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
          ctx.lineWidth = 2;
          ctx.strokeStyle = C.dot;
          ctx.stroke();
        }
      }
    }

    function drawLabels(C) {
      const { cx, cy, s, w, h, z } = V;
      // Sperrzonen für Beschriftungen: Knöpfe oben rechts, Quellenangabe unten, und die Punkte selbst
      const boxes = [[w - 52, 0, w, 156], [0, h - 24, w, h]];
      for (const g of groups) {
        const x = (g.x - cx) * s + w / 2, y = (g.y - cy) * s + h / 2, r = dotRadius(g.count) + 1;
        if (x > -r && x < w + r && y > -r && y < h + r) boxes.push([x - r, y - r, x + r, y + r]);
      }
      const put = (text, f, size, minPx) => {
        const bw = (f.bbox[2] - f.bbox[0]) * s;
        if (bw < minPx) return;
        const x0 = (f.c[0] - cx) * s + w / 2, y0 = (f.c[1] - cy) * s + h / 2;
        if (x0 < 0 || x0 > w || y0 < 0 || y0 > h) return;
        ctx.font = `600 ${size}px ${FONT}`;
        const tw = ctx.measureText(text).width;
        // Liegt etwas im Weg (Punkt, anderer Name), versucht der Name noch Stellen darunter, darüber und seitlich
        const d = size + 3, side = tw / 2 + 12, diag = side * 0.7;
        for (const [dx, dy] of [[0, 0], [side, 0], [-side, 0], [0, d], [0, -d], [diag, d], [-diag, d], [diag, -d], [-diag, -d], [0, 2 * d], [0, -2 * d]]) {
          const y = y0 + dy, x = x0 + dx;
          const r = [x - tw / 2 - 2, y - size / 2 - 1, x + tw / 2 + 2, y + size / 2 + 1];
          if (r[0] < 2 || r[2] > w - 2 || r[1] < 0 || r[3] > h) continue;
          if (boxes.some((b) => r[0] < b[2] && r[2] > b[0] && r[1] < b[3] && r[3] > b[1])) continue;
          boxes.push(r);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = C.land;
          ctx.strokeText(text, x, y);
          ctx.fillStyle = C.label;
          ctx.fillText(text, x, y);
          return;
        }
      };
      // Gebiete, in denen ein Punkt liegt, werden zuerst beschriftet (sonst verdrängen andere Namen sie)
      const prio = (feats) => {
        const hot = new Set();
        for (const g of groups) { const f = findFeature(feats, g.x, g.y); if (f) hot.add(f); }
        return [...hot, ...feats.filter((f) => !hot.has(f))];
      };
      if (z >= 10.2) prio(geo.ortsteile).forEach((f) => put(f.name, f, 11, 34));
      else if (z >= 8.2) prio(geo.kreise).forEach((f) => put(f.name, f, 10.5, 40));
      if (z >= 4.6 && z < 8.6) geo.bundeslaender.forEach((f) => put(f.name, f, 12, 30));
      if (z < 6.8) geo.laender.forEach((f) => put(f.name, f, 11, 26));
    }

    function schedule() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      step(now);
      draw();
      if (anim) schedule();
    }

    /* ----- Auswahl und Anzeige ----- */

    function describeGroup(g) {
      info.replaceChildren();
      const [lng, lat] = unproject(g.x, g.y);
      const name = placeName(g.x, g.y);
      const head = el('p', 'map-info-head');
      head.append(el('b', '', name || `${lat.toFixed(3).replace('.', ',')}, ${lng.toFixed(3).replace('.', ',')}`), document.createTextNode(` · ${g.count === 1 ? '1 Bier' : `${G.fmtInt(g.count)} Biere`}`));
      const list = el('ul', 'map-info-list');
      for (const d of g.drinks.slice(0, 4)) list.append(el('li', '', opts.describe(d)));
      if (g.drinks.length > 4) list.append(el('li', 'more', `und ${G.fmtInt(g.drinks.length - 4)} weitere`));
      info.append(head, list);
      info.hidden = false;
    }
    function paintInfo() {
      if (selected) { describeGroup(selected); return; }
      if (!groups.length) {
        info.replaceChildren(el('p', 'map-info-head', opts.emptyText));
        info.hidden = false;
        return;
      }
      info.hidden = true;
      info.replaceChildren();
    }
    function hit(px, py) {
      let best = null, bd = Infinity;
      for (const g of groups) {
        const x = (g.x - V.cx) * V.s + V.w / 2, y = (g.y - V.cy) * V.s + V.h / 2;
        const d = Math.hypot(x - px, y - py);
        if (d <= dotRadius(g.count) + 10 && d < bd) { best = g; bd = d; }
      }
      return best;
    }

    /* ----- Bedienung ----- */

    const pts = new Map(); // pointerId → { x, y }
    let pan = null;        // { moved, t0 } während eines Zugs mit einem Finger
    let pinch = null;      // { d0, z0, wx, wy }
    let lastTap = null;    // { t, x, y }
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      anim = null;
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) pan = { moved: 0, t0: performance.now(), x0: pts.get(e.pointerId).x, y0: pts.get(e.pointerId).y };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pan = null;
        pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z0: V.z, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1 && pan) {
        pan.moved = Math.max(pan.moved, Math.hypot(p.x - pan.x0, p.y - pan.y0));
        if (pan.moved > 4) setView(V.cx - (p.x - prev.x) / V.s, V.cy - (p.y - prev.y) / V.s, V.z);
        schedule();
      } else if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const cxp = (a.x + b.x) / 2, cyp = (a.y + b.y) / 2;
        // Der Mittelpunkt der Finger verschiebt die Karte, der Abstand der Finger zoomt um diesen Punkt
        setView(V.cx - (cxp - pinch.mid.x) / V.s, V.cy - (cyp - pinch.mid.y) / V.s, V.z);
        zoomAt(cxp, cyp, pinch.z0 + Math.log2(d / pinch.d0));
        pinch.mid = { x: cxp, y: cyp };
        schedule();
      }
    });
    const release = (e, cancelled) => {
      const had = pts.delete(e.pointerId);
      if (!had) return;
      if (pts.size === 0) {
        const wasPan = pan;
        pan = null; pinch = null;
        if (!cancelled && wasPan && wasPan.moved <= 6 && performance.now() - wasPan.t0 < 600) tap(local(e));
      } else if (pts.size === 1) {
        // Von zwei auf einen Finger: der Rest zieht weiter, ohne zu springen
        pinch = null;
        const rest = [...pts.values()][0];
        pan = { moved: 99, t0: 0, x0: rest.x, y0: rest.y };
      }
    };
    canvas.addEventListener('pointerup', (e) => release(e, false));
    canvas.addEventListener('pointercancel', (e) => release(e, true));

    function tap(p) {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        lastTap = null;
        const wx = V.cx + (p.x - V.w / 2) / V.s, wy = V.cy + (p.y - V.h / 2) / V.s;
        const nz = clamp(V.z + 1.2, zMin(), Z_MAX), ns = scaleOf(nz);
        animateTo(wx - (p.x - V.w / 2) / ns, wy - (p.y - V.h / 2) / ns, nz);
        return;
      }
      lastTap = { t: now, x: p.x, y: p.y };
      const g = hit(p.x, p.y);
      selected = g === selected ? null : g;
      paintInfo();
      schedule();
    }
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      const unit = e.deltaMode === 1 ? 16 : 1;
      anim = null;
      zoomAt(p.x, p.y, V.z - e.deltaY * unit * (e.ctrlKey ? 0.012 : 0.0025));
      schedule();
    }, { passive: false });
    canvas.addEventListener('keydown', (e) => {
      const k = e.key;
      const move = 80 / V.s;
      if (k === 'ArrowLeft') setView(V.cx - move, V.cy, V.z);
      else if (k === 'ArrowRight') setView(V.cx + move, V.cy, V.z);
      else if (k === 'ArrowUp') setView(V.cx, V.cy - move, V.z);
      else if (k === 'ArrowDown') setView(V.cx, V.cy + move, V.z);
      else if (k === '+' || k === '=') animateTo(V.cx, V.cy, V.z + 1, 200);
      else if (k === '-') animateTo(V.cx, V.cy, V.z - 1, 200);
      else return;
      e.preventDefault();
      schedule();
    });

    btn('+', 'Hineinzoomen', () => animateTo(V.cx, V.cy, V.z + 1, 220));
    btn('−', 'Herauszoomen', () => animateTo(V.cx, V.cy, V.z - 1, 220));
    btn('◎', 'Alle Punkte zeigen', () => fitAll(true));

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    // Wechselt das System zwischen hell und dunkel, während die Karte offen ist, neu zeichnen
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => schedule();
    dark.addEventListener('change', onScheme);

    function setGroups(list) {
      const prevSel = selected ? `${selected.lat},${selected.lng}` : null;
      groups = list.map((g) => { const p = project(g.lng, g.lat); return { ...g, x: p[0], y: p[1] }; });
      selected = prevSel ? groups.find((g) => `${g.lat},${g.lng}` === prevSel) || null : null;
      canvas.setAttribute('aria-label', groups.length
        ? `Karte mit ${G.fmtInt(groups.length)} ${groups.length === 1 ? 'Ort' : 'Orten'}, an denen du Bier getrunken hast. Orte lassen sich antippen.`
        : 'Karte ohne gespeicherte Orte');
      paintInfo();
      schedule();
    }

    function refit() { if (V.w) { fitAll(false); schedule(); } }
    setGroups(opts.groups || []);
    resize();

    loadGeo().then(() => { load.hidden = true; if (selected) paintInfo(); schedule(); }).catch((err) => {
      console.warn('Kartendaten nicht ladbar', err);
      load.replaceChildren(document.createTextNode('Die Kartendaten sind gerade nicht erreichbar. Die Punkte siehst du trotzdem.'));
    });

    return {
      // Neue Punkte (z. B. nach einem Eintrag); die Ansicht bleibt, außer es gab vorher keine Punkte
      update(list) {
        const hadNone = !groups.length;
        setGroups(list);
        if (hadNone && groups.length) refit();
      },
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        ro.disconnect();
        dark.removeEventListener('change', onScheme);
        host.replaceChildren();
      },
    };
  }

  return { supported, enabled, setEnabled, prepare, place, mount };
})();
