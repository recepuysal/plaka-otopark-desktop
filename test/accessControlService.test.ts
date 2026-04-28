import { describe, expect, it } from 'vitest'
import { processPlateRecognition } from '../src/services/accessControlService'
import type { Resident, StaySession } from '../src/types'

const resident: Resident = {
  id: 'res-1',
  name: 'Ali',
  surname: 'Yilmaz',
  phone: '5550000000',
  plate: '34 ABC 123',
  blockNo: 'A',
  apartmentNo: '10',
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function createIdFactory() {
  let count = 0
  return (prefix: string) => `${prefix}-${++count}`
}

describe('processPlateRecognition', () => {
  it('bariyer mesgulse islemi reddeder', () => {
    const result = processPlateRecognition({
      gate: 'entry',
      rawPlate: '34ABC123',
      residents: [resident],
      sessions: [],
      barrierState: 'opening',
      createId: createIdFactory(),
    })

    expect(result.statusMessage).toBe('Bariyer şu anda meşgul, işlem tamamlandıktan sonra tekrar deneyin.')
    expect(result.event).toBeNull()
    expect(result.shouldAnimateBarrier).toBe(false)
    expect(result.nextSessions).toHaveLength(0)
  })

  it('plaka kayitli degilse bariyer acmadan event olusturur', () => {
    const result = processPlateRecognition({
      gate: 'entry',
      rawPlate: '06ZZZ06',
      residents: [resident],
      sessions: [],
      barrierState: 'idle',
      now: new Date('2026-04-22T10:00:00.000Z'),
      createId: createIdFactory(),
    })

    expect(result.statusMessage).toBe('Plaka kayıtlı değil.')
    expect(result.event?.barrierOpened).toBe(false)
    expect(result.event?.note).toContain('Kayıt bulunamadı')
    expect(result.shouldAnimateBarrier).toBe(false)
  })

  it('giris basariliysa session acar ve bariyer animasyonu ister', () => {
    const result = processPlateRecognition({
      gate: 'entry',
      rawPlate: '34abc123',
      residents: [resident],
      sessions: [],
      barrierState: 'idle',
      now: new Date('2026-04-22T10:00:00.000Z'),
      createId: createIdFactory(),
    })

    expect(result.statusMessage).toBe('Giriş işlemi başarılı.')
    expect(result.nextSessions).toHaveLength(1)
    expect(result.nextSessions[0].residentId).toBe(resident.id)
    expect(result.event?.barrierOpened).toBe(true)
    expect(result.shouldAnimateBarrier).toBe(true)
  })

  it('ayni arac ikinci kez giris yapamaz', () => {
    const openSession: StaySession = {
      id: 'session-1',
      residentId: resident.id,
      plate: '34ABC123',
      residentName: 'Ali Yilmaz',
      entryTime: '2026-04-22T08:00:00.000Z',
    }

    const result = processPlateRecognition({
      gate: 'entry',
      rawPlate: '34 ABC 123',
      residents: [resident],
      sessions: [openSession],
      barrierState: 'idle',
      createId: createIdFactory(),
    })

    expect(result.statusMessage).toBe('Bu araç zaten içeride.')
    expect(result.nextSessions).toHaveLength(1)
    expect(result.event?.barrierOpened).toBe(false)
    expect(result.shouldAnimateBarrier).toBe(false)
  })

  it('cikista acik session yoksa islemi reddeder', () => {
    const result = processPlateRecognition({
      gate: 'exit',
      rawPlate: '34ABC123',
      residents: [resident],
      sessions: [],
      barrierState: 'idle',
      createId: createIdFactory(),
    })

    expect(result.statusMessage).toBe('Araç için açık giriş kaydı bulunamadı.')
    expect(result.event?.barrierOpened).toBe(false)
    expect(result.shouldAnimateBarrier).toBe(false)
  })

  it('cikis basariliysa session kapatir ve sure hesaplar', () => {
    const openSession: StaySession = {
      id: 'session-1',
      residentId: resident.id,
      plate: '34ABC123',
      residentName: 'Ali Yilmaz',
      entryTime: '2026-04-22T08:00:00.000Z',
    }

    const result = processPlateRecognition({
      gate: 'exit',
      rawPlate: '34ABC123',
      residents: [resident],
      sessions: [openSession],
      barrierState: 'idle',
      now: new Date('2026-04-22T10:30:00.000Z'),
      createId: createIdFactory(),
    })

    expect(result.statusMessage).toBe('Çıkış işlemi başarılı.')
    expect(result.nextSessions[0].exitTime).toBe('2026-04-22T10:30:00.000Z')
    expect(result.nextSessions[0].durationMinutes).toBe(150)
    expect(result.event?.barrierOpened).toBe(true)
    expect(result.event?.note).toContain('150 dk')
    expect(result.shouldAnimateBarrier).toBe(true)
  })
})
