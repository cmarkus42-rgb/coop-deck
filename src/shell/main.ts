/** Electron-Hülle: ein Fenster, die Brücke zur Oberfläche, Bildausgabe. Der Kern liegt in src/core. */
import { app, BrowserWindow, ipcMain, dialog, clipboard, webContents, shell, nativeTheme, session, Notification, systemPreferences } from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { HOME, ensureDir, readJson, writeJson, writeFileAtomic, stempel, innerhalb, nutzer, setzeNutzer, setzeSystemsprache } from '../core/basis'
import { Deck, type BildAuftrag } from '../core/deck'
import { serverStarten } from '../core/server'
import { Mobil } from '../core/mobil'
import { coopDir } from '../core/projekte'
import * as pk from '../core/protokoll'
import * as sp from '../core/sprache'
import type { NeueRueckmeldung } from '../core/protokoll'
import { t, sprache as anzeigesprache } from '../texte'

app.setName('Coop Deck')
app.setPath('userData', path.join(HOME, 'electron'))
if (process.env.COOP_DECK_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.COOP_DECK_DEBUG_PORT)

const MAC = process.platform === 'darwin'
const deck = new Deck()
const mobil = new Mobil(deck)
const fern = new sp.Fernbedienung()
const sprache = (): sp.SprachEinstellung => deck.einstellungen.get().sprache ?? {}
let fenster: BrowserWindow | null = null
const EINSTELLUNGEN = path.join(HOME, 'oberflaeche.json')

interface Oberflaeche {
  thema: 'dunkel' | 'hell'
  letztesProjekt?: string
  /** In der Projektleiste ist die Liste aller Projekte aufgeklappt. */
  alleProjekteOffen?: boolean
  layout: Record<string, unknown>
  fenster?: { width: number; height: number; x?: number; y?: number }
}

function einstellungen(): Oberflaeche {
  const e = readJson<Partial<Oberflaeche>>(EINSTELLUNGEN, {})
  return { thema: e.thema === 'hell' ? 'hell' : 'dunkel', letztesProjekt: e.letztesProjekt, alleProjekteOffen: e.alleProjekteOffen !== false, layout: e.layout ?? {}, fenster: e.fenster }
}

function melden(name: string, ...args: unknown[]): void {
  if (fenster && !fenster.isDestroyed()) fenster.webContents.send('ereignis', name, ...args)
}

/** Rendert eine Adresse unsichtbar zu einem PNG: der Agent sieht, was der Mensch sieht (CP-06). */
async function bild(a: BildAuftrag): Promise<Buffer> {
  const w = new BrowserWindow({
    show: false, width: a.breite, height: a.hoehe,
    // Ohne Bildschirm gerendert: ein verstecktes Fenster malt macOS nicht, sobald das Deck nicht vorn ist,
    // und das Bild käme leer zurück (gemessen am 23.11.2026).
    webPreferences: { partition: 'persist:coop', offscreen: true, backgroundThrottling: false },
  })
  try {
    w.webContents.setFrameRate(30)
    await w.loadURL(a.url)
    await new Promise((r) => setTimeout(r, 900))
    if (a.scrollY) {
      await w.webContents.executeJavaScript(`scrollTo(0, ${Math.max(0, Math.round(Number(a.scrollY) || 0))})`)
      await new Promise((r) => setTimeout(r, 200))
    }
    return (await w.webContents.capturePage()).toPNG()
  } finally {
    w.destroy()
  }
}

/**
 * Benachrichtigung (CP-05). Aus dem Hauptprozess, weil der Aufruf im Fenster still scheitert:
 * macOS lehnt Mitteilungen des ad hoc signierten Electron ab (Handtest 22.11.2026). Dann
 * springt `osascript` ein; dessen Banner trägt „Skripteditor“ als Absender und führt beim
 * Klick nicht ins Deck. Sauber wird das erst mit einer signierten App (R-13).
 */
function benachrichtige(titel: string, text: string): void {
  if (fenster?.isFocused()) return
  app.dock?.bounce('informational')
  // Den Ersatz gibt es nur unter macOS; anderswo trägt das System die Mitteilung selbst (libnotify) oder sie entfällt.
  const ersatz = () => { if (MAC) execFile('/usr/bin/osascript', ['-e', `display notification ${JSON.stringify(text)} with title ${JSON.stringify(titel)}`], () => undefined) }
  if (!Notification.isSupported()) return void ersatz()
  const n = new Notification({ title: titel, body: text })
  n.on('failed', (_e, fehler) => { console.error(`Benachrichtigung abgelehnt (${fehler}); Ersatz über osascript.`); ersatz() })
  n.on('show', () => console.error('Benachrichtigung gezeigt.'))
  n.on('click', () => { fenster?.show(); fenster?.focus() })
  n.show()
}

/** Zuletzt gemeldeter Zustand je Session: benachrichtigt wird nur beim Wechsel, nicht bei jedem Ereignis. */
const gemeldet = new Map<string, string | undefined>()

type Methoden = Record<string, (...args: any[]) => unknown>

/** Einstellungen des Kerns, wie die Oberfläche sie sieht: Name und Sprache sind immer gesetzt. */
// Geheimnisse (Schlüssel des Handy-Zugangs, Token des Telegram-Bots) gehen nicht an die Oberfläche.
const kern = () => ({ ...deck.einstellungen.get(), mobil: undefined, telegram: undefined, name: nutzer(), anzeigesprache: anzeigesprache() })

/** Was die Einstellungen zum Zugang fürs Handy zeigen. Die Adresse mit Schlüssel geht nur an das Fenster des Decks. */
function mobilLage() {
  const e = deck.mobilEinstellung()
  return { an: e.an, port: e.port, adresse: e.adresse, laeuft: mobil.port > 0, fehler: mobil.fehler, link: e.an && e.schluessel ? deck.mobilAdresse(true) : '' }
}

const methoden: Methoden = {
  zustand: () => ({
    projekte: deck.projekte.liste(), clis: deck.clis(), typen: deck.projekte.typen(), basis: deck.basis(), token: deck.token,
    startfehler: deck.startfehler(), einstellungen: einstellungen(), wurzeln: deck.projekte.wurzeln(), kern: kern(),
  }),
  kernEinstellen: (patch: { ohneRueckfragen?: boolean; name?: string; anzeigesprache?: string }) => {
    if (typeof patch.ohneRueckfragen === 'boolean') deck.einstellungen.get().ohneRueckfragen = patch.ohneRueckfragen
    if (typeof patch.name === 'string') { deck.einstellungen.get().name = patch.name.trim() || undefined; setzeNutzer(patch.name) }
    deck.einstellungen.save()
    if (patch.anzeigesprache) deck.spracheSetzen(patch.anzeigesprache)
    return kern()
  },
  // --- Sprache und Fernbedienung (VO) ---
  spracheLage: () => ({ ...sp.lage(sprache()), aktionen: sp.aktionen(), tastenVorgabe: sp.TASTEN_VORGABE, fernFehler: fern.fehler }),
  mikrofonFreigabe: async () => (MAC ? systemPreferences.askForMediaAccess('microphone') : true),
  spracheErkennen: async (ton: Uint8Array) => {
    const text = await sp.erkennen(Buffer.from(ton), sprache())
    return { text, befehl: sp.deckBefehl(text) }
  },
  sprechen: (text: string) => (sprache().ausgabe ? sp.sprechen(String(text), sprache()) : false),
  schweigen: () => sp.schweigen(),
  /** Probe aus den Einstellungen: spricht auch, wenn das Vorlesen sonst aus ist. */
  sprechProbe: () => sp.sprechen(t('voice.probe'), sprache()),
  spracheEinstellen: (patch: sp.SprachEinstellung) => {
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
    const tasten: Record<string, string> = {}
    for (const [k, v] of Object.entries(patch.tasten ?? {})) if (/^[a-z0-9_-]{1,24}$/i.test(k) && v in sp.AKTIONEN) tasten[k.toLowerCase()] = v
    deck.einstellungen.get().sprache = { modell: text(patch.modell), sprache: text(patch.sprache), ausgabe: !!patch.ausgabe, stimme: text(patch.stimme), piper: text(patch.piper), bruecke: text(patch.bruecke), tasten: Object.keys(tasten).length ? tasten : undefined }
    deck.einstellungen.save()
    fern.start(sprache().bruecke)
    return kern()
  },
  wurzelnSetzen: (w: string[]) => { deck.projekte.setWurzeln(w); deck.projekte.suchen(); return { wurzeln: deck.projekte.wurzeln(), projekte: deck.projekte.liste() } },
  /** Laufende Sessions je Projekt: danach ordnet die Projektleiste. */
  laufend: () => {
    const n: Record<string, number> = {}
    for (const s of deck.sitzungen.liste()) if (s.zustand !== 'beendet') n[s.projektId] = (n[s.projektId] ?? 0) + 1
    return n
  },
  einstellen: (patch: Partial<Oberflaeche>) => {
    const e = { ...einstellungen(), ...patch }
    writeJson(EINSTELLUNGEN, e)
    if (patch.thema) nativeTheme.themeSource = patch.thema === 'hell' ? 'light' : 'dark'
    return e
  },
  layoutSpeichern: (pid: string, layout: unknown) => {
    const e = einstellungen()
    e.layout[pid] = layout
    e.letztesProjekt = pid
    writeJson(EINSTELLUNGEN, e)
  },
  projektOeffnen: async (pid: string) => {
    const p = deck.oeffnen(pid)
    return {
      projekt: deck.projekt(pid),
      artefakte: deck.projekte.artefakte(p).map((a) => ({ ...a, adresse: deck.artefaktUrl(p, a) })),
      sitzungen: deck.sitzungen.liste(pid).map((s) => ({ ...s, schlange: deck.sitzungen.schlangenlaenge(s.id) })),
      dienste: await deck.dienste(pid),
      hinweise: p.hatCoop ? pk.hinweise(p.pfad).filter((h) => !h.gesehen) : [],
      rueckmeldungen: p.hatCoop ? pk.rueckmeldungen(p.pfad).slice(-30) : [],
      layout: einstellungen().layout[pid] ?? null,
    }
  },
  projektAendern: (pid: string, patch: object) => deck.projekte.aendern(pid, patch),
  projektHinzufuegen: async () => {
    const r = await dialog.showOpenDialog(fenster!, { properties: ['openDirectory'], title: t('dialog.projektWaehlen') })
    if (r.canceled || !r.filePaths[0]) return null
    return deck.projekte.hinzufuegen(r.filePaths[0])
  },
  vorlagen: () => deck.projekte.vorlagen(),
  ordnerWaehlen: async () => {
    const r = await dialog.showOpenDialog(fenster!, { properties: ['openDirectory', 'createDirectory'], title: t('dialog.ordnerWaehlen') })
    return r.canceled ? null : r.filePaths[0] ?? null
  },
  projektAusVorlage: (o: Parameters<Deck['projektAusVorlage']>[0]) => deck.projektAusVorlage(o),
  projekteSuchen: () => { deck.projekte.suchen(); return deck.projekte.liste() },

  sitzungStarten: (o: Parameters<Deck['sitzungStarten']>[0]) => deck.sitzungStarten(o),
  sitzungFortsetzen: (sid: string) => deck.sitzungFortsetzen(sid),
  sitzungBeenden: (sid: string) => deck.sitzungen.beenden(sid),
  sitzungEntfernen: (sid: string) => deck.sitzungen.entfernen(sid),
  sitzungAendern: (sid: string, patch: object) => deck.sitzungen.aendern(sid, patch),
  verbinden: (sid: string, cols: number, rows: number) => deck.sitzungen.verbinden(sid, cols, rows),
  jetztZustellen: (sid: string) => deck.sitzungen.jetztZustellen(sid),
  auftragSenden: (sid: string, text: string) => deck.sitzungen.zustellen(sid, text),
  suche: (frage: string, hier?: string) => deck.suche(frage, hier),
  briefingVorschau: (pid: string, s: { titel: string; zweck?: string; roadmap?: { artefakt: string; punkt: string } }) =>
    deck.briefing(deck.projekt(pid), { id: 'vorschau', titel: s.titel || t('sitzung.neu'), zweck: s.zweck, roadmap: s.roadmap }),

  artefaktNeu: (pid: string, o: Parameters<Deck['neuesArtefakt']>[1]) => {
    const p = deck.projekt(pid)
    const a = deck.neuesArtefakt(pid, o)
    return { ...a, adresse: deck.artefaktUrl(p, a) }
  },
  dateiAdresse: (pid: string, rel: string) => deck.dateiUrl(deck.projekt(pid), rel),
  pfadZuAdresse: (pid: string, pfad: string) => {
    const p = deck.projekt(pid)
    const abs = innerhalb(p.pfad, path.isAbsolute(pfad) ? path.relative(p.pfad, pfad) : pfad)
    return abs && fs.existsSync(abs) && fs.statSync(abs).isFile() ? deck.dateiUrl(p, path.relative(p.pfad, abs)) : null
  },

  rueckmeldungVorschau: (_pid: string, n: NeueRueckmeldung) => deck.rueckmeldungVorschau(n),
  rueckmeldungSenden: async (pid: string, n: NeueRueckmeldung, wcId: number | null, sofort: boolean) => {
    let bildPng: Buffer | undefined
    if (wcId != null) {
      try { bildPng = (await webContents.fromId(wcId)!.capturePage()).toPNG() } catch { /* ohne Bild senden: der Text genügt */ }
    }
    return deck.rueckmeldungSenden(pid, { ...n, bildPng }, sofort)
  },

  eingang: () => deck.eingang(),
  frageBeantworten: (pid: string, fid: string, antwort: { option?: string; text?: string }) => deck.frageBeantworten(pid, fid, antwort),
  hinweisGesehen: (pid: string, hid: string) => { pk.hinweisGesehen(deck.projekt(pid).pfad, hid); melden('eingang') },
  anfrageGesehen: (pid: string, aid: string) => deck.anfrageGesehen(pid, aid),
  zeigeDatei: (pid: string, rel: string) => { deck.emit('zeigen', { projektId: pid, datei: String(rel) }) },
  // --- Melden über Telegram (CP-13) ---
  telegramLage: () => deck.telegramLage(),
  telegramEinstellen: (patch: { an?: boolean; token?: string; chat?: string; tokenLoeschen?: boolean }) => { deck.telegramEinstellen(patch); return deck.telegramLage() },
  telegramProbe: () => deck.telegramProbe(),
  // --- Zugang für Handy und Tablet (CP-12) ---
  mobilLage,
  mobilEinstellen: async (patch: { an?: boolean; port?: number; adresse?: string; neuerSchluessel?: boolean }) => {
    deck.mobilEinstellen(patch)
    await mobil.anwenden()
    return mobilLage()
  },

  dienste: (pid: string) => deck.dienste(pid),
  dienstSpeichern: (pid: string, d: { name: string; start: string; url: string }) => deck.dienstSpeichern(pid, d),
  dienstStarten: (pid: string, name: string, freigeben: boolean) => deck.dienstStarten(pid, name, freigeben),

  /** Bild aus der Zwischenablage im Projekt ablegen und den Pfad zurückgeben (QL-04). */
  ablageBild: async (pid: string) => {
    for (const item of await clipboard.read()) {
      const typ = item.types.find((t) => t.startsWith('image/'))
      if (!typ) continue
      const blob = (await item.getType(typ)) as Blob
      const endung = typ === 'image/jpeg' ? 'jpg' : typ.split('/')[1].replace(/[^a-z0-9]/g, '') || 'png'
      const ziel = path.join(coopDir(deck.projekt(pid)), 'ablage', `${stempel()}.${endung}`)
      writeFileAtomic(ziel, Buffer.from(await blob.arrayBuffer()))
      return ziel
    }
    return null
  },
  /** Hineingezogene Datei: liegt sie schon im Projekt, genügt der Pfad; sonst Kopie in die Ablage (QL-03). */
  ablageDatei: (pid: string, quelle: string) => {
    const p = deck.projekt(pid)
    if (path.resolve(quelle).startsWith(path.resolve(p.pfad) + path.sep)) return quelle
    const ziel = path.join(coopDir(p), 'ablage', `${stempel()}-${path.basename(quelle)}`)
    ensureDir(path.dirname(ziel))
    fs.copyFileSync(quelle, ziel)
    return ziel
  },
  externOeffnen: (url: string) => { if (/^https?:\/\//.test(url)) void shell.openExternal(url) },
}

async function fensterOeffnen(): Promise<void> {
  const e = einstellungen()
  nativeTheme.themeSource = e.thema === 'hell' ? 'light' : 'dark'
  fenster = new BrowserWindow({
    width: e.fenster?.width ?? 1560, height: e.fenster?.height ?? 980, x: e.fenster?.x, y: e.fenster?.y,
    minWidth: 980, minHeight: 600, title: 'Coop Deck',
    backgroundColor: e.thema === 'hell' ? '#ddd7ee' : '#305560',
    // macOS: eigene Kopfzeile mit den Ampelknöpfen darin. Sonst der Rahmen des Systems, die Menüleiste bleibt bis Alt verborgen.
    ...(MAC ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 14 } } : { autoHideMenuBar: true, icon: path.join(__dirname, '..', '..', 'build', 'icon.png') }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: true, spellcheck: false },
  })
  fenster.on('close', () => {
    if (!fenster) return
    const b = fenster.getBounds()
    writeJson(EINSTELLUNGEN, { ...einstellungen(), fenster: b })
  })
  fenster.on('closed', () => { fenster = null })
  await fenster.loadFile(path.join(__dirname, '..', 'ui', 'index.html'))

  // Selbstprüfung: Fensterbild in eine Datei, für Tests ohne Bildschirm.
  const bildArg = process.argv.find((a) => a.startsWith('--fensterbild='))
  if (bildArg) {
    const [ziel, ms] = bildArg.slice('--fensterbild='.length).split('@')
    setTimeout(async () => {
      if (!fenster) return
      fs.writeFileSync(ziel, (await fenster.webContents.capturePage()).toPNG())
    }, Number(ms) || 4000)
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { fenster?.show(); fenster?.focus() })

  app.on('web-contents-created', (_e, wc) => {
    // Artefakt- und Web-Reiter: feste Voreinstellungen, kein Node, eigene Markier-Ebene.
    wc.on('will-attach-webview', (_ev, prefs, params) => {
      prefs.preload = path.join(__dirname, 'ansicht-preload.js')
      prefs.nodeIntegration = false
      prefs.contextIsolation = true
      delete (prefs as Record<string, unknown>).preloadURL
      if (params.partition !== 'persist:coop' && params.partition !== 'persist:web') params.partition = 'persist:web'
    })
    if (wc.getType() === 'webview') {
      wc.setWindowOpenHandler(({ url }) => {
        melden('neuer-reiter', url)
        return { action: 'deny' }
      })
    }
  })

  app.whenReady().then(async () => {
    setzeSystemsprache(app.getPreferredSystemLanguages()[0])
    await deck.start()
    await serverStarten(deck)
    await mobil.anwenden()
    deck.bildgeber = bild

    // Das Mikrofon bekommt nur das Fenster des Decks selbst (VO-01), keine Artefaktansicht.
    session.defaultSession.setPermissionRequestHandler((wc, erlaubnis, cb) => cb(erlaubnis === 'media' && wc === fenster?.webContents))
    fern.on('taste', (taste: string) => melden('fernbedienung', (sprache().tasten ?? sp.TASTEN_VORGABE)[taste] ?? null, taste))
    fern.start(sprache().bruecke)
    app.on('before-quit', () => { fern.stop(); sp.schweigen() })

    // Eigene Seiten dürfen nichts aus dem Netz laden; das sichert zusätzlich zur CSP (SI-04).
    session.fromPartition('persist:coop').webRequest.onBeforeRequest((d, cb) => {
      const u = new URL(d.url)
      const lokal = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'devtools:' || u.protocol === 'about:'
      cb({ cancel: !lokal })
    })

    ipcMain.handle('deck', async (_e, name: string, ...args: unknown[]) => {
      const m = methoden[name]
      if (!m) throw new Error(t('fehler.methodeUnbekannt', { name }))
      return m(...args)
    })
    ipcMain.on('eingabe', (_e, sid: string, data: string) => deck.sitzungen.eingabe(sid, data))
    ipcMain.on('groesse', (_e, sid: string, cols: number, rows: number) => deck.sitzungen.groesse(sid, cols, rows))

    for (const name of ['ausgabe', 'sitzung', 'schlange', 'eingang', 'dateien', 'zeigen', 'hinweis', 'frage', 'aktion', 'dienste']) {
      deck.on(name, (...args: unknown[]) => melden(name, ...args))
    }
    deck.on('sitzung', (s: { id: string; titel: string; achtung?: 'fertig' | 'wartet' }) => {
      if (s.achtung && gemeldet.get(s.id) !== s.achtung) benachrichtige(`Coop Deck — ${s.titel}`, t(s.achtung === 'fertig' ? 'nachricht.fertig' : 'nachricht.wartet'))
      gemeldet.set(s.id, s.achtung)
    })
    deck.on('frage', (_pid: string, f: { titel: string }) => benachrichtige(t('nachricht.frage'), f.titel))
    deck.on('melden', (kopf: string, text: string) => benachrichtige(`Coop Deck — ${kopf}`, text))
    // Was eine Session meldet, wird auch gesprochen, wenn das Vorlesen an ist: wer am Rechner sitzt, hört es, ohne hinzusehen.
    deck.on('gemeldet', (kopf: string, text: string) => { if (sprache().ausgabe) sp.sprechen(`${kopf}. ${text}`, sprache()) })
    deck.on('anfrage', (_pid: string, a: { titel: string; von: string }) => { if (a.von !== 'handy') benachrichtige(t('nachricht.anfrage'), a.titel) })
    await fensterOeffnen()
  })

  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => { void mobil.stop(); deck.stop() })
}
