// Schreibt die Anleitung für GitHub nach docs/anleitung/<sprache>/. Aufruf: npm run anleitung
import fs from 'fs'
import path from 'path'
import { erzeugt } from '../src/core/anleitung'

const wurzel = path.resolve(__dirname, '..', 'docs', 'anleitung')
for (const s of ['de', 'en'] as const) {
  const dir = path.join(wurzel, s)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const dateien = erzeugt(s)
  for (const [name, text] of Object.entries(dateien)) fs.writeFileSync(path.join(dir, name), text)
  console.log(`${s}: ${Object.keys(dateien).length} Dateien`)
}
