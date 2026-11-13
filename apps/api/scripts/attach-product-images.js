// Mengganti foto produk (URL placeholder dari seed) dengan foto sungguhan di S3, agar tampil di frontend.
// Pemakaian:
//   node scripts/attach-product-images.js                       -> upload semua gambar di <repo>/images ke S3, lalu pasang ke produk
//   node scripts/attach-product-images.js --keys k1,k2,k3,k4    -> pakai object key yang sudah ada di S3 (tanpa upload ulang)
// Opsi: --dir <folder>  --db <nama database> (default wanttosell_test)  --all (timpa juga produk yang sudah memakai key S3)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Product } = require('../src/models');
const { KEY_PATTERN, MAX_IMAGE_BYTES, createProductImageUpload, assertProductImagesUploaded } = require('../src/services/storageService');

const IMAGES_PER_PRODUCT = 4;

function parseArgs(argv) {
  const args = { dir: path.join(__dirname, '..', '..', '..', 'images'), db: 'wanttosell_test', all: false, keys: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = path.resolve(argv[++i]);
    else if (argv[i] === '--db') args.db = argv[++i];
    else if (argv[i] === '--keys') args.keys = argv[++i].split(',').map((k) => k.trim()).filter(Boolean);
    else if (argv[i] === '--all') args.all = true;
    else throw new Error(`Opsi tidak dikenal: ${argv[i]}`);
  }
  return args;
}

// Tipe file ditentukan dari isi (magic bytes), bukan dari ekstensi.
function sniffType(buf) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function uploadFolder(dir) {
  const keys = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const buf = fs.readFileSync(path.join(dir, name));
    const type = sniffType(buf);
    if (!type) { console.log(`  lewati ${name}: bukan jpeg/png/webp`); continue; }
    if (buf.length > MAX_IMAGE_BYTES) { console.log(`  lewati ${name}: lebih dari ${MAX_IMAGE_BYTES / 1024 / 1024} MB`); continue; }
    const up = await createProductImageUpload({ contentType: type, size: buf.length });
    const res = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: buf });
    if (!res.ok) throw new Error(`Upload ${name} gagal: ${res.status} ${await res.text()}`);
    console.log(`  ${name} -> ${up.key}`);
    keys.push(up.key);
  }
  return keys;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let keys = args.keys;
  if (keys) {
    const bad = keys.filter((k) => !KEY_PATTERN.test(k));
    if (bad.length) throw new Error(`Format key tidak valid: ${bad.join(', ')}`);
    await assertProductImagesUploaded(keys);
    console.log(`Memakai ${keys.length} key yang sudah ada di S3.`);
  } else {
    console.log(`Upload gambar dari ${args.dir} ke S3:`);
    keys = await uploadFolder(args.dir);
  }
  if (keys.length < IMAGES_PER_PRODUCT) throw new Error(`Butuh minimal ${IMAGES_PER_PRODUCT} gambar, tersedia ${keys.length}`);

  await mongoose.connect(process.env.MONGODB_URI, { dbName: args.db });
  console.log(`Terhubung ke database "${mongoose.connection.name}".`);

  // Default: hanya produk yang masih memakai URL luar (data seed). --all menimpa semua produk.
  const filter = args.all ? {} : { images: { $elemMatch: { $regex: /^https?:\/\//i } } };
  const products = await Product.find(filter).sort({ createdAt: 1 }).select('_id name');
  if (!products.length) console.log('Tidak ada produk yang perlu diperbarui.');

  // Diputar agar tiap produk punya 4 foto berbeda dan foto pertamanya bervariasi.
  const ops = products.map((p, i) => ({
    updateOne: {
      filter: { _id: p._id },
      update: { $set: { images: Array.from({ length: IMAGES_PER_PRODUCT }, (_, j) => keys[(i + j) % keys.length]) } },
    },
  }));
  if (ops.length) {
    const res = await Product.bulkWrite(ops);
    products.forEach((p, i) => console.log(`  ${p.name} -> foto utama ${keys[i % keys.length]}`));
    console.log(`Selesai: ${res.modifiedCount} produk diperbarui.`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('Gagal:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
