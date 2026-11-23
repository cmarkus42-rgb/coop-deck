/** Typen und Zugang zur Hülle. Die Oberfläche kennt den Kern nur über diese Brücke. */

export interface Projekt { id: string; pfad: string; name: string; favorit: boolean; ausgeblendet: boolean; zuletzt: number; cli: string; autostart: 'neu' | 'fortsetzen' | 'nein'; hatCoop: boolean }
export interface Artefakt { id: string; titel: string; typ: string; adresse: string; url?: string; quelle?: string }
export interface Sitzung { id: string; projektId: string; art: 'cli' | 'terminal'; cli: string | null; titel: string; zweck?: string; roadmap?: { artefakt: string; punkt: string }; erstellt: number; aktiv: number; zustand: 'arbeitet' | 'ruhig' | 'wartet' | 'beendet'; achtung?: 'fertig' | 'wartet'; ergebnis?: string; schlange?: number; frei?: boolean }
export interface Dienst { name: string; url: string; start: string; gemeinsam: boolean; zweck: string; hilfe: string; kennung: string; laeuft: boolean; freigegeben: boolean; vonUns: boolean }
export interface Bezug { ref?: string; label?: string; selektor?: string; inhalt?: string; datei?: string; zeile?: number; kontext?: unknown; unsicher: boolean }
export interface Marke { nr: number; art: string; text: string; bezug: Bezug; rect?: { x: number; y: number; w: number; h: number } }
export interface Hinweis { id: string; von: string; artefakt?: string; ref?: string; text: string }
export interface Frage { id: string; titel: string; text?: string; optionen: { id: string; titel: string; beschreibung?: string }[] }
export interface Sprache { modell?: string; sprache?: string; ausgabe?: boolean; stimme?: string; piper?: string; bruecke?: string; tasten?: Record<string, string> }
export interface SprachLage { erkennung: boolean; ausgabe: boolean; vorleser: 'piper' | 'system' | null; vorleserFehlt: string | null; stimmen: string[]; fehlt: string[]; modell: string | null; fernbedienung: boolean; aktionen: Record<string, string>; tastenVorgabe: Record<string, string>; fernFehler: string | null }
export interface Treffer { art: 'projekt' | 'sitzung' | 'artefakt' | 'punkt' | 'rueckmeldung'; projektId: string; projekt: string; kennung: string; titel: string; text?: string; artefakt?: string; ref?: string }
export interface Posten { art: 'frage' | 'sitzung' | 'hinweis' | 'schlange' | 'anfrage' | 'lieferung' | 'dienst'; projektId: string; projekt: string; kennung: string; titel: string; text?: string; zeit: string; frage?: Frage; sitzung?: string; artefakt?: string; ref?: string }
export interface MobilLage { an: boolean; port: number; adresse: string; laeuft: boolean; fehler: string | null; link: string }
export interface TelegramLage { an: boolean; tokenDa: boolean; tokenGueltig: boolean; chat: string; bereit: boolean }
export interface Cli { id: string; name: string; da: boolean; fortsetzenGenau: boolean }
export interface Typ { id: string; name: string; zweck: string }
export interface Raum { projekt: Projekt; artefakte: Artefakt[]; sitzungen: Sitzung[]; dienste: Dienst[]; hinweise: Hinweis[]; layout: Layout | null }
export interface Layout { reiter: { art: string; id?: string; adresse?: string; titel?: string }[]; aktiv?: string; teilung?: number; sicht?: Sicht; leisteZu?: boolean }
export type Sicht = 'beide' | 'links' | 'rechts'
export interface Zustand { projekte: Projekt[]; clis: Cli[]; typen: Typ[]; basis: string; token: string; startfehler: string[]; einstellungen: { thema: 'dunkel' | 'hell'; letztesProjekt?: string; alleProjekteOffen?: boolean }; kern: { ohneRueckfragen: boolean; name: string; sprache?: Sprache; anzeigesprache: 'de' | 'en' }; wurzeln: string[] }

interface Bruecke {
  ruf(name: string, ...args: unknown[]): Promise<unknown>
  eingabe(sid: string, data: string): void
  groesse(sid: string, cols: number, rows: number): void
  bei(fn: (name: string, ...args: any[]) => void): void
  pfadVon(datei: File): string
}

export const deck = (window as unknown as { deck: Bruecke }).deck

export function ruf<T>(name: string, ...args: unknown[]): Promise<T> {
  return deck.ruf(name, ...args) as Promise<T>
}
