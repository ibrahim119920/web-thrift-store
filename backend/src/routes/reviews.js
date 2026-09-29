const router = require('express').Router({ mergeParams: true });
const { z } = require('zod');
const mongoose = require('mongoose');
const { Product, Order, Review } = require('../models');
const { AppError, asyncHandler, ok, parsePaging, paginationMeta } = require('../utils');
const { authenticate, validate } = require('../middleware');

const reviewSchema = z.object({
  orderId: z.string().regex(/^[a-f\d]{24}$/i, 'orderId tidak valid'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(''),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'ID produk tidak valid');
    const { page, limit, skip } = parsePaging(req.query);
    const filter = { productId: req.params.id };
    const [data, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name avatar'),
      Review.countDocuments(filter),
    ]);
    ok(res, data, undefined, 200, { count: data.length, pagination: paginationMeta(total, page, limit) });
  })
);

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
