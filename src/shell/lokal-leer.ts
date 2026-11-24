/**
 * Platz für eine lokale Erweiterung des Hauptprozesses. Liegt `src/lokal/shell.ts` vor, nimmt der Bau
 * sie statt dieser Datei (`build.mjs`, Alias `@lokal/shell`). So lässt sich etwas ausprobieren, das
 * noch nicht in die veröffentlichte Fassung gehört.
 */
import type { BrowserWindow } from 'electron'
import type { Deck } from '../core/deck'

export interface LokalKontext { fenster: () => BrowserWindow | null; deck: Deck }
export type LokaleMethoden = Record<string, (...args: never[]) => unknown>

export function lokaleMethoden(_k: LokalKontext): LokaleMethoden {
  return {}
}
