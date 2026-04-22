import { FormEvent, useState } from 'react'
import { normalizePlate, storage, uid } from '../storage'
import type { Resident } from '../types'

const initialForm = {
  name: '',
  surname: '',
  phone: '',
  plate: '',
  blockNo: '',
  apartmentNo: '',
  note: '',
}

export function RegisterPage() {
  const [residents, setResidents] = useState<Resident[]>(storage.getResidents())
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')

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
    if (residents.some((resident) => normalizePlate(resident.plate) === plate)) {
      setMessage('Bu plaka zaten kayıtlı.')
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

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Kayıt Sayfası</h2>
          <p>Ad, soyad, telefon, plaka, blok, daire ve not bilgilerinin sisteme kaydı</p>
        </div>
      </header>

      <div className="two-col">
        <form className="card form-grid" onSubmit={onSubmit}>
          <h3>Yeni Kayıt</h3>
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
          <button type="submit">Kaydet</button>
          {message && <p className="message">{message}</p>}
        </form>

        <section className="card">
          <h3>Kayıtlı Kişiler ({residents.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Telefon</th>
                <th>Plaka</th>
                <th>Blok</th>
                <th>Daire</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((resident) => (
                <tr key={resident.id}>
                  <td>{resident.name} {resident.surname}</td>
                  <td>{resident.phone}</td>
                  <td>{resident.plate}</td>
                  <td>{resident.blockNo}</td>
                  <td>{resident.apartmentNo}</td>
                  <td>{resident.note || '-'}</td>
                </tr>
              ))}
              {residents.length === 0 && (
                <tr>
                  <td colSpan={6}>Henüz kayıtlı kişi yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  )
}
