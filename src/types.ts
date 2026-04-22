export type GateType = 'entry' | 'exit'

export interface Resident {
  id: string
  name: string
  surname: string
  phone: string
  plate: string
  blockNo: string
  apartmentNo: string
  note: string
  createdAt: string
}

export interface AccessEvent {
  id: string
  residentId: string | null
  plate: string
  residentName: string
  gate: GateType
  time: string
  barrierOpened: boolean
  note: string
}

export interface StaySession {
  id: string
  residentId: string
  plate: string
  residentName: string
  entryTime: string
  exitTime?: string
  durationMinutes?: number
}

export type CameraType =
  | 'USB'
  | 'IP RTSP'
  | 'IP MJPEG'
  | 'IP Snapshot'
  | 'ONVIF'
  | 'WebRTC'
  | 'DVR/NVR Channel'

export interface CameraConfig {
  gate: GateType
  type: CameraType
  name: string
  url: string
  username: string
  password: string
}
