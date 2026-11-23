# Changelog

## Unreleased

- Volume for reading aloud.
- Questions leave the inbox when they are settled in the conversation, withdrawn by the session or cleared by hand.
- Shared services: a project offers a local service to all projects; after confirmation every briefing names it. `coop dienst liste | starte`.

## 0.0.1

First public version.

- Project spaces that point at existing directories; nothing is copied.
- Sessions with Claude Code, Codex, opencode and pi in tmux, with a briefing per session; the state of a session (working, finished, needs approval) is reported by the CLI itself.
- Artifacts as files under `.coop/`: roadmap, project sheet, questionnaire, variant choice, review, handover, document, web preview, free HTML; local services per project.
- Feedback with marks, sent to a session as readable text; history per artifact with before and after.
- Back channel for agents: the `coop` command and an MCP server with the same functions.
- Inbox across projects; search and command palette.
- Changes made in the roadmap view reach the session at the push of a button.
- Photos and spoken notes from the phone: `coop anfordern`, a page for the phone served by the deck, audio transcribed locally.
- The inbox on the phone: sessions that are done or waiting, questions answered by picking an option, notes.
- Reading aloud with a Piper voice, with a pronunciation table next to the model; reported results are spoken too.
- `coop melden`: a session reports a result via a Telegram bot, or as a notification.
- Project list: projects with running sessions and favorites always in view, the rest in a list that folds away; single projects can be hidden.
- New project from a template; import of a finished HTML page as a free artifact.
- Dictation with local speech recognition, voice commands, speech output, Bluetooth remote.
- Project content is served sandboxed and cannot reach the interface of the deck.
- Linux: runtime state follows XDG, the command key is Ctrl+Shift, the shell is the user's own, speech output uses `espeak-ng`; CI runs the core tests on Ubuntu. Not yet tried by hand on a Linux desktop.
