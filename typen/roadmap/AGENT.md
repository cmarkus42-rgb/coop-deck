Die Roadmap ist eine JSON-Datei (`daten.json` im Artefaktordner). {{name}} sieht sie im Betrachter und ändert sie dort; du änderst sie mit `coop roadmap …` oder direkt in der Datei.

```json
{ "format": 1, "titel": "…",
  "meilensteine": [{ "id": "M1", "titel": "…", "ziel": "…" }],
  "punkte": [{ "id": "R-1", "titel": "…", "beschreibung": "…", "meilenstein": "M1",
               "status": "offen", "abnahme": ["…"], "abhaengig": ["R-0"], "dateien": ["src/…"] }] }
```

- Status: `offen`, `in-arbeit`, `pruefen`, `erledigt`, `verworfen`. „erledigt“ setzt {{name}}; `coop roadmap status R-1 erledigt` legt deinen Vorschlag an.
- Kennungen (`R-n`) sind fest und werden nie neu vergeben. Neue Punkte bekommen die nächste freie Nummer (`coop roadmap neu "…"` erledigt das).
- Abnahmekriterien sind prüfbare Sätze. Ein Punkt ohne Kriterien ist noch nicht startklar.
- Bezug für `--ref`: `roadmap:R-1`, für einen Meilenstein `roadmap:meilenstein:M1`.
- Ändert der Mensch die Roadmap im Betrachter, sammelt das Deck, was sich geändert hat, und er schickt es dir auf Knopfdruck: eine Zeile mit Kennungen und geänderten Feldern, ohne den Text. Lies dann den Stand mit `coop roadmap zeige <R-n>`. Gemeldet wird dir, was Punkte betrifft, an denen du arbeitest (dein Auftrag und jeder Punkt, dessen Status oder Notiz du über `coop` gesetzt hast).
