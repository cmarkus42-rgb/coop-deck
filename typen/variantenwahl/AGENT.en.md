A variant choice puts designs side by side. Put images or HTML files of the variants in the artifact folder and enter them in `daten.json`:

```json
{ "format": 1, "titel": "…", "frage": "worum es bei der Wahl geht",
  "varianten": [{ "id": "A", "titel": "…", "beschreibung": "was diese Variante ausmacht", "bild": "a.png", "html": "a.html" }],
  "wahl": null, "begruendung": "" }
```

Field names are German: `titel` (title), `frage` (question: what the choice is about), `varianten` (variants), `beschreibung` (description: what sets this variant apart), `bild` (image), `wahl` (choice), `begruendung` (reasons).

`bild` and `html` are paths relative to the artifact folder; one of the two is enough. Show real differences, not shades of the same idea. After the choice, `wahl` and `begruendung` are in the file. Reference for `--ref`: `variante:A`.
