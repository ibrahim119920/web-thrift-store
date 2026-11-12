// Mengisi database dengan data awal: 1 admin, 2 pembeli, 12 produk preloved (setiap barang = 1 dokumen).
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Product, Order, Payment, Wishlist, Review, ShippingAddress } = require('../src/models');

const img = (slug) => ['depan', 'belakang', 'samping', 'detail'].map((a) => `https://placehold.co/600x800?text=${encodeURIComponent(slug + ' - ' + a)}`);
const P = (name, category, brand, label, chest, length, grade, desc, minusTags, sellerNote, price, weight) => ({
  name, category, brand, description: `${name} preloved, kondisi layak pakai.`,
  size: { label, chest, length },
  condition: { grade, description: desc, minusTags, sellerNote },
  price, weight, images: img(name), status: 'available',
});

const products = [
  P('Kemeja Flanel Kotak Merah', 'kemeja', 'Uniqlo', 'L', 58, 74, 'A', 'Nyaris tanpa cacat', [], 'Dipakai 2x saja', 85000, 350),
  P('Kaos Vintage Nirvana 90s', 'kaos', 'Vintage', 'M', 52, 70, 'B', 'Warna sedikit pudar di bagian print', ['pudar'], 'Print masih jelas, tidak retak', 120000, 250),
  P('Jaket Denim Levi\'s Trucker', 'jaket', 'Levi\'s', 'L', 60, 66, 'B', 'Ada goresan kecil di lengan kiri', ['goresan lengan'], 'Kancing lengkap semua', 275000, 900),
  P('Celana Chino Krem', 'celana', 'Dockers', '32', 46, 102, 'A', 'Sangat baik', [], 'Ukuran pinggang 32 inci', 110000, 500),
  P('Hoodie Crewneck Champion', 'hoodie', 'Champion', 'XL', 64, 72, 'B', 'Bulu halus di bagian dalam sedikit menggumpal', ['pilling ringan'], 'Sudah dicuci bersih', 165000, 800),
  P('Blouse Putih Renda', 'blouse', 'Zara', 'S', 46, 60, 'A', 'Tanpa cacat', [], 'Cocok untuk kerja', 70000, 200),
  P('Kaos Polo Ralph Lauren Navy', 'kaos', 'Ralph Lauren', 'M', 54, 71, 'A', 'Sangat baik', [], 'Logo bordir utuh', 135000, 280),
  P('Cardigan Rajut Abu', 'sweater', 'H&M', 'L', 56, 68, 'C', 'Ada lubang kecil di ketiak dan bulu rontok', ['lubang kecil', 'pilling'], 'Harga sudah termasuk minus', 45000, 450),
  P('Jaket Bomber Hitam', 'jaket', 'Alpha Industries', 'M', 57, 65, 'A', 'Resleting lancar', [], 'Lining oranye masih bagus', 320000, 950),
  P('Celana Jeans Slim Fit', 'celana', 'Levi\'s', '30', 43, 100, 'B', 'Warna sedikit luntur di lutut', ['luntur lutut'], 'Tidak ada sobek', 190000, 700),
  P('Kemeja Batik Lengan Pendek', 'kemeja', 'Danar Hadi', 'XL', 60, 76, 'A', 'Sangat baik', [], 'Batik cap, adem', 95000, 300),
  P('Sweater Turtleneck Cream', 'sweater', 'Uniqlo', 'M', 53, 64, 'B', 'Noda kecil di lengan bagian dalam', ['noda kecil'], 'Kemungkinan hilang bila di-laundry', 60000, 400),
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await Promise.all([User, Product, Order, Payment, Wishlist, Review, ShippingAddress].map((m) => m.deleteMany({})));

  const hash = (p) => bcrypt.hash(p, 10);
  await User.create([
    { name: 'Admin WantToSell', email: 'admin@wanttosell.test', password: await hash('Admin123!'), role: 'admin', phone: '081200000001' },
    { name: 'Pembeli Satu', email: 'buyer1@wanttosell.test', password: await hash('Buyer123!'), role: 'buyer', phone: '081200000002' },
    { name: 'Pembeli Dua', email: 'buyer2@wanttosell.test', password: await hash('Buyer123!'), role: 'buyer', phone: '081200000003' },
  ]);
  const created = await Product.insertMany(products);
  console.log(`Seed selesai: 3 users, ${created.length} products`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
