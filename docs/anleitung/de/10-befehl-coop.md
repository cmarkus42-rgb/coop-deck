<!-- Erzeugt aus anleitung/de/ mit `npm run anleitung`. Dort ändern, nicht hier. -->

# Der Befehl coop

Mit `coop` bedient eine Session das Deck. Der Befehl liegt in jeder Session des Decks im Suchpfad; das Briefing erklärt ihn. Du brauchst ihn selten selbst, aber es hilft zu wissen, was eine Session damit kann. `coop hilfe` zeigt dieselbe Liste im Terminal.

```
coop — Verbindung einer Session zum Coop Deck

  coop artefakt liste
  coop artefakt neu <typ> "<titel>" [--quelle <datei>] [--url <adresse>]
  coop artefakt import <datei.html> "<titel>" [--herkunft <adresse>]
  coop zeigen <artefakt|datei|adresse> [--ref <bezug>]
  coop hinweis "<text>" [--artefakt <id>] [--ref <bezug>]
  coop frage "<titel>" [--text "…"] --option "A::Titel::Erläuterung" … [--warten]
  coop antwort <frage-id>
  coop frage zurueck <frage-id>                Frage zurückziehen, wenn sie sich erledigt hat
  coop melden "<text>"                         Ergebnis melden: Telegram, sonst Mitteilung am Rechner
  coop dienst liste | starte <name>            Dienste des Projekts und gemeinsame Dienste des Rechners
  coop anfordern "<titel>" [--text "…"] [--art foto|ton|beides] [--warten]     Fotos oder Ton vom Handy
  coop anfrage liste | zeige <kennung> | erledigt <kennung>
  coop bild <artefakt|datei|adresse> [--breite 1280] [--hoehe 900]
  coop roadmap liste | zeige <R-n> | status <R-n> <offen|in-arbeit|pruefen|erledigt|verworfen> [--notiz "…"]
  coop roadmap neu "<titel>" [--meilenstein <id>] [--beschreibung "…"] [--abnahme "…"]…
  coop roadmap notiz <R-n> "<text>"            (alle roadmap-Befehle: [--artefakt <id>])
  coop rueckmeldung liste | erledigt <kennung> [--notiz "…"]
  coop sitzung ergebnis "<text>"
  coop sitzung thema "<worte>"                 (benennt den Reiter)
  coop uebergabe "<Stand>" [--offen "…"]… [--naechster "…"]

Bezüge (--ref) sind die Kennungen, die ein Artefakt vergibt, z. B. roadmap:R-3 oder datei:PROJEKT.md:14.
Alles liegt als Datei im Projekt unter .coop/ und lässt sich auch direkt lesen und schreiben.
```

## Die wichtigsten im Alltag

| Befehl | Was geschieht bei dir |
|---|---|
| `coop zeigen` | Rechts öffnet sich ein Reiter und springt an die genannte Stelle. |
| `coop hinweis` | Ein Band erscheint über der Ansicht, der Hinweis steht im Eingang. |
| `coop frage` | Eine Frage mit Optionen steht im Eingang. Mit `--warten` wartet die Session auf deine Antwort. |
| `coop bild` | Die Session sieht eine Ansicht als Bild, bevor sie sie dir zeigt. |
| `coop melden` | Eine Meldung über Telegram oder als Mitteilung am Rechner. |
| `coop anfordern` | Eine Anfrage nach Fotos oder Ton auf dem Handy. |
| `coop roadmap` | Die Roadmap wird gelesen und fortgeschrieben. |
| `coop sitzung thema` | Der Reiter der Session bekommt einen Namen. |
| `coop uebergabe` | Stand und Offenes werden für die nächste Session festgehalten. |

## Dieselben Wörter in beiden Sprachen

Befehle, Feldnamen und Statuswerte sind in der deutschen und der englischen Oberfläche gleich (`coop zeigen`, `in-arbeit`). So lässt sich ein Projekt in beiden Sprachen öffnen.

## MCP

Dieselben Funktionen gibt es als MCP-Server (`coop mcp`). Das Deck gibt ihn Claude Code, Codex und opencode beim Start mit, ohne deren Konfiguration anzufassen.
