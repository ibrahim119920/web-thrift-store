# Midtrans QRIS Sandbox Simulator

Alat bantu testing lokal untuk mensimulasikan pembayaran QRIS di **Midtrans Sandbox** memakai simulator resmi Midtrans:

<https://simulator.sandbox.midtrans.com/v2/qris/index>

Aplikasi ini **bukan** bagian dari storefront dan tidak menyentuh database, API key, atau file di luar folder ini. Semua dependency adalah bawaan Node.js >= 18 dan browser (tanpa `npm install`).

---

## Menjalankan

```bash
node tools/midtrans-qris-sim/server.js
```

Buka <http://localhost:4321>.

Ganti port bila perlu:

```bash
# Windows PowerShell
$env:PORT=4322; node tools/midtrans-qris-sim/server.js

# macOS/Linux
PORT=4322 node tools/midtrans-qris-sim/server.js
```

Tidak ada build step. File `public/` disajikan apa adanya.

---

## Alur pakai

1. **Buat transaksi QRIS sandbox** di backend storefront (Core API). Respons Midtrans berisi `actions[]` dengan URL `generate-qr-code`, misalnya:
   `https://api.sandbox.midtrans.com/v2/qris/5f2c.../qr-code`.
2. **Ambil QR kecil** yang ditampilkan storefront khusus mode sandbox (QR berisi URL di atas), atau salin URL/UUID-nya.
3. Di halaman ini, pilih salah satu:
   - **Kamera** — klik `Mulai kamera`, arahkan ke QR kecil. Butuh `localhost`/HTTPS dan browser dengan `BarcodeDetector` (Chrome/Edge).
   - **Unggah gambar QR** — screenshot QR kecil tersebut.
   - **Paste** — tempel URL lengkap atau UUID saja ke kolom input, lalu `Scan QR`.
4. Server menjalankan **langkah 1 simulator** (`POST /v2/qris/payment` dengan `qrCodeUrl`) dan menampilkan merchant, nominal, acquirer, status, serta ringkasan teks simulator.
   - Jika simulator menyediakan **field nominal kosong**, isi nominal di langkah 3.
   - Jika nominal sudah ditentukan transaksi, nilainya read-only.
5. Pilih **issuer** (`gopay` default, `dana`, `ovo`, `linkaja`, `airpay shopee`), klik **Bayar**.
6. Server menjalankan **langkah 2 simulator** dan menampilkan status akhir `PAID` / gagal beserta pesan aslinya. Percobaan tercatat di riwayat halaman (memori saja).

### Contoh input yang diterima

| Input | Hasil |
| --- | --- |
| `11111111-1111-4111-8111-111111111111` | Dinormalisasi menjadi `https://api.sandbox.midtrans.com/v2/qris/11111111-1111-4111-8111-111111111111/qr-code` |
| `https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code` | Diterima apa adanya (dinormalisasi ke host/path kanonik) |
| `https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code?foo=1` | Diterima; query dibuang saat normalisasi |
| `00020101021226...6304ABCD` (payload QRIS EMV) | Dibaca merchant/kota/nominal saja; **tidak bisa dibayar** karena tidak memuat UUID |
| `https://example.com/...`, `http://...`, domain lain | Ditolak `400` |
| Teks acak | Ditolak dengan pesan jelas |

---

## Klasifikasi QR

| Jenis QR | Isi | Perilaku aplikasi |
| --- | --- | --- |
| **QR kecil dari storefront (sandbox)** | URL `https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code` | URL terisi otomatis → scan simulator → bayar. Jalur penuh. |
| **Gambar QRIS** (EMVCo) | String `000201...` berisi merchant, kota, nominal, CRC | Hanya menampilkan merchant/kota/nominal. **Tidak ada URL/UUID transaksi di dalamnya**, jadi pengguna diminta menempel URL/UUID. |
| QR/URL lain | — | Ditolak dengan pesan, tidak crash. |

> Midtrans mewajibkan **QR Code Image URL** (bukan payload QRIS) sebagai input simulator. UUID transaksi tidak bisa ditebak dari payload EMVCo; jangan mencoba mengubah payload menjadi URL.

---

## API lokal

Semua panggilan ke simulator lewat server ini karena `simulator.sandbox.midtrans.com` tidak mengirim header CORS.

### `POST /api/scan`

Body:

```json
{ "qr": "https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code" }
```

Server mem-POST `qrCodeUrl` ke langkah 1 simulator, lalu mengembalikan:

```json
{
  "ok": true,
  "input": { "uuid": "...", "qrCodeUrl": "https://api.sandbox.midtrans.com/v2/qris/.../qr-code" },
  "action": "https://simulator.sandbox.midtrans.com/v2/qris/...",
  "method": "POST",
  "fields": { "referenceId": "...", "exploreData": "..." },
  "amountField": "amount",
  "needsAmount": true,
  "amount": null,
  "suggestedAmount": "36000",
  "currency": "IDR",
  "merchant": "Sayurbox",
  "acquirer": "gopay",
  "referenceId": "...",
  "statusText": null,
  "summary": "teks yang terlihat di halaman simulator"
}
```

`fields` adalah field form langkah 2 yang benar-benar ada di HTML simulator. Tidak ada field yang dikarang.
Nominal diambil dari field nominal pada form bila ada; jika tidak, dari JSON `exploreData`; terakhir dari teks halaman.

### `POST /api/pay`

Body:

```json
{
  "action": "https://simulator.sandbox.midtrans.com/v2/qris/...",
  "fields": { "referenceId": "...", "exploreData": "..." },
  "issuer": "gopay",
  "amount": "25000"
}
```

- `issuer` wajib salah satu dari `gopay`, `dana`, `ovo`, `linkaja`, `airpay shopee`.
- `amount` hanya dikirim bila form simulator punya field nominal (`amount`, `gross_amount`, `total_amount`, `nominal`, `transaction_amount`). Bila tidak ada field tersebut, server menolak nominal agar tidak mengarang field.
- Server selalu menambahkan `issuer` ke form.

Respons:

```json
{
  "ok": true,
  "status": "paid",
  "paid": true,
  "message": "pesan asli simulator",
  "summary": "teks halaman hasil"
}
```

`status` bisa `paid`, `failed`, atau `unknown`.

---

## Keamanan dan validasi

- Hanya `https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code` (atau UUID polos) yang diterima sebagai input QR.
- `action` langkah 2 wajib host `simulator.sandbox.midtrans.com` dan path `/v2/qris/...`; selain itu ditolak.
- Body permintaan maksimal **32 KB**; timeout simulator **20 detik**.
- Field form dibatasi jumlah, nama, dan panjang nilainya.
- Tidak ada server key/client key, tidak ada cookie, tidak ada state di disk. State form hanya dikembalikan ke klien karena ini sandbox.
- HTML simulator tidak pernah dikirim mentah ke browser; server hanya mengirim teks yang sudah diekstrak dan di-escape lewat JSON.

---

## Batasan

- **Hanya sandbox.** Domain produksi dan `*.midtrans.com` lain ditolak.
- **Berbasis scraping HTML** simulator resmi. Jika Midtrans mengubah markup, `parseForms`/`extractPageText` bisa rusak dan perlu disesuaikan.
- Simulator bisa menolak QR yang sudah dibayar, kedaluwarsa, atau tidak valid. Pesan simulator diteruskan apa adanya.
- `BarcodeDetector` tidak tersedia di Firefox/Safari; gunakan unggah gambar atau paste. Tidak ada library QR tambahan (tetap zero dependency).
- Kamera hanya berjalan di `localhost` atau HTTPS.
- Riwayat pembayaran hanya di memori halaman dan hilang setelah reload.
- Deteksi status `PAID`/gagal dilakukan dari teks halaman (kata kunci `PAID`, `success`, `Transaction failed to be processed`, dll). Bila simulator mengganti diksi, status bisa menjadi `unknown` — teks aslinya tetap ditampilkan.

---

## Troubleshooting

| Masalah | Solusi |
| --- | --- |
| `Port 4321 sudah dipakai` | Jalankan dengan `PORT=4322` (PowerShell: `$env:PORT=4322`). |
| Tombol kamera tidak jalan | Pastikan membuka `http://localhost:4321` (bukan IP LAN), browser Chrome/Edge, dan izin kamera diizinkan. |
| "Simulator tidak dapat membaca QR" | Transaksi mungkin sudah dibayar/kedaluwarsa, atau URL bukan dari respons QRIS Core API. Buat transaksi baru. |
| "Form simulator tidak memiliki field nominal" | Nominal sudah ditentukan transaksi; biarkan kosong. |
| Status `TIDAK DIKENALI` | Buka "Teks respons simulator"; kemungkinan markup simulator berubah. |

---

## Struktur

```text
tools/midtrans-qris-sim/
├── server.js          # HTTP server + proxy simulator + validasi
├── public/
│   ├── index.html     # UI satu halaman
│   ├── app.js         # scan kamera/unggah/paste, klasifikasi, bayar, riwayat
│   └── style.css
└── README.md
```
