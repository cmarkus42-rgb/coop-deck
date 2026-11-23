/** `coop` — Kommandozeile einer Session zum Deck. Dünn: der Kern entscheidet. */
import fs from 'fs'
import path from 'path'
import { VERBINDUNG, readJson } from '../core/basis'
import { antwortAlsText, type Frage } from '../core/protokoll'
import { mcpLaufen } from './mcp'
import { t, setzeSprache } from '../texte'
import { sprachVorgabe } from '../core/basis'

function projektPfad(): string {
  if (process.env.COOP_PROJEKT) return process.env.COOP_PROJEKT
  let dir = process.cwd()
  for (;;) {
    if (fs.existsSync(path.join(dir, '.coop'))) return dir
    const hoch = path.dirname(dir)
    if (hoch === dir) return process.cwd()
    dir = hoch
  }
}

/** Ein Befehl an den Kern. Für den MCP-Server wird die Verbindung je Aufruf neu gelesen: das Deck darf zwischendurch neu starten. */
async function anKern(argv: string[]): Promise<{ code: number; aus: string; warteAuf?: string }> {
  const v = readJson<{ port: number; token: string } | null>(VERBINDUNG, null)
  if (!v) return { code: 2, aus: t('cli.laeuftNicht') }
  try {
    const res = await fetch(`http://127.0.0.1:${v.port}/api/cli`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-coop-token': v.token },
      body: JSON.stringify({ argv, projektPfad: projektPfad(), sitzung: process.env.COOP_SITZUNG }),
    })
    return (await res.json()) as { code: number; aus: string }
  } catch {
    return { code: 2, aus: t('cli.antwortetNicht') }
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  // Dieselbe Sprache wie das Deck: es schreibt sie in die Verbindungsdatei.
  setzeSprache(readJson<{ sprache?: string } | null>(VERBINDUNG, null)?.sprache ?? sprachVorgabe())
  if (argv[0] === 'mcp') {
    await mcpLaufen(anKern)
    return 0
  }
  const v = readJson<{ port: number; token: string } | null>(VERBINDUNG, null)
  if (!v) {
    console.error(t('cli.laeuftNichtDatei'))
    return 2
  }
  let antwort: { code: number; aus: string; warteAuf?: string }
  try {
    const res = await fetch(`http://127.0.0.1:${v.port}/api/cli`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-coop-token': v.token },
      body: JSON.stringify({ argv, projektPfad: projektPfad(), sitzung: process.env.COOP_SITZUNG }),
    })
    antwort = (await res.json()) as typeof antwort
  } catch {
    // Hooks dürfen eine Session nie aufhalten, auch wenn das Deck gerade nicht antwortet.
    if (argv[0] === '_ereignis') return 0
    // Codex sperrt in seiner Sandbox auch das Netz zum eigenen Rechner (gemessen an 0.162.1).
    // Der MCP-Server des Decks läuft außerhalb davon und erreicht es.
    if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1') {
      console.error(t('cli.codexSandbox'))
      return 2
    }
    console.error(t('cli.antwortetNicht'))
    return 2
  }
  if (antwort.aus) (antwort.code ? console.error : console.log)(antwort.aus)
  if (antwort.code === 0 && antwort.warteAuf) {
    // Warten ohne Polling des Agenten: der Befehl selbst blockiert, bis die Datei eine Antwort trägt.
    for (;;) {
      const f = readJson<(Frage & { ausgabe?: string }) | null>(antwort.warteAuf, null)
      if (f?.antwort) {
        // Eine Anfrage (Fotos, Ton vom Handy) bringt ihren Text mit; der Kern erfährt, dass er angekommen ist.
        if (typeof f.ausgabe === 'string') {
          console.log(f.ausgabe)
          await anKern(['anfrage', '_abgeholt', f.id])
        } else console.log(antwortAlsText(f))
        break
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return antwort.code
}

main().then((code) => process.exit(code))
