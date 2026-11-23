Ein Fragebogen sammelt echte Lücken in einer Runde. Trage die Fragen in `daten.json` ein; {{name}} antwortet im Artefakt und sendet gesammelt zurück.

```json
{ "format": 1, "titel": "…", "einleitung": "wozu die Antworten gebraucht werden",
  "fragen": [{ "id": "F1", "frage": "…", "kontext": "warum das offen ist",
               "vorschlag": "dein eigener Vorschlag", "optionen": ["A", "B"], "antwort": "" }] }
```

Jede Frage trägt deinen Vorschlag. Stelle nur Fragen, deren Antwort ändert, was du baust. Die Antwort steht danach im Feld `antwort`. Für eine einzelne Entscheidung nimm `coop frage`. Bezug für `--ref`: `frage:F1`.
