/** R-28: Was vom Betriebssystem abhängt, wird hier für macOS und Linux auf derselben Maschine geprüft. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { zustandsOrdner, suchpfade, anmeldeShell, findeProgramm, vorleser } from '../src/core/plattform'
import { befehl, kuerzel } from '../src/ui/plattform'
import { t, tIn, setzeSprache, setzeZuschnitt } from '../src/texte'

test('Ablageort: macOS unter Library, Linux nach XDG', () => {
  assert.equal(zustandsOrdner('darwin', {}, '/Users/a'), '/Users/a/Library/Application Support/coop-deck')
  assert.equal(zustandsOrdner('linux', {}, '/home/a'), '/home/a/.local/share/coop-deck')
  assert.equal(zustandsOrdner('linux', { XDG_DATA_HOME: '/daten' }, '/home/a'), '/daten/coop-deck')
  // Ein relativer Wert ist laut XDG ungültig.
  assert.equal(zustandsOrdner('linux', { XDG_DATA_HOME: 'daten' }, '/home/a'), '/home/a/.local/share/coop-deck')
  // XDG gilt unter macOS nicht, auch wenn die Variable gesetzt ist.
  assert.equal(zustandsOrdner('darwin', { XDG_DATA_HOME: '/daten' }, '/Users/a'), '/Users/a/Library/Application Support/coop-deck')
})

test('Suchpfade: Homebrew nur unter macOS, ~/.local/bin überall', () => {
  const mac = suchpfade('darwin', '/Users/a')
  const linux = suchpfade('linux', '/home/a')
  assert.ok(mac.includes('/opt/homebrew/bin'))
  assert.ok(!linux.some((p) => p.startsWith('/opt/homebrew')))
  assert.ok(mac.includes('/Users/a/.local/bin'))
  assert.ok(linux.includes('/home/a/.local/bin'))
  assert.ok(linux.includes('/usr/local/bin'))
})

test('Shell: die eigene, wenn es sie gibt; sonst die erste vorhandene; zuletzt /bin/sh', () => {
  const gibt = (...da: string[]) => (f: string) => da.includes(f)
  assert.equal(anmeldeShell('linux', { SHELL: '/usr/bin/fish' }, gibt('/usr/bin/fish', '/bin/bash')), '/usr/bin/fish')
  // SHELL zeigt ins Leere (aus einer anderen Umgebung geerbt): nicht blind starten.
  assert.equal(anmeldeShell('linux', { SHELL: '/bin/zsh' }, gibt('/bin/bash')), '/bin/bash')
  assert.equal(anmeldeShell('linux', {}, gibt('/usr/bin/zsh')), '/usr/bin/zsh')
  assert.equal(anmeldeShell('linux', {}, gibt()), '/bin/sh')
  assert.equal(anmeldeShell('darwin', {}, gibt('/bin/zsh', '/bin/bash')), '/bin/zsh')
  assert.equal(anmeldeShell('linux', { SHELL: 'zsh' }, gibt('zsh', '/bin/bash')), '/bin/bash')
})

test('Programmsuche: findet Ausführbares im PATH, übergeht Verzeichnisse und nicht Ausführbares', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coopdeck-pfad-'))
  try {
    const a = path.join(tmp, 'a'), b = path.join(tmp, 'b')
    fs.mkdirSync(a); fs.mkdirSync(b)
    fs.writeFileSync(path.join(a, 'werkzeug'), '#!/bin/sh\n', { mode: 0o644 })
    fs.writeFileSync(path.join(b, 'werkzeug'), '#!/bin/sh\n', { mode: 0o755 })
    fs.mkdirSync(path.join(a, 'ordner'))
    const pfad = ['', a, path.join(tmp, 'fehlt'), b].join(path.delimiter)
    assert.equal(findeProgramm('werkzeug', pfad), path.join(b, 'werkzeug'))
    assert.equal(findeProgramm('ordner', pfad), null)
    assert.equal(findeProgramm('gibtesnicht', pfad), null)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('Vorlesen: say unter macOS, espeak-ng unter Linux in der Sprache der Oberfläche', () => {
  assert.deepEqual(vorleser('darwin', { sprache: 'de' }), [{ programm: 'say', argumente: [] }])
  assert.deepEqual(vorleser('darwin', { stimme: 'Anna', sprache: 'de' }), [{ programm: 'say', argumente: ['-v', 'Anna'] }])
  assert.deepEqual(vorleser('linux', { sprache: 'en' })[0], { programm: 'espeak-ng', argumente: ['-v', 'en'] })
  assert.deepEqual(vorleser('linux', { stimme: 'de+f3', sprache: 'en' })[0], { programm: 'espeak-ng', argumente: ['-v', 'de+f3'] })
})

test('Befehlstaste: ⌘ unter macOS, Strg+Umschalt anderswo; Strg allein bleibt dem Terminal', () => {
  const t = (o: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }>) => ({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o })
  // macOS
  assert.ok(befehl(t({ metaKey: true }), '', true))
  assert.ok(!befehl(t({ metaKey: true, shiftKey: true }), '', true))
  assert.ok(befehl(t({ metaKey: true, shiftKey: true }), 'umschalt', true))
  assert.ok(befehl(t({ metaKey: true, altKey: true }), 'alt', true))
  assert.ok(!befehl(t({ ctrlKey: true, shiftKey: true }), '', true))
  // Linux
  assert.ok(!befehl(t({ ctrlKey: true }), '', false), 'Strg+K gehört der Shell')
  assert.ok(befehl(t({ ctrlKey: true, shiftKey: true }), '', false))
  assert.ok(befehl(t({ ctrlKey: true, shiftKey: true }), 'umschalt', false))
  assert.ok(befehl(t({ ctrlKey: true, altKey: true }), 'alt', false))
  assert.ok(!befehl(t({ ctrlKey: true, altKey: true, shiftKey: true }), 'alt', false))
  assert.ok(!befehl(t({ metaKey: true }), '', false))
})

test('Kürzel-Beschriftung: unter macOS unverändert, anderswo ausgeschrieben', () => {
  assert.equal(kuerzel('Suchen ⌘K', true), 'Suchen ⌘K')
  assert.equal(kuerzel('Suchen ⌘K', false), 'Suchen Ctrl+Shift+K')
  assert.equal(kuerzel('Diktat (⌘⇧D)', false), 'Diktat (Ctrl+Shift+D)')
  assert.equal(kuerzel('⌘⌥1 Session, ⌘⌥2 beide', false), 'Ctrl+Alt+1 Session, Ctrl+Alt+2 beide')
  assert.equal(kuerzel('⌘↵', false), 'Ctrl+Enter')
})

test('Zuschnitt: Texte aus dem Katalog werden umgeschrieben, eingesetzte Werte nicht', () => {
  try {
    setzeZuschnitt((v) => v.replace('Befehl', 'Auftrag'))
    assert.equal(tIn('de', 'befehl.unbekannt', { was: 'Befehl' }), 'Unbekannter Befehl „Befehl“. coop hilfe zeigt alles.')
    setzeSprache('de')
    assert.equal(t('befehl.unbekannt', { was: 'Befehl' }), 'Unbekannter Auftrag „Befehl“. coop hilfe zeigt alles.')
  } finally {
    setzeZuschnitt(null)
  }
})

test('Vorlesen mit Piper: Aussprachetabelle ersetzt ganze Wörter und Wendungen, auch über einen Verweis auf das Modell', async () => {
  const sp = await import('../src/core/sprache')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coopdeck-stimme-test-'))
  try {
    const modell = path.join(dir, 'de_DE-probe-medium.onnx')
    fs.writeFileSync(modell, 'x')
    fs.writeFileSync(`${modell}.json`, '{}')
    fs.writeFileSync(path.join(dir, 'de_DE-probe-medium.respellings.json'), JSON.stringify({ Session: 'Saeschn', 'Pull Request': 'Pull Rikwest', Pull: 'Pul', Claude: 'Kload', leer: 7 }))
    const a = sp.aussprache(modell)
    assert.equal(a('Die Session ist fertig.'), 'Die Saeschn ist fertig.')
    assert.equal(a('Ein Pull Request von Claude'), 'Ein Pull Rikwest von Kload')
    assert.equal(a('session und SESSION'), 'Saeschn und Saeschn', 'Groß und Klein zählen nicht')
    assert.equal(a('Sessions und Pullover'), 'Sessions und Pullover', 'nur ganze Wörter')
    // Eine ruhigere Fassung derselben Stimme ist ein Verweis mit eigenen Angaben: ihre Tabelle ist die des Modells.
    const ruhig = path.join(dir, 'de_DE-probe-medium-ruhig.onnx')
    fs.symlinkSync(path.basename(modell), ruhig)
    assert.equal(sp.aussprache(ruhig)('Session'), 'Saeschn')
    assert.equal(sp.aussprache(path.join(dir, 'ohne-tabelle.onnx'))('Session'), 'Session')

    // Die Lage sagt, womit vorgelesen wird und was fehlt.
    const fehlt = sp.lage({ stimme: path.join(dir, 'gibt-es-nicht.onnx') })
    assert.equal(fehlt.vorleser, null)
    assert.equal(fehlt.ausgabe, false)
    assert.match(fehlt.vorleserFehlt ?? '', /gibt-es-nicht\.onnx/)
    const ohneProgramm = sp.lage({ stimme: modell, piper: path.join(dir, 'kein-piper') })
    assert.match(ohneProgramm.vorleserFehlt ?? '', /kein-piper/)
    assert.deepEqual(ohneProgramm.stimmen.map((x) => path.basename(x)), ['de_DE-probe-medium-ruhig.onnx', 'de_DE-probe-medium.onnx'])
    assert.equal(sp.lage({ stimme: 'Anna' }).vorleserFehlt, null, 'ein Name ist eine Stimme des Systems, kein Piper')
    assert.equal(sp.sprechen('Text', { stimme: path.join(dir, 'gibt-es-nicht.onnx') }), false, 'fehlt die gewählte Stimme, bleibt es still')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
