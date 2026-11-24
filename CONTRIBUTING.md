# Contributing

Thanks for looking. A few things that save time.

## Before you start

- Open an issue for anything larger than a fix, and say what you want to be able to do, not only what should change.
- The interface is German and English; every text lives in `src/texte/` in both languages, and the type check fails if a key is missing in one of them. Identifiers and comments in the source are German. Please keep it that way inside existing files; issues and pull requests are welcome in English or German.

## Working on the code

```bash
npm install
npm run typecheck
npm test          # needs tmux; starts real sessions on its own tmux server
npm start
```

- The core (`src/core/`) runs without Electron and carries the tests. New behaviour belongs there first, with a test, and the interface on top.
- No native modules. The terminal goes through tmux control mode.
- Artifacts and views load nothing from the network. Fonts and libraries are bundled.
- Content from a project is foreign: it is served sandboxed and never typed verbatim into a session. See `SECURITY.md` before touching the server, the actions of pages or anything that delivers text to a session.
- Nothing personal and nothing machine-specific in the source: no names, no absolute paths, no host names. Where a program lives is a setting.
- The guide (`anleitung/de/`, `anleitung/en/`) changes with the behaviour, in the same pull request. Write the names of buttons as placeholders (`{{ui.eingang}}`) so they cannot drift, then run `npm run anleitung` to refresh `docs/anleitung/`. A test checks both.
- A comment says what the code cannot say: why, or what it guards against.

## A new artifact type

See "Adding an artifact type" in the README. A type needs a short `AGENT.md`: agents read it in the briefing, so write it for them.

## Pull requests

One topic per pull request. Describe what you checked and what you could not check.
