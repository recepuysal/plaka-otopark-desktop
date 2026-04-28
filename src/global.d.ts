interface ElectronApi {
  appName: string
  minimizeWindow: () => void
  toggleMaximizeWindow: () => void
  closeWindow: () => void
  isWindowMaximized: () => Promise<boolean>
}

declare global {
  interface Window {
    electronApi?: ElectronApi
  }
}

export {}
