# WantToSell

WantToSell adalah platform web untuk penjualan pakaian thrift dengan sistem stok unik, transaksi pembelian, dan pengelolaan produk.

## Kelompok 20

1. Aqidatul Izzah (24/533730/TK/59137)
2. Muhammad Ilkham Abdillah (24/537977/TK/59653)
3. Muhammad Syauqi Fittuqo (24/543713/TK/60433)
4. Ahmad Maulana Ibrahim (24/539655/TK/59853)

## Menjalankan backend

Backend menggunakan Node.js, Express, dan MongoDB. Jalankan semua perintah berikut dari direktori root repository.

1. Siapkan konfigurasi lokal dengan menyalin `.env.example` menjadi `.env` (`Copy-Item .env.example .env` di PowerShell, atau `cp .env.example .env` di macOS/Linux). Isi `JWT_SECRET` dengan secret acak yang panjang dan ubah `PAYMENT_SERVER_KEY` bila diperlukan.
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

Jalankan perintah ini dari root repository setelah MongoDB aktif dan `.env` tersedia:

```bash
npm run seed
```

Seed menyediakan satu admin, dua pembeli, dan 12 produk. Akun admin: `admin@wanttosell.test` / `Admin123!`. Akun pembeli: `buyer1@wanttosell.test` dan `buyer2@wanttosell.test`, keduanya menggunakan password `Buyer123!`.

### Pengujian API via Postman/Newman

Koleksi `postman/WantToSell.postman_collection.json` berisi sembilan kelompok pengujian API. Jalankan seed sebelum pengujian agar akun dan katalog awal tersedia. Biarkan server berjalan di satu terminal, lalu jalankan dari terminal lain di root repository. `npm test` menjalankan koleksi API dan uji integritas:

```bash
npm test
```

Koleksi API dijalankan melalui Newman dan menyimpan rincian request, response, serta assertion ke `postman/newman-result.json`. Untuk menjalankan hanya koleksi API, gunakan `npm run test:api`. Untuk mengimpor koleksi ke aplikasi Postman, gunakan URL dasar `http://localhost:5000/api`. Jika `PAYMENT_SERVER_KEY` di `.env` berbeda dari nilai contoh, tambahkan variabel environment Postman bernama `PAYMENT_SERVER_KEY` dengan nilai yang sama.

Jalankan uji race condition dan kedaluwarsa dari terminal lain saat server dan MongoDB yang sama masih aktif:

```bash
npm run test:integrity
```

Uji integritas membutuhkan data seed, membuat order dan alamat pengujian, lalu mengubah waktu kedaluwarsa order. Hasilnya disimpan ke `postman/integrity-result.json`; jalankan terhadap database pengujian karena data order pengujian dapat tertinggal.

### Konfigurasi dan catatan

- Variabel utama ada di `.env.example`: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PAYMENT_SERVER_KEY`, dan `ORDER_EXPIRY_MINUTES`.
- Order menggunakan transaksi MongoDB, sehingga MongoDB dijalankan sebagai replica set melalui Docker Compose.
- Pembayaran QRIS/VA dan webhook disimulasikan dengan pola Midtrans sandbox; backend belum terhubung ke Midtrans sungguhan.
- Login Google belum diimplementasikan. Registrasi publik selalu membuat akun buyer; akun admin dibuat melalui seed.
