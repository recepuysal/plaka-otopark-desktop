import { useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../storage'
import type { AccessEvent, CameraConfig, GateType, Resident, ServiceVehicleRecord, StaySession } from '../types'
import { APP_CONFIG } from '../config/appConfig'
import { completeServiceVehicleExitByPlate, createAccessEvent, createServiceVehicleEntry, processPlateRecognition } from '../services/accessControlService'
import { uid } from '../lib/domainUtils'

type BarrierState = 'idle' | 'opening' | 'closing'
type CountTrend = 'steady' | 'up' | 'down'

const quickServiceFormInitial = {
  plate: '',
  name: '',
  surname: '',
  company: '',
  visitedPerson: '',
  vehicleColor: '',
  vehicleBrand: '',
  vehicleModel: '',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(APP_CONFIG.ui.dateLocale)
}

function withCredentials(url: string, username: string, password: string) {
  if (!username || !password) return url
  if (!/^https?:\/\//i.test(url) || /@/.test(url)) return url
  return url.replace(/^https?:\/\//i, (prefix) => `${prefix}${encodeURIComponent(username)}:${encodeURIComponent(password)}@`)
}

function buildEntryPreviewUrl(camera: CameraConfig | undefined, snapshotTick: number) {
  if (!camera) return ''
  const sourceUrl = withCredentials(camera.url, camera.username, camera.password)
  if (camera.type === 'IP Snapshot') {
    const separator = sourceUrl.includes('?') ? '&' : '?'
    return `${sourceUrl}${separator}t=${snapshotTick}`
  }
  return sourceUrl
}

export function HomePage() {
  const [events, setEvents] = useState<AccessEvent[]>(storage.getEvents())
  const [sessions, setSessions] = useState<StaySession[]>(storage.getSessions())
  const [cameras, setCameras] = useState<CameraConfig[]>(storage.getCameras())
  const [serviceVehicles, setServiceVehicles] = useState<ServiceVehicleRecord[]>(storage.getServiceVehicles())
  const [entryPlate, setEntryPlate] = useState('')
  const [exitPlate, setExitPlate] = useState('')
  const [snapshotTick, setSnapshotTick] = useState(Date.now())
  const [previewError, setPreviewError] = useState('')
  const [showQuickServiceForm, setShowQuickServiceForm] = useState(false)
  const [quickServiceForm, setQuickServiceForm] = useState(quickServiceFormInitial)
  const [quickServiceMessage, setQuickServiceMessage] = useState('')
  const [barrierState, setBarrierState] = useState<BarrierState>('idle')
  const [countTrend, setCountTrend] = useState<CountTrend>('steady')
  const [statusMessage, setStatusMessage] = useState('')
  const prevInsideCountRef = useRef(0)
  const barrierTimersRef = useRef<number[]>([])
  const residents = storage.getResidents()
  const barrierSettings = storage.getBarrierSettings()

  const insideCount = useMemo(
    () => sessions.filter((session) => !session.exitTime).length,
    [sessions],
  )

  const recentEvents = useMemo(
    () => [...events].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, APP_CONFIG.ui.recentEventsLimit),
    [events],
  )
  const activeServiceVehicles = useMemo(
    () => serviceVehicles.filter((record) => record.status === 'active'),
    [serviceVehicles],
  )
  const recentEventRows = useMemo(
    () => Array.from({ length: APP_CONFIG.ui.recentEventsLimit }, (_, index) => recentEvents[index] ?? null),
    [recentEvents],
  )

  useEffect(() => {
    const prev = prevInsideCountRef.current
    if (insideCount > prev) {
      setCountTrend('up')
    } else if (insideCount < prev) {
      setCountTrend('down')
    } else {
      return
    }
    const timer = window.setTimeout(() => setCountTrend('steady'), 1200)
    prevInsideCountRef.current = insideCount
    return () => window.clearTimeout(timer)
  }, [insideCount])

  useEffect(() => {
    return () => {
      barrierTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCameras(storage.getCameras())
      setServiceVehicles(storage.getServiceVehicles())
    }, 2000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSnapshotTick(Date.now())
    }, 2000)
    return () => window.clearInterval(interval)
  }, [])

  function setBarrierTimers(...timers: number[]) {
    barrierTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    barrierTimersRef.current = timers
  }

  function triggerBarrierAnimation() {
    setBarrierState('opening')
    // Daha gerçekçi akış: açılma ve kapanma daha yavaş ilerler.
    const closingTimer = window.setTimeout(() => setBarrierState('closing'), barrierSettings.openingToClosingMs)
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), barrierSettings.resetToIdleMs)
    setBarrierTimers(closingTimer, idleTimer)
  }

  function addEvent(gate: GateType, resident: Resident | undefined, plate: string, barrierOpened: boolean, note: string) {
    const event = createAccessEvent({ gate, resident, plate, barrierOpened, note, createId: uid })
    setEvents((prev) => {
      const next = [event, ...prev]
      storage.setEvents(next)
      return next
    })
  }

  function saveSessions(nextSessions: StaySession[]) {
    setSessions(nextSessions)
    storage.setSessions(nextSessions)
  }

  function triggerManualOpen() {
    if (barrierState !== 'idle') {
      setStatusMessage('Bariyer işlemi devam ediyor, lütfen bekleyin.')
      return
    }
    setBarrierState('opening')
    addEvent('entry', undefined, '-', true, 'Bariyer manuel olarak açıldı')
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), barrierSettings.manualResetToIdleMs)
    setBarrierTimers(idleTimer)
    setStatusMessage('Manuel açma komutu gönderildi.')
  }

  function triggerManualClose() {
    if (barrierState !== 'idle') {
      setStatusMessage('Bariyer işlemi devam ediyor, lütfen bekleyin.')
      return
    }
    setBarrierState('closing')
    addEvent('exit', undefined, '-', true, 'Bariyer manuel olarak kapatıldı')
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), barrierSettings.manualResetToIdleMs)
    setBarrierTimers(idleTimer)
    setStatusMessage('Manuel kapatma komutu gönderildi.')
  }

  function processRecognition(gate: GateType, rawPlate: string) {
    const result = processPlateRecognition({
      gate,
      rawPlate,
      residents,
      sessions,
      barrierState,
      createId: uid,
    })
    saveSessions(result.nextSessions)
    const latestEvent = result.event
    if (latestEvent) {
      setEvents((prev) => {
        const next = [latestEvent, ...prev]
        storage.setEvents(next)
        return next
      })
    }
    if (result.shouldAnimateBarrier) {
      triggerBarrierAnimation()
    }
    if (gate === 'exit') {
      const serviceExit = completeServiceVehicleExitByPlate({
        records: serviceVehicles,
        plate: rawPlate,
      })
      if (serviceExit.ok) {
        setServiceVehicles(serviceExit.nextRecords)
        storage.setServiceVehicles(serviceExit.nextRecords)
        setStatusMessage(serviceExit.message)
        addEvent('exit', undefined, serviceExit.updatedRecord?.plate ?? rawPlate, true, 'Hizmet araci cikisi tamamlandi')
        if (!result.shouldAnimateBarrier) {
          triggerBarrierAnimation()
        }
        return
      }
    }
    setStatusMessage(result.statusMessage)
  }

  function submitQuickServiceEntry() {
    const next = createServiceVehicleEntry({
      records: serviceVehicles,
      ...quickServiceForm,
      createId: uid,
    })
    setQuickServiceMessage(next.message)
    if (!next.ok) {
      return
    }
    setServiceVehicles(next.nextRecords)
    storage.setServiceVehicles(next.nextRecords)
    setQuickServiceForm(quickServiceFormInitial)
    setShowQuickServiceForm(false)
    setStatusMessage(next.message)
    addEvent('entry', undefined, next.createdRecord?.plate ?? quickServiceForm.plate, true, 'Hizmet araci hizli kayit ile giris yapti')
    if (barrierState === 'idle') {
      triggerBarrierAnimation()
    }
  }

  const barrierStatusText =
    barrierState === 'opening'
      ? 'Bariyer açılıyor'
      : barrierState === 'closing'
        ? 'Bariyer kapanıyor'
        : 'Bariyer hazır'
  const entryCamera = useMemo(
    () => cameras.find((camera) => camera.gate === 'entry'),
    [cameras],
  )
  const canRenderEntryPreview = entryCamera?.type === 'IP MJPEG' || entryCamera?.type === 'IP Snapshot'
  const entryPreviewUrl = useMemo(
    () => buildEntryPreviewUrl(entryCamera, snapshotTick),
    [entryCamera, snapshotTick],
  )

  return (
    <section className="page-stack home-page-stack">
      <div className="card home-control-card">
        <div className="barrier-panel barrier-panel-top">
          <span className={`led led-center ${barrierState === 'opening' ? 'opening' : ''} ${barrierState === 'closing' ? 'closing' : ''}`}>
            LED
          </span>
          <strong>{barrierStatusText}</strong>
        </div>
        <div className="manual-controls">
          <button className="manual-open-btn" onClick={triggerManualOpen} disabled={barrierState !== 'idle'}>
            Bariyeri Manuel Aç
          </button>
          <button className="manual-close-btn" onClick={triggerManualClose} disabled={barrierState !== 'idle'}>
            Bariyeri Manuel Kapat
          </button>
        </div>
        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      </div>
      <header className="page-header home-page-header">
        <div>
          <h2>Anasayfa</h2>
          <p>Solda son 10 giriş-çıkış, ortada giriş/çıkış kamera paneli</p>
        </div>
        <div className="stats">
          <div className="inside-count-card">
            <span className="inside-count-label">İçerideki Araç</span>
            <span className={`inside-count-value ${countTrend}`}>
              {insideCount}
            </span>
          </div>
        </div>
      </header>

      <div className="home-grid home-grid-balanced">
        <div className="home-left-stack">
          <section className="card quick-service-card">
            <h3>Hızlı Hizmet Kaydı</h3>
            <p>Hizmet veya misafir aracını hızlıca kaydedip giriş takibini başlatın.</p>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setShowQuickServiceForm((prev) => !prev)
                setQuickServiceMessage('')
              }}
            >
              {showQuickServiceForm ? 'Formu Gizle' : 'Hızlı Hizmet Kaydı Aç'}
            </button>
            <p className="message message-slot">{quickServiceMessage || '\u00A0'}</p>
            <div className="service-active-list">
              <strong>Aktif Hizmet Aracı ({activeServiceVehicles.length})</strong>
              {activeServiceVehicles.slice(0, 3).map((record) => (
                <div key={record.id} className="service-active-item">
                  <span>{record.plate}</span>
                  <span>{record.name} {record.surname}</span>
                </div>
              ))}
              {activeServiceVehicles.length === 0 && <p className="camera-preview-message">Aktif hizmet aracı yok.</p>}
            </div>
          </section>

          <section className="card data-card">
            <h3>Son 10 Hareket</h3>
            <table>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Plaka</th>
                  <th>Yön</th>
                  <th>Saat</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {recentEventRows.map((event, index) => (
                  <tr key={event ? event.id : `empty-row-${index}`}>
                    <td>{event?.residentName ?? '-'}</td>
                    <td>{event?.plate ?? '-'}</td>
                    <td>{event ? (event.gate === 'entry' ? 'Giriş' : 'Çıkış') : '-'}</td>
                    <td>{event?.time ? formatDate(event.time) : '-'}</td>
                    <td>{event?.note ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section className="card camera-stack camera-stack-balanced">
          <div className="camera-box">
            <h3>Giriş Kamera</h3>
            <p>Plaka okutulduğunda giriş saati kaydedilir.</p>
            <div className="camera-preview">
              {!entryCamera && <p className="camera-preview-message">Önizleme için giriş kamerası eklenmedi.</p>}
              {entryCamera && !canRenderEntryPreview && (
                <p className="camera-preview-message">
                  Bu kamera türü ({entryCamera.type}) doğrudan önizlemeyi desteklemiyor. `IP MJPEG` veya `IP Snapshot`
                  kullanın.
                </p>
              )}
              {entryCamera && canRenderEntryPreview && (
                <>
                  <img
                    className="camera-preview-image"
                    src={entryPreviewUrl}
                    alt={`${entryCamera.name} canlı önizleme`}
                    onLoad={() => setPreviewError('')}
                    onError={() => setPreviewError('Kamera görüntüsü alınamadı. URL veya yetki bilgisini kontrol edin.')}
                  />
                  {previewError && <p className="camera-preview-message">{previewError}</p>}
                </>
              )}
            </div>
            <input
              placeholder="Örnek: 34ABC123"
              value={entryPlate}
              onChange={(event) => setEntryPlate(event.target.value)}
            />
            <button onClick={() => processRecognition('entry', entryPlate)}>
              Giriş Plaka Tanıma Simülasyonu
            </button>
          </div>
          <div className="camera-box">
            <h3>Çıkış Kamera</h3>
            <p>Plaka okutulduğunda çıkış ve içeride kalma süresi hesaplanır.</p>
            <input
              placeholder="Örnek: 34ABC123"
              value={exitPlate}
              onChange={(event) => setExitPlate(event.target.value)}
            />
            <button onClick={() => processRecognition('exit', exitPlate)}>
              Çıkış Plaka Tanıma Simülasyonu
            </button>
          </div>
        </section>
      </div>
      {showQuickServiceForm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Hızlı hizmet kaydı">
          <div className="confirm-modal service-quick-modal form-grid">
            <div className="modal-header-row">
              <h4>Hızlı Hizmet Kaydı</h4>
              <button
                type="button"
                className="row-menu-trigger"
                onClick={() => setShowQuickServiceForm(false)}
                aria-label="Hızlı hizmet kaydı kapat"
              >
                ×
              </button>
            </div>
            <label>
              Plaka
              <input
                placeholder="34 ABC 123"
                value={quickServiceForm.plate}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, plate: event.target.value }))}
              />
            </label>
            <label>
              Ad
              <input
                value={quickServiceForm.name}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Soyad
              <input
                value={quickServiceForm.surname}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, surname: event.target.value }))}
              />
            </label>
            <label>
              Firma
              <input
                value={quickServiceForm.company}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, company: event.target.value }))}
              />
            </label>
            <label>
              Kime Geldiği (Opsiyonel)
              <input
                placeholder="Daire sakini / kisi adi"
                value={quickServiceForm.visitedPerson}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, visitedPerson: event.target.value }))}
              />
            </label>
            <label>
              Araç Renk
              <input
                value={quickServiceForm.vehicleColor}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, vehicleColor: event.target.value }))}
              />
            </label>
            <label>
              Marka
              <input
                value={quickServiceForm.vehicleBrand}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, vehicleBrand: event.target.value }))}
              />
            </label>
            <label>
              Model
              <input
                value={quickServiceForm.vehicleModel}
                onChange={(event) => setQuickServiceForm((prev) => ({ ...prev, vehicleModel: event.target.value }))}
              />
            </label>
            <div className="confirm-actions">
              <button type="button" className="ghost-btn" onClick={() => setShowQuickServiceForm(false)}>
                Vazgeç
              </button>
              <button type="button" onClick={submitQuickServiceEntry}>
                Hızlı Giriş Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
