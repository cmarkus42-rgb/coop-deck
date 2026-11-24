# Diktat und Vorlesen

Beides läuft lokal: Kein Ton verlässt den Rechner.

## Diktat

Voraussetzung sind `whisper-cli` und `ffmpeg` im Suchpfad und ein Whisper-Modell (eine Datei `ggml-….bin`). Den Pfad zum Modell trägst du unter **{{ui.einstellungen}}**, Abschnitt **{{ui.einst.voice}}**, ein.

- **{{ui.diktat}}** in der Kopfzeile oder ⌘⇧D startet und beendet die Aufnahme.
- Der Text geht in das Textfeld, in dem der Cursor steht, sonst in die aktive Session. Der Knopf nennt das Ziel.
- Beginnt der Satz mit „Deck, …“, ist er ein Befehl an das Deck, etwa um ein Projekt zu öffnen.
- Beim ersten Mal fragt das System nach der Freigabe für das Mikrofon.

## Vorlesen

Unter **{{ui.einst.voice}}** schaltest du das Vorlesen ein. Vorgelesen werden Hinweise und Fragen der Session, die du gerade vor dir hast, und alles, was eine Session mit `coop melden` meldet.

- Ohne weitere Angabe spricht die Stimme des Systems (`say` unter macOS, `espeak-ng` unter Linux).
- Für eine Piper-Stimme trägst du den Pfad einer `.onnx`-Datei ein. Liegt neben dem Modell eine Aussprachetabelle, wird sie benutzt.
- Die Lautstärke stellst du mit dem Regler ein. **{{ui.einst.sprechProbe}}** spielt einen Satz zur Probe.

## Fernbedienung

Eine Bluetooth-Fernbedienung kann Diktat, Senden und das Blättern durch Sessions und Reiter auslösen. Dafür trägst du unter **{{ui.einst.voice}}** ein Programm ein, das die Tasten meldet, und belegst die Tasten.
