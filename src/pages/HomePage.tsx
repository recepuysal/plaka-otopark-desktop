import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizePlate, storage, uid } from '../storage'
import type { AccessEvent, GateType, Resident, StaySession } from '../types'

type BarrierState = 'idle' | 'opening' | 'closing'
type CountTrend = 'steady' | 'up' | 'down'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR')
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
    () => [...events].sort((a, b) => +new Date(b.time) - +new Date(a.time)).slice(0, 10),
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
    const closingTimer = window.setTimeout(() => setBarrierState('closing'), 3800)
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), 7600)
    setBarrierTimers(closingTimer, idleTimer)
  }

  function addEvent(gate: GateType, resident: Resident | undefined, plate: string, barrierOpened: boolean, note: string) {
    const event: AccessEvent = {
      id: uid('event'),
      residentId: resident?.id ?? null,
      plate,
      residentName: resident ? `${resident.name} ${resident.surname}` : 'Kayıtsız Araç',
      gate,
      time: new Date().toISOString(),
      barrierOpened,
      note,
    }
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
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), 3000)
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
    const idleTimer = window.setTimeout(() => setBarrierState('idle'), 3000)
    setBarrierTimers(idleTimer)
    setStatusMessage('Manuel kapatma komutu gönderildi.')
  }

  function processRecognition(gate: GateType, rawPlate: string) {
    if (barrierState !== 'idle') {
      setStatusMessage('Bariyer şu anda meşgul, işlem tamamlandıktan sonra tekrar deneyin.')
      return
    }
    const plate = normalizePlate(rawPlate)
    if (!plate) {
      setStatusMessage('Lütfen geçerli bir plaka girin.')
      return
    }

    const resident = residents.find((r) => normalizePlate(r.plate) === plate)
    if (!resident) {
      addEvent(gate, undefined, plate, false, 'Kayıt bulunamadı, bariyer açılmadı')
      setStatusMessage('Plaka kayıtlı değil.')
      return
    }

    if (gate === 'entry') {
      const active = sessions.find((s) => s.residentId === resident.id && !s.exitTime)
      if (active) {
        addEvent(gate, resident, plate, false, 'Araç zaten içeride gözüküyor')
        setStatusMessage('Bu araç zaten içeride.')
        return
      }
      const nextSessions = [
        {
          id: uid('session'),
          residentId: resident.id,
          plate,
          residentName: `${resident.name} ${resident.surname}`,
          entryTime: new Date().toISOString(),
        },
        ...sessions,
      ]
      saveSessions(nextSessions)
      addEvent(gate, resident, plate, true, 'Plaka tanındı, bariyer açma sinyali gönderildi')
      triggerBarrierAnimation()
      setStatusMessage('Giriş işlemi başarılı.')
      return
    }

    const activeSessionIndex = sessions.findIndex((s) => s.residentId === resident.id && !s.exitTime)
    if (activeSessionIndex === -1) {
      addEvent(gate, resident, plate, false, 'Açık giriş kaydı bulunamadı')
      setStatusMessage('Araç için açık giriş kaydı bulunamadı.')
      return
    }

    const now = new Date()
    const nextSessions = [...sessions]
    const activeSession = nextSessions[activeSessionIndex]
    const entryMs = +new Date(activeSession.entryTime)
    const durationMinutes = Math.max(1, Math.round((+now - entryMs) / 60000))
    nextSessions[activeSessionIndex] = {
      ...activeSession,
      exitTime: now.toISOString(),
      durationMinutes,
    }
    saveSessions(nextSessions)
    addEvent(gate, resident, plate, true, `Çıkış kaydedildi, içeride kalma: ${durationMinutes} dk`)
    triggerBarrierAnimation()
    setStatusMessage('Çıkış işlemi başarılı.')
  }

  const barrierStatusText =
    barrierState === 'opening'
      ? 'Bariyer açılıyor'
      : barrierState === 'closing'
        ? 'Bariyer kapanıyor'
        : 'Bariyer hazır'

  return (
    <section>
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
      {statusMessage && <p className="status-message">{statusMessage}</p>}
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
        <section className="card">
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
