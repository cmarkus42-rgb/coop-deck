const ENDUNGEN = 'md|html?|png|jpe?g|svg|pdf|json|txt|gif|webp'

/**
 * Dateipfade in einer Terminalzeile. Allgemein endet ein Pfad am Leerzeichen; Pfade im
 * Projektverzeichnis dürfen welche enthalten („AI Coop Cockpit“) und reichen bis zur Endung.
 */
export function pfadeIn(text: string, projekt: string): { start: number; text: string }[] {
  const treffer: { start: number; text: string }[] = []
  if (projekt) {
    const esc = projekt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const m of text.matchAll(new RegExp(`${esc}/[^'"\`\\n]*?\\.(?:${ENDUNGEN})(?![\\w])`, 'gi'))) treffer.push({ start: m.index!, text: m[0] })
  }
  for (const m of text.matchAll(new RegExp(`(?:^|[\\s'"(\`])(\\/[^\\s'"\`()]+\\.(?:${ENDUNGEN}))`, 'gi'))) {
    const start = m.index! + m[0].indexOf(m[1])
    if (!treffer.some((t) => start >= t.start && start < t.start + t.text.length)) treffer.push({ start, text: m[1] })
  }
  return treffer
}
