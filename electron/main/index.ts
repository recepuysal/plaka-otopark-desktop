import { app, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const preloadMjs = path.join(__dirname, '../preload/index.mjs')
  const preloadJs = path.join(__dirname, '../preload/index.js')
  const preloadPath = existsSync(preloadMjs) ? preloadMjs : preloadJs
  const devIconPath = path.join(__dirname, '../../build/icon.png')
  const bundledIconPath = path.join(process.resourcesPath, 'icon.png')
  const iconPath = existsSync(devIconPath)
    ? devIconPath
    : existsSync(bundledIconPath)
      ? bundledIconPath
      : undefined

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
