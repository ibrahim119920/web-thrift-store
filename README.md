# WantToSell

WantToSell adalah platform web untuk penjualan pakaian thrift dengan sistem stok unik, transaksi pembelian, dan pengelolaan produk.

## Kelompok 20

1. Aqidatul Izzah (24/533730/TK/59137)
2. Muhammad Ilkham Abdillah (24/537977/TK/59653)
3. Muhammad Syauqi Fittuqo (24/543713/TK/60433)
4. Ahmad Maulana Ibrahim (24/539655/TK/59853)

## Struktur Direktori dan File

Repository ini adalah monorepo **npm workspaces** (JavaScript, CommonJS).

```
web-thrift-store/
├── apps/
│   ├── api/                                     # Backend Express.js (workspace "api")
│   │   ├── src/
│   │   │   ├── middlewares/                     # Middleware (auth, validasi, error handler)
│   │   │   ├── models/                          # Model schema Mongoose
│   │   │   ├── routes/                          # Definisi endpoint API
│   │   │   ├── services/                        # Service layer (logika bisnis)
│   │   │   ├── utils/                           # Helper functions
│   │   │   ├── app.js                           # Konfigurasi Express
│   │   │   └── server.js                        # Entry point server
│   │   ├── scripts/
│   │   │   ├── seed.js                          # Data awal database
│   │   │   ├── build-collection.js              # Generator koleksi Postman
│   │   │   ├── run-tests.js                     # Menjalankan koleksi API via Newman
│   │   │   └── integrity-test.js                # Uji race condition & kedaluwarsa order
│   │   ├── postman/                             # Koleksi Postman + laporan hasil Newman
│   │   ├── .env.example                         # Template variabel environment backend
│   │   └── package.json                         # Dependensi dan script backend
│   └── web/                                     # Frontend React + Vite + TypeScript (workspace "web")
│       ├── src/components/                      # UI (ui, layout, auth, product, review)
│       ├── src/pages/                           # Halaman (public, buyer, admin)
│       ├── src/context/                         # Auth & Cart context
│       ├── src/routes/                          # Router & route guard
│       ├── src/services/                        # Klien API + data mock
│       ├── src/lib/ , src/types/                # Konstanta, util, tipe
│       └── .env.example                         # VITE_USE_MOCK, VITE_API_BASE_URL
├── packages/
│   └── shared/                                  # Kode bersama (workspace "@wanttosell/shared")
├── docker-compose.yml                           # MongoDB replica set untuk development
├── package.json                                 # Root workspace + script pintasan
├── package-lock.json
└── README.md
```

## Menjalankan frontend

Frontend memakai React + Vite. Dari root repository:

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # sekali saja
npm run dev:web                                # http://localhost:5173
```

Default `VITE_USE_MOCK=true` sehingga frontend jalan tanpa backend. Untuk memakai API asli, set `VITE_USE_MOCK=false`, nyalakan backend (`npm run dev`), dan request `/api` akan diteruskan Vite ke `http://localhost:5000`.

## Menjalankan backend

Backend menggunakan Node.js, Express, dan MongoDB. Semua perintah `npm` di bawah dijalankan dari direktori root repository; root `package.json` meneruskannya ke workspace `api`.

1. Siapkan konfigurasi lokal dengan menyalin `apps/api/.env.example` menjadi `apps/api/.env` (`Copy-Item apps/api/.env.example apps/api/.env` di PowerShell, atau `cp apps/api/.env.example apps/api/.env` di macOS/Linux). Isi `JWT_SECRET` dengan secret acak yang panjang dan ubah `PAYMENT_SERVER_KEY` bila diperlukan.
2. Jalankan MongoDB replica set satu node:

   ```bash
   docker compose up -d
   ```

3. Pasang dependency dan jalankan server:

   ```bash
   npm install
   npm start
   ```

Server berjalan di `http://localhost:5000`; pemeriksaan kesehatan tersedia di `http://localhost:5000/api/health`. Untuk mode pengembangan dengan restart otomatis, jalankan `npm run dev` dari root repository.

### Data awal

> **Peringatan:** `npm run seed` menghapus isi seluruh koleksi aplikasi yang ada (`users`, `products`, `orders`, `payments`, `wishlists`, `reviews`, dan `shipping_addresses`) sebelum memasukkan data awal. Jalankan hanya jika penghapusan data tersebut memang diinginkan.

Jalankan perintah ini dari root repository setelah MongoDB aktif dan `apps/api/.env` tersedia:

```bash
npm run seed
```

Seed menyediakan satu admin, dua pembeli, dan 12 produk. Akun admin: `admin@wanttosell.test` / `Admin123!`. Akun pembeli: `buyer1@wanttosell.test` dan `buyer2@wanttosell.test`, keduanya menggunakan password `Buyer123!`.

### Pengujian API via Postman/Newman

Koleksi `apps/api/postman/WantToSell.postman_collection.json` berisi sembilan kelompok pengujian API. Jalankan seed sebelum pengujian agar akun dan katalog awal tersedia. Biarkan server berjalan di satu terminal, lalu jalankan dari terminal lain di root repository. `npm test` menjalankan koleksi API dan uji integritas:

```bash
npm test
```

Koleksi API dijalankan melalui Newman dan menyimpan rincian request, response, serta assertion ke `apps/api/postman/newman-result.json`. Untuk menjalankan hanya koleksi API, gunakan `npm run test:api`. Untuk mengimpor koleksi ke aplikasi Postman, gunakan URL dasar `http://localhost:5000/api`. Jika `PAYMENT_SERVER_KEY` di `apps/api/.env` berbeda dari nilai contoh, tambahkan variabel environment Postman bernama `PAYMENT_SERVER_KEY` dengan nilai yang sama.

Jalankan uji race condition dan kedaluwarsa dari terminal lain saat server dan MongoDB yang sama masih aktif:

```bash
npm run test:integrity
```

Uji integritas membutuhkan data seed, membuat order dan alamat pengujian, lalu mengubah waktu kedaluwarsa order. Hasilnya disimpan ke `apps/api/postman/integrity-result.json`; jalankan terhadap database pengujian karena data order pengujian dapat tertinggal.

### Konfigurasi dan catatan

- Variabel utama ada di `apps/api/.env.example`: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PAYMENT_SERVER_KEY`, dan `ORDER_EXPIRY_MINUTES`.
- Order menggunakan transaksi MongoDB, sehingga MongoDB dijalankan sebagai replica set melalui Docker Compose.
- Pembayaran QRIS/VA dan webhook disimulasikan dengan pola Midtrans sandbox; backend belum terhubung ke Midtrans sungguhan.
- Login Google belum diimplementasikan. Registrasi publik selalu membuat akun buyer; akun admin dibuat melalui seed.

## Google Drive Link  
https://drive.google.com/drive/...
