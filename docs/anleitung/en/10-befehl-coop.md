<!-- Generated from anleitung/en/ with `npm run anleitung`. Edit there, not here. -->

# The coop command

A session operates the deck with `coop`. The command is on the path in every session of the deck; the briefing explains it. You rarely need it yourself, but it helps to know what a session can do with it. `coop hilfe` shows the same list in the terminal.

```
coop — connects a session to the Coop Deck

  coop artefakt liste
  coop artefakt neu <type> "<title>" [--quelle <file>] [--url <url>]
  coop artefakt import <file.html> "<title>" [--herkunft <url>]
  coop zeigen <artifact|file|url> [--ref <reference>]
  coop hinweis "<text>" [--artefakt <id>] [--ref <reference>]
  coop frage "<title>" [--text "…"] --option "A::title::explanation" … [--warten]
  coop antwort <question-id>
  coop frage zurueck <question-id>             withdraw a question that has settled itself
  coop melden "<text>"                         report a result: Telegram, otherwise a notification
  coop dienst liste | starte <name>            services of the project and shared services of this computer
  coop anfordern "<title>" [--text "…"] [--art foto|ton|beides] [--warten]     photos or audio from the phone
  coop anfrage liste | zeige <id> | erledigt <id>
  coop bild <artifact|file|url> [--breite 1280] [--hoehe 900]
  coop roadmap liste | zeige <R-n> | status <R-n> <offen|in-arbeit|pruefen|erledigt|verworfen> [--notiz "…"]
  coop roadmap neu "<title>" [--meilenstein <id>] [--beschreibung "…"] [--abnahme "…"]…
  coop roadmap notiz <R-n> "<text>"            (all roadmap commands: [--artefakt <id>])
  coop rueckmeldung liste | erledigt <id> [--notiz "…"]
  coop sitzung ergebnis "<text>"
  coop sitzung thema "<words>"                 (names the tab)
  coop uebergabe "<state>" [--offen "…"]… [--naechster "…"]

Commands and flags are German words in every language of the deck: artefakt = artifact, zeigen = show,
hinweis = note, frage = question, antwort = answer, bild = image, rueckmeldung = feedback, sitzung = session,
ergebnis = result, uebergabe = handover, anfordern = request, anfrage = request, melden = report, dienst = service, starte = start, zurueck = withdraw; liste = list, neu = new, zeige = show, notiz = note, erledigt = done.
Status values: offen = open, in-arbeit = in progress, pruefen = to review, erledigt = done, verworfen = dropped.

References (--ref) are the ids an artifact assigns, e.g. roadmap:R-3 or datei:PROJEKT.md:14.
Everything is a file in the project under .coop/ and can also be read and written directly.
```

## The most important ones day to day

| Command | What happens on your side |
|---|---|
| `coop zeigen` | A tab opens on the right and jumps to the place named. |
| `coop hinweis` | A band appears above the view; the note is in the inbox. |
| `coop frage` | A question with options is in the inbox. With `--warten` the session waits for your answer. |
| `coop bild` | The session sees a view as a picture before showing it to you. |
| `coop melden` | A message via Telegram or as a notification on the machine. |
| `coop anfordern` | A request for photos or audio on the phone. |
| `coop roadmap` | The roadmap is read and updated. |
| `coop sitzung thema` | The tab of the session gets a name. |
| `coop uebergabe` | State and open points are recorded for the next session. |

## The same words in both languages

Commands, field names and status values are the same in the German and the English interface (`coop zeigen`, `in-arbeit`). That way a project can be opened in both languages.

## MCP

The same functions exist as an MCP server (`coop mcp`). The deck hands it to Claude Code, Codex and opencode at start without touching their configuration.
