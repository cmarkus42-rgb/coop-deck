# Erste Schritte

Das Coop Deck ist eine Arbeitsfläche für die Arbeit mit Coding-CLIs. Links läuft die Session im Terminal, rechts steht, worüber ihr sprecht: Roadmap, Projektblatt, ein Dokument oder die laufende Seite. Dazwischen gibt es einen Rückkanal in beide Richtungen: Die Session zeigt dir etwas und fragt, du markierst und antwortest.

## Ein Projekt öffnen

Ein Projekt ist ein Verzeichnis auf deinem Rechner. Das Deck öffnet es an Ort und Stelle und kopiert nichts.

1. Klicke unten links auf **{{ui.verzeichnisHinzufuegen}}** und wähle den Ordner. Versteckte Ordner zeigt der Dialog mit an.
2. Oder trage unter **{{ui.einstellungen}}** die Ordner ein, in denen deine Projekte liegen. Das Deck sucht dort nach Verzeichnissen mit Code oder Anweisungsdatei.
3. Für ein neues Vorhaben legt **{{ui.neuesProjekt}}** einen Ordner aus einer Vorlage an, mit Projektblatt und Roadmap.

Im Projekt entsteht ein Ordner `.coop/`. Dort liegt alles, was das Deck zum Projekt festhält, als lesbare Dateien.

## Die erste Session

1. Wähle das Projekt in der Leiste links.
2. Starte eine Session mit einer der CLIs. Das Deck findet Claude Code, Codex, opencode und pi, wenn sie im Suchpfad liegen.
3. Die Session bekommt beim Start ein Briefing: das Projektblatt, die Artefakte des Projekts und den Befehl `coop`, mit dem sie das Deck bedient.

Mehr dazu in [Sessions](02-sessions.md).

## Der Aufbau des Fensters

| Bereich | Was dort steht |
|---|---|
| Kopfzeile | Sicht (**{{ui.sicht.links}}**, **{{ui.sicht.beide}}**, **{{ui.sicht.rechts}}**), **{{ui.eingang}}**, Thema, **{{ui.diktat}}**, **{{ui.suchen}}**, **{{ui.hilfe}}**, **{{ui.einstellungen}}** |
| Leiste links | Projekte: oben die mit laufenden Sessions, dann **{{ui.leiste.favoriten}}**, darunter alle, zuklappbar |
| Linker Bereich | Sessions des Projekts, je Session ein Reiter |
| Rechter Bereich | Artefakte und Seiten, je eines pro Reiter |
| Fußzeile | Pfad des Projekts, Dienste, was beim Öffnen startet, die CLI für neue Sessions |

## Schnell irgendwohin

**{{ui.suchen}}** (⌘K) öffnet die Befehlspalette. Sie findet Projekte, Sessions, Artefakte, Roadmap-Punkte und Rückmeldungen über alle Projekte hinweg und führt Befehle aus. Die Sicht wechselst du mit ⌘⌥1, ⌘⌥2 und ⌘⌥3. Außerhalb von macOS steht Strg+Umschalt für ⌘ und Strg+Alt für ⌘⌥.

## Die Projektleiste ordnen

- Der Stern merkt ein Projekt als Favorit.
- Der Knopf neben dem Stern blendet ein Projekt aus der Liste aus; unter „Ausgeblendet“ holst du es zurück.
- Die Liste aller Projekte klappst du an ihrer Überschrift zu. Projekte mit laufenden Sessions und Favoriten bleiben sichtbar.
