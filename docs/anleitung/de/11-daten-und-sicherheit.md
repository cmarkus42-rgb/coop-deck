<!-- Erzeugt aus anleitung/de/ mit `npm run anleitung`. Dort ändern, nicht hier. -->

# Daten und Sicherheit

## Wo was liegt

| Ort | Inhalt |
|---|---|
| `<projekt>/.coop/` | Artefakte, Rückmeldungen, Hinweise, Fragen und Lieferungen des Projekts. Lesbare Dateien, mit git versionierbar. |
| `~/Library/Application Support/coop-deck/` (Linux: `~/.local/share/coop-deck/`) | Laufzeitzustand: Register der Projekte und Sessions, Briefings, Einstellungen, der Befehl `coop`. |

Das Deck kopiert keine Projekte und schreibt nicht in `CLAUDE.md` oder `AGENTS.md`. Es hält die Ausgabe der Sessions nicht fest.

## Was den Rechner verlässt

Von sich aus nichts. Artefakte laden nichts aus dem Netz. Ausnahmen richtest du selbst ein:

- **Telegram**: Was eine Session meldet, geht an Telegram.
- **Handy und Tablet**: Der Zugang lauscht nur auf diesem Rechner; nach außen bringt ihn erst dein Weiterleiter.
- Die CLIs sprechen mit ihren Anbietern wie sonst auch.

## Inhalt aus einem Projekt gilt als fremd

Ein geöffnetes Repository kann HTML enthalten, das du nicht geschrieben hast. Deshalb gibt es Vertrauensstufen:

- Die Ansichten der Typen gehören zum Deck und dürfen dessen Schnittstelle benutzen.
- Freie Artefakte, Projektdateien und HTML von Varianten laufen abgeschottet und erreichen die Schnittstelle nicht.
- Nichts, was eine Seite schickt, wird wörtlich in eine Session getippt. Seiten nennen nur, was geschehen soll; den Text setzt das Deck selbst zusammen.
- Der Zugang fürs Handy ist eine eigene, engere Stufe mit eigenem Schlüssel.

## Sessions ohne Rückfragen

In der Vorgabe führen Sessions Befehle aus, ohne zu fragen. Das ist bequem und heißt: Was die Session liest, kann sie zu Handlungen bewegen. Öffne fremde Repositories mit Rückfragen, bis du ihnen traust (siehe [Sessions](02-sessions.md)).

## Startbefehle von Diensten

Ein Projekt kann einen Startbefehl hinterlegen. Das Deck führt ihn erst aus, nachdem du genau diese Fassung bestätigt hast (siehe [Dienste](09-dienste.md)).
