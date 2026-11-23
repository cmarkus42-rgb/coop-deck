Die Übergabe hält am Ende einer Session fest, wo die Arbeit steht. Die neueste steht im Briefing jeder neuen Session des Projekts. Schreibe sie mit dem Befehl, nicht von Hand:

```
coop uebergabe "<Stand: was getan und geprüft ist>" --offen "<ein offener Punkt>" --offen "…" --naechster "<der nächste Schritt>"
```

- Der Stand nennt, was belegt ist und was nicht. Was nur gebaut, aber nicht geprüft ist, steht unter „offen“.
- Der nächste Schritt ist ein Satz, mit dem eine Session ohne Vorwissen anfangen kann.
- Die Einträge liegen in `daten.json` unter `eintraege`, der neueste zuerst; ältere bleiben stehen.
- Bezug für `--ref`: `uebergabe:U-1`.
