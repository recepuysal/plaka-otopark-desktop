import { FormEvent, useEffect, useMemo, useState } from 'react'
import { storage } from '../storage'
import type { Resident } from '../types'
import { normalizePlate, uid } from '../lib/domainUtils'

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

export function RegisterPage() {
  const SHOW_MOCK_BUTTON = false
  const [residents, setResidents] = useState<Resident[]>(storage.getResidents())
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('')
  const [selectedApartmentFilter, setSelectedApartmentFilter] = useState('')
  const [openMenuResidentId, setOpenMenuResidentId] = useState<string | null>(null)
  const [pendingDeleteResidentId, setPendingDeleteResidentId] = useState<string | null>(null)
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null)

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

  useEffect(() => {
    const { fixed, changed } = fixLegacyMockResidentNames(residents)
    if (!changed) {
      return
    }
    setResidents(fixed)
    storage.setResidents(fixed)
  }, [residents])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phone = form.phone.replace(/\D/g, '')
    const plate = normalizePlate(form.plate)
    const fullName = `${form.name.trim()} ${form.surname.trim()}`.trim()
    if (fullName.length < 3) {
      setMessage('Ad ve soyad bilgisi geçerli olmalıdır.')
      return
    }
    if (phone.length < 10 || phone.length > 11) {
      setMessage('Telefon numarası 10 veya 11 haneli olmalıdır.')
      return
    }
    if (!plate) {
      setMessage('Plaka zorunludur.')
      return
    }
    if (plate.length < 5) {
      setMessage('Plaka formatı geçersiz görünüyor.')
      return
    }
    if (residents.some((resident) => normalizePlate(resident.plate) === plate && resident.id !== editingResidentId)) {
      setMessage('Bu plaka zaten kayıtlı.')
      return
    }
    if (editingResidentId) {
      const next = residents.map((resident) =>
        resident.id === editingResidentId
          ? {
              ...resident,
              name: form.name.trim(),
              surname: form.surname.trim(),
              phone,
              plate,
              blockNo: form.blockNo.trim(),
              apartmentNo: form.apartmentNo.trim(),
              note: form.note.trim(),
            }
          : resident,
      )
      setResidents(next)
      storage.setResidents(next)
      setForm(initialForm)
      setEditingResidentId(null)
      setMessage('Kayıt güncellendi.')
      return
    }

    const record: Resident = {
      id: uid('resident'),
      name: form.name.trim(),
      surname: form.surname.trim(),
      phone,
      plate,
      blockNo: form.blockNo.trim(),
      apartmentNo: form.apartmentNo.trim(),
      note: form.note.trim(),
      createdAt: new Date().toISOString(),
    }
    const next = [record, ...residents]
    setResidents(next)
    storage.setResidents(next)
    setForm(initialForm)
    setMessage('Kayıt başarıyla eklendi.')
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
    setMessage(`${mockResidents.length} adet sahte kayıt eklendi.`)
  }

  function removeResident(residentId: string) {
    const next = residents.filter((resident) => resident.id !== residentId)
    setResidents(next)
    storage.setResidents(next)
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
    setOpenMenuResidentId(null)
    setMessage('Düzenleme modu aktif. Değişiklikten sonra güncelleyin.')
  }

  function cancelEditing() {
    setEditingResidentId(null)
    setForm(initialForm)
    setMessage('Düzenleme iptal edildi.')
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Kayıt Sayfası</h2>
          <p>Ad, soyad, telefon, plaka, blok, daire ve not bilgilerinin sisteme kaydı</p>
        </div>
      </header>

      <div className="two-col">
        <form
          className={`card form-grid register-form-card ${editingResidentId ? 'editing-mode' : ''}`}
          onSubmit={onSubmit}
        >
          <h3>{editingResidentId ? 'Kaydı Düzenle' : 'Yeni Kayıt'}</h3>
          {editingResidentId && <p className="editing-mode-badge">Duzenleme modu aktif</p>}
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
          <button type="submit">{editingResidentId ? 'Güncelle' : 'Kaydet'}</button>
          {editingResidentId && (
            <button type="button" className="ghost-btn" onClick={cancelEditing}>
              İptal
            </button>
          )}
          {SHOW_MOCK_BUTTON && (
            <button type="button" onClick={addMockResidents}>
              10 Sahte Kayıt Ekle
            </button>
          )}
          <p className="message message-slot">{message || '\u00A0'}</p>
        </form>

        <section className="card">
          <h3>Kayıtlı Kişiler ({filteredResidents.length}/{residents.length})</h3>
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
                <tr key={resident.id} className={resident.id === bestMatchResidentId ? 'best-match-row' : ''}>
                  <td>
                    {resident.name} {resident.surname}
                    {resident.id === bestMatchResidentId && hasActiveSearch && (
                      <span className="best-match-badge">En iyi eslesme</span>
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
                      onClick={() => toggleResidentMenu(resident.id)}
                      aria-label="Kayıt işlemleri"
                    >
                      ...
                    </button>
                    {openMenuResidentId === resident.id && (
                      <div className="row-menu-popup">
                        <button type="button" className="row-menu-item" onClick={() => startEditingResident(resident)}>
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="row-menu-item danger-btn"
                          onClick={() => {
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
      </div>
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
    </section>
  )
}
