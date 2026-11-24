#!/usr/bin/env node
/**
 * Frischer Export für die Veröffentlichung (R-23): der Quelltext ohne Verlauf und ohne
 * Arbeitsunterlagen. Legt nur einen Ordner an; ein Repository daraus zu machen und es
 * irgendwohin zu schieben, bleibt ein eigener Schritt von Hand.
 *
 *   node scripts/export.mjs <zielordner>
 *
 * Danach durchsucht das Skript den Export nach Persönlichem: Benutzername und
 * Heimatverzeichnis dieser Maschine, dazu jede Zeile aus `.export-sperrliste`
 * (liegt nur lokal, eine Wendung je Zeile; zwei Zeichen zählen nur als ganzes Wort). Findet es etwas, endet es mit Fehler.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ziel = process.argv[2] ? path.resolve(process.argv[2]) : ''
if (!ziel) { console.error('Wohin? node scripts/export.mjs <zielordner>'); process.exit(2) }
if (fs.existsSync(ziel) && fs.readdirSync(ziel).length) { console.error(`${ziel} ist nicht leer. Der Export schreibt nur in einen neuen oder leeren Ordner.`); process.exit(2) }

/** Arbeitsunterlagen bleiben im lokalen Repository. */
const INTERN = [/^\.coop\//, /^Anforderungskatalog\.md$/, /^PROJEKT\.md$/, /^\.export-sperrliste$/,
  // Lokale Erweiterung (siehe src/shell/lokal-leer.ts): ausprobiert, aber noch nicht veröffentlicht.
  /^src\/lokal\//, /^test\/lokal/]

const dateien = execFileSync('git', ['ls-files', '-z'], { cwd: wurzel, encoding: 'utf-8' }).split('\0').filter(Boolean)
  .filter((f) => !INTERN.some((r) => r.test(f)))
for (const f of dateien) {
  const nach = path.join(ziel, f)
  fs.mkdirSync(path.dirname(nach), { recursive: true })
  fs.copyFileSync(path.join(wurzel, f), nach)
}

const sperrliste = path.join(wurzel, '.export-sperrliste')
const wendungen = [os.userInfo().username, os.homedir(), os.hostname().split('.')[0],
  ...(fs.existsSync(sperrliste) ? fs.readFileSync(sperrliste, 'utf-8').split('\n') : [])]
  .map((w) => w.trim()).filter((w) => w.length >= 2 && !w.startsWith('#'))
// Sehr kurze Wendungen (zwei Zeichen, etwa ein Gerätename) zählen nur als ganzes Wort, sonst träfen sie überall.
const trifft = (zeile, w) => (w.length < 3 ? new RegExp(`(^|[^a-z0-9])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(zeile) : zeile.includes(w.toLowerCase()))

const funde = []
for (const f of dateien) {
  const roh = fs.readFileSync(path.join(ziel, f))
  if (roh.includes(0)) continue // Bild, Schrift, Symbol
  // Urheberangaben sind gewollt: Lizenz, Herkunftsvermerk, Autor im Paket, Name des Projekts, aus dem der Parser stammt.
  if (f === 'LICENSE' || f === 'NOTICE') continue
  roh.toString('utf-8').split('\n').forEach((zeile, i) => {
    if (f === 'package.json' && /^\s*"author":/.test(zeile)) return
    const klein = zeile.toLowerCase().replace(/cipher-mux[\w-]*/g, '')
    for (const w of wendungen) if (trifft(klein, w)) funde.push(`${f}:${i + 1}: „${w}“ in: ${zeile.trim().slice(0, 120)}`)
  })
}

console.log(`${dateien.length} Dateien nach ${ziel} kopiert, geprüft auf ${wendungen.length} Wendungen.`)
if (funde.length) {
  console.error(`\n${funde.length} Fundstellen mit Persönlichem. Erst bereinigen, dann veröffentlichen:\n`)
  for (const f of funde) console.error(`  ${f}`)
  process.exit(1)
}
console.log('Nichts Persönliches gefunden. Was die Sperrliste nicht kennt, findet das Skript nicht.')
