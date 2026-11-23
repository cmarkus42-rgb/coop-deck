/**
 * MCP-Server des Decks (AG-02): dieselben Funktionen wie der Befehl `coop`, als Tools.
 * Dünn: jedes Tool wird in die Argumente des Befehls übersetzt, der Kern entscheidet.
 * Transport: stdio, eine JSON-RPC-Nachricht je Zeile.
 */
import readline from 'readline'
import { t, type Schluessel } from '../texte'

type Arg = Record<string, unknown>
type Schema = { type: 'object'; properties: Record<string, unknown>; required?: string[] }

interface Tool {
  name: string
  /** Schlüssel der Beschreibung; übersetzt wird beim Auflisten. */
  description: Schluessel
  inputSchema: Schema
  argv: (a: Arg) => string[]
}

const s = (description: Schluessel) => ({ type: 'string', description })
const flag = (name: string, v: unknown): string[] => (v === undefined || v === null || v === '' ? [] : [`--${name}`, String(v)])
const obj = (properties: Record<string, unknown>, required: string[] = []): Schema => ({ type: 'object', properties, required })

const BEZUG: Schluessel = 'mcp.bezug'
const STATUS = ['offen', 'in-arbeit', 'pruefen', 'erledigt', 'verworfen']

export const TOOLS: Tool[] = [
  { name: 'coop_artefakt_liste', description: 'mcp.artefaktListe', inputSchema: obj({}), argv: () => ['artefakt', 'liste'] },
  { name: 'coop_artefakt_neu', description: 'mcp.artefaktNeu',
    inputSchema: obj({ typ: s('mcp.p.typ'), titel: s('mcp.p.titel'), quelle: s('mcp.p.quelle'), url: s('mcp.p.url') }, ['typ', 'titel']),
    argv: (a) => ['artefakt', 'neu', String(a.typ), String(a.titel), ...flag('quelle', a.quelle), ...flag('url', a.url)] },
  { name: 'coop_artefakt_import', description: 'mcp.artefaktImport',
    inputSchema: obj({ datei: s('mcp.p.datei'), titel: s('mcp.p.titel'), herkunft: s('mcp.p.herkunft') }, ['datei', 'titel']),
    argv: (a) => ['artefakt', 'import', String(a.datei), String(a.titel), ...flag('herkunft', a.herkunft)] },
  { name: 'coop_zeigen', description: 'mcp.zeigen',
    inputSchema: obj({ ziel: s('mcp.p.ziel'), ref: s(BEZUG) }, ['ziel']), argv: (a) => ['zeigen', String(a.ziel), ...flag('ref', a.ref)] },
  { name: 'coop_hinweis', description: 'mcp.hinweis',
    inputSchema: obj({ text: s('mcp.p.meldung'), artefakt: s('mcp.p.artefakt'), ref: s(BEZUG) }, ['text']), argv: (a) => ['hinweis', String(a.text), ...flag('artefakt', a.artefakt), ...flag('ref', a.ref)] },
  { name: 'coop_frage', description: 'mcp.frage',
    inputSchema: obj({ titel: s('mcp.p.frage'), text: s('mcp.p.erlaeuterung'), optionen: { type: 'array', description: 'mcp.p.optionen', items: obj({ id: s('mcp.p.optionId'), titel: s('mcp.p.optionTitel'), beschreibung: s('mcp.p.optionText') }, ['id', 'titel']) } }, ['titel']),
    argv: (a) => ['frage', String(a.titel), ...flag('text', a.text), ...(Array.isArray(a.optionen) ? a.optionen : []).flatMap((o: Arg) => ['--option', [o.id, o.titel, o.beschreibung].filter((x) => x !== undefined && x !== '').join('::')])] },
  { name: 'coop_melden', description: 'mcp.melden', inputSchema: obj({ text: s('mcp.p.meldenText') }, ['text']), argv: (a) => ['melden', String(a.text)] },
  { name: 'coop_anfordern', description: 'mcp.anfordern',
    inputSchema: obj({ titel: s('mcp.p.anfordernTitel'), text: s('mcp.p.anfordernText'), art: { type: 'string', enum: ['foto', 'ton', 'beides'] } }, ['titel']),
    argv: (a) => ['anfordern', String(a.titel), ...flag('text', a.text), ...flag('art', a.art)] },
  { name: 'coop_antwort', description: 'mcp.antwort', inputSchema: obj({ frage: s('mcp.p.frageId') }, ['frage']), argv: (a) => ['antwort', String(a.frage)] },
  { name: 'coop_bild', description: 'mcp.bild',
    inputSchema: obj({ ziel: s('mcp.p.ziel'), breite: { type: 'number' }, hoehe: { type: 'number' } }, ['ziel']), argv: (a) => ['bild', String(a.ziel), ...flag('breite', a.breite), ...flag('hoehe', a.hoehe)] },
  { name: 'coop_roadmap_liste', description: 'mcp.roadmapListe', inputSchema: obj({ artefakt: s('mcp.p.roadmapMehrere') }), argv: (a) => ['roadmap', 'liste', ...flag('artefakt', a.artefakt)] },
  { name: 'coop_roadmap_zeige', description: 'mcp.roadmapZeige', inputSchema: obj({ punkt: s('mcp.p.punkt'), artefakt: s('mcp.p.roadmap') }, ['punkt']), argv: (a) => ['roadmap', 'zeige', String(a.punkt), ...flag('artefakt', a.artefakt)] },
  { name: 'coop_roadmap_status', description: 'mcp.roadmapStatus',
    inputSchema: obj({ punkt: s('mcp.p.punkt'), status: { type: 'string', enum: STATUS }, notiz: s('mcp.p.getan'), artefakt: s('mcp.p.roadmap') }, ['punkt', 'status']),
    argv: (a) => ['roadmap', 'status', String(a.punkt), String(a.status), ...flag('notiz', a.notiz), ...flag('artefakt', a.artefakt)] },
  { name: 'coop_roadmap_neu', description: 'mcp.roadmapNeu',
    inputSchema: obj({ titel: s('mcp.p.titel'), meilenstein: s('mcp.p.meilenstein'), beschreibung: s('mcp.p.beschreibung'), abnahme: { type: 'array', items: { type: 'string' }, description: 'mcp.p.abnahme' }, artefakt: s('mcp.p.roadmap') }, ['titel']),
    argv: (a) => ['roadmap', 'neu', String(a.titel), ...flag('meilenstein', a.meilenstein), ...flag('beschreibung', a.beschreibung), ...(Array.isArray(a.abnahme) ? a.abnahme : []).flatMap((x) => ['--abnahme', String(x)]), ...flag('artefakt', a.artefakt)] },
  { name: 'coop_roadmap_notiz', description: 'mcp.roadmapNotiz', inputSchema: obj({ punkt: s('mcp.p.kennung'), text: s('mcp.p.notiz'), artefakt: s('mcp.p.roadmap') }, ['punkt', 'text']), argv: (a) => ['roadmap', 'notiz', String(a.punkt), String(a.text), ...flag('artefakt', a.artefakt)] },
  { name: 'coop_rueckmeldung_liste', description: 'mcp.rueckListe', inputSchema: obj({}), argv: () => ['rueckmeldung', 'liste'] },
  { name: 'coop_rueckmeldung_erledigt', description: 'mcp.rueckErledigt', inputSchema: obj({ kennung: s('mcp.p.rueckId'), notiz: s('mcp.p.geaendert') }, ['kennung']), argv: (a) => ['rueckmeldung', 'erledigt', String(a.kennung), ...flag('notiz', a.notiz)] },
  { name: 'coop_sitzung_ergebnis', description: 'mcp.ergebnis', inputSchema: obj({ text: s('mcp.p.saetze') }, ['text']), argv: (a) => ['sitzung', 'ergebnis', String(a.text)] },
  { name: 'coop_uebergabe', description: 'mcp.uebergabe',
    inputSchema: obj({ stand: s('mcp.p.stand'), offen: { type: 'array', items: { type: 'string' }, description: 'mcp.p.offen' }, naechster: s('mcp.p.naechster') }, ['stand']),
    argv: (a) => ['uebergabe', String(a.stand), ...(Array.isArray(a.offen) ? a.offen : []).flatMap((x) => ['--offen', String(x)]), ...flag('naechster', a.naechster)] },
]

/** Setzt in einem Schema an die Stelle jedes Schlüssels unter `description` den Text in der gewählten Sprache. */
function inWorten<T>(schema: T): T {
  if (Array.isArray(schema)) return schema.map(inWorten) as T
  if (!schema || typeof schema !== 'object') return schema
  return Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, k === 'description' && typeof v === 'string' ? t(v as Schluessel) : inWorten(v)])) as T
}

export type Ausfuehren = (argv: string[]) => Promise<{ code: number; aus: string }>

/** Beantwortet eine JSON-RPC-Nachricht; `null` heißt: keine Antwort (Benachrichtigung). */
export async function behandeln(msg: { id?: unknown; method?: string; params?: Arg }, ausfuehren: Ausfuehren): Promise<object | null> {
  const antwort = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result })
  const fehler = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } })
  if (msg.id === undefined || msg.id === null) return null
  switch (msg.method) {
    case 'initialize':
      return antwort({ protocolVersion: (msg.params?.protocolVersion as string) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'coop-deck', version: '0.0.1' },
        instructions: t('mcp.anleitung') })
    case 'ping':
      return antwort({})
    case 'tools/list':
      return antwort({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description: t(description), inputSchema: inWorten(inputSchema) })) })
    case 'tools/call': {
      const tool = TOOLS.find((x) => x.name === msg.params?.name)
      if (!tool) return fehler(-32602, t('mcp.toolUnbekannt', { name: String(msg.params?.name) }))
      const args = (msg.params?.arguments as Arg) ?? {}
      const fehlt = (tool.inputSchema.required ?? []).filter((k) => args[k] === undefined || args[k] === '')
      if (fehlt.length) return antwort({ content: [{ type: 'text', text: t('mcp.fehlt', { liste: fehlt.join(', ') }) }], isError: true })
      const r = await ausfuehren(tool.argv(args))
      return antwort({ content: [{ type: 'text', text: r.aus || 'ok' }], isError: r.code !== 0 })
    }
    default:
      return fehler(-32601, t('mcp.methodeFehlt', { name: msg.method }))
  }
}

export async function mcpLaufen(ausfuehren: Ausfuehren): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin })
  for await (const zeile of rl) {
    if (!zeile.trim()) continue
    let msg: { id?: unknown; method?: string; params?: Arg }
    try { msg = JSON.parse(zeile) } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: t('mcp.keinJson') } }) + '\n'); continue }
    const r = await behandeln(msg, ausfuehren).catch((e) => ({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String((e as Error).message) } }))
    if (r) process.stdout.write(JSON.stringify(r) + '\n')
  }
}
