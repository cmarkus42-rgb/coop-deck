/**
 * Sprache und Fernbedienung (VO-01 bis VO-07). Erkennung und Ausgabe laufen lokal über
 * Programme, die auf der Maschine liegen: nichts davon bringt das Deck mit, und kein Ton
 * verlässt die Maschine (VO-07). Wo sie liegen, steht in den Einstellungen.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { EventEmitter } from 'events'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { HOME, enhancedPath, sprachVorgabe } from './basis'
import { findeProgramm, vorleser } from './plattform'
import { t, sprache as anzeigesprache, type Schluessel } from '../texte'

export interface SprachEinstellung {
  /** Whisper-Modell (`ggml-*.bin`). Leer: das erste unter `<Deck-Ordner>/modelle/`. */
  modell?: string
  /** Sprache der Erkennung, z. B. `de`. */
  sprache?: string
  /** Hinweise und Fragen der Session im Fokus vorlesen (VO-05). */
  ausgabe?: boolean
  /** Stimme der Ausgabe; leer nimmt die Vorgabe des Systems. Ein Pfad auf eine `.onnx`-Datei wählt eine Piper-Stimme. */
  stimme?: string
  /** Programm `piper` für Piper-Stimmen. Leer: das erste im Suchpfad. */
  piper?: string
  /** Programm, das Tasten einer BT-Fernbedienung als JSON-Zeilen meldet (VO-02). */
  bruecke?: string
  /** Taste der Fernbedienung → Aktion des Decks. */
  tasten?: Record<string, string>
}

/** Was eine Taste der Fernbedienung oder ein Sprachbefehl im Deck auslösen kann: Kennung → Schlüssel der Beschreibung. */
export const AKTIONEN = {
  diktat: 'aktion.diktat',
  senden: 'aktion.senden',
  abbrechen: 'aktion.abbrechen',
  'session-vor': 'aktion.session-vor',
  'session-zurueck': 'aktion.session-zurueck',
  'reiter-vor': 'aktion.reiter-vor',
  'reiter-zurueck': 'aktion.reiter-zurueck',
  hoch: 'aktion.hoch',
  runter: 'aktion.runter',
  eingang: 'aktion.eingang',
} satisfies Record<string, Schluessel>

/** Die Aktionen mit ihrer Beschreibung in der gewählten Sprache. */
export function aktionen(): Record<string, string> {
  return Object.fromEntries(Object.entries(AKTIONEN).map(([k, v]) => [k, t(v)]))
}

/** Vorgabe für die Fernbedienung mit zwei Tasten. */
export const TASTEN_VORGABE: Record<string, string> = { big: 'diktat', small: 'senden' }

const finde = (name: string): string | null => findeProgramm(name, enhancedPath())

/** Das Vorleseprogramm dieses Systems, sofern eines da ist: `say` unter macOS, sonst `espeak-ng`. */
function findeVorleser(e: SprachEinstellung): { datei: string; argumente: string[] } | null {
  const stimme = /^[\p{L}\p{N} ().+_-]{1,60}$/u.test(e.stimme ?? '') ? e.stimme! : undefined
  for (const v of vorleser(process.platform, { stimme, sprache: anzeigesprache() })) {
    const datei = finde(v.programm)
    if (datei) return { datei, argumente: v.argumente }
  }
  return null
}

function findeModell(e: SprachEinstellung): string | null {
  if (e.modell?.trim()) {
    const f = e.modell.trim().replace(/^~(?=\/|$)/, os.homedir())
    return fs.existsSync(f) ? f : null
  }
  const dir = path.join(HOME, 'modelle')
  try {
    const n = fs.readdirSync(dir).filter((x) => /^ggml-.*\.bin$/.test(x)).sort()[0]
    return n ? path.join(dir, n) : null
  } catch { return null }
}

export interface SprachLage {
  erkennung: boolean
  ausgabe: boolean
  /** Womit vorgelesen wird: eine Piper-Stimme, das Programm des Systems oder nichts. */
  vorleser: 'piper' | 'system' | null
  /** Was dem Vorlesen fehlt, in Worten. */
  vorleserFehlt: string | null
  /** Weitere Piper-Stimmen im Ordner der gewählten. */
  stimmen: string[]
  /** Was fehlt, in Worten. */
  fehlt: string[]
  modell: string | null
  fernbedienung: boolean
}

export function lage(e: SprachEinstellung): SprachLage {
  const fehlt: string[] = []
  if (!finde('whisper-cli')) fehlt.push(t('voice.whisperFehlt'))
  if (!finde('ffmpeg')) fehlt.push(t('voice.ffmpegFehlt'))
  const modell = findeModell(e)
  if (!modell) fehlt.push(e.modell?.trim() ? t('voice.modellFehlt', { modell: e.modell }) : t('voice.keinModell', { ordner: path.join(HOME, 'modelle') }))
  const p = piperLage(e)
  const vorleser = p.gewollt ? (p.fehlt ? null : 'piper') : findeVorleser(e) ? 'system' : null
  return { erkennung: !fehlt.length, ausgabe: !!vorleser, vorleser, vorleserFehlt: p.gewollt ? p.fehlt : null, stimmen: p.stimmen, fehlt, modell, fernbedienung: !!e.bruecke?.trim() && fs.existsSync(e.bruecke.trim()) }
}

const lauf = (bin: string, args: string[], eingabe?: Buffer, frist = 120000) => new Promise<string>((ok, nein) => {
  const kind = execFile(bin, args, { env: { ...process.env, PATH: enhancedPath() }, timeout: frist, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) nein(new Error(`${path.basename(bin)}: ${String(stderr || err.message).trim().split('\n').slice(-2).join(' ')}`))
    else ok(String(stdout))
  })
  kind.stdin?.on('error', () => undefined)
  kind.stdin?.end(eingabe)
})


/** Was Whisper ausgibt, wenn niemand spricht, ist kein Text. */
export function saeubern(roh: string): string {
  return roh.split('\n').map((z) => z.trim()).filter((z) => z && !/^[\[(].*[\])]$/.test(z)).join(' ').replace(/\s+/g, ' ').trim()
}

/** Aufnahme (beliebiges Format, das ffmpeg liest) → Text. Die Dateien dazu liegen kurz im Laufordner und verschwinden wieder. */
export async function erkennen(audio: Buffer, e: SprachEinstellung): Promise<string> {
  const l = lage(e)
  if (!l.erkennung) throw new Error(l.fehlt.join(' '))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coopdeck-ton-'))
  const wav = path.join(dir, 'ton.wav')
  try {
    await lauf(finde('ffmpeg')!, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav], audio, 30000)
    // Ohne eigene Angabe wird in der Sprache des Systems erkannt, nicht in der der Oberfläche: wer das Deck englisch
    // benutzt und deutsch spricht, bekäme sein Diktat sonst übersetzt. Der Hinweis nennt Whisper das Rufwort der Sprachbefehle.
    const sprache = /^[a-z]{2,3}$/.test(e.sprache ?? '') ? e.sprache! : sprachVorgabe()
    return saeubern(await lauf(finde('whisper-cli')!, ['-m', l.modell!, '-l', sprache, '-nt', '-np', '--prompt', t('voice.rufworte'), '-f', wav]))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Wie `erkennen`, aber aus einer Datei und ohne Rufwort-Hinweis: für gesprochene Notizen vom Handy,
 * die länger sein dürfen und in Containern kommen, die ffmpeg nicht aus einem Strom lesen kann (m4a).
 */
export async function erkennenDatei(datei: string, e: SprachEinstellung): Promise<string> {
  const l = lage(e)
  if (!l.erkennung) throw new Error(l.fehlt.join(' '))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coopdeck-ton-'))
  const wav = path.join(dir, 'ton.wav')
  try {
    await lauf(finde('ffmpeg')!, ['-hide_banner', '-loglevel', 'error', '-i', datei, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav], undefined, 300000)
    // Ohne eigene Angabe erkennt Whisper die Sprache selbst: eine Notiz ist in der Sprache des Menschen, nicht in der der Oberfläche.
    // Mit einer festen anderen Sprache gäbe Whisper den Satz übersetzt aus.
    const sprache = /^[a-z]{2,3}$/.test(e.sprache ?? '') ? e.sprache! : 'auto'
    return saeubern(await lauf(finde('whisper-cli')!, ['-m', l.modell!, '-l', sprache, '-nt', '-np', '-f', wav], undefined, 1800000))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

let spricht: ChildProcess | null = null

/** Vorlesen (VO-05). Ein neuer Text unterbricht den laufenden. Der Text geht als Argument, nie durch eine Shell. */
export function sprechen(text: string, e: SprachEinstellung): boolean {
  schweigen()
  const sauber = text.replace(/[`*_#>\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
  if (!sauber) return false
  const p = piperLage(e)
  if (p.gewollt) return p.fehlt ? false : sprechenMitPiper(sauber, p.programm!, p.stimme!)
  const programm = findeVorleser(e)
  if (!programm) return false
  spricht = spawn(programm.datei, [...programm.argumente, '--', sauber], { stdio: 'ignore' })
  spricht.on('exit', () => { spricht = null })
  spricht.on('error', () => { spricht = null })
  return true
}

const heim = (p: string) => p.trim().replace(/^~(?=\/|$)/, os.homedir())

/** Piper ist gewählt, sobald die Stimme eine `.onnx`-Datei ist. Dann zählt nur Piper: fehlt etwas, bleibt das Deck still, statt mit fremder Stimme zu sprechen. */
function piperLage(e: SprachEinstellung): { gewollt: boolean; fehlt: string | null; programm?: string; stimme?: string; stimmen: string[] } {
  const roh = e.stimme?.trim() ?? ''
  if (!/\.onnx$/i.test(roh)) return { gewollt: false, fehlt: null, stimmen: [] }
  const stimme = heim(roh)
  let stimmen: string[] = []
  try { stimmen = fs.readdirSync(path.dirname(stimme)).filter((n) => n.endsWith('.onnx')).sort().map((n) => path.join(path.dirname(stimme), n)) } catch { /* Ordner fehlt */ }
  const programm = e.piper?.trim() ? (fs.existsSync(heim(e.piper)) ? heim(e.piper) : null) : finde('piper')
  const fehlt = !fs.existsSync(stimme) ? t('voice.stimmeFehlt', { pfad: roh })
    : !fs.existsSync(`${stimme}.json`) ? t('voice.stimmeOhneAngaben', { pfad: `${roh}.json` })
      : !programm ? (e.piper?.trim() ? t('voice.piperFehlt', { pfad: e.piper.trim() }) : t('voice.piperNichtGefunden'))
        : !abspieler() ? t('voice.abspielerFehlt') : null
  return { gewollt: true, fehlt, programm: programm ?? undefined, stimme, stimmen }
}

/** Spielt eine WAV-Datei ab: `afplay` unter macOS, sonst was da ist. */
function abspieler(): { datei: string; argumente: string[] } | null {
  for (const [name, argumente] of (process.platform === 'darwin' ? [['afplay', []]] : [['paplay', []], ['aplay', ['-q']], ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet']]]) as [string, string[]][]) {
    const datei = finde(name)
    if (datei) return { datei, argumente }
  }
  return null
}

const aussprachen = new Map<string, { zeit: number; ersetze: (text: string) => string }>()

/**
 * Aussprachetabelle einer Stimme: `<stimme ohne .onnx>.respellings.json` neben dem Modell, ein flaches
 * Objekt „Wort oder Wendung → wie es gesprochen werden soll“. Eine deutsche Stimme liest englische
 * Fachwörter sonst buchstabengetreu. Zeigt die Stimme als Verweis auf ein anderes Modell, gilt dessen Tabelle mit.
 */
export function aussprache(stimme: string): (text: string) => string {
  const kandidaten = [stimme]
  try { kandidaten.push(fs.realpathSync(stimme)) } catch { /* Verweis ins Leere */ }
  const datei = kandidaten.map((s) => s.replace(/\.onnx$/i, '.respellings.json')).find((f) => fs.existsSync(f))
  if (!datei) return (text) => text
  const zeit = fs.statSync(datei).mtimeMs
  const alt = aussprachen.get(datei)
  if (alt && alt.zeit === zeit) return alt.ersetze
  let tabelle: Record<string, unknown> = {}
  try { tabelle = JSON.parse(fs.readFileSync(datei, 'utf-8')) as Record<string, unknown> } catch { /* unlesbar: ohne Tabelle */ }
  const paare = Object.entries(tabelle).filter((p): p is [string, string] => typeof p[1] === 'string' && !!p[0].trim())
  const genau = new Map(paare)
  const klein = new Map(paare.map(([k, v]) => [k.toLowerCase(), v]))
  // Längste Wendung zuerst, damit „Pull Request“ vor „Pull“ greift; nur ganze Wörter.
  const muster = paare.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(${paare.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
    : null
  const ersetze = (text: string) => (muster ? text.replace(muster, (w) => genau.get(w) ?? klein.get(w.toLowerCase()) ?? w) : text)
  aussprachen.set(datei, { zeit, ersetze })
  return ersetze
}

function sprechenMitPiper(text: string, programm: string, stimme: string): boolean {
  const abspiel = abspieler()
  if (!abspiel) return false
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coopdeck-stimme-'))
  const wav = path.join(dir, 'satz.wav')
  const weg = () => fs.rmSync(dir, { recursive: true, force: true })
  // Der Text geht über die Eingabe an Piper, nie als Argument und nie durch eine Shell.
  const piper = spawn(programm, ['-m', stimme, '-f', wav], { cwd: dir, stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, PATH: enhancedPath() } })
  spricht = piper
  piper.stdin?.on('error', () => undefined)
  piper.stdin?.end(aussprache(stimme)(text) + '\n')
  piper.on('error', () => { if (spricht === piper) spricht = null; weg() })
  piper.on('exit', (code) => {
    // Inzwischen unterbrochen oder gescheitert: nichts abspielen.
    if (spricht !== piper || code !== 0 || !fs.existsSync(wav)) { if (spricht === piper) spricht = null; return weg() }
    const spiel = spawn(abspiel.datei, [...abspiel.argumente, wav], { stdio: 'ignore' })
    spricht = spiel
    spiel.on('exit', () => { if (spricht === spiel) spricht = null; weg() })
    spiel.on('error', () => { if (spricht === spiel) spricht = null; weg() })
  })
  return true
}

export function schweigen(): void {
  try { spricht?.kill() } catch { /* schon still */ }
  spricht = null
}

/**
 * Sprachbefehl für das Deck (VO-06). Er beginnt mit „Deck“, damit ein diktierter Satz
 * nicht versehentlich etwas auslöst. Alles andere ist Diktat.
 */
export function deckBefehl(text: string): { aktion: string; name?: string } | null {
  // Whisper schreibt das Rufwort gelegentlich anders und setzt den Satz in Anführungszeichen.
  const m = /^[\s"„“»«']*(?:hey\s+)?(?:deck|dek|däck|dick)\b[\s,.:!]*(.*?)[\s"“”»«']*$/i.exec(text)
  if (!m) return null
  const t = m[1].toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim()
  // Deutsche und englische Wörter gelten nebeneinander, gleich welche Sprache gewählt ist.
  const projekt = /^(?:projekt|wechsle? zu(?:m projekt)?|öffne(?: das)? projekt|project|switch to(?: (?:the )?project)?|open(?: the)? project) (.+)$/.exec(t)
  if (projekt) return { aktion: 'projekt', name: projekt[1].trim() }
  const vor = /nächste|weiter|vor\b|next|forward/
  const zurueck = /vorige|vorherige|zurück|previous|back\b/
  const reiter = /reiter|artefakt|artifact|tab/
  if (/eingang|inbox/.test(t)) return { aktion: 'eingang' }
  if (/^(senden|abschicken|schick(e)? (das )?ab|los|send( it)?|submit|go)$/.test(t)) return { aktion: 'senden' }
  if (/^(abbrechen|verwerfen|lösch(e|en)?( das)?|cancel|discard|clear( that)?)$/.test(t)) return { aktion: 'abbrechen' }
  if (t.includes('session') && vor.test(t)) return { aktion: 'session-vor' }
  if (t.includes('session') && zurueck.test(t)) return { aktion: 'session-zurueck' }
  if (reiter.test(t) && vor.test(t)) return { aktion: 'reiter-vor' }
  if (reiter.test(t) && zurueck.test(t)) return { aktion: 'reiter-zurueck' }
  if (/^(hoch|nach oben|rauf|up|scroll up)$/.test(t)) return { aktion: 'hoch' }
  if (/^(runter|nach unten|down|scroll down)$/.test(t)) return { aktion: 'runter' }
  return { aktion: 'unbekannt', name: t }
}

/**
 * BT-Fernbedienung (VO-02). Die Tasten liest ein eigenes kleines Programm, das unter macOS
 * die Rechte für Eingabeüberwachung braucht; es meldet je Druck eine JSON-Zeile mit `button`.
 * Das Deck ordnet der Taste eine Aktion zu. Fällt das Programm aus, startet es nach einer Pause neu.
 */
export class Fernbedienung extends EventEmitter {
  private kind: ChildProcess | null = null
  private neu: ReturnType<typeof setTimeout> | null = null
  private pfad = ''
  fehler: string | null = null

  start(pfad: string | undefined): void {
    this.stop()
    this.pfad = (pfad ?? '').trim()
    this.fehler = null
    if (!this.pfad) return
    if (!fs.existsSync(this.pfad)) { this.fehler = t('voice.fernFehlt', { pfad: this.pfad }); return }
    this.verbinden()
  }

  private verbinden(): void {
    const kind = spawn(this.pfad, ['--relay'], { stdio: ['ignore', 'pipe', 'ignore'] })
    this.kind = kind
    let puffer = ''
    kind.stdout!.on('data', (d: Buffer) => {
      puffer += d.toString('utf-8')
      let nl: number
      while ((nl = puffer.indexOf('\n')) >= 0) {
        const taste = tasteAusZeile(puffer.slice(0, nl))
        puffer = puffer.slice(nl + 1)
        if (taste) this.emit('taste', taste)
      }
    })
    kind.on('error', (e) => { this.fehler = t('voice.fernFehler', { text: e.message }) })
    kind.on('exit', () => {
      if (this.kind !== kind) return
      this.kind = null
      this.neu = setTimeout(() => { if (this.pfad) this.verbinden() }, 5000)
    })
  }

  stop(): void {
    if (this.neu) clearTimeout(this.neu)
    this.neu = null
    const k = this.kind
    this.kind = null
    this.pfad = ''
    try { k?.kill() } catch { /* schon weg */ }
  }
}

/** Eine Zeile des Tastenprogramms. Nur kurze, schlichte Namen gelten als Taste. */
export function tasteAusZeile(zeile: string): string | null {
  try {
    const m = JSON.parse(zeile) as { button?: unknown }
    return typeof m.button === 'string' && /^[a-z0-9_-]{1,24}$/i.test(m.button) ? m.button.toLowerCase() : null
  } catch { return null }
}
