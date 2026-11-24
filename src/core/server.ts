/**
 * Lokaler Server des Decks: liefert Artefakte und Typvorlagen aus, nimmt Daten
 * der Artefaktseiten und Befehle der Kommandozeile an. Nur 127.0.0.1, nur mit Token (SI-01).
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as anleitung from './anleitung'
import { APP_ROOT, BIN, TYPEN, VERBINDUNG, ensureDir, innerhalb, writeFileAtomic } from './basis'
import type { Deck } from './deck'
import * as rm from './roadmap'
import * as wt from './weitere'
import { readJson, nutzer } from './basis'
import { t, sprache, typTexte, gebiet } from '../texte'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.mp4': 'video/mp4', '.stl': 'model/stl', '.csv': 'text/csv; charset=utf-8',
}

const FONT_DIRS = ['pixelify-sans', 'atkinson-hyperlegible-next', 'jetbrains-mono'].map((n) => path.join(APP_ROOT, 'node_modules', '@fontsource', n, 'files'))

/** Seiten des Decks laden nichts aus dem Netz (AF-06, SI-04). */
/**
 * Zwei Vertrauensstufen:
 *
 * - Seiten des Decks (Typvorlagen unter `typen/`) dürfen die Schnittstelle `/api` benutzen.
 *   Skripte kommen dort nur aus `/lib/` und `/typ/`, nie aus Projektdateien.
 * - Inhalt aus dem Projekt (freie Artefakte, Dateien, HTML von Varianten) ist fremd: ein
 *   geöffnetes Repository kann ihn mitbringen. Er wird unter `/u/<lesekennung>/…` mit
 *   `sandbox` ausgeliefert, läuft damit in einer eigenen, leeren Herkunft ohne Cookie und
 *   erreicht `/api` nicht. Sonst könnte eine Seite Text in eine Session tippen lassen.
 */
function cspDeck(deck: Deck): string {
  const b = deck.basis()
  return `default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src ${b}/lib/ ${b}/typ/; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`
}
function cspFremd(deck: Deck): string {
  const b = deck.basis()
  return `sandbox allow-scripts; default-src ${b} data: blob:; script-src ${b} 'unsafe-inline'; style-src ${b} 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`
}

/** Lesekennung je Projekt: gilt nur für `/u/` und nur für dieses Projekt, nie für `/api`. */
export function leseKennung(deck: Deck, pid: string): string {
  return crypto.createHmac('sha256', deck.token).update(`lesen:${pid}`).digest('hex').slice(0, 32)
}

export function fremdBasis(deck: Deck, pid: string): string {
  return `${deck.basis()}/u/${leseKennung(deck, pid)}/p/${pid}`
}

export async function serverStarten(deck: Deck): Promise<http.Server> {
  deck.token = crypto.randomBytes(24).toString('hex')
  const sse = new Map<string, Set<http.ServerResponse>>()
  deck.on('dateien', (pid: string, was: string) => {
    for (const res of sse.get(pid) ?? []) res.write(`data: ${JSON.stringify({ art: 'dateien', was })}\n\n`)
  })
  deck.on('sitzung', (s: { projektId: string }) => {
    for (const res of sse.get(s.projektId) ?? []) res.write(`data: ${JSON.stringify({ art: 'dateien', was: 'sitzung' })}\n\n`)
  })
  deck.on('zeigen', (z: { projektId: string; artefakt?: string; ref?: string }) => {
    if (!z.ref) return
    for (const res of sse.get(z.projektId) ?? []) res.write(`data: ${JSON.stringify({ art: 'springe', artefakt: z.artefakt, ref: z.ref })}\n\n`)
  })

  const server = http.createServer((req, res) => {
    handle(deck, sse, req, res).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(t('server.fehler', { text: (err as Error).message }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  deck.port = (server.address() as { port: number }).port

  ensureDir(BIN)
  // Die Sprache steht dabei, damit der Befehl `coop` seine eigenen Meldungen in derselben schreibt.
  const verbindungSchreiben = () => {
    writeFileAtomic(VERBINDUNG, JSON.stringify({ port: deck.port, token: deck.token, pid: process.pid, sprache: sprache() }) + '\n')
    fs.chmodSync(VERBINDUNG, 0o600)
  }
  verbindungSchreiben()
  deck.on('sprache', verbindungSchreiben)
  // Der Befehl `coop` läuft mit dem Node, das im Deck steckt: kein System-Node nötig.
  const shim = `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec "${process.execPath}" "${path.join(APP_ROOT, 'dist', 'cli', 'coop.js')}" "$@"\n`
  writeFileAtomic(path.join(BIN, 'coop'), shim)
  fs.chmodSync(path.join(BIN, 'coop'), 0o755)
  return server
}

function erlaubt(deck: Deck, req: http.IncomingMessage, url: URL): { ok: boolean; setzen: boolean } {
  const tk = url.searchParams.get('t')
  if (tk && sicherGleich(tk, deck.token)) return { ok: true, setzen: true }
  if (sicherGleich(String(req.headers['x-coop-token'] ?? ''), deck.token)) return { ok: true, setzen: false }
  const cookie = /(?:^|;\s*)coop_t=([a-f0-9]+)/.exec(String(req.headers.cookie ?? ''))?.[1] ?? ''
  return { ok: sicherGleich(cookie, deck.token), setzen: false }
}

function sicherGleich(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

function senden(res: http.ServerResponse, code: number, body: string | Buffer, type = 'text/plain; charset=utf-8', extra: Record<string, string> = {}): void {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra })
  res.end(body)
}

const json = (res: http.ServerResponse, code: number, value: unknown) => senden(res, code, JSON.stringify(value), MIME['.json'])

function datei(res: http.ServerResponse, file: string | null, csp: string): void {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return senden(res, 404, t('server.nichtGefunden'))
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  // Die Richtlinie gilt für jede Antwort, nicht nur für HTML: auch ein SVG oder XML aus dem Projekt führt Skripte aus,
  // wenn es als eigenes Dokument geöffnet wird.
  senden(res, 200, fs.readFileSync(file), type, csp ? { 'content-security-policy': csp } : {})
}

async function koerper(req: http.IncomingMessage, max = 8 * 1024 * 1024): Promise<string> {
  const teile: Buffer[] = []
  let n = 0
  for await (const c of req) {
    n += (c as Buffer).length
    if (n > max) throw new Error(t('server.zuGross'))
    teile.push(c as Buffer)
  }
  return Buffer.concat(teile).toString('utf-8')
}

async function handle(deck: Deck, sse: Map<string, Set<http.ServerResponse>>, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${deck.port}`)
  const teile = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const methode = req.method ?? 'GET'

  // Schriften und Bibliotheken sind harmlos und werden von CSS ohne Cookie-Sorgen geladen.
  if (teile[0] === 'lib' && methode === 'GET') {
    // Öffentliche Bibliothek: auch abgeschottete Seiten (leere Herkunft) laden hier Stil und Schriften.
    res.setHeader('access-control-allow-origin', '*')
    const rest = teile.slice(1).join('/')
    // Texte der Typseiten in der gewählten Sprache (UI-09); `coop.t` in `/lib/coop.js` liest sie.
    if (rest === 'texte.js') return senden(res, 200, `window.COOP_TEXTE = ${JSON.stringify({ sprache: sprache(), gebiet: gebiet(), texte: typTexte() }).replace(/</g, '\\u003c')};\n`, MIME['.js'])
    if (rest === 'marked.js') return datei(res, path.join(APP_ROOT, 'node_modules', 'marked', 'lib', 'marked.umd.js'), '')
    if (teile[1] === 'fonts') {
      const name = path.basename(teile[2] ?? '')
      return datei(res, FONT_DIRS.map((d) => path.join(d, name)).find((f) => fs.existsSync(f)) ?? null, '')
    }
    return datei(res, innerhalb(path.join(TYPEN, '_lib'), rest), '')
  }

  // Fremder Inhalt aus dem Projekt: eigene Kennung im Pfad, kein Cookie, abgeschottet.
  if (teile[0] === 'u' && methode === 'GET') {
    const [, kennung, , pid, art, ...rest] = teile
    const p = pid ? deck.projekte.get(pid) : null
    if (!p || teile[2] !== 'p' || !sicherGleich(String(kennung), leseKennung(deck, p.id))) return senden(res, 403, t('server.keinZugriff'))
    if (art === 'f') return datei(res, innerhalb(p.pfad, rest.join('/')), cspFremd(deck))
    if (art === 'a') {
      const a = deck.projekte.artefakt(p, rest[0] ?? '')
      if (!a) return senden(res, 404, t('server.artefaktUnbekannt'))
      return datei(res, innerhalb(deck.projekte.artefaktDir(p, a.id), rest.slice(1).join('/') || a.einstieg || 'index.html'), cspFremd(deck))
    }
    return senden(res, 404, t('server.nichtGefunden'))
  }

  const auth = erlaubt(deck, req, url)
  if (!auth.ok) return senden(res, 403, t('server.keinZugriffDeck'))
  if (auth.setzen) res.setHeader('set-cookie', `coop_t=${deck.token}; Path=/; HttpOnly; SameSite=Strict`)
  // Schreibende Anfragen nur von eigenen Seiten oder ohne Browser (Kommandozeile).
  const origin = req.headers.origin
  if (methode !== 'GET' && origin && origin !== deck.basis()) return senden(res, 403, t('server.fremdeHerkunft'))

  if (teile[0] === 'typ' && methode === 'GET') return datei(res, innerhalb(TYPEN, teile.slice(1).join('/')), cspDeck(deck))

  // Die Anleitung des Decks (UI-11): eigene Seite, Kapitel in der gewählten Sprache.
  if (teile[0] === 'hilfe' && methode === 'GET') return datei(res, path.join(TYPEN, 'anleitung', 'index.html'), cspDeck(deck))
  if (teile[0] === 'api' && teile[1] === 'hilfe' && methode === 'GET') {
    if (!teile[2]) return json(res, 200, { sprache: sprache(), kapitel: anleitung.kapitel(sprache()) })
    const text = anleitung.lesen(sprache(), teile[2])
    return text === null ? json(res, 404, { fehler: [t('server.nichtGefunden')] }) : json(res, 200, { text })
  }

  if (teile[0] === 'api' && teile[1] === 'cli' && methode === 'POST') {
    // Nur mit dem Token im Kopf: das kann die Kommandozeile, eine Seite im Browser nicht.
    if (!sicherGleich(String(req.headers['x-coop-token'] ?? ''), deck.token)) return senden(res, 403, t('server.nurCli'))
    const b = JSON.parse(await koerper(req)) as { argv: string[]; projektPfad?: string; sitzung?: string }
    return json(res, 200, await deck.befehl(Array.isArray(b.argv) ? b.argv.map(String) : [], { projektPfad: b.projektPfad, sitzung: b.sitzung }))
  }

  const api = teile[0] === 'api'
  const weg = api ? teile.slice(1) : teile
  if (weg[0] !== 'p' || !weg[1]) return senden(res, 404, t('server.nichtGefunden'))
  const p = deck.projekte.get(weg[1])
  if (!p) return senden(res, 404, t('fehler.projektUnbekannt'))
  const [, , art, ...rest] = weg

  if (!api) {
    if (art === 'a') {
      const a = deck.projekte.artefakt(p, rest[0] ?? '')
      if (!a) return senden(res, 404, t('server.artefaktUnbekannt'))
      const sub = rest.slice(1).join('/')
      const dir = deck.projekte.artefaktDir(p, a.id)
      if (!sub && !url.pathname.endsWith('/')) return senden(res, 302, '', 'text/plain', { location: url.pathname + '/' + url.search })
      const fremd = (ziel: string) => senden(res, 302, '', 'text/plain', { location: `${fremdBasis(deck, p.id)}/${ziel.split('/').map(encodeURIComponent).join('/')}` })
      // Freie Artefakte und alle Dateien im Artefaktordner sind Inhalt des Projekts: umleiten in die abgeschottete Auslieferung.
      if (a.typ === 'frei' || sub) return fremd(`a/${a.id}/${sub}`)
      void dir
      return datei(res, path.join(TYPEN, a.typ, 'index.html'), cspDeck(deck))
    }
    if (art === 'f') return senden(res, 302, '', 'text/plain', { location: `${fremdBasis(deck, p.id)}/f/${rest.map(encodeURIComponent).join('/')}` })
    if (art === 'md') return datei(res, path.join(TYPEN, 'dokument', 'index.html'), cspDeck(deck))
    if (art === 'verlauf') return datei(res, path.join(TYPEN, 'verlauf', 'index.html'), cspDeck(deck))
    return senden(res, 404, t('server.nichtGefunden'))
  }

  if (art === 'ereignisse') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
    res.write(': verbunden\n\n')
    const set = sse.get(p.id) ?? new Set()
    sse.set(p.id, set)
    set.add(res)
    req.on('close', () => set.delete(res))
    return
  }

  if (art === 'md' && methode === 'GET') {
    const rel = rest.join('/')
    const f = innerhalb(p.pfad, rel)
    if (!f || !fs.existsSync(f)) return json(res, 404, { fehler: [t('server.dateiFehlt')] })
    return json(res, 200, { artefakt: { id: '', titel: path.basename(rel), typ: 'dokument', quelle: rel }, daten: fs.readFileSync(f, 'utf-8'), projekt: { id: p.id, name: p.name } })
  }

  if (art === 'rueckmeldungen' && methode === 'GET') {
    const a = rest[0] ? deck.projekte.artefakt(p, rest[0]) : null
    if (rest[0] && !a) return json(res, 404, { fehler: [t('server.artefaktUnbekannt')] })
    return json(res, 200, { projekt: { id: p.id, name: p.name }, artefakt: a ? { id: a.id, titel: a.titel } : null, nutzer: nutzer(), rueckmeldungen: deck.verlauf(p, a?.id) })
  }

  if (art === 'aktion' && methode === 'POST') {
    // Seiten nennen nur, was geschehen soll, und Kennungen. Den Text für die Session
    // setzt der Kern selbst zusammen: nichts, was eine Seite schickt, wird wörtlich getippt.
    const b = JSON.parse(await koerper(req)) as { art?: string; artefakt?: string; punkt?: string }
    const aktion = deck.aktionAusSeite(p, { art: String(b.art ?? ''), artefakt: String(b.artefakt ?? ''), punkt: b.punkt === undefined ? undefined : String(b.punkt) })
    if (!aktion) return json(res, 400, { fehler: [t('server.aktionFehlt')] })
    deck.emit('aktion', p.id, aktion)
    return json(res, 200, { ok: true })
  }

  if (art === 'a') {
    const a = deck.projekte.artefakt(p, rest[0] ?? '')
    if (!a) return json(res, 404, { fehler: [t('server.artefaktUnbekannt')] })
    const pfad = deck.projekte.datenPfad(p, a)
    if (methode === 'GET') {
      let daten = ''
      const fehler: string[] = []
      if (pfad) {
        try { daten = fs.readFileSync(pfad, 'utf-8') } catch { fehler.push(t('daten.fehlt', { pfad })) }
      }
      if (a.typ === 'roadmap' && daten) {
        try { fehler.push(...rm.pruefen(JSON.parse(daten))) } catch (e) { fehler.push(t('daten.keinJson', { grund: (e as Error).message })) }
      }
      if (a.typ === 'review' && daten) {
        try { fehler.push(...wt.reviewPruefen(JSON.parse(daten))) } catch (e) { fehler.push(t('daten.keinJson', { grund: (e as Error).message })) }
      }
      const sitzungen = deck.sitzungen.liste(p.id).filter((s) => s.roadmap?.artefakt === a.id)
        .map((s) => ({ id: s.id, titel: s.titel, zustand: s.zustand, punkt: s.roadmap!.punkt, ergebnis: s.ergebnis }))
      return json(res, 200, { artefakt: a, daten, datenPfad: pfad ? path.relative(p.pfad, pfad) : null, projekt: { id: p.id, name: p.name }, nutzer: nutzer(), fehler, sitzungen, ungemeldet: a.typ === 'roadmap' ? deck.aenderungenOffen(p.id, a.id) : null, fremdBasis: `${fremdBasis(deck, p.id)}/a/${a.id}/` })
    }
    if (methode === 'PUT' && rest[1] === 'daten') {
      const fehler = deck.datenSchreiben(p, a, await koerper(req))
      return json(res, fehler.length ? 422 : 200, { fehler })
    }
  }
  return json(res, 404, { fehler: [t('server.nichtGefunden')] })
}

export function verbindung(): { port: number; token: string; sprache?: string } | null {
  return readJson<{ port: number; token: string; sprache?: string } | null>(VERBINDUNG, null)
}
