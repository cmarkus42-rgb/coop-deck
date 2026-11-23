Eine Variantenwahl stellt Entwürfe nebeneinander. Lege Bilder oder HTML-Dateien der Varianten in den Artefaktordner und trage sie in `daten.json` ein:

```json
{ "format": 1, "titel": "…", "frage": "worum es bei der Wahl geht",
  "varianten": [{ "id": "A", "titel": "…", "beschreibung": "was diese Variante ausmacht", "bild": "a.png", "html": "a.html" }],
  "wahl": null, "begruendung": "" }
```

`bild` und `html` sind Pfade relativ zum Artefaktordner; eines von beiden genügt. Zeige echte Unterschiede, keine Abstufungen derselben Idee. Nach der Wahl stehen `wahl` und `begruendung` in der Datei. Bezug für `--ref`: `variante:A`.
