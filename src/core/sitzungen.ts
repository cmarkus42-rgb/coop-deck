/** Sessions: Register, tmux-Anbindung, Zustand, Zustellschlange. */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { EventEmitter } from 'events'
import { kurz, Ablage, HOME, RUNS, BIN, ensureDir, writeJson, writeFileAtomic, enhancedPath, id } from './basis'
import { TmuxClient, createSession, killSession, listSessions, restoreSequence } from './tmux/manager'
import type { CliId, Projekt } from './projekte'
import { claudeSettings, codexHookArgs, codexVertrauen, opencodePlugin, piErweiterung } from './melder'
import { anmeldeShell, findeProgramm } from './plattform'
import { t, sprache } from '../texte'

export type Zustand = 'arbeitet' | 'ruhig' | 'wartet' | 'beendet'

export interface Sitzung {
  id: string
  projektId: string
  art: 'cli' | 'terminal'
  cli: CliId | null
  titel: string
  /** Von Hand benannt: die Session ändert den Namen des Reiters dann nicht mehr. */
  titelFest?: boolean
  zweck?: string
  /** Verknüpfter Roadmap-Punkt (SE-06, RM-04). */
  roadmap?: { artefakt: string; punkt: string }
  /** Weitere Punkte, an denen die Session gearbeitet hat, als `<artefakt>/<punkt>` (AF-09). */
  punkte?: string[]
  tmux: string
  cliSessionId?: string
  erstellt: number
  aktiv: number
  zustand: Zustand
  /** Etwas wartet auf den Menschen am Deck: die Session ist fertig oder braucht Eingabe (CP-05). */
  achtung?: 'fertig' | 'wartet'
  ergebnis?: string
  /** Ohne Rückfragen gestartet: die CLI führt Werkzeuge aus, ohne um Freigabe zu bitten. */
  frei?: boolean
}

interface Laufzeit {
  client: TmuxClient | null
  seq: number
  letzteAusgabe: number
  letzteEingabe: number
  gestartet: number
  hookArbeitet: boolean
  hookBekannt: boolean
  arbeitetSeit: number
  schlange: { text: string; kennung?: string }[]
  stelltZu: boolean
}

// --- Adapter --------------------------------------------------------------

export interface StartAngaben {
  briefing: string
  auftrag?: string
  cliSessionId: string
  settings: string
  titel: string
  fortsetzen: boolean
  /** Ohne Rückfragen starten (Einstellung, wie im Mux). */
  frei: boolean
  /** MCP-Server des Decks: Befehl, Umgebung und die vorbereiteten Konfigurationsdateien. */
  mcp: { befehl: string; env: Record<string, string>; claudeDatei: string }
  /** Zustandsmeldungen (SE-02): was die CLI beim Start mitbekommt, um sich beim Deck zu melden. */
  melder: { codex: string[]; pi: string }
}

export interface Adapter {
  id: CliId
  name: string
  bin: string
  /** Wie genau „Fortsetzen“ trifft: die Session selbst oder nur die letzte im Verzeichnis. */
  fortsetzenGenau: boolean
  /** Wie die CLI ihren Zustand meldet (siehe `melder.ts`). Bleibt die Meldung aus, wird er aus der Ausgabe geschätzt. */
  meldet: 'hooks' | 'plugin' | 'erweiterung'
  argv(a: StartAngaben): string[]
  /** Zusätzliche Umgebung für den Start (opencode liest seine MCP-Konfiguration darüber). */
  env?(a: StartAngaben & { opencodeDatei: string }): Record<string, string>
}

const lies = (a: StartAngaben) => t('auftrag.liesBriefing', { briefing: a.briefing })

export const ADAPTER: Record<CliId, Adapter> = {
  claude: {
    id: 'claude', name: 'Claude Code', bin: 'claude', fortsetzenGenau: true, meldet: 'hooks',
    argv: (a) => {
      const frei = a.frei ? ['--dangerously-skip-permissions'] : []
      return a.fortsetzen
        ? ['claude', ...frei, '--resume', a.cliSessionId, '--append-system-prompt-file', a.briefing, '--settings', a.settings, '--mcp-config', a.mcp.claudeDatei]
        : ['claude', ...frei, '--session-id', a.cliSessionId, '--append-system-prompt-file', a.briefing, '--settings', a.settings, '--mcp-config', a.mcp.claudeDatei, '-n', a.titel, ...(a.auftrag ? [a.auftrag] : [])]
    },
  },
  codex: {
    id: 'codex', name: 'Codex', bin: 'codex', fortsetzenGenau: false, meldet: 'hooks',
    argv: (a) => {
      const frei = a.frei ? ['--dangerously-bypass-approvals-and-sandbox'] : []
      // Ohne Schreiben in ~/.codex/config.toml: der Server reist als Überschreibung je Start mit (Werte sind TOML).
      const toml = (v: string) => JSON.stringify(v)
      frei.push('-c', `mcp_servers.coop.command=${toml(a.mcp.befehl)}`, '-c', 'mcp_servers.coop.args=["mcp"]',
        '-c', `mcp_servers.coop.env={${Object.entries(a.mcp.env).map(([k, v]) => `${k}=${toml(v)}`).join(',')}}`,
        ...a.melder.codex)
      return a.fortsetzen ? ['codex', ...frei, 'resume', '--last'] : ['codex', ...frei, [lies(a), a.auftrag].filter(Boolean).join('\n\n')]
    },
  },
  opencode: {
    id: 'opencode', name: 'opencode', bin: 'opencode', fortsetzenGenau: false, meldet: 'plugin',
    env: (a) => ({ OPENCODE_CONFIG: a.opencodeDatei }),
    // `--auto` erlaubt, was nicht ausdrücklich verboten ist: das Gegenstück bei opencode.
    // `--standalone`: gemessen an 2.0.29 liest nur der eigene Server OPENCODE_CONFIG aus der
    // Umgebung der Session; der Hintergrunddienst kennt sie nicht, und der MCP-Server fehlte.
    argv: (a) => {
      const frei = ['--standalone', ...(a.frei ? ['--auto'] : [])]
      return a.fortsetzen ? ['opencode', ...frei, '--continue'] : ['opencode', ...frei, '--prompt', [lies(a), a.auftrag].filter(Boolean).join('\n\n')]
    },
  },
  pi: {
    // pi fragt von sich aus nicht nach: der Schalter hat hier keine Entsprechung.
    id: 'pi', name: 'pi', bin: 'pi', fortsetzenGenau: false, meldet: 'erweiterung',
    argv: (a) => a.fortsetzen
      ? ['pi', '-e', a.melder.pi, '--continue', '--append-system-prompt', a.briefing]
      : ['pi', '-e', a.melder.pi, '--append-system-prompt', a.briefing, ...(a.auftrag ? [a.auftrag] : [])],
  },
}

export function verfuegbareClis(): CliId[] {
  const pfad = enhancedPath()
  return (Object.keys(ADAPTER) as CliId[]).filter((c) => !!findeProgramm(ADAPTER[c].bin, pfad))
}

// --- Verwaltung -----------------------------------------------------------

export interface StartOpts {
  projekt: Projekt
  art?: 'cli' | 'terminal'
  cli?: CliId
  titel?: string
  zweck?: string
  roadmap?: Sitzung['roadmap']
  auftrag?: string
  ohneRueckfragen?: boolean
  /** Inhalt der Briefing-Datei; wird im Laufordner abgelegt (SE-08). */
  briefing: (s: Sitzung) => string
}

export interface SitzungenEvents {
  ausgabe: (sid: string, data: string, seq: number) => void
  geaendert: (s: Sitzung) => void
  schlange: (sid: string, laenge: number) => void
  zugestellt: (sid: string, kennung: string) => void
}

const RUHE_MS = 1800
const ECHO_MS = 400

export class Sitzungen extends EventEmitter {
  private reg: Ablage<{ sitzungen: Record<string, Sitzung> }>
  private lauf = new Map<string, Laufzeit>()
  private takt: ReturnType<typeof setInterval> | null = null

  constructor() {
    super()
    this.reg = new Ablage(path.join(HOME, 'sitzungen.json'), 1, () => ({ sitzungen: {} as Record<string, Sitzung> }))
  }

  get fehler(): string | null {
    return this.reg.fehler
  }

  /** Nach dem Start: laufende tmux-Sessions wieder anbinden, verschwundene als beendet führen. */
  async aufnehmen(): Promise<void> {
    const leben = new Set(await listSessions())
    for (const s of Object.values(this.reg.get().sitzungen)) {
      // Jeder Eintrag einzeln und defensiv: ein defekter darf die anderen nicht mitreißen (NF-04).
      try {
        // Was in tmux noch läuft, ist nicht beendet, auch wenn das Register es so führt
        // (etwa nach einer verlorenen Anbindung). Die ursprüngliche Session geht einer Kopie vor.
        const name = [`cd-${s.id}`, s.tmux].find((n) => leben.has(n))
        if (name) {
          s.tmux = name
          if (s.zustand === 'beendet') s.zustand = 'ruhig'
          this.anbinden(s)
        } else s.zustand = 'beendet'
      } catch { s.zustand = 'beendet' }
    }
    this.reg.save()
    this.takt ??= setInterval(() => this.tick(), 600)
  }

  schliessen(): void {
    if (this.takt) clearInterval(this.takt)
    this.takt = null
    for (const l of this.lauf.values()) l.client?.close()
    this.lauf.clear()
  }

  liste(projektId?: string): Sitzung[] {
    return Object.values(this.reg.get().sitzungen)
      .filter((s) => !projektId || s.projektId === projektId)
      .sort((a, b) => a.erstellt - b.erstellt)
  }

  get(sid: string): Sitzung | undefined {
    return this.reg.get().sitzungen[sid]
  }

  schlangenlaenge(sid: string): number {
    return this.lauf.get(sid)?.schlange.length ?? 0
  }

  private laufzeit(sid: string): Laufzeit {
    let l = this.lauf.get(sid)
    if (!l) {
      l = { client: null, seq: 0, letzteAusgabe: 0, letzteEingabe: 0, gestartet: Date.now(), hookArbeitet: false, hookBekannt: false, arbeitetSeit: 0, schlange: [], stelltZu: false }
      this.lauf.set(sid, l)
    }
    return l
  }

  private anbinden(s: Sitzung): void {
    const l = this.laufzeit(s.id)
    if (l.client?.alive) return
    l.client = new TmuxClient(s.tmux, {
      output: (data) => {
        const jetzt = Date.now()
        if (jetzt - l.letzteEingabe > ECHO_MS) l.letzteAusgabe = jetzt
        l.seq += 1
        this.emit('ausgabe', s.id, data, l.seq)
      },
      exit: () => {
        l.client = null
        s.zustand = 'beendet'
        s.achtung = undefined
        this.speichern(s)
      },
    })
  }

  private speichern(s: Sitzung): void {
    this.reg.save()
    this.emit('geaendert', s)
  }

  laufOrdner(sid: string): string {
    return path.join(RUNS, sid)
  }

  async starten(o: StartOpts): Promise<Sitzung> {
    const art = o.art ?? 'cli'
    const cli = art === 'cli' ? (o.cli ?? o.projekt.cli) : null
    const sid = id(10)
    const nummer = this.liste(o.projekt.id).length + 1
    const s: Sitzung = {
      id: sid, projektId: o.projekt.id, art, cli,
      titel: o.titel?.trim() || (o.zweck?.trim() ? kurz(o.zweck, 40) : '') || (art === 'terminal' ? t('sitzung.terminal', { n: nummer }) : `${ADAPTER[cli!].name} ${nummer}`),
      zweck: o.zweck, roadmap: o.roadmap, tmux: `cd-${sid}`,
      cliSessionId: crypto.randomUUID(), erstellt: Date.now(), aktiv: Date.now(), zustand: 'arbeitet',
      frei: art === 'cli' ? !!o.ohneRueckfragen : undefined,
    }
    await this.tmuxStarten(s, o.projekt, o.briefing(s), o.auftrag, false)
    this.reg.get().sitzungen[sid] = s
    this.speichern(s)
    return s
  }

  /** Abgelegte Session wieder aufnehmen (SE-05). */
  async fortsetzen(sid: string, projekt: Projekt, briefing: (s: Sitzung) => string): Promise<Sitzung> {
    const s = this.get(sid)
    if (!s) throw new Error(t('fehler.sitzungUnbekannt'))
    if (s.zustand !== 'beendet') return s
    s.tmux = `cd-${sid}-${id(3)}`
    await this.tmuxStarten(s, projekt, briefing(s), undefined, true)
    s.zustand = 'arbeitet'
    s.aktiv = Date.now()
    this.speichern(s)
    return s
  }

  private async tmuxStarten(s: Sitzung, projekt: Projekt, briefing: string, auftrag: string | undefined, fortsetzen: boolean): Promise<void> {
    const ordner = this.laufOrdner(s.id)
    ensureDir(ordner)
    const briefingDatei = path.join(ordner, 'briefing.md')
    writeFileAtomic(briefingDatei, briefing)
    const settings = path.join(ordner, 'claude-settings.json')
    const coop = path.join(BIN, 'coop')
    writeJson(settings, claudeSettings(coop))

    const env: Record<string, string> = {
      PATH: enhancedPath(), TERM: 'xterm-256color', COLORTERM: 'truecolor',
      LANG: process.env.LANG || (sprache() === 'de' ? 'de_DE.UTF-8' : 'en_US.UTF-8'),
      COOP_DECK_HOME: HOME, COOP_PROJEKT: projekt.pfad, COOP_PROJEKT_ID: projekt.id, COOP_SITZUNG: s.id,
    }
    // MCP-Server des Decks: derselbe Befehl `coop`, an Projekt und Session gebunden (AG-04).
    const mcpEnv = { COOP_DECK_HOME: HOME, COOP_PROJEKT: projekt.pfad, COOP_PROJEKT_ID: projekt.id, COOP_SITZUNG: s.id }
    const claudeDatei = path.join(ordner, 'mcp.json')
    writeJson(claudeDatei, { mcpServers: { coop: { command: coop, args: ['mcp'], env: mcpEnv } } })
    const opencodeDatei = path.join(ordner, 'opencode.json')
    // Zustandsmeldungen: nur anlegen, was die gewählte CLI braucht.
    const melder = { codex: [] as string[], pi: path.join(ordner, 'pi-melder.ts') }
    const plugins: string[] = []
    if (s.cli === 'codex') melder.codex = [...codexHookArgs(coop), ...await codexVertrauen(coop)]
    if (s.cli === 'opencode') plugins.push(opencodePlugin(path.join(ordner, 'opencode-melder'), coop, mcpEnv))
    if (s.cli === 'pi') piErweiterung(melder.pi, coop, mcpEnv)
    writeJson(opencodeDatei, { $schema: 'https://opencode.ai/config.json', mcp: { coop: { type: 'local', command: [coop, 'mcp'], environment: mcpEnv, enabled: true } }, plugins })
    const angaben = { briefing: briefingDatei, auftrag, cliSessionId: s.cliSessionId!, settings, titel: s.titel, fortsetzen, frei: !!s.frei, mcp: { befehl: coop, env: mcpEnv, claudeDatei }, melder }
    if (s.art === 'cli') Object.assign(env, ADAPTER[s.cli!].env?.({ ...angaben, opencodeDatei }) ?? {})
    const argv = s.art === 'terminal' ? [anmeldeShell(process.platform, process.env), '-l'] : ADAPTER[s.cli!].argv(angaben)
    await createSession({ name: s.tmux, cwd: projekt.pfad, argv, env })
    const l = this.laufzeit(s.id)
    l.gestartet = Date.now()
    l.letzteAusgabe = Date.now()
    l.hookArbeitet = !!auftrag
    this.anbinden(s)
  }

  /** Für die Oberfläche: Größe setzen und den aktuellen Bildschirm holen. */
  async verbinden(sid: string, cols: number, rows: number): Promise<{ wiederherstellen: string; seq: number } | null> {
    const s = this.get(sid)
    const l = this.lauf.get(sid)
    if (!s || !l?.client?.alive) return null
    await l.client.resize(cols, rows)
    // Kurz warten: das TUI zeichnet nach dem SIGWINCH neu, erst dann stimmt der Schnappschuss.
    await new Promise((r) => setTimeout(r, 120))
    const snap = await l.client.snapshot()
    return { wiederherstellen: restoreSequence(snap), seq: l.seq }
  }

  groesse(sid: string, cols: number, rows: number): void {
    void this.lauf.get(sid)?.client?.resize(cols, rows)
  }

  eingabe(sid: string, data: string): void {
    const l = this.lauf.get(sid)
    if (!l?.client?.alive) return
    l.letzteEingabe = Date.now()
    const s = this.get(sid)
    if (s?.achtung) { s.achtung = undefined; this.speichern(s) }
    void l.client.sendText(data)
  }

  async beenden(sid: string): Promise<void> {
    const s = this.get(sid)
    if (!s) return
    await killSession(s.tmux)
    s.zustand = 'beendet'
    s.achtung = undefined
    this.speichern(s)
  }

  entfernen(sid: string): void {
    const s = this.get(sid)
    if (!s || s.zustand !== 'beendet') return
    delete this.reg.get().sitzungen[sid]
    this.lauf.delete(sid)
    this.reg.save()
    try { fs.rmSync(this.laufOrdner(sid), { recursive: true, force: true }) } catch { /* egal */ }
  }

  aendern(sid: string, patch: Partial<Pick<Sitzung, 'titel' | 'titelFest' | 'zweck' | 'ergebnis' | 'achtung' | 'punkte'>>): void {
    const s = this.get(sid)
    if (!s) return
    Object.assign(s, patch)
    this.speichern(s)
  }

  /** Meldung der CLI über Hook, Plugin oder Erweiterung (siehe `melder.ts`). */
  ereignis(sid: string, was: string): void {
    const s = this.get(sid)
    const l = this.lauf.get(sid)
    if (!s || !l || s.zustand === 'beendet') return
    const vorher = s.achtung
    l.hookBekannt = true
    if (was === 'arbeitet') { l.hookArbeitet = true; s.achtung = undefined }
    // Der Mensch hat selbst abgebrochen: Ruhe, aber nichts, was auf ihn wartet.
    if (was === 'unterbrochen') { l.hookArbeitet = false; s.achtung = undefined }
    // Eindeutig „braucht Freigabe“ (Codex, opencode): gilt auch, wenn das Deck den Anfang des Zugs nicht gesehen hat.
    if (was === 'freigabe') { l.hookArbeitet = true; s.achtung = 'wartet' }
    if (was === 'ruhig') {
      l.hookArbeitet = false
      if (s.zustand === 'arbeitet' || s.zustand === 'wartet') s.achtung = 'fertig'
    }
    // Claude Code meldet auch bloßes Warten nach einer Minute. Nur mitten in der Arbeit
    // heißt die Meldung „braucht Freigabe“; danach bleibt es bei „fertig“.
    if (was === 'wartet' && l.hookArbeitet) s.achtung = 'wartet'
    const zustand = s.zustand
    this.neuBewerten(s, l)
    // Ändert sich nur, was auf den Menschen wartet, erfährt es der Eingang trotzdem.
    if (s.achtung !== vorher && s.zustand === zustand) this.speichern(s)
  }

  /**
   * Auftrag in die Schlange legen (E6). Zugestellt wird, wenn die Session auf
   * Eingabe wartet; `sofort` umgeht das.
   */
  zustellen(sid: string, text: string, kennung?: string, sofort = false): void {
    const s = this.get(sid)
    if (!s || s.zustand === 'beendet') throw new Error(t('fehler.sitzungLaeuftNicht'))
    const l = this.laufzeit(sid)
    l.schlange.push({ text: text.replace(/\s*\n+\s*/g, ' ').trim(), kennung })
    this.emit('schlange', sid, l.schlange.length)
    if (sofort) void this.pumpen(s, l, true)
  }

  jetztZustellen(sid: string): void {
    const s = this.get(sid)
    const l = this.lauf.get(sid)
    if (s && l) void this.pumpen(s, l, true)
  }

  private bereit(l: Laufzeit): boolean {
    const jetzt = Date.now()
    return !l.hookArbeitet && jetzt - l.letzteAusgabe > RUHE_MS && jetzt - l.gestartet > 4000
  }

  private async pumpen(s: Sitzung, l: Laufzeit, erzwingen = false): Promise<void> {
    if (l.stelltZu || !l.schlange.length || !l.client?.alive) return
    if (!erzwingen && !this.bereit(l)) return
    l.stelltZu = true
    try {
      const n = l.schlange.shift()!
      await l.client.sendText(n.text)
      await new Promise((r) => setTimeout(r, 250))
      await l.client.sendKey('Enter')
      l.letzteAusgabe = Date.now()
      if (l.hookBekannt) l.hookArbeitet = true
      this.emit('schlange', s.id, l.schlange.length)
      if (n.kennung) this.emit('zugestellt', s.id, n.kennung)
    } finally {
      l.stelltZu = false
    }
  }

  private neuBewerten(s: Sitzung, l: Laufzeit): void {
    if (s.zustand === 'beendet') return
    const jetzt = Date.now()
    const laut = jetzt - l.letzteAusgabe < RUHE_MS
    let neu: Zustand
    if (s.achtung === 'wartet') neu = 'wartet'
    else if (l.hookBekannt ? l.hookArbeitet : laut) neu = 'arbeitet'
    else neu = 'ruhig'
    if (neu === 'arbeitet' && s.zustand !== 'arbeitet') l.arbeitetSeit = jetzt
    // Ohne Hooks: „fertig“ melden, wenn nach längerer Arbeit Ruhe einkehrt.
    if (!l.hookBekannt && s.art === 'cli' && s.zustand === 'arbeitet' && neu === 'ruhig' && jetzt - l.arbeitetSeit > 8000) s.achtung = 'fertig'
    if (neu !== s.zustand || laut) {
      const geaendert = neu !== s.zustand
      s.zustand = neu
      if (laut) s.aktiv = jetzt
      if (geaendert) this.speichern(s)
    }
  }

  private tick(): void {
    for (const [sid, l] of this.lauf) {
      const s = this.get(sid)
      if (!s || s.zustand === 'beendet') continue
      const vorher = s.achtung
      this.neuBewerten(s, l)
      if (s.achtung !== vorher) this.speichern(s)
      void this.pumpen(s, l)
    }
  }
}
