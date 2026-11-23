/**
 * Melden über Telegram (CP-13): eine Nachricht an einen Bot-Chat, den der Mensch in den
 * Einstellungen einträgt. Das ist die eine Stelle, an der der Kern von sich aus ins Netz geht;
 * sie ist aus, bis Token und Chat eingetragen sind. Verschickt wird reiner Text ohne Auszeichnung.
 */
export interface TelegramEinstellung {
  an?: boolean
  token?: string
  chat?: string
}

/** Länge einer Nachricht; Telegram nimmt 4096 Zeichen, der Kopf mit Projekt und Session braucht Platz. */
export const TELEGRAM_LAENGE = 3500

export const tokenGueltig = (t: string | undefined): t is string => /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(t ?? '')
export const chatGueltig = (c: string | undefined): c is string => /^-?\d{3,}$|^@[A-Za-z0-9_]{4,}$/.test(c ?? '')

export function eingerichtet(e: TelegramEinstellung | undefined): e is { an: true; token: string; chat: string } {
  return !!e?.an && tokenGueltig(e.token) && chatGueltig(e.chat)
}

/** Wohin gesendet wird. Für Tests auf einen lokalen Server umstellbar. */
const basis = () => (process.env.COOP_DECK_TELEGRAM_API || 'https://api.telegram.org').replace(/\/+$/, '')

/** Schickt den Text. Liefert `null`, wenn er angenommen wurde, sonst den Grund. Das Token steht nie im Grund. */
export async function senden(e: { token: string; chat: string }, text: string): Promise<string | null> {
  try {
    const res = await fetch(`${basis()}/bot${e.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: e.chat, text: text.slice(0, 4096), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    })
    const j = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null
    if (res.ok && j?.ok) return null
    return `${res.status} ${String(j?.description ?? '').slice(0, 160)}`.trim().split(e.token).join('…')
  } catch (err) {
    return String((err as Error).message).slice(0, 160).split(e.token).join('…')
  }
}
