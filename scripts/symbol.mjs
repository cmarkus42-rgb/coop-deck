// Zeichnet das App-Symbol als Pixelbild (16×16 Raster) und legt daraus build/icon.icns an.
// Ohne Abhängigkeiten: PNG von Hand, .icns mit den macOS-Werkzeugen sips und iconutil.
import zlib from 'zlib'
import fs from 'fs'
import { execFileSync } from 'child_process'

const FARBEN = {
  '.': null,          // durchsichtig
  K: '#1c333b',       // Gehäusekante
  G: '#305560',       // Gehäuse
  F: '#396370',       // Kopfleiste
  W: '#2a4852',       // Wanne (Terminal)
  T: '#5a8b97',       // Teiler, hell
  E: '#f1ead9',       // Text
  C: '#5cf2d6',       // Mint
  M: '#ff5fc0',       // Magenta
  Y: '#f6e84a',       // Gelb
}
// Links das Terminal mit Eingabezeichen, rechts das Artefakt mit einer Marke, dazwischen der gerasterte Teiler.
const BILD = [
  '................',
  '..KKKKKKKKKKKK..',
  '.KFFFFFFFFFFFFK.',
  '.KFMFYFCFFFFFFK.',
  '.KKKKKKKKKKKKKK.',
  '.KWWWWWWTGGGGGK.',
  '.KWCWWWWWGMMMGK.',
  '.KWWCWWWTGMGMGK.',
  '.KWCWEEWWGMMMGK.',
  '.KWWWWWWTGGGGGK.',
  '.KWEEEWWWGEEEGK.',
  '.KWWWWWWTGGGGGK.',
  '.KWEEWWWWGEEGGK.',
  '.KWWWWWWTGGGGGK.',
  '..KKKKKKKKKKKK..',
  '................',
]

function png(seite) {
  const f = seite / 16
  const roh = Buffer.alloc((seite * 4 + 1) * seite)
  for (let y = 0; y < seite; y++) {
    const z = y * (seite * 4 + 1)
    roh[z] = 0
    for (let x = 0; x < seite; x++) {
      const farbe = FARBEN[BILD[Math.floor(y / f)][Math.floor(x / f)]]
      const o = z + 1 + x * 4
      if (!farbe) continue
      roh[o] = parseInt(farbe.slice(1, 3), 16)
      roh[o + 1] = parseInt(farbe.slice(3, 5), 16)
      roh[o + 2] = parseInt(farbe.slice(5, 7), 16)
      roh[o + 3] = 255
    }
  }
  const stueck = (typ, daten) => {
    const kopf = Buffer.alloc(4)
    kopf.writeUInt32BE(daten.length)
    const rumpf = Buffer.concat([Buffer.from(typ), daten])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(rumpf) >>> 0)
    return Buffer.concat([kopf, rumpf, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(seite, 0)
  ihdr.writeUInt32BE(seite, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), stueck('IHDR', ihdr), stueck('IDAT', zlib.deflateSync(roh, { level: 9 })), stueck('IEND', Buffer.alloc(0))])
}

fs.mkdirSync('build/icon.iconset', { recursive: true })
fs.writeFileSync('build/icon.png', png(1024))
for (const s of [16, 32, 128, 256, 512]) {
  fs.writeFileSync(`build/icon.iconset/icon_${s}x${s}.png`, png(s))
  fs.writeFileSync(`build/icon.iconset/icon_${s}x${s}@2x.png`, png(s * 2))
}
execFileSync('iconutil', ['-c', 'icns', 'build/icon.iconset', '-o', 'build/icon.icns'])
fs.rmSync('build/icon.iconset', { recursive: true })
console.log('build/icon.png, build/icon.icns')
