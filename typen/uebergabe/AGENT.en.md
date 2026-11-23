The handover records at the end of a session where the work stands. The latest one appears in the briefing of every new session of the project. Write it with the command, not by hand:

```
coop uebergabe "<state: what is done and checked>" --offen "<one open point>" --offen "…" --naechster "<the next step>"
```

- The state names what is verified and what is not. What is built but not checked goes under “offen” (open).
- The next step is a sentence a session without prior knowledge can start from.
- The entries are in `daten.json` under `eintraege` (entries), newest first; older ones are kept.
- Reference for `--ref`: `uebergabe:U-1`.
