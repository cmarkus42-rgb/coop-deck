/**
 * tmux-Anbindung des Coop Deck.
 *
 * Eigener Server (`-L coopdeck`, ohne die tmux.conf des Nutzers), damit sich Deck
 * und Mux nicht in die Quere kommen. Je Session ein Control-Mode-Client: er
 * liefert die Ausgabe, nimmt Eingaben an und bestimmt die Größe. Ausgabe und
 * Befehlsantworten kommen bei tmux in einem Strom, deshalb ist die Reihenfolge
 * zwischen Schnappschuss und Livestream eindeutig (Lehre aus dem Mux, 2026-10-16).
 *
 * Parser aus cipher-mux-electron übernommen (`parser.ts`).
 */
import { spawn, execFile, type ChildProcess } from 'child_process'
import { StringDecoder } from 'string_decoder'
import { TmuxParser, type TmuxEvent } from './parser'
import { enhancedPath } from '../basis'
import { t } from '../../texte'

/**
 * Aus dem Finder gestartet kennt die App nur den System-PATH; tmux liegt dort nicht.
 * Jeder Aufruf bekommt deshalb den erweiterten Pfad, nicht nur das Anlegen der Session.
 */
const umgebung = (env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({ ...process.env, ...env, PATH: enhancedPath() })

export const SOCKET = process.env.COOP_DECK_SOCKET || 'coopdeck'

/** Ein TUI im Raw-Modus verliert große Stöße; gemessen im Mux: 400 Bytes, 40 ms Pause. */
const CHUNK_BYTES = 400
const CHUNK_PAUSE_MS = 40

export interface Snapshot {
  content: string
  cursorX: number
  cursorY: number
  /** Modi, die das Programm im Terminal eingeschaltet hat (Vollbild, Maus, Einfügen …). */
  modi?: string[]
}

/** Format für `display-message` und die Folge, die den Modus im Terminal wieder einschaltet. */
const MODI: [string, string, string][] = [
  ['alt', '#{alternate_on}', '\x1b[?1049h'],
  ['maus-std', '#{mouse_standard_flag}', '\x1b[?1000h'],
  ['maus-knopf', '#{mouse_button_flag}', '\x1b[?1002h'],
  ['maus-alle', '#{mouse_all_flag}', '\x1b[?1003h'],
  ['maus-utf8', '#{mouse_utf8_flag}', '\x1b[?1005h'],
  ['maus-sgr', '#{mouse_sgr_flag}', '\x1b[?1006h'],
  ['einfuegen', '#{bracket_paste_flag}', '\x1b[?2004h'],
  ['pfeile', '#{keypad_cursor_flag}', '\x1b[?1h'],
  ['ziffern', '#{keypad_flag}', '\x1b='],
]

/**
 * Baut ein frisches Terminal so auf, wie das Programm es hinterlassen hat. Der Vollbildmodus
 * kommt vor dem Inhalt, die übrigen Modi danach: ohne sie erreicht etwa das Mausrad ein
 * Programm nicht mehr, das selbst scrollt.
 */
export function restoreSequence(s: Snapshot): string {
  const body = s.content.split('\n').join('\r\n')
  const an = new Set(s.modi ?? [])
  const folge = (wann: (name: string) => boolean) => MODI.filter(([name]) => an.has(name) && wann(name)).map(([, , f]) => f).join('')
  return `\x1bc${folge((n) => n === 'alt')}${body}\x1b[0m\x1b[${s.cursorY + 1};${s.cursorX + 1}H${folge((n) => n !== 'alt')}${an.has('cursor-aus') ? '\x1b[?25l' : ''}`
}

export function chunkForPty(text: string, maxBytes = CHUNK_BYTES): string[] {
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of text) {
    const n = Buffer.byteLength(ch, 'utf-8')
    if (size + n > maxBytes && cur) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  if (cur) out.push(cur)
  return out
}

export function tmux(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('tmux', ['-L', SOCKET, '-f', '/dev/null', ...args], { env: umgebung(env), maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`tmux ${args[0]}: ${(stderr || err.message).trim()}`))
      else resolve(stdout)
    })
  })
}

export async function listSessions(): Promise<string[]> {
  try {
    const out = await tmux(['list-sessions', '-F', '#{session_name}'])
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

export interface CreateOpts {
  name: string
  cwd: string
  argv: string[]
  env: Record<string, string>
  cols?: number
  rows?: number
}

export async function createSession(o: CreateOpts): Promise<void> {
  const envArgs = Object.entries(o.env).flatMap(([k, v]) => ['-e', `${k}=${v}`])
  // Mehrere Argumente führt tmux direkt aus, ohne Shell: keine Quoting-Fallen.
  await tmux([
    'new-session', '-d', '-s', o.name, '-x', String(o.cols ?? 100), '-y', String(o.rows ?? 30), '-c', o.cwd,
    ...envArgs, '--', ...o.argv,
  ], { ...process.env, ...o.env })
  // Optionen nach dem Start: der Server existiert erst jetzt sicher.
  for (const opt of [
    ['set', '-g', 'status', 'off'],
    ['set', '-g', 'escape-time', '0'],
    ['set', '-g', 'history-limit', '5000'],
    ['set', '-g', 'default-terminal', 'xterm-256color'],
    ['set', '-as', 'terminal-features', ',xterm-256color:RGB'],
    ['set', '-g', 'window-size', 'latest'],
    ['set', '-g', 'focus-events', 'on'],
    // Umschalt+Eingabe und andere modifizierte Tasten kommen nur so bei den CLIs an (pi warnt sonst).
    ['set', '-g', 'extended-keys', 'on'],
    // pi verlangt die Schreibweise CSI u und warnt bei der Vorgabe „xterm“; die anderen CLIs verstehen beide.
    ['set', '-s', 'extended-keys-format', 'csi-u'],
    ['set', '-as', 'terminal-features', ',xterm-256color:extkeys'],
  ]) {
    await tmux(opt).catch(() => undefined)
  }
}

export async function killSession(name: string): Promise<void> {
  await tmux(['kill-session', '-t', name]).catch(() => undefined)
}

interface Waiter {
  lines: string[]
  resolve: (lines: string[]) => void
  reject: (err: Error) => void
}

export interface ClientEvents {
  output: (data: string) => void
  exit: () => void
}

/** Ein Control-Mode-Client an genau einer Session. */
export class TmuxClient {
  private proc: ChildProcess
  private parser = new TmuxParser()
  private waiters: Waiter[] = []
  private current: Waiter | null = null
  private inOwnBlock = false
  private closed = false
  /** Solange ein Schnappschuss aussteht, steckt die Ausgabe schon in ihm und wird verworfen. */
  private dropOutput = false
  private sending: Promise<void> = Promise.resolve()
  /** Fortlaufend über alle Ausgabestücke: ein Zeichen darf über die Stückgrenze reichen. */
  private ausgabe = new StringDecoder('utf-8')

  constructor(readonly name: string, private on: ClientEvents) {
    this.proc = spawn('tmux', ['-L', SOCKET, '-f', '/dev/null', '-C', 'attach-session', '-t', name], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: umgebung({ TERM: 'xterm-256color' }),
    })
    const decoder = new StringDecoder('utf-8')
    this.parser.onEvent((e) => this.handle(e))
    this.proc.stdout?.on('data', (c: Buffer) => this.parser.feed(decoder.write(c)))
    this.proc.stderr?.on('data', () => undefined)
    this.proc.on('exit', () => this.finish())
    this.proc.on('error', () => this.finish())
  }

  private finish(): void {
    if (this.closed) return
    this.closed = true
    for (const w of this.waiters) w.reject(new Error(t('tmux.beendet')))
    this.waiters = []
    this.on.exit()
  }

  private handle(e: TmuxEvent): void {
    switch (e.type) {
      case 'output':
        {
          // Auch verworfene Stücke laufen durch den Decoder, sonst hinge ein halbes Zeichen am nächsten.
          const text = this.ausgabe.write(e.roh)
          if (!this.dropOutput && text) this.on.output(text)
        }
        break
      case 'begin':
        // flags 1: Antwort auf einen Befehl dieses Clients. flags 0: das attach selbst.
        this.inOwnBlock = e.flags === 1
        this.current = this.inOwnBlock ? (this.waiters.shift() ?? null) : null
        break
      case 'block-line':
        if (this.inOwnBlock) this.current?.lines.push(e.text)
        break
      case 'end':
      case 'error': {
        const w = this.current
        this.current = null
        if (this.inOwnBlock && w) {
          if (e.type === 'error') w.reject(new Error(w.lines.join(' ') || t('tmux.fehler')))
          else w.resolve(w.lines)
        }
        this.inOwnBlock = false
        break
      }
      case 'exit':
        this.finish()
        break
    }
  }

  private command(cmd: string): Promise<string[]> {
    if (this.closed || !this.proc.stdin?.writable) return Promise.reject(new Error(t('tmux.nichtVerbunden')))
    return new Promise((resolve, reject) => {
      this.waiters.push({ lines: [], resolve, reject })
      this.proc.stdin!.write(cmd + '\n')
    })
  }

  async resize(cols: number, rows: number): Promise<void> {
    await this.command(`refresh-client -C ${Math.max(20, cols | 0)}x${Math.max(5, rows | 0)}`).catch(() => undefined)
  }

  /** Inhalt und Cursor; danach folgende Ausgabe gehört obendrauf. */
  async snapshot(history = 800): Promise<Snapshot> {
    this.dropOutput = true
    try {
      const head = this.command(`display-message -p -t ${this.name} '#{cursor_x} #{cursor_y} #{cursor_flag} ${MODI.map(([, f]) => f).join(' ')}'`)
      const body = this.command(`capture-pane -p -e -J -t ${this.name} -S -${history}`)
      const [h, lines] = await Promise.all([head, body])
      const [x, y, cursor, ...flags] = (h[0] ?? '0 0').trim().split(/\s+/).map(Number)
      const modi = MODI.filter((_m, i) => flags[i] === 1).map(([name]) => name)
      if (cursor === 0) modi.push('cursor-aus')
      return { content: lines.join('\n'), cursorX: Number.isFinite(x) ? x : 0, cursorY: Number.isFinite(y) ? y : 0, modi }
    } finally {
      this.dropOutput = false
    }
  }

  /** Text wörtlich eintippen, in verdaulichen Stücken und in fester Reihenfolge. */
  sendText(text: string): Promise<void> {
    if (!text) return Promise.resolve()
    this.sending = this.sending.then(async () => {
      const chunks = chunkForPty(text)
      for (let i = 0; i < chunks.length; i++) {
        const hex = Buffer.from(chunks[i], 'utf-8').toString('hex').match(/.{2}/g)!.join(' ')
        await this.command(`send-keys -H -t ${this.name} ${hex}`).catch(() => undefined)
        if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, CHUNK_PAUSE_MS))
      }
    })
    return this.sending
  }

  sendKey(key: string): Promise<void> {
    this.sending = this.sending.then(async () => {
      await this.command(`send-keys -t ${this.name} ${key}`).catch(() => undefined)
    })
    return this.sending
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.proc.kill()
  }

  get alive(): boolean {
    return !this.closed
  }
}
