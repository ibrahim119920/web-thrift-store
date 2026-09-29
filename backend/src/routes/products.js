const router = require('express').Router();
const { z } = require('zod');
const { Product, Review, PRODUCT_STATUS } = require('../models');
const { AppError, asyncHandler, ok, escapeRegex, parsePaging, paginationMeta } = require('../utils');
const { authenticate, requireRole, validate } = require('../middleware');
const reviewRoutes = require('./reviews');

const productSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().default(''),
  category: z.string().trim().min(2),
  brand: z.string().trim().optional(),
  size: z.object({ label: z.string().min(1), chest: z.number().positive(), length: z.number().positive() }),
  condition: z.object({
    grade: z.enum(['A', 'B', 'C']),
    description: z.string().default(''),
    minusTags: z.array(z.string().trim().min(1)).default([]),
    sellerNote: z.string().default(''),
  }),
  price: z.number().nonnegative(),
  images: z.array(z.string().url()).length(4, 'Wajib 4 foto (depan, belakang, samping, detail)'),
  weight: z.number().int().positive().optional(),
});
const updateSchema = productSchema.partial();

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  chest_asc: { 'size.chest': 1 },
  chest_desc: { 'size.chest': -1 },
  length_asc: { 'size.length': 1 },
  length_desc: { 'size.length': -1 },
};

const num = (v) => (v === undefined || v === '' ? undefined : Number(v));

function rangeFilter(min, max) {
  const r = {};
  if (Number.isFinite(min)) r.$gte = min;
  if (Number.isFinite(max)) r.$lte = max;
  return Object.keys(r).length ? r : undefined;
}

// Publik. Filter: category, brand, q, status, price, ukuran (chest/length dalam cm). Sort & pagination.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = req.query;
    const { page, limit, skip } = parsePaging(q);
    const filter = {};
    if (q.category) filter.category = String(q.category).toLowerCase();
    if (q.brand) filter.brand = new RegExp(`^${escapeRegex(String(q.brand))}$`, 'i');
    if (q.q) {
      const rx = new RegExp(escapeRegex(String(q.q)), 'i');
      filter.$or = [{ name: rx }, { brand: rx }, { description: rx }];
    }
    const status = q.status || 'available'; // barang terjual tidak tampil kecuali diminta eksplisit
    if (status !== 'all') {
      if (!PRODUCT_STATUS.includes(status)) throw new AppError(400, `status harus salah satu dari: ${PRODUCT_STATUS.join(', ')}, all`);
      filter.status = status;
    }
    const price = rangeFilter(num(q.minPrice), num(q.maxPrice));
    const chest = rangeFilter(num(q.chestMin), num(q.chestMax));
    const length = rangeFilter(num(q.lengthMin), num(q.lengthMax));
    if (price) filter.price = price;
    if (chest) filter['size.chest'] = chest;
    if (length) filter['size.length'] = length;
    if (q.sort && !SORTS[q.sort]) throw new AppError(400, `sort harus salah satu dari: ${Object.keys(SORTS).join(', ')}`);

    const [data, total] = await Promise.all([
      Product.find(filter).sort(SORTS[q.sort] || SORTS.newest).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);
    ok(res, data, undefined, 200, { count: data.length, pagination: paginationMeta(total, page, limit) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError(404, 'Produk tidak ditemukan');
    const [agg] = await Review.aggregate([
      { $match: { productId: product._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, total: { $sum: 1 } } },
    ]);
    ok(res, { ...product.toObject(), reviewSummary: { averageRating: agg ? Math.round(agg.avg * 10) / 10 : null, totalReviews: agg?.total || 0 } });
  })
);

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const product = await Product.create({ ...req.body, status: 'available' });
    ok(res, product, 'Produk berhasil ditambahkan', 201);
  })
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError(404, 'Produk tidak ditemukan');
    if (product.status !== 'available') throw new AppError(409, `Produk berstatus "${product.status}" tidak dapat diubah`);
    product.set(req.body);
    await product.save();
    ok(res, product, 'Produk berhasil diperbarui');
  })
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    // Hanya menghapus jika masih available (atomik) agar riwayat order tidak kehilangan produk.
    const product = await Product.findOneAndDelete({ _id: req.params.id, status: 'available' });
    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      throw exists ? new AppError(409, 'Produk sedang diproses atau sudah terjual, tidak dapat dihapus') : new AppError(404, 'Produk tidak ditemukan');
    }
    ok(res, { _id: product._id }, 'Produk berhasil dihapus');
  })
);

router.use('/:id/reviews', reviewRoutes);

module.exports = router;
