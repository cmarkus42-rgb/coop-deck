<!-- Erzeugt aus anleitung/de/ mit `npm run anleitung`. Dort ändern, nicht hier. -->

# Dienste

Ein Dienst ist eine lokale Anwendung eines Projekts, etwa ein Dev-Server. Das Deck startet ihn beim Öffnen des Projekts und zeigt in der Fußzeile, ob er läuft.

## Hinterlegen

1. Wähle in der Fußzeile **Dienst hinterlegen**.
2. Nenne Namen, Adresse und den Startbefehl. Der Befehl läuft im Projektverzeichnis. Lass ihn leer, wenn der Dienst anderswo gestartet wird; das Deck prüft dann nur, ob er erreichbar ist.
3. Beim ersten Start zeigt das Deck den Befehl und fragt nach deiner Bestätigung. Danach startet es ihn von selbst, solange er unverändert bleibt. Ändert jemand den Befehl, fragt das Deck neu.

## Gemeinsame Dienste

Ein Projekt kann einen Dienst allen Projekten anbieten, zum Beispiel ein Werkzeug, das Maße aus einem Foto liest. Dazu setzt du beim Hinterlegen den Haken und beschreibst in einem Satz, wozu der Dienst taugt.

- Ein gemeinsamer Dienst braucht deine Bestätigung. Solange sie fehlt, steht er im [Eingang](05-eingang.md).
- Danach nennt das Briefing jeder neuen Session den Dienst, in jedem Projekt, mit Zweck und Adresse.
- Die Bestätigung gilt für genau die gezeigte Fassung. Ändern sich Name, Adresse, Zweck oder Befehl, fragt das Deck neu.

Eine Session sieht die Dienste mit `coop dienst liste` und startet einen mit `coop dienst starte <name>`.
