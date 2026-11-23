/** Typen der Stufe 2: Review (AT-07) und Übergabe (AT-11). Reine Funktionen über ihren Daten. */

import { t } from '../texte'

export const SCHWERE = ['kritisch', 'hoch', 'mittel', 'niedrig'] as const
export const BEFUND_STATUS = ['offen', 'in-arbeit', 'behoben', 'abgelehnt'] as const

export interface Befund {
  id: string
  titel: string
  schwere: (typeof SCHWERE)[number]
  status: (typeof BEFUND_STATUS)[number]
  fundstelle?: string
  beschreibung?: string
  vorschlag?: string
}

export interface Review {
  format: 1
  titel: string
  gegenstand?: string
  befunde: Befund[]
}

export function reviewNormalisieren(raw: unknown): Review {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Review>
  return {
    format: 1,
    titel: typeof r.titel === 'string' ? r.titel : t('review.titel'),
    gegenstand: typeof r.gegenstand === 'string' ? r.gegenstand : undefined,
    befunde: (Array.isArray(r.befunde) ? r.befunde : []).filter((b) => b && b.id && b.titel).map((b) => ({
      ...b,
      schwere: SCHWERE.includes(b.schwere) ? b.schwere : 'mittel',
      status: BEFUND_STATUS.includes(b.status) ? b.status : 'offen',
    })),
  }
}

/** Fehler in Worten statt einer leeren Seite (AF-04). */
export function reviewPruefen(raw: unknown): string[] {
  const r = raw as Partial<Review>
  if (!r || typeof r !== 'object') return [t('review.keinObjekt')]
  if (!Array.isArray(r.befunde)) return [t('review.befundeFehlen')]
  const f: string[] = []
  const ids = new Set<string>()
  for (const b of r.befunde) {
    if (!b?.id) { f.push(t('review.befundOhneId')); continue }
    if (ids.has(b.id)) f.push(t('pruefen.idDoppelt', { id: b.id }))
    ids.add(b.id)
    if (!b.titel) f.push(t('pruefen.titelFehlt', { id: b.id }))
    if (b.schwere && !SCHWERE.includes(b.schwere)) f.push(t('review.schwereFehlt', { id: b.id, schwere: b.schwere, liste: SCHWERE.join(', ') }))
    if (b.status && !BEFUND_STATUS.includes(b.status)) f.push(t('pruefen.statusFehlt', { id: b.id, status: b.status, liste: BEFUND_STATUS.join(', ') }))
  }
  return f
}

export interface Uebergabe {
  id: string
  zeit: string
  von: string
  stand: string
  offen: string[]
  naechster?: string
}

export interface Uebergaben {
  format: 1
  titel: string
  eintraege: Uebergabe[]
}

export function uebergabenNormalisieren(raw: unknown): Uebergaben {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Uebergaben>
  return {
    format: 1,
    titel: typeof r.titel === 'string' ? r.titel : t('uebergabe.titel'),
    eintraege: (Array.isArray(r.eintraege) ? r.eintraege : []).filter((e) => e && e.id && typeof e.stand === 'string').map((e) => ({ ...e, offen: Array.isArray(e.offen) ? e.offen.map(String) : [] })),
  }
}

export function naechsteUebergabeId(u: Uebergaben): string {
  return `U-${u.eintraege.reduce((m, e) => Math.max(m, Number(/^U-(\d+)$/.exec(e.id)?.[1] ?? 0)), 0) + 1}`
}

export function uebergabeAlsText(e: Uebergabe): string {
  const z = [t('uebergabe.kopf', { id: e.id, datum: e.zeit.slice(0, 10), von: e.von }), '', t('uebergabe.stand', { stand: e.stand })]
  if (e.offen.length) z.push('', t('uebergabe.offen'), ...e.offen.map((o) => `- ${o}`))
  if (e.naechster) z.push('', t('uebergabe.naechster', { text: e.naechster }))
  return z.join('\n')
}
