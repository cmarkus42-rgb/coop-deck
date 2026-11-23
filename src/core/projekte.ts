/** Project-Spaces und ihre Artefakte. Das Deck verweist auf Verzeichnisse, es kopiert nichts (PS-01). */
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { Ablage, HOME, TYPEN, ensureDir, readJson, writeJson, writeFileAtomic, innerhalb, nutzer } from './basis'
import { t, sprache, gebiet } from '../texte'

export type CliId = 'claude' | 'codex' | 'opencode' | 'pi'

export interface Projekt {
  id: string
  pfad: string
  name: string
  favorit: boolean
  /** Aus der Projektleiste genommen; das Projekt bleibt bekannt und lässt sich wieder einblenden. */
  ausgeblendet: boolean
  zuletzt: number
  cli: CliId
  /** Beim Öffnen: neue Session, letzte fortsetzen oder nichts tun (PS-04). */
  autostart: 'neu' | 'fortsetzen' | 'nein'
  hatCoop: boolean
}

export interface Dienst {
  name: string
  start: string
  url: string
}

export interface ProjektDatei {
  format: 1
  name?: string
  dienste: Dienst[]
}

export type ArtefaktTyp = 'roadmap' | 'projektblatt' | 'fragebogen' | 'variantenwahl' | 'dokument' | 'web' | 'frei' | 'review' | 'uebergabe'

export interface Artefakt {
  format: 1
  id: string
  titel: string
  typ: ArtefaktTyp
  typVersion: number
  /** Datendatei im Artefaktordner (typisierte Artefakte). */
  daten?: string
  /** Quelldatei relativ zum Projekt (Dokument, Projektblatt). */
  quelle?: string
  /** Adresse (Web-Vorschau, Dienst). */
  url?: string
  /** Einstiegsdatei im Artefaktordner (freies HTML). */
  einstieg?: string
  erstellt: string
}

/** Startsatz für ein neues Projekt (PS-09, AF-12): welche Artefakte es von Anfang an hat. */
export interface Vorlage {
  id: string
  name: string
  zweck: string
  /** Vorgabe für „git anlegen“. */
  git: boolean
  artefakte: { typ: ArtefaktTyp; titel: string; quelle?: string; text?: string; daten?: Record<string, unknown> }[]
}

interface Register {
  wurzeln: string[]
  projekte: Record<string, { pfad: string; name?: string; favorit?: boolean; ausgeblendet?: boolean; zuletzt?: number; cli?: CliId; autostart?: Projekt['autostart'] }>
  dienstFreigaben: Record<string, true>
}

const MARKER = ['CLAUDE.md', 'AGENTS.md', '.git', '.coop', 'package.json']
const UEBERSPRINGEN = /^(node_modules|dist|out|build|\..*|.*worktrees.*|_wt|backups?|backup-logs)$/i

export function projektId(pfad: string): string {
  return crypto.createHash('sha1').update(path.resolve(pfad)).digest('hex').slice(0, 10)
}

export const coopDir = (p: { pfad: string }) => path.join(p.pfad, '.coop')

/**
 * Datei der Typbibliothek in der gewählten Sprache (UI-09). Deutsch ist die Grundfassung;
 * eine andere Sprache liegt daneben mit dem Kürzel vor der Endung (`AGENT.en.md`,
 * `vorlage.en.json`). Fehlt sie, gilt die deutsche.
 */
export function sprachDatei(datei: string): string {
  if (sprache() === 'de') return datei
  const e = path.extname(datei)
  const andere = `${datei.slice(0, datei.length - e.length)}.${sprache()}${e}`
  return fs.existsSync(andere) ? andere : datei
}

export class Projekte {
  private reg: Ablage<Register>

  constructor() {
    this.reg = new Ablage<Register>(path.join(HOME, 'projekte.json'), 1, () => ({
      // Keine Vorgabe: wo Projekte liegen, sagt man dem Deck in den Einstellungen oder über „Verzeichnis hinzufügen“.
      wurzeln: [],
      projekte: {},
      dienstFreigaben: {},
    }))
  }

  get fehler(): string | null {
    return this.reg.fehler
  }

  wurzeln(): string[] {
    return this.reg.get().wurzeln
  }

  setWurzeln(w: string[]): void {
    this.reg.get().wurzeln = w.map((x) => x.replace(/^~/, os.homedir())).filter(Boolean)
    this.reg.save()
  }

  /** Verzeichnisse mit Markerdatei direkt unter den Wurzeln (PS-05). */
  suchen(): void {
    const r = this.reg.get()
    for (const wurzel of r.wurzeln) {
      let eintraege: fs.Dirent[] = []
      try { eintraege = fs.readdirSync(wurzel, { withFileTypes: true }) } catch { continue }
      for (const e of eintraege) {
        if (!e.isDirectory() || UEBERSPRINGEN.test(e.name)) continue
        const pfad = path.join(wurzel, e.name)
        if (r.wurzeln.includes(pfad)) continue
        if (!MARKER.some((m) => fs.existsSync(path.join(pfad, m)))) continue
        const pid = projektId(pfad)
        if (!r.projekte[pid]) r.projekte[pid] = { pfad }
      }
    }
    this.reg.save()
  }

  hinzufuegen(pfad: string): Projekt | null {
    const abs = path.resolve(pfad.replace(/^~/, os.homedir()))
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return null
    const pid = projektId(abs)
    const r = this.reg.get()
    if (!r.projekte[pid]) r.projekte[pid] = { pfad: abs }
    this.reg.save()
    return this.get(pid)
  }

  liste(): Projekt[] {
    const r = this.reg.get()
    return Object.keys(r.projekte)
      .map((pid) => this.get(pid))
      .filter((p): p is Projekt => !!p)
      // Zuletzt benutzt zuerst. Favoriten stehen nicht vorn: sie sind ein Filter der Oberfläche.
      .sort((a, b) => b.zuletzt - a.zuletzt || a.name.localeCompare(b.name, gebiet()))
  }

  get(pid: string): Projekt | null {
    const e = this.reg.get().projekte[pid]
    if (!e || !fs.existsSync(e.pfad)) return null
    const datei = readJson<Partial<ProjektDatei>>(path.join(e.pfad, '.coop', 'project.json'), {})
    return {
      id: pid,
      pfad: e.pfad,
      name: datei.name || e.name || path.basename(e.pfad),
      favorit: e.favorit ?? false,
      ausgeblendet: e.ausgeblendet ?? false,
      zuletzt: e.zuletzt ?? 0,
      cli: e.cli ?? 'claude',
      autostart: e.autostart ?? 'nein',
      hatCoop: fs.existsSync(path.join(e.pfad, '.coop')),
    }
  }

  aendern(pid: string, patch: Partial<Pick<Projekt, 'favorit' | 'ausgeblendet' | 'zuletzt' | 'cli' | 'autostart'>>): void {
    const e = this.reg.get().projekte[pid]
    if (!e) return
    Object.assign(e, patch)
    this.reg.save()
  }

  // --- .coop/project.json -------------------------------------------------

  datei(p: Projekt): ProjektDatei {
    const d = readJson<Partial<ProjektDatei>>(path.join(coopDir(p), 'project.json'), {})
    return { format: 1, name: d.name, dienste: Array.isArray(d.dienste) ? d.dienste : [] }
  }

  dateiSchreiben(p: Projekt, d: ProjektDatei): void {
    writeJson(path.join(coopDir(p), 'project.json'), d)
  }

  /** Ein Startbefehl läuft erst nach einmaliger Bestätigung (SI-07). */
  dienstFreigegeben(p: Projekt, d: Dienst): boolean {
    return !!this.reg.get().dienstFreigaben[dienstSchluessel(p, d)]
  }

  dienstFreigeben(p: Projekt, d: Dienst): void {
    this.reg.get().dienstFreigaben[dienstSchluessel(p, d)] = true
    this.reg.save()
  }

  // --- Artefakte ----------------------------------------------------------

  artefakte(p: Projekt): Artefakt[] {
    const dir = path.join(coopDir(p), 'artefakte')
    let namen: string[] = []
    try { namen = fs.readdirSync(dir) } catch { return [] }
    const out: Artefakt[] = []
    for (const n of namen) {
      const a = readJson<Artefakt | null>(path.join(dir, n, 'artefakt.json'), null)
      if (a && a.id && a.typ) out.push({ ...a, id: n })
    }
    return out.sort((a, b) => a.titel.localeCompare(b.titel, gebiet()))
  }

  artefakt(p: Projekt, aid: string): Artefakt | null {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(aid)) return null
    const a = readJson<Artefakt | null>(path.join(coopDir(p), 'artefakte', aid, 'artefakt.json'), null)
    return a ? { ...a, id: aid } : null
  }

  artefaktDir(p: Projekt, aid: string): string {
    return path.join(coopDir(p), 'artefakte', aid)
  }

  /** Pfad der Daten eines Artefakts: Datendatei im Ordner oder Quelldatei im Projekt. */
  datenPfad(p: Projekt, a: Artefakt): string | null {
    if (a.quelle) return innerhalb(p.pfad, a.quelle)
    if (a.daten) return innerhalb(this.artefaktDir(p, a.id), a.daten)
    return null
  }

  neuesArtefakt(p: Projekt, o: { typ: ArtefaktTyp; titel: string; quelle?: string; url?: string; id?: string }): Artefakt {
    const basis = (o.id || o.titel).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || o.typ
    let aid = basis
    for (let i = 2; fs.existsSync(this.artefaktDir(p, aid)); i++) aid = `${basis}-${i}`
    const dir = this.artefaktDir(p, aid)
    ensureDir(dir)
    const a: Artefakt = { format: 1, id: aid, titel: o.titel, typ: o.typ, typVersion: 1, erstellt: new Date().toISOString() }
    if (o.typ === 'web') {
      a.url = o.url || 'http://127.0.0.1:3000'
    } else if (o.typ === 'frei') {
      a.einstieg = 'index.html'
      writeFileAtomic(path.join(dir, 'index.html'), `<!doctype html>\n<html lang="${sprache()}"><meta charset="utf-8"><title>${o.titel}</title>\n<link rel="stylesheet" href="/lib/basis.css">\n<body><main class="blatt"><h1>${o.titel}</h1><p>${t('frei.vorlage')}</p></main>\n<script src="/lib/coop.js"></script></body></html>\n`)
    } else if (o.typ === 'dokument' || o.typ === 'projektblatt') {
      a.quelle = o.quelle || (o.typ === 'projektblatt' ? 'PROJEKT.md' : `.coop/artefakte/${aid}/dokument.md`)
      const ziel = innerhalb(p.pfad, a.quelle)
      if (ziel && !fs.existsSync(ziel)) {
        const vorlage = sprachDatei(path.join(TYPEN, o.typ, 'vorlage.md'))
        const text = fs.existsSync(vorlage) ? fs.readFileSync(vorlage, 'utf-8').replace(/\{\{titel\}\}/g, o.titel) : `# ${o.titel}\n`
        writeFileAtomic(ziel, text)
      }
    } else {
      a.daten = 'daten.json'
      const vorlage = readJson<Record<string, unknown>>(sprachDatei(path.join(TYPEN, o.typ, 'vorlage.json')), {})
      writeJson(path.join(dir, 'daten.json'), { ...vorlage, titel: o.titel })
    }
    writeJson(path.join(dir, 'artefakt.json'), a)
    return a
  }

  /** Typen, die die Bibliothek anbietet (AF-03): jeder Ordner unter `typen/` mit `typ.json`. */
  typen(): { id: string; name: string; zweck: string }[] {
    let namen: string[] = []
    try { namen = fs.readdirSync(TYPEN) } catch { return [] }
    return namen
      .map((n) => ({ n, typ: readJson<{ name?: string; zweck?: string } | null>(sprachDatei(path.join(TYPEN, n, 'typ.json')), null) }))
      .filter((x) => x.typ)
      .map((x) => ({ id: x.n, name: x.typ!.name || x.n, zweck: x.typ!.zweck || '' }))
  }

  /** Projektvorlagen liegen als JSON neben den Typen und lassen sich dort ergänzen. */
  vorlagen(): Vorlage[] {
    const dir = path.join(TYPEN, '_vorlagen')
    let namen: string[] = []
    try { namen = fs.readdirSync(dir) } catch { return [] }
    return namen.filter((n) => /^[^.]+\.json$/.test(n)).sort()
      .map((n) => ({ n, v: readJson<Partial<Vorlage> | null>(sprachDatei(path.join(dir, n)), null) }))
      .filter((x) => x.v && Array.isArray(x.v.artefakte))
      .map((x) => ({ id: x.n.replace(/\.json$/, ''), name: x.v!.name || x.n, zweck: x.v!.zweck || '', git: !!x.v!.git, artefakte: x.v!.artefakte! }))
  }

  /** Kurzanleitung eines Typs für Agenten (AF-14). */
  anleitung(typ: string): string {
    try { return fs.readFileSync(sprachDatei(path.join(TYPEN, typ, 'AGENT.md')), 'utf-8').trim().replace(/\{\{name\}\}/g, nutzer()) } catch { return '' }
  }
}

function dienstSchluessel(p: Projekt, d: Dienst): string {
  return crypto.createHash('sha1').update(`${p.pfad}\n${d.start}`).digest('hex')
}
