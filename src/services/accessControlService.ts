import { normalizePlate, type IdFactory, uid } from '../lib/domainUtils'
import type { AccessEvent, GateType, Resident, ServiceVehicleRecord, StaySession } from '../types'

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

interface CreateServiceVehicleInput {
  records: ServiceVehicleRecord[]
  plate: string
  name: string
  surname: string
  company: string
  visitedPerson?: string
  vehicleColor: string
  vehicleBrand: string
  vehicleModel: string
  now?: Date
  createId?: IdFactory
}

interface CreateServiceVehicleOutput {
  ok: boolean
  message: string
  nextRecords: ServiceVehicleRecord[]
  createdRecord?: ServiceVehicleRecord
}

interface CompleteServiceVehicleExitInput {
  records: ServiceVehicleRecord[]
  plate: string
  now?: Date
}

interface CompleteServiceVehicleExitOutput {
  ok: boolean
  message: string
  nextRecords: ServiceVehicleRecord[]
  updatedRecord?: ServiceVehicleRecord
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

export function createServiceVehicleEntry(input: CreateServiceVehicleInput): CreateServiceVehicleOutput {
  const now = input.now ?? new Date()
  const createId = input.createId ?? uid
  const plate = normalizePlate(input.plate)
  if (!plate) {
    return {
      ok: false,
      message: 'Geçerli bir plaka girin.',
      nextRecords: input.records,
    }
  }

  const name = input.name.trim()
  const surname = input.surname.trim()
  const company = input.company.trim()
  const visitedPerson = input.visitedPerson?.trim() || ''
  const vehicleColor = input.vehicleColor.trim()
  const vehicleBrand = input.vehicleBrand.trim()
  const vehicleModel = input.vehicleModel.trim()
  if (!name || !surname || !company || !vehicleColor || !vehicleBrand || !vehicleModel) {
    return {
      ok: false,
      message: 'Tüm alanlar zorunludur.',
      nextRecords: input.records,
    }
  }

  const activeDuplicate = input.records.some((record) => normalizePlate(record.plate) === plate && record.status === 'active')
  if (activeDuplicate) {
    return {
      ok: false,
      message: 'Bu plaka için zaten aktif hizmet aracı kaydı var.',
      nextRecords: input.records,
    }
  }

  const createdRecord: ServiceVehicleRecord = {
    id: createId('service'),
    plate,
    name,
    surname,
    company,
    visitedPerson,
    vehicleColor,
    vehicleBrand,
    vehicleModel,
    entryTime: now.toISOString(),
    status: 'active',
  }
  return {
    ok: true,
    message: 'Hizmet aracı girişi kaydedildi.',
    nextRecords: [createdRecord, ...input.records],
    createdRecord,
  }
}

export function completeServiceVehicleExitByPlate(input: CompleteServiceVehicleExitInput): CompleteServiceVehicleExitOutput {
  const now = input.now ?? new Date()
  const plate = normalizePlate(input.plate)
  if (!plate) {
    return {
      ok: false,
      message: 'Geçerli bir plaka girin.',
      nextRecords: input.records,
    }
  }

  const activeIndex = input.records.findIndex((record) => normalizePlate(record.plate) === plate && record.status === 'active')
  if (activeIndex === -1) {
    return {
      ok: false,
      message: 'Bu plaka için aktif hizmet aracı kaydı bulunamadı.',
      nextRecords: input.records,
    }
  }

  const updatedRecord: ServiceVehicleRecord = {
    ...input.records[activeIndex],
    exitTime: now.toISOString(),
    durationMinutes: Math.max(1, Math.round((+now - +new Date(input.records[activeIndex].entryTime)) / 60000)),
    status: 'completed',
  }
  const nextRecords = [...input.records]
  nextRecords[activeIndex] = updatedRecord
  return {
    ok: true,
    message: 'Hizmet aracı çıkışı kaydedildi.',
    nextRecords,
    updatedRecord,
  }
}
