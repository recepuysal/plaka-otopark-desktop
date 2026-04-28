import type {
  AccessEvent,
  BarrierSettings,
  CameraConfig,
  GeneralSettings,
  Resident,
  ServiceVehicleRecord,
  StaySession,
} from './types'
import { APP_CONFIG } from './config/appConfig'

const KEYS = {
  residents: 'parking:residents',
  events: 'parking:events',
  sessions: 'parking:sessions',
  cameras: 'parking:cameras',
  barrier: 'parking:barrier-settings',
  general: 'parking:general-settings',
  serviceVehicles: 'parking:service-vehicles',
}

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data))
}

export const storage = {
  getResidents: () => read<Resident[]>(KEYS.residents, []),
  setResidents: (items: Resident[]) => write(KEYS.residents, items),

  getEvents: () => read<AccessEvent[]>(KEYS.events, []),
  setEvents: (items: AccessEvent[]) => write(KEYS.events, items),

  getSessions: () => read<StaySession[]>(KEYS.sessions, []),
  setSessions: (items: StaySession[]) => write(KEYS.sessions, items),

  getCameras: () =>
    read<CameraConfig[]>(KEYS.cameras, APP_CONFIG.defaults.cameras),
  setCameras: (items: CameraConfig[]) => write(KEYS.cameras, items),

  getBarrierSettings: () =>
    read<BarrierSettings>(KEYS.barrier, APP_CONFIG.barrier),
  setBarrierSettings: (settings: BarrierSettings) => write(KEYS.barrier, settings),

  getGeneralSettings: () =>
    read<GeneralSettings>(KEYS.general, APP_CONFIG.defaults.general),
  setGeneralSettings: (settings: GeneralSettings) => write(KEYS.general, settings),

  getServiceVehicles: () =>
    read<ServiceVehicleRecord[]>(KEYS.serviceVehicles, []),
  setServiceVehicles: (records: ServiceVehicleRecord[]) => write(KEYS.serviceVehicles, records),
}
