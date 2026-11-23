/**
 * Zustandsmeldungen der CLIs (SE-02, CP-05): jede CLI sagt dem Deck selbst, ob sie arbeitet,
 * fertig ist oder eine Freigabe braucht. Der Weg ist je CLI ein anderer, das Ziel
 * dasselbe: `coop _ereignis <was>`.
 *
 * - Claude Code: Hooks in einer Settings-Datei je Session.
 * - Codex: Hooks als `-c`-Überschreibung je Start. Codex führt Hooks erst nach einer
 *   Vertrauensprüfung aus; das Deck bürgt je Start für genau seine eigenen Hooks.
 * - opencode: ein Plugin im Laufordner, das den Ereignisstrom des Servers liest.
 * - pi: eine Erweiterung im Laufordner.
 *
 * Nichts davon schreibt in die Konfiguration der CLIs. Bleibt eine Meldung aus,
 * schätzt das Deck den Zustand weiter aus der Ausgabe.
 */
import path from 'path'
import { spawn } from 'child_process'
import { HOME, ensureDir, enhancedPath, writeFileAtomic, writeJson } from './basis'

/** Was eine CLI melden kann. `wartet` ist die mehrdeutige Meldung von Claude Code, `freigabe` die eindeutige. */
export type Ereignis = 'arbeitet' | 'ruhig' | 'wartet' | 'freigabe' | 'unterbrochen'

const befehl = (coop: string, was: Ereignis) => `"${coop}" _ereignis ${was}`

// --- Claude Code ----------------------------------------------------------

export function claudeSettings(coop: string): object {
  const hook = (was: Ereignis) => [{ hooks: [{ type: 'command', command: befehl(coop, was) }] }]
  return { hooks: { UserPromptSubmit: hook('arbeitet'), Stop: hook('ruhig'), Notification: hook('wartet') } }
}

// --- Codex ----------------------------------------------------------------

/** TOML-Zeichenkette; die Schreibweise von JSON ist für Pfade und Befehle dieselbe. */
const toml = (v: string) => JSON.stringify(v)

const CODEX_HOOKS: [string, Ereignis][] = [
  ['UserPromptSubmit', 'arbeitet'],
  ['Stop', 'ruhig'],
  ['PermissionRequest', 'freigabe'],
  ['Interrupt', 'unterbrochen'],
]

/** Die Hooks als Überschreibung je Start (gemessen an Codex 0.162.1). */
export function codexHookArgs(coop: string): string[] {
  return CODEX_HOOKS.flatMap(([name, was]) => ['-c', `hooks.${name}=[{hooks=[{type="command",command=${toml(befehl(coop, was))},timeout=10}]}]`])
}

interface CodexHook { key: string; command?: string; source?: string; currentHash?: string }

const vertrauenMerker = new Map<string, string[]>()

/**
 * Codex zeigt für neue Hooks einen Prüfdialog und führt sie sonst nicht aus. Das Deck
 * fragt Codex nach den Prüfsummen seiner eigenen Hooks und gibt genau diese als vertraut
 * mit: je Start, ohne `~/.codex` zu lesen oder zu beschreiben, und ohne den Schalter,
 * der die Prüfung für alle Hooks abschaltet. Gelingt die Abfrage nicht, bleibt die Liste
 * leer und Codex fragt selbst.
 */
export async function codexVertrauen(coop: string, bin = 'codex'): Promise<string[]> {
  const hooks = codexHookArgs(coop)
  const schluessel = `${bin}\n${hooks.join('\n')}`
  const bekannt = vertrauenMerker.get(schluessel)
  if (bekannt) return bekannt
  // Eigener, leerer Konfigurationsordner: die Abfrage sieht nur die mitgegebenen Hooks.
  const probe = path.join(HOME, 'codex-probe')
  ensureDir(probe)
  const liste = await new Promise<CodexHook[]>((fertig) => {
    let erledigt = false
    const ende = (v: CodexHook[]) => {
      if (erledigt) return
      erledigt = true
      clearTimeout(frist)
      try { kind.kill() } catch { /* schon weg */ }
      fertig(v)
    }
    const kind = spawn(bin, ['app-server', ...hooks], { env: { ...process.env, PATH: enhancedPath(), CODEX_HOME: probe }, stdio: ['pipe', 'pipe', 'ignore'] })
    const frist = setTimeout(() => ende([]), 8000)
    kind.on('error', () => ende([]))
    kind.on('exit', () => ende([]))
    kind.stdin.on('error', () => ende([]))
    let puffer = ''
    kind.stdout.on('data', (d: Buffer) => {
      puffer += d.toString('utf-8')
      let nl: number
      while ((nl = puffer.indexOf('\n')) >= 0) {
        const zeile = puffer.slice(0, nl)
        puffer = puffer.slice(nl + 1)
        try {
          const m = JSON.parse(zeile) as { id?: number; result?: { data?: { hooks?: CodexHook[] }[] }; error?: unknown }
          if (m.id === 2) ende(m.error ? [] : (m.result?.data ?? []).flatMap((x) => x.hooks ?? []))
        } catch { /* keine JSON-Zeile */ }
      }
    })
    const sende = (m: object) => kind.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
    sende({ id: 1, method: 'initialize', params: { clientInfo: { name: 'coop-deck', version: '1' }, capabilities: { experimentalApi: true } } })
    sende({ method: 'initialized' })
    sende({ id: 2, method: 'hooks/list', params: { cwds: [probe] } })
  })
  const args = codexVertrauenArgs(coop, liste)
  if (args.length) vertrauenMerker.set(schluessel, args)
  return args
}

/** Aus Codex’ Liste nur die Hooks des Decks: alles andere bleibt in Codex’ eigener Prüfung. */
export function codexVertrauenArgs(coop: string, liste: CodexHook[]): string[] {
  const eigene = new Set(CODEX_HOOKS.map(([, was]) => befehl(coop, was)))
  const vertraut = liste.filter((h) => h.source === 'sessionFlags' && h.command && eigene.has(h.command) && /^sha256:[0-9a-f]+$/.test(h.currentHash ?? ''))
  if (vertraut.length !== CODEX_HOOKS.length) return []
  return ['-c', `hooks.state={${vertraut.map((h) => `${toml(h.key)}={trusted_hash=${toml(h.currentHash!)}}`).join(',')}}`]
}

// --- opencode und pi ------------------------------------------------------

/** Gemeinsamer Kopf: Meldungen nacheinander abschicken, damit sie in ihrer Reihenfolge ankommen. */
function meldeKopf(coop: string, env: Record<string, string>): string {
  return `import { execFile } from 'node:child_process'

const COOP = ${JSON.stringify(coop)}
const ENV = ${JSON.stringify(env)}
let kette = Promise.resolve()
function melde(was) {
  kette = kette.then(() => new Promise((weiter) => {
    try {
      execFile(COOP, ['_ereignis', was], { env: { ...process.env, ...ENV }, timeout: 10000 }, () => weiter())
    } catch {
      weiter()
    }
  }))
}
`
}

/**
 * Plugin für opencode 2 (gemessen an 2.0.29). Unteraufgaben laufen als eigene Sessions
 * auf demselben Server: „ruhig“ gilt erst, wenn keine mehr läuft.
 */
export function opencodePlugin(ordner: string, coop: string, env: Record<string, string>): string {
  ensureDir(ordner)
  writeJson(path.join(ordner, 'package.json'), { name: 'coop-deck-melder', version: '1.0.0', private: true, type: 'module', main: 'index.js' })
  writeFileAtomic(path.join(ordner, 'index.js'), `// Vom Coop Deck für diese Session angelegt: meldet dem Deck, ob opencode arbeitet oder wartet.
${meldeKopf(coop, env)}
export default {
  id: 'coop.deck.melder',
  setup(ctx) {
    const laufend = new Set()
    const offen = new Set()
    let zu = false
    const weiter = () => { if (!offen.size && laufend.size) melde('arbeitet') }
    ;(async () => {
      try {
        for await (const e of ctx.event.subscribe()) {
          if (zu) break
          const d = e.data ?? {}
          switch (e.type) {
            case 'session.execution.started': laufend.add(d.sessionID); melde('arbeitet'); break
            case 'session.execution.succeeded':
            case 'session.execution.failed': laufend.delete(d.sessionID); if (!laufend.size) { offen.clear(); melde('ruhig') } break
            case 'session.execution.interrupted': laufend.delete(d.sessionID); if (!laufend.size) { offen.clear(); melde('unterbrochen') } break
            case 'permission.asked': offen.add(d.id); melde('freigabe'); break
            case 'permission.replied': offen.delete(d.requestID); weiter(); break
            case 'form.created': offen.add(d.form?.id); melde('freigabe'); break
            case 'form.replied':
            case 'form.cancelled': offen.delete(d.id); weiter(); break
          }
        }
      } catch {
        // Ohne Ereignisstrom schätzt das Deck den Zustand aus der Ausgabe.
      }
    })()
    return () => { zu = true }
  },
}
`)
  return ordner
}

/** Erweiterung für pi (gemessen an 0.73.1). pi fragt nicht um Freigabe: es gibt nur „arbeitet“ und „ruhig“. */
export function piErweiterung(datei: string, coop: string, env: Record<string, string>): string {
  writeFileAtomic(datei, `// Vom Coop Deck für diese Session angelegt: meldet dem Deck, ob pi arbeitet.
${meldeKopf(coop, env)}
export default function (pi) {
  pi.on('agent_start', async () => { melde('arbeitet') })
  pi.on('agent_end', async (event) => {
    const letzte = event?.messages?.at?.(-1)
    melde(letzte?.stopReason === 'aborted' ? 'unterbrochen' : 'ruhig')
  })
}
`)
  return datei
}
