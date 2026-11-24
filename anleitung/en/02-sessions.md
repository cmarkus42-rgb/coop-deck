# Sessions

A session is a CLI running in the project directory. It keeps running in tmux when you close the window and is back at the next start.

## Starting

- The **+** in the tab bar on the left opens the menu: one of the CLIs, **{{ui.menue.mitTitel}}** or **{{ui.terminalOhneCli}}**.
- **{{ui.menue.mitTitel}}** asks for a title, a purpose and a first task. The purpose appears in the briefing and on the tab. **{{ui.sd.briefing}}** shows beforehand what the session will read.
- From a roadmap item or a finding, a session starts directly with that task (see [Artifacts](03-artefakte.md)).
- In the footer you set which CLI new sessions in the project use and whether a session starts when the project opens.

## Without confirmation prompts

By default sessions start so that the CLI runs commands and makes changes without asking for approval. Such tabs carry the mark “{{ui.sitzung.frei}}”. You can turn this off under **{{ui.einstellungen}}** for all sessions, or in the dialog of a new session for that one start.

## The state

The light on the tab shows whether the session is working, done or waiting for you. When it is done or needs an approval, it appears in the [inbox](05-eingang.md).

## Naming tabs

- The session names its own tab after what you are working on right now (`coop sitzung thema`).
- A double-click on the tab renames it by hand. Your name stays; the session does not overwrite it.
- If you clear the field, the session may set the name again.

## Tasks and the queue

What you send from the deck to a session (feedback, an answer) is typed when the session accepts input. While it is working, it waits in the queue; the number is shown on the tab. In the footer you can send the queue at once.

## Ending and resuming

The **×** on the tab ends the session after a confirmation. It stays in the register: via the **+** you find it under “{{ui.menue.abgelegt}}” and resume it. With Claude Code it is exactly that session; the other CLIs pick up their last session in this directory. A terminal cannot be resumed.

## What the session knows about the deck

The briefing names the project sheet, the artifacts, the last handover and the `coop` command. The list of all commands is in [The coop command](10-befehl-coop.md). The deck does not write to `CLAUDE.md` or `AGENTS.md` of your project for this.
