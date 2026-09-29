const router = require('express').Router();
const { z } = require('zod');
const { ShippingAddress, Product } = require('../models');
const { AppError, asyncHandler, ok } = require('../utils');
const { authenticate, validate } = require('../middleware');
const { calculateShipping, COURIERS } = require('../utils/shipping');

const addressSchema = z.object({
  recipientName: z.string().trim().min(2),
  phone: z.string().regex(/^(\+62|62|0)8[0-9]{8,12}$/, 'Nomor telepon Indonesia tidak valid'),
  province: z.string().trim().min(2),
  city: z.string().trim().min(2),
  district: z.string().trim().min(2),
  address: z.string().trim().min(5),
  postalCode: z.string().regex(/^\d{5}$/, 'Kode pos harus 5 digit'),
});

const estimateSchema = z.object({
  shippingAddressId: z.string().regex(/^[a-f\d]{24}$/i),
  courier: z.string(),
  service: z.string(),
  productIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
});

router.use(['/shipping-addresses', '/shipping'], authenticate); // jangan bocor ke rute /api lain (mis. webhook publik)

router.get(
  '/shipping-addresses',
  asyncHandler(async (req, res) => {
    const data = await ShippingAddress.find({ userId: req.user._id }).sort({ createdAt: -1 });
    ok(res, data, undefined, 200, { count: data.length });
  })
);

router.post(
  '/shipping-addresses',
  validate(addressSchema),
  asyncHandler(async (req, res) => {
    const data = await ShippingAddress.create({ ...req.body, userId: req.user._id });
    ok(res, data, 'Alamat pengiriman disimpan', 201);
  })
);

router.delete(
  '/shipping-addresses/:id',
  asyncHandler(async (req, res) => {
    const removed = await ShippingAddress.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!removed) throw new AppError(404, 'Alamat tidak ditemukan');
    ok(res, { _id: removed._id }, 'Alamat dihapus');
  })
);

// Estimasi ongkir otomatis sebelum checkout (rumus sama dengan yang dipakai saat membuat order).
router.post(
  '/shipping/estimate',
  validate(estimateSchema),
  asyncHandler(async (req, res) => {
    const address = await ShippingAddress.findOne({ _id: req.body.shippingAddressId, userId: req.user._id });
    if (!address) throw new AppError(404, 'Alamat pengiriman tidak ditemukan');
    const products = await Product.find({ _id: { $in: req.body.productIds } });
    if (products.length !== new Set(req.body.productIds).size) throw new AppError(404, 'Sebagian produk tidak ditemukan');
    const weightGram = products.reduce((s, p) => s + p.weight, 0);
    const shippingCost = calculateShipping({ courier: req.body.courier, service: req.body.service, province: address.province, weightGram });
    if (shippingCost === null) throw new AppError(400, `Kurir/layanan tidak didukung. Pilihan: ${JSON.stringify(COURIERS)}`);
    ok(res, { courier: req.body.courier, service: req.body.service, weightGram, shippingCost });
  })
);

module.exports = router;
