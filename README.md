# PlakaOtopark — Masaüstü

Türkiye plaka tanıma (**Tesseract.js**), çift hat giriş/çıkış, kayıtlı plakada **HTTP bariyer** sinyali. **USB** ve **IP kamera** (MJPEG / snapshot). **Electron + React + Vite** ile paketlenmiş Windows odaklı masaüstü uygulaması.

| | |
|---|---|
| **Sürüm** | 2.2.0 |
| **Lisans** | UNLICENSED (özel) |
| **Depo** | Gizli — aşağıdaki kurulumu kullanın |

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

Geliştirme sunucusu varsayılan olarak `http://127.0.0.1:7777/` adresine işaret eder (`package.json` → `debug.env`).

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

## Proje yapısı

```
├── electron/          # Ana süreç ve preload (derleme: dist-electron)
├── public/            # Statik dosyalar
├── src/               # React arayüzü (renderer)
└── release/           # build sonrası kurulum / çıkarılmış uygulama
```

Otomatik güncelleme bileşeni için ayrıntılar: [src/components/update/README.md](src/components/update/README.md).

---

## Teknolojiler

- Electron, Vite, React, TypeScript  
- Tailwind CSS  
- Tesseract.js (plaka OCR)  
- react-router-dom  
- electron-updater (yayın yapılandırmasına bağlı)

---

## Şablon

Proje başlangıçta [electron-vite-react](https://github.com/electron-vite/electron-vite-react) yapısından türetilmiştir; klasör düzeni ve Electron entegrasyonu bu şablona benzer.

---

## Geliştirici

Recep UYSAL
