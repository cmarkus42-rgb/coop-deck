import { render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import '@xterm/xterm/css/xterm.css'
import './stil.css'
import { deck, ruf, type Artefakt, type Cli, type Dienst, type Hinweis, type Layout, type Marke, type Posten, type Projekt, type Raum, type Sicht, type Sitzung, type SprachLage, type Treffer, type Zustand } from './bruecke'
import * as T from './terminal'
import { Dialoge, type DialogArt } from './dialoge'
import { gebiet, setzeSprache, sprache, t, tIn, SPRACHEN, type Schluessel, type Sprache } from '../texte'
import { befehl, kuerzel } from './plattform'

interface Reiter { key: string; art: 'artefakt' | 'web' | 'datei'; id?: string; titel: string; adresse: string; partition: string }
interface MenuePunkt { titel?: string; neben?: string; aktion?: () => void; trenner?: boolean; abschnitt?: string }
interface Menue { x: number; y: number; punkte: MenuePunkt[] }
// Schlüssel statt Text: übersetzt wird erst beim Rendern, sonst wirkt ein Sprachwechsel nicht.
const WERKZEUGE: [string, Schluessel, Schluessel][] = [
  ['zeigen', 'ui.werkzeug.zeigen', 'ui.werkzeug.zeigen.hilfe'],
  ['rahmen', 'ui.werkzeug.rahmen', 'ui.werkzeug.rahmen.hilfe'],
  ['pfeil', 'ui.werkzeug.pfeil', 'ui.werkzeug.pfeil.hilfe'],
  ['freihand', 'ui.werkzeug.freihand', 'ui.werkzeug.freihand.hilfe'],
  ['text', 'ui.werkzeug.text', 'ui.werkzeug.text.hilfe'],
]

// --- Ansichten (webview) leben außerhalb von Preact, damit Reiter beim Umschalten ihren Zustand behalten.
const ansichten = new Map<string, any>()
let ansichtEreignis: (key: string, name: string, daten?: any) => void = () => undefined
const wartendeSpruenge = new Map<string, string>()

function springe(key: string, ref: string): void {
  const wv = ansichten.get(key)
  if (!wv) return
  const js = `window.coopSpringe && window.coopSpringe(${JSON.stringify(ref)})`
  try { wv.executeJavaScript(js).catch(() => undefined) } catch { wartendeSpruenge.set(key, ref) }
}

function Ansichten(p: { reiter: Reiter[]; aktiv: string | null; zieht: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current!
    for (const r of p.reiter) {
      if (ansichten.has(r.key)) continue
      const wv = document.createElement('webview') as any
      wv.setAttribute('partition', r.partition)
      wv.setAttribute('src', r.adresse)
      wv.setAttribute('allowpopups', '')
      wv.addEventListener('ipc-message', (e: any) => ansichtEreignis(r.key, e.channel, e.args?.[0]))
      wv.addEventListener('did-navigate', (e: any) => ansichtEreignis(r.key, 'adresse', e.url))
      wv.addEventListener('did-navigate-in-page', (e: any) => { if (e.isMainFrame) ansichtEreignis(r.key, 'adresse', e.url) })
      wv.addEventListener('page-title-updated', (e: any) => ansichtEreignis(r.key, 'titel', e.title))
      wv.addEventListener('dom-ready', () => {
        ansichtEreignis(r.key, 'bereit')
        const ref = wartendeSpruenge.get(r.key)
        if (ref) { wartendeSpruenge.delete(r.key); setTimeout(() => springe(r.key, ref), 350) }
      })
      ansichten.set(r.key, wv)
      el.append(wv)
    }
    for (const [key, wv] of ansichten) {
      if (!p.reiter.some((r) => r.key === key)) { wv.remove(); ansichten.delete(key) }
      else wv.classList.toggle('vorn', key === p.aktiv)
    }
  }, [p.reiter, p.aktiv])
  return <div ref={host} class={`ansichten${p.zieht ? ' zieht' : ''}`} />
}

function TerminalFlaeche(p: { sid: string; projektId: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current!
    const tm = T.terminal(p.sid)
    el.replaceChildren(tm.el)
    const passe = () => void T.anpassen(p.sid)
    const ro = new ResizeObserver(passe)
    ro.observe(el)
    passe()
    tm.term.focus()
    // Bild aus der Zwischenablage: ablegen und den Pfad eintippen (QL-04).
    const einfuegen = async (e: ClipboardEvent) => {
      if (![...(e.clipboardData?.items ?? [])].some((i) => i.type.startsWith('image/'))) return
      e.preventDefault()
      e.stopPropagation()
      const pfad = await ruf<string | null>('ablageBild', p.projektId)
      if (pfad) deck.eingabe(p.sid, pfad + ' ')
    }
    const fallen = async (e: DragEvent) => {
      e.preventDefault()
      for (const f of [...(e.dataTransfer?.files ?? [])]) {
        const quelle = deck.pfadVon(f)
        if (quelle) deck.eingabe(p.sid, (await ruf<string>('ablageDatei', p.projektId, quelle)) + ' ')
      }
    }
    const ueber = (e: DragEvent) => e.preventDefault()
    el.addEventListener('paste', einfuegen, true)
    el.addEventListener('drop', fallen)
    el.addEventListener('dragover', ueber)
    return () => { ro.disconnect(); el.removeEventListener('paste', einfuegen, true); el.removeEventListener('drop', fallen); el.removeEventListener('dragover', ueber) }
  }, [p.sid])
  return <div ref={host} class="terminal" />
}

function led(s: Sitzung): string {
  return s.zustand === 'beendet' ? 'beendet' : s.achtung ?? s.zustand
}

function bezugKurz(m: Marke) {
  const b = m.bezug
  if (b.label) return <><b>{b.label}</b>{b.ref && b.ref !== b.label ? ` (${b.ref})` : ''}{b.datei ? t('ui.bezug.in', { datei: `${b.datei}${b.zeile ? `:${b.zeile}` : ''}` }) : ''}</>
  return <><span class="geschaetzt">{t('ui.bezug.geschaetzt')}</span>{b.inhalt ? t('ui.bezug.zitat', { inhalt: b.inhalt.slice(0, 90) }) : null}<span class="mono">{b.selektor}</span></>
}

interface Eintrag { titel: string; neben?: string; text?: string; aktion: () => void }
const ART_NAME: Record<Treffer['art'], Schluessel> = { projekt: 'ui.art.projekt', sitzung: 'ui.art.sitzung', artefakt: 'ui.art.artefakt', punkt: 'ui.art.punkt', rueckmeldung: 'ui.art.rueckmeldung' }

/** Befehlspalette (UI-05): tippen, mit den Pfeilen wählen, Eingabe. Sucht über alle Projekte (QL-09). */
function Palette({ fest, hier, waehle, zu }: { fest: Eintrag[]; hier?: string; waehle: (tr: Treffer) => void; zu: () => void }) {
  const [frage, setFrage] = useState('')
  const [treffer, setTreffer] = useState<Treffer[]>([])
  const [wahl, setWahl] = useState(0)
  const liste = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let gilt = true
    if (!frage.trim()) { setTreffer([]); return }
    const timer = setTimeout(() => void ruf<Treffer[]>('suche', frage, hier).then((x) => { if (gilt) setTreffer(x) }).catch(() => undefined), 90)
    return () => { gilt = false; clearTimeout(timer) }
  }, [frage])
  const worte = frage.toLowerCase().split(/\s+/).filter(Boolean)
  const eintraege: Eintrag[] = [
    ...fest.filter((e) => worte.every((w) => `${e.titel} ${e.neben ?? ''}`.toLowerCase().includes(w))),
    ...treffer.map((tr) => ({ titel: tr.art === 'punkt' ? `${tr.kennung} ${tr.titel}` : tr.titel, neben: `${t(ART_NAME[tr.art])}${tr.projektId === hier ? '' : ` · ${tr.projekt}`}`, text: tr.art === 'projekt' || tr.art === 'artefakt' ? undefined : tr.text, aktion: () => waehle(tr) })),
  ]
  const i = Math.min(wahl, Math.max(0, eintraege.length - 1))
  useEffect(() => { liste.current?.children[i]?.scrollIntoView({ block: 'nearest' }) }, [i, eintraege.length])
  return (
    <div class="schleier" onMouseDown={(e) => { if (e.target === e.currentTarget) zu() }}>
      <div class="palette">
        <input class="feld" autofocus spellcheck={false} placeholder={t('ui.palette.feld')} value={frage}
          ref={(n) => n?.focus()}
          onInput={(e) => { setFrage((e.target as HTMLInputElement).value); setWahl(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setWahl(Math.min(i + 1, eintraege.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setWahl(Math.max(i - 1, 0)) }
            if (e.key === 'Enter' && eintraege[i]) { e.preventDefault(); zu(); eintraege[i].aktion() }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu() }
          }} />
        <div class="liste" ref={liste}>
          {eintraege.map((e, n) => (
            <button class={`punkt${n === i ? ' gewaehlt' : ''}`} onMouseEnter={() => setWahl(n)} onClick={() => { zu(); e.aktion() }}>
              <span class="haupt"><span class="titel">{e.titel}</span>{e.text ? <span class="text">{e.text}</span> : null}</span>
              {e.neben ? <span class="neben">{e.neben}</span> : null}
            </button>
          ))}
          {!eintraege.length && <div class="leer">{frage.trim() ? t('ui.palette.nichts') : t('ui.palette.tippe')}</div>}
        </div>
        <footer><span>{t('ui.palette.waehlen')}</span><span>{t('ui.palette.oeffnen')}</span><span>{t('ui.palette.zu')}</span></footer>
      </div>
    </div>
  )
}

function App() {
  const [z, setZ] = useState<Zustand | null>(null)
  const [raum, setRaum] = useState<Raum | null>(null)
  const [aktivS, setAktivS] = useState<string | null>(null)
  const [versteckt, setVersteckt] = useState<string[]>([])
  const [reiter, setReiter] = useState<Reiter[]>([])
  const [aktivR, setAktivR] = useState<string | null>(null)
  const [adresse, setAdresse] = useState('')
  const [sicht, setSicht] = useState<Sicht>('beide')
  const [teilung, setTeilung] = useState(0.46)
  const [zieht, setZieht] = useState(false)
  const [leisteZu, setLeisteZu] = useState(false)
  const [suche, setSuche] = useState('')
  const [laufend, setLaufend] = useState<Record<string, number>>({})
  const [alleOffen, setAlleOffen] = useState(true)
  const [ausgeblendetOffen, setAusgeblendetOffen] = useState(false)
  const [eingang, setEingang] = useState<Posten[]>([])
  const [eingangOffen, setEingangOffen] = useState(false)
  const [dialog, setDialog] = useState<DialogArt | null>(null)
  const [menue, setMenue] = useState<Menue | null>(null)
  const [palette, setPalette] = useState(false)
  const [diktat, setDiktat] = useState<'aus' | 'nimmt' | 'erkennt'>('aus')
  const aufnahme = useRef<{ rec: MediaRecorder; strom: MediaStream; feld: HTMLInputElement | HTMLTextAreaElement | null } | null>(null)
  const aktion = useRef<(a: string | null, name?: string) => void>(() => undefined)
  const [werkzeug, setWerkzeug] = useState<string | null>(null)
  const [marken, setMarken] = useState<Record<string, Marke[]>>({})
  const [notizen, setNotizen] = useState<Record<string, string>>({})
  const [rueckOffen, setRueckOffen] = useState(false)
  const [ziel, setZiel] = useState<string>('aktiv')
  const [vorschau, setVorschau] = useState<string | null>(null)
  const [hinweise, setHinweise] = useState<Hinweis[]>([])
  const [meldung, setMeldung] = useState<string | null>(null)
  const [thema, setThema] = useState<'dunkel' | 'hell'>('dunkel')
  const [freiText, setFreiText] = useState<Record<string, string>>({})
  const stand = useRef({ raum, aktivS, reiter, aktivR, z, werkzeug })
  stand.current = { raum, aktivS, reiter, aktivR, z, werkzeug }
  const zaehler = useRef(0)

  const melde = (text: string) => { setMeldung(text); setTimeout(() => setMeldung((m) => (m === text ? null : m)), 6000) }
  const versuche = async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    try { return await fn() } catch (e) { melde(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); return undefined }
  }

  // --- Reiter rechts -----------------------------------------------------

  const mitToken = (adr: string) => {
    const zz = stand.current.z
    return zz && adr.startsWith(zz.basis) && !adr.startsWith(zz.basis + '/u/') ? adr + (adr.includes('?') ? '&' : '?') + 't=' + zz.token : adr
  }
  const lokal = (adr: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(adr) || adr === 'about:blank'

  const oeffneArtefakt = (a: Artefakt, ref?: string) => {
    const key = `a:${a.id}`
    if (ref) wartendeSpruenge.set(key, ref)
    setReiter((rs) => rs.some((r) => r.key === key) ? rs : [...rs, { key, art: 'artefakt', id: a.id, titel: a.titel, adresse: mitToken(a.adresse), partition: lokal(a.adresse) ? 'persist:coop' : 'persist:web' }])
    setAktivR(key)
    if (ref && ansichten.has(key)) { wartendeSpruenge.delete(key); setTimeout(() => springe(key, ref), 100) }
    setSicht((s) => (s === 'links' ? 'beide' : s))
  }
  const oeffneAdresse = (adr: string, titel?: string) => {
    const eigen = !!stand.current.z && adr.startsWith(stand.current.z.basis)
    const key = `${eigen ? 'd' : 'w'}:${++zaehler.current}:${Date.now()}`
    setReiter((rs) => [...rs, { key, art: eigen ? 'datei' : 'web', titel: titel ?? (adr === 'about:blank' ? t('ui.reiter.neu') : adr.replace(/^https?:\/\//, '').slice(0, 28)), adresse: mitToken(adr), partition: lokal(adr) ? 'persist:coop' : 'persist:web' }])
    setAktivR(key)
    setSicht((s) => (s === 'links' ? 'beide' : s))
  }
  /** Ziel aus Terminal oder Adresszeile: Adresse, Artefakt oder Datei im Projekt. */
  const oeffneZiel = async (text: string) => {
    const zt = text.trim()
    const r = stand.current.raum
    if (!zt || !r) return
    if (/^https?:\/\//i.test(zt) || zt === 'about:blank') return oeffneAdresse(zt)
    const a = r.artefakte.find((x) => x.id === zt)
    if (a) return oeffneArtefakt(a)
    const adr = await ruf<string | null>('pfadZuAdresse', r.projekt.id, zt)
    if (adr) return oeffneAdresse(adr, zt.split('/').pop())
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(zt) || /^(localhost|127\.0\.0\.1)(:|\/|$)/.test(zt)) return oeffneAdresse((/^(localhost|127\.)/.test(zt) ? 'http://' : 'https://') + zt)
    melde(t('ui.reiter.zielUnbekannt', { ziel: zt }))
  }
  const schliesseReiter = (key: string) => {
    setReiter((rs) => {
      const i = rs.findIndex((r) => r.key === key)
      const neu = rs.filter((r) => r.key !== key)
      if (stand.current.aktivR === key) setAktivR(neu[Math.max(0, i - 1)]?.key ?? null)
      return neu
    })
    setMarken((m) => { const n = { ...m }; delete n[key]; return n })
  }

  // --- Projekt -----------------------------------------------------------

  // Jede Änderung an einer Session meldet der Kern auch als „eingang“: dabei kommt die Zahl der laufenden Sessions mit.
  const ladeEingang = () => { void ruf<Posten[]>('eingang').then(setEingang); void ruf<Record<string, number>>('laufend').then(setLaufend) }
  const auffrischen = async () => {
    const r = stand.current.raum
    if (!r) return
    const neu = await versuche(() => ruf<Raum>('projektOeffnen', r.projekt.id))
    if (!neu || stand.current.raum?.projekt.id !== neu.projekt.id) return
    setRaum(neu)
    setHinweise(neu.hinweise)
    setReiter((rs) => rs.map((x) => { const a = x.art === 'artefakt' ? neu.artefakte.find((y) => y.id === x.id) : null; return a ? { ...x, titel: a.titel } : x }))
  }

  const waehleProjekt = async (pid: string) => {
    // Das offene Projekt noch einmal zu wählen ändert nichts. Früher warf das seine Terminals weg, und sie blieben leer.
    if (stand.current.raum?.projekt.id === pid) return
    const r = await versuche(() => ruf<Raum>('projektOeffnen', pid))
    if (!r) return
    for (const s of stand.current.raum?.sitzungen ?? []) T.vergessen(s.id)
    setWerkzeug(null); setMarken({}); setNotizen({}); setRueckOffen(false); setVorschau(null); setVersteckt([])
    setRaum(r)
    T.setzeProjektPfad(r.projekt.pfad)
    setHinweise(r.hinweise)
    const l: Layout | null = r.layout
    const rs: Reiter[] = []
    for (const e of l?.reiter ?? []) {
      const a = e.art === 'artefakt' ? r.artefakte.find((x) => x.id === e.id) : null
      if (a) rs.push({ key: `a:${a.id}`, art: 'artefakt', id: a.id, titel: a.titel, adresse: mitToken(a.adresse), partition: lokal(a.adresse) ? 'persist:coop' : 'persist:web' })
      else if (e.art === 'web' && e.adresse) rs.push({ key: `w:${++zaehler.current}:${Date.now()}`, art: 'web', titel: e.titel ?? e.adresse, adresse: e.adresse, partition: lokal(e.adresse) ? 'persist:coop' : 'persist:web' })
    }
    // Erstes Öffnen: die Artefakte des Projekts liegen auf dem Tisch (BR-04).
    if (!rs.length) for (const a of r.artefakte.slice(0, 5)) rs.push({ key: `a:${a.id}`, art: 'artefakt', id: a.id, titel: a.titel, adresse: mitToken(a.adresse), partition: lokal(a.adresse) ? 'persist:coop' : 'persist:web' })
    setReiter(rs)
    setAktivR(rs.find((x) => x.key === l?.aktiv)?.key ?? rs[0]?.key ?? null)
    if (l?.teilung) setTeilung(l.teilung)
    setSicht(l?.sicht ?? 'beide')
    const laufend = r.sitzungen.filter((s) => s.zustand !== 'beendet')
    setAktivS(laufend.at(-1)?.id ?? null)
    setZ((zz) => zz && { ...zz, projekte: zz.projekte.map((p) => (p.id === pid ? { ...p, zuletzt: Date.now() } : p)) })
    for (const d of r.dienste) if (d.freigegeben && !d.laeuft) void ruf('dienstStarten', pid, d.name, false).then(() => auffrischen()).catch(() => undefined)
    if (!laufend.length) {
      if (r.projekt.autostart === 'neu') void starteSitzung({ projektId: pid })
      const letzte = r.sitzungen.filter((s) => s.art === 'cli').at(-1)
      if (r.projekt.autostart === 'fortsetzen' && letzte) void versuche(() => ruf<Sitzung>('sitzungFortsetzen', letzte.id)).then((s) => s && setAktivS(s.id))
    }
  }

  // --- Sessions ----------------------------------------------------------

  const starteSitzung = async (o: Record<string, unknown>) => {
    const s = await versuche(() => ruf<Sitzung>('sitzungStarten', o))
    if (s) { setAktivS(s.id); setSicht((x) => (x === 'rechts' ? 'beide' : x)) }
    return s
  }
  const waehleSitzung = (sid: string) => {
    setAktivS(sid)
    const s = stand.current.raum?.sitzungen.find((x) => x.id === sid)
    if (s?.achtung) void ruf('sitzungAendern', sid, { achtung: undefined })
  }

  // --- Ereignisse aus dem Kern ------------------------------------------

  useEffect(() => {
    T.beiLink((ziel) => void oeffneZiel(ziel))
    let frischTimer: ReturnType<typeof setTimeout> | null = null
    const frisch = () => { if (frischTimer) clearTimeout(frischTimer); frischTimer = setTimeout(() => void auffrischen(), 200) }
    let eingangTimer: ReturnType<typeof setTimeout> | null = null
    deck.bei((name, ...a) => {
      const r = stand.current.raum
      if (name === 'ausgabe') return T.ausgabe(a[0], a[1], a[2])
      if (name === 'eingang') { if (eingangTimer) clearTimeout(eingangTimer); eingangTimer = setTimeout(ladeEingang, 250); return }
      if (name === 'sitzung') {
        const s = a[0] as Sitzung
        if (r && s.projektId === r.projekt.id) {
          const alt = r.sitzungen.find((x) => x.id === s.id)
          setRaum((rr) => rr && { ...rr, sitzungen: rr.sitzungen.some((x) => x.id === s.id) ? rr.sitzungen.map((x) => (x.id === s.id ? { ...x, ...s } : x)) : [...rr.sitzungen, s] })
          if (s.zustand === 'beendet' && alt?.zustand !== 'beendet') T.zuruecksetzen(s.id)
        }
        return
      }
      if (name === 'schlange') return setRaum((rr) => rr && { ...rr, sitzungen: rr.sitzungen.map((x) => (x.id === a[0] ? { ...x, schlange: a[1] } : x)) })
      if (name === 'dateien' || name === 'dienste') {
        if (!r || a[0] !== r.projekt.id) return
        frisch()
        // Freie Artefakte laufen abgeschottet und können nicht selbst nachladen: das Deck lädt sie neu.
        const m = /^artefakte\/([^/]+)\//.exec(String(a[1] ?? ''))
        const art = m && r.artefakte.find((x) => x.id === m[1] && x.typ === 'frei')
        if (art) { try { ansichten.get(`a:${art.id}`)?.reload() } catch { /* lädt noch */ } }
        return
      }
      if (name === 'hinweis') {
        if (r && a[0] === r.projekt.id) setHinweise((h) => [...h, a[1]])
        // Vorlesen nur für die Session im Fokus (VO-05).
        if (stand.current.z?.kern.sprache?.ausgabe && a[1]?.von === stand.current.aktivS) void ruf('sprechen', String(a[1].text ?? ''))
        return
      }
      if (name === 'frage') {
        setEingangOffen(true)
        if (stand.current.z?.kern.sprache?.ausgabe && a[1]?.von === stand.current.aktivS) void ruf('sprechen', t('ui.vorlesen.frage', { titel: String(a[1].titel ?? '') }))
        return
      }
      if (name === 'fernbedienung') return aktion.current(a[0], a[1])
      if (name === 'neuer-reiter') return void oeffneZiel(a[0])
      if (name === 'zeigen') {
        void (async () => {
          const zg = a[0] as { projektId: string; artefakt?: string; url?: string; datei?: string; ref?: string }
          if (stand.current.raum?.projekt.id !== zg.projektId) await waehleProjekt(zg.projektId)
          const rr = await ruf<Raum>('projektOeffnen', zg.projektId)
          const art = zg.artefakt ? rr.artefakte.find((x) => x.id === zg.artefakt) : null
          if (art) oeffneArtefakt(art, zg.ref)
          else if (zg.url) oeffneAdresse(zg.url)
          else if (zg.datei) oeffneAdresse(await ruf<string>('dateiAdresse', zg.projektId, zg.datei), zg.datei.split('/').pop())
        })()
        return
      }
      if (name === 'aktion') {
        const akt = a[1] as { art: string; artefakt?: string; punkt?: string; titel?: string; text?: string }
        if (!r || a[0] !== r.projekt.id) return
        if (akt.art === 'sitzung-starten') setDialog({ art: 'sitzung', roadmap: { artefakt: akt.artefakt!, punkt: akt.punkt!, titel: akt.titel ?? akt.punkt! } })
        if (akt.art === 'sitzung-neu' && akt.text) setDialog({ art: 'sitzung', auftrag: akt.text, titel: akt.titel })
        if (akt.art === 'auftrag' && akt.text) {
          const sid = stand.current.aktivS
          const s = r.sitzungen.find((x) => x.id === sid && x.zustand !== 'beendet')
          if (s) void versuche(() => ruf('auftragSenden', s.id, akt.text))
          else setDialog({ art: 'sitzung', auftrag: akt.text })
        }
      }
    })
    void ruf<Zustand>('zustand').then((zz) => {
      setzeSprache(zz.kern.anzeigesprache)
      document.documentElement.lang = sprache()
      setZ(zz)
      stand.current.z = zz
      setThema(zz.einstellungen.thema)
      setAlleOffen(zz.einstellungen.alleProjekteOffen !== false)
      if (zz.startfehler.length) melde(zz.startfehler.join(' '))
      const start = zz.projekte.find((p) => p.id === zz.einstellungen.letztesProjekt)
      if (start) void waehleProjekt(start.id)
    })
    ladeEingang()
    const taste = (e: KeyboardEvent) => {
      if (befehl(e, 'alt') && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); setSicht(['links', 'beide', 'rechts'][Number(e.key) - 1] as Sicht) }
      if (befehl(e) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); setPalette((p) => !p) }
      if (befehl(e, 'umschalt') && e.key.toLowerCase() === 'd') { e.preventDefault(); e.stopPropagation(); aktion.current('diktat') }
      if (e.key === 'Escape') { setMenue(null); setEingangOffen(false); setPalette(false) }
    }
    window.addEventListener('keydown', taste, true)
    return () => window.removeEventListener('keydown', taste, true)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.thema = thema
    T.setzeThema(thema)
  }, [thema])

  // Layout merken (PS-03), entprellt.
  useEffect(() => {
    if (!raum) return
    const timer = setTimeout(() => {
      const l: Layout = { reiter: reiter.map((r) => ({ art: r.art, id: r.id, adresse: r.art === 'web' ? r.adresse : undefined, titel: r.titel })), aktiv: aktivR ?? undefined, teilung, sicht }
      void ruf('layoutSpeichern', raum.projekt.id, l)
    }, 600)
    return () => clearTimeout(timer)
  }, [raum?.projekt.id, reiter, aktivR, teilung, sicht])

  // Ereignisse aus den Ansichten: Marken, Adresse, Titel.
  ansichtEreignis = (key, name, daten) => {
    if (name === 'coop-marke') {
      setMarken((m) => ({ ...m, [key]: [...(m[key] ?? []), { ...daten, text: '' }] }))
      setRueckOffen(true)
      setTimeout(() => (document.querySelector(`[data-marke="${daten.nr}"]`) as HTMLElement | null)?.focus(), 60)
    }
    if (name === 'coop-abbruch') setWerkzeug(null)
    if (name === 'adresse' && key === stand.current.aktivR) setAdresse(ohneToken(daten))
    if (name === 'adresse') setReiter((rs) => rs.map((r) => (r.key === key && r.art === 'web' ? { ...r, adresse: daten } : r)))
    if (name === 'titel') setReiter((rs) => rs.map((r) => (r.key === key && r.art === 'web' && daten ? { ...r, titel: String(daten).slice(0, 40) } : r)))
    if (name === 'bereit' && key === stand.current.aktivR && stand.current.werkzeug) ansichten.get(key)?.send('coop-werkzeug', stand.current.werkzeug)
  }
  const ohneToken = (u: string) => String(u).replace(/([?&])t=[a-f0-9]{16,}&?/, '$1').replace(/[?&]$/, '')

  useEffect(() => {
    const r = reiter.find((x) => x.key === aktivR)
    let adr = r?.adresse ?? ''
    try { adr = ansichten.get(aktivR ?? '')?.getURL() || adr } catch { /* noch nicht geladen */ }
    setAdresse(ohneToken(adr))
    setVorschau(null)
    for (const [key, wv] of ansichten) { try { wv.send('coop-werkzeug', key === aktivR ? werkzeug : null) } catch { /* Ansicht lädt noch */ } }
  }, [aktivR, werkzeug])

  useEffect(() => { if (aktivS) setTimeout(() => void T.anpassen(aktivS), 30) }, [sicht, teilung, leisteZu, aktivS])

  // --- Rückmeldung -------------------------------------------------------

  const aktuelleMarken = aktivR ? marken[aktivR] ?? [] : []
  const aktuelleNotiz = aktivR ? notizen[aktivR] ?? '' : ''
  const laufende = (raum?.sitzungen ?? []).filter((s) => s.zustand !== 'beendet')
  const zielSitzung = ziel === 'aktiv' ? laufende.find((s) => s.id === aktivS) ?? laufende.at(-1) : laufende.find((s) => s.id === ziel)

  const baueRueckmeldung = async () => {
    const r = reiter.find((x) => x.key === aktivR)!
    const wv = ansichten.get(r.key)
    let ansicht = { breite: 0, hoehe: 0, scrollX: 0, scrollY: 0 }
    let kontext: unknown
    try {
      const a = await wv.executeJavaScript('({breite:innerWidth,hoehe:innerHeight,scrollX:Math.round(scrollX),scrollY:Math.round(scrollY),kontext:(typeof window.__coop_kontext__==="function"?window.__coop_kontext__():undefined)})')
      ansicht = { breite: a.breite, hoehe: a.hoehe, scrollX: a.scrollX, scrollY: a.scrollY }
      kontext = a.kontext
    } catch { /* fremde Seite ohne Zugriff: Ansicht bleibt leer */ }
    const art = r.art === 'artefakt' ? raum!.artefakte.find((x) => x.id === r.id) : null
    const ms = aktuelleMarken.map((m, i) => ({ ...m, bezug: i === 0 && kontext !== undefined ? { ...m.bezug, kontext } : m.bezug }))
    return {
      n: { artefakt: art ? { id: art.id, titel: art.titel, typ: art.typ } : undefined, url: ohneToken(adresse || r.adresse), ansicht, notiz: aktuelleNotiz, marken: ms, ziel: ziel === 'neu' ? null : zielSitzung?.id ?? null },
      wcId: (() => { try { return wv.getWebContentsId() as number } catch { return null } })(),
      key: r.key,
    }
  }
  const zeigeVorschau = async () => {
    if (vorschau !== null) return setVorschau(null)
    const { n } = await baueRueckmeldung()
    setVorschau((await versuche(() => ruf<string>('rueckmeldungVorschau', raum!.projekt.id, n))) ?? null)
  }
  const sende = async () => {
    if (!raum || !aktivR) return
    if (!aktuelleMarken.length && !aktuelleNotiz.trim()) return melde(t('ui.rueck.nichts'))
    if (ziel !== 'neu' && !zielSitzung) return melde(t('ui.rueck.keineSitzung'))
    const { n, wcId, key } = await baueRueckmeldung()
    const erg = await versuche(() => ruf<{ id: string; md: string }>('rueckmeldungSenden', raum.projekt.id, n, wcId, false))
    if (!erg) return
    if (ziel === 'neu') await starteSitzung({ projektId: raum.projekt.id, titel: t('ui.rueck.sitzungTitel', { titel: n.artefakt?.titel ?? '' }).trim(), auftrag: n.artefakt ? t('ui.rueck.auftragZu', { titel: n.artefakt.titel, md: erg.md }) : t('ui.rueck.auftrag', { md: erg.md }) })
    ansichten.get(key)?.send('coop-leeren')
    setMarken((m) => ({ ...m, [key]: [] }))
    setNotizen((x) => ({ ...x, [key]: '' }))
    setWerkzeug(null); setVorschau(null); setRueckOffen(false)
  }
  const entferneMarke = (nr: number) => {
    if (!aktivR) return
    ansichten.get(aktivR)?.send('coop-entfernen', nr)
    setMarken((m) => ({ ...m, [aktivR]: (m[aktivR] ?? []).filter((x) => x.nr !== nr) }))
  }

  // --- Darstellung -------------------------------------------------------

  if (!z) return <div class="leer"><h2>{t('ui.startet')}</h2></div>
  const aktiveSitzung = raum?.sitzungen.find((s) => s.id === aktivS) ?? null
  const reiterS = (raum?.sitzungen ?? []).filter((s) => (s.zustand !== 'beendet' || s.id === aktivS) && !versteckt.includes(s.id))
  const abgelegt = (raum?.sitzungen ?? []).filter((s) => s.zustand === 'beendet')
  const aktiverReiter = reiter.find((r) => r.key === aktivR) ?? null
  const achtungJe = (pid: string) => eingang.filter((p) => p.projektId === pid && p.art !== 'schlange').length
  // Projektleiste: immer in Sicht ist, was läuft, und was Favorit ist. Alles andere steht in einer Liste, die sich
  // zuklappen lässt; einzelne Projekte lassen sich daraus ausblenden. Die Suche findet alles, auch Ausgeblendetes.
  const nachBenutzung = (a: Projekt, b: Projekt) => b.zuletzt - a.zuletzt || a.name.localeCompare(b.name, gebiet())
  const sucht = suche.trim().toLowerCase()
  const passend = z.projekte.filter((p) => !sucht || p.name.toLowerCase().includes(sucht)).sort(nachBenutzung)
  const mitSessions = passend.filter((p) => laufend[p.id])
  const favoriten = passend.filter((p) => !laufend[p.id] && p.favorit)
  const uebrige = passend.filter((p) => !laufend[p.id] && !p.favorit && (!p.ausgeblendet || !!sucht))
  const ausgeblendete = sucht ? [] : passend.filter((p) => !laufend[p.id] && !p.favorit && p.ausgeblendet)
  const projektSetzen = (pid: string, patch: Partial<Pick<Projekt, 'favorit' | 'ausgeblendet'>>) => {
    void ruf('projektAendern', pid, patch)
    setZ((zz) => zz && { ...zz, projekte: zz.projekte.map((x) => (x.id === pid ? { ...x, ...patch } : x)) })
  }
  const dringend = eingang.filter((p) => p.art !== 'schlange').length
  const clisDa = z.clis.filter((c) => c.da)

  const menueBei = (e: MouseEvent, punkte: MenuePunkt[]) => {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenue({ x: Math.max(8, Math.min(b.left, innerWidth - 390)), y: b.bottom + 4, punkte })
  }
  const sitzungsMenue = (e: MouseEvent) => menueBei(e, [
    { abschnitt: t('ui.neueSitzung') },
    ...clisDa.map((c) => ({ titel: c.name, neben: c.id === raum!.projekt.cli ? t('ui.menue.vorgabe') : '', aktion: () => void starteSitzung({ projektId: raum!.projekt.id, cli: c.id }) })),
    { titel: t('ui.menue.mitTitel'), aktion: () => setDialog({ art: 'sitzung' }) },
    { titel: t('ui.terminalOhneCli'), aktion: () => void starteSitzung({ projektId: raum!.projekt.id, art: 'terminal' }) },
    ...(abgelegt.length ? [{ trenner: true }, { abschnitt: t('ui.menue.abgelegt') }, ...abgelegt.slice(-12).reverse().map((s) => ({ titel: s.titel, neben: new Date(s.aktiv).toLocaleDateString(gebiet()), aktion: () => { setVersteckt((v) => v.filter((x) => x !== s.id)); setAktivS(s.id) } }))] : []),
  ])
  const artefaktMenue = (e: MouseEvent) => menueBei(e, [
    ...(raum!.artefakte.length ? [{ abschnitt: t('ui.menue.artefakte') }, ...raum!.artefakte.map((a) => ({ titel: a.titel, neben: a.typ, aktion: () => oeffneArtefakt(a) })), { trenner: true }] : []),
    { titel: t('ui.menue.neuesArtefakt'), aktion: () => setDialog({ art: 'artefakt' }) },
    { titel: t('ui.leererReiter'), aktion: () => oeffneAdresse('about:blank') },
  ])

  // --- Sprache und Fernbedienung (VO) ------------------------------------

  /** Wohin das Diktat geht: in das Feld, in dem der Cursor steht, sonst in die Session vorn (VO-03). */
  const diktatFeld = (): HTMLInputElement | HTMLTextAreaElement | null => {
    const el = document.activeElement
    return el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === 'text')) && !el.closest('.xterm') ? el : null
  }
  const diktatZiel = () => {
    const f = aufnahme.current ? aufnahme.current.feld : diktatFeld()
    if (f) return t('ui.diktat.zielFeld')
    return aktiveSitzung && aktiveSitzung.zustand !== 'beendet' ? t('ui.diktat.zielSitzung', { titel: aktiveSitzung.titel }) : t('ui.diktat.keinZiel')
  }
  const diktatStart = async () => {
    const l = await versuche(() => ruf<SprachLage>('spracheLage'))
    if (!l) return
    if (!l.erkennung) return melde(t('ui.diktat.gehtNicht', { grund: l.fehlt.join(' ') }))
    const feld = diktatFeld()
    try {
      if (!(await ruf<boolean>('mikrofonFreigabe'))) return melde(t('ui.diktat.keinMikrofon'))
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(strom)
      const teile: Blob[] = []
      rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data) }
      rec.onstop = async () => {
        strom.getTracks().forEach((spur) => spur.stop())
        aufnahme.current = null
        setDiktat('erkennt')
        try {
          const ton = new Uint8Array(await new Blob(teile).arrayBuffer())
          const r = await ruf<{ text: string; befehl: { aktion: string; name?: string } | null }>('spracheErkennen', ton)
          if (r.befehl) aktion.current(r.befehl.aktion, r.befehl.name)
          else if (!r.text) melde(t('ui.diktat.nichts'))
          else if (feld?.isConnected) {
            feld.setRangeText((feld.value && !/\s$/.test(feld.value.slice(0, feld.selectionStart ?? feld.value.length)) ? ' ' : '') + r.text, feld.selectionStart ?? feld.value.length, feld.selectionEnd ?? feld.value.length, 'end')
            feld.dispatchEvent(new Event('input', { bubbles: true }))
          } else if (stand.current.aktivS) deck.eingabe(stand.current.aktivS, r.text)
          else melde(t('ui.diktat.keinZielFuer', { text: r.text }))
        } catch (e) { melde(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')) }
        setDiktat('aus')
      }
      aufnahme.current = { rec, strom, feld }
      rec.start()
      setDiktat('nimmt')
    } catch (e) { melde(t('ui.diktat.mikrofon', { grund: String((e as Error).message ?? e) })) }
  }
  /** Aktion aus Fernbedienung, Sprachbefehl oder Tastatur. Der Name ist eine Kennung aus der festen Liste. */
  aktion.current = (a, name) => {
    const sid = stand.current.aktivS
    const kreis = <T,>(liste: T[], i: number, d: number): T | undefined => (liste.length ? liste[(i + d + liste.length) % liste.length] : undefined)
    const sichtbare = laufende.filter((s) => !versteckt.includes(s.id))
    switch (a) {
      case 'diktat': if (aufnahme.current) aufnahme.current.rec.stop(); else if (diktat === 'aus') void diktatStart(); break
      case 'senden': if (sid) deck.eingabe(sid, '\r'); break
      case 'abbrechen': if (aufnahme.current) { aufnahme.current.rec.onstop = null; aufnahme.current.rec.stop(); aufnahme.current.strom.getTracks().forEach((spur) => spur.stop()); aufnahme.current = null; setDiktat('aus') } else if (sid) deck.eingabe(sid, '\x15'); break
      case 'session-vor': case 'session-zurueck': { const n = kreis(sichtbare, sichtbare.findIndex((s) => s.id === sid), a === 'session-vor' ? 1 : -1); if (n) setAktivS(n.id); break }
      case 'reiter-vor': case 'reiter-zurueck': { const n = kreis(reiter, reiter.findIndex((r) => r.key === aktivR), a === 'reiter-vor' ? 1 : -1); if (n) setAktivR(n.key); break }
      case 'hoch': case 'runter':
        if (sicht === 'rechts' && aktivR) { try { void ansichten.get(aktivR)?.executeJavaScript(`scrollBy(0, ${a === 'hoch' ? '-' : ''}innerHeight * 0.8)`) } catch { /* lädt noch */ } }
        else if (sid) deck.eingabe(sid, a === 'hoch' ? '\x1b[5~' : '\x1b[6~')
        break
      case 'eingang': setEingangOffen(true); break
      case 'projekt': {
        const norm = (s: string) => s.toLowerCase().replace(/&/g, 'und').replace(/[^a-z0-9äöüß]+/g, '')
        const p = z?.projekte.find((x) => norm(x.name).includes(norm(name ?? '')))
        if (p) void waehleProjekt(p.id); else melde(t('ui.befehl.keinProjekt', { name: name ?? '' }))
        break
      }
      case 'unbekannt': melde(t('ui.befehl.unverstanden', { name: name ?? '' })); break
      default: if (a === null && name) melde(t('ui.befehl.tasteFrei', { name }))
    }
  }

  /** Was die Palette ohne Suche anbietet: Befehle, dazu Sessions und Artefakte des offenen Projekts. */
  const paletteFest = (): Eintrag[] => {
    const e: Eintrag[] = []
    if (raum) {
      const pid = raum.projekt.id
      for (const s of raum.sitzungen.filter((x) => x.zustand !== 'beendet')) e.push({ titel: s.titel, neben: t('ui.art.sitzung'), aktion: () => { setVersteckt((v) => v.filter((x) => x !== s.id)); setAktivS(s.id) } })
      for (const a of raum.artefakte) e.push({ titel: a.titel, neben: t('ui.art.artefakt'), aktion: () => oeffneArtefakt(a) })
      for (const c of clisDa) e.push({ titel: t('ui.palette.neueSitzungCli', { name: c.name }), neben: t('ui.palette.befehl'), aktion: () => void starteSitzung({ projektId: pid, cli: c.id }) })
      e.push({ titel: t('ui.palette.neueSitzung'), neben: t('ui.palette.befehl'), aktion: () => setDialog({ art: 'sitzung' }) })
      e.push({ titel: t('ui.terminalOhneCli'), neben: t('ui.palette.befehl'), aktion: () => void starteSitzung({ projektId: pid, art: 'terminal' }) })
      e.push({ titel: t('ui.palette.neuesArtefakt'), neben: t('ui.palette.befehl'), aktion: () => setDialog({ art: 'artefakt' }) })
      e.push({ titel: t('ui.leererReiter'), neben: t('ui.palette.befehl'), aktion: () => oeffneAdresse('about:blank') })
      e.push({ titel: t('ui.palette.verlauf'), neben: t('ui.palette.befehl'), aktion: () => oeffneAdresse(`${stand.current.z!.basis}/p/${pid}/verlauf/`, t('ui.verlauf')) })
      e.push({ titel: t('ui.palette.sichtLinks'), neben: t('ui.palette.befehl'), aktion: () => setSicht('links') })
      e.push({ titel: t('ui.palette.sichtBeide'), neben: t('ui.palette.befehl'), aktion: () => setSicht('beide') })
      e.push({ titel: t('ui.palette.sichtRechts'), neben: t('ui.palette.befehl'), aktion: () => setSicht('rechts') })
    }
    e.push({ titel: t('ui.projektAusVorlage'), neben: t('ui.palette.befehl'), aktion: () => setDialog({ art: 'projekt-neu' }) })
    e.push({ titel: t('ui.palette.diktat'), neben: t('ui.palette.befehlDiktat'), aktion: () => aktion.current('diktat') })
    e.push({ titel: t('ui.palette.eingang'), neben: t('ui.palette.befehl'), aktion: () => setEingangOffen(true) })
    e.push({ titel: t('ui.einstellungen'), neben: t('ui.palette.befehl'), aktion: () => setDialog({ art: 'einstellungen' }) })
    return e
  }
  const waehleTreffer = async (tr: Treffer) => {
    if (stand.current.raum?.projekt.id !== tr.projektId) await waehleProjekt(tr.projektId)
    if (tr.art === 'projekt') return
    if (tr.art === 'sitzung') { setVersteckt((v) => v.filter((x) => x !== tr.kennung)); setAktivS(tr.kennung); return }
    if (tr.art === 'rueckmeldung') return oeffneAdresse(`${stand.current.z!.basis}/p/${tr.projektId}/verlauf/${tr.artefakt ?? ''}`, t('ui.verlauf'))
    const rr = await versuche(() => ruf<Raum>('projektOeffnen', tr.projektId))
    const art = rr?.artefakte.find((x) => x.id === tr.artefakt)
    if (art) oeffneArtefakt(art, tr.ref)
  }

  const linksBreite = sicht === 'links' ? '100%' : sicht === 'rechts' ? '0' : `${teilung * 100}%`
  const ziehen = (e: MouseEvent) => {
    e.preventDefault()
    const buehne = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
    setZieht(true)
    const bewegt = (ev: MouseEvent) => setTeilung(Math.min(0.8, Math.max(0.2, (ev.clientX - buehne.left) / buehne.width)))
    const los = () => { setZieht(false); window.removeEventListener('mousemove', bewegt); window.removeEventListener('mouseup', los) }
    window.addEventListener('mousemove', bewegt)
    window.addEventListener('mouseup', los)
  }

  return (
    <>
      <div class="kopf">
        <span class="marke">Coop <i>Deck</i></span>
        <button class="knopf flach" title={t('ui.kopf.leisteTitel')} onClick={() => setLeisteZu(!leisteZu)}>{leisteZu ? t('ui.kopf.projekteZeigen') : t('ui.kopf.projekteAusblenden')}</button>
        <span class="projektname">{raum?.projekt.name ?? ''}</span>
        <span class="frei" />
        <span class="gruppe" title={t('ui.kopf.bereicheTitel')}>
          {(['links', 'beide', 'rechts'] as Sicht[]).map((s) => <button class={`knopf${sicht === s ? ' an' : ''}`} onClick={() => setSicht(s)}>{t(`ui.sicht.${s}`)}</button>)}
        </span>
        <button class={`knopf${eingangOffen ? ' an' : ''}`} onClick={() => setEingangOffen(!eingangOffen)}>{t('ui.eingang')}{dringend ? <span class="zaehler">{dringend}</span> : null}</button>
        <button class="knopf" onClick={() => { const neu = thema === 'dunkel' ? 'hell' : 'dunkel'; setThema(neu); void ruf('einstellen', { thema: neu }) }}>{thema === 'dunkel' ? t('ui.thema.tag') : t('ui.thema.nacht')}</button>
        <button class={`knopf mikro ${diktat}`} title={t('ui.diktat.titel', { ziel: diktatZiel() })} onMouseDown={(e) => e.preventDefault()} onClick={() => aktion.current('diktat')}>
          {diktat === 'nimmt' ? t('ui.diktat.aufnahme', { ziel: diktatZiel() }) : diktat === 'erkennt' ? t('ui.diktat.erkennt') : t('ui.diktat')}
        </button>
        <button class="knopf" title={t('ui.suchen.titel')} onClick={() => setPalette(true)}>{t('ui.suchen')}</button>
        <button class="knopf" onClick={() => setDialog({ art: 'einstellungen' })}>{t('ui.einstellungen')}</button>
      </div>

      <div class="buehne">
        {!leisteZu && (
          <aside class="leiste">
            <header>
              <input class="feld" placeholder={t('ui.leiste.suchen')} value={suche} onInput={(e) => setSuche((e.target as HTMLInputElement).value)} />
            </header>
            <div class="liste">
              {mitSessions.length > 0 && <div class="abschnitt">{t('ui.leiste.laufend')}</div>}
              {mitSessions.map((p) => <ProjektZeile p={p} />)}
              {favoriten.length > 0 && <div class="abschnitt">{t('ui.leiste.favoriten')}</div>}
              {favoriten.map((p) => <ProjektZeile p={p} />)}
              {sucht
                ? <>{uebrige.length > 0 && <div class="abschnitt">{t('ui.leiste.treffer')}</div>}{uebrige.map((p) => <ProjektZeile p={p} />)}</>
                : (
                  <>
                    {(uebrige.length > 0 || ausgeblendete.length > 0) && (
                      <button class="abschnitt klappe" aria-expanded={alleOffen} onClick={() => { setAlleOffen(!alleOffen); void ruf('einstellen', { alleProjekteOffen: !alleOffen }) }}>
                        <span class="pfeil">{alleOffen ? '▾' : '▸'}</span>{t('ui.leiste.alle', { n: uebrige.length })}
                      </button>
                    )}
                    {alleOffen && uebrige.map((p) => <ProjektZeile p={p} />)}
                    {alleOffen && ausgeblendete.length > 0 && (
                      <button class="abschnitt klappe leise" aria-expanded={ausgeblendetOffen} onClick={() => setAusgeblendetOffen(!ausgeblendetOffen)}>
                        <span class="pfeil">{ausgeblendetOffen ? '▾' : '▸'}</span>{t('ui.leiste.ausgeblendet', { n: ausgeblendete.length })}
                      </button>
                    )}
                    {alleOffen && ausgeblendetOffen && ausgeblendete.map((p) => <ProjektZeile p={p} />)}
                  </>
                )}
              {!passend.length && <div class="abschnitt">{t('ui.leiste.nichts')}</div>}
            </div>
            <footer>
              <button class="knopf" onClick={async () => { const p = await ruf<Projekt | null>('projektHinzufuegen'); if (p) { setZ({ ...z, projekte: await ruf<Projekt[]>('projekteSuchen') }); void waehleProjekt(p.id) } }}>{t('ui.verzeichnisHinzufuegen')}</button>
              <button class="knopf" onClick={() => setDialog({ art: 'projekt-neu' })}>{t('ui.neuesProjekt')}</button>
            </footer>
          </aside>
        )}

        {!raum ? (
          <div class="bereich" style={{ flex: 1 }}><div class="inhalt"><div class="leer">
            <h2>{z.projekte.length ? t('ui.leer.waehle') : t('ui.leer.keinProjekt')}</h2>
            <p>{z.projekte.length ? t('ui.leer.waehleText') : t('ui.leer.keinProjektText')}</p>
            {!z.projekte.length && <div class="reihe">
              <button class="knopf haupt" onClick={async () => { const p = await ruf<Projekt | null>('projektHinzufuegen'); if (p) { setZ({ ...z, projekte: await ruf<Projekt[]>('projekteSuchen') }); void waehleProjekt(p.id) } }}>{t('ui.verzeichnisHinzufuegen')}</button>
              <button class="knopf" onClick={() => setDialog({ art: 'projekt-neu' })}>{t('ui.neuesProjekt')}</button>
              <button class="knopf" onClick={() => setDialog({ art: 'einstellungen' })}>{t('ui.einstellungen')}</button>
            </div>}
          </div></div></div>
        ) : (
          <div class="arbeitsflaeche">
            <section class="bereich" style={{ width: linksBreite, flex: sicht === 'links' ? 1 : 'none', display: sicht === 'rechts' ? 'none' : 'flex' }}>
              <div class="reiterleiste">
                {reiterS.map((s) => (
                  <div class={`reiter${s.id === aktivS ? ' aktiv' : ''}`} role="tab" tabIndex={0} title={`${s.titel}${s.zweck ? ` — ${s.zweck}` : ''}`} onClick={() => waehleSitzung(s.id)}>
                    <span class={`led ${led(s)}`} />
                    <span class="titel">{s.titel}</span>
                    {s.frei ? <span class="art" title={t('ui.sitzung.freiTitel')}>{t('ui.sitzung.frei')}</span> : null}
                    {s.schlange ? <span class="zaehler" title={t('ui.sitzung.schlangeTitel')}>{s.schlange}</span> : null}
                    <button class="zu" title={s.zustand === 'beendet' ? t('ui.sitzung.ausLeiste') : t('ui.sitzung.beenden')} onClick={(e) => {
                      e.stopPropagation()
                      if (s.zustand === 'beendet') { setVersteckt((v) => [...v, s.id]); if (aktivS === s.id) setAktivS(laufende.at(-1)?.id ?? null) }
                      else setDialog({ art: 'beenden', sitzung: s })
                    }}>×</button>
                  </div>
                ))}
                <button class="knopf plus" title={t('ui.sitzung.plusTitel')} onClick={sitzungsMenue}>+</button>
              </div>
              <div class="inhalt">
                {aktiveSitzung && aktiveSitzung.zustand !== 'beendet' && <TerminalFlaeche key={aktiveSitzung.id} sid={aktiveSitzung.id} projektId={raum.projekt.id} />}
                {aktiveSitzung && aktiveSitzung.zustand === 'beendet' && (
                  <div class="leer">
                    <h2>{t('ui.sitzung.istBeendet', { titel: aktiveSitzung.titel })}</h2>
                    {aktiveSitzung.ergebnis && <p style={{ color: 'var(--text)' }}>{aktiveSitzung.ergebnis}</p>}
                    <p>{aktiveSitzung.art === 'terminal' ? t('ui.sitzung.terminalNichtFortsetzen') : z.clis.find((c) => c.id === aktiveSitzung.cli)?.fortsetzenGenau ? t('ui.sitzung.fortsetzenGenau') : t('ui.sitzung.fortsetzenLetzte')}</p>
                    <div class="reihe">
                      {aktiveSitzung.art === 'cli' && <button class="knopf haupt" onClick={() => void versuche(() => ruf('sitzungFortsetzen', aktiveSitzung.id))}>{t('ui.sitzung.fortsetzen')}</button>}
                      <button class="knopf" onClick={async () => { await ruf('sitzungEntfernen', aktiveSitzung.id); T.vergessen(aktiveSitzung.id); setAktivS(laufende.at(-1)?.id ?? null); void auffrischen() }}>{t('ui.sitzung.loeschen')}</button>
                    </div>
                  </div>
                )}
                {!aktiveSitzung && (
                  <div class="leer">
                    <h2>{t('ui.sitzung.keine')}</h2>
                    <p>{t('ui.sitzung.keineText')}</p>
                    <div class="reihe">
                      {clisDa.map((c) => <button class={`knopf${c.id === raum.projekt.cli ? ' haupt' : ''}`} onClick={() => void starteSitzung({ projektId: raum.projekt.id, cli: c.id })}>{t('ui.sitzung.starten', { name: c.name })}</button>)}
                      {!clisDa.length && <p>{t('ui.sitzung.keineCli')}</p>}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {sicht === 'beide' && <div class="teiler raster" onMouseDown={ziehen} title={t('ui.teiler')} />}

            <section class="bereich" style={{ flex: 1, display: sicht === 'links' ? 'none' : 'flex' }}>
              <div class="reiterleiste">
                {reiter.map((r) => (
                  <div class={`reiter${r.key === aktivR ? ' aktiv' : ''}`} role="tab" tabIndex={0} title={r.titel} onClick={() => setAktivR(r.key)}>
                    <span class="titel">{r.titel}</span>
                    {(marken[r.key]?.length ?? 0) > 0 && <span class="zaehler">{marken[r.key].length}</span>}
                    <button class="zu" title={t('ui.reiter.schliessen')} onClick={(e) => { e.stopPropagation(); schliesseReiter(r.key) }}>×</button>
                  </div>
                ))}
                <button class="knopf plus" title={t('ui.reiter.plusTitel')} onClick={artefaktMenue}>+</button>
              </div>
              {aktiverReiter && (
                <div class="werkzeugleiste">
                  <span class="gruppe">
                    <button class="knopf" title={t('ui.reiter.zurueck')} onClick={() => ansichten.get(aktivR!)?.goBack()}>◂</button>
                    <button class="knopf" title={t('ui.reiter.vor')} onClick={() => ansichten.get(aktivR!)?.goForward()}>▸</button>
                    <button class="knopf" title={t('ui.reiter.neuLaden')} onClick={() => ansichten.get(aktivR!)?.reload()}>↻</button>
                  </span>
                  <input class="feld adresse" value={adresse} spellcheck={false} placeholder={t('ui.reiter.adresse')}
                    onInput={(e) => setAdresse((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      const zt = adresse.trim()
                      if (/^https?:\/\//i.test(zt) && aktiverReiter.art === 'web') ansichten.get(aktivR!)?.loadURL(zt)
                      else void oeffneZiel(zt)
                    }} />
                  <span class="gruppe">
                    {WERKZEUGE.map(([id, name, hilfe]) => <button class={`knopf${werkzeug === id ? ' an' : ''}`} title={t(hilfe)} onClick={() => { setWerkzeug(werkzeug === id ? null : id); setRueckOffen(true) }}>{t(name)}</button>)}
                  </span>
                  <button class="knopf" title={t('ui.verlauf.titel')} onClick={() => oeffneAdresse(`${stand.current.z!.basis}/p/${raum.projekt.id}/verlauf/${aktiverReiter.art === 'artefakt' ? aktiverReiter.id ?? '' : ''}`, aktiverReiter.art === 'artefakt' ? t('ui.verlauf.von', { titel: aktiverReiter.titel }) : t('ui.verlauf'))}>{t('ui.verlauf')}</button>
                  <button class={`knopf${rueckOffen ? ' an' : ''}`} onClick={() => setRueckOffen(!rueckOffen)}>{t('ui.rueckmeldung')}{aktuelleMarken.length ? <span class="zaehler">{aktuelleMarken.length}</span> : null}</button>
                </div>
              )}
              {hinweise.map((h) => {
                const von = raum.sitzungen.find((s) => s.id === h.von)?.titel ?? t('ui.band.agent')
                const weg = () => { setHinweise((hs) => hs.filter((x) => x.id !== h.id)); void ruf('hinweisGesehen', raum.projekt.id, h.id) }
                const art = raum.artefakte.find((a) => a.id === h.artefakt)
                return (
                  <div class="band">
                    <span class="wer">{von}</span><span class="was">{h.text}</span>
                    {(art || h.ref) && <button class="knopf" onClick={() => { if (art) oeffneArtefakt(art, h.ref); else if (h.ref && aktivR) springe(aktivR, h.ref); weg() }}>{t('ui.band.ansehen')}</button>}
                    <button class="knopf flach" onClick={weg}>{t('ui.schliessen')}</button>
                  </div>
                )
              })}
              <div class="inhalt">
                <Ansichten reiter={reiter} aktiv={aktivR} zieht={zieht || !!menue || !!dialog || eingangOffen} />
                {!reiter.length && (
                  <div class="leer">
                    <h2>{raum.artefakte.length ? t('ui.reiter.keiner') : t('ui.reiter.keineArtefakte')}</h2>
                    <p>{t('ui.reiter.leerText')}</p>
                    <div class="reihe">
                      {raum.artefakte.slice(0, 4).map((a) => <button class="knopf" onClick={() => oeffneArtefakt(a)}>{a.titel}</button>)}
                      <button class="knopf haupt" onClick={() => setDialog({ art: 'artefakt' })}>{t('ui.artefaktAnlegen')}</button>
                      <button class="knopf" onClick={() => oeffneAdresse('about:blank')}>{t('ui.reiter.adresseOeffnen')}</button>
                    </div>
                  </div>
                )}
              </div>
              {rueckOffen && aktiverReiter && (
                <div class="rueck">
                  <header>
                    <h3>{t('ui.rueck.zu', { titel: aktiverReiter.titel })}</h3>
                    <button class="knopf flach" onClick={() => { ansichten.get(aktivR!)?.send('coop-leeren'); setMarken((m) => ({ ...m, [aktivR!]: [] })) }}>{t('ui.rueck.leeren')}</button>
                    <button class="knopf flach" onClick={() => { setRueckOffen(false); setWerkzeug(null) }}>{t('ui.rueck.zuklappen')}</button>
                  </header>
                  <div class="rumpf">
                    {!aktuelleMarken.length && <span class="leise">{t('ui.rueck.anleitung')}</span>}
                    {aktuelleMarken.map((m) => (
                      <div class="marke-zeile">
                        <span class="nr">{m.nr}</span>
                        <div>
                          <input class="feld" data-marke={m.nr} placeholder={t('ui.rueck.markeFrage')} value={m.text}
                            onInput={(e) => { const v = (e.target as HTMLInputElement).value; setMarken((mm) => ({ ...mm, [aktivR!]: mm[aktivR!].map((x) => (x.nr === m.nr ? { ...x, text: v } : x)) })); setVorschau(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void sende() }} />
                          <div class="bezug">{bezugKurz(m)}</div>
                        </div>
                        <button class="knopf flach" title={t('ui.rueck.markeWeg')} onClick={() => entferneMarke(m.nr)}>×</button>
                      </div>
                    ))}
                    <textarea class="feld" rows={2} placeholder={t('ui.rueck.notiz')} value={aktuelleNotiz}
                      onInput={(e) => { setNotizen((x) => ({ ...x, [aktivR!]: (e.target as HTMLTextAreaElement).value })); setVorschau(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void sende() }} />
                    {vorschau !== null && <div class="vorschau">{vorschau}</div>}
                  </div>
                  <footer>
                    <span class="leise">{t('ui.rueck.an')}</span>
                    <select class="feld" value={ziel} onChange={(e) => setZiel((e.target as HTMLSelectElement).value)}>
                      <option value="aktiv">{t('ui.rueck.zielAktiv')}{zielSitzung && ziel === 'aktiv' ? ` (${zielSitzung.titel})` : ''}</option>
                      {laufende.filter((s) => s.id !== aktivS).map((s) => <option value={s.id}>{s.titel}</option>)}
                      <option value="neu">{t('ui.rueck.zielNeu')}</option>
                    </select>
                    {zielSitzung && ziel !== 'neu' && zielSitzung.zustand === 'arbeitet' && <span class="leise">{t('ui.rueck.wartet')}</span>}
                    <span class="frei" />
                    <button class={`knopf${vorschau !== null ? ' an' : ''}`} onClick={() => void zeigeVorschau()}>{t('ui.rueck.vorschau')}</button>
                    <button class="knopf haupt" title={kuerzel('⌘↵')} onClick={() => void sende()}>{t('ui.rueck.senden')}</button>
                  </footer>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <div class="fuss">
        {raum ? (
          <>
            <span class="pfad mono" title={raum.projekt.pfad}>{raum.projekt.pfad}</span>
            <span class="frei" />
            {raum.dienste.map((d) => (
              <button class={`dienst${d.gemeinsam ? (d.freigegeben ? ' gemeinsam' : ' unbestaetigt') : ''}`} title={`${d.url}\n${d.start}${d.gemeinsam ? `\n${t(d.freigegeben ? 'ui.fuss.dienstGemeinsam' : 'ui.fuss.dienstUnbestaetigt')}` : ''}`} onClick={() => { if (d.gemeinsam && !d.freigegeben) setDialog({ art: 'dienst-start', dienst: d }); else if (d.laeuft) oeffneAdresse(d.url, d.name); else if (d.freigegeben) void versuche(() => ruf('dienstStarten', raum.projekt.id, d.name, false)).then(() => auffrischen()); else setDialog({ art: 'dienst-start', dienst: d }) }}>
                <span class={`led ${d.laeuft ? 'an' : 'aus'}`} />{d.name}
              </button>
            ))}
            <button class="knopf" onClick={() => setDialog({ art: 'dienst' })}>{t('ui.dienstHinterlegen')}</button>
            {aktiveSitzung?.schlange ? <button class="knopf" title={t('ui.fuss.schlangeTitel')} onClick={() => void ruf('jetztZustellen', aktiveSitzung.id)}>{t('ui.fuss.schlange', { n: aktiveSitzung.schlange })}</button> : null}
            <span class="leise">{t('ui.fuss.beimOeffnen')}</span>
            <select class="feld" value={raum.projekt.autostart} onChange={(e) => { const v = (e.target as HTMLSelectElement).value as Projekt['autostart']; void ruf('projektAendern', raum.projekt.id, { autostart: v }); setRaum({ ...raum, projekt: { ...raum.projekt, autostart: v } }) }}>
              <option value="nein">{t('ui.fuss.autostart.nein')}</option><option value="neu">{t('ui.fuss.autostart.neu')}</option><option value="fortsetzen">{t('ui.fuss.autostart.fortsetzen')}</option>
            </select>
            <select class="feld" title={t('ui.fuss.cliTitel')} value={raum.projekt.cli} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; void ruf('projektAendern', raum.projekt.id, { cli: v }); setRaum({ ...raum, projekt: { ...raum.projekt, cli: v } }) }}>
              {z.clis.map((c: Cli) => <option value={c.id} disabled={!c.da}>{c.name}{c.da ? '' : t('ui.fuss.cliFehlt')}</option>)}
            </select>
          </>
        ) : <span class="leise">{t('ui.fuss.keinProjekt')}</span>}
      </div>

      {eingangOffen && (
        <div class="eingang">
          <header><h2>{t('ui.eingang')}</h2><button class="knopf flach" onClick={() => setEingangOffen(false)}>{t('ui.schliessen')}</button></header>
          <div class="rumpf">
            {!eingang.length && <div class="posten"><span class="leise">{t('ui.eingang.leer')}</span></div>}
            {eingang.map((p) => (
              <div class="posten">
                <div class="kopfzeile"><span class="art">{t(`ui.eingang.art.${p.art}`)}</span><span>{p.projekt}</span><span>{new Date(p.zeit).toLocaleTimeString(gebiet(), { hour: '2-digit', minute: '2-digit' })}</span></div>
                <div class="titel">{p.titel}</div>
                {p.text && p.text !== p.titel && <div class="text">{p.text}</div>}
                {p.frage && (
                  <>
                    <div class="optionen">
                      {p.frage.optionen.map((o) => (
                        <button class="knopf option" onClick={() => void versuche(() => ruf('frageBeantworten', p.projektId, p.kennung, { option: o.id, text: freiText[p.kennung] || undefined })).then(ladeEingang)}>
                          <b>{o.id}</b><span>{o.titel}{o.beschreibung ? <span class="leise"> — {o.beschreibung}</span> : null}</span>
                        </button>
                      ))}
                    </div>
                    <div class="reihe">
                      <input class="feld" placeholder={p.frage.optionen.length ? t('ui.eingang.zusatz') : t('ui.eingang.antwort')} value={freiText[p.kennung] ?? ''} onInput={(e) => setFreiText({ ...freiText, [p.kennung]: (e.target as HTMLInputElement).value })} />
                      <button class="knopf" disabled={!freiText[p.kennung]?.trim()} onClick={() => void versuche(() => ruf('frageBeantworten', p.projektId, p.kennung, { text: freiText[p.kennung] })).then(ladeEingang)}>{t('ui.eingang.nurText')}</button>
                    </div>
                  </>
                )}
                {p.art !== 'frage' && (
                  <div class="reihe">
                    <button class="knopf" onClick={async () => {
                      if (raum?.projekt.id !== p.projektId) await waehleProjekt(p.projektId)
                      if (p.sitzung && p.art !== 'hinweis') waehleSitzung(p.sitzung)
                      // Eine Lieferung ohne Empfänger: die Datei mit Notiz und Pfaden rechts öffnen.
                      if (p.art === 'lieferung' && p.text) void ruf('zeigeDatei', p.projektId, p.text).catch(() => undefined)
                      if (p.art === 'schlange' && p.sitzung) void ruf('jetztZustellen', p.sitzung)
                      setEingangOffen(false)
                    }}>{p.art === 'schlange' ? t('ui.eingang.jetzt') : t('ui.eingang.hin')}</button>
                    {p.art === 'lieferung' && <button class="knopf flach" onClick={() => void ruf('anfrageGesehen', p.projektId, p.kennung).then(ladeEingang)}>{t('ui.eingang.gesehen')}</button>}
                    {p.art === 'hinweis' && <button class="knopf flach" onClick={() => { setHinweise((hs) => hs.filter((x) => x.id !== p.kennung)); void ruf('hinweisGesehen', p.projektId, p.kennung) }}>{t('ui.eingang.gesehen')}</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {menue && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setMenue(null)}>
          {/* Mit Einheit: Preact 11 hängt an Zahlen kein „px“ mehr an, der Browser verwürfe die Angabe und das Menü läge oben links über den Fensterknöpfen. */}
          <div class="menue" style={{ left: `${menue.x}px`, top: `${menue.y}px`, maxHeight: `calc(100vh - ${menue.y + 12}px)` }}>
            {menue.punkte.map((p) => p.trenner ? <div class="trenner" /> : p.abschnitt ? <div class="abschnitt">{p.abschnitt}</div> : (
              <button class="punkt" onClick={() => p.aktion?.()}>{p.titel}{p.neben ? <span class="neben">{p.neben}</span> : null}</button>
            ))}
          </div>
        </div>
      )}

      {dialog && (raum || dialog.art === 'einstellungen' || dialog.art === 'projekt-neu') && <Dialoge dialog={dialog}
        projektNeu={async (np) => { setDialog(null); if (z) setZ({ ...z, projekte: await ruf<Projekt[]>('projekteSuchen') }); await waehleProjekt(np.id) }} raum={raum!} z={z} zu={() => setDialog(null)} melde={melde} setZ={setZ} thema={thema} setThema={setThema}
        sprachwechsel={() => {
          document.documentElement.lang = sprache()
          // Reiter, deren Titel das Deck selbst vergeben hat (Verlauf, neuer Reiter), tragen ihn in der neuen Sprache weiter.
          const eigene: Schluessel[] = ['ui.verlauf', 'ui.reiter.neu']
          setReiter((rs) => rs.map((r) => {
            const k = eigene.find((x) => (Object.keys(SPRACHEN) as Sprache[]).some((s) => tIn(s, x) === r.titel))
            return k ? { ...r, titel: t(k) } : r
          }))
          // Die Typseiten holen ihre Texte beim Laden: alle offenen Ansichten neu laden.
          for (const wv of ansichten.values()) { try { wv.reload() } catch { /* lädt noch */ } }
        }}
        starte={async (o) => { const s = await starteSitzung(o); if (s) setDialog(null) }}
        fertig={async (a) => { setDialog(null); await auffrischen(); if (a) oeffneArtefakt(a) }} />}

      {palette && z && <Palette fest={paletteFest()} hier={raum?.projekt.id} waehle={(tr) => void waehleTreffer(tr)} zu={() => setPalette(false)} />}

      {meldung && <div class="meldung" onClick={() => setMeldung(null)}>{meldung}</div>}
    </>
  )

  function ProjektZeile({ p }: { p: Projekt }) {
    const n = achtungJe(p.id)
    return (
      <div class={`projekt${raum?.projekt.id === p.id ? ' aktiv' : ''}${laufend[p.id] ? ' laeuft' : ''}${p.ausgeblendet ? ' blass' : ''}`} onClick={() => void waehleProjekt(p.id)} title={p.pfad}>
        <span class="name">{p.name}</span>
        {laufend[p.id] ? <span class="sessions" title={t(laufend[p.id] === 1 ? 'ui.leiste.sessions.eins' : 'ui.leiste.sessions.viele', { n: laufend[p.id] })}>{laufend[p.id]}</span> : null}
        {n ? <span class="zaehler">{n}</span> : null}
        {!p.favorit && !laufend[p.id] && (
          <button class="blende" title={t(p.ausgeblendet ? 'ui.leiste.einblenden' : 'ui.leiste.ausblenden')} onClick={(e) => { e.stopPropagation(); projektSetzen(p.id, { ausgeblendet: !p.ausgeblendet }) }}>{p.ausgeblendet ? '+' : '−'}</button>
        )}
        <button class={`stern${p.favorit ? ' an' : ''}`} title={p.favorit ? t('ui.leiste.favoritWeg') : t('ui.leiste.favoritMerken')} onClick={(e) => { e.stopPropagation(); projektSetzen(p.id, { favorit: !p.favorit, ...(p.favorit ? {} : { ausgeblendet: false }) }) }}>{p.favorit ? '★' : '☆'}</button>
      </div>
    )
  }
}

render(<App />, document.getElementById('app')!)
