Ein Review sammelt Befunde zu einem Gegenstand (Code, Entwurf, Text). Trage sie in `daten.json` ein; {{name}} setzt den Status und startet je Befund eine Session.

```json
{ "format": 1, "titel": "…", "gegenstand": "was geprüft wurde, mit Stand (Commit, Datum)",
  "befunde": [{ "id": "B-1", "titel": "…", "schwere": "hoch", "status": "offen",
                "fundstelle": "src/datei.ts:42", "beschreibung": "was falsch ist und was daraus folgt",
                "vorschlag": "wie es zu beheben wäre" }] }
```

- Schwere: `kritisch`, `hoch`, `mittel`, `niedrig`. Status: `offen`, `in-arbeit`, `behoben`, `abgelehnt`.
- Kennungen (`B-n`) sind fest und werden nie neu vergeben.
- Ein Befund nennt die Folge, nicht nur die Stelle. Was du nicht geprüft hast, steht im `gegenstand`.
- Hast du einen Befund behoben, setze seinen Status auf `behoben`. „abgelehnt“ setzt {{name}}.
- Bezug für `--ref`: `befund:B-1`.
