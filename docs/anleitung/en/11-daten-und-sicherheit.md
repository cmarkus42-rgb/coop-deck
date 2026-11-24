<!-- Generated from anleitung/en/ with `npm run anleitung`. Edit there, not here. -->

# Data and security

## Where things live

| Place | Content |
|---|---|
| `<project>/.coop/` | Artifacts, feedback, notes, questions and deliveries of the project. Readable files, versionable with git. |
| `~/Library/Application Support/coop-deck/` (Linux: `~/.local/share/coop-deck/`) | Runtime state: registers of projects and sessions, briefings, settings, the `coop` command. |

The deck copies no projects and does not write to `CLAUDE.md` or `AGENTS.md`. It does not keep the output of sessions.

## What leaves the machine

Nothing by itself. Artifacts load nothing from the network. You set up the exceptions yourself:

- **Telegram**: what a session reports goes to Telegram.
- **Phone and tablet**: the access listens on this machine only; only your forwarder takes it outside.
- The CLIs talk to their providers as they always do.

## Content from a project counts as foreign

An opened repository can contain HTML you did not write. That is why there are trust levels:

- The views of the types belong to the deck and may use its interface.
- Free artifacts, project files and the HTML of variants run sandboxed and cannot reach the interface.
- Nothing a page sends is typed verbatim into a session. Pages only name what should happen; the deck composes the text itself.
- The access for the phone is a separate, narrower level with its own key.

## Sessions without confirmation prompts

By default sessions run commands without asking. That is convenient and means: what the session reads can move it to act. Open foreign repositories with prompts until you trust them (see [Sessions](02-sessions.md)).

## Start commands of services

A project can register a start command. The deck runs it only after you have confirmed exactly that version (see [Services](09-dienste.md)).
