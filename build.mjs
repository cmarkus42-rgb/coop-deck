// Baut Kern, Kommandozeile und Oberfläche nach dist/. Ohne Watcher, ohne Magie.
import { build } from 'esbuild'
import fs from 'fs'
import path from 'path'

const node = { bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron'], sourcemap: true, logLevel: 'warning' }
await build({ ...node, entryPoints: ['src/shell/main.ts'], outfile: 'dist/shell/main.js' })
await build({ ...node, entryPoints: ['src/shell/preload.ts'], outfile: 'dist/shell/preload.js' })
await build({ ...node, entryPoints: ['src/shell/ansicht-preload.ts'], outfile: 'dist/shell/ansicht-preload.js' })
await build({ ...node, entryPoints: ['src/cli/coop.ts'], outfile: 'dist/cli/coop.js' })
await build({
  bundle: true, platform: 'browser', format: 'iife', target: 'chrome130', sourcemap: true, logLevel: 'warning',
  entryPoints: ['src/ui/app.tsx'], outfile: 'dist/ui/app.js', jsx: 'automatic', jsxImportSource: 'preact',
  loader: { '.css': 'css', '.woff2': 'file' }, assetNames: 'fonts/[name]',
})
fs.copyFileSync('src/ui/index.html', 'dist/ui/index.html')
console.log('gebaut:', fs.readdirSync('dist').join(', '))
