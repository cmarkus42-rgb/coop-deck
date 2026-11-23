import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('deck', {
  ruf: (name: string, ...args: unknown[]) => ipcRenderer.invoke('deck', name, ...args),
  eingabe: (sid: string, data: string) => ipcRenderer.send('eingabe', sid, data),
  groesse: (sid: string, cols: number, rows: number) => ipcRenderer.send('groesse', sid, cols, rows),
  bei: (fn: (name: string, ...args: unknown[]) => void) => {
    ipcRenderer.on('ereignis', (_e, name: string, ...args: unknown[]) => fn(name, ...args))
  },
  pfadVon: (datei: File) => webUtils.getPathForFile(datei),
})
