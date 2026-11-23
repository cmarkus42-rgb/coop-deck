/**
 * Coop-Protokoll: Rückmeldung (Mensch → Session), Hinweis, Frage und Anfrage (Agent → Mensch).
 * Alles ist Datei im Projekt unter `.coop/`; die Schnittstellen darüber sind dünn (CP-09).
 */
import fs from 'fs'
import path from 'path'
import { ensureDir, readJson, writeJson, writeFileAtomic, stempel, id, kurz, nutzer } from './basis'
import { t } from '../texte'

export interface Bezug {
  /** Bezug in der Sprache des Artefakts, z. B. `roadmap:R-12` oder `datei:PROJEKT.md:14`. */
  ref?: string
  /** Lesbarer Name dazu, z. B. „R-12 Anmeldung umbauen“. */
  label?: string
  selektor?: string
  /** Sichtbarer Text des getroffenen Elements. */
  inhalt?: string
  datei?: string
  zeile?: number
  /** Zusatz aus dem Artefakt selbst (3D-Koordinate, Bauteil …). */
  kontext?: unknown
  /** Wahr, wenn der Bezug nur aus Selektor und Text geschätzt ist (KO-09). */
  unsicher: boolean
}

export interface Marke {
  nr: number
  art: 'zeigen' | 'rahmen' | 'pfeil' | 'freihand' | 'text'
  text: string
  bezug: Bezug
  rect?: { x: number; y: number; w: number; h: number }
}

export interface Rueckmeldung {
  format: 1
  id: string
  zeit: string
  artefakt?: { id: string; titel: string; typ: string }
  url: string
  ansicht: { breite: number; hoehe: number; scrollX: number; scrollY: number }
  notiz: string
  marken: Marke[]
  ziel: string | null
  status: 'offen' | 'zugestellt' | 'erledigt'
  erledigt?: { zeit: string; von: string; notiz?: string }
  bild?: string
  /** Bild derselben Ansicht, nachdem der Agent „erledigt“ gemeldet hat (KO-11). */
  nachher?: string
}

export interface Hinweis {
  format: 1
  id: string
  zeit: string
  von: string
  artefakt?: string
  ref?: string
  text: string
  gesehen?: boolean
}

export interface Option {
  id: string
  titel: string
  beschreibung?: string
  bild?: string
}

export interface Frage {
  format: 1
  id: string
  zeit: string
  von: string
  titel: string
  text?: string
  optionen: Option[]
  /** Der fragende Befehl wartet selbst auf die Antwort; dann wird sie nicht zusätzlich zugestellt. */
  wartend?: boolean
  antwort?: { option?: string; text?: string; zeit: string }
}

const dir = (projektPfad: string, was: string) => path.join(projektPfad, '.coop', was)

// --- Rückmeldung ----------------------------------------------------------

function bezugText(b: Bezug): string {
  const teile: string[] = []
  if (b.label) teile.push(b.label)
  if (b.ref && b.ref !== b.label) teile.push(`(${b.ref})`)
  if (b.datei) teile.push(b.zeile ? t('bezug.inDateiZeile', { datei: b.datei, zeile: b.zeile }) : t('bezug.inDatei', { datei: b.datei }))
  if (!b.label && b.inhalt) teile.push(t('bezug.element', { text: kurz(b.inhalt, 140) }))
  if (b.selektor && (!b.ref || b.unsicher)) teile.push(t('bezug.selektor', { selektor: b.selektor }))
  if (b.kontext !== undefined) teile.push(t('bezug.kontext', { kontext: JSON.stringify(b.kontext) }))
  return teile.join(' ') || t('bezug.keiner')
}

/** Der Text, den der Agent liest. Er muss ohne Bild genügen (KO-05). */
export function rueckmeldungAlsText(r: Rueckmeldung, pfade: { json: string; bild?: string }): string {
  const z: string[] = []
  z.push(r.artefakt ? t('rm.kopfArtefakt', { name: nutzer(), titel: r.artefakt.titel, typ: r.artefakt.typ }) : t('rm.kopfAdresse', { name: nutzer(), url: r.url }), '')
  z.push(t('rm.kennung', { id: r.id }))
  if (r.artefakt) z.push(t('rm.artefakt', { id: r.artefakt.id }))
  z.push(t('rm.adresse', { url: r.url }))
  z.push(t('rm.ansicht', { breite: r.ansicht.breite, hoehe: r.ansicht.hoehe, y: r.ansicht.scrollY }))
  if (r.notiz.trim()) z.push('', t('rm.wasSagt', { name: nutzer() }), '', r.notiz.trim())
  if (r.marken.length) {
    z.push('', t('rm.marken'), '', t('rm.markenRegel', { name: nutzer() }), '')
    for (const m of r.marken) {
      z.push(`${m.nr}. ${m.text.trim() || t('rm.ohneText')}`)
      z.push(t('rm.gemeint', { bezug: bezugText(m.bezug) }))
      if (m.bezug.unsicher) z.push(t('rm.geschaetzt'))
    }
  }
  z.push('', t('rm.dateien'), '', t('rm.datensatz', { pfad: pfade.json }))
  if (pfade.bild) z.push(t('rm.bild', { pfad: pfade.bild }))
  z.push('', t('rm.wennErledigt', { id: r.id }))
  return z.join('\n') + '\n'
}

export interface NeueRueckmeldung {
  artefakt?: Rueckmeldung['artefakt']
  url: string
  ansicht: Rueckmeldung['ansicht']
  notiz: string
  marken: Marke[]
  ziel: string | null
  bildPng?: Buffer
}

export function rueckmeldungAnlegen(projektPfad: string, n: NeueRueckmeldung): { r: Rueckmeldung; md: string; json: string; bild?: string } {
  const d = dir(projektPfad, 'rueckmeldungen')
  ensureDir(d)
  let rid = stempel()
  while (fs.existsSync(path.join(d, `${rid}.json`))) rid = `${stempel()}-${id(3)}`
  const json = path.join(d, `${rid}.json`)
  const md = path.join(d, `${rid}.md`)
  const bild = n.bildPng ? path.join(d, `${rid}.png`) : undefined
  const r: Rueckmeldung = {
    format: 1, id: rid, zeit: new Date().toISOString(), artefakt: n.artefakt, url: n.url, ansicht: n.ansicht,
    notiz: n.notiz, marken: n.marken, ziel: n.ziel, status: 'offen', bild: bild ? path.basename(bild) : undefined,
  }
  if (bild && n.bildPng) writeFileAtomic(bild, n.bildPng)
  writeJson(json, r)
  writeFileAtomic(md, rueckmeldungAlsText(r, { json, bild }))
  return { r, md, json, bild }
}

export function rueckmeldungen(projektPfad: string): Rueckmeldung[] {
  return lies<Rueckmeldung>(dir(projektPfad, 'rueckmeldungen'))
}

export function rueckmeldungAendern(projektPfad: string, rid: string, patch: Partial<Rueckmeldung>): Rueckmeldung {
  const f = path.join(dir(projektPfad, 'rueckmeldungen'), `${path.basename(rid)}.json`)
  const r = readJson<Rueckmeldung | null>(f, null)
  if (!r) throw new Error(t('rm.fehlt', { id: rid }))
  Object.assign(r, patch)
  writeJson(f, r)
  return r
}

// --- Hinweis --------------------------------------------------------------

export function hinweisAnlegen(projektPfad: string, h: Omit<Hinweis, 'format' | 'id' | 'zeit'>): Hinweis {
  const d = dir(projektPfad, 'hinweise')
  const hid = `${stempel()}-${id(3)}`
  const voll: Hinweis = { format: 1, id: hid, zeit: new Date().toISOString(), ...h }
  writeJson(path.join(d, `${hid}.json`), voll)
  return voll
}

export function hinweise(projektPfad: string): Hinweis[] {
  return lies<Hinweis>(dir(projektPfad, 'hinweise'))
}

export function hinweisGesehen(projektPfad: string, hid: string): void {
  const f = path.join(dir(projektPfad, 'hinweise'), `${path.basename(hid)}.json`)
  const h = readJson<Hinweis | null>(f, null)
  if (h) writeJson(f, { ...h, gesehen: true })
}

// --- Frage ----------------------------------------------------------------

export function frageAnlegen(projektPfad: string, f: Omit<Frage, 'format' | 'id' | 'zeit'>): { frage: Frage; datei: string } {
  const d = dir(projektPfad, 'fragen')
  const fid = `${stempel()}-${id(3)}`
  const voll: Frage = { format: 1, id: fid, zeit: new Date().toISOString(), ...f }
  const datei = path.join(d, `${fid}.json`)
  writeJson(datei, voll)
  return { frage: voll, datei }
}

export function fragen(projektPfad: string): Frage[] {
  return lies<Frage>(dir(projektPfad, 'fragen'))
}

export function frageDatei(projektPfad: string, fid: string): string {
  return path.join(dir(projektPfad, 'fragen'), `${path.basename(fid)}.json`)
}

export function frageBeantworten(projektPfad: string, fid: string, antwort: { option?: string; text?: string }): Frage {
  const f = frageDatei(projektPfad, fid)
  const frage = readJson<Frage | null>(f, null)
  if (!frage) throw new Error(t('frage.fehlt', { id: fid }))
  frage.antwort = { ...antwort, zeit: new Date().toISOString() }
  writeJson(f, frage)
  return frage
}

export function antwortAlsText(f: Frage): string {
  const o = f.optionen.find((x) => x.id === f.antwort?.option)
  const teile = [t('antwort.von', { name: nutzer(), titel: f.titel })]
  if (o) teile.push(`${o.id} — ${o.titel}.`)
  if (f.antwort?.text) teile.push(f.antwort.text)
  return teile.join(' ')
}

// --- Anfrage: Fotos oder Ton vom Handy (CP-12) ------------------------------

export type AnfrageArt = 'foto' | 'ton' | 'beides'

export interface AnfrageDatei {
  name: string
  /** `video` wird wie Ton behandelt: die Tonspur wird in Text umgesetzt. Am iPhone bietet die Tonauswahl die Videoaufnahme an. */
  art: 'bild' | 'ton' | 'video' | 'datei'
  groesse: number
  /** Name der Datei auf dem Handy; nur zur Anzeige. */
  original?: string
  zeit: string
  /** Ton wird gerade in Text umgesetzt. */
  wartet?: boolean
  text?: string
  fehler?: string
}

export interface Anfrage {
  format: 1
  id: string
  zeit: string
  /** Kennung der Session, die fragt; `handy`, wenn der Mensch von sich aus etwas schickt. */
  von: string
  /** Bei einer Lieferung ohne Anfrage: die Session, an die sie geht. */
  an?: string
  titel: string
  text?: string
  art: AnfrageArt
  status: 'offen' | 'geliefert' | 'erledigt'
  /** Der anfragende Befehl wartet selbst auf die Lieferung. */
  wartend?: boolean
  dateien: AnfrageDatei[]
  notiz?: string
  geliefert?: string
  /** Gesetzt, sobald die Lieferung vollständig ist (aller Ton ist Text); darauf wartet der Befehl. */
  antwort?: { zeit: string }
  /** Was der wartende Befehl ausgibt. */
  ausgabe?: string
  /** Der wartende Befehl hat die Lieferung ausgegeben. */
  abgeholt?: boolean
  /** Lieferung ohne Empfänger: im Eingang des Decks gesehen. */
  gesehen?: boolean
}

/** Endung je Inhaltstyp. Was hier nicht steht, wird als `.bin` abgelegt: der Name vom Handy bestimmt nie die Endung. */
const ENDUNG: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/heif': '.heif', 'image/webp': '.webp', 'image/gif': '.gif',
  'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/m4a': '.m4a', 'audio/mpeg': '.mp3', 'audio/webm': '.webm', 'audio/wav': '.wav',
  'audio/x-wav': '.wav', 'audio/aac': '.aac', 'audio/ogg': '.ogg', 'video/quicktime': '.mov', 'video/mp4': '.mp4', 'application/pdf': '.pdf',
}
const ERLAUBT = new Set(Object.values(ENDUNG))
const TON = new Set(['.m4a', '.mp3', '.webm', '.wav', '.aac', '.ogg'])
const BILD = new Set(['.jpg', '.png', '.heic', '.heif', '.webp', '.gif'])
const VIDEO = new Set(['.mov', '.mp4'])

export function anfrageDatei(projektPfad: string, aid: string): string {
  return path.join(dir(projektPfad, 'anfragen'), `${path.basename(aid)}.json`)
}

/** Ordner, in dem die Dateien einer Anfrage landen: `.coop/ablage/<kennung>/`. */
export function anfrageOrdner(projektPfad: string, aid: string): string {
  return path.join(dir(projektPfad, 'ablage'), path.basename(aid))
}

export function anfrageAnlegen(projektPfad: string, a: Pick<Anfrage, 'von' | 'titel'> & Partial<Pick<Anfrage, 'an' | 'text' | 'art' | 'wartend'>>): { anfrage: Anfrage; datei: string } {
  const aid = `${stempel()}-${id(3)}`
  const voll: Anfrage = { format: 1, id: aid, zeit: new Date().toISOString(), von: a.von, an: a.an, titel: kurz(a.titel.trim(), 160), text: a.text?.trim() || undefined, art: a.art ?? 'foto', status: 'offen', wartend: a.wartend || undefined, dateien: [] }
  ensureDir(dir(projektPfad, 'anfragen'))
  const datei = anfrageDatei(projektPfad, aid)
  writeJson(datei, voll)
  return { anfrage: voll, datei }
}

export function anfragen(projektPfad: string): Anfrage[] {
  return lies<Anfrage>(dir(projektPfad, 'anfragen')).filter((a) => Array.isArray(a.dateien))
}

export function anfrage(projektPfad: string, aid: string): Anfrage | null {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}-[a-f0-9]{3}$/.test(aid)) return null
  const a = readJson<Anfrage | null>(anfrageDatei(projektPfad, aid), null)
  return a && Array.isArray(a.dateien) ? a : null
}

export function anfrageAendern(projektPfad: string, aid: string, fn: (a: Anfrage) => void): Anfrage {
  const a = anfrage(projektPfad, aid)
  if (!a) throw new Error(t('anfrage.fehlt', { id: aid }))
  fn(a)
  writeJson(anfrageDatei(projektPfad, aid), a)
  return a
}

/** Name und Art für eine hochgeladene Datei. Der Name entsteht hier; vom Handy kommt nur der Inhaltstyp und, als Rückfall, die Endung. */
export function anfrageDateiname(a: Anfrage, inhaltstyp: string, original: string, jetzt = new Date()): { name: string; art: AnfrageDatei['art'] } {
  const typ = inhaltstyp.split(';')[0].trim().toLowerCase()
  const vomNamen = path.extname(path.basename(original)).toLowerCase().replace('.jpeg', '.jpg')
  const endung = ENDUNG[typ] ?? (ERLAUBT.has(vomNamen) ? vomNamen : '.bin')
  const p = (n: number) => String(n).padStart(2, '0')
  const nr = a.dateien.reduce((m, d) => Math.max(m, Number(d.name.slice(0, 2)) || 0), 0) + 1
  return { name: `${p(nr)}-${p(jetzt.getHours())}${p(jetzt.getMinutes())}${p(jetzt.getSeconds())}${endung}`, art: TON.has(endung) ? 'ton' : BILD.has(endung) ? 'bild' : VIDEO.has(endung) ? 'video' : 'datei' }
}

/** Was die Session liest: Titel, Notiz, je Datei der Pfad und bei Ton der gesprochene Text. Muss ohne die Dateien verständlich sein (V3). */
export function anfrageAlsText(projektPfad: string, a: Anfrage): string {
  const z = [t(a.von === 'handy' ? 'anfrage.frei' : 'anfrage.geliefert', { name: nutzer(), titel: a.titel, id: a.id })]
  if (a.notiz?.trim()) z.push(t('anfrage.notiz', { notiz: a.notiz.trim() }))
  if (!a.dateien.length) z.push(t('anfrage.keineDateien'))
  for (const d of a.dateien) {
    z.push(`- ${path.join(anfrageOrdner(projektPfad, a.id), d.name)}`)
    if (d.text) z.push(`  ${t('anfrage.gesprochen', { text: d.text })}`)
    if (d.fehler) z.push(`  ${t('anfrage.ohneText', { grund: d.fehler })}`)
  }
  return z.join('\n')
}

function lies<T extends { id: string }>(d: string): T[] {
  let namen: string[] = []
  try { namen = fs.readdirSync(d) } catch { return [] }
  return namen
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => readJson<T | null>(path.join(d, n), null))
    .filter((x): x is T => !!x && typeof x.id === 'string')
}
