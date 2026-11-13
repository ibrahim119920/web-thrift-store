// Penyimpanan foto produk di Amazon S3 (bucket private).
// Alur: backend membuat presigned PUT URL -> browser upload langsung ke S3 -> object key disimpan di MongoDB.
// Saat dikirim ke klien, key diubah menjadi presigned GET URL berumur pendek.
const { randomUUID } = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { AppError } = require('../utils');

const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_URL_TTL = 5 * 60; // detik
const VIEW_URL_TTL = 60 * 60; // detik
const KEY_PATTERN = /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

let client;
function s3() {
  if (!process.env.S3_BUCKET_NAME || !process.env.AWS_REGION) throw new Error('AWS_REGION dan S3_BUCKET_NAME wajib diisi');
  // Kredensial dibaca otomatis oleh SDK dari AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
  // WHEN_REQUIRED: tanpa ini SDK menambahkan checksum ke presigned URL dan upload dari browser gagal.
  client ??= new S3Client({ region: process.env.AWS_REGION, requestChecksumCalculation: 'WHEN_REQUIRED' });
  return client;
}
const bucket = () => process.env.S3_BUCKET_NAME;

async function createProductImageUpload({ contentType, size }) {
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) throw new AppError(400, `Tipe file harus salah satu dari: ${Object.keys(ALLOWED_TYPES).join(', ')}`);
  if (size > MAX_IMAGE_BYTES) throw new AppError(400, `Ukuran file maksimal ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  const key = `products/${randomUUID()}.${ext}`;
  const uploadUrl = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL,
  });
  // Klien wajib mengirim header Content-Type yang sama persis saat PUT ke uploadUrl.
  return { key, uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, expiresIn: UPLOAD_URL_TTL };
}

// Memastikan setiap key benar-benar sudah di-upload, bertipe gambar yang diizinkan, dan tidak melebihi batas ukuran.
async function assertProductImagesUploaded(keys) {
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      let head;
      try {
        head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      } catch (e) {
        // Tanpa izin s3:ListBucket, S3 menjawab 403 (bukan 404) untuk object yang tidak ada.
        if ([403, 404].includes(e.$metadata?.httpStatusCode)) throw new AppError(400, `Foto belum di-upload: ${key}`);
        throw e;
      }
      if (!ALLOWED_TYPES[head.ContentType]) throw new AppError(400, `Tipe file tidak diizinkan: ${key}`);
      if (head.ContentLength > MAX_IMAGE_BYTES) throw new AppError(400, `Ukuran file melebihi batas: ${key}`);
    })
  );
}

// Data lama/seed masih berisi URL penuh; hanya object key S3 yang di-presign.
const isExternalUrl = (ref) => /^https?:\/\//i.test(ref);
const toImageUrl = (ref) =>
  isExternalUrl(ref) ? ref : getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: ref }), { expiresIn: VIEW_URL_TTL });

// Mengubah field images (object key) menjadi URL yang bisa dibuka browser.
// imageKeys tetap dikirim agar klien bisa mengirim balik key saat mengedit produk.
async function withImageUrls(product) {
  const obj = typeof product.toObject === 'function' ? product.toObject() : product;
  const keys = obj.images || [];
  return { ...obj, images: await Promise.all(keys.map(toImageUrl)), imageKeys: keys };
}

module.exports = { KEY_PATTERN, ALLOWED_TYPES, MAX_IMAGE_BYTES, createProductImageUpload, assertProductImagesUploaded, withImageUrls };
