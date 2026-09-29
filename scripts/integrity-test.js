// Uji integritas yang tidak bisa dilakukan dengan request berurutan:
//  1. Balapan (race): N checkout paralel untuk SATU barang -> tepat 1 yang berhasil.
//  2. Sweeper kedaluwarsa: order yang lewat batas bayar melepas barangnya kembali.
// Butuh server berjalan & database ter-seed. Pemakaian: node scripts/integrity-test.js [output.json]
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Product, Order, ShippingAddress } = require('../backend/src/models');
const { expireOverdueOrders } = require('../backend/src/services/orderService');

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { code: r.status, body: await r.json() };
};

function printIntegrityReport(result, outputPath) {
  const { race, expiry, indexes } = result;

  console.log('\n================================================================================');
  console.log('PENGUJIAN INTEGRITAS DATA - RACE CONDITION & KEDALUWARSA');
  console.log('================================================================================');

  console.log('\n[1] RACE CONDITION - ANTI DOUBLE PURCHASE');
  console.log('Tujuan   : Memastikan hanya satu checkout berhasil untuk satu produk yang sama.');
  console.log(`Produk   : ${race.product} (${race.productId})`);
  console.log(`API      : ${race.request.method} ${race.request.url}`);
  console.log('Payload  :');
  console.log(JSON.stringify(race.request.payload, null, 2));
  console.log(`Paralel  : ${race.parallelRequests} request dari dua akun pembeli`);
  console.log('Status setiap request:');
  race.attempts.forEach((attempt) => {
    console.log(
      `  ${String(attempt.number).padStart(2, '0')}. ${attempt.buyer.padEnd(10)} -> ${attempt.statusCode} ${attempt.outcome}`
    );
  });
  console.log('Ringkasan:');
  console.log(`  201 Created  : ${race.created201}`);
  console.log(`  409 Conflict : ${race.conflict409}`);
  console.log(`  Status lain  : ${race.other.length ? race.other.join(', ') : 0}`);
  console.log(`  Order sebelum run : ${race.ordersBeforeRace}`);
  console.log(`  Order dibuat run  : ${race.ordersCreatedThisRun}`);
  console.log(`  Total riwayat DB  : ${race.ordersAfterRace}`);
  console.log(`  Status produk: ${race.productStatusAfter}`);
  console.log(`Hasil    : ${race.pass ? 'LULUS' : 'GAGAL'}`);

  console.log('\n[2] EXPIRATION SWEEPER - ORDER KEDALUWARSA');
  console.log('Tujuan   : Memastikan order tidak dibayar dibatalkan dan produk dilepas kembali.');
  console.log(`Order    : ${expiry.orderNumber} (${expiry.orderId})`);
  console.log(`Produk   : ${expiry.product} (${expiry.productId})`);
  console.log(`Mekanisme: ${expiry.operation}`);
  console.log(`Pemanggil: ${expiry.triggerSource}`);
  console.log('Kriteria : status = waiting_payment DAN expiresAt < waktu sekarang');
  console.log('Waktu pengujian:');
  console.log(`  Batas bayar asli : ${expiry.originalExpiresAt}`);
  console.log(`  Batas simulasi   : ${expiry.forcedExpiresAt}`);
  console.log(`  Sweeper mulai    : ${expiry.sweeperStartedAt}`);
  console.log(`  Terlambat        : ${expiry.overdueBySeconds} detik`);
  console.log(`  Durasi sweeper   : ${expiry.durationMs} ms`);
  console.log('Transisi yang diharapkan:');
  console.log(`  Order  : ${expiry.expected.orderStatusBefore} -> ${expiry.expected.orderStatusAfter}`);
  console.log(`  Produk : ${expiry.expected.productStatusBefore} -> ${expiry.expected.productStatusAfter}`);
  console.log('Hasil aktual:');
  console.log(`  Order  : ${expiry.actual.orderStatusBefore} -> ${expiry.actual.orderStatusAfter}`);
  console.log(`  Produk : ${expiry.actual.productStatusBefore} -> ${expiry.actual.productStatusAfter}`);
  console.log(`  Total order kedaluwarsa yang diproses: ${expiry.releasedOrders}`);
  console.log('Pemeriksaan:');
  Object.entries(expiry.checks).forEach(([name, passed]) => {
    console.log(`  - [${passed ? 'LULUS' : 'GAGAL'}] ${name}`);
  });
  console.log(`Hasil    : ${expiry.pass ? 'LULUS' : 'GAGAL'}`);

  console.log('\n[3] INDEX DATABASE');
  Object.entries(indexes).forEach(([collection, collectionIndexes]) => {
    const uniqueCount = collectionIndexes.filter((index) => index.unique).length;
    console.log(`  ${collection.padEnd(22)}: ${collectionIndexes.length} index (${uniqueCount} unique)`);
  });

  console.log('\n================================================================================');
  console.log(`KESIMPULAN: ${race.pass && expiry.pass ? 'SELURUH UJI INTEGRITAS LULUS' : 'ADA UJI INTEGRITAS YANG GAGAL'}`);
  console.log(`Hasil lengkap disimpan: ${outputPath}`);
  console.log('================================================================================');
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = {};
  const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).body.data;
  const b1 = await login('buyer1@wanttosell.test', 'Buyer123!');
  const b2 = await login('buyer2@wanttosell.test', 'Buyer123!');
  const addr = { recipientName: 'Uji', phone: '081234567890', province: 'DI Yogyakarta', city: 'Sleman', district: 'Depok', address: 'Jl. Kaliurang Km 5', postalCode: '55281' };
  const a1 = (await call('POST', '/shipping-addresses', addr, b1.token)).body.data._id;
  const a2 = (await call('POST', '/shipping-addresses', addr, b2.token)).body.data._id;

  // ---- 1. Race ----
  const target = await Product.findOne({ status: 'available' });
  const ordersBeforeRace = await Order.countDocuments({ 'items.productId': target._id });
  const N = 10;
  const attempts = Array.from({ length: N }, (_, i) => {
    const [tok, aid] = i % 2 ? [b1.token, a1] : [b2.token, a2];
    return call('POST', '/orders', { productIds: [String(target._id)], shippingAddressId: aid, courier: 'jne', service: 'reg', confirmUsedItem: true }, tok);
  });
  const responses = await Promise.all(attempts);
  const codes = responses.map((r) => r.code);
  const winningResponse = responses.find((response) => response.code === 201);
  const winningOrderId = winningResponse && winningResponse.body.data && winningResponse.body.data._id;
  const ordersAfterRace = await Order.countDocuments({ 'items.productId': target._id });
  const ordersCreatedThisRun = ordersAfterRace - ordersBeforeRace;
  const after = await Product.findById(target._id);
  result.race = {
    product: target.name,
    productId: String(target._id),
    request: {
      method: 'POST',
      url: `${BASE}/orders`,
      payload: {
        productIds: [String(target._id)],
        shippingAddressId: '<alamat Pembeli 1 atau Pembeli 2>',
        courier: 'jne',
        service: 'reg',
        confirmUsedItem: true,
      },
    },
    parallelRequests: N,
    attempts: responses.map((response, i) => ({
      number: i + 1,
      buyer: i % 2 ? 'Pembeli 1' : 'Pembeli 2',
      shippingAddressId: i % 2 ? a1 : a2,
      statusCode: response.code,
      outcome: response.code === 201 ? 'Created' : response.code === 409 ? 'Conflict' : response.body.message || 'Status lain',
      orderId: response.body.data && response.body.data._id,
    })),
    created201: codes.filter((c) => c === 201).length,
    conflict409: codes.filter((c) => c === 409).length,
    other: codes.filter((c) => c !== 201 && c !== 409),
    winningOrderId,
    ordersBeforeRace,
    ordersCreatedThisRun,
    ordersAfterRace,
    productStatusAfter: after.status,
    pass: codes.filter((c) => c === 201).length === 1 && ordersCreatedThisRun === 1 && after.status === 'reserved',
  };

  // ---- 2. Sweeper kedaluwarsa ----
  if (!winningOrderId) throw new Error('Race condition tidak menghasilkan order pemenang untuk diuji kedaluwarsa');
  const order = await Order.findById(winningOrderId);
  if (!order) throw new Error(`Order pemenang ${winningOrderId} tidak ditemukan`);
  const originalExpiresAt = order.expiresAt;
  const forcedExpiresAt = new Date(Date.now() - 60 * 1000);
  await Order.updateOne({ _id: order._id }, { $set: { expiresAt: forcedExpiresAt } }); // simulasi waktu bayar habis
  const sweeperStartedAt = new Date();
  const sweeperStartedAtMs = Date.now();
  const released = await expireOverdueOrders();
  const sweeperFinishedAt = new Date();
  const [o2, p2] = await Promise.all([Order.findById(order._id), Product.findById(target._id)]);
  const expiryChecks = {
    'Order awal berstatus waiting_payment': order.status === 'waiting_payment',
    'Produk awal berstatus reserved': after.status === 'reserved',
    'expiresAt sudah melewati waktu sweeper': forcedExpiresAt < sweeperStartedAt,
    'Order berubah menjadi cancelled': o2.status === 'cancelled',
    'Produk kembali menjadi available': p2.status === 'available',
  };
  result.expiry = {
    operation: 'expireOverdueOrders()',
    triggerSource: 'Dipanggil langsung oleh script uji; server juga menjalankannya otomatis setiap 60 detik',
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    product: target.name,
    productId: String(target._id),
    originalExpiresAt: originalExpiresAt ? originalExpiresAt.toISOString() : null,
    forcedExpiresAt: forcedExpiresAt.toISOString(),
    sweeperStartedAt: sweeperStartedAt.toISOString(),
    sweeperFinishedAt: sweeperFinishedAt.toISOString(),
    overdueBySeconds: Math.max(0, Math.round((sweeperStartedAt.getTime() - forcedExpiresAt.getTime()) / 1000)),
    durationMs: sweeperFinishedAt.getTime() - sweeperStartedAtMs,
    expected: {
      orderStatusBefore: 'waiting_payment',
      orderStatusAfter: 'cancelled',
      productStatusBefore: 'reserved',
      productStatusAfter: 'available',
    },
    actual: {
      orderStatusBefore: order.status,
      orderStatusAfter: o2.status,
      productStatusBefore: after.status,
      productStatusAfter: p2.status,
    },
    releasedOrders: released,
    checks: expiryChecks,
    // Field ringkas dipertahankan agar laporan lama tetap kompatibel.
    orderStatusBefore: order.status,
    orderStatusAfter: o2.status,
    productStatusBefore: after.status,
    productStatusAfter: p2.status,
    pass: Object.values(expiryChecks).every(Boolean),
  };

  // ---- 3. Index di database ----
  const idx = {};
  for (const m of Object.values(mongoose.models)) idx[m.collection.name] = (await m.collection.indexes()).map((i) => ({ name: i.name, key: i.key, unique: !!i.unique }));
  result.indexes = idx;

  const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'postman', 'integrity-result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  printIntegrityReport(result, outputPath);
  await ShippingAddress.deleteMany({ _id: { $in: [a1, a2] } });
  await mongoose.disconnect();
  process.exit(result.race.pass && result.expiry.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
