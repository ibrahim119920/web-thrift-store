// Mengisi database final dengan mengikuti alur aplikasi yang sebenarnya.
//
// Alur yang dijalankan (semuanya lewat endpoint REST API, bukan menulis langsung ke koleksi):
//   1. Admin dibuat langsung di database (registrasi publik hanya menghasilkan "buyer"); 3 user mendaftar lewat /auth/register.
//   2. Tiap user menyimpan alamat pengiriman.
//   3. Admin login, upload foto ke S3 (presigned URL), lalu menambah produk (1-3 foto per produk).
//   4. Pembeli checkout -> membayar (QRIS / transfer bank simulasi + webhook bertanda tangan) -> admin proses, kirim, selesai
//      -> pembeli memberi ulasan. Hasil: 3 produk terjual + ulasan.
//   5. Pembeli checkout lalu membatalkan order -> 2 produk dilepas kembali (tetap tersedia, ada order cancelled).
//
// Hasil akhir: 10 produk (7 available termasuk 2 yang ordernya dibatalkan, 3 sold), 4 akun, 3 alamat.
//
// Pemakaian:  node scripts/final-seed.js [--db <nama database>] [--dir <folder gambar>]
// Syarat    : .env berisi MONGODB_URI (replica set), JWT_SECRET, PAYMENT_SERVER_KEY, serta AWS_REGION, S3_BUCKET_NAME,
//             AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY. Database harus kosong (script berhenti bila sudah ada data).
// API dijalankan di dalam proses ini (port acak), jadi server tidak perlu menyala. Email notifikasi dimatikan.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.EMAIL_NOTIFICATIONS = 'false'; // alamat @wanttosell.id fiktif, jangan kirim email
process.env.PAYMENT_SIMULATION = 'true'; // alur bayar memakai endpoint simulasi + webhook bertanda tangan

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Product, Order, Payment, ShippingAddress, Review, Wishlist } = require('../src/models');
const app = require('../src/app');

const args = { db: null, dir: path.join(__dirname, '..', '..', 'web', 'public', 'images') };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--db') args.db = process.argv[++i];
  else if (process.argv[i] === '--dir') args.dir = path.resolve(process.argv[++i]);
  else throw new Error(`Opsi tidak dikenal: ${process.argv[i]}`);
}

// ---------------------------------------------------------------- data ----
const ADMIN = { name: 'Admin WantToSell', email: 'admin@wanttosell.id', password: 'admin123', phone: '081200000001' };

const USERS = [
  {
    name: 'User Satu', email: 'user1@wanttosell.id', password: 'user123', phone: '081211110001',
    address: { recipientName: 'User Satu', phone: '081211110001', province: 'DI Yogyakarta', city: 'Sleman', district: 'Depok', address: 'Jl. Kaliurang KM 5, Gang Melati No. 12', postalCode: '55281' },
  },
  {
    name: 'User Dua', email: 'user2@wanttosell.id', password: 'user123', phone: '081211110002',
    address: { recipientName: 'User Dua', phone: '081211110002', province: 'Jawa Barat', city: 'Bandung', district: 'Coblong', address: 'Jl. Ir. H. Juanda No. 45, RT 03 RW 05', postalCode: '40132' },
  },
  {
    name: 'User Tiga', email: 'user3@wanttosell.id', password: 'user123', phone: '081211110003',
    address: { recipientName: 'User Tiga', phone: '081211110003', province: 'DKI Jakarta', city: 'Jakarta Selatan', district: 'Kebayoran Baru', address: 'Jl. Senopati No. 8, Apartemen Tower B Lt. 5', postalCode: '12190' },
  },
];

// Nama file di folder images/ -> produk. 1 sampai 3 foto per produk.
const P = (name, category, brand, label, chest, length, grade, description, minusTags, sellerNote, price, weight, files) => ({
  name, category, brand, description,
  size: { label, chest, length },
  condition: { grade, description: grade === 'A' ? 'Sangat baik, nyaris tanpa cacat' : grade === 'B' ? 'Baik, ada tanda pemakaian ringan' : 'Layak pakai, ada beberapa minus', minusTags, sellerNote },
  price, weight, files,
});

const PRODUCTS = {
  // --- akan terjual ---
  kemejaKotak: P('Kemeja Kotak Hijau Lengan Pendek', 'kemeja', 'Ahroony', 'M', 54, 71, 'A', 'Kemeja kotak lengan pendek warna hijau muda dengan saku dada. Bahan adem, cocok untuk santai.', [], 'Kancing lengkap, dicuci bersih sebelum dikirim', 85000, 300, ['191aa.png']),
  jeansWide: P('Celana Jeans Wide Leg Navy', 'celana', 'Uniqlo', '30', 46, 102, 'A', 'Jeans potongan wide leg warna navy gelap, bahan denim tebal dan nyaman.', [], 'Panjang inseam sekitar 76 cm', 195000, 750, ['d8868.png', '6-jeans-png-image.png']),
  blazer: P('Blazer Formal Hitam', 'jas', 'Hugo Boss', 'L', 58, 76, 'B', 'Blazer formal untuk acara kerja atau wisuda. Furing utuh, jahitan rapi.', ['bekas lipatan'], 'Sudah dilaundry, ada bekas lipatan ringan di lengan', 320000, 1100, ['12-suit-png-image.png', '2-suit-png-image.png', '8-suit-png-image.png']),
  // --- tersedia ---
  kaosLayer: P('Kaos Lengan Panjang Layer Navy', 'kaos', 'Tahari Sport', 'M', 52, 66, 'B', 'Kaos lengan panjang model layer dengan lengan bergaris biru muda. Bahan lembut.', ['pilling ringan'], 'Ada sedikit bulu halus di bagian ketiak', 75000, 280, ['a5269.png']),
  tankPuma: P('Tank Top Puma Ungu', 'kaos', 'Puma', 'S', 44, 56, 'B', 'Tank top ungu dengan logo bordir Puma di dada. Bahan stretch, nyaman dipakai sehari-hari.', ['warna sedikit pudar'], 'Karet masih kencang', 60000, 180, ['a6681.png', '191aa.png']),
  cargoShort: P('Celana Cargo Pendek Coklat', 'celana', 'Stage', 'L', 52, 52, 'A', 'Celana cargo pendek coklat dengan karet pinggang dan tali serut, saku samping besar.', [], 'Sangat jarang dipakai', 90000, 450, ['5656c.png', '8-blue-jeans-png-image.png']),
  kemejaBiru: P('Kemeja Formal Biru', 'kemeja', 'Executive', 'L', 56, 74, 'A', 'Kemeja formal lengan panjang warna biru, cocok untuk kerja dan acara resmi.', [], 'Sudah disetrika, siap pakai', 110000, 320, ['1-blue-dress-shirt-png-image.png', '8-blue-dress-shirt-png-image.png', '49-blue-dress-shirt-png-image-400x400.png']),
  kemejaPink: P('Kemeja Formal Pink', 'kemeja', 'Zara Man', 'M', 53, 72, 'B', 'Kemeja formal warna pink lembut dengan kerah tegak. Cocok untuk tampilan smart casual.', ['noda kecil di manset'], 'Noda kecil di manset, kemungkinan hilang bila dilaundry', 95000, 300, ['33-pink-dress-shirt-png-image.png', '9-dress-shirt-png-image.png']),
  // --- tersedia, pernah ada order yang dibatalkan ---
  jeansWanita: P("Celana Jeans Wanita High Waist", 'celana', "Levi's", '28', 40, 98, 'B', "Jeans wanita high waist, warna biru klasik. Potongan pas di pinggang dan nyaman dipakai seharian.", ['luntur di lutut'], 'Tidak ada sobek, warna sedikit luntur di lutut', 175000, 650, ["15-women's-jeans-png-image.png", '10-jeans-png-image.png', '23-jeans-png-image.png']),
  jasBeige: P('Jas Casual Slim Fit', 'jas', 'H&M', 'M', 52, 72, 'A', 'Jas casual slim fit untuk tampilan formal maupun kasual. Bahan tidak mudah kusut.', [], 'Dipakai satu kali untuk acara keluarga', 280000, 1000, ['22207-2-suit.png']),
};

// Alur pembelian. method: qris | bank_transfer.
const SOLD = [
  { user: 0, product: 'kemejaKotak', courier: 'jne', service: 'reg', method: 'qris', tracking: 'JNE1234500001', rating: 5, comment: 'Barang sesuai deskripsi, kondisi mulus dan pengiriman cepat. Recommended seller!' },
  { user: 1, product: 'jeansWide', courier: 'jnt', service: 'reg', method: 'bank_transfer', bank: 'bca', tracking: 'JNT9876500002', rating: 4, comment: 'Jeansnya bagus dan ukuran pas. Packing rapi, cuma sedikit lama di ekspedisi.' },
  { user: 2, product: 'blazer', courier: 'sicepat', service: 'best', method: 'bank_transfer', bank: 'bni', tracking: 'SCP0000300003', rating: 5, comment: 'Blazer kualitas bagus untuk harganya, jahitan rapi. Puas banget!' },
];
const CANCELLED = [
  { user: 0, product: 'jeansWanita', courier: 'jne', service: 'reg' },
  { user: 1, product: 'jasBeige', courier: 'jnt', service: 'express' },
];

// ------------------------------------------------------------- helpers ----
let BASE;
const log = (msg) => console.log(msg);

async function api(method, route, { token, body } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${route} -> ${res.status}: ${json.message || ''} ${json.errors ? JSON.stringify(json.errors) : ''}`);
  }
  return json.data;
}

function sniffType(buf) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new Error('Format gambar harus jpeg/png/webp');
}

// Persis alur admin di frontend: minta presigned URL -> PUT langsung ke S3 -> pakai object key.
async function uploadImage(adminToken, file) {
  const filePath = path.join(args.dir, file);
  if (!fs.existsSync(filePath)) throw new Error(`Gambar tidak ditemukan: ${filePath}`);
  const buf = fs.readFileSync(filePath);
  const up = await api('POST', '/uploads/product-image', { token: adminToken, body: { contentType: sniffType(buf), size: buf.length } });
  const put = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: buf });
  if (!put.ok) throw new Error(`Upload ${file} ke S3 gagal: ${put.status} ${await put.text()}`);
  return up.key;
}

// Webhook simulasi payment gateway (tanda tangan sha512 seperti di routes/payments.js).
async function settle(payment) {
  const grossAmount = String(payment.amount);
  const signature = crypto.createHash('sha512').update(`${payment.transactionId}settlement${grossAmount}${process.env.PAYMENT_SERVER_KEY}`).digest('hex');
  await api('POST', '/payments/webhook', { body: { transactionId: payment.transactionId, transactionStatus: 'settlement', grossAmount, signature } });
}

function checkEnv() {
  const missing = ['MONGODB_URI', 'JWT_SECRET', 'PAYMENT_SERVER_KEY', 'AWS_REGION', 'S3_BUCKET_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Variabel .env belum diisi: ${missing.join(', ')}`);
}

// ---------------------------------------------------------------- main ----
async function main() {
  checkEnv();
  await mongoose.connect(process.env.MONGODB_URI, args.db ? { dbName: args.db } : {});
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  log(`Database: "${mongoose.connection.name}"`);

  const existing = await Promise.all([User, Product, Order, Payment, ShippingAddress, Review, Wishlist].map((m) => m.estimatedDocumentCount()));
  if (existing.some((n) => n > 0)) throw new Error('Database belum kosong. Script ini hanya untuk database kosong, tidak ada yang diubah.');

  const server = app.listen(0);
  BASE = `http://127.0.0.1:${server.address().port}/api`;

  try {
    // 1. Akun. Admin tidak bisa mendaftar lewat API, jadi dibuat langsung di database.
    await User.create({ name: ADMIN.name, email: ADMIN.email, phone: ADMIN.phone, role: 'admin', password: await bcrypt.hash(ADMIN.password, 10) });
    log(`Admin dibuat: ${ADMIN.email}`);

    const users = [];
    for (const u of USERS) {
      const reg = await api('POST', '/auth/register', { body: { name: u.name, email: u.email, password: u.password, phone: u.phone } });
      users.push({ ...u, token: reg.token });
      log(`User terdaftar: ${u.email}`);
    }

    // 2. Alamat pengiriman.
    for (const u of users) {
      u.addressId = (await api('POST', '/shipping-addresses', { token: u.token, body: u.address }))._id;
      log(`Alamat disimpan: ${u.email} (${u.address.city})`);
    }

    // 3. Admin menambah produk.
    const admin = await api('POST', '/auth/login', { body: { email: ADMIN.email, password: ADMIN.password } });
    const products = {};
    for (const [id, p] of Object.entries(PRODUCTS)) {
      const { files, ...payload } = p;
      const images = [];
      for (const f of files) images.push(await uploadImage(admin.token, f));
      products[id] = await api('POST', '/products', { token: admin.token, body: { ...payload, images } });
      log(`Produk ditambahkan: ${p.name} (${files.length} foto)`);
    }

    // 4. Pembelian sampai selesai + ulasan.
    for (const s of SOLD) {
      const u = users[s.user];
      const product = products[s.product];
      const order = await api('POST', '/orders', {
        token: u.token,
        body: { productIds: [product._id], shippingAddressId: u.addressId, courier: s.courier, service: s.service, confirmUsedItem: true },
      });
      const payment = await api('POST', `/orders/${order._id}/payments/${s.method === 'qris' ? 'qris' : 'bank-transfer'}`, {
        token: u.token,
        body: s.method === 'qris' ? {} : { bank: s.bank },
      });
      await settle(payment);
      for (const step of [{ status: 'processing' }, { status: 'shipped', trackingNumber: s.tracking }, { status: 'completed' }]) {
        await api('PATCH', `/admin/orders/${order._id}/status`, { token: admin.token, body: step });
      }
      await api('POST', `/products/${product._id}/reviews`, { token: u.token, body: { orderId: order._id, rating: s.rating, comment: s.comment } });
      log(`Terjual: ${product.name} -> ${u.email} (${order.orderNumber}), rating ${s.rating}`);
    }

    // 5. Order dibatalkan pembeli; produk kembali tersedia.
    for (const c of CANCELLED) {
      const u = users[c.user];
      const product = products[c.product];
      const order = await api('POST', '/orders', {
        token: u.token,
        body: { productIds: [product._id], shippingAddressId: u.addressId, courier: c.courier, service: c.service, confirmUsedItem: true },
      });
      await api('POST', `/orders/${order._id}/cancel`, { token: u.token });
      log(`Order dibatalkan: ${product.name} oleh ${u.email} (${order.orderNumber})`);
    }

    // Ringkasan + verifikasi.
    const [available, sold, cancelledOrders, reviews] = await Promise.all([
      Product.countDocuments({ status: 'available' }),
      Product.countDocuments({ status: 'sold' }),
      Order.countDocuments({ status: 'cancelled' }),
      Review.countDocuments(),
    ]);
    log(`\nSelesai. Produk available: ${available}, sold: ${sold}, order cancelled: ${cancelledOrders}, ulasan: ${reviews}`);
    if (available < 7 || sold !== 3 || cancelledOrders !== 2 || reviews !== 3) throw new Error('Hasil akhir tidak sesuai target (>=7 available, 3 sold, 2 cancelled, 3 ulasan)');
  } finally {
    server.close();
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (e) => {
    console.error('Gagal:', e.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
