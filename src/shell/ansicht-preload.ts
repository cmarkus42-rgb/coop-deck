/**
 * Markier-Ebene in jedem Artefakt- und Web-Reiter.
 *
 * Aufgabe ist nicht das Bild, sondern der Bezug: zu jeder Marke wird ermittelt,
 * was gemeint ist. Artefakte des Decks kennzeichnen ihre Inhalte mit
 * `data-coop-ref`; bei allem anderen wird aus Selektor und sichtbarem Text
 * geschätzt und der Bezug als unsicher gekennzeichnet (KO-06, KO-09).
 *
 * Gestaltet wird nur über das CSSOM und SVG-Attribute, damit die Ebene auch auf
 * Seiten mit strenger Content-Security-Policy erscheint.
 */
import { ipcRenderer } from 'electron'

type Werkzeug = 'zeigen' | 'rahmen' | 'pfeil' | 'freihand' | 'text'
interface Rechteck { x: number; y: number; w: number; h: number }
interface Bezug { ref?: string; label?: string; selektor?: string; inhalt?: string; datei?: string; zeile?: number; unsicher: boolean }
interface Marke {
  nr: number
  art: Werkzeug
  el: Element | null
  /** Lage in Dokumentkoordinaten, falls kein Element verfolgt wird. */
  doc: Rechteck
  punkte?: [number, number][]
}

const SVG = 'http://www.w3.org/2000/svg'
const NEON = '#ff3fc8'
const DUNKEL = '#1d1830'
const BLICK = '#35e8d8'

let wurzel: HTMLDivElement | null = null
let svg: SVGSVGElement | null = null
let fang: HTMLDivElement | null = null
let werkzeug: Werkzeug | null = null
let marken: Marke[] = []
let naechste = 1
let zug: { x0: number; y0: number; punkte: [number, number][] } | null = null
let schwebt: Element | null = null

function aufbauen(): void {
  if (wurzel?.isConnected) return
  wurzel = document.createElement('div')
  wurzel.setAttribute('data-coop-ebene', '')
  Object.assign(wurzel.style, { position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none', margin: '0', padding: '0', border: '0' })
  svg = document.createElementNS(SVG, 'svg')
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' })
  fang = document.createElement('div')
  Object.assign(fang.style, { position: 'absolute', inset: '0', pointerEvents: 'none', cursor: 'crosshair', touchAction: 'none' })
  wurzel.append(svg, fang)
  document.documentElement.append(wurzel)
  fang.addEventListener('pointerdown', runter)
  fang.addEventListener('pointermove', bewegt)
  fang.addEventListener('pointerup', hoch)
  fang.addEventListener('pointerleave', () => { schwebt = null; zeichnen() })
}

/** Das oberste Element der Seite unter dem Punkt, an der eigenen Ebene vorbei. Ohne die Ebene dafür auszublenden: das ließe den Zeiger flackern. */
function darunter(x: number, y: number): Element | null {
  return document.elementsFromPoint(x, y).find((e) => !wurzel?.contains(e)) ?? null
}

// --- Bezug ----------------------------------------------------------------

function sichtbarerText(el: Element): string {
  const h = el as HTMLElement
  const t = (h.innerText || h.textContent || '').replace(/\s+/g, ' ').trim()
  if (t) return t.slice(0, 220)
  return (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('placeholder') || (el as HTMLInputElement).value || '').slice(0, 220)
}

function selektor(el: Element): string {
  const teile: string[] = []
  let cur: Element | null = el
  for (let i = 0; cur && cur !== document.documentElement && i < 6; i++) {
    if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) {
      teile.unshift(`#${cur.id}`)
      break
    }
    const tag = cur.tagName.toLowerCase()
    const eltern: Element | null = cur.parentElement
    const gleiche = eltern ? [...eltern.children].filter((c) => c.tagName === cur!.tagName) : []
    const klasse = [...cur.classList].find((c) => /^[A-Za-z][\w-]*$/.test(c) && c.length < 30)
    teile.unshift(gleiche.length > 1 ? `${tag}:nth-of-type(${gleiche.indexOf(cur) + 1})` : klasse ? `${tag}.${klasse}` : tag)
    cur = eltern
  }
  return teile.join(' > ')
}

function bezugVon(el: Element | null): Bezug {
  if (!el) return { unsicher: true }
  const traeger = el.closest('[data-coop-ref]')
  if (traeger) {
    const zeile = Number(traeger.getAttribute('data-coop-zeile'))
    return {
      ref: traeger.getAttribute('data-coop-ref') ?? undefined,
      label: traeger.getAttribute('data-coop-label') || sichtbarerText(traeger).slice(0, 120),
      datei: traeger.getAttribute('data-coop-datei') ?? undefined,
      zeile: Number.isFinite(zeile) && zeile > 0 ? zeile : undefined,
      // Wurde ein Teil innerhalb des Trägers getroffen, hilft dessen Text beim Verstehen.
      inhalt: traeger !== el ? sichtbarerText(el) || undefined : undefined,
      unsicher: false,
    }
  }
  return { selektor: selektor(el), inhalt: sichtbarerText(el) || undefined, unsicher: true }
}

/** Was ein Rahmen meint: alle gekennzeichneten Inhalte darin, sonst das größte Element, das hineinpasst. */
function bezugVonRahmen(r: Rechteck): { bezug: Bezug; el: Element | null } {
  const drin = [...document.querySelectorAll('[data-coop-ref]')].filter((e) => {
    const b = e.getBoundingClientRect()
    const mx = b.left + b.width / 2
    const my = b.top + b.height / 2
    return b.width > 0 && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
  })
  // Nur die innersten: ein Träger, der einen anderen getroffenen enthält, fällt weg.
  const innen = drin.filter((e) => !drin.some((o) => o !== e && e.contains(o))).slice(0, 8)
  if (innen.length === 1) return { bezug: bezugVon(innen[0]), el: innen[0] }
  if (innen.length > 1) {
    return {
      el: null,
      bezug: {
        ref: innen.map((e) => e.getAttribute('data-coop-ref')).join(', '),
        label: innen.map((e) => e.getAttribute('data-coop-label') || sichtbarerText(e).slice(0, 60)).join(' | '),
        datei: innen[0].getAttribute('data-coop-datei') ?? undefined,
        unsicher: false,
      },
    }
  }
  let el = darunter(r.x + r.w / 2, r.y + r.h / 2)
  while (el?.parentElement && el.parentElement !== document.body) {
    const b = el.parentElement.getBoundingClientRect()
    if (b.left < r.x - 16 || b.top < r.y - 16 || b.right > r.x + r.w + 16 || b.bottom > r.y + r.h + 16) break
    el = el.parentElement
  }
  return { bezug: bezugVon(el), el: null }
}

// --- Zeichnen -------------------------------------------------------------

function knoten<K extends keyof SVGElementTagNameMap>(tag: K, attr: Record<string, string | number>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attr)) n.setAttribute(k, String(v))
  return n
}

function sichtRechteck(m: Marke): Rechteck {
  if (m.el?.isConnected) {
    const b = m.el.getBoundingClientRect()
    return { x: b.left, y: b.top, w: b.width, h: b.height }
  }
  return { x: m.doc.x - scrollX, y: m.doc.y - scrollY, w: m.doc.w, h: m.doc.h }
}

/** Jede Linie doppelt: dunkel darunter, Neon darüber — lesbar auf hellem wie dunklem Grund. */
function doppelt(tag: 'rect' | 'polyline' | 'line', attr: Record<string, string | number>): SVGElement[] {
  return [
    knoten(tag, { ...attr, fill: 'none', stroke: DUNKEL, 'stroke-width': 5, 'stroke-linejoin': 'miter' }),
    knoten(tag, { ...attr, fill: 'none', stroke: NEON, 'stroke-width': 2, 'stroke-linejoin': 'miter' }),
  ]
}

function plakette(nr: number, x: number, y: number): SVGElement[] {
  const b = nr > 9 ? 26 : 20
  const px = Math.max(2, Math.min(innerWidth - b - 2, x))
  const py = Math.max(2, Math.min(innerHeight - 22, y))
  const t = knoten('text', { x: px + b / 2, y: py + 15, 'text-anchor': 'middle', fill: DUNKEL, 'font-size': 13, 'font-weight': 700, 'font-family': 'ui-monospace, Menlo, monospace' })
  t.textContent = String(nr)
  return [knoten('rect', { x: px, y: py, width: b, height: 20, fill: NEON, stroke: DUNKEL, 'stroke-width': 2 }), t]
}

function zeichnen(): void {
  if (!svg) return
  svg.replaceChildren()
  if (schwebt && werkzeug === 'zeigen') {
    const b = schwebt.getBoundingClientRect()
    svg.append(knoten('rect', { x: b.left, y: b.top, width: b.width, height: b.height, fill: 'rgba(53,232,216,0.14)', stroke: BLICK, 'stroke-width': 2, 'stroke-dasharray': '6 4' }))
  }
  for (const m of marken) {
    const r = sichtRechteck(m)
    // Außerhalb des Ausschnitts nichts zeichnen: eine an den Rand geklemmte Nummer zeigte auf das Falsche.
    if (r.y + r.h < 0 || r.y > innerHeight || r.x + r.w < 0 || r.x > innerWidth) continue
    const dx = m.el?.isConnected ? 0 : -scrollX
    const dy = m.el?.isConnected ? 0 : -scrollY
    if (m.art === 'zeigen' || m.art === 'rahmen') {
      svg.append(...doppelt('rect', { x: r.x - 2, y: r.y - 2, width: r.w + 4, height: r.h + 4 }))
      svg.append(...plakette(m.nr, r.x - 4, r.y - 24))
    } else if (m.art === 'freihand' && m.punkte) {
      svg.append(...doppelt('polyline', { points: m.punkte.map(([x, y]) => `${x + dx},${y + dy}`).join(' ') }))
      svg.append(...plakette(m.nr, m.punkte[0][0] + dx - 10, m.punkte[0][1] + dy - 26))
    } else if (m.art === 'pfeil' && m.punkte) {
      const [[x1, y1], [x2, y2]] = m.punkte.map(([x, y]) => [x + dx, y + dy] as [number, number])
      const w = Math.atan2(y2 - y1, x2 - x1)
      const spitze = [[x2, y2], [x2 - 14 * Math.cos(w - 0.45), y2 - 14 * Math.sin(w - 0.45)], [x2 - 14 * Math.cos(w + 0.45), y2 - 14 * Math.sin(w + 0.45)]]
      svg.append(...doppelt('line', { x1, y1, x2, y2 }))
      svg.append(knoten('polygon', { points: spitze.map((p) => p.join(',')).join(' '), fill: NEON, stroke: DUNKEL, 'stroke-width': 2 }))
      svg.append(...plakette(m.nr, x1 - 10, y1 - 24))
    } else {
      svg.append(...plakette(m.nr, r.x - 10, r.y - 10))
    }
  }
  if (zug && werkzeug && werkzeug !== 'zeigen' && werkzeug !== 'text') {
    const p = zug.punkte
    const [x, y] = p[p.length - 1]
    if (werkzeug === 'rahmen') svg.append(...doppelt('rect', { x: Math.min(zug.x0, x), y: Math.min(zug.y0, y), width: Math.abs(x - zug.x0), height: Math.abs(y - zug.y0) }))
    if (werkzeug === 'pfeil') svg.append(...doppelt('line', { x1: zug.x0, y1: zug.y0, x2: x, y2: y }))
    if (werkzeug === 'freihand') svg.append(...doppelt('polyline', { points: p.map((q) => q.join(',')).join(' ') }))
  }
}

// --- Eingabe --------------------------------------------------------------

function melden(m: Marke, bezug: Bezug): void {
  marken.push(m)
  zeichnen()
  const r = sichtRechteck(m)
  ipcRenderer.sendToHost('coop-marke', { nr: m.nr, art: m.art, bezug, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } })
}

function runter(e: PointerEvent): void {
  if (!werkzeug) return
  e.preventDefault()
  e.stopPropagation()
  fang!.setPointerCapture(e.pointerId)
  zug = { x0: e.clientX, y0: e.clientY, punkte: [[e.clientX, e.clientY]] }
}

function bewegt(e: PointerEvent): void {
  if (!werkzeug) return
  if (zug) {
    zug.punkte.push([e.clientX, e.clientY])
  } else if (werkzeug === 'zeigen') {
    schwebt = darunter(e.clientX, e.clientY)
  }
  zeichnen()
}

function hoch(e: PointerEvent): void {
  if (!werkzeug || !zug) return
  e.preventDefault()
  const z = zug
  zug = null
  const x = e.clientX
  const y = e.clientY
  const nr = naechste++
  const doc = (r: Rechteck): Rechteck => ({ x: r.x + scrollX, y: r.y + scrollY, w: r.w, h: r.h })
  if (werkzeug === 'zeigen' || werkzeug === 'text') {
    const el = darunter(x, y)
    const traeger = el?.closest('[data-coop-ref]') ?? el
    const b = traeger?.getBoundingClientRect()
    if (werkzeug === 'zeigen' && traeger && b) melden({ nr, art: 'zeigen', el: traeger, doc: doc({ x: b.left, y: b.top, w: b.width, h: b.height }) }, bezugVon(el))
    else melden({ nr, art: 'text', el: null, doc: doc({ x, y, w: 0, h: 0 }) }, bezugVon(el))
    schwebt = null
    return
  }
  const r: Rechteck = { x: Math.min(z.x0, x), y: Math.min(z.y0, y), w: Math.abs(x - z.x0), h: Math.abs(y - z.y0) }
  if (werkzeug === 'pfeil') {
    if (r.w + r.h < 8) { naechste--; zeichnen(); return }
    // Ein Pfeil meint, worauf seine Spitze zeigt.
    melden({ nr, art: 'pfeil', el: null, doc: doc(r), punkte: [[z.x0 + scrollX, z.y0 + scrollY], [x + scrollX, y + scrollY]] }, bezugVon(darunter(x, y)))
    return
  }
  if (r.w < 6 && r.h < 6) { naechste--; zeichnen(); return }
  if (werkzeug === 'freihand') {
    const xs = z.punkte.map((p) => p[0])
    const ys = z.punkte.map((p) => p[1])
    const box: Rechteck = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    melden({ nr, art: 'freihand', el: null, doc: doc(box), punkte: z.punkte.map(([px, py]) => [px + scrollX, py + scrollY]) }, bezugVonRahmen(box).bezug)
    return
  }
  const treffer = bezugVonRahmen(r)
  melden({ nr, art: 'rahmen', el: treffer.el, doc: doc(r) }, treffer.bezug)
}

function setzeWerkzeug(w: Werkzeug | null): void {
  aufbauen()
  werkzeug = w
  schwebt = null
  zug = null
  if (fang) fang.style.pointerEvents = w ? 'auto' : 'none'
  zeichnen()
}

ipcRenderer.on('coop-werkzeug', (_e, w: Werkzeug | null) => setzeWerkzeug(w))
ipcRenderer.on('coop-entfernen', (_e, nr: number) => { marken = marken.filter((m) => m.nr !== nr); zeichnen() })
ipcRenderer.on('coop-leeren', () => { marken = []; naechste = 1; zeichnen() })

window.addEventListener('scroll', () => zeichnen(), { capture: true, passive: true })
window.addEventListener('resize', () => zeichnen())
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && werkzeug) {
    setzeWerkzeug(null)
    ipcRenderer.sendToHost('coop-abbruch')
  }
}, true)
