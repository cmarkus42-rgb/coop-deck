/**
 * Was vom Betriebssystem abhängt (R-28): Ablageort, Suchpfade, Shell, Vorleseprogramm.
 * Die Funktionen bekommen System, Umgebung und Heimatverzeichnis gereicht, damit die Tests
 * auf einer Maschine alle Systeme prüfen. Windows läuft nur über WSL und ist dort Linux.
 */
import fs from 'fs'
import path from 'path'

export type System = NodeJS.Platform
type Umgebung = Record<string, string | undefined>

/**
 * Ordner für Einstellungen und Laufzeitzustand. macOS: `~/Library/Application Support/coop-deck`.
 * Sonst nach XDG: `$XDG_DATA_HOME/coop-deck`, ohne die Variable `~/.local/share/coop-deck`.
 * Ein relativer Wert in `XDG_DATA_HOME` gilt laut XDG als ungültig und wird übergangen.
 */
export function zustandsOrdner(system: System, env: Umgebung, heim: string): string {
  if (system === 'darwin') return path.join(heim, 'Library', 'Application Support', 'coop-deck')
  const xdg = env.XDG_DATA_HOME
  return path.join(xdg && path.isAbsolute(xdg) ? xdg : path.join(heim, '.local', 'share'), 'coop-deck')
}

/**
 * Verzeichnisse, in denen CLIs üblicherweise liegen und die einer App aus dem Dock oder
 * dem Startmenü im PATH fehlen. Verzeichnisse, die es nicht gibt, schaden im PATH nicht.
 */
export function suchpfade(system: System, heim: string): string[] {
  const eigen = [path.join(heim, '.local', 'bin'), path.join(heim, '.bun', 'bin')]
  if (system === 'darwin') return ['/opt/homebrew/bin', '/opt/homebrew/opt/node@22/bin', '/usr/local/bin', ...eigen]
  return ['/usr/local/bin', ...eigen, path.join(heim, '.npm-global', 'bin'), path.join(heim, '.cargo', 'bin'), '/home/linuxbrew/.linuxbrew/bin', '/snap/bin']
}

/**
 * Shell für Terminals und Dienste: die des Menschen (`SHELL`), sonst die erste vorhandene.
 * Alle hier genannten verstehen `-l` und `-c`.
 */
export function anmeldeShell(system: System, env: Umgebung, gibtEs: (datei: string) => boolean = fs.existsSync): string {
  if (env.SHELL && path.isAbsolute(env.SHELL) && gibtEs(env.SHELL)) return env.SHELL
  const folge = system === 'darwin' ? ['/bin/zsh', '/bin/bash'] : ['/bin/bash', '/usr/bin/bash', '/bin/zsh', '/usr/bin/zsh']
  return folge.find(gibtEs) ?? '/bin/sh'
}

/** Sucht ein Programm im angegebenen PATH; ohne `which`, das nicht jedes System mitbringt. */
export function findeProgramm(name: string, pfad: string): string | null {
  for (const d of pfad.split(path.delimiter)) {
    if (!d) continue
    const f = path.join(d, name)
    try {
      fs.accessSync(f, fs.constants.X_OK)
      if (fs.statSync(f).isFile()) return f
    } catch { /* weiter */ }
  }
  return null
}

/**
 * Programme zum Vorlesen in der Reihenfolge der Wahl, mit den Argumenten vor dem Text.
 * macOS bringt `say` mit; unter Linux ist `espeak-ng` verbreitet. Der Text folgt als
 * eigenes Argument nach `--`, nie durch eine Shell.
 */
export function vorleser(system: System, o: { stimme?: string; sprache: string }): { programm: string; argumente: string[] }[] {
  if (system === 'darwin') return [{ programm: 'say', argumente: o.stimme ? ['-v', o.stimme] : [] }]
  const stimme = ['-v', o.stimme || o.sprache]
  return [{ programm: 'espeak-ng', argumente: stimme }, { programm: 'espeak', argumente: stimme }]
}
