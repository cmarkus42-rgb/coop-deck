# Sessions

Eine Session ist eine CLI, die im Projektverzeichnis läuft. Sie läuft in tmux weiter, wenn du das Fenster schließt, und ist beim nächsten Start wieder da.

## Starten

- Das **+** in der Reiterleiste links öffnet das Menü: eine der CLIs, **{{ui.menue.mitTitel}}** oder **{{ui.terminalOhneCli}}**.
- **{{ui.menue.mitTitel}}** fragt nach Titel, Zweck und erstem Auftrag. Der Zweck steht im Briefing und am Reiter. **{{ui.sd.briefing}}** zeigt vorher, was die Session zu lesen bekommt.
- Aus einem Roadmap-Punkt oder einem Befund startet eine Session direkt mit diesem Auftrag (siehe [Artefakte](03-artefakte.md)).
- In der Fußzeile legst du fest, welche CLI neue Sessions im Projekt nehmen und ob beim Öffnen des Projekts eine Session startet.

## Ohne Rückfragen

In der Vorgabe starten Sessions so, dass die CLI Befehle und Änderungen ausführt, ohne um Freigabe zu bitten. Solche Reiter tragen die Marke „{{ui.sitzung.frei}}“. Abschalten kannst du das unter **{{ui.einstellungen}}** für alle oder im Dialog einer neuen Session für diesen einen Start.

## Der Zustand

Das Lämpchen am Reiter zeigt, ob die Session arbeitet, fertig ist oder auf dich wartet. Ist sie fertig oder braucht sie eine Freigabe, steht sie im [Eingang](05-eingang.md).

## Reiter benennen

- Die Session benennt ihren Reiter selbst nach dem, woran ihr gerade arbeitet (`coop sitzung thema`).
- Ein Doppelklick auf den Reiter benennt ihn von Hand. Dein Name bleibt; die Session überschreibt ihn nicht.
- Leerst du das Feld, darf die Session den Namen wieder setzen.

## Aufträge und die Schlange

Was du aus dem Deck an eine Session schickst (eine Rückmeldung, eine Antwort), wird getippt, wenn sie Eingabe annimmt. Arbeitet sie gerade, wartet es in der Schlange; die Zahl steht am Reiter. In der Fußzeile kannst du die Schlange sofort senden.

## Beenden und fortsetzen

Das **×** am Reiter beendet die Session nach Rückfrage. Sie bleibt im Register: Über das **+** findest du sie unter „{{ui.menue.abgelegt}}“ und setzt sie fort. Bei Claude Code ist es genau diese Session; die anderen CLIs nehmen ihre letzte Session in diesem Verzeichnis wieder auf. Ein Terminal lässt sich nicht fortsetzen.

## Was die Session vom Deck weiß

Das Briefing nennt Projektblatt, Artefakte, die letzte Übergabe und den Befehl `coop`. Die Liste aller Befehle steht in [Der Befehl coop](10-befehl-coop.md). Das Deck schreibt dafür nicht in `CLAUDE.md` oder `AGENTS.md` deines Projekts.
