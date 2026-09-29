const router = require('express').Router();
const { z } = require('zod');
const { Product, Wishlist } = require('../models');
const { AppError, asyncHandler, ok } = require('../utils');
const { authenticate, validate } = require('../middleware');

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await Wishlist.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate('productId');
    ok(res, items, undefined, 200, { count: items.length });
  })
);

router.post(
  '/',
  validate(z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i, 'productId tidak valid') })),
  asyncHandler(async (req, res) => {
    if (!(await Product.exists({ _id: req.body.productId }))) throw new AppError(404, 'Produk tidak ditemukan');
    // Unique index { userId, productId } menjaga dari duplikat (E11000 -> 409 di error handler).
    const fav = await Wishlist.create({ userId: req.user._id, productId: req.body.productId });
    ok(res, fav, 'Produk ditambahkan ke favorit', 201);
  })
);

router.delete(
  '/:productId',
  asyncHandler(async (req, res) => {
    const removed = await Wishlist.findOneAndDelete({ userId: req.user._id, productId: req.params.productId });
    if (!removed) throw new AppError(404, 'Produk tidak ada di daftar favorit');
    ok(res, { productId: req.params.productId }, 'Produk dihapus dari favorit');
  })
);

module.exports = router;
