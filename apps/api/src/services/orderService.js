const crypto = require('crypto');
const { Product, Order, Payment, ShippingAddress } = require('../models');
const { AppError, withTransaction } = require('../utils');
const { calculateShipping } = require('../utils/shipping');

const expiryMinutes = () => parseInt(process.env.ORDER_EXPIRY_MINUTES, 10) || 60;

function newOrderNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `WTS-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// Alur transaksi langkah 1-2: reserve produk (atomik) lalu buat order, semuanya dalam satu transaksi.
async function createOrder({ userId, productIds, shippingAddressId, courier, service }) {
  const address = await ShippingAddress.findOne({ _id: shippingAddressId, userId });
  if (!address) throw new AppError(404, 'Alamat pengiriman tidak ditemukan');

  return withTransaction(async (session) => {
    const reserved = [];
    for (const id of productIds) {
      // Atomic update: hanya lolos jika status masih "available" -> mencegah double purchase.
      const product = await Product.findOneAndUpdate(
        { _id: id, status: 'available' },
        { $set: { status: 'reserved' } },
        { new: true, session }
      );
      if (!product) throw new AppError(409, `Produk ${id} sudah tidak tersedia (terjual atau sedang diproses pembeli lain)`);
      reserved.push(product);
    }

    const subtotal = reserved.reduce((sum, p) => sum + p.price, 0);
    const weightGram = reserved.reduce((sum, p) => sum + p.weight, 0);
    const shippingCost = calculateShipping({ courier, service, province: address.province, weightGram });
    if (shippingCost === null) throw new AppError(400, `Kurir/layanan tidak didukung: ${courier} ${service}`);

    const [order] = await Order.create(
      [
        {
          orderNumber: newOrderNumber(),
          userId,
          items: reserved.map((p) => ({ productId: p._id, name: p.name, price: p.price, qty: 1 })),
          subtotal,
          shippingCost,
          total: subtotal + shippingCost,
          shippingAddressId: address._id,
          shipping: { courier: courier.toLowerCase(), service: service.toLowerCase(), trackingNumber: null },
          status: 'waiting_payment',
          expiresAt: new Date(Date.now() + expiryMinutes() * 60 * 1000),
        },
      ],
      { session }
    );
    return order;
  });
}

const productIdsOf = (order) => order.items.map((i) => i.productId);

// Membatalkan order yang belum dibayar: produk dilepas kembali (reserved -> available), payment pending -> expired.
async function cancelOrderInSession(order, session) {
  order.status = 'cancelled';
  await order.save({ session });
  await Product.updateMany({ _id: { $in: productIdsOf(order) }, status: 'reserved' }, { $set: { status: 'available' } }, { session });
  await Payment.updateMany({ orderId: order._id, status: 'pending' }, { $set: { status: 'expired' } }, { session });
}

async function cancelOrder(orderId) {
  return withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new AppError(404, 'Order tidak ditemukan');
    if (order.status !== 'waiting_payment') throw new AppError(409, `Order berstatus "${order.status}" tidak dapat dibatalkan`);
    await cancelOrderInSession(order, session);
    return order;
  });
}

// Langkah 3-4: hasil webhook payment gateway menentukan status payment & order.
async function applyPaymentResult(transactionId, result) {
  return withTransaction(async (session) => {
    const payment = await Payment.findOne({ transactionId }).session(session);
    if (!payment) throw new AppError(404, 'Transaksi tidak ditemukan');
    if (payment.status !== 'pending') return { payment, changed: false }; // idempoten: webhook duplikat diabaikan

    const order = await Order.findById(payment.orderId).session(session);
    if (result === 'success') {
      if (order.status !== 'waiting_payment') throw new AppError(409, `Order berstatus "${order.status}", pembayaran tidak dapat diterapkan`);
      payment.status = 'success';
      payment.paidAt = new Date();
      order.status = 'paid';
      await order.save({ session });
      await Product.updateMany({ _id: { $in: productIdsOf(order) } }, { $set: { status: 'sold' } }, { session });
    } else if (result === 'expired') {
      payment.status = 'expired';
      if (order.status === 'waiting_payment') await cancelOrderInSession(order, session);
    } else {
      payment.status = 'failed'; // pembeli masih boleh mencoba metode lain sebelum order kedaluwarsa
    }
    await payment.save({ session });
    return { payment, order, changed: true };
  });
}

// Melepas produk dari order yang lewat batas bayar (dipanggil berkala oleh server).
async function expireOverdueOrders() {
  const overdue = await Order.find({ status: 'waiting_payment', expiresAt: { $lt: new Date() } }).select('_id');
  let released = 0;
  for (const { _id } of overdue) {
    try {
      await cancelOrder(_id);
      released += 1;
    } catch (e) {
      if (!(e instanceof AppError)) throw e; // status sudah berubah (mis. baru dibayar) -> lewati
    }
  }
  return released;
}

module.exports = { createOrder, cancelOrder, applyPaymentResult, expireOverdueOrders };
