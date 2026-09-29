// Membangun koleksi Postman (v2.1) dari definisi di bawah. Jalankan: npm run build:collection
// Hasil: postman/WantToSell.postman_collection.json -> bisa di-import ke aplikasi Postman, atau dijalankan dengan Newman.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

const T = (name, body) => `pm.test(${JSON.stringify(name)}, function () {\n${body}\n});`;
const status = (code) => T(`Status code ${code}`, `  pm.response.to.have.status(${code});`);
const json = 'const j = pm.response.json();';
const save = (varName, expr) => `pm.collectionVariables.set(${JSON.stringify(varName)}, ${expr});`;

function makeUrl(raw) {
  const [p, qs] = raw.replace('{{baseUrl}}', '').split('?');
  return {
    raw,
    host: ['{{baseUrl}}'],
    path: p.split('/').filter(Boolean),
    ...(qs && { query: qs.split('&').map((kv) => { const [key, value] = kv.split('='); return { key, value }; }) }),
  };
}

function req(name, method, url, { access, fn, auth, body, tests = [], pre = [] } = {}) {
  const header = [];
  if (auth) header.push({ key: 'Authorization', value: `Bearer {{${auth}}}` });
  if (body) header.push({ key: 'Content-Type', value: 'application/json' });
  const event = [];
  if (pre.length) event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre.join('\n').split('\n') } });
  if (tests.length) event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests.join('\n').split('\n') } });
  return {
    name,
    event,
    request: {
      method,
      header,
      ...(body && { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } }),
      url: makeUrl(`{{baseUrl}}${url}`),
      description: `Hak Akses: ${access} | Fungsi: ${fn}`,
    },
  };
}

const images = (slug) => ['depan', 'belakang', 'samping', 'detail'].map((a) => `https://placehold.co/600x800?text=${slug}-${a}`);
const productBody = (name, category, chest, length, price) => ({
  name,
  description: `${name} preloved`,
  category,
  brand: 'TestBrand',
  size: { label: 'L', chest, length },
  condition: { grade: 'B', description: 'Ada noda kecil di lengan', minusTags: ['noda kecil'], sellerNote: 'Bisa dicek via foto detail' },
  price,
  images: images(encodeURIComponent(name)),
  weight: 600,
});
const webhook = (txVar, statusName, amountVar = 'payAmount', tamper = false) => ({
  pre: [
    `const tx = pm.collectionVariables.get(${JSON.stringify(txVar)});`,
    `const amount = pm.collectionVariables.get(${JSON.stringify(amountVar)});`,
    `const key = pm.environment.get('PAYMENT_SERVER_KEY') || pm.collectionVariables.get('paymentServerKey');`,
    `const sig = ${tamper ? "'deadbeef'" : `CryptoJS.SHA512(tx + ${JSON.stringify(statusName)} + amount + key).toString(CryptoJS.enc.Hex)`};`,
    `pm.collectionVariables.set('sig', sig);`,
    `pm.collectionVariables.set('curTx', tx);`,
  ],
  body: { transactionId: '{{curTx}}', transactionStatus: statusName, grossAmount: `{{${amountVar}}}`, signature: '{{sig}}' },
});

const buyerAddress = { recipientName: 'Pembeli Satu', phone: '081234567890', province: 'Jawa Barat', city: 'Bandung', district: 'Coblong', address: 'Jl. Ganesha No. 10', postalCode: '40132' };
const checkout = (productVar, extra = {}) => ({
  productIds: [`{{${productVar}}}`],
  shippingAddressId: '{{addressId}}',
  courier: 'jne',
  service: 'reg',
  confirmUsedItem: true,
  ...extra,
});

const items = [
  {
    name: '1. Autentikasi',
    item: [
      req('POST /api/auth/register', 'POST', '/auth/register', {
        access: 'Publik', fn: 'Pendaftaran akun pembeli baru dengan enkripsi kata sandi bcrypt.',
        body: { name: 'Pembeli Baru', email: 'pembeli.{{$timestamp}}@gmail.com', password: 'Pembeli123!', phone: '081234567800', role: 'admin' },
        tests: [status(201), T('Role dipaksa "buyer" walau klien mengirim role admin (anti privilege escalation)', `  ${json}\n  pm.expect(j.data.role).to.eql('buyer');\n  pm.expect(j.data.token).to.be.a('string');\n  pm.expect(j.data).to.not.have.property('password');`), save('newBuyerEmail', 'pm.response.json().data.email')],
      }),
      req('POST /api/auth/register (email duplikat)', 'POST', '/auth/register', {
        access: 'Publik', fn: 'Menolak registrasi dengan email yang sudah terdaftar.',
        body: { name: 'Pembeli Satu', email: 'buyer1@wanttosell.test', password: 'Buyer123!' },
        tests: [status(409)],
      }),
      req('POST /api/auth/register (validasi gagal)', 'POST', '/auth/register', {
        access: 'Publik', fn: 'Validasi input: email tidak valid dan kata sandi kurang dari 6 karakter.',
        body: { name: 'X', email: 'bukan-email', password: '123' },
        tests: [status(400), T('Berisi daftar error per field', `  ${json}\n  pm.expect(j.errors.length).to.be.at.least(2);`)],
      }),
      req('POST /api/auth/login (admin)', 'POST', '/auth/login', {
        access: 'Publik', fn: 'Otentikasi Admin dan penerbitan JSON Web Token (JWT).',
        body: { email: 'admin@wanttosell.test', password: 'Admin123!' },
        tests: [status(200), T('Token & role admin', `  ${json}\n  pm.expect(j.data.role).to.eql('admin');`), save('adminToken', 'pm.response.json().data.token')],
      }),
      req('POST /api/auth/login (pembeli 1)', 'POST', '/auth/login', {
        access: 'Publik', fn: 'Otentikasi pembeli dan penerbitan JWT.',
        body: { email: 'buyer1@wanttosell.test', password: 'Buyer123!' },
        tests: [status(200), save('buyer1Token', 'pm.response.json().data.token'), save('buyer1Id', 'pm.response.json().data._id')],
      }),
      req('POST /api/auth/login (pembeli 2)', 'POST', '/auth/login', {
        access: 'Publik', fn: 'Otentikasi pembeli kedua (dipakai untuk uji otorisasi dan rebutan barang).',
        body: { email: 'buyer2@wanttosell.test', password: 'Buyer123!' },
        tests: [status(200), save('buyer2Token', 'pm.response.json().data.token')],
      }),
      req('POST /api/auth/login (kata sandi salah)', 'POST', '/auth/login', {
        access: 'Publik', fn: 'Menolak login dengan kata sandi salah.',
        body: { email: 'buyer1@wanttosell.test', password: 'salah-total' },
        tests: [status(401)],
      }),
      req('GET /api/auth/me', 'GET', '/auth/me', {
        access: 'Private (Header Bearer Token)', fn: 'Validasi token JWT dan pengambilan profil aktif.', auth: 'buyer1Token',
        tests: [status(200), T('Profil sesuai', `  ${json}\n  pm.expect(j.data.email).to.eql('buyer1@wanttosell.test');`)],
      }),
      req('GET /api/auth/me (tanpa token)', 'GET', '/auth/me', {
        access: 'Private (Header Bearer Token)', fn: 'Menolak akses tanpa token.',
        tests: [status(401)],
      }),
    ],
  },
  {
    name: '2. Produk (Admin & Katalog)',
    item: [
      req('POST /api/products (Admin, produk A)', 'POST', '/products', {
        access: 'Private (Bearer Token Admin)', fn: 'Admin menambah barang unik (1 barang = 1 dokumen) dengan 4 foto, ukuran cm, dan dokumentasi cacat.', auth: 'adminToken',
        body: productBody('Kemeja Uji Coba A', 'kemeja', 55, 72, 100000),
        tests: [status(201), T('Status awal available, ada minus tags & catatan penjual', `  ${json}\n  pm.expect(j.data.status).to.eql('available');\n  pm.expect(j.data.images).to.have.lengthOf(4);\n  pm.expect(j.data.condition.minusTags).to.eql(['noda kecil']);`), save('productA', 'pm.response.json().data._id')],
      }),
      req('POST /api/products (Admin, produk B)', 'POST', '/products', {
        access: 'Private (Bearer Token Admin)', fn: 'Menambah produk B (dipakai untuk skenario pembatalan & pembayaran kedaluwarsa).', auth: 'adminToken',
        body: productBody('Jaket Uji Coba B', 'jaket', 60, 68, 250000),
        tests: [status(201), save('productB', 'pm.response.json().data._id')],
      }),
      req('POST /api/products (Admin, produk C)', 'POST', '/products', {
        access: 'Private (Bearer Token Admin)', fn: 'Menambah produk C (dipakai untuk uji ulasan sebelum order selesai).', auth: 'adminToken',
        body: productBody('Kaos Uji Coba C', 'kaos', 50, 68, 60000),
        tests: [status(201), save('productC', 'pm.response.json().data._id')],
      }),
      req('POST /api/products (hanya 3 foto)', 'POST', '/products', {
        access: 'Private (Bearer Token Admin)', fn: 'Validasi galeri 4 sudut: menolak produk dengan foto selain 4.', auth: 'adminToken',
        body: { ...productBody('Produk Tiga Foto', 'kaos', 50, 68, 1000), images: images('x').slice(0, 3) },
        tests: [status(400)],
      }),
      req('POST /api/products (sebagai pembeli)', 'POST', '/products', {
        access: 'Private (Bearer Token Admin)', fn: 'Otorisasi RBAC: pembeli tidak boleh membuat produk.', auth: 'buyer1Token',
        body: productBody('Produk Ilegal', 'kaos', 50, 68, 1000),
        tests: [status(403)],
      }),
      req('GET /api/products?category=kemeja&sort=price_asc', 'GET', '/products?category=kemeja&sort=price_asc', {
        access: 'Publik', fn: 'Pencarian berdasarkan kategori dengan urutan harga termurah.',
        tests: [status(200), T('Semua kategori kemeja, available, harga terurut naik', `  ${json}\n  pm.expect(j.data.length).to.be.at.least(3);\n  j.data.forEach(p => { pm.expect(p.category).to.eql('kemeja'); pm.expect(p.status).to.eql('available'); });\n  const prices = j.data.map(p => p.price);\n  pm.expect(prices).to.eql([...prices].sort((a, b) => a - b));`)],
      }),
      req('GET /api/products?chestMin=55&chestMax=58&lengthMin=70&sort=chest_asc', 'GET', '/products?chestMin=55&chestMax=58&lengthMin=70&sort=chest_asc', {
        access: 'Publik', fn: 'Filter ukuran presisi dalam cm (lebar dada 55-58, panjang min 70).',
        tests: [status(200), T('Semua hasil berada di rentang ukuran', `  ${json}\n  pm.expect(j.data.length).to.be.at.least(1);\n  j.data.forEach(p => { pm.expect(p.size.chest).to.be.within(55, 58); pm.expect(p.size.length).to.be.at.least(70); });`)],
      }),
      req('GET /api/products?page=2&limit=5', 'GET', '/products?page=2&limit=5', {
        access: 'Publik', fn: 'Pagination katalog.',
        tests: [status(200), T('Metadata paging benar', `  ${json}\n  pm.expect(j.pagination.currentPage).to.eql(2);\n  pm.expect(j.pagination.limit).to.eql(5);\n  pm.expect(j.data.length).to.be.at.most(5);`)],
      }),
      req('GET /api/products/{id}', 'GET', '/products/{{productA}}', {
        access: 'Publik', fn: 'Detail produk termasuk defect documentation dan ringkasan ulasan.',
        tests: [status(200), T('Berisi kondisi & ringkasan ulasan', `  ${json}\n  pm.expect(j.data.condition.grade).to.eql('B');\n  pm.expect(j.data.reviewSummary.totalReviews).to.eql(0);`)],
      }),
      req('PUT /api/products/{id}', 'PUT', '/products/{{productA}}', {
        access: 'Private (Bearer Token Admin)', fn: 'Admin memperbarui harga dan catatan penjual.', auth: 'adminToken',
        body: { price: 95000, condition: { grade: 'B', description: 'Ada noda kecil di lengan', minusTags: ['noda kecil'], sellerNote: 'Harga turun, siap kirim' } },
        tests: [status(200), T('Harga berubah', `  ${json}\n  pm.expect(j.data.price).to.eql(95000);`)],
      }),
    ],
  },
  {
    name: '3. Favorit (Wishlist)',
    item: [
      req('POST /api/favorites', 'POST', '/favorites', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli menyimpan produk ke daftar favorit.', auth: 'buyer1Token', body: { productId: '{{productA}}' },
        tests: [status(201)],
      }),
      req('POST /api/favorites (duplikat)', 'POST', '/favorites', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Unique index { userId, productId } menolak favorit ganda.', auth: 'buyer1Token', body: { productId: '{{productA}}' },
        tests: [status(409)],
      }),
      req('GET /api/favorites', 'GET', '/favorites', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Melihat daftar favorit beserta detail produk.', auth: 'buyer1Token',
        tests: [status(200), T('Berisi produk A ter-populate', `  ${json}\n  pm.expect(j.count).to.eql(1);\n  pm.expect(j.data[0].productId.name).to.eql('Kemeja Uji Coba A');`)],
      }),
      req('DELETE /api/favorites/{productId}', 'DELETE', '/favorites/{{productA}}', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Menghapus produk dari favorit.', auth: 'buyer1Token',
        tests: [status(200)],
      }),
    ],
  },
  {
    name: '4. Alamat & Ongkir',
    item: [
      req('POST /api/shipping-addresses', 'POST', '/shipping-addresses', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli menyimpan alamat pengiriman.', auth: 'buyer1Token', body: buyerAddress,
        tests: [status(201), save('addressId', 'pm.response.json().data._id')],
      }),
      req('POST /api/shipping-addresses (kode pos salah)', 'POST', '/shipping-addresses', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Validasi kode pos 5 digit.', auth: 'buyer1Token', body: { ...buyerAddress, postalCode: '12' },
        tests: [status(400)],
      }),
      req('POST /api/shipping-addresses (pembeli 2)', 'POST', '/shipping-addresses', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli 2 menyimpan alamat (alamat pembeli lain tidak dapat dipakai).', auth: 'buyer2Token', body: { ...buyerAddress, recipientName: 'Pembeli Dua', province: 'Kalimantan Timur', city: 'Balikpapan', district: 'Balikpapan Kota', postalCode: '76111' },
        tests: [status(201), save('address2Id', 'pm.response.json().data._id')],
      }),
      req('POST /api/shipping/estimate', 'POST', '/shipping/estimate', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Backend menghitung ongkir otomatis (asal DI Yogyakarta, tujuan Jawa Barat, JNE REG, 600 g).', auth: 'buyer1Token',
        body: { shippingAddressId: '{{addressId}}', courier: 'jne', service: 'reg', productIds: ['{{productA}}'] },
        tests: [status(200), T('Ongkir = (9000 + 2500 x 1kg) x 1.5 = 17.500', `  ${json}\n  pm.expect(j.data.shippingCost).to.eql(17500);`), save('expectedShipping', 'pm.response.json().data.shippingCost')],
      }),
    ],
  },
  {
    name: '5. Checkout & Anti Double Purchase',
    item: [
      req('POST /api/orders (tanpa konfirmasi barang bekas)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Fitur 6: checkout ditolak bila pembeli belum mengonfirmasi barang bekas.', auth: 'buyer1Token',
        body: checkout('productA', { confirmUsedItem: false }),
        tests: [status(400), T('Ditolak dengan pesan konfirmasi', `  ${json}\n  pm.expect(j.success).to.eql(false);\n  pm.expect(JSON.stringify(j.errors)).to.include('barang bekas');`)],
      }),
      req('POST /api/orders (produk A)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Checkout: produk di-reserve secara atomik dalam transaksi MongoDB, ongkir dihitung backend.', auth: 'buyer1Token',
        body: checkout('productA'),
        tests: [status(201), T('Status waiting_payment; total = subtotal + ongkir', `  ${json}\n  pm.expect(j.data.status).to.eql('waiting_payment');\n  pm.expect(j.data.subtotal).to.eql(95000);\n  pm.expect(j.data.shippingCost).to.eql(Number(pm.collectionVariables.get('expectedShipping')));\n  pm.expect(j.data.total).to.eql(j.data.subtotal + j.data.shippingCost);\n  pm.expect(j.data.orderNumber).to.match(/^WTS-\\d{8}-[0-9A-F]{6}$/);`), save('orderA', 'pm.response.json().data._id')],
      }),
      req('GET /api/products/{id} (status reserved)', 'GET', '/products/{{productA}}', {
        access: 'Publik', fn: 'Setelah checkout, produk A berstatus reserved.',
        tests: [status(200), T('Status reserved', `  pm.expect(pm.response.json().data.status).to.eql('reserved');`)],
      }),
      req('POST /api/orders (pembeli 2 rebut produk A)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli lain mencoba membeli barang yang sama -> ditolak (mencegah double purchase).', auth: 'buyer2Token',
        body: { ...checkout('productA'), shippingAddressId: '{{address2Id}}' },
        tests: [status(409), T('Pesan menyebut produk tidak tersedia', `  pm.expect(pm.response.json().message).to.include('sudah tidak tersedia');`)],
      }),
      req('GET /api/products?category=kemeja (A tidak muncul)', 'GET', '/products?category=kemeja', {
        access: 'Publik', fn: 'Barang reserved/sold tidak muncul di katalog default.',
        tests: [status(200), T('Produk A tidak ada di daftar available', `  const ids = pm.response.json().data.map(p => p._id);\n  pm.expect(ids).to.not.include(pm.collectionVariables.get('productA'));`)],
      }),
      req('POST /api/orders (alamat milik orang lain)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli 2 tidak boleh memakai alamat pengiriman milik pembeli 1.', auth: 'buyer2Token',
        body: checkout('productC'),
        tests: [status(404)],
      }),
      req('GET /api/orders/{id} (milik orang lain)', 'GET', '/orders/{{orderA}}', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli 2 tidak boleh melihat order pembeli 1.', auth: 'buyer2Token',
        tests: [status(404)],
      }),
      req('GET /api/orders', 'GET', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Riwayat order milik pembeli.', auth: 'buyer1Token',
        tests: [status(200), T('Berisi order A', `  pm.expect(pm.response.json().data.map(o => o._id)).to.include(pm.collectionVariables.get('orderA'));`)],
      }),
    ],
  },
  {
    name: '6. Pembayaran',
    item: [
      req('POST /api/orders/{id}/payments/qris', 'POST', '/orders/{{orderA}}/payments/qris', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Membuat pembayaran QRIS dinamis (sandbox simulasi) dengan status pending.', auth: 'buyer1Token',
        tests: [status(201), T('Pending, nominal = total order, ada QR string', `  ${json}\n  pm.expect(j.data.status).to.eql('pending');\n  pm.expect(j.data.paymentMethod).to.eql('qris');\n  pm.expect(j.data.paymentData.qrString).to.be.a('string');`), save('txA', 'pm.response.json().data.transactionId'), save('payAmount', 'String(pm.response.json().data.amount)')],
      }),
      req('POST /api/payments/webhook (signature palsu)', 'POST', '/payments/webhook', {
        access: 'Publik (diverifikasi signature)', fn: 'Webhook dengan signature salah ditolak; status order tidak berubah.',
        ...webhook('txA', 'settlement', 'payAmount', true), tests: [status(403)],
      }),
      req('POST /api/payments/webhook (settlement)', 'POST', '/payments/webhook', {
        access: 'Publik (diverifikasi signature)', fn: 'Webhook payment gateway: pembayaran berhasil -> payment success, order paid, produk sold.',
        ...webhook('txA', 'settlement'), tests: [status(200), T('changed = true', `  pm.expect(pm.response.json().data).to.include({ status: 'success', changed: true });`)],
      }),
      req('POST /api/payments/webhook (duplikat)', 'POST', '/payments/webhook', {
        access: 'Publik (diverifikasi signature)', fn: 'Webhook yang dikirim ulang bersifat idempoten.',
        ...webhook('txA', 'settlement'), tests: [status(200), T('changed = false', `  pm.expect(pm.response.json().data.changed).to.eql(false);`)],
      }),
      req('GET /api/orders/{id} (paid)', 'GET', '/orders/{{orderA}}', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Order berstatus paid setelah webhook sukses.', auth: 'buyer1Token',
        tests: [status(200), T('Status paid', `  pm.expect(pm.response.json().data.status).to.eql('paid');`)],
      }),
      req('GET /api/products/{id} (status sold)', 'GET', '/products/{{productA}}', {
        access: 'Publik', fn: 'Produk A berstatus sold setelah pembayaran berhasil.',
        tests: [status(200), T('Status sold', `  pm.expect(pm.response.json().data.status).to.eql('sold');`)],
      }),
      req('POST /api/orders (beli barang yang sudah sold)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Barang terjual tidak dapat dibeli lagi.', auth: 'buyer2Token', body: { ...checkout('productA'), shippingAddressId: '{{address2Id}}' },
        tests: [status(409)],
      }),
    ],
  },
  {
    name: '7. Pemenuhan Pesanan (Admin)',
    item: [
      req('GET /api/admin/orders?status=paid', 'GET', '/admin/orders?status=paid', {
        access: 'Private (Bearer Token Admin)', fn: 'Admin melihat antrean order yang sudah dibayar.', auth: 'adminToken',
        tests: [status(200), T('Order A ada di antrean', `  ${json}\n  pm.expect(j.data.map(o => o._id)).to.include(pm.collectionVariables.get('orderA'));\n  pm.expect(j.data[0].userId).to.have.property('name');`)],
      }),
      req('GET /api/admin/orders (sebagai pembeli)', 'GET', '/admin/orders', {
        access: 'Private (Bearer Token Admin)', fn: 'RBAC: pembeli tidak boleh mengakses rute admin.', auth: 'buyer1Token',
        tests: [status(403)],
      }),
      req('PATCH /api/admin/orders/{id}/status (paid -> shipped, dilarang)', 'PATCH', '/admin/orders/{{orderA}}/status', {
        access: 'Private (Bearer Token Admin)', fn: 'Transisi status harus berurutan; melompat langsung ke shipped ditolak.', auth: 'adminToken', body: { status: 'shipped', trackingNumber: 'JNE123' },
        tests: [status(409)],
      }),
      req('PATCH /api/admin/orders/{id}/status (processing)', 'PATCH', '/admin/orders/{{orderA}}/status', {
        access: 'Private (Bearer Token Admin)', fn: 'Admin memproses order.', auth: 'adminToken', body: { status: 'processing' },
        tests: [status(200), T('processing', `  pm.expect(pm.response.json().data.status).to.eql('processing');`)],
      }),
      req('PATCH /api/admin/orders/{id}/status (shipped tanpa resi)', 'PATCH', '/admin/orders/{{orderA}}/status', {
        access: 'Private (Bearer Token Admin)', fn: 'Status shipped wajib menyertakan nomor resi.', auth: 'adminToken', body: { status: 'shipped' },
        tests: [status(400)],
      }),
      req('PATCH /api/admin/orders/{id}/status (shipped)', 'PATCH', '/admin/orders/{{orderA}}/status', {
        access: 'Private (Bearer Token Admin)', fn: 'Admin mengirim order dengan nomor resi.', auth: 'adminToken', body: { status: 'shipped', trackingNumber: 'JNE0012345678' },
        tests: [status(200), T('Resi tersimpan', `  pm.expect(pm.response.json().data.shipping.trackingNumber).to.eql('JNE0012345678');`)],
      }),
    ],
  },
  {
    name: '8. Ulasan (Review)',
    item: [
      req('POST /api/products/{id}/reviews (order belum completed)', 'POST', '/products/{{productA}}/reviews', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Ulasan hanya boleh setelah order selesai; saat status shipped ditolak.', auth: 'buyer1Token', body: { orderId: '{{orderA}}', rating: 5, comment: 'Terlalu cepat' },
        tests: [status(409)],
      }),
      req('PATCH /api/admin/orders/{id}/status (completed)', 'PATCH', '/admin/orders/{{orderA}}/status', {
        access: 'Private (Bearer Token Admin)', fn: 'Order diselesaikan.', auth: 'adminToken', body: { status: 'completed' },
        tests: [status(200)],
      }),
      req('POST /api/products/{id}/reviews (pembeli lain)', 'POST', '/products/{{productA}}/reviews', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli yang tidak memiliki order tersebut tidak boleh mengulas.', auth: 'buyer2Token', body: { orderId: '{{orderA}}', rating: 1, comment: 'Palsu' },
        tests: [status(403)],
      }),
      req('POST /api/products/{id}/reviews', 'POST', '/products/{{productA}}/reviews', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli memberi ulasan setelah order completed.', auth: 'buyer1Token', body: { orderId: '{{orderA}}', rating: 5, comment: 'Barang sesuai foto, packing rapi!' },
        tests: [status(201)],
      }),
      req('POST /api/products/{id}/reviews (duplikat)', 'POST', '/products/{{productA}}/reviews', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Unique index { userId, productId, orderId } mencegah ulasan ganda.', auth: 'buyer1Token', body: { orderId: '{{orderA}}', rating: 4, comment: 'Ulang' },
        tests: [status(409)],
      }),
      req('GET /api/products/{id}/reviews', 'GET', '/products/{{productA}}/reviews', {
        access: 'Publik', fn: 'Daftar ulasan produk.',
        tests: [status(200), T('Ada 1 ulasan bintang 5', `  ${json}\n  pm.expect(j.count).to.eql(1);\n  pm.expect(j.data[0].rating).to.eql(5);\n  pm.expect(j.data[0].userId.name).to.eql('Pembeli Satu');`)],
      }),
      req('GET /api/products/{id} (ringkasan ulasan)', 'GET', '/products/{{productA}}', {
        access: 'Publik', fn: 'Detail produk memuat rata-rata rating dari agregasi.',
        tests: [status(200), T('Rata-rata 5 dari 1 ulasan', `  ${json}\n  pm.expect(j.data.reviewSummary).to.eql({ averageRating: 5, totalReviews: 1 });`)],
      }),
    ],
  },
  {
    name: '9. Pembatalan & Kedaluwarsa',
    item: [
      req('POST /api/orders (produk B)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Checkout produk B.', auth: 'buyer1Token', body: checkout('productB'),
        tests: [status(201), save('orderB', 'pm.response.json().data._id')],
      }),
      req('POST /api/orders/{id}/cancel', 'POST', '/orders/{{orderB}}/cancel', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Pembeli membatalkan order sebelum bayar; produk B dilepas kembali.', auth: 'buyer1Token',
        tests: [status(200), T('cancelled', `  pm.expect(pm.response.json().data.status).to.eql('cancelled');`)],
      }),
      req('GET /api/products/{id} (B kembali available)', 'GET', '/products/{{productB}}', {
        access: 'Publik', fn: 'Produk B tersedia lagi setelah order dibatalkan.',
        tests: [status(200), T('available', `  pm.expect(pm.response.json().data.status).to.eql('available');`)],
      }),
      req('POST /api/orders (pembeli 2, produk B)', 'POST', '/orders', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Checkout produk B oleh pembeli 2 (tujuan luar Jawa -> zona 2.5x).', auth: 'buyer2Token',
        body: { ...checkout('productB'), shippingAddressId: '{{address2Id}}' },
        tests: [status(201), T('Ongkir zona luar Jawa: (9000 + 2500) x 2.5 = 28.750 -> 29.000', `  pm.expect(pm.response.json().data.shippingCost).to.eql(29000);`), save('orderB2', 'pm.response.json().data._id')],
      }),
      req('POST /api/orders/{id}/payments/bank-transfer', 'POST', '/orders/{{orderB2}}/payments/bank-transfer', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Membuat pembayaran transfer bank (virtual account).', auth: 'buyer2Token',
        tests: [status(201), T('Ada nomor VA', `  pm.expect(pm.response.json().data.paymentData.vaNumber).to.be.a('string');`), save('txB', 'pm.response.json().data.transactionId'), save('payAmountB', 'String(pm.response.json().data.amount)')],
      }),
      req('POST /api/payments/webhook (expire)', 'POST', '/payments/webhook', {
        access: 'Publik (diverifikasi signature)', fn: 'Waktu pembayaran habis -> payment expired, order cancelled, produk dilepas.',
        ...webhook('txB', 'expire', 'payAmountB'), tests: [status(200), T('expired', `  pm.expect(pm.response.json().data.status).to.eql('expired');`)],
      }),
      req('GET /api/orders/{id} (cancelled otomatis)', 'GET', '/orders/{{orderB2}}', {
        access: 'Private (Bearer Token Pembeli)', fn: 'Order otomatis cancelled setelah pembayaran kedaluwarsa.', auth: 'buyer2Token',
        tests: [status(200), T('cancelled', `  pm.expect(pm.response.json().data.status).to.eql('cancelled');`)],
      }),
      req('GET /api/products/{id} (B available lagi)', 'GET', '/products/{{productB}}', {
        access: 'Publik', fn: 'Produk B kembali dapat dibeli.',
        tests: [status(200), T('available', `  pm.expect(pm.response.json().data.status).to.eql('available');`)],
      }),
      req('DELETE /api/products/{id} (Admin, produk B)', 'DELETE', '/products/{{productB}}', {
        access: 'Private (Bearer Token Admin)', fn: 'Admin menghapus produk yang masih available.', auth: 'adminToken',
        tests: [status(200)],
      }),
      req('DELETE /api/products/{id} (sudah sold)', 'DELETE', '/products/{{productA}}', {
        access: 'Private (Bearer Token Admin)', fn: 'Produk yang sudah terjual tidak dapat dihapus (riwayat order dijaga).', auth: 'adminToken',
        tests: [status(409)],
      }),
    ],
  },
];

const collection = {
  info: {
    name: 'WantToSell API',
    description: 'Koleksi pengujian REST API WantToSell (toko pakaian preloved). Jalankan seluruh folder berurutan (Collection Runner / Newman).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000/api' },
    { key: 'paymentServerKey', value: 'SB-Mid-server-contoh-ganti-ini' },
  ],
  item: items,
};

const out = path.join(__dirname, '..', 'postman', 'WantToSell.postman_collection.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log(`Koleksi ditulis: ${out} (${items.reduce((n, f) => n + f.item.length, 0)} request)`);
