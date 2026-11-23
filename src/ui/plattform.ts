/**
 * Was in der Oberfläche vom Betriebssystem abhängt (R-28): die Befehlstaste und der Platz
 * für die Fensterknöpfe. Unter macOS ist die Befehlstaste ⌘. Anderswo ist es Strg zusammen
 * mit Umschalt, weil Strg allein dem Terminal gehört (Strg+K, Strg+D).
 */
import { setzeZuschnitt } from '../texte'

export const MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

if (typeof document !== 'undefined') document.documentElement.dataset.system = MAC ? 'mac' : 'andere'
// Die Texte der Oberfläche nennen die Kürzel in der Schreibweise von macOS; anderswo werden sie beim Lesen umgeschrieben.
if (!MAC) setzeZuschnitt((vorlage) => kuerzel(vorlage, false))

interface Tasten { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }

/**
 * Ist das die Befehlstaste, allein oder mit genau einer Zusatztaste?
 * macOS: ⌘, ⌘⇧, ⌘⌥. Sonst: Strg+Umschalt, Strg+Umschalt (die Zusatztaste Umschalt ist schon dabei), Strg+Alt.
 */
export function befehl(e: Tasten, zusatz: '' | 'umschalt' | 'alt' = '', mac = MAC): boolean {
  if (mac) return e.metaKey && !e.ctrlKey && e.shiftKey === (zusatz === 'umschalt') && e.altKey === (zusatz === 'alt')
  return e.ctrlKey && !e.metaKey && e.shiftKey === (zusatz !== 'alt') && e.altKey === (zusatz === 'alt')
}

/** Beschriftung eines Kürzels für dieses System: aus „⌘⇧D“ wird anderswo „Ctrl+Shift+D“. */
export function kuerzel(text: string, mac = MAC): string {
  if (mac) return text
  return text.replace(/⌘⇧/g, 'Ctrl+Shift+').replace(/⌘⌥/g, 'Ctrl+Alt+').replace(/⌘↵/g, 'Ctrl+Enter').replace(/⌘(?=[\p{L}\p{N}])/gu, 'Ctrl+Shift+').replace(/⌘/g, 'Ctrl+')
}
