/** Roadmap-Daten: JSON mit festen Kennungen je Punkt (E5). Reine Funktionen, gut testbar. */

import { t, type Schluessel } from '../texte'

export type Status = 'offen' | 'in-arbeit' | 'pruefen' | 'erledigt' | 'verworfen'
export const STATUS: Status[] = ['offen', 'in-arbeit', 'pruefen', 'erledigt', 'verworfen']

export interface Notiz {
  zeit: string
  von: string
  text: string
}

export interface Punkt {
  id: string
  titel: string
  beschreibung?: string
  meilenstein?: string
  status: Status
  abnahme?: string[]
  abhaengig?: string[]
  dateien?: string[]
  artefakte?: string[]
  notizen?: Notiz[]
  /** Vorschlag des Agenten, den der Mensch bestätigt (RM-05). */
  vorschlag?: { status: Status; notiz?: string; von: string; zeit: string }
}

export interface Meilenstein {
  id: string
  titel: string
  ziel?: string
}

export interface Roadmap {
  format: 1
  titel: string
  meilensteine: Meilenstein[]
  punkte: Punkt[]
}

export function normalisieren(raw: unknown): Roadmap {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Roadmap>
  return {
    format: 1,
    titel: typeof r.titel === 'string' ? r.titel : t('roadmap.titel'),
    meilensteine: Array.isArray(r.meilensteine) ? r.meilensteine.filter((m) => m && m.id) : [],
    punkte: Array.isArray(r.punkte)
      ? r.punkte.filter((p) => p && p.id && p.titel).map((p) => ({
        ...p,
        status: STATUS.includes(p.status) ? p.status : 'offen',
        // Ein Vorschlag mit unbekanntem Status ist keiner: sein Text käme sonst bis in eine Session.
        vorschlag: p.vorschlag && STATUS.includes(p.vorschlag.status) ? p.vorschlag : undefined,
      }))
      : [],
  }
}

/** Prüft, was ein Agent geschrieben hat; Fehler in Worten statt einer leeren Seite (AF-04). */
export function pruefen(raw: unknown): string[] {
  const f: string[] = []
  const r = raw as Partial<Roadmap>
  if (!r || typeof r !== 'object') return [t('roadmap.keinObjekt')]
  if (!Array.isArray(r.punkte)) f.push(t('roadmap.punkteFehlen'))
  if (r.meilensteine !== undefined && !Array.isArray(r.meilensteine)) f.push(t('roadmap.meilensteineKeineListe'))
  const ids = new Set<string>()
  const ms = new Set((Array.isArray(r.meilensteine) ? r.meilensteine : []).map((m) => m?.id))
  for (const p of Array.isArray(r.punkte) ? r.punkte : []) {
    if (!p?.id) { f.push(t('roadmap.punktOhneId')); continue }
    if (ids.has(p.id)) f.push(t('pruefen.idDoppelt', { id: p.id }))
    ids.add(p.id)
    if (!p.titel) f.push(t('pruefen.titelFehlt', { id: p.id }))
    if (p.status && !STATUS.includes(p.status)) f.push(t('pruefen.statusFehlt', { id: p.id, status: p.status, liste: STATUS.join(', ') }))
    if (p.vorschlag && !STATUS.includes(p.vorschlag.status)) f.push(t('roadmap.vorschlagStatusFehlt', { id: p.id, liste: STATUS.join(', ') }))
    if (p.meilenstein && !ms.has(p.meilenstein)) f.push(t('roadmap.meilensteinFehlt', { id: p.id, meilenstein: p.meilenstein }))
  }
  for (const p of Array.isArray(r.punkte) ? r.punkte : []) {
    for (const a of p?.abhaengig ?? []) if (!ids.has(a)) f.push(t('roadmap.abhaengigFehlt', { id: p.id, von: a }))
  }
  return f
}

export function naechsteId(r: Roadmap): string {
  const max = r.punkte.reduce((m, p) => Math.max(m, Number(/^R-(\d+)$/.exec(p.id)?.[1] ?? 0)), 0)
  return `R-${max + 1}`
}

export function punkt(r: Roadmap, pid: string): Punkt | undefined {
  return r.punkte.find((p) => p.id.toLowerCase() === pid.toLowerCase())
}

/**
 * Statuswechsel. „erledigt“ aus der Hand eines Agenten wird ein Vorschlag;
 * alles andere gilt sofort.
 */
export function setzeStatus(r: Roadmap, pid: string, status: Status, von: string, notiz?: string, agent = true): Punkt {
  const p = punkt(r, pid)
  if (!p) throw new Error(t('roadmap.punktFehlt', { id: pid }))
  if (!STATUS.includes(status)) throw new Error(t('roadmap.statusFehlt', { status, liste: STATUS.join(', ') }))
  const zeit = new Date().toISOString()
  if (agent && status === 'erledigt') {
    p.vorschlag = { status, notiz, von, zeit }
    if (p.status === 'offen' || p.status === 'in-arbeit') p.status = 'pruefen'
  } else {
    p.status = status
    delete p.vorschlag
  }
  if (notiz) (p.notizen ??= []).push({ zeit, von, text: notiz })
  return p
}

/** Lage eines Punkts für das Briefing (RM-02). */
export function lage(r: Roadmap, p: Punkt): { meilenstein?: Meilenstein; davor: Punkt[]; danach: Punkt[]; braucht: Punkt[]; wirdGebrauchtVon: Punkt[] } {
  const imMs = r.punkte.filter((x) => (x.meilenstein ?? '') === (p.meilenstein ?? ''))
  const i = imMs.indexOf(p)
  return {
    meilenstein: r.meilensteine.find((m) => m.id === p.meilenstein),
    davor: imMs.slice(Math.max(0, i - 2), i),
    danach: imMs.slice(i + 1, i + 3),
    braucht: (p.abhaengig ?? []).map((a) => punkt(r, a)).filter((x): x is Punkt => !!x),
    wirdGebrauchtVon: r.punkte.filter((x) => (x.abhaengig ?? []).includes(p.id)),
  }
}

export function alsText(r: Roadmap): string {
  const z: string[] = [`# ${r.titel}`]
  const gruppen: (Meilenstein | null)[] = [...r.meilensteine, null]
  for (const m of gruppen) {
    const ps = r.punkte.filter((p) => (m ? p.meilenstein === m.id : !r.meilensteine.some((x) => x.id === p.meilenstein)))
    if (!ps.length) continue
    z.push('', m ? `## ${m.titel}${m.ziel ? ` — ${m.ziel}` : ''}` : t('roadmap.ohneMeilenstein'))
    for (const p of ps) z.push(`- ${p.id} [${p.status}] ${p.titel}${p.vorschlag ? t('roadmap.vorschlag', { status: p.vorschlag.status }) : ''}`)
  }
  return z.join('\n')
}

export function punktAlsText(r: Roadmap, p: Punkt): string {
  const l = lage(r, p)
  const z: string[] = [`${p.id} — ${p.titel}`, t('roadmap.status', { status: p.status })]
  if (l.meilenstein) z.push(`${t('roadmap.meilenstein', { titel: l.meilenstein.titel })}${l.meilenstein.ziel ? ` (${l.meilenstein.ziel})` : ''}`)
  if (p.beschreibung) z.push('', p.beschreibung)
  if (p.abnahme?.length) z.push('', t('roadmap.abnahme'), ...p.abnahme.map((a) => `- ${a}`))
  if (l.braucht.length) z.push('', t('roadmap.haengtAb'), ...l.braucht.map((x) => `- ${x.id} [${x.status}] ${x.titel}`))
  if (l.wirdGebrauchtVon.length) z.push('', t('roadmap.wirdGebraucht'), ...l.wirdGebrauchtVon.map((x) => `- ${x.id} [${x.status}] ${x.titel}`))
  if (l.davor.length) z.push('', t('roadmap.davor'), ...l.davor.map((x) => `- ${x.id} [${x.status}] ${x.titel}`))
  if (l.danach.length) z.push('', t('roadmap.danach'), ...l.danach.map((x) => `- ${x.id} [${x.status}] ${x.titel}`))
  if (p.dateien?.length) z.push('', t('roadmap.dateien'), ...p.dateien.map((d) => `- ${d}`))
  if (p.notizen?.length) z.push('', t('roadmap.notizen'), ...p.notizen.slice(-5).map((n) => `- ${n.zeit.slice(0, 10)} ${n.von}: ${n.text}`))
  return z.join('\n')
}

// --- Was der Mensch im Betrachter geändert hat (AF-09) ----------------------

/** Änderung an einem Punkt, in festen Begriffen: der getippte Text selbst steht nie darin (V10). */
export interface Aenderung {
  status?: [Status, Status]
  vorschlag?: { status: Status; bestaetigt: boolean }
  felder: string[]
  neu?: boolean
  entfernt?: boolean
}

const FELDER: [keyof Punkt, Schluessel][] = [
  ['titel', 'feld.titel'], ['beschreibung', 'feld.beschreibung'], ['abnahme', 'feld.abnahme'],
  ['meilenstein', 'feld.meilenstein'], ['abhaengig', 'feld.abhaengig'], ['dateien', 'feld.dateien'],
]

const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Kennungen, die in eine Session getippt werden dürfen. */
export const kennungOk = (id: string) => /^[A-Za-z0-9._-]{1,24}$/.test(id)

export function unterschied(alt: Roadmap, neu: Roadmap): Map<string, Aenderung> {
  const out = new Map<string, Aenderung>()
  const vorher = new Map(alt.punkte.map((p) => [p.id, p]))
  for (const n of neu.punkte) {
    const a = vorher.get(n.id)
    vorher.delete(n.id)
    if (!a) { out.set(n.id, { felder: [], neu: true }); continue }
    const ae: Aenderung = { felder: FELDER.filter(([k]) => !gleich(a[k], n[k])).map(([, name]) => t(name)) }
    if ((n.notizen?.length ?? 0) > (a.notizen?.length ?? 0)) ae.felder.push(t('feld.neueNotiz'))
    if (a.vorschlag && STATUS.includes(a.vorschlag.status) && !n.vorschlag) ae.vorschlag = { status: a.vorschlag.status, bestaetigt: n.status === a.vorschlag.status }
    if (a.status !== n.status && !ae.vorschlag?.bestaetigt) ae.status = [a.status, n.status]
    if (ae.status || ae.vorschlag || ae.felder.length) out.set(n.id, ae)
  }
  for (const id of vorher.keys()) out.set(id, { felder: [], entfernt: true })
  return out
}

/** Spätere Änderung auf eine frühere legen: hin und zurück beim Status hebt sich auf. */
export function zusammenlegen(a: Aenderung | undefined, b: Aenderung): Aenderung | null {
  if (!a) return b
  const status: [Status, Status] | undefined = a.status && b.status ? [a.status[0], b.status[1]] : a.status ?? b.status
  const m: Aenderung = {
    felder: [...new Set([...a.felder, ...b.felder])],
    vorschlag: b.vorschlag ?? a.vorschlag,
    status: status && status[0] !== status[1] ? status : undefined,
    neu: a.neu, entfernt: b.entfernt,
  }
  return m.status || m.vorschlag || m.felder.length || m.neu || m.entfernt ? m : null
}

/** Nur Kennungen, feste Feldnamen und Statuswerte aus der Liste: nichts davon ist frei getippter Text. */
export function aenderungAlsText(id: string, ae: Aenderung): string {
  const ok = (s: Status) => (STATUS.includes(s) ? s : t('aenderung.unbekannt'))
  if (ae.entfernt) return t('aenderung.entfernt', { id })
  const teile: string[] = []
  if (ae.neu) teile.push(t('aenderung.neu'))
  if (ae.vorschlag) teile.push(t(ae.vorschlag.bestaetigt ? 'aenderung.vorschlagBestaetigt' : 'aenderung.vorschlagNicht', { status: ok(ae.vorschlag.status) }))
  if (ae.status) teile.push(t('aenderung.status', { von: ok(ae.status[0]), nach: ok(ae.status[1]) }))
  if (ae.felder.length) teile.push(t('aenderung.geaendert', { felder: ae.felder.join(', ') }))
  return `${id}: ${teile.join('; ')}`
}
