/**
 * Platz für eine lokale Erweiterung der Oberfläche: Knöpfe in der Kopfzeile samt eigenem Dialog.
 * Liegt `src/lokal/ui.tsx` vor, nimmt der Bau sie statt dieser Datei (`build.mjs`, Alias `@lokal/ui`).
 */
export interface LokalLage { projekt?: string; pfad?: string; sitzung?: string; reiter?: string; sicht?: string }
export interface LokalProps {
  /** Was gerade offen ist, im Augenblick des Aufrufs. */
  lage: () => LokalLage
  /** Diktat starten oder beenden; der Text geht in das Feld mit dem Cursor. */
  diktat: () => void
  diktatLaeuft: boolean
  melde: (text: string) => void
}

export function Lokal(_p: LokalProps) {
  return null
}
