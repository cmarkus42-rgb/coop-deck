# Artefakte

Ein Artefakt ist etwas, worüber du mit der Session sprichst und das bleibt: eine Roadmap, das Projektblatt, ein Dokument, eine Seite. Es liegt als Datei im Projekt und wird rechts in einem Reiter gezeigt. Verschiedene CLIs arbeiten nacheinander am selben Artefakt, weil die Daten im Projekt liegen und nicht in einer Session.

## Öffnen und anlegen

- Das **+** in der Reiterleiste rechts listet die Artefakte des Projekts und legt mit **{{ui.menue.neuesArtefakt}}** ein neues an.
- In die Adresszeile kannst du eine Adresse, den Namen eines Artefakts oder den Pfad einer Datei im Projekt schreiben.
- Die Session öffnet Reiter mit `coop zeigen` und springt dabei an eine Stelle.

## Die Typen

Typisierte Artefakte trennen Daten und Darstellung. Die Session ändert die Datendatei; die Ansicht lädt von selbst nach.

| Typ | Wozu |
|---|---|
| **{{typ.projektblatt}}** | Der maßgebliche Ort für Vorgaben, Fakten, Entscheidungen und Offenes. Jede Session bekommt es im Briefing. |
| **{{typ.roadmap}}** | Meilensteine und Punkte mit Zustand, Abnahmekriterien und Abhängigkeiten. Aus jedem Punkt startet eine Session. |
| **{{typ.dokument}}** | Eine Markdown-Datei des Projekts, lesbar gesetzt. Jede Stelle ist mit Datei und Zeile ansprechbar. |
| **{{typ.fragebogen}}** | Mehrere Fragen der Session auf einmal, jede mit Vorschlag. Die Antworten gehen gesammelt zurück. |
| **{{typ.variantenwahl}}** | Zwei bis drei Entwürfe nebeneinander: wählen und begründen. |
| **{{typ.review}}** | Befunde mit Schwere, Fundstelle und Zustand. Aus jedem Befund startet eine Session. |
| **{{typ.uebergabe}}** | Stand, Offenes und nächster Schritt am Ende einer Session. Die nächste Session liest es im Briefing. |
| **{{typ.web}}** | Eine laufende Seite, etwa ein Dev-Server, als Reiter zum Markieren und Zeigen. |
| **{{typ.frei}}** | Eigenes HTML im Artefaktordner, wenn kein Typ passt. |

## Die Roadmap

Den Zustand eines Punktes änderst du in der Ansicht, die Session mit `coop roadmap status`. „Erledigt“ setzt nur du: Meldet die Session einen Punkt als erledigt, ist das ein Vorschlag, den du bestätigst. Änderst du etwas in der Ansicht, erfährt es die Session, die an der Roadmap arbeitet.

## Fremder Inhalt

Freie Artefakte, Projektdateien und HTML von Varianten gelten als Inhalt des Projekts und damit als fremd. Sie laufen abgeschottet und erreichen die Schnittstelle des Decks nicht. Mehr dazu in [Daten und Sicherheit](11-daten-und-sicherheit.md).
