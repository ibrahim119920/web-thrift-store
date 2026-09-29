const express = require('express');
const { z } = require('zod');
const { Order, ORDER_STATUS } = require('../models');
const { AppError, asyncHandler, ok, parsePaging, paginationMeta } = require('../utils');
const { authenticate, requireRole, validate } = require('../middleware');
const { createOrder, cancelOrder } = require('../services/orderService');
const paymentRoutes = require('./payments');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID tidak valid');

const checkoutSchema = z.object({
  productIds: z.array(objectId).min(1).max(10),
  shippingAddressId: objectId,
  courier: z.string().min(2),
  service: z.string().min(2),
  // Fitur 6: pop-up konfirmasi barang bekas -> frontend mengirim true hanya jika pembeli menyetujui.
  confirmUsedItem: z.boolean().refine((v) => v === true, { message: 'Anda harus mengonfirmasi bahwa barang ini adalah barang bekas (preloved)' }),
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUS),
  trackingNumber: z.string().trim().min(3).optional(),
});

// Transisi status yang valid (alur: paid -> processing -> shipped -> completed).
const TRANSITIONS = {
  waiting_payment: ['cancelled'],
  paid: ['processing'],
  processing: ['shipped'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

// ----- Buyer -----
const buyer = express.Router();

buyer.use(authenticate);

buyer.post(
  '/',
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const productIds = [...new Set(req.body.productIds)];
    const order = await createOrder({ userId: req.user._id, productIds, ...req.body });
    ok(res, order, 'Order dibuat. Selesaikan pembayaran sebelum batas waktu.', 201);
  })
);

buyer.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const [data, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    ok(res, data, undefined, 200, { count: data.length, pagination: paginationMeta(total, page, limit) });
  })
);

buyer.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate('shippingAddressId');
    // Order milik orang lain diperlakukan sebagai "tidak ditemukan" agar ID tidak bisa ditebak.
    if (!order || (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin')) throw new AppError(404, 'Order tidak ditemukan');
    ok(res, order);
  })
);

buyer.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) throw new AppError(404, 'Order tidak ditemukan');
    ok(res, await cancelOrder(order._id), 'Order dibatalkan, barang tersedia kembali');
  })
);

buyer.use('/:id/payments', paymentRoutes);

// ----- Admin -----
const admin = express.Router();
admin.use(authenticate, requireRole('admin'));

admin.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = {};
    if (req.query.status) {
      if (!ORDER_STATUS.includes(req.query.status)) throw new AppError(400, `status harus salah satu dari: ${ORDER_STATUS.join(', ')}`);
      filter.status = req.query.status;
    }
    const [data, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name email phone'),
      Order.countDocuments(filter),
    ]);
    ok(res, data, undefined, 200, { count: data.length, pagination: paginationMeta(total, page, limit) });
  })
);

admin.patch(
  '/orders/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError(404, 'Order tidak ditemukan');
    const { status, trackingNumber } = req.body;
    if (status === 'cancelled') return ok(res, await cancelOrder(order._id), 'Order dibatalkan');
    if (!TRANSITIONS[order.status].includes(status)) {
      throw new AppError(409, `Transisi status "${order.status}" -> "${status}" tidak diizinkan. Yang diizinkan: ${TRANSITIONS[order.status].join(', ') || '-'}`);
    }
    if (status === 'shipped') {
      if (!trackingNumber) throw new AppError(400, 'trackingNumber wajib diisi saat status shipped');
      order.shipping.trackingNumber = trackingNumber;
    }
    order.status = status;
    await order.save();
    ok(res, order, `Status order diubah menjadi "${status}"`);
  })
);

module.exports = { buyerRouter: buyer, adminRouter: admin };
