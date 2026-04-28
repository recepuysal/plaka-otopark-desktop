import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { RegisterPage } from './pages/RegisterPage'
import { CamerasPage } from './pages/CamerasPage'
import { APP_VERSION } from './generated/appVersion'

type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = 'app:theme-preference'
const THEME_CHANGE_EVENT = 'app:theme-preference-changed'

export default function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [isWindowMaximized, setIsWindowMaximized] = useState(false)

  const effectiveTheme = useMemo(
    () => (themePreference === 'system' ? systemTheme : themePreference),
    [themePreference, systemTheme],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    }
    media.onchange = handler
    return () => {
      media.onchange = null
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themePreference)
  }, [themePreference])

  useEffect(() => {
    const refreshThemePreference = () => {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemePreference(saved)
      }
    }
    window.addEventListener(THEME_CHANGE_EVENT, refreshThemePreference)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, refreshThemePreference)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme
    document.documentElement.style.colorScheme = effectiveTheme
  }, [effectiveTheme])

  useEffect(() => {
    let disposed = false
    const updateWindowState = async () => {
      if (!window.electronApi?.isWindowMaximized) return
      const maximized = await window.electronApi.isWindowMaximized()
      if (!disposed) {
        setIsWindowMaximized(maximized)
      }
    }
    updateWindowState()
    window.addEventListener('resize', updateWindowState)
    return () => {
      disposed = true
      window.removeEventListener('resize', updateWindowState)
    }
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <h1>Plaka Otopark</h1>
          <p>Site araç giriş-çıkış yönetimi</p>
          <small className="app-version">{APP_VERSION}</small>
        </div>
        <nav className="topbar-nav">
          <NavLink to="/" end>
            Anasayfa
          </NavLink>
          <NavLink to="/kayit">Kayıt</NavLink>
          <NavLink to="/kameralar">Ayarlar</NavLink>
        </nav>
        <div className="window-controls">
          <button
            type="button"
            className="window-control-btn"
            onClick={() => window.electronApi?.minimizeWindow?.()}
            aria-label="Pencereyi küçült"
            title="Küçült"
          >
            -
          </button>
          <button
            type="button"
            className="window-control-btn"
            onClick={() => window.electronApi?.toggleMaximizeWindow?.()}
            aria-label={isWindowMaximized ? 'Pencereyi geri yükle' : 'Pencereyi büyüt'}
            title={isWindowMaximized ? 'Geri Yükle' : 'Büyüt'}
          >
            {isWindowMaximized ? '❐' : '□'}
          </button>
          <button
            type="button"
            className="window-control-btn close-btn"
            onClick={() => window.electronApi?.closeWindow?.()}
            aria-label="Pencereyi kapat"
            title="Kapat"
          >
            ×
          </button>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/kayit" element={<RegisterPage />} />
          <Route path="/kameralar" element={<CamerasPage />} />
        </Routes>
      </main>
    </div>
  )
}
