/** Terminals der Sessions. Sie leben außerhalb von Preact, damit ein Reiterwechsel nichts neu aufbaut. */
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { deck } from './bruecke'
import { pfadeIn } from './pfade'

interface Eintrag {
  term: Terminal
  fit: FitAddon
  el: HTMLDivElement
  zustand: 'neu' | 'verbindet' | 'verbunden'
  seq: number
  puffer: { seq: number; data: string }[]
  cols: number
  rows: number
}

const THEMEN: Record<'dunkel' | 'hell', ITheme> = {
  dunkel: {
    background: '#2a4852', foreground: '#f1ead9', cursor: '#ff5fc0', cursorAccent: '#2a4852', selectionBackground: '#5a8b97',
    black: '#1b2f36', red: '#ff7a6b', green: '#7fe89a', yellow: '#f6e84a', blue: '#7fb8ff', magenta: '#ff5fc0', cyan: '#5cf2d6', white: '#d9d3c2',
    brightBlack: '#9bbcc2', brightRed: '#ffa093', brightGreen: '#a8f5bb', brightYellow: '#fff27a', brightBlue: '#a9d0ff', brightMagenta: '#ff8fd4', brightCyan: '#93f8e6', brightWhite: '#fbf6ea',
  },
  hell: {
    background: '#dde5d6', foreground: '#1e2f2a', cursor: '#a80f68', cursorAccent: '#dde5d6', selectionBackground: '#b4c0ac',
    black: '#1e2f2a', red: '#a3261c', green: '#1f6b32', yellow: '#6f5200', blue: '#1f4f9a', magenta: '#a80f68', cyan: '#00635a', white: '#5c6e63',
    brightBlack: '#47594f', brightRed: '#c2362b', brightGreen: '#2a8242', brightYellow: '#8a6800', brightBlue: '#2c64bd', brightMagenta: '#c4267f', brightCyan: '#007a70', brightWhite: '#2b3d37',
  },
}

const terminals = new Map<string, Eintrag>()
let thema: 'dunkel' | 'hell' = 'dunkel'
let linkOeffnen: (ziel: string) => void = () => undefined
let projektPfad = ''
export function setzeProjektPfad(p: string): void {
  projektPfad = p
}

export function beiLink(fn: (ziel: string) => void): void {
  linkOeffnen = fn
}

export function setzeThema(t: 'dunkel' | 'hell'): void {
  thema = t
  for (const e of terminals.values()) e.term.options.theme = THEMEN[t]
}

function anlegen(sid: string): Eintrag {
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: 13, lineHeight: 1.2, cursorBlink: true,
    scrollback: 8000, allowProposedApi: true, macOptionIsMeta: false, theme: THEMEN[thema],
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon((_e, uri) => linkOeffnen(uri)))
  // Absolute Dateipfade im Terminal sind Links in den rechten Bereich (BR-10).
  term.registerLinkProvider({
    provideLinks(zeile, callback) {
      const text = term.buffer.active.getLine(zeile - 1)?.translateToString(true) ?? ''
      const links = pfadeIn(text, projektPfad).map((t) => (
        { range: { start: { x: t.start + 1, y: zeile }, end: { x: t.start + t.text.length, y: zeile } }, text: t.text, activate: () => linkOeffnen(t.text) }
      ))
      callback(links.length ? links : undefined)
    },
  })
  const el = document.createElement('div')
  el.style.height = '100%'
  term.open(el)
  term.onData((d) => deck.eingabe(sid, d))
  const e: Eintrag = { term, fit, el, zustand: 'neu', seq: 0, puffer: [], cols: 0, rows: 0 }
  terminals.set(sid, e)
  return e
}

export function terminal(sid: string): Eintrag {
  return terminals.get(sid) ?? anlegen(sid)
}

export function vergessen(sid: string): void {
  const e = terminals.get(sid)
  if (!e) return
  e.term.dispose()
  e.el.remove()
  terminals.delete(sid)
}

/** Ausgabe vom Kern. Solange der Schnappschuss aussteht, wird gepuffert und danach nach Nummer gefiltert. */
export function ausgabe(sid: string, data: string, seq: number): void {
  const e = terminals.get(sid)
  if (!e || e.zustand === 'neu') return
  if (e.zustand === 'verbindet') e.puffer.push({ seq, data })
  else if (seq > e.seq) { e.seq = seq; e.term.write(data) }
}

/** Passt die Größe an und holt beim ersten Mal (oder nach `neu`) den Bildschirm aus tmux. */
export async function anpassen(sid: string, neu = false): Promise<void> {
  const e = terminals.get(sid)
  if (!e || !e.el.isConnected || e.el.clientWidth < 40) return
  e.fit.fit()
  const { cols, rows } = e.term
  if (e.zustand === 'verbunden' && !neu) {
    if (cols !== e.cols || rows !== e.rows) { e.cols = cols; e.rows = rows; deck.groesse(sid, cols, rows) }
    return
  }
  if (e.zustand === 'verbindet') return
  e.zustand = 'verbindet'
  e.puffer = []
  e.cols = cols
  e.rows = rows
  const snap = (await deck.ruf('verbinden', sid, cols, rows)) as { wiederherstellen: string; seq: number } | null
  if (!snap) { e.zustand = 'neu'; return }
  e.term.write(snap.wiederherstellen)
  e.seq = snap.seq
  for (const p of e.puffer) if (p.seq > e.seq) { e.seq = p.seq; e.term.write(p.data) }
  e.puffer = []
  e.zustand = 'verbunden'
}

export function zuruecksetzen(sid: string): void {
  const e = terminals.get(sid)
  if (e) e.zustand = 'neu'
}
