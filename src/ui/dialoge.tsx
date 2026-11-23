import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { ruf, type Artefakt, type Dienst, type MobilLage, type TelegramLage, type Projekt, type Raum, type Sitzung, type SprachLage, type Zustand } from './bruecke'
import { SPRACHEN, setzeSprache, t, type Sprache } from '../texte'

interface Vorlage { id: string; name: string; zweck: string; git: boolean; artefakte: { typ: string; titel: string }[] }

export type DialogArt =
  | { art: 'sitzung'; roadmap?: { artefakt: string; punkt: string; titel: string }; auftrag?: string; titel?: string }
  | { art: 'artefakt' }
  | { art: 'dienst' }
  | { art: 'dienst-start'; dienst: Dienst }
  | { art: 'beenden'; sitzung: Sitzung }
  | { art: 'einstellungen' }
  | { art: 'projekt-neu' }

interface Props {
  dialog: DialogArt
  raum: Raum
  z: Zustand
  zu: () => void
  melde: (text: string) => void
  starte: (o: Record<string, unknown>) => Promise<void>
  fertig: (a?: Artefakt) => Promise<void>
  setZ: (z: Zustand) => void
  thema: 'dunkel' | 'hell'
  setThema: (t: 'dunkel' | 'hell') => void
  projektNeu: (p: Projekt) => Promise<void>
  /** Nach dem Wechsel der Anzeigesprache: offene Ansichten neu laden. */
  sprachwechsel: () => void
}

/** Setzt Elemente in eine Textvorlage ein: `{name}` wird durch `teile.name` ersetzt. */
function mitTeilen(vorlage: string, teile: Record<string, ComponentChildren>): ComponentChildren[] {
  return vorlage.split(/\{(\w+)\}/).map((s, i) => (i % 2 ? teile[s] ?? `{${s}}` : s))
}

const fehlerText = (e: unknown) => String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export function Dialoge(p: Props) {
  const d = p.dialog
  return (
    <div class="schleier" onMouseDown={(e) => { if (e.target === e.currentTarget) p.zu() }}>
      {d.art === 'sitzung' && <SitzungDialog {...p} dialog={d} />}
      {d.art === 'artefakt' && <ArtefaktDialog {...p} />}
      {d.art === 'projekt-neu' && <ProjektNeuDialog {...p} />}
      {d.art === 'dienst' && <DienstDialog {...p} />}
      {d.art === 'einstellungen' && <Einstellungen {...p} />}
      {d.art === 'dienst-start' && <DienstStart {...p} dienst={d.dienst} />}
      {d.art === 'beenden' && (
        <div class="dialog">
          <header><h2>{t('ui.beenden.titel', { titel: d.sitzung.titel })}</h2></header>
          <div class="rumpf"><span>{t('ui.beenden.text')}</span></div>
          <footer>
            <button class="knopf" onClick={p.zu}>{t('ui.beenden.weiter')}</button>
            <button class="knopf haupt" onClick={async () => { await ruf('sitzungBeenden', d.sitzung.id); p.zu() }}>{t('ui.beenden.ja')}</button>
          </footer>
        </div>
      )}
    </div>
  )
}

function SitzungDialog(p: Props & { dialog: Extract<DialogArt, { art: 'sitzung' }> }) {
  const rm = p.dialog.roadmap
  const [cli, setCli] = useState(p.raum.projekt.cli)
  const [titel, setTitel] = useState(rm ? `${rm.punkt} ${rm.titel}`.slice(0, 40) : p.dialog.titel ?? '')
  const [zweck, setZweck] = useState('')
  const [auftrag, setAuftrag] = useState(p.dialog.auftrag ?? '')
  const [briefing, setBriefing] = useState('')
  const [zeigeBriefing, setZeigeBriefing] = useState(!!rm)
  const [frei, setFrei] = useState(p.z.kern.ohneRueckfragen)
  // Das Briefing ist vor dem Start einsehbar (RM-03).
  useEffect(() => {
    void ruf<string>('briefingVorschau', p.raum.projekt.id, { titel, zweck, roadmap: rm && { artefakt: rm.artefakt, punkt: rm.punkt } }).then(setBriefing).catch(() => setBriefing(''))
  }, [zweck])
  return (
    <div class="dialog breit">
      <header><h2>{rm ? t('ui.sd.titelPunkt', { punkt: rm.punkt }) : t('ui.neueSitzung')}</h2></header>
      <div class="rumpf">
        <div class="zeile">
          <label>CLI
            <select class="feld" value={cli} onChange={(e) => setCli((e.target as HTMLSelectElement).value)}>
              {p.z.clis.map((c) => <option value={c.id} disabled={!c.da}>{c.name}{c.da ? '' : t('ui.sd.nichtGefunden')}</option>)}
            </select>
          </label>
          <label>{t('ui.titel')}<input class="feld" value={titel} placeholder={t('ui.sd.titelPlatz')} onInput={(e) => setTitel((e.target as HTMLInputElement).value)} /></label>
        </div>
        <label>{t('ui.sd.zweck')}<input class="feld" value={zweck} onInput={(e) => setZweck((e.target as HTMLInputElement).value)} /></label>
        <label>{rm ? t('ui.sd.ergaenzung') : t('ui.sd.ersterAuftrag')}
          <textarea class="feld" rows={3} value={auftrag} onInput={(e) => setAuftrag((e.target as HTMLTextAreaElement).value)} />
        </label>
        <label class="haken"><input type="checkbox" checked={frei} onChange={(e) => setFrei((e.target as HTMLInputElement).checked)} /><span>{t('ui.sd.frei')}{cli === 'pi' ? t('ui.sd.freiPi') : ''}</span></label>
        <div><button class={`knopf${zeigeBriefing ? ' an' : ''}`} onClick={() => setZeigeBriefing(!zeigeBriefing)}>{t('ui.sd.briefing')}</button></div>
        {zeigeBriefing && <div class="vorschau" style={{ maxHeight: '34vh' }}>{briefing || t('ui.sd.briefingLaedt')}</div>}
      </div>
      <footer>
        <button class="knopf" onClick={p.zu}>{t('ui.abbrechen')}</button>
        <button class="knopf haupt" onClick={() => void p.starte({ projektId: p.raum.projekt.id, cli, titel: titel || undefined, zweck: zweck || undefined, auftrag: auftrag || undefined, ohneRueckfragen: frei, roadmap: rm && { artefakt: rm.artefakt, punkt: rm.punkt } })}>{t('ui.sd.starten')}</button>
      </footer>
    </div>
  )
}

function ProjektNeuDialog(p: Props) {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([])
  const [wahl, setWahl] = useState('')
  const [name, setName] = useState('')
  const [ordner, setOrdner] = useState(p.z.wurzeln[0] ?? '')
  const [git, setGit] = useState(false)
  const [fehler, setFehler] = useState('')
  useEffect(() => { void ruf<Vorlage[]>('vorlagen').then((v) => { setVorlagen(v); if (v[0]) { setWahl(v[0].id); setGit(v[0].git) } }) }, [])
  const v = vorlagen.find((x) => x.id === wahl)
  return (
    <div class="dialog">
      <header><h2>{t('ui.projektAusVorlage')}</h2></header>
      <div class="rumpf">
        <div class="vorlagen">
          {vorlagen.map((x) => (
            <button class={`vorlage${x.id === wahl ? ' an' : ''}`} onClick={() => { setWahl(x.id); setGit(x.git) }}>
              <b>{x.name}</b><span>{x.zweck}</span>
            </button>
          ))}
        </div>
        {v && <span class="leise">{t('ui.pn.legtAn', { liste: v.artefakte.map((a) => a.titel).join(', ') })}</span>}
        <label>{t('ui.pn.name')}<input class="feld" value={name} onInput={(e) => { setName((e.target as HTMLInputElement).value); setFehler('') }} /></label>
        <label>{t('ui.pn.ordner')}
          <span class="zeile">
            <input class="feld mono" style={{ flex: 1 }} value={ordner} spellcheck={false} onInput={(e) => { setOrdner((e.target as HTMLInputElement).value); setFehler('') }} />
            <button class="knopf" onClick={async () => { const o = await ruf<string | null>('ordnerWaehlen'); if (o) setOrdner(o) }}>{t('ui.pn.waehlen')}</button>
          </span>
        </label>
        <label class="haken"><input type="checkbox" checked={git} onChange={(e) => setGit((e.target as HTMLInputElement).checked)} />{t('ui.pn.git')}</label>
        {fehler && <span class="fehler">{fehler}</span>}
      </div>
      <footer>
        <button class="knopf" onClick={p.zu}>{t('ui.abbrechen')}</button>
        <button class="knopf haupt" disabled={!name.trim() || !ordner.trim() || !v} onClick={async () => {
          try {
            const r = await ruf<{ projekt: Projekt; hinweise: string[] }>('projektAusVorlage', { ordner, name, vorlage: wahl, git })
            if (r.hinweise.length) p.melde(r.hinweise.join(' '))
            await p.projektNeu(r.projekt)
          } catch (e) { setFehler(fehlerText(e)) }
        }}>{t('ui.pn.anlegen')}</button>
      </footer>
    </div>
  )
}

function ArtefaktDialog(p: Props) {
  const [typ, setTyp] = useState(p.z.typen[0]?.id ?? 'roadmap')
  const [titel, setTitel] = useState('')
  const [quelle, setQuelle] = useState('')
  const [url, setUrl] = useState('http://127.0.0.1:')
  const [fehler, setFehler] = useState('')
  const gewaehlt = p.z.typen.find((x) => x.id === typ)
  const mitQuelle = typ === 'dokument' || typ === 'projektblatt'
  return (
    <div class="dialog">
      <header><h2>{t('ui.artefaktAnlegen')}</h2></header>
      <div class="rumpf">
        <label>{t('ui.ad.typ')}
          <select class="feld" value={typ} onChange={(e) => setTyp((e.target as HTMLSelectElement).value)}>
            {p.z.typen.map((x) => <option value={x.id}>{x.name}</option>)}
          </select>
        </label>
        {gewaehlt && <span class="leise">{gewaehlt.zweck}</span>}
        <label>{t('ui.titel')}<input class="feld" value={titel} onInput={(e) => setTitel((e.target as HTMLInputElement).value)} /></label>
        {mitQuelle && <label>{typ === 'projektblatt' ? t('ui.ad.dateiBlatt') : t('ui.ad.dateiNeu')}
          <input class="feld mono" value={quelle} placeholder={typ === 'projektblatt' ? 'PROJEKT.md' : t('ui.ad.beispiel')} onInput={(e) => setQuelle((e.target as HTMLInputElement).value)} /></label>}
        {typ === 'web' && <label>{t('ui.ad.adresse')}<input class="feld mono" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} /></label>}
        {fehler && <span class="fehler">{fehler}</span>}
      </div>
      <footer>
        <button class="knopf" onClick={p.zu}>{t('ui.abbrechen')}</button>
        <button class="knopf haupt" disabled={!titel.trim()} onClick={async () => {
          try {
            const a = await ruf<Artefakt>('artefaktNeu', p.raum.projekt.id, { typ, titel: titel.trim(), quelle: quelle.trim() || undefined, url: typ === 'web' ? url.trim() : undefined })
            await p.fertig(a)
          } catch (e) { setFehler(fehlerText(e)) }
        }}>{t('ui.ad.anlegen')}</button>
      </footer>
    </div>
  )
}

function DienstDialog(p: Props) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [url, setUrl] = useState('http://127.0.0.1:')
  return (
    <div class="dialog">
      <header><h2>{t('ui.dienstHinterlegen')}</h2></header>
      <div class="rumpf">
        <span class="leise">{t('ui.dd.text')}</span>
        <label>{t('ui.name')}<input class="feld" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
        <label>{t('ui.dd.start')}<input class="feld mono" value={start} placeholder="python3 werkzeuge/cockpit/server.py" onInput={(e) => setStart((e.target as HTMLInputElement).value)} /></label>
        <label>{t('ui.adresse')}<input class="feld mono" value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} /></label>
      </div>
      <footer>
        <button class="knopf" onClick={p.zu}>{t('ui.abbrechen')}</button>
        <button class="knopf haupt" disabled={!name.trim() || !/^https?:\/\//.test(url)} onClick={async () => {
          await ruf('dienstSpeichern', p.raum.projekt.id, { name: name.trim(), start: start.trim(), url: url.trim() })
          await p.fertig()
        }}>{t('ui.dd.hinterlegen')}</button>
      </footer>
    </div>
  )
}

function DienstStart(p: Props & { dienst: Dienst }) {
  const [laeuft, setLaeuft] = useState(false)
  return (
    <div class="dialog">
      <header><h2>{t('ui.ds.titel', { name: p.dienst.name })}</h2></header>
      <div class="rumpf">
        <span>{t('ui.ds.text')}</span>
        <div class="vorschau">{p.dienst.start || t('ui.ds.keinBefehl')}</div>
        <span class="leise mono">{p.dienst.url}</span>
      </div>
      <footer>
        <button class="knopf" onClick={p.zu}>{t('ui.ds.nicht')}</button>
        <button class="knopf haupt" disabled={laeuft} onClick={async () => {
          setLaeuft(true)
          try { await ruf('dienstStarten', p.raum.projekt.id, p.dienst.name, true) } catch (e) { p.melde(fehlerText(e)) }
          await p.fertig()
        }}>{laeuft ? t('ui.ds.startet') : t('ui.ds.ja')}</button>
      </footer>
    </div>
  )
}

function Einstellungen(p: Props) {
  const [frei, setFrei] = useState(p.z.kern.ohneRueckfragen)
  const [wurzeln, setWurzeln] = useState(p.z.wurzeln.join('\n'))
  const [gespeichert, setGespeichert] = useState('')
  const [name, setName] = useState(p.z.kern.name)
  const s0 = p.z.kern.sprache ?? {}
  const [modell, setModell] = useState(s0.modell ?? '')
  const [ausgabe, setAusgabe] = useState(!!s0.ausgabe)
  const [stimme, setStimme] = useState(s0.stimme ?? '')
  const [piper, setPiper] = useState(s0.piper ?? '')
  const [bruecke, setBruecke] = useState(s0.bruecke ?? '')
  const [tasten, setTasten] = useState(Object.entries(s0.tasten ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'))
  const [lage, setLage] = useState<SprachLage | null>(null)
  useEffect(() => { void ruf<SprachLage>('spracheLage').then(setLage) }, [])
  const [mobil, setMobil] = useState<MobilLage | null>(null)
  const [mobilPort, setMobilPort] = useState('')
  const [mobilAdresse, setMobilAdresse] = useState('')
  const [kopiert, setKopiert] = useState(false)
  const mobilUebernehmen = (m: MobilLage) => { setMobil(m); setMobilPort(String(m.port)); setMobilAdresse(m.adresse); setKopiert(false) }
  useEffect(() => { void ruf<MobilLage>('mobilLage').then(mobilUebernehmen) }, [])
  const [tele, setTele] = useState<TelegramLage | null>(null)
  const [teleToken, setTeleToken] = useState('')
  const [teleChat, setTeleChat] = useState('')
  const [teleStand, setTeleStand] = useState('')
  const teleUebernehmen = (l: TelegramLage) => { setTele(l); setTeleChat(l.chat); setTeleToken('') }
  useEffect(() => { void ruf<TelegramLage>('telegramLage').then(teleUebernehmen) }, [])
  const mobilSetzen = async (patch: { an?: boolean; port?: number; adresse?: string; neuerSchluessel?: boolean }) => mobilUebernehmen(await ruf<MobilLage>('mobilEinstellen', patch))
  /** Anzeigesprache wechseln: Kern, eigene Texte, Zustand der App (rendert alles neu), offene Ansichten. */
  const waehleSprache = async (anzeigesprache: Sprache) => {
    const kern = await ruf<Zustand['kern']>('kernEinstellen', { anzeigesprache })
    setzeSprache(kern.anzeigesprache)
    p.setZ({ ...p.z, kern })
    p.sprachwechsel()
    // Die Lage trägt Texte aus dem Kern (was fehlt, Namen der Aktionen): in der neuen Sprache holen.
    setLage(await ruf<SprachLage>('spracheLage'))
  }
  const spracheSpeichern = async () => {
    const paare = Object.fromEntries(tasten.split('\n').map((z) => z.split('=').map((x) => x.trim())).filter((x) => x.length === 2 && x[0] && x[1]))
    p.setZ({ ...p.z, kern: await ruf<Zustand['kern']>('spracheEinstellen', { modell, ausgabe, stimme, piper, bruecke, tasten: paare }) })
    setLage(await ruf<SprachLage>('spracheLage'))
  }
  return (
    <div class="dialog">
      <header><h2>{t('ui.einstellungen')}</h2></header>
      <div class="rumpf">
        <label>{t('ui.einst.sprache')}
          <select class="feld" value={p.z.kern.anzeigesprache} onChange={(e) => void waehleSprache((e.target as HTMLSelectElement).value as Sprache)}>
            {(Object.keys(SPRACHEN) as Sprache[]).map((s) => <option value={s}>{SPRACHEN[s]}</option>)}
          </select>
        </label>
        <span class="leise">{t('ui.einst.spracheHinweis')}</span>
        <label class="haken"><input type="checkbox" checked={frei} onChange={async (e) => {
          const v = (e.target as HTMLInputElement).checked
          setFrei(v)
          p.setZ({ ...p.z, kern: await ruf<Zustand['kern']>('kernEinstellen', { ohneRueckfragen: v }) })
        }} /><span>{t('ui.einst.frei')}</span></label>
        <span class="leise">{mitTeilen(t('ui.einst.freiHinweis'), {
          claude: <span class="mono">--dangerously-skip-permissions</span>,
          codex: <span class="mono">--dangerously-bypass-approvals-and-sandbox</span>,
          opencode: <span class="mono">--auto</span>,
        })}</span>
        <label>{t('ui.einst.name')}
          <input class="feld" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onChange={async () => p.setZ({ ...p.z, kern: await ruf<Zustand['kern']>('kernEinstellen', { name }) })} />
        </label>
        <label>{t('ui.einst.thema')}
          <select class="feld" value={p.thema} onChange={(e) => { const neu = (e.target as HTMLSelectElement).value as 'dunkel' | 'hell'; p.setThema(neu); void ruf('einstellen', { thema: neu }) }}>
            <option value="dunkel">{t('ui.thema.nacht')}</option><option value="hell">{t('ui.thema.tag')}</option>
          </select>
        </label>
        <label>{t('ui.einst.wurzeln')}
          <textarea class="feld mono" rows={4} value={wurzeln} onInput={(e) => { setWurzeln((e.target as HTMLTextAreaElement).value); setGespeichert('') }} />
        </label>
        <div class="zeile" style={{ alignItems: 'center' }}>
          <span class="leise">{gespeichert}</span>
          <button class="knopf" style={{ flex: 'none' }} onClick={async () => {
            const r = await ruf<{ wurzeln: string[]; projekte: Zustand['projekte'] }>('wurzelnSetzen', wurzeln.split('\n').map((x) => x.trim()).filter(Boolean))
            p.setZ({ ...p.z, wurzeln: r.wurzeln, projekte: r.projekte })
            setWurzeln(r.wurzeln.join('\n'))
            setGespeichert(t(r.projekte.length === 1 ? 'ui.einst.gefunden.eins' : 'ui.einst.gefunden.viele', { n: r.projekte.length }))
          }}>{t('ui.einst.speichern')}</button>
        </div>
        <h3 style={{ margin: '8px 0 0' }}>{t('ui.einst.voice')}</h3>
        {lage && <div class={`sprachlage ${lage.erkennung ? 'gut' : 'fehlt'}`}>{lage.erkennung ? t('ui.einst.diktatBereit', { modell: lage.modell }) : lage.fehlt.join(' ')}{lage.fernFehler ? ` ${lage.fernFehler}` : ''}</div>}
        <label>{t('ui.einst.modell')}
          <input class="feld mono" value={modell} spellcheck={false} placeholder="~/…/ggml-small.bin" onInput={(e) => setModell((e.target as HTMLInputElement).value)} />
        </label>
        <label class="haken"><input type="checkbox" checked={ausgabe} onChange={(e) => setAusgabe((e.target as HTMLInputElement).checked)} /><span>{t('ui.einst.vorlesen')}</span></label>
        <label>{t('ui.einst.stimme')}
          <input class="feld mono" value={stimme} spellcheck={false} placeholder="~/…/de_DE-….onnx" onInput={(e) => setStimme((e.target as HTMLInputElement).value)} />
        </label>
        {lage && lage.stimmen.length > 1 && (
          <label>{t('ui.einst.stimmenImOrdner')}
            <select class="feld" value={lage.stimmen.find((s) => s.endsWith(stimme.replace(/^~/, ''))) ?? ''} onChange={(e) => setStimme((e.target as HTMLSelectElement).value)}>
              <option value="" />
              {lage.stimmen.map((s) => <option value={s}>{s.split('/').pop()!.replace(/\.onnx$/, '')}</option>)}
            </select>
          </label>
        )}
        <label>{t('ui.einst.piper')}
          <input class="feld mono" value={piper} spellcheck={false} placeholder="~/…/bin/piper" onInput={(e) => setPiper((e.target as HTMLInputElement).value)} />
        </label>
        {lage && <div class={`sprachlage ${lage.vorleser ? 'gut' : 'fehlt'}`}>{lage.vorleserFehlt ?? t(`ui.einst.vorleser.${lage.vorleser ?? 'keiner'}`)}</div>}
        <div class="zeile" style={{ justifyContent: 'flex-end' }}><button class="knopf flach" style={{ flex: 'none' }} onClick={async () => { await spracheSpeichern(); void ruf('sprechProbe') }}>{t('ui.einst.sprechProbe')}</button></div>
        <label>{t('ui.einst.bruecke')}
          <input class="feld mono" value={bruecke} spellcheck={false} placeholder="/…/bt-remote-bridge" onInput={(e) => setBruecke((e.target as HTMLInputElement).value)} />
        </label>
        <label>{t('ui.einst.tasten', { vorgabe: lage ? Object.entries(lage.tastenVorgabe).map(([k, v]) => `${k}=${v}`).join(', ') : '…' })}
          <textarea class="feld mono" rows={3} value={tasten} spellcheck={false} onInput={(e) => setTasten((e.target as HTMLTextAreaElement).value)} />
        </label>
        {lage && <span class="leise">{t('ui.einst.aktionen', { liste: Object.entries(lage.aktionen).map(([k, v]) => `${k} (${v})`).join(', ') })}</span>}
        <div class="zeile" style={{ justifyContent: 'flex-end' }}><button class="knopf" style={{ flex: 'none' }} onClick={() => void spracheSpeichern()}>{t('ui.einst.voiceSpeichern')}</button></div>
        <h3 style={{ margin: '8px 0 0' }}>{t('ui.einst.telegram')}</h3>
        {tele && (
          <>
            <label class="haken"><input type="checkbox" checked={tele.an} onChange={async (e) => teleUebernehmen(await ruf<TelegramLage>('telegramEinstellen', { an: (e.target as HTMLInputElement).checked }))} /><span>{t('ui.einst.telegramAn')}</span></label>
            <span class="leise">{t('ui.einst.telegramHinweis')}</span>
            <label>{t('ui.einst.telegramToken')}
              <input class="feld mono" type="password" autocomplete="off" spellcheck={false} value={teleToken} placeholder={tele.tokenDa ? t('ui.einst.telegramTokenDa') : '123456789:AA…'} onInput={(e) => setTeleToken((e.target as HTMLInputElement).value)} />
            </label>
            <label>{t('ui.einst.telegramChat')}
              <input class="feld mono" spellcheck={false} value={teleChat} placeholder="123456789" onInput={(e) => setTeleChat((e.target as HTMLInputElement).value)} />
            </label>
            <div class={`sprachlage ${tele.bereit ? 'gut' : 'fehlt'}`}>{teleStand || t(tele.bereit ? 'ui.einst.telegramBereit' : !tele.an ? 'ui.einst.telegramAus' : tele.tokenDa && !tele.tokenGueltig ? 'ui.einst.telegramTokenFalsch' : 'ui.einst.telegramFehlt')}</div>
            <div class="zeile" style={{ justifyContent: 'flex-end' }}>
              <button class="knopf flach" style={{ flex: 'none' }} disabled={!tele.bereit} onClick={async () => { setTeleStand('…'); const f = await ruf<string | null>('telegramProbe'); setTeleStand(f ? t('ui.einst.telegramProbeFehler', { grund: f }) : t('ui.einst.telegramProbeOk')) }}>{t('ui.einst.telegramProbe')}</button>
              <button class="knopf" style={{ flex: 'none' }} onClick={async () => { setTeleStand(''); teleUebernehmen(await ruf<TelegramLage>('telegramEinstellen', { token: teleToken, chat: teleChat })) }}>{t('ui.einst.telegramSpeichern')}</button>
            </div>
          </>
        )}
        <h3 style={{ margin: '8px 0 0' }}>{t('ui.einst.mobil')}</h3>
        {mobil && (
          <>
            <label class="haken"><input type="checkbox" checked={mobil.an} onChange={(e) => void mobilSetzen({ an: (e.target as HTMLInputElement).checked })} /><span>{t('ui.einst.mobilAn')}</span></label>
            <span class="leise">{mitTeilen(t('ui.einst.mobilHinweis'), { befehl: <span class="mono">tailscale serve --bg --https={Number(mobilPort) + 1 || 8745} http://127.0.0.1:{mobilPort || mobil.port}</span> })}</span>
            {mobil.fehler && <div class="sprachlage fehlt">{mobil.fehler}</div>}
            <label>{t('ui.einst.mobilPort')}
              <input class="feld mono" inputMode="numeric" value={mobilPort} onInput={(e) => setMobilPort((e.target as HTMLInputElement).value)} />
            </label>
            <label>{t('ui.einst.mobilAdresse')}
              <input class="feld mono" value={mobilAdresse} spellcheck={false} placeholder="https://…:8745" onInput={(e) => setMobilAdresse((e.target as HTMLInputElement).value)} />
            </label>
            <div class="zeile" style={{ justifyContent: 'flex-end' }}><button class="knopf" style={{ flex: 'none' }} onClick={() => void mobilSetzen({ port: Number(mobilPort) || undefined, adresse: mobilAdresse })}>{t('ui.einst.mobilSpeichern')}</button></div>
            {mobil.link && (
              <>
                <span class="leise">{t('ui.einst.mobilLink')}</span>
                <div class="sprachlage gut mono" style={{ overflowWrap: 'anywhere', wordBreak: 'break-all', userSelect: 'text' }}>{mobil.link}</div>
                <div class="zeile" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span class="leise">{kopiert ? t('ui.einst.mobilKopiert') : ''}</span>
                  <button class="knopf flach" style={{ flex: 'none' }} onClick={() => void mobilSetzen({ neuerSchluessel: true })}>{t('ui.einst.mobilSchluessel')}</button>
                  <button class="knopf" style={{ flex: 'none' }} onClick={() => void navigator.clipboard.writeText(mobil.link).then(() => setKopiert(true))}>{t('ui.einst.mobilKopieren')}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <footer><button class="knopf haupt" onClick={p.zu}>{t('ui.fertig')}</button></footer>
    </div>
  )
}
