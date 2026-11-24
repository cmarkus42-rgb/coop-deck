<!-- Generated from anleitung/en/ with `npm run anleitung`. Edit there, not here. -->

# First steps

Coop Deck is a workspace for working with coding CLIs. On the left the session runs in a terminal; on the right is what you are talking about: the roadmap, the project sheet, a document or the running page. In between there is a channel in both directions: the session shows you something and asks, you mark and answer.

## Open a project

A project is a directory on your machine. The deck opens it in place and copies nothing.

1. Click **Add directory** at the bottom left and choose the folder. The dialog shows hidden folders too.
2. Or list the folders that contain your projects under **Settings**. The deck looks there for directories with code or an instruction file.
3. For something new, **New project** creates a folder from a template, with a project sheet and a roadmap.

The project gets a folder `.coop/`. Everything the deck keeps about the project lives there as readable files.

## The first session

1. Choose the project in the bar on the left.
2. Start a session with one of the CLIs. The deck finds Claude Code, Codex, opencode and pi if they are on your path.
3. At start the session receives a briefing: the project sheet, the artifacts of the project and the `coop` command it uses to operate the deck.

More in [Sessions](02-sessions.md).

## The layout of the window

| Area | What is there |
|---|---|
| Header | View (**Session**, **Both**, **Artifact**), **Inbox**, theme, **Dictation**, **Search**, **Guide**, **Settings** |
| Bar on the left | Projects: those with running sessions on top, then **Favorites**, below them all projects, collapsible |
| Left pane | Sessions of the project, one tab each |
| Right pane | Artifacts and pages, one per tab |
| Footer | Path of the project, services, what starts on opening, the CLI for new sessions |

## Getting anywhere quickly

**Search** (⌘K) opens the command palette. It finds projects, sessions, artifacts, roadmap items and feedback across all projects and runs commands. Switch the view with ⌘⌥1, ⌘⌥2 and ⌘⌥3. Outside macOS, Ctrl+Shift stands for ⌘ and Ctrl+Alt for ⌘⌥.

## Organising the project bar

- The star marks a project as a favourite.
- The button next to the star hides a project from the list; under “Hidden” you bring it back.
- Collapse the list of all projects at its heading. Projects with running sessions and favourites stay visible.
