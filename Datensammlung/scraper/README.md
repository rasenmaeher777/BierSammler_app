# Bier-Datensammler

Lädt alle Biere von bier-universum.de und schreibt sie nach `Datensammlung/biere.json`,
`Datensammlung/kategorien.json` und `Datensammlung/biere.csv`.
Benötigt nur Python 3 (auf dem Mac vorinstalliert).

## Starten

Im Terminal in diesen Ordner wechseln:

```bash
cd ~/Max_EigeneDateien/Websiten/BierSammler_app/Datensammlung/scraper
```

| Befehl | Was passiert |
|---|---|
| `python3 scraper.py` | Lädt alles (ca. 2 Std.) bzw. setzt einen abgebrochenen Lauf fort |
| `python3 scraper.py --aktualisieren` | Lädt die Liste neu und ergänzt nur neue Biere |
| `python3 scraper.py --nur-export` | Lädt nichts, erzeugt nur JSON/CSV neu aus dem Cache |
| `python3 scraper.py --test 10` | Probelauf mit 10 Bieren, schreibt nur `test_ausgabe.json` |

Tipp: `caffeinate -i python3 scraper.py` verhindert, dass der Mac währenddessen einschläft.
Abbrechen mit `Ctrl + C` – beim nächsten Start geht es an derselben Stelle weiter.

## Wichtig

- **Ordner `cache/` nicht löschen.** Dort liegt `id_zuordnung.json`, die dafür sorgt, dass jedes
  Bier dauerhaft dieselbe ID (`BS-000123`) und dieselbe Kategorie behält – auch nach Updates.
- Die Kategorie (5 Stufen nach Erhältlichkeit, seit 19.11.2026) kommt aus `stufen_zuordnung.json` (Bier-ID → Stufe).
  Neue Biere bekommen sie über `stufen_brauereien.json` (Brauerei → Stufe, Sonder- und Saisonbiere eine Stufe höher);
  unbekannte Brauereien: ausländisch oder Gasthausbrauerei → Heiligtum, sonst Zaubertrank. Einzelne Biere umstufen:
  Wert in `stufen_zuordnung.json` ändern, dann `python3 scraper.py --nur-export`. Mehr dazu in der Haupt-README
  („Kategorien nach Erhältlichkeit“). `stufen_vorschlag.csv` ist nur eine Übersicht zum Durchsehen.
