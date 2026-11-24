# Handy und Tablet

Über einen eigenen Zugang erreichst du das Deck vom Handy oder Tablet: Du siehst, was wartet, beantwortest Fragen durch Antippen und lieferst Fotos und Ton, die eine Session angefordert hat.

## Einrichten

1. Öffne **{{ui.einstellungen}}**, Abschnitt **{{ui.einst.mobil}}**, und schalte den Zugang ein.
2. Der Zugang lauscht nur auf diesem Rechner. Aufs Gerät bringt ihn ein Weiterleiter mit HTTPS in deinem eigenen Netz, zum Beispiel `tailscale serve`. Ohne HTTPS gibt der Browser am Handy kein Mikrofon frei.
3. Trage die Adresse ein, unter der das Gerät den Zugang erreicht, und speichere.
4. Kopiere die angezeigte Adresse, öffne sie am Gerät und lege sie auf den Startbildschirm.

Die Adresse enthält den Schlüssel. Wer sie kennt, kann liefern und Fragen beantworten. **{{ui.einst.mobilSchluessel}}** macht die alte Adresse ungültig.

## Was die Seite zeigt

- **Was auf dich wartet:** Fragen mit ihren Optionen zum Antippen, fertige und wartende Sessions, Hinweise zum Abhaken.
- **Fotos und Ton:** Anfragen der Sessions. Du nimmst auf oder wählst aus der Mediathek, schreibst auf Wunsch eine Notiz und sendest. Ohne Anfrage kannst du von dir aus etwas an ein Projekt liefern.

Vom Gerät geht kein freier Text als Eingabe in eine Session: Bei Fragen wählst du nur unter den Optionen, die die Session selbst genannt hat. Eine Notiz zu einer Lieferung landet in einer Datei, und die Session bekommt nur den Pfad.

## Wie eine Session etwas anfordert

Die Session ruft `coop anfordern "<was sie braucht>"`. Die Anfrage steht im Eingang und auf dem Gerät. Deine Lieferung liegt danach im Projekt unter `.coop/`, und die Session bekommt eine Zeile mit dem Pfad. Ton wird zusätzlich lokal in Text gewandelt, wenn das Diktat eingerichtet ist (siehe [Diktat und Vorlesen](08-diktat-und-vorlesen.md)).
