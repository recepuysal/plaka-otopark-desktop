# PlakaOtopark — Masaüstü

Türkiye plaka tanıma (**Tesseract.js**), çift hat giriş/çıkış, kayıtlı plakada **HTTP bariyer** sinyali. **USB** ve **IP kamera** (MJPEG / snapshot). **Electron + React + Vite** ile paketlenmiş Windows odaklı masaüstü uygulaması.

| | |
|---|---|
| **Sürüm** | 2.2.0 |
| **Lisans** | UNLICENSED (özel) |
| **Depo** | Gizli — aşağıdaki kurulumu kullanın |

---

## Bu sürümde neler var?

Bu sürümde özellikle **kayıt yönetimi** ekranı güçlendirilmiştir:

- İsim, plaka ve telefon için **anlık akıllı arama**
- Aramada en yakın sonucun öne gelmesi (**best match** vurgusu)
- Arama alanında **blok** ve **daire** filtreleri
- Her kayıt satırında `...` menüsü ile **Düzenle / Sil**
- Tema uyumlu, güvenli **silme onay popup** (sistem popup yerine özel modal)
- `Düzenle` tıklanınca formun otomatik doldurulması ve aynı formdan güncelleme
- Düzenleme modunda görsel durum (başlık, buton, kart vurgusu)
- Sürüm numarası ve ikon üretimi için otomasyon iyileştirmeleri

---

## Gereksinimler

- **Node.js** LTS (önerilir: 18 veya üzeri; en az 16)
- **npm** (Node ile birlikte gelir)
- **Git** (kaynak kodu klonlamak için)

```powershell
node -v
npm -v
```

---

## Gizli depodan klonlama

Depo GitHub’da **private** olduğu için `git clone` sırasında kimlik doğrulama gerekir.

**HTTPS (önerilen):** GitHub’da bir **Personal Access Token (classic)** oluşturun; şifre yerine bu token’ı kullanın.

```powershell
git clone https://github.com/recepuysal/plaka-otopark-desktop.git
cd plaka-otopark-desktop
```

**SSH:** Makinenizde SSH anahtarı GitHub hesabınıza ekliyse:

```powershell
git clone git@github.com:recepuysal/plaka-otopark-desktop.git
cd plaka-otopark-desktop
```

---

## Kurulum ve çalıştırma

```powershell
npm install
npm run dev
```

Geliştirme sırasında Vite sunucusu genellikle `http://localhost:5173/` adresinde çalışır.

---

## Komutlar

| Komut | Açıklama |
|--------|----------|
| `npm run dev` | Geliştirme modu (Vite + Electron) |
| `npm run build` | TypeScript derlemesi, Vite üretim derlemesi, **electron-builder** ile kurulum paketi |
| `npm run preview` | Üretim önizlemesi (Vite) |
| `npm test` | Vitest testleri (`pretest` ile önce test modunda build) |

Üretim derlemesinden sonra çıktılar `release/<sürüm>/` altında toplanır (Windows’ta NSIS kurucu vb.).

---

## Kayıt ekranı kullanım rehberi

### 1) Yeni kayıt ekleme

- `Ad`, `Soyad`, `Telefon`, `Plaka`, `Blok No`, `Daire No` ve opsiyonel `Not` girilir.
- `Kaydet` ile kayıt eklenir.

### 2) Akıllı arama

- `Ara` kutusuna yazdıkça sonuçlar otomatik güncellenir.
- Arama aynı anda isim/soyisim, plaka ve telefon alanlarında çalışır.
- En uygun sonuç üstte vurgulanır (arama metni varsa).

### 3) Blok ve daire filtreleme

- Arama kutusunun yanında yer alan `Tüm Bloklar` ve `Tüm Daireler` filtreleri ile liste daraltılabilir.
- Arama + filtre birlikte çalışır.

### 4) Kayıt düzenleme

- İlgili satırdaki `...` menüsünden `Düzenle` seçilir.
- Form, seçilen kişinin bilgileriyle otomatik dolar.
- Başlık `Kaydı Düzenle`, buton `Güncelle` olur.
- İşlemden vazgeçmek için `İptal` kullanılabilir.

### 5) Kayıt silme

- İlgili satırdaki `...` menüsünden `Sil` seçilir.
- Özel onay penceresinde `Evet, Sil` ile kalıcı silme yapılır.

---

## Sürümleme ve ikon otomasyonu

Projede sürüm etiketi ve ikon üretimi otomatikleştirilmiştir:

- `predev`, `prebuild`, `pretest` öncesi sürüm scripti çalışır.
- Uygulama içinde görüntülenen sürüm etiketi otomatik güncellenir.
- Uygulama ikonu `assets/app-logo.jpg` kaynağından üretilir:
  - `build/icon.png`
  - `build/icon.ico`

Not: Her `dev/build/test` çalıştırmasında sürüm sayacı artar.

---

## Windows `.exe` çıktısı

Kurulum dosyası için:

```powershell
npm run build
```

Çıktı yolu:

- `release/2.2.0/plaka-otopark-desktop_2.2.0.exe`

Not: Geliştirme ortamında imzalama yapılandırmasına göre Windows SmartScreen uyarısı görülebilir.

---

## Proje yapısı

```
├── electron/          # Ana süreç ve preload (derleme: dist-electron)
├── scripts/           # Sürüm ve ikon üretim scriptleri
├── public/            # Statik dosyalar
├── src/               # React arayüzü (renderer)
│   ├── config/        # Uygulama konfigürasyonları
│   ├── lib/           # Domain yardımcı fonksiyonları
│   └── services/      # İş kuralları (access control vb.)
├── test/              # Vitest birim testleri
└── release/           # build sonrası kurulum / çıkarılmış uygulama
```

---

## Teknolojiler

- Electron, Vite, React, TypeScript  
- Tailwind CSS  
- Tesseract.js (plaka OCR)  
- react-router-dom  
- electron-updater (yayın yapılandırmasına bağlı)

---

## Geliştirici

Recep UYSAL
