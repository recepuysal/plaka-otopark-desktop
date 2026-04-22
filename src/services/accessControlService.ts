import { normalizePlate, type IdFactory, uid } from '../lib/domainUtils'
import type { AccessEvent, GateType, Resident, StaySession } from '../types'

type BarrierState = 'idle' | 'opening' | 'closing'

interface CreateAccessEventInput {
  gate: GateType
  resident?: Resident
  plate: string
  barrierOpened: boolean
  note: string
  now?: Date
  createId?: IdFactory
}

interface ProcessRecognitionInput {
  gate: GateType
  rawPlate: string
  residents: Resident[]
  sessions: StaySession[]
  barrierState: BarrierState
  now?: Date
  createId?: IdFactory
}

interface ProcessRecognitionOutput {
  statusMessage: string
  nextSessions: StaySession[]
  event: AccessEvent | null
  shouldAnimateBarrier: boolean
}

export function createAccessEvent(input: CreateAccessEventInput): AccessEvent {
  const now = input.now ?? new Date()
  const createId = input.createId ?? uid
  return {
    id: createId('event'),
    residentId: input.resident?.id ?? null,
    plate: input.plate,
    residentName: input.resident ? `${input.resident.name} ${input.resident.surname}` : 'Kayıtsız Araç',
    gate: input.gate,
    time: now.toISOString(),
    barrierOpened: input.barrierOpened,
    note: input.note,
  }
}

export function processPlateRecognition(input: ProcessRecognitionInput): ProcessRecognitionOutput {
  const now = input.now ?? new Date()
  const createId = input.createId ?? uid
  const nextSessions = [...input.sessions]

  if (input.barrierState !== 'idle') {
    return {
      statusMessage: 'Bariyer şu anda meşgul, işlem tamamlandıktan sonra tekrar deneyin.',
      nextSessions,
      event: null,
      shouldAnimateBarrier: false,
    }
  }

  const plate = normalizePlate(input.rawPlate)
  if (!plate) {
    return {
      statusMessage: 'Lütfen geçerli bir plaka girin.',
      nextSessions,
      event: null,
      shouldAnimateBarrier: false,
    }
  }

  const resident = input.residents.find((item) => normalizePlate(item.plate) === plate)
  if (!resident) {
    return {
      statusMessage: 'Plaka kayıtlı değil.',
      nextSessions,
      event: createAccessEvent({
        gate: input.gate,
        plate,
        barrierOpened: false,
        note: 'Kayıt bulunamadı, bariyer açılmadı',
        now,
        createId,
      }),
      shouldAnimateBarrier: false,
    }
  }

  if (input.gate === 'entry') {
    const active = nextSessions.find((session) => session.residentId === resident.id && !session.exitTime)
    if (active) {
      return {
        statusMessage: 'Bu araç zaten içeride.',
        nextSessions,
        event: createAccessEvent({
          gate: input.gate,
          resident,
          plate,
          barrierOpened: false,
          note: 'Araç zaten içeride gözüküyor',
          now,
          createId,
        }),
        shouldAnimateBarrier: false,
      }
    }

    nextSessions.unshift({
      id: createId('session'),
      residentId: resident.id,
      plate,
      residentName: `${resident.name} ${resident.surname}`,
      entryTime: now.toISOString(),
    })

    return {
      statusMessage: 'Giriş işlemi başarılı.',
      nextSessions,
      event: createAccessEvent({
        gate: input.gate,
        resident,
        plate,
        barrierOpened: true,
        note: 'Plaka tanındı, bariyer açma sinyali gönderildi',
        now,
        createId,
      }),
      shouldAnimateBarrier: true,
    }
  }

  const activeSessionIndex = nextSessions.findIndex((session) => session.residentId === resident.id && !session.exitTime)
  if (activeSessionIndex === -1) {
    return {
      statusMessage: 'Araç için açık giriş kaydı bulunamadı.',
      nextSessions,
      event: createAccessEvent({
        gate: input.gate,
        resident,
        plate,
        barrierOpened: false,
        note: 'Açık giriş kaydı bulunamadı',
        now,
        createId,
      }),
      shouldAnimateBarrier: false,
    }
  }

  const activeSession = nextSessions[activeSessionIndex]
  const entryMs = +new Date(activeSession.entryTime)
  const durationMinutes = Math.max(1, Math.round((+now - entryMs) / 60000))
  nextSessions[activeSessionIndex] = {
    ...activeSession,
    exitTime: now.toISOString(),
    durationMinutes,
  }

  return {
    statusMessage: 'Çıkış işlemi başarılı.',
    nextSessions,
    event: createAccessEvent({
      gate: input.gate,
      resident,
      plate,
      barrierOpened: true,
      note: `Çıkış kaydedildi, içeride kalma: ${durationMinutes} dk`,
      now,
      createId,
    }),
    shouldAnimateBarrier: true,
  }
}
