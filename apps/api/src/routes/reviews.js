const router = require('express').Router({ mergeParams: true });
const { z } = require('zod');
const mongoose = require('mongoose');
const { Product, Order, Review } = require('../models');
const { AppError, asyncHandler, ok, parsePaging, paginationMeta } = require('../utils');
const { authenticate, validate } = require('../middlewares');

const reviewSchema = z.object({
  orderId: z.string().regex(/^[a-f\d]{24}$/i, 'orderId tidak valid'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(''),
});

// GET /api/products/:id/reviews -> ulasan satu produk; GET /api/reviews -> ulasan terbaru semua produk.
const listReviews = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.params.id !== undefined) {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'ID produk tidak valid');
    filter.productId = req.params.id;
  }
  const { page, limit, skip } = parsePaging(req.query);
  const [data, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name avatar').populate('productId', 'name category images'),
    Review.countDocuments(filter),
  ]);
  ok(res, data, undefined, 200, { count: data.length, pagination: paginationMeta(total, page, limit) });
});

router.get('/', listReviews);

// Buyer boleh mengulas setelah order berstatus "completed" (alur transaksi langkah 6) dan hanya untuk barang di order-nya.
router.post(
  '/',
  authenticate,
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError(404, 'Produk tidak ditemukan');
    const order = await Order.findOne({ _id: req.body.orderId, userId: req.user._id, 'items.productId': product._id });
    if (!order) throw new AppError(403, 'Anda hanya dapat mengulas produk dari order milik Anda sendiri');
    if (order.status !== 'completed') throw new AppError(409, 'Ulasan hanya dapat dibuat setelah order selesai (completed)');
    if (await Review.exists({ userId: req.user._id, productId: product._id })) throw new AppError(409, 'Anda sudah mengulas produk ini');
    const review = await Review.create({
      userId: req.user._id,
      productId: product._id,
      orderId: order._id,
      rating: req.body.rating,
      comment: req.body.comment,
    });
    ok(res, review, 'Ulasan berhasil dikirim', 201);
  })
);

module.exports = router;
module.exports.listReviews = listReviews;
