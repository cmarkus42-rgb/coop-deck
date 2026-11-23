A review collects findings on a subject (code, design, text). Enter them in `daten.json`; {{name}} sets the status and starts a session per finding.

```json
{ "format": 1, "titel": "…", "gegenstand": "was geprüft wurde, mit Stand (Commit, Datum)",
  "befunde": [{ "id": "B-1", "titel": "…", "schwere": "hoch", "status": "offen",
                "fundstelle": "src/datei.ts:42", "beschreibung": "was falsch ist und was daraus folgt",
                "vorschlag": "wie es zu beheben wäre" }] }
```

Field names are German: `titel` (title), `gegenstand` (subject: what was reviewed, with its state, such as commit or date), `befunde` (findings), `schwere` (severity), `fundstelle` (location), `beschreibung` (description: what is wrong and what follows from it), `vorschlag` (proposal: how to fix it).

- Severity (`schwere`): `kritisch` (critical), `hoch` (high), `mittel` (medium), `niedrig` (low). Status: `offen` (open), `in-arbeit` (in progress), `behoben` (fixed), `abgelehnt` (rejected).
- Ids (`B-n`) are fixed and never reassigned.
- A finding names the consequence, not just the location. What you did not review goes in `gegenstand`.
- Once you have fixed a finding, set its status to `behoben`. “abgelehnt” is set by {{name}}.
- Reference for `--ref`: `befund:B-1`.
