/**
 * Der Kern des Coop Deck: Projekte, Sessions, Artefakte, Protokoll, Dienste.
 * Ohne Electron lauffähig; die Oberfläche hängt sich über Ereignisse und Methoden an (NF-09).
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { EventEmitter } from 'events'
import { spawn, execFileSync, type ChildProcess } from 'child_process'
import { Ablage, HOME, RUNS, TYPEN, nutzer, setzeNutzer, sprachVorgabe, ensureDir, readJson, writeFileAtomic, writeJson, innerhalb, enhancedPath, kurz } from './basis'
import { Projekte, coopDir, sprachDatei, type Projekt, type Artefakt, type ArtefaktTyp, type CliId, type Dienst } from './projekte'
import { Sitzungen, ADAPTER, verfuegbareClis, type Sitzung } from './sitzungen'
import * as rm from './roadmap'
import * as pk from './protokoll'
import * as wt from './weitere'
import { erkennenDatei, type SprachEinstellung } from './sprache'
import { anmeldeShell } from './plattform'
import * as tg from './telegram'
import { t, setzeSprache, sprache, istSprache, type Sprache } from '../texte'

export interface Zeigen {
  projektId: string
  artefakt?: string
  url?: string
  datei?: string
  ref?: string
}

export interface EingangPosten {
  art: 'frage' | 'sitzung' | 'hinweis' | 'schlange' | 'anfrage' | 'lieferung' | 'dienst'
  projektId: string
  projekt: string
  kennung: string
  titel: string
  text?: string
  zeit: string
  frage?: pk.Frage
  sitzung?: string
  artefakt?: string
  ref?: string
}

/** Treffer der Suche über alles (QL-09). */
export interface Treffer {
  art: 'projekt' | 'sitzung' | 'artefakt' | 'punkt' | 'rueckmeldung'
  projektId: string
  projekt: string
  kennung: string
  titel: string
  text?: string
  /** Wozu der Treffer gehört: Artefakt und Stelle darin. */
  artefakt?: string
  ref?: string
}

/** Zugang für Handy und Tablet (CP-12). Aus, bis er in den Einstellungen eingeschaltet wird. */
export interface MobilEinstellung {
  an?: boolean
  port?: number
  /** Unter dieser Adresse erreicht das Handy den Zugang, zum Beispiel die eines Weiterleiters im eigenen Netz. */
  adresse?: string
  schluessel?: string
}

export const MOBIL_PORT = 8744

export interface DienstZustand {
  name: string
  url: string
  start: string
  gemeinsam: boolean
  zweck: string
  hilfe: string
  /** Steht für genau diese Angaben; die Bestätigung nennt sie. */
  kennung: string
  laeuft: boolean
  freigegeben: boolean
  vonUns: boolean
}

export interface BildAuftrag {
  url: string
  breite: number
  hoehe: number
  scrollY?: number
}

export class Deck extends EventEmitter {
  projekte = new Projekte()
  sitzungen = new Sitzungen()
  /** Einstellungen des Kerns. Vorgabe wie im Mux: Sessions starten ohne Rückfragen. */
  einstellungen = new Ablage<{ ohneRueckfragen: boolean; name?: string; sprache?: SprachEinstellung; anzeigesprache?: Sprache; mobil?: MobilEinstellung; telegram?: tg.TelegramEinstellung }>(path.join(HOME, 'einstellungen.json'), 1, () => ({ ohneRueckfragen: true }))
  port = 0
  token = ''
  /** Port des Zugangs fürs Handy, solange er läuft; setzt `Mobil`. */
  mobilPort = 0
  /** Von der Oberfläche gesetzt: rendert eine Adresse zu einem PNG (CP-06). */
  bildgeber: ((a: BildAuftrag) => Promise<Buffer>) | null = null
  private waechter = new Map<string, fs.FSWatcher[]>()
  private dienstProzesse = new Map<string, ChildProcess>()
  private entprellt = new Map<string, ReturnType<typeof setTimeout>>()
  /** Änderungen aus dem Betrachter, die noch keiner Session gemeldet sind, je Projekt und Roadmap. */
  private ungemeldet = new Map<string, Map<string, rm.Aenderung>>()

  async start(): Promise<void> {
    ensureDir(HOME)
    setzeNutzer(this.einstellungen.get().name)
    setzeSprache(this.einstellungen.get().anzeigesprache ?? sprachVorgabe())
    // Eingeschaltet, aber ohne Schlüssel (von Hand in die Datei geschrieben): ohne ihn käme niemand hinein.
    if (this.einstellungen.get().mobil?.an && !this.einstellungen.get().mobil?.schluessel) this.mobilEinstellen({})
    ensureDir(RUNS)
    this.projekte.suchen()
    await this.sitzungen.aufnehmen()
    this.sitzungen.on('ausgabe', (sid, data, seq) => this.emit('ausgabe', sid, data, seq))
    this.sitzungen.on('geaendert', (s: Sitzung) => { this.emit('sitzung', s); this.emit('eingang') })
    this.sitzungen.on('schlange', (sid, n) => { this.emit('schlange', sid, n); this.emit('eingang') })
    this.sitzungen.on('zugestellt', (sid: string, kennung: string) => {
      const s = this.sitzungen.get(sid)
      const p = s && this.projekte.get(s.projektId)
      if (p && kennung.startsWith('rm:')) {
        try { pk.rueckmeldungAendern(p.pfad, kennung.slice(3), { status: 'zugestellt' }) } catch { /* Datei von Hand entfernt */ }
      }
    })
  }

  stop(): void {
    this.sitzungen.schliessen()
    for (const ws of this.waechter.values()) ws.forEach((w) => w.close())
    for (const p of this.dienstProzesse.values()) p.kill()
  }

  /**
   * Sprache der Oberfläche wählen (UI-09). Gilt sofort für alles, was das Deck von da an
   * schreibt; laufende Sessions behalten ihr Briefing, bis sie neu starten.
   */
  spracheSetzen(s: unknown): Sprache {
    if (!istSprache(s)) return sprache()
    this.einstellungen.get().anzeigesprache = s
    this.einstellungen.save()
    setzeSprache(s)
    this.emit('sprache', s)
    return s
  }

  startfehler(): string[] {
    return [this.projekte.fehler, this.sitzungen.fehler].filter((x): x is string => !!x)
  }

  basis(): string {
    return `http://127.0.0.1:${this.port}`
  }

  projekt(pid: string): Projekt {
    const p = this.projekte.get(pid)
    if (!p) throw new Error(t('fehler.projektUnbekannt'))
    return p
  }

  // --- Projekt öffnen, Dateien beobachten --------------------------------

  oeffnen(pid: string): Projekt {
    const p = this.projekt(pid)
    this.projekte.aendern(pid, { zuletzt: Date.now() })
    this.beobachten(p)
    return p
  }

  private beobachten(p: Projekt): void {
    this.waechter.get(p.id)?.forEach((w) => w.close())
    const ws: fs.FSWatcher[] = []
    const melden = (was: string) => {
      const alt = this.entprellt.get(p.id)
      if (alt) clearTimeout(alt)
      this.entprellt.set(p.id, setTimeout(() => {
        this.emit('dateien', p.id, was)
        this.emit('eingang')
      }, 150))
    }
    const dir = coopDir(p)
    if (fs.existsSync(dir)) {
      try { ws.push(fs.watch(dir, { recursive: true }, (_e, f) => melden(String(f ?? '')))) } catch { /* ohne Wächter weiter */ }
    } else {
      // `.coop/` entsteht erst beim ersten Artefakt (PS-08): auf sein Erscheinen warten.
      try {
        const w = fs.watch(p.pfad, (_e, f) => { if (String(f) === '.coop') { this.beobachten(p); melden('.coop') } })
        ws.push(w)
      } catch { /* ohne Wächter weiter */ }
    }
    for (const a of this.projekte.artefakte(p)) {
      if (!a.quelle || a.quelle.startsWith('.coop/')) continue
      const f = innerhalb(p.pfad, a.quelle)
      if (!f || !fs.existsSync(f)) continue
      try { ws.push(fs.watch(f, () => melden(a.quelle!))) } catch { /* ohne Wächter weiter */ }
    }
    this.waechter.set(p.id, ws)
  }

  // --- Neues Projekt aus Vorlage (PS-09, AF-12) --------------------------

  /**
   * Legt ein Verzeichnis mit Projektblatt und den Artefakten der Vorlage an. Ein vorhandenes
   * Verzeichnis wird nie angefasst. Eine Anweisungsdatei (`CLAUDE.md`, `AGENTS.md`) entsteht
   * nicht (V4): den Zusammenhang bekommt jede Session über das Briefing.
   */
  projektAusVorlage(o: { ordner: string; name: string; vorlage: string; git?: boolean }): { projekt: Projekt; hinweise: string[] } {
    const name = o.name.trim()
    if (!name || /[\/\\:\0]/.test(name) || name.startsWith('.')) throw new Error(t('vorlage.nameUngueltig'))
    const v = this.projekte.vorlagen().find((x) => x.id === o.vorlage)
    if (!v) throw new Error(t('vorlage.fehlt', { vorlage: o.vorlage }))
    const ordner = path.resolve(o.ordner.trim().replace(/^~(?=\/|$)/, process.env.HOME ?? '~'))
    if (!o.ordner.trim() || !fs.existsSync(ordner) || !fs.statSync(ordner).isDirectory()) throw new Error(t('vorlage.ordnerFehlt', { ordner: o.ordner }))
    const ziel = path.join(ordner, name)
    if (fs.existsSync(ziel)) throw new Error(t('vorlage.zielVorhanden', { ziel }))
    fs.mkdirSync(ziel)
    const p = this.projekte.hinzufuegen(ziel)
    if (!p) throw new Error(t('vorlage.nichtAngelegt'))
    const heute = new Date().toISOString().slice(0, 10)
    const fuelle = (t: string) => t.replace(/\{\{(name|titel)\}\}/g, name)
    const blatt = sprachDatei(path.join(TYPEN, 'projektblatt', 'vorlage.md'))
    const blattText = fs.existsSync(blatt) ? fs.readFileSync(blatt, 'utf-8') : '# {{titel}}\n'
    writeFileAtomic(path.join(ziel, 'PROJEKT.md'), fuelle(blattText).replace(/^- (?:JJJJ-MM-TT|YYYY-MM-DD): (?:angelegt|created)$/m, `- ${heute}: ${t('vorlage.verlauf', { vorlage: v.name })}`))
    for (const a of v.artefakte) {
      if (!this.projekte.typen().some((t) => t.id === a.typ)) continue
      const quelle = a.quelle ? innerhalb(ziel, a.quelle) : null
      if (quelle && a.text && !fs.existsSync(quelle)) writeFileAtomic(quelle, fuelle(a.text))
      const neu = this.projekte.neuesArtefakt(p, { typ: a.typ, titel: a.titel, quelle: a.quelle })
      const datei = a.daten ? this.projekte.datenPfad(p, neu) : null
      if (datei && neu.daten) writeJson(datei, { ...readJson<Record<string, unknown>>(datei, {}), ...a.daten, titel: a.titel })
    }
    const hinweise: string[] = []
    if (o.git ?? v.git) {
      try {
        execFileSync('git', ['init', '-q'], { cwd: ziel, env: { ...process.env, PATH: enhancedPath() }, stdio: 'ignore', timeout: 10000 })
        writeFileAtomic(path.join(ziel, '.gitignore'), t('vorlage.gitignore') + '\n.coop/ablage/\n.coop/ansichten/\n.coop/hinweise/\n.coop/fragen/\n')
      } catch { hinweise.push(t('vorlage.gitFehlt')) }
    }
    return { projekt: this.projekte.get(p.id)!, hinweise }
  }

  // --- Artefakte ---------------------------------------------------------

  /** Adresse für fremden Inhalt aus dem Projekt: abgeschottet, ohne Zugang zur Schnittstelle. */
  fremdUrl(p: Projekt, rest: string): string {
    const kennung = crypto.createHmac('sha256', this.token).update(`lesen:${p.id}`).digest('hex').slice(0, 32)
    return `${this.basis()}/u/${kennung}/p/${p.id}/${rest}`
  }

  artefaktUrl(p: Projekt, a: Artefakt): string {
    if (a.typ === 'web') return a.url || 'about:blank'
    if (a.typ === 'frei') return this.fremdUrl(p, `a/${a.id}/`)
    return `${this.basis()}/p/${p.id}/a/${a.id}/`
  }

  dateiUrl(p: Projekt, rel: string): string {
    const r = rel.split('/').map(encodeURIComponent).join('/')
    return /\.(md|markdown)$/i.test(rel) ? `${this.basis()}/p/${p.id}/md/${r}` : this.fremdUrl(p, `f/${r}`)
  }

  /**
   * Was eine Artefaktseite auslösen darf. Die Seite nennt Art und Kennungen; Titel und
   * Text holt der Kern aus den Daten und kürzt sie auf eine Zeile.
   */
  aktionAusSeite(p: Projekt, b: { art: string; artefakt: string; punkt?: string }): { art: string; artefakt?: string; punkt?: string; titel?: string; text?: string } | null {
    const a = this.projekte.artefakt(p, b.artefakt)
    if (!a) return null
    const pfad = this.projekte.datenPfad(p, a)
    const daten = pfad ? readJson<Record<string, any>>(pfad, {}) : {}
    const titel = kurz(String(daten.titel || a.titel), 60).replace(/[„“”"`]/g, '')
    if (b.art === 'sitzung-starten' && a.typ === 'roadmap') {
      const punkt = rm.punkt(rm.normalisieren(daten), b.punkt ?? '')
      return punkt ? { art: 'sitzung-starten', artefakt: a.id, punkt: punkt.id, titel: kurz(punkt.titel, 60) } : null
    }
    // Review und Übergabe starten eine Session mit einem Auftrag, den der Kern formuliert (RM-07).
    if (b.art === 'sitzung-starten' && a.typ === 'review') {
      const befund = wt.reviewNormalisieren(daten).befunde.find((x) => x.id === b.punkt)
      if (!befund || !rm.kennungOk(befund.id)) return null
      return { art: 'sitzung-neu', titel: `${befund.id} ${kurz(befund.titel, 28)}`.replace(/[„“”"`]/g, ''), text: t('auftrag.befund', { id: befund.id, titel, pfad }) }
    }
    if (b.art === 'sitzung-starten' && a.typ === 'uebergabe') {
      const e = wt.uebergabenNormalisieren(daten).eintraege.find((x) => x.id === b.punkt)
      if (!e || !rm.kennungOk(e.id)) return null
      return { art: 'sitzung-neu', titel: t('auftrag.uebergabeTitel', { id: e.id }), text: t('auftrag.uebergabe', { id: e.id, pfad }) }
    }
    if (b.art === 'aenderungen-senden' && a.typ === 'roadmap') {
      const m = this.aenderungenMelden(p.id, a.id)
      return m.sonst ? { art: 'auftrag', text: m.sonst } : { art: 'gemeldet' }
    }
    if (b.art === 'aenderungen-verwerfen' && a.typ === 'roadmap') {
      this.aenderungenVerwerfen(p.id, a.id)
      return { art: 'verworfen' }
    }
    if (b.art === 'antworten' && a.typ === 'fragebogen') {
      const fragen = Array.isArray(daten.fragen) ? daten.fragen : []
      const n = fragen.filter((f: any) => String(f?.antwort ?? '').trim()).length
      return { art: 'auftrag', text: t('auftrag.fragebogen', { name: nutzer(), titel, n, von: fragen.length, pfad }) }
    }
    if (b.art === 'wahl' && a.typ === 'variantenwahl') {
      const v = (Array.isArray(daten.varianten) ? daten.varianten : []).find((x: any) => x?.id === daten.wahl)
      if (!v) return null
      return { art: 'auftrag', text: t('auftrag.wahl', { name: nutzer(), titel, variante: kurz(String(v.id), 12), pfad }) }
    }
    return null
  }

  neuesArtefakt(pid: string, o: { typ: ArtefaktTyp; titel: string; quelle?: string; url?: string }): Artefakt {
    const p = this.projekt(pid)
    const a = this.projekte.neuesArtefakt(p, o)
    this.beobachten(p)
    this.emit('dateien', p.id, 'artefakte')
    return a
  }

  /**
   * Eine fertige HTML-Seite als freies Artefakt übernehmen (AF-11), etwa ein Artefakt von claude.ai.
   * Verweise ins Netz werden entfernt (V5); was die Seite dort zur Laufzeit bekam (Speicher,
   * Konnektoren), gibt es hier nicht. Die Seite läuft abgeschottet wie jedes freie Artefakt (V10).
   */
  artefaktImportieren(pid: string, o: { datei: string; titel: string; herkunft?: string }): { artefakt: Artefakt; entfernt: string[] } {
    const p = this.projekt(pid)
    const quelle = path.resolve(o.datei)
    if (!fs.existsSync(quelle) || !fs.statSync(quelle).isFile()) throw new Error(t('import.dateiFehlt', { datei: o.datei }))
    if (fs.statSync(quelle).size > 32 * 1024 * 1024) throw new Error(t('import.zuGross'))
    const { html, entfernt } = ohneNetz(fs.readFileSync(quelle, 'utf-8'))
    const a = this.neuesArtefakt(pid, { typ: 'frei', titel: o.titel })
    const dir = this.projekte.artefaktDir(p, a.id)
    writeFileAtomic(path.join(dir, 'index.html'), html)
    const herkunft = /^https:\/\/[\w.-]+\/[\w\/.-]*$/.test(o.herkunft ?? '') ? o.herkunft : undefined
    writeJson(path.join(dir, 'artefakt.json'), { ...readJson<Record<string, unknown>>(path.join(dir, 'artefakt.json'), {}), herkunft, importiert: new Date().toISOString() })
    return { artefakt: a, entfernt }
  }

  /** Daten eines Artefakts schreiben; typisierte Daten werden geprüft (AF-04). */
  datenSchreiben(p: Projekt, a: Artefakt, text: string): string[] {
    const ziel = this.projekte.datenPfad(p, a)
    if (!ziel) throw new Error(t('daten.keineDatei'))
    let daten: unknown
    if (a.daten) {
      try { daten = JSON.parse(text) } catch (e) { return [t('daten.keinJson', { grund: (e as Error).message })] }
      const f = a.typ === 'roadmap' ? rm.pruefen(daten) : a.typ === 'review' ? wt.reviewPruefen(daten) : []
      if (f.length) return f
    }
    const alt = a.typ === 'roadmap' ? readJson<unknown>(ziel, null) : null
    writeFileAtomic(ziel, text)
    if (alt) this.roadmapGeaendert(p, a, rm.unterschied(rm.normalisieren(alt), rm.normalisieren(daten)))
    return []
  }

  /**
   * Der Mensch hat die Roadmap im Betrachter geändert (AF-09). Das Deck sammelt, was sich
   * geändert hat; gemeldet wird auf Knopfdruck im Betrachter, wie beim Fragebogen.
   */
  private roadmapGeaendert(p: Projekt, a: Artefakt, neu: Map<string, rm.Aenderung>): void {
    const key = `${p.id}\n${a.id}`
    const u = this.ungemeldet.get(key) ?? new Map<string, rm.Aenderung>()
    for (const [id, ae] of neu) {
      if (!rm.kennungOk(id)) continue
      const m = rm.zusammenlegen(u.get(id), ae)
      if (m) u.set(id, m)
      else u.delete(id)
    }
    if (u.size) this.ungemeldet.set(key, u)
    else this.ungemeldet.delete(key)
  }

  /** Sessions, die an einem der geänderten Punkte arbeiten, mit ihrem Anteil. */
  private betroffene(pid: string, aid: string, u: Map<string, rm.Aenderung>): { s: Sitzung; teile: [string, rm.Aenderung][] }[] {
    return this.sitzungen.liste(pid).flatMap((s) => {
      if (s.zustand === 'beendet' || s.art !== 'cli') return []
      const meine = new Set([...(s.punkte ?? []), ...(s.roadmap ? [`${s.roadmap.artefakt}/${s.roadmap.punkt}`] : [])])
      const teile = [...u].filter(([id]) => meine.has(`${aid}/${id}`))
      return teile.length ? [{ s, teile }] : []
    })
  }

  private aenderungsZeile(teile: [string, rm.Aenderung][]): string {
    const erster = teile.find(([, ae]) => !ae.entfernt)?.[0]
    return t('roadmap.aenderungZeile', { name: nutzer(), teile: teile.map(([id, ae]) => rm.aenderungAlsText(id, ae)).join('. ') }) + (erster ? t('roadmap.aenderungLies', { punkt: erster }) : '')
  }

  /** Für das Band im Betrachter: was noch nicht gemeldet ist und an wen es ginge. */
  aenderungenOffen(pid: string, aid: string): { zeilen: string[]; an: string[] } | null {
    const u = this.ungemeldet.get(`${pid}\n${aid}`)
    if (!u) return null
    return { zeilen: [...u].map(([id, ae]) => rm.aenderungAlsText(id, ae)), an: this.betroffene(pid, aid, u).map((b) => b.s.titel) }
  }

  /**
   * Gesammelte Änderungen melden. Arbeitet eine Session an einem der Punkte, bekommt sie
   * ihren Anteil; sonst liefert die Methode eine Zeile für die Session, die gerade vorn ist.
   */
  aenderungenMelden(pid: string, aid: string): { an: string[]; sonst?: string } {
    const key = `${pid}\n${aid}`
    const u = this.ungemeldet.get(key)
    if (!u) return { an: [] }
    this.ungemeldet.delete(key)
    const an: string[] = []
    for (const { s, teile } of this.betroffene(pid, aid, u)) {
      try {
        this.sitzungen.zustellen(s.id, this.aenderungsZeile(teile), `ae:${aid}`)
        an.push(s.id)
      } catch { /* Session inzwischen beendet */ }
    }
    return an.length ? { an } : { an, sonst: this.aenderungsZeile([...u]) }
  }

  aenderungenVerwerfen(pid: string, aid: string): void {
    this.ungemeldet.delete(`${pid}\n${aid}`)
  }

  /** Eine Session, die einen Punkt anfasst, erfährt künftig von Änderungen an ihm. */
  private merkePunkt(s: Sitzung | undefined, a: Artefakt, punkt: string): void {
    const k = `${a.id}/${punkt}`
    if (!s || (s.roadmap && `${s.roadmap.artefakt}/${s.roadmap.punkt}` === k) || s.punkte?.includes(k)) return
    this.sitzungen.aendern(s.id, { punkte: [...(s.punkte ?? []), k] })
  }

  private roadmap(p: Projekt, aid?: string): { a: Artefakt; r: rm.Roadmap; datei: string } {
    const alle = this.projekte.artefakte(p).filter((x) => x.typ === 'roadmap')
    const a = aid ? alle.find((x) => x.id === aid) : alle[0]
    if (!a) throw new Error(aid ? t('roadmap.fehlt', { id: aid }) : t('roadmap.keine'))
    const datei = this.projekte.datenPfad(p, a)!
    return { a, r: rm.normalisieren(readJson(datei, {})), datei }
  }

  // --- Briefing (SE-08, RM-02) -------------------------------------------

  briefing(p: Projekt, s: Pick<Sitzung, 'id' | 'titel' | 'roadmap' | 'zweck'>): string {
    const z: string[] = []
    const artefakte = this.projekte.artefakte(p)
    z.push(t('briefing.titel', { titel: s.titel }), '')
    z.push(t('briefing.lage', { projekt: p.name, pfad: p.pfad, name: nutzer() }))
    if (s.zweck) z.push('', t('briefing.zweck', { zweck: s.zweck }))
    z.push('', t('briefing.zusammenarbeit'), '')
    z.push(t('briefing.coop'), '')
    for (const k of ['zeigen', 'hinweis', 'frage', 'bild', 'roadmap', 'artefakt', 'ergebnis', 'uebergabe'] as const) z.push(t(`briefing.${k}`))
    // Nur nennen, was geht: ohne eingeschalteten Zugang gibt es niemanden, der liefert.
    if (this.mobilEinstellung().an) z.push(t('briefing.anfordern', { name: nutzer() }))
    z.push(t(tg.eingerichtet(this.einstellungen.get().telegram) ? 'briefing.meldenTelegram' : 'briefing.melden', { name: nutzer() }))
    const dienste = this.gemeinsameDienste()
    if (dienste.length) {
      z.push('', t('briefing.dienste', { name: nutzer() }))
      // Eine Zeile je Dienst, aus kurzen, einzeiligen Angaben: kein Projekt schreibt hier Absätze in fremde Briefings.
      const eins = (s: string | undefined, n: number) => kurz((s ?? '').replace(/[\s`]+/g, ' ').trim(), n)
      for (const { projekt, dienst: d } of dienste) z.push(t(d.hilfe ? 'briefing.dienstMitHilfe' : 'briefing.dienst', { dienst: eins(d.name, 60), zweck: eins(d.zweck, 200) || '—', adresse: eins(d.url, 120), hilfe: eins(d.hilfe, 160), projekt: eins(projekt.name, 60) }))
    }
    z.push('', t('briefing.mcp'))
    z.push('', t('briefing.rueckmeldung', { name: nutzer() }))
    z.push('', t('briefing.typisiert'))

    const blatt = artefakte.find((a) => a.typ === 'projektblatt')
    const blattPfad = blatt ? this.projekte.datenPfad(p, blatt) : innerhalb(p.pfad, 'PROJEKT.md')
    if (blattPfad && fs.existsSync(blattPfad)) {
      const text = fs.readFileSync(blattPfad, 'utf-8')
      z.push('', t('briefing.blatt', { pfad: blattPfad }), '', t('briefing.blattRegel', { name: nutzer() }), '')
      z.push(text.length > 8000 ? `${text.slice(0, 8000)}\n\n${t('briefing.gekuerzt')}` : text)
    }

    if (artefakte.length) {
      z.push('', t('briefing.artefakte'), '')
      for (const a of artefakte) {
        const d = this.projekte.datenPfad(p, a)
        z.push(`- \`${a.id}\` — ${a.titel} (${a.typ})${d ? t('briefing.artefaktDaten', { pfad: d }) : a.url ? ` — ${a.url}` : ''}`)
      }
      for (const typ of new Set(artefakte.map((a) => a.typ))) {
        const text = this.projekte.anleitung(typ)
        if (text) z.push('', t('briefing.typ', { typ }), '', text)
      }
    } else {
      z.push('', t('briefing.keineArtefakteTitel'), '', t('briefing.keineArtefakte', { typen: this.projekte.typen().map((x) => x.id).join(', ') }))
    }

    const ue = artefakte.find((a) => a.typ === 'uebergabe')
    const letzte = ue ? wt.uebergabenNormalisieren(readJson(this.projekte.datenPfad(p, ue) ?? '', {})).eintraege[0] : undefined
    if (letzte) z.push('', t('briefing.letzteUebergabe'), '', wt.uebergabeAlsText(letzte))

    if (s.roadmap) {
      try {
        const { r } = this.roadmap(p, s.roadmap.artefakt)
        const punkt = rm.punkt(r, s.roadmap.punkt)
        if (punkt) {
          z.push('', t('briefing.punkt'), '', rm.punktAlsText(r, punkt))
          const frueher = this.sitzungen.liste(p.id).filter((x) => x.id !== s.id && x.roadmap?.punkt === punkt.id && x.roadmap.artefakt === s.roadmap!.artefakt)
          if (frueher.length) {
            z.push('', t('briefing.frueher'))
            for (const f of frueher) z.push(t('briefing.frueherZeile', { datum: new Date(f.erstellt).toISOString().slice(0, 10), titel: f.titel, ergebnis: f.ergebnis || t('briefing.keinErgebnis') }))
          }
          z.push('', t('briefing.punktRegel', { id: punkt.id, name: nutzer() }))
        }
      } catch { /* Roadmap inzwischen entfernt: Briefing ohne Punkt */ }
    }
    return z.join('\n') + '\n'
  }

  // --- Sessions ----------------------------------------------------------

  async sitzungStarten(o: { projektId: string; art?: 'cli' | 'terminal'; cli?: CliId; titel?: string; zweck?: string; roadmap?: Sitzung['roadmap']; auftrag?: string; ohneRueckfragen?: boolean }): Promise<Sitzung> {
    const p = this.projekt(o.projektId)
    let auftrag = o.auftrag?.trim() || undefined
    let titel = o.titel
    if (o.roadmap) {
      const { r } = this.roadmap(p, o.roadmap.artefakt)
      const punkt = rm.punkt(r, o.roadmap.punkt)
      if (punkt) {
        titel ??= `${punkt.id} ${kurz(punkt.titel, 28)}`
        auftrag = [t('auftrag.punkt', { id: punkt.id, titel: punkt.titel }), auftrag].filter(Boolean).join(' ')
      }
    }
    return this.sitzungen.starten({ ...o, projekt: p, titel, auftrag, ohneRueckfragen: o.ohneRueckfragen ?? this.einstellungen.get().ohneRueckfragen, briefing: (s) => this.briefing(p, s) })
  }

  async sitzungFortsetzen(sid: string): Promise<Sitzung> {
    const s = this.sitzungen.get(sid)
    if (!s) throw new Error(t('fehler.sitzungUnbekannt'))
    const p = this.projekt(s.projektId)
    return this.sitzungen.fortsetzen(sid, p, (x) => this.briefing(p, x))
  }

  // --- Rückmeldung (KO) --------------------------------------------------

  rueckmeldungSenden(pid: string, n: pk.NeueRueckmeldung, sofort = false): { id: string; md: string; text: string } {
    const p = this.projekt(pid)
    const { r, md } = pk.rueckmeldungAnlegen(p.pfad, n)
    if (n.ziel) {
      const wozu = r.artefakt ? t('rm.zuArtefakt', { titel: r.artefakt.titel }) : t('rm.zuAdresse', { url: kurz(r.url, 60) })
      const zeile = t('rm.zeile', { name: nutzer(), wozu, marken: t(r.marken.length === 1 ? 'rm.marke.eins' : 'rm.marke.viele', { n: r.marken.length }), notiz: r.notiz.trim() ? t('rm.notizTeil', { notiz: kurz(r.notiz, 90) }) : '', md })
      this.sitzungen.zustellen(n.ziel, zeile, `rm:${r.id}`, sofort)
    }
    return { id: r.id, md, text: fs.readFileSync(md, 'utf-8') }
  }

  /**
   * Dieselbe Ansicht noch einmal aufnehmen, sobald der Agent „erledigt“ meldet (KO-11):
   * gleiche Größe, gleiche Stelle. Nur für Artefakte des Projekts und lokale Dienste;
   * fremde Adressen ruft das Deck nicht von sich aus auf.
   */
  private async nachherBild(p: Projekt, r: pk.Rueckmeldung): Promise<void> {
    if (!this.bildgeber) return
    const a = r.artefakt ? this.projekte.artefakt(p, r.artefakt.id) : null
    let url: string | null = null
    if (a && a.typ !== 'web') url = this.mitToken(this.artefaktUrl(p, a))
    else {
      try {
        const u = new URL(a?.url || r.url)
        if ((u.hostname === '127.0.0.1' || u.hostname === 'localhost') && !/^\/(p|u|api)\//.test(u.pathname)) url = u.toString()
      } catch { /* keine Adresse */ }
    }
    if (!url) return
    try {
      const png = await this.bildgeber({ url, breite: r.ansicht.breite || 1280, hoehe: r.ansicht.hoehe || 900, scrollY: r.ansicht.scrollY })
      const name = `${r.id}-nachher.png`
      writeFileAtomic(path.join(coopDir(p), 'rueckmeldungen', name), png)
      pk.rueckmeldungAendern(p.pfad, r.id, { nachher: name })
    } catch { /* ohne Bild bleibt die Meldung gültig (V3) */ }
  }

  /** Verlauf der Rückmeldungen, neueste zuerst, mit Adressen der Bilder (KO-11). */
  verlauf(p: Projekt, aid?: string): (pk.Rueckmeldung & { bildUrl?: string; nachherUrl?: string; zielTitel?: string })[] {
    const bild = (name?: string) => (name ? this.fremdUrl(p, `f/.coop/rueckmeldungen/${encodeURIComponent(path.basename(name))}`) : undefined)
    return pk.rueckmeldungen(p.pfad).filter((r) => !aid || r.artefakt?.id === aid).sort((x, y) => y.zeit.localeCompare(x.zeit))
      .map((r) => ({ ...r, bildUrl: bild(r.bild), nachherUrl: bild(r.nachher), zielTitel: r.ziel ? this.sitzungen.get(r.ziel)?.titel : undefined }))
  }

  /** Was der Agent lesen würde, ohne etwas abzulegen (KO-08). */
  rueckmeldungVorschau(n: pk.NeueRueckmeldung): string {
    const r: pk.Rueckmeldung = { format: 1, id: t('rm.vorschauId'), zeit: new Date().toISOString(), artefakt: n.artefakt, url: n.url, ansicht: n.ansicht, notiz: n.notiz, marken: n.marken, ziel: n.ziel, status: 'offen' }
    return pk.rueckmeldungAlsText(r, { json: '.coop/rueckmeldungen/<zeit>.json', bild: n.bildPng ? '.coop/rueckmeldungen/<zeit>.png' : undefined })
  }

  // --- Fragen, Hinweise, Eingang (CP) ------------------------------------

  frageBeantworten(pid: string, fid: string, antwort: { option?: string; text?: string }): void {
    const p = this.projekt(pid)
    const f = pk.frageBeantworten(p.pfad, fid, antwort)
    const s = this.sitzungen.get(f.von)
    if (s && s.zustand !== 'beendet' && !f.wartend) this.sitzungen.zustellen(s.id, pk.antwortAlsText(f), `fr:${f.id}`)
    this.emit('eingang')
  }

  // --- Melden, wo der Mensch gerade ist (CP-13) ---------------------------

  /** Token und Chat setzen. Ein leeres Token lässt das bisherige stehen; `tokenLoeschen` entfernt es. */
  telegramEinstellen(patch: { an?: boolean; token?: string; chat?: string; tokenLoeschen?: boolean }): void {
    const m = (this.einstellungen.get().telegram ??= {})
    if (typeof patch.an === 'boolean') m.an = patch.an
    if (patch.tokenLoeschen) m.token = undefined
    else if (patch.token?.trim()) m.token = patch.token.trim()
    if (typeof patch.chat === 'string') m.chat = patch.chat.trim() || undefined
    this.einstellungen.save()
    this.geheimHalten()
  }

  /** Die Einstellungen tragen Schlüssel und Token: nur der eigene Benutzer darf sie lesen. */
  private geheimHalten(): void {
    try { fs.chmodSync(path.join(HOME, 'einstellungen.json'), 0o600) } catch { /* Dateisystem ohne Rechte */ }
  }

  /** Was die Oberfläche sieht: ob ein Token da ist, nie das Token selbst. */
  telegramLage(): { an: boolean; tokenDa: boolean; tokenGueltig: boolean; chat: string; bereit: boolean } {
    const m = this.einstellungen.get().telegram ?? {}
    return { an: !!m.an, tokenDa: !!m.token, tokenGueltig: tg.tokenGueltig(m.token), chat: m.chat ?? '', bereit: tg.eingerichtet(m) }
  }

  private gemeldet = new Map<string, number[]>()
  /** So viele Meldungen darf eine Session je Stunde schicken: eine Schleife soll kein Telefon fluten. */
  meldeGrenze = 20

  /**
   * Meldung einer Session an den Menschen. Mit eingerichtetem Bot geht sie über Telegram, sonst
   * als Mitteilung des Systems. Liefert, wohin sie ging.
   */
  async melden(p: Projekt, s: Sitzung | undefined, text: string): Promise<{ weg: 'telegram' | 'mitteilung'; fehler?: string }> {
    const wer = s?.id ?? `extern:${p.id}`
    const jetzt = Date.now()
    const zeiten = (this.gemeldet.get(wer) ?? []).filter((z) => jetzt - z < 3600000)
    if (zeiten.length >= this.meldeGrenze) throw new Error(t('melden.zuViele', { n: this.meldeGrenze }))
    zeiten.push(jetzt)
    this.gemeldet.set(wer, zeiten)
    const kopf = s ? `${p.name} · ${s.titel}` : p.name
    this.emit('gemeldet', s?.titel ?? p.name, text)
    const e = this.einstellungen.get().telegram
    if (tg.eingerichtet(e)) {
      const fehler = this.telegramGrund(await tg.senden(e, `${kopf}\n${kurz(text.trim(), tg.TELEGRAM_LAENGE)}`))
      if (!fehler) return { weg: 'telegram' }
      this.emit('melden', kopf, text)
      return { weg: 'mitteilung', fehler }
    }
    this.emit('melden', kopf, text)
    return { weg: 'mitteilung' }
  }

  /** Probenachricht aus den Einstellungen. */
  async telegramProbe(): Promise<string | null> {
    const e = this.einstellungen.get().telegram
    if (!tg.eingerichtet(e)) return t('melden.nichtEingerichtet')
    return this.telegramGrund(await tg.senden(e, t('melden.probe', { name: nutzer() })))
  }

  /** Die zwei Gründe, an denen das Einrichten meist hängt, in Worten; alles andere, wie Telegram es nennt. */
  private telegramGrund(f: string | null): string | null {
    if (!f) return null
    if (/chat not found/i.test(f)) return t('melden.chatFehlt')
    if (/^401\b|unauthorized/i.test(f)) return t('melden.tokenFalsch')
    return f
  }

  // --- Anfragen: Fotos und Ton vom Handy (CP-12) ---------------------------

  mobilEinstellung(): { an: boolean; port: number; adresse: string; schluessel: string } {
    const m = this.einstellungen.get().mobil ?? {}
    return { an: !!m.an, port: Number.isInteger(m.port) && m.port! >= 0 && m.port! < 65536 ? m.port! : MOBIL_PORT, adresse: (m.adresse ?? '').trim().replace(/\/+$/, ''), schluessel: m.schluessel ?? '' }
  }

  /** Zugang ein- oder ausschalten, Port und Adresse setzen. Der Schlüssel entsteht beim ersten Einschalten und bleibt, damit ein Lesezeichen auf dem Handy gültig bleibt. */
  mobilEinstellen(patch: { an?: boolean; port?: number; adresse?: string; neuerSchluessel?: boolean }): void {
    const e = this.einstellungen.get()
    const m = (e.mobil ??= {})
    if (typeof patch.an === 'boolean') m.an = patch.an
    if (patch.port !== undefined && Number.isInteger(patch.port) && patch.port > 0 && patch.port < 65536) m.port = patch.port
    if (typeof patch.adresse === 'string') m.adresse = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/i.test(patch.adresse.trim()) ? patch.adresse.trim().replace(/\/+$/, '') : undefined
    if (patch.neuerSchluessel || (m.an && !m.schluessel)) m.schluessel = crypto.randomBytes(24).toString('hex')
    this.einstellungen.save()
    this.geheimHalten()
    this.emit('mobil')
  }

  /** Adresse der Handy-Seite. Mit Schlüssel nur für den Menschen am Deck; Sessions bekommen sie ohne. */
  mobilAdresse(mitSchluessel = false): string {
    const m = this.mobilEinstellung()
    const basis = m.adresse || `http://127.0.0.1:${this.mobilPort || m.port}`
    return `${basis}/${mitSchluessel && m.schluessel ? `?k=${m.schluessel}` : ''}`
  }

  anfrageNeu(p: Projekt, o: { von: string; an?: string; titel: string; text?: string; art?: pk.AnfrageArt; wartend?: boolean }): pk.Anfrage {
    const { anfrage } = pk.anfrageAnlegen(p.pfad, o)
    this.emit('anfrage', p.id, anfrage)
    this.emit('eingang')
    return anfrage
  }

  /** Eine fertig hochgeladene Datei bekommt ihren Namen und steht ab jetzt in der Anfrage. Ton wird lokal in Text umgesetzt. */
  anfrageHochgeladen(p: Projekt, aid: string, teil: string, inhaltstyp: string, original: string, groesse: number): pk.AnfrageDatei {
    let d!: pk.AnfrageDatei
    pk.anfrageAendern(p.pfad, aid, (a) => {
      const { name, art } = pk.anfrageDateiname(a, inhaltstyp, original)
      fs.renameSync(teil, path.join(pk.anfrageOrdner(p.pfad, aid), name))
      d = { name, art, groesse, original: kurz(path.basename(original), 80) || undefined, zeit: new Date().toISOString(), wartet: art === 'ton' || art === 'video' || undefined }
      a.dateien.push(d)
    })
    if (d.wartet) {
      const datei = path.join(pk.anfrageOrdner(p.pfad, aid), d.name)
      void erkennenDatei(datei, this.einstellungen.get().sprache ?? {})
        .then((text) => ({ text, fehler: '' }), (err: Error) => ({ text: '', fehler: kurz(err.message, 200) }))
        .then(({ text, fehler }) => {
          try {
            pk.anfrageAendern(p.pfad, aid, (a) => {
              const x = a.dateien.find((y) => y.name === d.name)
              if (!x) return
              delete x.wartet
              x.text = text || undefined
              x.fehler = fehler || undefined
            })
            if (text) writeFileAtomic(datei.replace(/\.[a-z0-9]+$/, '.txt'), text + '\n')
          } catch { /* Anfrage inzwischen entfernt */ }
          this.anfrageFertig(p, aid)
        })
    }
    return d
  }

  anfrageEntfernen(p: Projekt, aid: string, name: string): void {
    pk.anfrageAendern(p.pfad, aid, (a) => {
      const d = a.dateien.find((x) => x.name === name)
      if (!d) return
      a.dateien = a.dateien.filter((x) => x !== d)
      const datei = path.join(pk.anfrageOrdner(p.pfad, aid), d.name)
      fs.rmSync(datei, { force: true })
      fs.rmSync(datei.replace(/\.[a-z0-9]+$/, '.txt'), { force: true })
    })
  }

  /** „Abschicken“ am Handy. Geht auch ein zweites Mal, um etwas nachzureichen. */
  anfrageSenden(p: Projekt, aid: string, notiz: string): void {
    pk.anfrageAendern(p.pfad, aid, (a) => {
      a.notiz = kurz(notiz.trim(), 4000) || undefined
      a.status = 'geliefert'
      a.geliefert = new Date().toISOString()
    })
    this.anfrageFertig(p, aid)
  }

  /**
   * Übergibt die Lieferung, sobald sie abgeschickt und aller Ton Text ist. Wartet der anfragende
   * Befehl noch, bekommt er sie über die Datei; sonst wird der Session eine Zeile mit dem Pfad
   * der Lieferung getippt, wie bei einer Rückmeldung. Die Notiz selbst wird nie getippt.
   */
  private anfrageFertig(p: Projekt, aid: string): void {
    const vorher = pk.anfrage(p.pfad, aid)
    if (!vorher || vorher.status !== 'geliefert' || vorher.dateien.some((d) => d.wartet)) return
    const text = pk.anfrageAlsText(p.pfad, vorher)
    const md = path.join(pk.anfrageOrdner(p.pfad, aid), 'lieferung.md')
    writeFileAtomic(md, text + '\n')
    const anBefehl = !!vorher.wartend && !vorher.antwort
    const a = pk.anfrageAendern(p.pfad, aid, (x) => {
      x.antwort = { zeit: new Date().toISOString() }
      x.ausgabe = text
      x.abgeholt = undefined
      x.gesehen = undefined
    })
    // Lebt der wartende Befehl nicht mehr, holt niemand ab: dann geht die Lieferung den gewöhnlichen Weg.
    if (anBefehl) setTimeout(() => { if (pk.anfrage(p.pfad, aid)?.abgeholt !== true) this.anfrageZustellen(p, aid, md) }, this.abholFrist).unref()
    else this.anfrageZustellen(p, a.id, md)
    this.emit('eingang')
  }

  /** So lange hat ein wartender Befehl Zeit, die Lieferung abzuholen. */
  abholFrist = 8000

  private anfrageZustellen(p: Projekt, aid: string, md: string): void {
    const a = pk.anfrage(p.pfad, aid)
    if (!a) return
    const s = this.sitzungen.get(a.von === 'handy' ? a.an ?? '' : a.von)
    if (s && s.zustand !== 'beendet') {
      const n = a.dateien.length
      this.sitzungen.zustellen(s.id, t('anfrage.zeile', { name: nutzer(), titel: kurz(a.titel, 60), dateien: t(n === 1 ? 'anfrage.datei.eins' : 'anfrage.datei.viele', { n }), md }), `an:${a.id}`)
      pk.anfrageAendern(p.pfad, aid, (x) => { x.abgeholt = true })
    }
    // Ohne laufende Session bleibt die Lieferung im Eingang des Decks stehen, bis sie jemand gesehen hat.
    this.emit('eingang')
  }

  anfrageGesehen(pid: string, aid: string): void {
    pk.anfrageAendern(this.projekt(pid).pfad, aid, (a) => { a.gesehen = true })
    this.emit('eingang')
  }

  eingang(): EingangPosten[] {
    const out: EingangPosten[] = []
    for (const p of this.projekte.liste()) {
      for (const s of this.sitzungen.liste(p.id)) {
        if (s.achtung) out.push({ art: 'sitzung', projektId: p.id, projekt: p.name, kennung: s.id, sitzung: s.id, titel: s.titel, text: t(s.achtung === 'fertig' ? 'eingang.fertig' : 'eingang.wartet'), zeit: new Date(s.aktiv).toISOString() })
        const n = this.sitzungen.schlangenlaenge(s.id)
        if (n) out.push({ art: 'schlange', projektId: p.id, projekt: p.name, kennung: `q:${s.id}`, sitzung: s.id, titel: s.titel, text: t(n === 1 ? 'eingang.schlange.eins' : 'eingang.schlange.viele', { n }), zeit: new Date().toISOString() })
      }
      if (!p.hatCoop) continue
      for (const f of pk.fragen(p.pfad)) {
        if (!f.antwort) out.push({ art: 'frage', projektId: p.id, projekt: p.name, kennung: f.id, titel: f.titel, text: f.text, zeit: f.zeit, frage: f, sitzung: f.von })
      }
      // Ein Dienst, den das Projekt allen anbieten will, wartet auf die Bestätigung: sonst sucht man den Knopf dafür.
      for (const d of this.projekte.datei(p).dienste) {
        if (d.gemeinsam && !this.projekte.dienstFreigegeben(p, d)) out.push({ art: 'dienst', projektId: p.id, projekt: p.name, kennung: `dienst:${d.name}`, titel: kurz(d.name.replace(/\s+/g, ' '), 60), text: t('eingang.dienst'), zeit: new Date().toISOString() })
      }
      for (const a of pk.anfragen(p.pfad)) {
        if (a.status === 'offen' && a.von !== 'handy') out.push({ art: 'anfrage', projektId: p.id, projekt: p.name, kennung: a.id, titel: a.titel, text: t('eingang.anfrage', { adresse: this.mobilAdresse() }), zeit: a.zeit, sitzung: a.von })
        // Geliefert, aber von niemandem abgeholt: keine Session lief. Die Frist des wartenden Befehls zählt noch nicht dazu.
        else if (a.status === 'geliefert' && a.antwort && !a.abgeholt && !a.gesehen && Date.now() - Date.parse(a.antwort.zeit) > this.abholFrist * 1.25) out.push({ art: 'lieferung', projektId: p.id, projekt: p.name, kennung: a.id, titel: a.titel, text: path.relative(p.pfad, path.join(pk.anfrageOrdner(p.pfad, a.id), 'lieferung.md')), zeit: a.antwort.zeit })
      }
      for (const h of pk.hinweise(p.pfad)) {
        if (!h.gesehen) out.push({ art: 'hinweis', projektId: p.id, projekt: p.name, kennung: h.id, titel: kurz(h.text, 80), text: h.text, zeit: h.zeit, artefakt: h.artefakt, ref: h.ref, sitzung: h.von })
      }
    }
    return out.sort((a, b) => b.zeit.localeCompare(a.zeit))
  }

  // --- Suche (QL-09, UI-05) ----------------------------------------------

  /**
   * Sucht über Projekte, Sessions, Artefakte, Roadmap-Punkte und Rückmeldungen. Jedes Wort
   * muss vorkommen; Treffer im Titel stehen vor Treffern im Text, das eigene Projekt vor den anderen.
   * Was eine Session ausgegeben hat, durchsucht das Deck nicht: es hält davon nichts fest.
   */
  suche(frage: string, hier?: string, grenze = 40): Treffer[] {
    const worte = frage.toLowerCase().split(/\s+/).filter(Boolean)
    if (!worte.length) return []
    const funde: { t: Treffer; rang: number }[] = []
    const pruefe = (t: Treffer) => {
      const titel = `${t.kennung.startsWith('R-') ? t.kennung + ' ' : ''}${t.titel}`.toLowerCase()
      const alles = `${titel} ${(t.text ?? '').toLowerCase()}`
      if (!worte.every((w) => alles.includes(w))) return
      const imTitel = worte.every((w) => titel.includes(w))
      funde.push({ t: { ...t, text: t.text ? kurz(t.text.replace(/\s+/g, ' '), 140) : undefined }, rang: (imTitel ? 0 : 2) + (t.projektId === hier ? 0 : 1) })
    }
    for (const p of this.projekte.liste()) {
      pruefe({ art: 'projekt', projektId: p.id, projekt: p.name, kennung: p.id, titel: p.name, text: p.pfad })
      for (const s of this.sitzungen.liste(p.id)) {
        pruefe({ art: 'sitzung', projektId: p.id, projekt: p.name, kennung: s.id, titel: s.titel, text: [s.zweck, s.ergebnis, s.roadmap?.punkt].filter(Boolean).join(' — ') })
      }
      if (!p.hatCoop) continue
      for (const a of this.projekte.artefakte(p)) {
        pruefe({ art: 'artefakt', projektId: p.id, projekt: p.name, kennung: a.id, titel: a.titel, text: a.typ, artefakt: a.id })
        if (a.typ !== 'roadmap') continue
        const datei = this.projekte.datenPfad(p, a)
        const r = rm.normalisieren(datei ? readJson(datei, {}) : {})
        for (const x of r.punkte) {
          pruefe({ art: 'punkt', projektId: p.id, projekt: p.name, kennung: x.id, titel: x.titel, text: [x.status, x.beschreibung, ...(x.abnahme ?? [])].filter(Boolean).join(' — '), artefakt: a.id, ref: `roadmap:${x.id}` })
        }
      }
      for (const r of pk.rueckmeldungen(p.pfad)) {
        const text = [r.notiz, ...r.marken.map((m) => m.text), r.erledigt?.notiz].filter(Boolean).join(' — ')
        pruefe({ art: 'rueckmeldung', projektId: p.id, projekt: p.name, kennung: r.id, titel: r.artefakt ? t('rm.nameZu', { titel: r.artefakt.titel }) : t('rm.name'), text: `${r.status} — ${text}`, artefakt: r.artefakt?.id, ref: `rueckmeldung:${r.id}` })
      }
    }
    return funde.sort((a, b) => a.rang - b.rang).slice(0, grenze).map((f) => f.t)
  }

  // --- Dienste (PS-11, SI-07) --------------------------------------------

  async dienste(pid: string): Promise<DienstZustand[]> {
    const p = this.projekt(pid)
    const ds = this.projekte.datei(p).dienste
    return Promise.all(ds.map(async (d) => ({
      name: d.name, url: d.url, start: d.start, gemeinsam: !!d.gemeinsam, zweck: d.zweck ?? '', hilfe: d.hilfe ?? '', kennung: this.projekte.dienstKennung(p, d),
      laeuft: await erreichbar(d.url),
      freigegeben: this.projekte.dienstFreigegeben(p, d),
      vonUns: this.dienstProzesse.has(`${p.id}:${d.name}`),
    })))
  }

  /**
   * Dienste, die allen Projekten offenstehen: von einem Projekt als gemeinsam hinterlegt und vom Menschen bestätigt.
   * Ohne Bestätigung nennt kein Briefing sie: was ein Projekt über sich schreibt, ist fremder Inhalt (V10).
   */
  gemeinsameDienste(): { projekt: Projekt; dienst: Dienst }[] {
    const aus: { projekt: Projekt; dienst: Dienst }[] = []
    for (const p of this.projekte.liste()) {
      if (!p.hatCoop) continue
      for (const d of this.projekte.datei(p).dienste) if (d.gemeinsam && this.projekte.dienstFreigegeben(p, d)) aus.push({ projekt: p, dienst: d })
    }
    return aus
  }

  dienstSpeichern(pid: string, d: Dienst): void {
    const p = this.projekt(pid)
    const datei = this.projekte.datei(p)
    const zeile = (s: string | undefined, n: number) => kurz((s ?? '').replace(/\s+/g, ' ').trim(), n) || undefined
    d = { name: d.name, start: d.start, url: d.url, ...(d.gemeinsam ? { gemeinsam: true, zweck: zeile(d.zweck, 200), hilfe: /^https?:\/\/\S+$/.test(d.hilfe?.trim() ?? '') ? d.hilfe!.trim() : undefined } : {}) }
    datei.dienste = [...datei.dienste.filter((x) => x.name !== d.name), d]
    this.projekte.dateiSchreiben(p, datei)
    this.emit('eingang')
  }

  /**
   * Startet einen Dienst. Mit `freigeben` bestätigt der Mensch ihn dabei; `gesehen` ist die Kennung dessen,
   * was ihm gezeigt wurde. Hat das Projekt die Angaben inzwischen geändert, gilt die Bestätigung nicht.
   */
  async dienstStarten(pid: string, name: string, freigeben = false, gesehen?: string): Promise<DienstZustand[]> {
    const p = this.projekt(pid)
    const d = this.projekte.datei(p).dienste.find((x) => x.name === name)
    if (!d) throw new Error(t('dienst.fehlt', { name }))
    if (freigeben) {
      if (gesehen !== this.projekte.dienstKennung(p, d)) throw new Error(t('dienst.geaendert', { name: kurz(name, 60) }))
      this.projekte.dienstFreigeben(p, d)
      this.emit('eingang')
    }
    if (!this.projekte.dienstFreigegeben(p, d)) throw new Error(t('dienst.unbestaetigt'))
    if (!(await erreichbar(d.url)) && d.start.trim()) {
      const log = path.join(RUNS, 'dienste', `${p.id}-${d.name.replace(/[^a-z0-9]+/gi, '-')}.log`)
      ensureDir(path.dirname(log))
      const out = fs.openSync(log, 'a')
      const proc = spawn(anmeldeShell(process.platform, process.env), ['-lc', d.start], { cwd: p.pfad, env: { ...process.env, PATH: enhancedPath() }, stdio: ['ignore', out, out] })
      const key = `${p.id}:${d.name}`
      this.dienstProzesse.set(key, proc)
      proc.on('exit', () => { this.dienstProzesse.delete(key); this.emit('dienste', p.id) })
      for (let i = 0; i < 40 && !(await erreichbar(d.url)); i++) await new Promise((r) => setTimeout(r, 250))
    }
    this.emit('dienste', p.id)
    return this.dienste(pid)
  }

  // --- Befehle der Kommandozeile (CP-09, AG-03) --------------------------

  async befehl(argv: string[], kontext: { projektPfad?: string; sitzung?: string }): Promise<{ code: number; aus: string; warteAuf?: string }> {
    try {
      return await this.befehlAusfuehren(argv, kontext)
    } catch (err) {
      return { code: 1, aus: t('befehl.fehler', { text: (err as Error).message }) }
    }
  }

  private async befehlAusfuehren(argv: string[], kontext: { projektPfad?: string; sitzung?: string }): Promise<{ code: number; aus: string; warteAuf?: string }> {
    const { pos, flag, alle } = argumente(argv)
    const [was, ...rest] = pos
    const ok = (aus: string) => ({ code: 0, aus })
    if (!was || was === 'hilfe' || was === 'help') return ok(t('befehl.hilfe'))

    const s = kontext.sitzung ? this.sitzungen.get(kontext.sitzung) : undefined
    if (was === '_ereignis') {
      if (s) this.sitzungen.ereignis(s.id, rest[0] ?? '')
      return ok('')
    }
    const p = s ? this.projekte.get(s.projektId) : kontext.projektPfad ? this.projekte.hinzufuegen(kontext.projektPfad) : null
    if (!p) throw new Error(t('befehl.keinProjekt'))
    const von = s?.id ?? 'extern'

    switch (was) {
      case 'artefakt': {
        if (rest[0] === 'neu') {
          const typ = rest[1] as ArtefaktTyp
          if (!this.projekte.typen().some((x) => x.id === typ)) throw new Error(t('befehl.typFehlt', { typ, typen: this.projekte.typen().map((x) => x.id).join(', ') }))
          if (!rest[2]) throw new Error(t('befehl.titelFehlt'))
          const a = this.neuesArtefakt(p.id, { typ, titel: rest[2], quelle: flag('quelle'), url: flag('url') })
          const d = this.projekte.datenPfad(p, a)
          return ok(`${t('befehl.angelegt', { id: a.id, typ: a.typ })}${d ? `\n${t('befehl.daten', { pfad: d })}` : ''}\n${this.projekte.anleitung(a.typ)}`)
        }
        if (rest[0] === 'import') {
          if (!rest[1] || !rest[2]) throw new Error(t('befehl.importAufruf'))
          const { artefakt, entfernt } = this.artefaktImportieren(p.id, { datei: path.isAbsolute(rest[1]) ? rest[1] : path.join(p.pfad, rest[1]), titel: rest[2], herkunft: flag('herkunft') })
          return ok(t('befehl.uebernommen', { id: artefakt.id }) + (entfernt.length ? t('befehl.entfernt', { liste: entfernt.join(', ') }) : ''))
        }
        const as = this.projekte.artefakte(p)
        if (!as.length) return ok(t('befehl.keineArtefakte', { typen: this.projekte.typen().map((x) => `${x.id} (${x.zweck})`).join('; ') }))
        return ok(as.map((a) => `${a.id}\t${a.typ}\t${a.titel}\t${this.projekte.datenPfad(p, a) ?? a.url ?? ''}`).join('\n'))
      }
      case 'zeigen': {
        if (!rest[0]) throw new Error(t('befehl.zeigenWas'))
        const z = this.zielAufloesen(p, rest[0])
        this.emit('zeigen', { ...z, ref: flag('ref') } satisfies Zeigen)
        return ok(t('befehl.geoeffnet', { ziel: rest[0] }))
      }
      case 'hinweis': {
        if (!rest[0]) throw new Error(t('befehl.hinweisText'))
        const h = pk.hinweisAnlegen(p.pfad, { von, text: rest[0], artefakt: flag('artefakt'), ref: flag('ref') })
        this.emit('hinweis', p.id, h)
        this.emit('eingang')
        return ok(t('befehl.hinweisGesetzt', { id: h.id }))
      }
      case 'frage': {
        if (!rest[0]) throw new Error(t('befehl.frageTitel'))
        const optionen = alle('option').map((o, i) => {
          const [oid, titel, beschreibung] = o.split('::')
          return titel ? { id: oid.trim(), titel: titel.trim(), beschreibung: beschreibung?.trim() } : { id: String.fromCharCode(65 + i), titel: oid.trim() }
        })
        const { frage, datei } = pk.frageAnlegen(p.pfad, { von, titel: rest[0], text: flag('text'), optionen, wartend: flag('warten') !== undefined })
        this.emit('frage', p.id, frage)
        this.emit('eingang')
        return { code: 0, aus: t(flag('warten') !== undefined ? 'befehl.frageWartet' : 'befehl.frageGestellt', { id: frage.id }), warteAuf: flag('warten') !== undefined ? datei : undefined }
      }
      case 'dienst': {
        const eigene = this.projekte.datei(p).dienste.map((d) => ({ projekt: p, dienst: d }))
        const alle = [...eigene, ...this.gemeinsameDienste().filter((g) => g.projekt.id !== p.id)]
        if (rest[0] === 'starte' && rest[1]) {
          const g = alle.find((x) => x.dienst.name === rest[1])
          if (!g) throw new Error(t('dienst.fehlt', { name: rest[1] }))
          // Gestartet wird nur, was der Mensch am Deck schon bestätigt hat (SI-07); eine Session bestätigt nichts.
          const lage = (await this.dienstStarten(g.projekt.id, g.dienst.name, false)).find((x) => x.name === g.dienst.name)
          return ok(t(lage?.laeuft ? 'befehl.dienstLaeuft' : 'befehl.dienstStartetNicht', { name: g.dienst.name, adresse: g.dienst.url }))
        }
        if (!alle.length) return ok(t('befehl.keineDienste'))
        // Dieselbe Kürzung wie im Briefing: einzeilig, begrenzt, ohne Auszeichnung.
        const eins = (s: string | undefined, n: number) => kurz((s ?? '').replace(/[\s`]+/g, ' ').trim(), n)
        const zeilen = await Promise.all(alle.map(async (g) => `${eins(g.dienst.name, 60)}\t${(await erreichbar(g.dienst.url)) ? t('befehl.dienst.laeuft') : this.projekte.dienstFreigegeben(g.projekt, g.dienst) ? t('befehl.dienst.steht') : t('befehl.dienst.unbestaetigt')}\t${eins(g.dienst.url, 120)}\t${eins(g.dienst.hilfe, 160)}\t${eins(g.projekt.name, 60)}\t${eins(g.dienst.zweck, 200)}`))
        return ok(zeilen.join('\n'))
      }
      case 'melden': {
        if (!rest[0]?.trim()) throw new Error(t('befehl.meldenAufruf'))
        const r = await this.melden(p, s, rest[0])
        return ok(r.weg === 'telegram' ? t('befehl.gemeldetTelegram') : r.fehler ? t('befehl.gemeldetErsatz', { grund: r.fehler }) : t('befehl.gemeldetMitteilung'))
      }
      case 'anfordern': {
        if (!rest[0]) throw new Error(t('befehl.anfordernAufruf'))
        if (!this.mobilEinstellung().an) throw new Error(t('befehl.mobilAus'))
        const art = flag('art') ?? 'foto'
        if (art !== 'foto' && art !== 'ton' && art !== 'beides') throw new Error(t('befehl.anfordernArt'))
        const wartend = flag('warten') !== undefined
        const a = this.anfrageNeu(p, { von, titel: rest[0], text: flag('text'), art, wartend })
        return { code: 0, aus: t(wartend ? 'befehl.angefordertWartend' : 'befehl.angefordert', { id: a.id, name: nutzer(), adresse: this.mobilAdresse() }), warteAuf: wartend ? pk.anfrageDatei(p.pfad, a.id) : undefined }
      }
      case 'anfrage': {
        if (rest[0] === '_abgeholt' && rest[1]) {
          pk.anfrageAendern(p.pfad, rest[1], (a) => { a.abgeholt = true })
          return ok('')
        }
        if (rest[0] === 'erledigt' && rest[1]) {
          pk.anfrageAendern(p.pfad, rest[1], (a) => { a.status = 'erledigt' })
          this.emit('eingang')
          return ok(t('befehl.anfrageErledigt', { id: rest[1] }))
        }
        if (rest[0] === 'zeige' && rest[1]) {
          const a = pk.anfrage(p.pfad, rest[1])
          if (!a) throw new Error(t('anfrage.fehlt', { id: rest[1] }))
          return ok(a.antwort ? pk.anfrageAlsText(p.pfad, a) : t('befehl.anfrageOffen', { id: a.id }))
        }
        const as = pk.anfragen(p.pfad)
        return ok(as.length ? as.map((a) => `${a.id}\t${a.status}\t${a.dateien.length}\t${a.titel}`).join('\n') : t('befehl.keineAnfragen'))
      }
      case 'antwort': {
        const f = pk.fragen(p.pfad).find((x) => x.id === rest[0])
        if (!f) throw new Error(t('frage.fehlt', { id: rest[0] }))
        return ok(f.antwort ? pk.antwortAlsText(f) : t('befehl.unbeantwortet'))
      }
      case 'bild': {
        if (!this.bildgeber) throw new Error(t('befehl.bildOhneFenster'))
        if (!rest[0]) throw new Error(t('befehl.bildWovon'))
        const z = this.zielAufloesen(p, rest[0])
        const a = z.artefakt ? this.projekte.artefakt(p, z.artefakt) : null
        const url = a ? this.artefaktUrl(p, a) : z.url ?? this.dateiUrl(p, z.datei!)
        const png = await this.bildgeber({ url: this.mitToken(url), breite: Number(flag('breite')) || 1280, hoehe: Number(flag('hoehe')) || 900 })
        const ziel = path.join(coopDir(p), 'ansichten', `${(a?.id ?? 'ansicht').replace(/[^a-z0-9-]/gi, '-')}-${Date.now()}.png`)
        writeFileAtomic(ziel, png)
        return ok(ziel)
      }
      case 'roadmap': {
        const aid = flag('artefakt')
        const { a, r, datei } = this.roadmap(p, aid)
        const sub = rest[0] ?? 'liste'
        if (sub === 'liste') return ok(`${rm.alsText(r)}\n\n${t('befehl.datei', { datei })}`)
        if (sub === 'zeige') {
          const punkt = rm.punkt(r, rest[1] ?? '')
          if (!punkt) throw new Error(t('roadmap.punktFehlt', { id: rest[1] }))
          return ok(rm.punktAlsText(r, punkt))
        }
        if (sub === 'status') {
          const punkt = rm.setzeStatus(r, rest[1] ?? '', rest[2] as rm.Status, s?.titel ?? von, flag('notiz'), true)
          writeJson(datei, r)
          this.merkePunkt(s, a, punkt.id)
          return ok(punkt.vorschlag ? t('befehl.vorgeschlagen', { id: punkt.id, name: nutzer() }) : t('befehl.status', { id: punkt.id, status: punkt.status }))
        }
        if (sub === 'notiz') {
          const punkt = rm.punkt(r, rest[1] ?? '')
          if (!punkt || !rest[2]) throw new Error(t('befehl.notizAufruf'))
          ;(punkt.notizen ??= []).push({ zeit: new Date().toISOString(), von: s?.titel ?? von, text: rest[2] })
          writeJson(datei, r)
          this.merkePunkt(s, a, punkt.id)
          return ok(t('befehl.notizErgaenzt', { id: punkt.id }))
        }
        if (sub === 'neu') {
          if (!rest[1]) throw new Error(t('befehl.neuAufruf'))
          const punkt: rm.Punkt = { id: rm.naechsteId(r), titel: rest[1], status: 'offen', meilenstein: flag('meilenstein'), beschreibung: flag('beschreibung'), abnahme: alle('abnahme') }
          r.punkte.push(punkt)
          const f = rm.pruefen(r)
          if (f.length) throw new Error(f.join(' '))
          writeJson(datei, r)
          this.merkePunkt(s, a, punkt.id)
          return ok(t('befehl.punktAngelegt', { id: punkt.id, artefakt: a.id }))
        }
        throw new Error(t('befehl.roadmapUnbekannt', { sub }))
      }
      case 'rueckmeldung': {
        if (rest[0] === 'erledigt') {
          const r = pk.rueckmeldungAendern(p.pfad, rest[1] ?? '', { status: 'erledigt', erledigt: { zeit: new Date().toISOString(), von, notiz: flag('notiz') } })
          await this.nachherBild(p, r)
          this.emit('dateien', p.id, 'rueckmeldungen')
          return ok(t('befehl.rueckErledigt', { id: r.id }))
        }
        const rs = pk.rueckmeldungen(p.pfad)
        return ok(rs.length ? rs.map((r) => `${r.id}\t${r.status}\t${r.artefakt?.titel ?? r.url}\t${kurz(r.notiz, 60)}`).join('\n') : t('befehl.keineRueck'))
      }
      case 'uebergabe': {
        if (!rest[0]) throw new Error(t('befehl.uebergabeAufruf'))
        const a = this.projekte.artefakte(p).find((x) => x.typ === 'uebergabe') ?? this.neuesArtefakt(p.id, { typ: 'uebergabe', titel: t('uebergabe.titel') })
        const datei = this.projekte.datenPfad(p, a)!
        const u = wt.uebergabenNormalisieren(readJson(datei, {}))
        const e: wt.Uebergabe = { id: wt.naechsteUebergabeId(u), zeit: new Date().toISOString(), von: s?.titel ?? von, stand: rest[0], offen: alle('offen').filter(Boolean), naechster: flag('naechster') || undefined }
        u.eintraege.unshift(e)
        writeJson(datei, u)
        // Die Kurzfassung steht auch an der Session (QL-02).
        if (s) this.sitzungen.aendern(s.id, { ergebnis: kurz([e.stand, e.naechster ? t('uebergabe.naechster', { text: e.naechster }) : ''].filter(Boolean).join(' '), 400) })
        return ok(t('befehl.uebergabeFest', { id: e.id, artefakt: a.id }))
      }
      case 'sitzung': {
        if (rest[0] === 'ergebnis' && rest[1] && s) {
          this.sitzungen.aendern(s.id, { ergebnis: rest[1] })
          return ok(t('befehl.ergebnisFest'))
        }
        throw new Error(t('befehl.ergebnisAufruf'))
      }
      default:
        throw new Error(t('befehl.unbekannt', { was }))
    }
  }

  private zielAufloesen(p: Projekt, ziel: string): Zeigen {
    if (/^https?:\/\//i.test(ziel)) return { projektId: p.id, url: ziel }
    const a = this.projekte.artefakt(p, ziel)
    if (a) return { projektId: p.id, artefakt: a.id }
    const abs = innerhalb(p.pfad, path.isAbsolute(ziel) ? path.relative(p.pfad, ziel) : ziel)
    if (abs && fs.existsSync(abs)) return { projektId: p.id, datei: path.relative(p.pfad, abs) }
    throw new Error(t('befehl.zielUnbekannt', { ziel }))
  }

  /** Eigene Seiten brauchen das Token; fremde Adressen bekommen es nie. */
  mitToken(url: string): string {
    // Fremder Inhalt unter /u/ bekommt das Token nie zu sehen, auch nicht in der Adresse.
    if (!url.startsWith(this.basis()) || url.startsWith(`${this.basis()}/u/`)) return url
    return url + (url.includes('?') ? '&' : '?') + `t=${this.token}`
  }

  clis(): { id: CliId; name: string; da: boolean; fortsetzenGenau: boolean }[] {
    const da = new Set(verfuegbareClis())
    return (Object.keys(ADAPTER) as CliId[]).map((c) => ({ id: c, name: ADAPTER[c].name, da: da.has(c), fortsetzenGenau: ADAPTER[c].fortsetzenGenau }))
  }
}

/**
 * Nimmt einer HTML-Seite, was sie aus dem Netz laden würde: Stylesheets, Schriften, Skripte
 * und Vorverbindungen zu fremden Adressen. Bilder und Verweise im Text bleiben stehen; die
 * Richtlinie der abgeschotteten Auslieferung lässt ohnehin nichts davon durch.
 */
export function ohneNetz(html: string): { html: string; entfernt: string[] } {
  const entfernt = new Set<string>()
  const host = (u: string) => { try { return new URL(u.startsWith('//') ? `https:${u}` : u).hostname } catch { return t('netz.fremd') } }
  const fremd = /^(?:https?:)?\/\//i
  let out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1] ?? ''
    if (!fremd.test(href)) return tag
    entfernt.add(host(href))
    return ''
  })
  out = out.replace(/<script\b[^>]*\bsrc\s*=\s*["']?((?:https?:)?\/\/[^"'\s>]+)["']?[^>]*>\s*<\/script>/gi, (_tag, src: string) => { entfernt.add(host(src)); return '' })
  out = out.replace(/@import\s+(?:url\()?["']?((?:https?:)?\/\/[^"')\s;]+)["']?\)?[^;]*;/gi, (_r, u: string) => { entfernt.add(host(u)); return '' })
  return { html: out, entfernt: [...entfernt].sort() }
}

async function erreichbar(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 700)
    const res = await fetch(url, { signal: ctl.signal })
    clearTimeout(t)
    return res.status < 500
  } catch {
    return false
  }
}

/** Zerlegt `a b --flag wert --schalter` in Positionen und Flags; Flags dürfen sich wiederholen. */
export function argumente(argv: string[]): { pos: string[]; flag: (n: string) => string | undefined; alle: (n: string) => string[] } {
  const pos: string[] = []
  const flags = new Map<string, string[]>()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--') && a.length > 2) {
      const [name, inline] = a.slice(2).split(/=(.*)/s)
      const naechstes = argv[i + 1]
      const wert = inline !== undefined ? inline : naechstes !== undefined && !naechstes.startsWith('--') ? argv[++i] : ''
      flags.set(name, [...(flags.get(name) ?? []), wert])
    } else pos.push(a)
  }
  return { pos, flag: (n) => flags.get(n)?.at(-1), alle: (n) => flags.get(n) ?? [] }
}
