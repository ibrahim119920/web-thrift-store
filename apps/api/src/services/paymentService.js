// Logika pembayaran Midtrans: membuat transaksi Snap, menerima notifikasi (webhook),
// dan menyinkronkan status pending langsung ke API Midtrans.
const { Payment, Order, ShippingAddress } = require('../models');
const { AppError } = require('../utils');
const midtrans = require('./midtransService');
const { applyPaymentResult, cancelOrder } = require('./orderService');

const expiryMinutes = () => parseInt(process.env.ORDER_EXPIRY_MINUTES, 10) || 60;
const SYNC_INTERVAL_MS = 15 * 1000; // jangan hit API Midtrans lebih sering dari ini per transaksi

const addressPayload = (address) => ({
  first_name: address.recipientName.slice(0, 50),
  phone: address.phone,
  address: address.address.slice(0, 200),
  city: address.city,
  postal_code: address.postalCode,
  country_code: 'IDN',
});

// Susunan item_details harus berjumlah tepat sama dengan gross_amount.
function buildSnapPayload({ order, user, address }) {
  const items = order.items.map((item) => ({
    id: String(item.productId),
    price: item.price,
    quantity: item.qty || 1,
    name: item.name.slice(0, 50),
  }));
  if (order.shippingCost > 0) {
    items.push({
      id: 'SHIPPING',
      price: order.shippingCost,
      quantity: 1,
      name: `${order.shipping.courier.toUpperCase()} ${order.shipping.service.toUpperCase()}`.slice(0, 50),
    });
  }

  const [firstName, ...rest] = String(user.name || 'Pembeli').trim().split(/\s+/);
  const payload = {
    transaction_details: { order_id: order.orderNumber, gross_amount: order.total },
    item_details: items,
    customer_details: {
      first_name: firstName,
      last_name: rest.join(' ') || undefined,
      email: user.email,
      phone: user.phone || address.phone,
      billing_address: addressPayload(address),
      shipping_address: addressPayload(address),
    },
    expiry: { unit: 'minutes', duration: expiryMinutes() },
    credit_card: { secure: true },
  };

  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (frontendUrl) {
    const finish = `${frontendUrl}/orders/${order._id}/pay`;
    payload.callbacks = { finish, unfinish: finish, error: finish };
  }
  return payload;
}

/**
 * Buat (atau pakai ulang) transaksi Snap untuk sebuah order milik pembeli.
 * Idempoten: selama masih ada pembayaran pending yang punya redirectUrl, token lama dipakai lagi.
 */
async function createSnapForOrder({ orderId, user }) {
  const order = await Order.findOne({ _id: orderId, userId: user._id });
  if (!order) throw new AppError(404, 'Order tidak ditemukan');
  if (order.status !== 'waiting_payment') throw new AppError(409, `Order berstatus "${order.status}", tidak dapat dibayar`);
  if (order.expiresAt < new Date()) {
    await cancelOrder(order._id);
    throw new AppError(409, 'Batas waktu pembayaran order telah habis, order dibatalkan');
  }

  const reusable = await Payment.findOne({ orderId: order._id, provider: 'midtrans', status: 'pending', redirectUrl: { $ne: null } });
  if (reusable) return reusable;

  const address = await ShippingAddress.findById(order.shippingAddressId);
  if (!address) throw new AppError(404, 'Alamat pengiriman tidak ditemukan');

  const snap = await midtrans.createSnapTransaction(buildSnapPayload({ order, user, address }));

  // Satu order hanya punya satu pembayaran aktif.
  await Payment.updateMany({ orderId: order._id, status: 'pending' }, { $set: { status: 'expired' } });

  return Payment.findOneAndUpdate(
    { orderId: order._id, provider: 'midtrans' },
    {
      $set: {
        userId: user._id,
        transactionId: order.orderNumber, // order_id yang dikirim ke Midtrans
        amount: order.total,
        paymentMethod: 'snap',
        status: 'pending',
        expiresAt: order.expiresAt,
        snapToken: snap.token,
        redirectUrl: snap.redirect_url,
        transactionStatus: 'pending',
        lastSyncedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

// Terapkan payload status Midtrans (dari webhook maupun sinkronisasi) ke payment + order.
async function applyMidtransPayload(payment, payload) {
  const status = midtrans.mapStatus(payload.transaction_status, payload.fraud_status);
  const existingData = payment.paymentData?.toObject ? payment.paymentData.toObject() : payment.paymentData || {};

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        transactionStatus: payload.transaction_status,
        fraudStatus: payload.fraud_status,
        paymentType: payload.payment_type,
        paymentMethod: midtrans.methodOf(payload.payment_type),
        paymentData: { ...existingData, ...midtrans.extractPaymentData(payload) },
        lastSyncedAt: new Date(),
      },
    }
  );

  if (status === 'pending') return { payment, changed: false, status: 'pending' };
  return applyPaymentResult(payment.transactionId, status);
}

/**
 * Handler notifikasi HTTP Midtrans (server-to-server).
 * Keamanan: verifikasi signature_key + kecocokan nominal, bukan hanya percaya body.
 */
async function handleMidtransNotification(body = {}) {
  if (!midtrans.isConfigured()) throw new AppError(503, 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di environment backend.');
  if (!body.order_id || !body.status_code || !body.transaction_status || !body.gross_amount) {
    throw new AppError(400, 'Payload notifikasi Midtrans tidak lengkap');
  }
  if (!midtrans.verifySignature(body)) throw new AppError(403, 'Signature notifikasi Midtrans tidak valid');

  const payment = await Payment.findOne({ transactionId: body.order_id });
  if (!payment) throw new AppError(404, 'Transaksi tidak ditemukan');
  if (Number(payment.amount) !== Number(body.gross_amount)) throw new AppError(400, 'Nominal pembayaran tidak sesuai');

  const result = await applyMidtransPayload(payment, body);
  return { transactionId: body.order_id, status: result.payment.status, changed: result.changed };
}

/**
 * Sinkronisasi status satu payment ke API Midtrans (dipanggil saat pembeli polling).
 * Berguna ketika webhook belum sampai, mis. saat development di localhost.
 */
async function syncPayment(payment) {
  if (!payment || payment.provider !== 'midtrans' || payment.status !== 'pending' || !midtrans.isConfigured()) return payment;

  const last = payment.lastSyncedAt ? new Date(payment.lastSyncedAt).getTime() : 0;
  if (Date.now() - last < SYNC_INTERVAL_MS) return payment;

  try {
    const remote = await midtrans.getTransactionStatus(payment.transactionId);
    await applyMidtransPayload(payment, remote);
  } catch {
    await Payment.updateOne({ _id: payment._id }, { $set: { lastSyncedAt: new Date() } }).catch(() => {});
  }
  return (await Payment.findById(payment._id)) || payment;
}

module.exports = { createSnapForOrder, handleMidtransNotification, syncPayment };
