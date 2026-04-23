import { FormEvent, useState } from 'react'
import { storage } from '../storage'
import type { CameraConfig, CameraType, GateType } from '../types'

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

export function CamerasPage() {
  const [cameras, setCameras] = useState<CameraConfig[]>(storage.getCameras())
  const [form, setForm] = useState<CameraConfig>(defaultConfig)
  const [message, setMessage] = useState('')

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
      setMessage('Kamera adı en az 3 karakter olmalıdır.')
      return
    }
    if (!record.url) {
      setMessage('Bağlantı bilgisi zorunludur.')
      return
    }
    const duplicate = cameras.some(
      (camera) =>
        camera.gate === record.gate &&
        camera.type === record.type &&
        camera.url.toLowerCase() === record.url.toLowerCase(),
    )
    if (duplicate) {
      setMessage('Aynı kamera bağlantısı zaten kayıtlı.')
      return
    }
    const next = [...cameras, record]
    setCameras(next)
    storage.setCameras(next)
    setForm(defaultConfig)
    setMessage('Kamera ayarı kaydedildi.')
  }

  function removeAt(index: number) {
    const next = cameras.filter((_, i) => i !== index)
    setCameras(next)
    storage.setCameras(next)
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h2>Kamera Ayarları</h2>
          <p>Giriş ve çıkış için farklı kamera tipleri seçilebilir ve saklanır</p>
        </div>
      </header>

      <div className="two-col">
        <form className="card form-grid" onSubmit={onSubmit}>
          <h3>Yeni Kamera Bağlantısı</h3>
          <label>
            Kapı Yönü
            <select
              value={form.gate}
              onChange={(event) => setForm((prev) => ({ ...prev, gate: event.target.value as GateType }))}
            >
              <option value="entry">Giriş</option>
              <option value="exit">Çıkış</option>
            </select>
          </label>

          <label>
            Kamera Türü
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
            Kamera Adı
            <input
              placeholder="Örn: Giriş Kuzey Kamera"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Bağlantı URL / Kanal
            <input
              placeholder="rtsp://... veya kanal bilgisi"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              required
            />
          </label>
          <label>
            Kullanıcı Adı
            <input
              placeholder="Opsiyonel"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            />
          </label>
          <label>
            Şifre
            <input
              placeholder="Opsiyonel"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <button type="submit">Kamera Kaydet</button>
          <p className="message message-slot">{message || '\u00A0'}</p>
        </form>

        <section className="card">
          <h3>Kayıtlı Kameralar ({cameras.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Yön</th>
                <th>Tür</th>
                <th>Ad</th>
                <th>URL / Kanal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((camera, index) => (
                <tr key={`${camera.name}-${index}`}>
                  <td>{camera.gate === 'entry' ? 'Giriş' : 'Çıkış'}</td>
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
                  <td colSpan={5}>Kamera ayarı yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  )
}
