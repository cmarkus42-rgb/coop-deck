<!-- Erzeugt aus anleitung/de/ mit `npm run anleitung`. Dort ändern, nicht hier. -->

# Meldungen über Telegram

Eine Session, die lange arbeitet, kann dir ihr Ergebnis melden, statt es still ins Terminal zu schreiben. Ohne Telegram erscheint die Meldung als Mitteilung an diesem Rechner; mit Telegram kommt sie aufs Handy.

## Einrichten

1. Lege in Telegram bei `@BotFather` einen Bot an. Du bekommst ein Token.
2. Schreib deinem Bot einmal eine Nachricht. Sonst darf er dich nicht anschreiben.
3. Frage zum Beispiel `@userinfobot` nach deiner Kennung. Gemeint ist die Zahl, nicht der Name des Bots.
4. Öffne **Einstellungen**, Abschnitt **Telegram**, trage Token und Chat-Kennung ein und speichere.
5. **Probenachricht** schickt eine Nachricht zur Probe. Kommt sie nicht an, nennt das Deck den Grund.

## Benutzen

Die Session ruft `coop melden "<ein, zwei Sätze>"`. Das Briefing sagt ihr, dass es diesen Weg gibt. Die Nachricht trägt Projekt und Namen der Session.

Was eine Session meldet, geht an Telegram und verlässt damit diesen Rechner. Je Session sind es höchstens 20 Meldungen in der Stunde.
