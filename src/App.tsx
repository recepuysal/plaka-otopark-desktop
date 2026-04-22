import { NavLink, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { RegisterPage } from './pages/RegisterPage'
import { CamerasPage } from './pages/CamerasPage'
import { APP_VERSION } from './generated/appVersion'

export default function App() {
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
