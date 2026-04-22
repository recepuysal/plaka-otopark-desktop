import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronApi', {
  appName: 'Plaka Otopark Desktop',
})
