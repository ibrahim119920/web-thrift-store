const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { Order, Payment } = require('../models');
const { AppError, asyncHandler, ok } = require('../utils');
const { authenticate } = require('../middlewares');
const { applyPaymentResult, cancelOrder } = require('../services/orderService');
const { createSnapForOrder, createCoreQrisForOrder, handleMidtransNotification, syncPayment } = require('../services/paymentService');
const { isProduction } = require('../services/midtransService');

// ---------------------------------------------------------------------------
// Pembayaran asli: Midtrans Snap (lihat services/midtransService.js)
// ---------------------------------------------------------------------------
const orderPayments = express.Router({ mergeParams: true });
orderPayments.use(authenticate);

orderPayments.post(
  '/snap',
  asyncHandler(async (req, res) => {
    if (!isProduction()) {
      throw new AppError(403, 'Snap hanya aktif di production. Di sandbox gunakan QRIS Core (POST /api/orders/:id/payments/qris-core).');
    }
    const payment = await createSnapForOrder({ orderId: req.params.id, user: req.user });
    ok(res, payment, 'Transaksi Midtrans dibuat. Lanjutkan pembayaran.', 201);
  })
);

// QRIS Core API (sandbox): untuk diuji dengan simulator Midtrans / tools/midtrans-qris-sim.
orderPayments.post(
  '/qris-core',
  asyncHandler(async (req, res) => {
    const payment = await createCoreQrisForOrder({ orderId: req.params.id, user: req.user });
    ok(res, payment, 'QRIS sandbox dibuat. Pindai QR dengan simulator untuk membayar.', 201);
  })
);

// ---------------------------------------------------------------------------
// Pembayaran simulasi (tanpa Midtrans) — dipakai demo lokal & koleksi Postman.
// Set PAYMENT_SIMULATION=false di production untuk mematikan endpoint ini.
// ---------------------------------------------------------------------------
const PROVIDER = 'midtrans-sandbox-simulated';
const serverKey = () => process.env.PAYMENT_SERVER_KEY;
const simulationEnabled = () => process.env.PAYMENT_SIMULATION !== 'false';

const sign = (transactionId, transactionStatus, grossAmount) =>
  crypto.createHash('sha512').update(`${transactionId}${transactionStatus}${grossAmount}${serverKey()}`).digest('hex');

const STATUS_MAP = { settlement: 'success', capture: 'success', deny: 'failed', failure: 'failed', cancel: 'failed', expire: 'expired' };

async function createPayment(req, res, paymentMethod) {
  if (!simulationEnabled()) {
    throw new AppError(403, 'Pembayaran simulasi dinonaktifkan. Gunakan POST /api/orders/:id/payments/snap (Midtrans).');
  }
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) throw new AppError(404, 'Order tidak ditemukan');
  if (order.status !== 'waiting_payment') throw new AppError(409, `Order berstatus "${order.status}", tidak dapat dibayar`);
  if (order.expiresAt < new Date()) {
    await cancelOrder(order._id);
    throw new AppError(409, 'Batas waktu pembayaran order telah habis, order dibatalkan');
  }
  // Satu order hanya boleh punya satu pembayaran pending; kembalikan yang sudah ada (idempoten).
  const existing = await Payment.findOne({ orderId: order._id, status: 'pending', paymentMethod });
  if (existing) return ok(res, existing, 'Pembayaran pending sudah ada', 200);
  await Payment.updateMany({ orderId: order._id, status: 'pending' }, { $set: { status: 'expired' } }); // ganti metode

  const transactionId = `TRX-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const paymentData =
    paymentMethod === 'qris'
      ? { qrString: `00020101021226670016COM.WANTTOSELL.WWW0118${transactionId}5204599953033605802ID5910WantToSell6007Sleman6304ABCD`, acquirer: 'gopay' }
      : { bank: 'bca', vaNumber: `8077${String(Date.now()).slice(-10)}` };
  const payment = await Payment.create({
    orderId: order._id,
    userId: req.user._id,
    provider: PROVIDER,
    transactionId,
    amount: order.total,
    paymentMethod,
    status: 'pending',
    expiresAt: order.expiresAt,
    paymentData,
  });
  ok(res, payment, `Pembayaran ${paymentMethod === 'qris' ? 'QRIS' : 'transfer bank'} dibuat. Selesaikan sebelum batas waktu.`, 201);
}

orderPayments.post('/qris', asyncHandler((req, res) => createPayment(req, res, 'qris')));
orderPayments.post('/bank-transfer', asyncHandler((req, res) => createPayment(req, res, 'bank_transfer')));
orderPayments.get(
  '/',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) throw new AppError(404, 'Order tidak ditemukan');
    const stored = await Payment.find({ orderId: order._id }).sort({ createdAt: -1 });
    // Pembayaran Midtrans yang masih pending dicek ulang ke API (throttled) agar status
    // tetap benar walau webhook belum/tidak sampai (mis. development di localhost).
    const data = await Promise.all(stored.map((payment) => syncPayment(payment)));
    ok(res, data, undefined, 200, { count: data.length });
  })
);

// ---------------------------------------------------------------------------
// Webhook publik. Menerima dua format:
// 1. Notifikasi Midtrans: { order_id, transaction_status, status_code, gross_amount, signature_key, ... }
// 2. Simulasi lama: { transactionId, transactionStatus, grossAmount, signature }
// ---------------------------------------------------------------------------
const webhook = express.Router();

// Mode pembayaran aktif, dipakai frontend untuk memilih UI. Tanpa data sensitif.
// sandbox → QRIS Core, production → Snap.
webhook.get('/config', (_req, res) => {
  const production = isProduction();
  ok(res, {
    mode: production ? 'snap' : 'qris-core',
    isProduction: production,
    expiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES, 10) || 60,
  });
});

const legacySchema = z.object({
  transactionId: z.string().min(1),
  transactionStatus: z.enum(['settlement', 'capture', 'deny', 'failure', 'cancel', 'expire']),
  grossAmount: z.string().regex(/^\d+$/, 'grossAmount harus string angka'),
  signature: z.string().min(1),
});

webhook.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    if (body.order_id !== undefined || body.signature_key !== undefined) {
      const result = await handleMidtransNotification(body);
      return ok(res, result, result.changed ? 'Status pembayaran Midtrans diperbarui' : 'Notifikasi Midtrans diterima');
    }

    const parsed = legacySchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, 'Payload webhook tidak dikenali (bukan notifikasi Midtrans maupun simulasi)');

    const { transactionId, transactionStatus, grossAmount, signature } = parsed.data;
    const expected = Buffer.from(sign(transactionId, transactionStatus, grossAmount));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw new AppError(403, 'Signature tidak valid');

    const payment = await Payment.findOne({ transactionId });
    if (!payment) throw new AppError(404, 'Transaksi tidak ditemukan');
    if (String(payment.amount) !== grossAmount) throw new AppError(400, 'Nominal pembayaran tidak sesuai');

    const { payment: updated, changed } = await applyPaymentResult(transactionId, STATUS_MAP[transactionStatus]);
    ok(res, { transactionId, status: updated.status, changed }, changed ? 'Status pembayaran diperbarui' : 'Webhook sudah pernah diproses (diabaikan)');
  })
);

module.exports = orderPayments;
module.exports.webhookRouter = webhook;
