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
  const N = 10;
  const attempts = Array.from({ length: N }, (_, i) => {
    const [tok, aid] = i % 2 ? [b1.token, a1] : [b2.token, a2];
    return call('POST', '/orders', { productIds: [String(target._id)], shippingAddressId: aid, courier: 'jne', service: 'reg', confirmUsedItem: true }, tok);
  });
  const responses = await Promise.all(attempts);
  const codes = responses.map((r) => r.code);
  const ordersForProduct = await Order.countDocuments({ 'items.productId': target._id });
  const after = await Product.findById(target._id);
  result.race = {
    product: target.name, parallelRequests: N,
    created201: codes.filter((c) => c === 201).length,
    conflict409: codes.filter((c) => c === 409).length,
    other: codes.filter((c) => c !== 201 && c !== 409),
    ordersInDatabase: ordersForProduct, productStatusAfter: after.status,
    pass: codes.filter((c) => c === 201).length === 1 && ordersForProduct === 1 && after.status === 'reserved',
  };

  // ---- 2. Sweeper kedaluwarsa ----
  const order = await Order.findOne({ 'items.productId': target._id });
  await Order.updateOne({ _id: order._id }, { $set: { expiresAt: new Date(Date.now() - 60 * 1000) } }); // simulasi waktu bayar habis
  const released = await expireOverdueOrders();
  const [o2, p2] = await Promise.all([Order.findById(order._id), Product.findById(target._id)]);
  result.expiry = { releasedOrders: released, orderStatusAfter: o2.status, productStatusAfter: p2.status, pass: o2.status === 'cancelled' && p2.status === 'available' };

  // ---- 3. Index di database ----
  const idx = {};
  for (const m of Object.values(mongoose.models)) idx[m.collection.name] = (await m.collection.indexes()).map((i) => ({ name: i.name, key: i.key, unique: !!i.unique }));
  result.indexes = idx;

  console.log(JSON.stringify({ race: result.race, expiry: result.expiry }, null, 2));
  const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'postman', 'integrity-result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  await ShippingAddress.deleteMany({ _id: { $in: [a1, a2] } });
  await mongoose.disconnect();
  process.exit(result.race.pass && result.expiry.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
