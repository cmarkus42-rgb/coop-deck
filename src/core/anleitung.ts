/**
 * Die Anleitung des Decks: Kapitel als Markdown unter `anleitung/<sprache>/`.
 *
 * Namen von Knöpfen und Typen stehen dort als Platzhalter (`{{ui.eingang}}`, `{{typ.roadmap}}`) und werden
 * aus denselben Texten gefüllt, die auch die Oberfläche zeigt. Die Befehlsliste (`{{befehle}}`) ist der
 * Hilfetext von `coop`. So kann die Anleitung einen Knopf nicht anders nennen, als er heißt.
 * Das Deck zeigt die Kapitel unter `/hilfe/`; `scripts/anleitung.ts` schreibt sie für GitHub nach `docs/anleitung/`.
 */
import fs from 'fs'
import path from 'path'
import { APP_ROOT, TYPEN } from './basis'
import { tIn, type Schluessel, type Sprache } from '../texte'

export const ANLEITUNG = path.join(APP_ROOT, 'anleitung')
const PLATZ = /\{\{([a-zA-Z0-9_.-]+)\}\}/g

export interface Kapitel { datei: string; titel: string }

function typName(s: Sprache, typ: string): string | null {
  for (const f of s === 'en' ? ['typ.en.json', 'typ.json'] : ['typ.json']) {
    try { return String((JSON.parse(fs.readFileSync(path.join(TYPEN, path.basename(typ), f), 'utf-8')) as { name?: string }).name ?? '') || null } catch { /* nächste */ }
  }
  return null
}

/** Platzhalter eines Kapitels, in der Reihenfolge des Textes. */
export function platzhalter(text: string): string[] {
  return [...text.matchAll(PLATZ)].map((m) => m[1])
}

export function einsetzen(text: string, s: Sprache): { text: string; fehlend: string[] } {
  const fehlend: string[] = []
  const aus = text.replace(PLATZ, (ganz, k: string) => {
    if (k === 'befehle') return tIn(s, 'befehl.hilfe')
    if (k.startsWith('typ.') && !k.slice(4).includes('.')) {
      const n = typName(s, k.slice(4))
      if (n) return n
    } else {
      const wert = tIn(s, k as Schluessel)
      // Kürzel und Zähler gehören zum Knopf, nicht zu seinem Namen.
      if (wert !== k) return wert.replace(/\s*\(\{n\}\)|\s*[⌘⌥⇧][^\s]*$/g, '').replace(/\s*…$/, '').trim()
    }
    fehlend.push(k)
    return ganz
  })
  return { text: aus, fehlend }
}

export function dateien(s: Sprache): string[] {
  try { return fs.readdirSync(path.join(ANLEITUNG, s)).filter((f) => /^\d\d-[a-z0-9-]+\.md$/.test(f)).sort() } catch { return [] }
}

export function roh(s: Sprache, datei: string): string | null {
  if (!dateien(s).includes(datei)) return null
  return fs.readFileSync(path.join(ANLEITUNG, s, datei), 'utf-8')
}

export function kapitel(s: Sprache): Kapitel[] {
  return dateien(s).map((datei) => ({ datei, titel: /^#\s+(.+)$/m.exec(einsetzen(roh(s, datei) ?? '', s).text)?.[1] ?? datei }))
}

/** Ein Kapitel, fertig zum Anzeigen. */
export function lesen(s: Sprache, datei: string): string | null {
  const text = roh(s, datei)
  return text === null ? null : einsetzen(text, s).text
}

/** Was unter `docs/anleitung/<sprache>/` stehen muss: Kapitel und ein Inhaltsverzeichnis. */
export function erzeugt(s: Sprache): Record<string, string> {
  const aus: Record<string, string> = {}
  const kopf = s === 'de'
    ? '<!-- Erzeugt aus anleitung/de/ mit `npm run anleitung`. Dort ändern, nicht hier. -->\n\n'
    : '<!-- Generated from anleitung/en/ with `npm run anleitung`. Edit there, not here. -->\n\n'
  for (const k of kapitel(s)) aus[k.datei] = kopf + (lesen(s, k.datei) ?? '')
  const titel = s === 'de' ? '# Anleitung zum Coop Deck' : '# Coop Deck guide'
  const satz = s === 'de'
    ? 'Dieselbe Anleitung steht im Deck: Knopf „' + tIn('de', 'ui.hilfe') + '“ oben rechts. [English](../en/README.md)'
    : 'The same guide is built into the deck: button “' + tIn('en', 'ui.hilfe') + '” at the top right. [Deutsch](../de/README.md)'
  aus['README.md'] = `${kopf}${titel}\n\n${satz}\n\n${kapitel(s).map((k) => `- [${k.titel}](${k.datei})`).join('\n')}\n`
  return aus
}
