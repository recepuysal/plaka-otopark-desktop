export type IdFactory = (prefix: string) => string

export const uid: IdFactory = (prefix: string) => {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`
}

export function normalizePlate(plate: string) {
  return plate.toUpperCase().replaceAll(' ', '').trim()
}
