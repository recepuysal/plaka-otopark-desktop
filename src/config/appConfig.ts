import type { BarrierSettings, CameraConfig, GeneralSettings } from '../types'

export const APP_CONFIG = {
  ui: {
    dateLocale: 'tr-TR',
    recentEventsLimit: 10,
  },
  barrier: {
    openingToClosingMs: 3800,
    resetToIdleMs: 7600,
    manualResetToIdleMs: 3000,
  } as BarrierSettings,
  defaults: {
    cameras: [
      { gate: 'entry', type: 'IP RTSP', name: 'Giris Kamera 1', url: '', username: '', password: '' },
      { gate: 'exit', type: 'IP RTSP', name: 'Cikis Kamera 1', url: '', username: '', password: '' },
    ] as CameraConfig[],
    general: {
      siteName: 'Plaka Otopark',
      platePattern: 'TR-STANDART',
      autoRefreshSeconds: 2,
      themePreference: 'system',
    } as GeneralSettings,
  },
}
