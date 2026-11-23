/**
 * Zugang für Handy und Tablet (CP-12, UI-10): ein eigener kleiner Server neben dem des Decks.
 * Er kennt die Anfragen (Fotos und Ton liefern) und den Eingang (lesen, eine Option wählen, abhaken) und nichts von der Schnittstelle
 * `/api` des Decks: wer ihn erreicht, erreicht weder Sessions noch Projektdateien.
 *
 * Er lauscht wie alles am Deck nur auf `127.0.0.1` (SI-01). Aufs Handy kommt er über einen
 * Weiterleiter, den der Mensch selbst einrichtet (zum Beispiel `tailscale serve`); der bringt
 * auch das HTTPS mit, ohne das ein Browser kein Mikrofon freigibt.
 *
 * Zutritt nur mit dem Schlüssel aus den Einstellungen: einmal in der Adresse (`/?k=…`), danach
 * als Cookie. Schreibende Aufrufe brauchen zusätzlich einen eigenen Kopf, den eine fremde Seite
 * im Browser nicht setzen kann. Ohne das könnte jede Webseite auf diesem Rechner Dateien und
 * eine Notiz einliefern, und die Notiz landet bei einer Session.
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { APP_ROOT, ensureDir, nutzer } from './basis'
import type { Deck } from './deck'
import * as pk from './protokoll'
import { t, sprache, mobilTexte } from '../texte'

const SEITE = path.join(APP_ROOT, 'mobil')
const FONT_DIRS = ['pixelify-sans', 'atkinson-hyperlegible-next', 'jetbrains-mono'].map((n) => path.join(APP_ROOT, 'node_modules', '@fontsource', n, 'files'))
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.heif': 'image/heif',
}
const CSP = "default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
/** Größte einzelne Datei. Ein Video vom Handy passt, ein versehentlich gewähltes Archiv nicht. */
export const GRENZE = 300 * 1024 * 1024
/** So lange bleibt Abgeschicktes auf dem Handy sichtbar, um etwas nachzureichen. */
const SICHTBAR_MS = 12 * 60 * 60 * 1000

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y)
}

export class Mobil {
  private server: http.Server | null = null
  /** Der Port, auf dem tatsächlich gelauscht wird; 0, solange der Zugang aus ist. */
  port = 0
  fehler: string | null = null

  constructor(private deck: Deck) {}

  /** Bringt den Server auf den Stand der Einstellungen: starten, anhalten oder auf einen anderen Port umziehen. */
  async anwenden(): Promise<void> {
    const e = this.deck.mobilEinstellung()
    const soll = e.an ? e.port : -1
    if (this.server && soll === this.port) return
    await this.stop()
    this.fehler = null
    if (!e.an) return
    const server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(t('server.fehler', { text: (err as Error).message }))
      })
    })
    try {
      await new Promise<void>((ok, nein) => { server.once('error', nein); server.listen(e.port, '127.0.0.1', ok) })
    } catch (err) {
      this.fehler = t('mobil.portBelegt', { port: e.port, grund: (err as Error).message })
      return
    }
    this.server = server
    this.port = (server.address() as { port: number }).port
    this.deck.mobilPort = this.port
  }

  async stop(): Promise<void> {
    const s = this.server
    this.server = null
    this.port = 0
    this.deck.mobilPort = 0
    if (s) {
      s.closeAllConnections()
      await new Promise<void>((ok) => s.close(() => ok()))
    }
  }

  private erlaubt(req: http.IncomingMessage, url: URL): { ok: boolean; setzen: boolean } {
    const schluessel = this.deck.mobilEinstellung().schluessel
    if (!schluessel) return { ok: false, setzen: false }
    if (gleich(url.searchParams.get('k') ?? '', schluessel)) return { ok: true, setzen: true }
    const cookie = /(?:^|;\s*)coop_handy=([a-f0-9]+)/.exec(String(req.headers.cookie ?? ''))?.[1] ?? ''
    return { ok: gleich(cookie, schluessel), setzen: false }
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://handy')
    const methode = req.method ?? 'GET'
    const kopf: Record<string, string> = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': CSP }
    const senden = (code: number, body: string | Buffer, type = 'text/plain; charset=utf-8', extra: Record<string, string> = {}) => { res.writeHead(code, { 'content-type': type, ...kopf, ...extra }); res.end(body) }
    const json = (code: number, wert: unknown) => senden(code, JSON.stringify(wert), 'application/json; charset=utf-8')
    const verwerfen = (code: number, text: string) => { req.resume(); senden(code, text, 'text/plain; charset=utf-8', { connection: 'close' }) }

    const auth = this.erlaubt(req, url)
    if (!auth.ok) return verwerfen(403, t('mobil.keinZutritt'))
    if (auth.setzen) res.setHeader('set-cookie', `coop_handy=${this.deck.mobilEinstellung().schluessel}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`)

    if (methode === 'GET') {
      const datei = (f: string | null) => (f && fs.existsSync(f) && fs.statSync(f).isFile() ? senden(200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] ?? 'application/octet-stream') : senden(404, t('server.nichtGefunden')))
      if (url.pathname === '/') {
        // Der Schlüssel soll nicht in der Adresszeile stehen bleiben: nach dem Setzen des Cookies ohne ihn weiter.
        // Als Symbol auf dem Startbildschirm bleibt die Adresse mit Schlüssel erhalten und setzt das Cookie neu.
        return datei(path.join(SEITE, 'index.html'))
      }
      if (url.pathname === '/app.js' || url.pathname === '/stil.css') return datei(path.join(SEITE, url.pathname.slice(1)))
      if (url.pathname === '/texte.js') return senden(200, `window.COOP_TEXTE = ${JSON.stringify({ sprache: sprache(), texte: mobilTexte() }).replace(/</g, '\\u003c')};\n`, MIME['.js'])
      if (url.pathname.startsWith('/fonts/')) {
        const name = path.basename(url.pathname)
        return datei(FONT_DIRS.map((d) => path.join(d, name)).find((f) => fs.existsSync(f)) ?? null)
      }
      if (url.pathname === '/api/lage') return json(200, this.lage())
      if (url.pathname === '/api/datei') {
        const ziel = this.ziel(url)
        const d = ziel?.a.dateien.find((x) => x.name === url.searchParams.get('name') && x.art === 'bild')
        if (!ziel || !d) return senden(404, t('server.nichtGefunden'))
        // Nur Bilder, und als eigenes Dokument geöffnet ohne jedes Recht.
        return senden(200, fs.readFileSync(path.join(pk.anfrageOrdner(ziel.p.pfad, ziel.a.id), d.name)), MIME[path.extname(d.name)] ?? 'application/octet-stream', { 'content-security-policy': "sandbox; default-src 'none'" })
      }
      return senden(404, t('server.nichtGefunden'))
    }

    if (methode !== 'POST') return verwerfen(405, t('server.nichtGefunden'))
    // Eine fremde Seite im Browser kann diesen Kopf nicht setzen, ohne vorher zu fragen; die Frage beantwortet hier niemand.
    if (req.headers['x-coop-handy'] !== '1') return verwerfen(403, t('mobil.keinZutritt'))
    const herkunft = req.headers.origin
    if (herkunft && herkunft !== 'null') {
      let host = ''
      try { host = new URL(herkunft).host } catch { /* keine Adresse */ }
      const eigen = [req.headers.host, req.headers['x-forwarded-host']].flat().filter(Boolean)
      if (!eigen.includes(host)) return verwerfen(403, t('server.fremdeHerkunft'))
    }

    if (url.pathname === '/api/neu') {
      const b = JSON.parse(await text(req)) as { projekt?: string; sitzung?: string; titel?: string }
      const p = this.deck.projekte.get(String(b.projekt ?? ''))
      if (!p) return json(404, { fehler: t('fehler.projektUnbekannt') })
      const s = b.sitzung ? this.deck.sitzungen.get(String(b.sitzung)) : undefined
      const a = this.deck.anfrageNeu(p, { von: 'handy', an: s && s.projektId === p.id ? s.id : undefined, titel: String(b.titel ?? '').trim() || t('mobil.ohneTitel'), art: 'beides' })
      return json(200, { id: a.id, projekt: p.id })
    }

    // --- Eingang des Decks (UI-10): antworten nur durch Wahl einer Option, die die Session selbst vorgegeben hat.
    if (url.pathname === '/api/antwort' || url.pathname === '/api/gesehen') {
      const b = JSON.parse((await text(req)) || '{}') as { option?: string; art?: string }
      const p = this.deck.projekte.get(url.searchParams.get('p') ?? '')
      const kennung = url.searchParams.get('id') ?? ''
      if (!p) return json(404, { fehler: t('fehler.projektUnbekannt') })
      if (url.pathname === '/api/antwort') {
        const f = pk.fragen(p.pfad).find((x) => x.id === kennung)
        if (!f || f.antwort) return json(404, { fehler: t('frage.fehlt', { id: kennung }) })
        if (!f.optionen.some((o) => o.id === b.option)) return json(400, { fehler: t('mobil.optionFehlt') })
        this.deck.frageBeantworten(p.id, f.id, { option: String(b.option) })
        return json(200, { ok: true })
      }
      if (b.art === 'hinweis') {
        if (!pk.hinweise(p.pfad).some((h) => h.id === kennung)) return json(404, { fehler: t('server.nichtGefunden') })
        pk.hinweisGesehen(p.pfad, kennung)
      } else if (b.art === 'sitzung') {
        const s = this.deck.sitzungen.get(kennung)
        if (!s || s.projektId !== p.id) return json(404, { fehler: t('server.nichtGefunden') })
        this.deck.sitzungen.aendern(s.id, { achtung: undefined })
      } else return json(400, { fehler: t('server.nichtGefunden') })
      this.deck.emit('eingang')
      return json(200, { ok: true })
    }

    const ziel = this.ziel(url)
    if (!ziel) return verwerfen(404, t('anfrage.fehlt', { id: url.searchParams.get('id') ?? '' }))
    const { p, a } = ziel

    if (url.pathname === '/api/hochladen') {
      if (Number(req.headers['content-length'] ?? 0) > GRENZE) return verwerfen(413, t('server.zuGross'))
      const ordner = pk.anfrageOrdner(p.pfad, a.id)
      ensureDir(ordner)
      const teil = path.join(ordner, `.${crypto.randomBytes(6).toString('hex')}.teil`)
      let n = 0
      try {
        const aus = fs.createWriteStream(teil)
        for await (const c of req) {
          n += (c as Buffer).length
          if (n > GRENZE) throw new Error(t('server.zuGross'))
          if (!aus.write(c)) await new Promise<void>((ok) => aus.once('drain', () => ok()))
        }
        await new Promise<void>((ok, nein) => { aus.once('error', nein); aus.end(() => ok()) })
        if (!n) throw new Error(t('mobil.leer'))
      } catch (err) {
        fs.rmSync(teil, { force: true })
        return verwerfen(n > GRENZE ? 413 : 400, (err as Error).message)
      }
      this.deck.anfrageHochgeladen(p, a.id, teil, String(req.headers['content-type'] ?? ''), url.searchParams.get('name') ?? '', n)
      return json(200, { ok: true })
    }
    const b = JSON.parse((await text(req)) || '{}') as { name?: string; notiz?: string }
    if (url.pathname === '/api/loeschen') {
      this.deck.anfrageEntfernen(p, a.id, String(b.name ?? ''))
      return json(200, { ok: true })
    }
    if (url.pathname === '/api/senden') {
      this.deck.anfrageSenden(p, a.id, String(b.notiz ?? ''))
      return json(200, { ok: true })
    }
    return senden(404, t('server.nichtGefunden'))
  }

  private ziel(url: URL): { p: NonNullable<ReturnType<Deck['projekte']['get']>>; a: pk.Anfrage } | null {
    const p = this.deck.projekte.get(url.searchParams.get('p') ?? '')
    const a = p ? pk.anfrage(p.pfad, url.searchParams.get('id') ?? '') : null
    return p && a && a.status !== 'erledigt' ? { p, a } : null
  }

  /** Was die Seite zeigt: offene und frisch abgeschickte Anfragen aller Projekte, dazu die Projekte, an die man von sich aus etwas schicken kann. */
  lage(): object {
    const jetzt = Date.now()
    const anfragen: object[] = []
    const projekte: { id: string; name: string; zuletzt: number; sitzungen: { id: string; titel: string }[] }[] = []
    for (const p of this.deck.projekte.liste()) {
      const laufend = this.deck.sitzungen.liste(p.id).filter((s) => s.zustand !== 'beendet')
      if ((p.hatCoop && !p.ausgeblendet) || laufend.length) projekte.push({ id: p.id, name: p.name, zuletzt: laufend.length ? jetzt : p.zuletzt || 0, sitzungen: laufend.map((s) => ({ id: s.id, titel: s.titel })) })
      if (!p.hatCoop) continue
      for (const a of pk.anfragen(p.pfad)) {
        if (a.status === 'erledigt' || (a.status === 'geliefert' && jetzt - Date.parse(a.geliefert ?? a.zeit) > SICHTBAR_MS)) continue
        const s = this.deck.sitzungen.get(a.von === 'handy' ? a.an ?? '' : a.von)
        anfragen.push({
          id: a.id, projektId: p.id, projekt: p.name, sitzung: s?.titel ?? null, frei: a.von === 'handy', titel: a.titel, text: a.text ?? '', art: a.art, status: a.status,
          zeit: a.zeit, notiz: a.notiz ?? '', dateien: a.dateien.map((d) => ({ name: d.name, art: d.art, wartet: !!d.wartet, text: d.text ?? '', fehler: d.fehler ?? '' })),
        })
      }
    }
    anfragen.sort((x, y) => ((x as { status: string }).status === (y as { status: string }).status ? (y as { zeit: string }).zeit.localeCompare((x as { zeit: string }).zeit) : (x as { status: string }).status === 'offen' ? -1 : 1))
    projekte.sort((x, y) => y.zuletzt - x.zuletzt || x.name.localeCompare(y.name))
    // Was am Deck im Eingang steht und sich ohne Rechner erledigen lässt: fertige und wartende Sessions, Fragen, Hinweise.
    const eingang = this.deck.eingang().filter((e) => e.art === 'sitzung' || e.art === 'frage' || e.art === 'hinweis').map((e) => {
      const s = e.sitzung ? this.deck.sitzungen.get(e.sitzung) : undefined
      return {
        art: e.art, projektId: e.projektId, projekt: e.projekt, kennung: e.kennung, titel: e.titel, text: e.art === 'hinweis' ? '' : e.text ?? '', zeit: e.zeit,
        sitzung: s?.titel ?? null, ergebnis: e.art === 'sitzung' ? s?.ergebnis ?? '' : '',
        optionen: e.frage ? e.frage.optionen.map((o) => ({ id: o.id, titel: o.titel, beschreibung: o.beschreibung ?? '' })) : [],
      }
    })
    return { nutzer: nutzer(), eingang, anfragen, projekte: projekte.slice(0, 30).map(({ zuletzt: _z, ...rest }) => rest) }
  }
}

async function text(req: http.IncomingMessage, max = 64 * 1024): Promise<string> {
  const teile: Buffer[] = []
  let n = 0
  for await (const c of req) {
    n += (c as Buffer).length
    if (n > max) throw new Error(t('server.zuGross'))
    teile.push(c as Buffer)
  }
  return Buffer.concat(teile).toString('utf-8')
}
