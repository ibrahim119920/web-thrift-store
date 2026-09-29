const crypto = require('crypto');
const { z } = require('zod');
const { Order, Payment } = require('../models');
const { AppError, asyncHandler, ok } = require('../utils');
const { validate } = require('../middleware');
const { applyPaymentResult, cancelOrder } = require('../services/orderService');

// Provider pembayaran disimulasikan (mengikuti pola Midtrans sandbox: transaction_status + signature SHA-512).
// Tidak ada koneksi ke Midtrans sungguhan, sehingga tidak butuh akun/kunci pihak ketiga untuk pengujian.
const PROVIDER = 'midtrans-sandbox-simulated';
const serverKey = () => process.env.PAYMENT_SERVER_KEY;

const sign = (transactionId, transactionStatus, grossAmount) =>
  crypto.createHash('sha512').update(`${transactionId}${transactionStatus}${grossAmount}${serverKey()}`).digest('hex');

const STATUS_MAP = { settlement: 'success', capture: 'success', deny: 'failed', failure: 'failed', cancel: 'failed', expire: 'expired' };

// Router yang di-mount di /orders/:id/payments
const orderPayments = require('express').Router({ mergeParams: true });

async function createPayment(req, res, paymentMethod) {
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

orderPayments.post('/qris', require('../middleware').authenticate, asyncHandler((req, res) => createPayment(req, res, 'qris')));
orderPayments.post('/bank-transfer', require('../middleware').authenticate, asyncHandler((req, res) => createPayment(req, res, 'bank_transfer')));
orderPayments.get(
  '/',
  require('../middleware').authenticate,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) throw new AppError(404, 'Order tidak ditemukan');
    const data = await Payment.find({ orderId: order._id }).sort({ createdAt: -1 });
    ok(res, data, undefined, 200, { count: data.length });
  })
);

// Webhook publik dari payment gateway (di-mount di /payments/webhook). Keamanan lewat verifikasi signature.
const webhook = require('express').Router();
const webhookSchema = z.object({
  transactionId: z.string().min(1),
  transactionStatus: z.enum(['settlement', 'capture', 'deny', 'failure', 'cancel', 'expire']),
  grossAmount: z.string().regex(/^\d+$/, 'grossAmount harus string angka'),
  signature: z.string().min(1),
});

webhook.post(
  '/webhook',
  validate(webhookSchema),
  asyncHandler(async (req, res) => {
    const { transactionId, transactionStatus, grossAmount, signature } = req.body;
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
