# The coop command

A session operates the deck with `coop`. The command is on the path in every session of the deck; the briefing explains it. You rarely need it yourself, but it helps to know what a session can do with it. `coop hilfe` shows the same list in the terminal.

```
{{befehle}}
```

## The most important ones day to day

| Command | What happens on your side |
|---|---|
| `coop zeigen` | A tab opens on the right and jumps to the place named. |
| `coop hinweis` | A band appears above the view; the note is in the inbox. |
| `coop frage` | A question with options is in the inbox. With `--warten` the session waits for your answer. |
| `coop bild` | The session sees a view as a picture before showing it to you. |
| `coop melden` | A message via Telegram or as a notification on the machine. |
| `coop anfordern` | A request for photos or audio on the phone. |
| `coop roadmap` | The roadmap is read and updated. |
| `coop sitzung thema` | The tab of the session gets a name. |
| `coop uebergabe` | State and open points are recorded for the next session. |

## The same words in both languages

Commands, field names and status values are the same in the German and the English interface (`coop zeigen`, `in-arbeit`). That way a project can be opened in both languages.

## MCP

The same functions exist as an MCP server (`coop mcp`). The deck hands it to Claude Code, Codex and opencode at start without touching their configuration.
