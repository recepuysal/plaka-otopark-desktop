import { FormEvent, useState } from 'react'
import { storage } from '../storage'
import type { BarrierSettings, CameraConfig, CameraType, GateType, GeneralSettings } from '../types'

const THEME_KEY = 'app:theme-preference'
const THEME_CHANGE_EVENT = 'app:theme-preference-changed'

const cameraTypes: CameraType[] = [
  'USB',
  'IP RTSP',
  'IP MJPEG',
  'IP Snapshot',
  'ONVIF',
  'WebRTC',
  'DVR/NVR Channel',
]

const defaultConfig: CameraConfig = {
  gate: 'entry',
  type: 'IP RTSP',
  name: '',
  url: '',
  username: '',
  password: '',
}

type SettingsTab = 'camera' | 'barrier' | 'general'

export function CamerasPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('camera')
  const [cameras, setCameras] = useState<CameraConfig[]>(storage.getCameras())
  const [form, setForm] = useState<CameraConfig>(defaultConfig)
  const [cameraMessage, setCameraMessage] = useState('')
  const [barrierMessage, setBarrierMessage] = useState('')
  const [generalMessage, setGeneralMessage] = useState('')
  const [barrierSettings, setBarrierSettings] = useState<BarrierSettings>(storage.getBarrierSettings())
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(() => {
    const saved = storage.getGeneralSettings()
    return {
      ...saved,
      themePreference: saved.themePreference ?? 'system',
    }
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const record: CameraConfig = {
      ...form,
      name: form.name.trim(),
      url: form.url.trim(),
      username: form.username.trim(),
      password: form.password.trim(),
    }
    if (record.name.length < 3) {
      setCameraMessage('Kamera adı en az 3 karakter olmalıdır.')
      return
    }
    if (!record.url) {
      setCameraMessage('Bağlantı bilgisi zorunludur.')
      return
    }
    const duplicate = cameras.some(
      (camera) =>
        camera.gate === record.gate &&
        camera.type === record.type &&
        camera.url.toLowerCase() === record.url.toLowerCase(),
    )
    if (duplicate) {
      setCameraMessage('Aynı kamera bağlantısı zaten kayıtlı.')
      return
    }
    const next = [...cameras, record]
    setCameras(next)
    storage.setCameras(next)
    setForm(defaultConfig)
    setCameraMessage('Kamera ayarı kaydedildi.')
  }

  function removeAt(index: number) {
    const next = cameras.filter((_, i) => i !== index)
    setCameras(next)
    storage.setCameras(next)
  }

  function onBarrierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (barrierSettings.openingToClosingMs < 500) {
      setBarrierMessage('Acilma-kapanma suresi en az 500 ms olmalidir.')
      return
    }
    if (barrierSettings.resetToIdleMs <= barrierSettings.openingToClosingMs) {
      setBarrierMessage('Hazir duruma donus suresi, acilma-kapanmadan buyuk olmalidir.')
      return
    }
    storage.setBarrierSettings(barrierSettings)
    setBarrierMessage('Bariyer ayarlari kaydedildi.')
  }

  function onGeneralSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized: GeneralSettings = {
      ...generalSettings,
      siteName: generalSettings.siteName.trim(),
      platePattern: generalSettings.platePattern.trim(),
    }
    if (normalized.siteName.length < 2) {
      setGeneralMessage('Site adi en az 2 karakter olmalidir.')
      return
    }
    if (normalized.autoRefreshSeconds < 1) {
      setGeneralMessage('Yenileme suresi en az 1 saniye olmalidir.')
      return
    }
    setGeneralSettings(normalized)
    storage.setGeneralSettings(normalized)
    localStorage.setItem(THEME_KEY, normalized.themePreference)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
    setGeneralMessage('Genel ayarlar kaydedildi.')
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h2>Ayarlar</h2>
          <p>Kamera, bariyer ve genel sistem ayarlarini tek ekrandan yonetin</p>
        </div>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Ayar Kategorileri">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'camera'}
          className={`settings-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveTab('camera')}
        >
          Kamera Ayarlari
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'barrier'}
          className={`settings-tab-btn ${activeTab === 'barrier' ? 'active' : ''}`}
          onClick={() => setActiveTab('barrier')}
        >
          Bariyer Ayarlari
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          className={`settings-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          Genel Ayarlar
        </button>
      </div>

      {activeTab === 'camera' && (
        <div className="two-col">
          <form className="card form-grid" onSubmit={onSubmit}>
            <h3>Yeni Kamera Baglantisi</h3>
            <label>
              Kapi Yonu
              <select
                value={form.gate}
                onChange={(event) => setForm((prev) => ({ ...prev, gate: event.target.value as GateType }))}
              >
                <option value="entry">Giris</option>
                <option value="exit">Cikis</option>
              </select>
            </label>

            <label>
              Kamera Turu
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as CameraType }))}
              >
                {cameraTypes.map((cameraType) => (
                  <option key={cameraType} value={cameraType}>
                    {cameraType}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Kamera Adi
              <input
                placeholder="Orn: Giris Kuzey Kamera"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Baglanti URL / Kanal
              <input
                placeholder="rtsp://... veya kanal bilgisi"
                value={form.url}
                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                required
              />
            </label>
            <label>
              Kullanici Adi
              <input
                placeholder="Opsiyonel"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            </label>
            <label>
              Sifre
              <input
                placeholder="Opsiyonel"
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </label>
            <button type="submit">Kamera Kaydet</button>
            <p className="message message-slot">{cameraMessage || '\u00A0'}</p>
          </form>

          <section className="card">
            <h3>Kayitli Kameralar ({cameras.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Yon</th>
                  <th>Tur</th>
                  <th>Ad</th>
                  <th>URL / Kanal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((camera, index) => (
                  <tr key={`${camera.name}-${index}`}>
                    <td>{camera.gate === 'entry' ? 'Giris' : 'Cikis'}</td>
                    <td>{camera.type}</td>
                    <td>{camera.name}</td>
                    <td>{camera.url}</td>
                    <td>
                      <button type="button" onClick={() => removeAt(index)} className="danger-btn">
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {cameras.length === 0 && (
                  <tr>
                    <td colSpan={5}>Kamera ayari yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === 'barrier' && (
        <form className="card form-grid settings-single-col" onSubmit={onBarrierSubmit}>
          <h3>Bariyer Ayarlari</h3>
          <p className="settings-help">Bariyer animasyon ve durum gecis surelerini ms cinsinden ayarlayin.</p>
          <label>
            Acilma - Kapanma (ms)
            <input
              type="number"
              min={500}
              step={100}
              value={barrierSettings.openingToClosingMs}
              onChange={(event) =>
                setBarrierSettings((prev) => ({ ...prev, openingToClosingMs: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <label>
            Hazir Duruma Donus (ms)
            <input
              type="number"
              min={1000}
              step={100}
              value={barrierSettings.resetToIdleMs}
              onChange={(event) =>
                setBarrierSettings((prev) => ({ ...prev, resetToIdleMs: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <label>
            Manuel Islem Sonrasi Donus (ms)
            <input
              type="number"
              min={500}
              step={100}
              value={barrierSettings.manualResetToIdleMs}
              onChange={(event) =>
                setBarrierSettings((prev) => ({ ...prev, manualResetToIdleMs: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <button type="submit">Bariyer Ayarlarini Kaydet</button>
          <p className="message message-slot">{barrierMessage || '\u00A0'}</p>
        </form>
      )}

      {activeTab === 'general' && (
        <form className="card form-grid settings-single-col" onSubmit={onGeneralSubmit}>
          <h3>Genel Ayarlar</h3>
          <p className="settings-help">Sistem genelinde kullanilan temel uygulama ayarlarini yonetin.</p>
          <label>
            Site/Uygulama Adi
            <input
              value={generalSettings.siteName}
              onChange={(event) => setGeneralSettings((prev) => ({ ...prev, siteName: event.target.value }))}
            />
          </label>
          <label>
            Plaka Formati
            <input
              placeholder="TR-STANDART"
              value={generalSettings.platePattern}
              onChange={(event) => setGeneralSettings((prev) => ({ ...prev, platePattern: event.target.value }))}
            />
          </label>
          <label>
            Otomatik Yenileme (saniye)
            <input
              type="number"
              min={1}
              step={1}
              value={generalSettings.autoRefreshSeconds}
              onChange={(event) =>
                setGeneralSettings((prev) => ({ ...prev, autoRefreshSeconds: Number(event.target.value) || 0 }))
              }
            />
          </label>
          <label>
            Tema
            <select
              value={generalSettings.themePreference}
              onChange={(event) =>
                setGeneralSettings((prev) => ({
                  ...prev,
                  themePreference: event.target.value as GeneralSettings['themePreference'],
                }))
              }
            >
              <option value="system">Sistem</option>
              <option value="light">Acik</option>
              <option value="dark">Koyu</option>
            </select>
          </label>
          <button type="submit">Genel Ayarlari Kaydet</button>
          <p className="message message-slot">{generalMessage || '\u00A0'}</p>
        </form>
      )}
    </section>
  )
}
