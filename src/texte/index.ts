/**
 * Alle Texte des Decks an einer Stelle (UI-09). Je Bereich eine Datei mit `de` und `en`
 * nebeneinander; `en` muss dieselben Schlüssel tragen, sonst scheitert die Typprüfung.
 *
 * Texte sind Vorlagen mit Platzhaltern in geschweiften Klammern: `t('x.gruss', { name })`.
 * Keine Funktionen, damit dieselben Texte auch als JSON an die Typseiten gehen.
 * Mehrzahl: zwei Schlüssel (`….eins`, `….viele`), gewählt beim Aufruf.
 *
 * Nicht übersetzt wird, was Kennung ist: Befehle und Schalter von `coop`, Feldnamen und
 * Statuswerte in den Datendateien, Bezüge (`roadmap:R-1`). Sie sind in beiden Sprachen gleich.
 *
 * Dieses Modul bleibt frei von Node und Electron: es läuft im Kern, in der Oberfläche und im Befehl `coop`.
 */
import * as kern from './kern'
import * as ui from './ui'
import * as typen from './typen'
import * as mobil from './mobil'

export type Sprache = 'de' | 'en'
export const SPRACHEN: Record<Sprache, string> = { de: 'Deutsch', en: 'English' }

const TEXTE = {
  de: { ...kern.de, ...ui.de, ...typen.de, ...mobil.de },
  en: { ...kern.en, ...ui.en, ...typen.en, ...mobil.en },
}

export type Schluessel = keyof typeof TEXTE.de
export type Werte = Record<string, string | number | undefined | null>

let aktuell: Sprache = 'de'

export function istSprache(s: unknown): s is Sprache {
  return s === 'de' || s === 'en'
}

export function setzeSprache(s: unknown): Sprache {
  if (istSprache(s)) aktuell = s
  return aktuell
}

export function sprache(): Sprache {
  return aktuell
}

/** Gebietsangabe für Datum und Uhrzeit. */
export function gebiet(): string {
  return aktuell === 'de' ? 'de-DE' : 'en-GB'
}

export function fuelle(vorlage: string, werte?: Werte): string {
  return werte ? vorlage.replace(/\{(\w+)\}/g, (ganz, name: string) => (name in werte ? String(werte[name] ?? '') : ganz)) : vorlage
}

let zuschnitt: ((vorlage: string) => string) | null = null

/**
 * Passt jede Vorlage an, bevor Werte eingesetzt werden. Die Oberfläche schreibt damit die
 * Tastenkürzel für das System um (R-28): die Texte nennen ⌘, außerhalb von macOS steht dort Ctrl+Shift.
 */
export function setzeZuschnitt(fn: ((vorlage: string) => string) | null): void {
  zuschnitt = fn
}

export function t(k: Schluessel, werte?: Werte): string {
  const vorlage = TEXTE[aktuell][k] ?? TEXTE.de[k] ?? k
  return fuelle(zuschnitt ? zuschnitt(vorlage) : vorlage, werte)
}

/** Text in einer bestimmten Sprache, unabhängig von der gewählten. */
export function tIn(s: Sprache, k: Schluessel, werte?: Werte): string {
  return fuelle(TEXTE[s][k] ?? TEXTE.de[k] ?? k, werte)
}

/** Was die Typseiten brauchen: ihre Texte in der gewählten Sprache (Schlüssel `typ.…`). */
export function typTexte(): Record<string, string> {
  return typen[aktuell]
}

/** Was die Seite fürs Handy braucht: ihre Texte in der gewählten Sprache (Schlüssel `handy.…`). */
export function mobilTexte(): Record<string, string> {
  return mobil[aktuell]
}

/** Sprache aus einer Gebietsangabe wie `de_DE.UTF-8` oder `en-US`: Deutsch, wenn sie so beginnt, sonst Englisch. */
export function spracheAusGebiet(g: string | undefined | null): Sprache | null {
  if (!g || /^(c|posix)(\.|$)/i.test(g)) return null
  return /^de([_-]|$)/i.test(g) ? 'de' : 'en'
}
