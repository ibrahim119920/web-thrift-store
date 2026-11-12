require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const models = require('./models');
const { expireOverdueOrders } = require('./services/orderService');

const PORT = process.env.PORT || 5000;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // pastikan semua index (unique, dll.) sudah terbentuk
  app.listen(PORT, () => console.log(`WantToSell API berjalan di http://localhost:${PORT}/api (${Object.keys(models).length} model)`));

  // Lepas barang dari order yang lewat batas bayar (langkah "expired" pada status payment).
  setInterval(() => expireOverdueOrders().catch((e) => console.error('expireOverdueOrders gagal:', e.message)), 60 * 1000).unref();
}

main().catch((e) => {
  console.error('Gagal start server:', e.message);
  process.exit(1);
});
