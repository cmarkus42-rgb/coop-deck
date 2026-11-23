/** Pfade, Dateiablage und kleine Helfer des Kerns. Kein Electron hier. */
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execFileSync } from 'child_process'
import { zustandsOrdner, suchpfade } from './plattform'
import { t, istSprache, spracheAusGebiet, type Sprache } from '../texte'

/** Laufzeitzustand liegt außerhalb der Projekte und damit außerhalb synchronisierter Ordner (PS-07). */
export const HOME = process.env.COOP_DECK_HOME || zustandsOrdner(process.platform, process.env, os.homedir())
export const RUNS = path.join(HOME, 'runs')
export const BIN = path.join(HOME, 'bin')
export const VERBINDUNG = path.join(HOME, 'verbindung.json')

/** Wurzel des Programms (dort liegen `typen/` und `dist/`). */
export const APP_ROOT = process.env.COOP_DECK_ROOT || path.resolve(__dirname, '..', '..')
export const TYPEN = path.join(APP_ROOT, 'typen')

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

export function id(n = 8): string {
  return crypto.randomBytes(16).toString('hex').slice(0, n)
}

/** Zeitstempel, der als Dateiname taugt und sortiert: 2026-11-22_161530. */
export function stempel(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

/** Schreibt über eine Nachbardatei und benennt um: nie eine halbe Datei. */
export function writeFileAtomic(file: string, data: string | Buffer): void {
  ensureDir(path.dirname(file))
  const tmp = `${file}.${process.pid}.${id(4)}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

export function writeJson(file: string, value: unknown): void {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n')
}

/**
 * Ablage mit Formatversion (NF-05). Eine Datei mit fremder Version wird nicht
 * stillschweigend überschrieben: sie wird beiseitegelegt und der Fehler gemeldet.
 */
export class Ablage<T extends object> {
  private data: T
  fehler: string | null = null

  constructor(private file: string, private version: number, private leer: () => T) {
    this.data = this.load()
  }

  private load(): T {
    if (!fs.existsSync(this.file)) return this.leer()
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      if (raw?.format !== this.version) throw new Error(t('ablage.format', { ist: raw?.format, soll: this.version }))
      return { ...this.leer(), ...(raw.daten ?? {}) }
    } catch (err) {
      const beiseite = `${this.file}.unlesbar-${stempel()}`
      try { fs.copyFileSync(this.file, beiseite) } catch { /* nichts zu retten */ }
      this.fehler = t('ablage.unlesbar', { datei: path.basename(this.file), grund: (err as Error).message, kopie: beiseite })
      return this.leer()
    }
  }

  get(): T {
    return this.data
  }

  save(): void {
    writeJson(this.file, { format: this.version, daten: this.data })
  }
}

/** Pfade, die nie ausgeliefert oder zitiert werden (SI-05). */
const GESPERRT = [/(^|\/)\.ssh(\/|$)/, /(^|\/)\.[^/]*\.env$/, /(^|\/)\.env(\.[^/]*)?$/, /(^|\/)\.[^/]*(armed|secret|token|credential)[^/]*$/i, /(^|\/)\.(netrc|npmrc|pypirc)$/, /\.(pem|key|p12)$/i, /(^|\/)\.git(\/|$)/, /(^|\/)\.aws(\/|$)/, /(^|\/)\.gnupg(\/|$)/]

export function istGesperrt(p: string): boolean {
  return GESPERRT.some((re) => re.test(p))
}

/** Löst `rel` unterhalb von `root` auf; `null`, wenn der Pfad ausbricht oder gesperrt ist. */
export function innerhalb(root: string, rel: string): string | null {
  const abs = path.resolve(root, rel)
  const r = path.resolve(root)
  if (abs !== r && !abs.startsWith(r + path.sep)) return null
  if (istGesperrt(abs)) return null
  // Symlinks dürfen nicht aus dem Projekt herausführen. Gibt es die Datei noch nicht, zählt der tiefste
  // Eintrag, den es gibt: sonst führte ein Symlink auf einen Ordner außerhalb für jede neue Datei hinaus.
  // „Gibt es“ heißt hier: der Eintrag selbst, nicht sein Ziel. Ein Symlink ins Leere zählt mit, sonst
  // legte ein Schreiben durch ihn die Datei an seinem Ziel außerhalb an.
  const gibtEs = (p: string) => { try { fs.lstatSync(p); return true } catch { return false } }
  let realRoot: string
  try { realRoot = fs.realpathSync(r) } catch { return abs /* das Projektverzeichnis selbst fehlt: der logische Pfad genügt */ }
  let da = abs
  while (da !== r && !gibtEs(da)) da = path.dirname(da)
  let real: string
  try { real = fs.realpathSync(da) } catch { return null /* Symlink ins Leere oder im Kreis: wohin er führt, lässt sich nicht prüfen */ }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null
  if (istGesperrt(real)) return null
  return abs
}

export function enhancedPath(): string {
  const cur = (process.env.PATH || '/usr/bin:/bin').split(path.delimiter)
  return [...new Set([BIN, ...suchpfade(process.platform, os.homedir()), ...cur])].join(path.delimiter)
}

export function kurz(text: string, n: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/**
 * Wie die Agenten den Menschen am Deck nennen. Vorgabe: der Name aus git, sonst der
 * Anmeldename. In den Einstellungen änderbar.
 */
function standardName(): string {
  try {
    const n = execFileSync('git', ['config', '--global', 'user.name'], { stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, PATH: enhancedPath() } }).toString().trim()
    if (n) return n.split(/\s+/)[0]
  } catch { /* kein git oder kein Name gesetzt */ }
  return os.userInfo().username
}

let nutzerName = ''

export function nutzer(): string {
  return (nutzerName ||= standardName())
}

export function setzeNutzer(name: string | undefined): void {
  nutzerName = name?.trim() || standardName()
}

let systemsprache: string | undefined

/**
 * Die Sprache, die das Betriebssystem nennt. Die Shell reicht sie herein: ein Programm, das aus
 * dem Finder startet, hat keine `LANG`, und Node hält das System dann für englisch.
 */
export function setzeSystemsprache(g: string | undefined): void {
  systemsprache = g
}

/**
 * Sprache der Oberfläche, solange in den Einstellungen keine gewählt ist: `COOP_DECK_SPRACHE`,
 * sonst die Sprache des Systems. Deutsch, wenn sie deutsch ist, sonst Englisch.
 */
export function sprachVorgabe(): Sprache {
  if (istSprache(process.env.COOP_DECK_SPRACHE)) return process.env.COOP_DECK_SPRACHE
  let system: string | undefined
  try { system = Intl.DateTimeFormat().resolvedOptions().locale } catch { /* ohne Angabe weiter */ }
  return spracheAusGebiet(process.env.LC_ALL) ?? spracheAusGebiet(process.env.LC_MESSAGES) ?? spracheAusGebiet(process.env.LANG) ?? spracheAusGebiet(systemsprache) ?? spracheAusGebiet(system) ?? 'en'
}
