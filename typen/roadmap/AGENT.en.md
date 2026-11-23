The roadmap is a JSON file (`daten.json` in the artifact folder). {{name}} sees it in the viewer and changes it there; you change it with `coop roadmap …` or directly in the file.

```json
{ "format": 1, "titel": "…",
  "meilensteine": [{ "id": "M1", "titel": "…", "ziel": "…" }],
  "punkte": [{ "id": "R-1", "titel": "…", "beschreibung": "…", "meilenstein": "M1",
               "status": "offen", "abnahme": ["…"], "abhaengig": ["R-0"], "dateien": ["src/…"] }] }
```

Field names are German: `titel` (title), `meilensteine` (milestones), `ziel` (goal), `punkte` (roadmap items), `beschreibung` (description), `meilenstein` (milestone of the item), `abnahme` (acceptance criteria), `abhaengig` (items this one depends on), `dateien` (files affected).

- Status: `offen` (open), `in-arbeit` (in progress), `pruefen` (to review), `erledigt` (done), `verworfen` (dropped). “erledigt” is set by {{name}}; `coop roadmap status R-1 erledigt` records your proposal.
- Ids (`R-n`) are fixed and never reassigned. New items get the next free number (`coop roadmap neu "…"` does that).
- Acceptance criteria are sentences that can be checked. An item without criteria is not ready to start.
- Reference for `--ref`: `roadmap:R-1`, for a milestone `roadmap:meilenstein:M1`.
- When {{name}} changes the roadmap in the viewer, the deck collects what has changed and they send it to you at the press of a button: one line with ids and changed fields, without the text. Then read the current state with `coop roadmap zeige <R-n>`. You are told about items you are working on (your task and every item whose status or note you have set through `coop`).
