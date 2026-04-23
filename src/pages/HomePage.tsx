import { useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../storage'
import type { AccessEvent, GateType, Resident, StaySession } from '../types'
import { APP_CONFIG } from '../config/appConfig'
import { createAccessEvent, processPlateRecognition } from '../services/accessControlService'
import { uid } from '../lib/domainUtils'

type BarrierState = 'idle' | 'opening' | 'closing'
type CountTrend = 'steady' | 'up' | 'down'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(APP_CONFIG.ui.dateLocale)
}

export function HomePage() {
  const [events, setEvents] = useState<AccessEvent[]>(storage.getEvents())
  const [sessions, setSessions] = useState<StaySession[]>(storage.getSessions())
  const [entryPlate, setEntryPlate] = useState('')
  const [exitPlate, setExitPlate] = useState('')
  const [barrierState, setBarrierState] = useState<BarrierState>('idle')
  const [countTrend, setCountTrend] = useState<CountTrend>('steady')
  const [statusMessage, setStatusMessage] = useState('')
  const prevInsideCountRef = useRef(0)
  const barrierTimersRef = useRef<number[]>([])
  const residents = storage.getResidents()

  const insideCount = useMemo(
    () => sessions.filter((session) => !session.exitTime).length,
    [sessions],
  )

  const recentEvents = useMemo(
    () => [...events].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, APP_CONFIG.ui.recentEventsLimit),
    [events],
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

  function setBarrierTimers(...timers: number[]) {
    barrierTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    barrierTimersRef.current = timers
  }

  function triggerBarrierAnimation() {
    setBarrierState('opening')
    // Daha gerçekçi akış: açılma ve kapanma daha yavaş ilerler.
    const closingTimer = window.setTimeout(() => setBarrierState('closing'), APP_CONFIG.barrier.openingToClosingMs)
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), APP_CONFIG.barrier.resetToIdleMs)
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
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), APP_CONFIG.barrier.manualResetToIdleMs)
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
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), APP_CONFIG.barrier.manualResetToIdleMs)
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
    setStatusMessage(result.statusMessage)
  }

  const barrierStatusText =
    barrierState === 'opening'
      ? 'Bariyer açılıyor'
      : barrierState === 'closing'
        ? 'Bariyer kapanıyor'
        : 'Bariyer hazır'

  return (
    <section className="page-stack">
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
      <p className="status-message status-message-slot">{statusMessage || '\u00A0'}</p>
      <header className="page-header">
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

      <div className="home-grid">
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
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.residentName}</td>
                  <td>{event.plate}</td>
                  <td>{event.gate === 'entry' ? 'Giriş' : 'Çıkış'}</td>
                  <td>{formatDate(event.time)}</td>
                  <td>{event.note}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr>
                  <td colSpan={5}>Henüz hareket kaydı yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card camera-stack">
          <div className="camera-box">
            <h3>Giriş Kamera</h3>
            <p>Plaka okutulduğunda giriş saati kaydedilir.</p>
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
    </section>
  )
}
