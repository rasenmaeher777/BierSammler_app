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
- Die Kategorie wird zufällig, aber fest aus der ID abgeleitet
  (50 % Standardgebräu, 15 % Klassiker, 15 % Spezialität, 10 % Raddelfuß, 7 % Zaubertrank, 3 % Heiligtum).
  Raddelfuß ist aus dem hinteren Teil der früheren Klassiker herausgeschnitten (siehe `ZIEH_REIHENFOLGE` im Skript);
  `FESTE_KATEGORIE` hält einzelne Biere (z. B. Sternburg - Export) unabhängig vom Zufall in ihrer Kategorie.
