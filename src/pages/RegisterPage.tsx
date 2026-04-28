import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { storage } from '../storage'
import type { Resident, ServiceVehicleRecord, StaySession } from '../types'
import { normalizePlate, uid } from '../lib/domainUtils'
import { completeServiceVehicleExitByPlate } from '../services/accessControlService'

const NEW_RESIDENT_BADGE_KEY = 'parking:new-resident-badge-ids'

const initialForm = {
  name: '',
  surname: '',
  phone: '',
  plate: '',
  blockNo: '',
  apartmentNo: '',
  note: '',
}

const mockResidentTemplates = [
  { name: 'Ahmet', surname: 'Demir', phone: '05320000001', plate: '34 ABC 101', blockNo: 'A', apartmentNo: '1', note: 'Sahte kayıt' },
  { name: 'Mehmet', surname: 'Kaya', phone: '05320000002', plate: '34 ABC 102', blockNo: 'A', apartmentNo: '2', note: 'Sahte kayıt' },
  { name: 'Ayşe', surname: 'Yıldız', phone: '05320000003', plate: '34 ABC 103', blockNo: 'A', apartmentNo: '3', note: 'Sahte kayıt' },
  { name: 'Fatma', surname: 'Aydın', phone: '05320000004', plate: '34 ABC 104', blockNo: 'B', apartmentNo: '4', note: 'Sahte kayıt' },
  { name: 'Ali', surname: 'Çelik', phone: '05320000005', plate: '34 ABC 105', blockNo: 'B', apartmentNo: '5', note: 'Sahte kayıt' },
  { name: 'Zeynep', surname: 'Şahin', phone: '05320000006', plate: '34 ABC 106', blockNo: 'B', apartmentNo: '6', note: 'Sahte kayıt' },
  { name: 'Hasan', surname: 'Kurt', phone: '05320000007', plate: '34 ABC 107', blockNo: 'C', apartmentNo: '7', note: 'Sahte kayıt' },
  { name: 'Elif', surname: 'Arslan', phone: '05320000008', plate: '34 ABC 108', blockNo: 'C', apartmentNo: '8', note: 'Sahte kayıt' },
  { name: 'Murat', surname: 'Özdemir', phone: '05320000009', plate: '34 ABC 109', blockNo: 'C', apartmentNo: '9', note: 'Sahte kayıt' },
  { name: 'Canan', surname: 'Taş', phone: '05320000010', plate: '34 ABC 110', blockNo: 'D', apartmentNo: '10', note: 'Sahte kayıt' },
]

type ResidentForm = typeof initialForm
type RegisterTab = 'resident' | 'service'

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
}

function getCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key)
    for (const [column, value] of Object.entries(row)) {
      if (normalizeHeader(column) === normalizedKey) {
        return String(value ?? '').trim()
      }
    }
  }
  return ''
}

function mapExcelRowToForm(row: Record<string, unknown>): ResidentForm {
  return {
    name: getCell(row, [
      'ad',
      'isim',
      'name',
      'first name',
      'firstname',
      'given name',
      'givenname',
      'personel ad',
      'kisi adi',
      'kisiad',
      'adiniz',
    ]),
    surname: getCell(row, [
      'soyad',
      'surname',
      'last name',
      'lastname',
      'family name',
      'familyname',
      'kisi soyadi',
      'kisisoyad',
      'soyadiniz',
    ]),
    phone: getCell(row, [
      'telefon',
      'phone',
      'gsm',
      'cep',
      'cep telefonu',
      'ceptelefonu',
      'mobile',
      'mobile phone',
      'mobilephone',
      'tel',
      'telefon no',
      'telefonno',
      'phone number',
      'phonenumber',
      'iletisim',
      'iletisim no',
      'iletisimno',
    ]),
    plate: getCell(row, [
      'plaka',
      'plate',
      'plate no',
      'plateno',
      'plate number',
      'platenumber',
      'arac plaka',
      'aracplaka',
      'vehicle plate',
      'vehicleplate',
      'arac plaka no',
      'aracplakano',
    ]),
    blockNo: getCell(row, [
      'blok',
      'blokno',
      'blok no',
      'block',
      'blockno',
      'block no',
      'bina',
      'building',
      'building block',
      'buildingblock',
      'site blok',
      'siteblok',
    ]),
    apartmentNo: getCell(row, [
      'daire',
      'daireno',
      'daire no',
      'apartment',
      'apartmentno',
      'apartment no',
      'unit',
      'unit no',
      'unitno',
      'daire numarasi',
      'dairenumarasi',
      'flat',
      'flat no',
      'flatno',
    ]),
    note: getCell(row, [
      'not',
      'aciklama',
      'açıklama',
      'note',
      'notes',
      'description',
      'desc',
      'ek not',
      'eknot',
      'yorum',
      'comment',
      'comments',
      'aciklama notu',
      'aciklamanotu',
    ]),
  }
}

const legacyNameFixMap: Record<string, string> = {
  Ayse: 'Ayşe',
  Yildiz: 'Yıldız',
  Aydin: 'Aydın',
  Celik: 'Çelik',
  Sahin: 'Şahin',
  Ozdemir: 'Özdemir',
  Tas: 'Taş',
}

function fixLegacyMockResidentNames(items: Resident[]) {
  let changed = false
  const fixed = items.map((resident) => {
    if (resident.note !== 'Sahte kayıt') {
      return resident
    }

    const nextName = legacyNameFixMap[resident.name] ?? resident.name
    const nextSurname = legacyNameFixMap[resident.surname] ?? resident.surname

    if (nextName === resident.name && nextSurname === resident.surname) {
      return resident
    }

    changed = true
    return {
      ...resident,
      name: nextName,
      surname: nextSurname,
    }
  })

  return { fixed, changed }
}

function rankResidentsByQuery(residents: Resident[], query: string) {
  const textQuery = query.trim().toLocaleLowerCase('tr-TR')
  const plateQuery = normalizePlate(query)
  const phoneQuery = query.replace(/\D/g, '')

  if (!textQuery && !plateQuery && !phoneQuery) {
    return residents
  }

  return residents
    .map((resident) => {
      const fullName = `${resident.name} ${resident.surname}`.toLocaleLowerCase('tr-TR')
      const fullNameTokens = fullName.split(/\s+/).filter(Boolean)
      const normalizedPlate = normalizePlate(resident.plate)
      const normalizedPhone = resident.phone.replace(/\D/g, '')
      let score = 0

      if (plateQuery) {
        if (normalizedPlate === plateQuery) score += 200
        else if (normalizedPlate.startsWith(plateQuery)) score += 150
        else if (normalizedPlate.includes(plateQuery)) score += 100
      }

      if (phoneQuery) {
        if (normalizedPhone === phoneQuery) score += 180
        else if (normalizedPhone.startsWith(phoneQuery)) score += 130
        else if (normalizedPhone.includes(phoneQuery)) score += 90
      }

      if (textQuery) {
        if (fullName === textQuery) score += 170
        else if (fullName.startsWith(textQuery)) score += 120
        else if (fullNameTokens.some((token) => token.startsWith(textQuery))) score += 95
        else if (fullName.includes(textQuery)) score += 80
      }

      return { resident, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.resident)
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDurationMinutes(minutes: number) {
  const safe = Math.max(0, minutes)
  const hours = Math.floor(safe / 60)
  const remain = safe % 60
  if (hours === 0) return `${remain} dk`
  return `${hours} sa ${remain} dk`
}

export function RegisterPage() {
  const SHOW_MOCK_BUTTON = false
  const [activeTab, setActiveTab] = useState<RegisterTab>('resident')
  const [residents, setResidents] = useState<Resident[]>(storage.getResidents())
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('')
  const [selectedApartmentFilter, setSelectedApartmentFilter] = useState('')
  const [openMenuResidentId, setOpenMenuResidentId] = useState<string | null>(null)
  const [pendingDeleteResidentId, setPendingDeleteResidentId] = useState<string | null>(null)
  const [infoResidentId, setInfoResidentId] = useState<string | null>(null)
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [newlyAddedResidentIds, setNewlyAddedResidentIds] = useState<string[]>(() => {
    const raw = localStorage.getItem(NEW_RESIDENT_BADGE_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
    } catch {
      return []
    }
  })
  const [sessions, setSessions] = useState<StaySession[]>(storage.getSessions())
  const [serviceVehicles, setServiceVehicles] = useState<ServiceVehicleRecord[]>(storage.getServiceVehicles())
  const [serviceMessage, setServiceMessage] = useState('')
  const excelInputRef = useRef<HTMLInputElement | null>(null)

  const filteredResidents = useMemo(() => {
    const rankedResidents = rankResidentsByQuery(residents, searchQuery)
    return rankedResidents.filter((resident) => {
      if (selectedBlockFilter && resident.blockNo.trim() !== selectedBlockFilter) {
        return false
      }
      if (selectedApartmentFilter && resident.apartmentNo.trim() !== selectedApartmentFilter) {
        return false
      }
      return true
    })
  }, [residents, searchQuery, selectedBlockFilter, selectedApartmentFilter])
  const hasActiveSearch = searchQuery.trim().length > 0
  const bestMatchResidentId = hasActiveSearch ? filteredResidents[0]?.id ?? null : null
  const blockOptions = useMemo(
    () =>
      Array.from(new Set(residents.map((resident) => resident.blockNo.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'tr-TR'),
      ),
    [residents],
  )
  const apartmentOptions = useMemo(
    () =>
      Array.from(new Set(residents.map((resident) => resident.apartmentNo.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'tr-TR', { numeric: true }),
      ),
    [residents],
  )
  const selectedResident = useMemo(
    () => residents.find((resident) => resident.id === infoResidentId) ?? null,
    [residents, infoResidentId],
  )
  const residentRecentSessions = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.residentId === infoResidentId)
        .sort((a, b) => {
          const aTime = a.exitTime ?? a.entryTime
          const bTime = b.exitTime ?? b.entryTime
          return +new Date(bTime) - +new Date(aTime)
        })
        .slice(0, 5),
    [sessions, infoResidentId],
  )
  const recentSessionRows = useMemo(
    () => Array.from({ length: 5 }, (_, index) => residentRecentSessions[index] ?? null),
    [residentRecentSessions],
  )
  const activeStaySession = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.residentId === infoResidentId && !session.exitTime)
        .sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime))[0],
    [sessions, infoResidentId],
  )
  const latestClosedSession = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.residentId === infoResidentId && session.exitTime)
        .sort((a, b) => +new Date((b.exitTime as string) ?? b.entryTime) - +new Date((a.exitTime as string) ?? a.entryTime))[0],
    [sessions, infoResidentId],
  )
  const activeServiceVehicles = useMemo(
    () => serviceVehicles.filter((record) => record.status === 'active'),
    [serviceVehicles],
  )
  const completedServiceVehicles = useMemo(
    () => serviceVehicles.filter((record) => record.status === 'completed').slice(0, 10),
    [serviceVehicles],
  )

  useEffect(() => {
    const { fixed, changed } = fixLegacyMockResidentNames(residents)
    if (!changed) {
      return
    }
    setResidents(fixed)
    storage.setResidents(fixed)
  }, [residents])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setServiceVehicles(storage.getServiceVehicles())
    }, 2000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    localStorage.setItem(NEW_RESIDENT_BADGE_KEY, JSON.stringify(newlyAddedResidentIds))
  }, [newlyAddedResidentIds])

  useEffect(() => {
    const residentIdSet = new Set(residents.map((resident) => resident.id))
    setNewlyAddedResidentIds((prev) => prev.filter((id) => residentIdSet.has(id)))
  }, [residents])

  function createResidentFromForm(data: ResidentForm) {
    const phone = data.phone.replace(/\D/g, '')
    const plate = normalizePlate(data.plate)
    const fullName = `${data.name.trim()} ${data.surname.trim()}`.trim()

    if (fullName.length < 3) return null
    if (phone.length < 10 || phone.length > 11) return null
    if (!plate || plate.length < 5) return null

    return {
      name: data.name.trim(),
      surname: data.surname.trim(),
      phone,
      plate,
      blockNo: data.blockNo.trim(),
      apartmentNo: data.apartmentNo.trim(),
      note: data.note.trim(),
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const mapped = createResidentFromForm(form)
    if (!mapped) {
      setMessage('Form bilgileri geçersiz. Ad, telefon ve plaka alanlarını kontrol edin.')
      return
    }
    if (residents.some((resident) => normalizePlate(resident.plate) === mapped.plate && resident.id !== editingResidentId)) {
      setMessage('Bu plaka zaten kayıtlı.')
      return
    }
    if (editingResidentId) {
      const next = residents.map((resident) =>
        resident.id === editingResidentId
          ? {
              ...resident,
              ...mapped,
            }
          : resident,
      )
      setResidents(next)
      storage.setResidents(next)
      setForm(initialForm)
      setEditingResidentId(null)
      setIsFormModalOpen(false)
      setNewlyAddedResidentIds((prev) => prev.filter((id) => id !== editingResidentId))
      setMessage('Kayıt güncellendi.')
      return
    }

    const record: Resident = {
      id: uid('resident'),
      ...mapped,
      createdAt: new Date().toISOString(),
    }
    const next = [record, ...residents]
    setResidents(next)
    storage.setResidents(next)
    setNewlyAddedResidentIds((prev) => [record.id, ...prev])
    setSearchQuery('')
    setSelectedBlockFilter('')
    setSelectedApartmentFilter('')
    setIsFormModalOpen(false)
    setForm(initialForm)
    setMessage('Kayıt başarıyla eklendi.')
  }

  function triggerExcelImport() {
    excelInputRef.current?.click()
  }

  function downloadResidentList() {
    if (residents.length === 0) {
      setMessage('İndirilecek kayıt bulunamadı.')
      return
    }

    const rows = residents.map((resident) => ({
      Ad: resident.name,
      Soyad: resident.surname,
      Telefon: resident.phone,
      Plaka: resident.plate,
      Blok: resident.blockNo,
      Daire: resident.apartmentNo,
      Not: resident.note,
      KayıtTarihi: resident.createdAt,
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kayıtlar')

    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    XLSX.writeFile(workbook, `kayit-listesi-${stamp}.xlsx`)
    setMessage('Kayıt listesi indirildi.')
  }

  async function onExcelFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setMessage('Excel dosyasında sayfa bulunamadı.')
        return
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
      if (rows.length === 0) {
        setMessage('Excel dosyası boş görünüyor.')
        return
      }

      const existingPlateSet = new Set(residents.map((resident) => normalizePlate(resident.plate)))
      const importedResidents: Resident[] = []
      let skippedCount = 0

      for (const row of rows) {
        const formData = mapExcelRowToForm(row)
        const mapped = createResidentFromForm(formData)
        if (!mapped) {
          skippedCount += 1
          continue
        }
        if (existingPlateSet.has(mapped.plate)) {
          skippedCount += 1
          continue
        }

        existingPlateSet.add(mapped.plate)
        importedResidents.push({
          id: uid('resident'),
          ...mapped,
          createdAt: new Date().toISOString(),
        })
      }

      if (importedResidents.length === 0) {
        setMessage('Excelden geçerli yeni kayıt bulunamadı.')
        return
      }

      const next = [...importedResidents, ...residents]
      setResidents(next)
      storage.setResidents(next)
      setNewlyAddedResidentIds((prev) => [...importedResidents.map((resident) => resident.id), ...prev])
      setSearchQuery('')
      setSelectedBlockFilter('')
      setSelectedApartmentFilter('')
      setMessage(`Excelden ${importedResidents.length} kayıt eklendi. Atlanan satır: ${skippedCount}.`)
    } catch {
      setMessage('Excel okunurken bir hata oluştu. Dosya formatını kontrol edin.')
    }
  }

  function addMockResidents() {
    const existingPlateSet = new Set(residents.map((resident) => normalizePlate(resident.plate)))
    const mockResidents: Resident[] = []

    for (const template of mockResidentTemplates) {
      const normalizedPlate = normalizePlate(template.plate)
      if (existingPlateSet.has(normalizedPlate)) {
        continue
      }
      existingPlateSet.add(normalizedPlate)
      mockResidents.push({
        id: uid('resident'),
        name: template.name,
        surname: template.surname,
        phone: template.phone,
        plate: normalizedPlate,
        blockNo: template.blockNo,
        apartmentNo: template.apartmentNo,
        note: template.note,
        createdAt: new Date().toISOString(),
      })
    }

    if (mockResidents.length === 0) {
      setMessage('Sahte kayıtlar zaten eklenmiş görünüyor.')
      return
    }

    const next = [...mockResidents, ...residents]
    setResidents(next)
    storage.setResidents(next)
    setNewlyAddedResidentIds((prev) => [...mockResidents.map((resident) => resident.id), ...prev])
    setSearchQuery('')
    setSelectedBlockFilter('')
    setSelectedApartmentFilter('')
    setMessage(`${mockResidents.length} adet sahte kayıt eklendi.`)
  }

  function removeResident(residentId: string) {
    const next = residents.filter((resident) => resident.id !== residentId)
    setResidents(next)
    storage.setResidents(next)
    setNewlyAddedResidentIds((prev) => prev.filter((id) => id !== residentId))
    if (editingResidentId === residentId) {
      setEditingResidentId(null)
      setForm(initialForm)
    }
    setMessage('Kayıt silindi.')
    setOpenMenuResidentId(null)
    setPendingDeleteResidentId(null)
  }

  function toggleResidentMenu(residentId: string) {
    setOpenMenuResidentId((prev) => (prev === residentId ? null : residentId))
  }

  function openResidentInfo(residentId: string) {
    setSessions(storage.getSessions())
    setInfoResidentId(residentId)
    setOpenMenuResidentId(null)
  }

  function startEditingResident(resident: Resident) {
    setForm({
      name: resident.name,
      surname: resident.surname,
      phone: resident.phone,
      plate: resident.plate,
      blockNo: resident.blockNo,
      apartmentNo: resident.apartmentNo,
      note: resident.note,
    })
    setEditingResidentId(resident.id)
    setIsFormModalOpen(true)
    setOpenMenuResidentId(null)
    setMessage('Düzenleme modu aktif. Değişiklikten sonra güncelleyin.')
  }

  function openCreateModal() {
    setEditingResidentId(null)
    setForm(initialForm)
    setIsFormModalOpen(true)
    setMessage('')
  }

  function handleResidentRowClick(resident: Resident) {
    if (!newlyAddedResidentIds.includes(resident.id)) {
      return
    }
    setNewlyAddedResidentIds((prev) => prev.filter((id) => id !== resident.id))
    startEditingResident(resident)
  }

  function cancelEditing() {
    setEditingResidentId(null)
    setForm(initialForm)
    setIsFormModalOpen(false)
    setMessage('')
  }

  function completeServiceExit(plate: string) {
    const result = completeServiceVehicleExitByPlate({
      records: serviceVehicles,
      plate,
    })
    setServiceMessage(result.message)
    if (!result.ok) {
      return
    }
    setServiceVehicles(result.nextRecords)
    storage.setServiceVehicles(result.nextRecords)
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Kayıt Sayfası</h2>
          <p>Ad, soyad, telefon, plaka, blok, daire ve not bilgilerinin sisteme kaydı</p>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost-btn" onClick={openCreateModal}>
            Yeni Kayıt Ekle
          </button>
          <button type="button" className="ghost-btn" onClick={downloadResidentList}>
            Listeyi İndir
          </button>
          <button type="button" className="excel-import-btn" onClick={triggerExcelImport}>
            <span className="excel-import-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M14 3h-7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
                <path d="m9 12 2 3m0-3-2 3m4-3v3" />
              </svg>
            </span>
            Excel ile Ekle
          </button>
        </div>
      </header>
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden-input"
        onChange={onExcelFileSelected}
      />

      <div className="settings-tabs" role="tablist" aria-label="Kayıt sekmeleri">
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'resident' ? 'active' : ''}`}
          onClick={() => setActiveTab('resident')}
        >
          Site Sakini Kayıtları
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'service' ? 'active' : ''}`}
          onClick={() => setActiveTab('service')}
        >
          Hizmet Aracı Kayıtları
        </button>
      </div>

      {activeTab === 'resident' && (
      <section className="card">
          <h3>Kayıtlı Kişiler ({filteredResidents.length}/{residents.length})</h3>
          <p className="message message-slot">{message || '\u00A0'}</p>
          <div className="search-toolbar">
            <div className="search-input-wrap">
              <span className="search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                className="search-input"
                placeholder="Ara"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <select
              className="search-filter-select"
              value={selectedBlockFilter}
              onChange={(event) => setSelectedBlockFilter(event.target.value)}
            >
              <option value="">Tüm Bloklar</option>
              {blockOptions.map((block) => (
                <option key={block} value={block}>
                  Blok {block}
                </option>
              ))}
            </select>
            <select
              className="search-filter-select"
              value={selectedApartmentFilter}
              onChange={(event) => setSelectedApartmentFilter(event.target.value)}
            >
              <option value="">Tüm Daireler</option>
              {apartmentOptions.map((apartment) => (
                <option key={apartment} value={apartment}>
                  Daire {apartment}
                </option>
              ))}
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Telefon</th>
                <th>Plaka</th>
                <th>Blok</th>
                <th>Daire</th>
                <th>Not</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredResidents.map((resident) => (
                <tr
                  key={resident.id}
                  className={`${resident.id === bestMatchResidentId ? 'best-match-row' : ''} ${newlyAddedResidentIds.includes(resident.id) ? 'new-resident-row' : ''}`}
                  onClick={() => handleResidentRowClick(resident)}
                >
                  <td>
                    {resident.name} {resident.surname}
                    {resident.id === bestMatchResidentId && hasActiveSearch && (
                      <span className="best-match-badge">En iyi eşleşme</span>
                    )}
                    {newlyAddedResidentIds.includes(resident.id) && (
                      <span className="new-resident-badge">Yeni</span>
                    )}
                  </td>
                  <td>{resident.phone}</td>
                  <td>{resident.plate}</td>
                  <td>{resident.blockNo}</td>
                  <td>{resident.apartmentNo}</td>
                  <td>{resident.note || '-'}</td>
                  <td className="row-actions-cell">
                    <button
                      type="button"
                      className="row-menu-trigger"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleResidentMenu(resident.id)
                      }}
                      aria-label="Kayıt işlemleri"
                    >
                      ...
                    </button>
                    {openMenuResidentId === resident.id && (
                      <div className="row-menu-popup">
                        <button
                          type="button"
                          className="row-menu-item"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditingResident(resident)
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="row-menu-item"
                          onClick={(event) => {
                            event.stopPropagation()
                            openResidentInfo(resident.id)
                          }}
                        >
                          Bilgi
                        </button>
                        <button
                          type="button"
                          className="row-menu-item danger-btn"
                          onClick={(event) => {
                            event.stopPropagation()
                            setPendingDeleteResidentId(resident.id)
                            setOpenMenuResidentId(null)
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {residents.length === 0 && (
                <tr>
                  <td colSpan={7}>Henüz kayıtlı kişi yok.</td>
                </tr>
              )}
              {residents.length > 0 && filteredResidents.length === 0 && (
                <tr>
                  <td colSpan={7}>Aramaya uygun kayıt bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
      </section>
      )}
      {activeTab === 'service' && (
        <section className="page-stack">
          <section className="card">
            <h3>Aktif Hizmet Araçları ({activeServiceVehicles.length})</h3>
            <p className="message message-slot">{serviceMessage || '\u00A0'}</p>
            <table>
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Ad Soyad</th>
                  <th>Firma</th>
                  <th>Kime Geldiği</th>
                  <th>Arac</th>
                  <th>Giriş</th>
                  <th>İçeride Kalma</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeServiceVehicles.map((record) => (
                  <tr key={record.id}>
                    <td>{record.plate}</td>
                    <td>{record.name} {record.surname}</td>
                    <td>{record.company}</td>
                    <td>{record.visitedPerson || '-'}</td>
                    <td>{record.vehicleBrand} {record.vehicleModel} / {record.vehicleColor}</td>
                    <td>{formatDateShort(record.entryTime)}</td>
                    <td>{formatDurationMinutes(Math.max(1, Math.round((Date.now() - +new Date(record.entryTime)) / 60000)))} (devam)</td>
                    <td><span className="service-status-badge active">İçeride</span></td>
                    <td>
                      <button type="button" onClick={() => completeServiceExit(record.plate)}>
                        Çıkış Yaptı
                      </button>
                    </td>
                  </tr>
                ))}
                {activeServiceVehicles.length === 0 && (
                  <tr>
                    <td colSpan={9}>Aktif hizmet araci yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h3>Son Çıkış Yapan Hizmet Araçları ({completedServiceVehicles.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Plaka</th>
                  <th>Ad Soyad</th>
                  <th>Firma</th>
                  <th>Kime Geldiği</th>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>Toplam Kalma</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {completedServiceVehicles.map((record) => (
                  <tr key={record.id}>
                    <td>{record.plate}</td>
                    <td>{record.name} {record.surname}</td>
                    <td>{record.company}</td>
                    <td>{record.visitedPerson || '-'}</td>
                    <td>{formatDateShort(record.entryTime)}</td>
                    <td>{record.exitTime ? formatDateShort(record.exitTime) : '-'}</td>
                    <td>{record.durationMinutes ? formatDurationMinutes(record.durationMinutes) : '-'}</td>
                    <td><span className="service-status-badge completed">Çıktı</span></td>
                  </tr>
                ))}
                {completedServiceVehicles.length === 0 && (
                  <tr>
                    <td colSpan={8}>Henüz çıkış kaydı yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </section>
      )}
      {isFormModalOpen && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Kayıt formu">
          <form
            className={`confirm-modal register-modal form-grid ${editingResidentId ? 'editing-mode' : ''}`}
            onSubmit={onSubmit}
          >
            <div className="modal-header-row">
              <h4>{editingResidentId ? 'Kaydı Düzenle' : 'Yeni Kayıt'}</h4>
              <button type="button" className="row-menu-trigger" onClick={cancelEditing} aria-label="Formu kapat">
                ×
              </button>
            </div>
            {editingResidentId && <p className="editing-mode-badge">Düzenleme modu aktif</p>}
            <div className="register-grid">
              <label>
                Ad
                <input
                  placeholder="Örn: Ahmet"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Soyad
                <input
                  placeholder="Örn: Yılmaz"
                  value={form.surname}
                  onChange={(event) => setForm((prev) => ({ ...prev, surname: event.target.value }))}
                  required
                />
              </label>
              <label>
                Telefon
                <input
                  placeholder="Örn: 05xxxxxxxxx"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  inputMode="numeric"
                  maxLength={11}
                  required
                />
              </label>
              <label>
                Plaka
                <input
                  placeholder="Örn: 34 ABC 123"
                  value={form.plate}
                  onChange={(event) => setForm((prev) => ({ ...prev, plate: event.target.value }))}
                  required
                />
              </label>
              <label>
                Blok No
                <input
                  placeholder="Örn: A"
                  value={form.blockNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, blockNo: event.target.value }))}
                  required
                />
              </label>
              <label>
                Daire No
                <input
                  placeholder="Örn: 12"
                  value={form.apartmentNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, apartmentNo: event.target.value }))}
                  required
                />
              </label>
            </div>
            <label>
              Not
              <textarea
                placeholder="Ek açıklama (opsiyonel)"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                rows={3}
              />
            </label>
            <div className="confirm-actions">
              <button type="button" className="ghost-btn" onClick={cancelEditing}>
                Kapat
              </button>
              <button type="submit">{editingResidentId ? 'Güncelle' : 'Kaydet'}</button>
            </div>
            {SHOW_MOCK_BUTTON && (
              <button type="button" onClick={addMockResidents}>
                10 Sahte Kayıt Ekle
              </button>
            )}
          </form>
        </div>
      )}
      {pendingDeleteResidentId && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Kayıt silme onayı">
          <div className="confirm-modal">
            <h4>Kayıt silinsin mi?</h4>
            <p>Bu işlem geri alınamaz. Seçili kayıt kalıcı olarak silinecektir.</p>
            <div className="confirm-actions">
              <button type="button" className="ghost-btn" onClick={() => setPendingDeleteResidentId(null)}>
                Vazgeç
              </button>
              <button type="button" className="danger-btn" onClick={() => removeResident(pendingDeleteResidentId)}>
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
      {infoResidentId && selectedResident && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Kişi hareket bilgisi">
          <div className="confirm-modal info-modal">
            <h4>Bilgi - {selectedResident.name} {selectedResident.surname}</h4>
            <p>Son 5 oturum özeti</p>

            <div className="info-status-card">
              {activeStaySession ? (
                <div className="info-status-row">
                  <strong>Durum: İçeride</strong>
                  <span>Giriş: {formatDateShort(activeStaySession.entryTime)}</span>
                </div>
              ) : latestClosedSession ? (
                <div className="info-status-row">
                  <strong>Durum: Dışarıda</strong>
                  <span>Son kalış: {latestClosedSession.durationMinutes ?? '-'} dk</span>
                </div>
              ) : (
                <div className="info-status-row">
                  <strong>Durum</strong>
                  <span>Kayıtlı kalış bilgisi yok</span>
                </div>
              )}
            </div>

            <div className="info-events-list">
              {recentSessionRows.map((session, index) => {
                const rowTitle = `${index + 1}. kayıt`
                return (
                <div key={session ? session.id : `empty-${index}`} className="info-event-item">
                  {session ? (
                    <>
                      <div className="info-event-row">
                        <strong>{rowTitle}</strong>
                        <span>{session.durationMinutes ? `${session.durationMinutes} dk` : 'Devam ediyor'}</span>
                      </div>
                      <small>Giriş: {formatDateShort(session.entryTime)}</small>
                      <small>Çıkış: {session.exitTime ? formatDateShort(session.exitTime) : '-'}</small>
                    </>
                  ) : (
                    <>
                      <div className="info-event-row">
                        <strong>{rowTitle}</strong>
                        <span>-</span>
                      </div>
                      <small>Veri yok</small>
                      <small>-</small>
                    </>
                  )}
                </div>
              )})}
            </div>

            <div className="confirm-actions">
              <button type="button" className="ghost-btn" onClick={() => setInfoResidentId(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
