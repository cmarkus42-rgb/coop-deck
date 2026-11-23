A questionnaire collects real gaps in one round. Enter the questions in `daten.json`; {{name}} answers in the artifact and sends everything back together.

```json
{ "format": 1, "titel": "…", "einleitung": "wozu die Antworten gebraucht werden",
  "fragen": [{ "id": "F1", "frage": "…", "kontext": "warum das offen ist",
               "vorschlag": "dein eigener Vorschlag", "optionen": ["A", "B"], "antwort": "" }] }
```

Field names are German: `titel` (title), `einleitung` (introduction: what the answers are needed for), `fragen` (questions), `frage` (the question), `kontext` (context: why this is open), `vorschlag` (your own proposal), `optionen` (options), `antwort` (answer).

Every question carries your proposal. Only ask questions whose answer changes what you build. The answer is then in the field `antwort`. For a single decision use `coop frage`. Reference for `--ref`: `frage:F1`.
