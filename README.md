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

### Konfigurasi dan catatan

- Variabel utama ada di `.env.example`: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PAYMENT_SERVER_KEY`, dan `ORDER_EXPIRY_MINUTES`.
- Order menggunakan transaksi MongoDB, sehingga MongoDB dijalankan sebagai replica set melalui Docker Compose.
- Pembayaran QRIS/VA dan webhook disimulasikan dengan pola Midtrans sandbox; backend belum terhubung ke Midtrans sungguhan.
- Login Google belum diimplementasikan. Registrasi publik selalu membuat akun buyer; akun admin dibuat melalui seed.
