# Dictation and reading aloud

Both run locally: no audio leaves the machine.

## Dictation

It needs `whisper-cli` and `ffmpeg` on your path and a Whisper model (a file `ggml-….bin`). Enter the path to the model under **{{ui.einstellungen}}**, section **{{ui.einst.voice}}**.

- **{{ui.diktat}}** in the header or ⌘⇧D starts and ends the recording.
- The text goes into the text field the cursor is in, otherwise into the active session. The button names the target.
- If the sentence begins with “Deck, …”, it is a command to the deck, for example to open a project.
- The first time, the system asks for permission to use the microphone.

## Reading aloud

Under **{{ui.einst.voice}}** you turn reading aloud on. Read aloud are notes and questions of the session you have in front of you, and everything a session reports with `coop melden`.

- Without further settings the voice of the system speaks (`say` on macOS, `espeak-ng` on Linux).
- For a Piper voice, enter the path of an `.onnx` file. If a pronunciation table lies next to the model, it is used.
- Set the volume with the slider. **{{ui.einst.sprechProbe}}** plays a sentence as a test.

## Remote control

A Bluetooth remote can trigger dictation, sending and paging through sessions and tabs. For this you enter a program that reports the keys under **{{ui.einst.voice}}** and assign the keys.
