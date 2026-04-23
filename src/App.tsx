import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { RegisterPage } from './pages/RegisterPage'
import { CamerasPage } from './pages/CamerasPage'
import { APP_VERSION } from './generated/appVersion'

type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = 'app:theme-preference'

export default function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

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
    document.documentElement.dataset.theme = effectiveTheme
    document.documentElement.style.colorScheme = effectiveTheme
  }, [effectiveTheme])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Plaka Otopark</h1>
          <p>Site araç giriş-çıkış yönetimi</p>
          <small className="app-version">{APP_VERSION}</small>
        </div>
        <nav>
          <NavLink to="/" end>
            Anasayfa
          </NavLink>
          <NavLink to="/kayit">Kayıt</NavLink>
          <NavLink to="/kameralar">Kamera Ayarları</NavLink>
        </nav>
        <div className="theme-switcher">
          <label htmlFor="themePreference">Tema</label>
          <select
            id="themePreference"
            value={themePreference}
            onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
          >
            <option value="system">Sistem</option>
            <option value="light">Açık</option>
            <option value="dark">Koyu</option>
          </select>
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
