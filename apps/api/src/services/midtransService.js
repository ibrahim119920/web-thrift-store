// Klien Midtrans Snap/API minimal. Tanpa dependency tambahan: memakai fetch bawaan Node >= 18.
// Dokumen: https://docs.midtrans.com/docs/snap-snap-integration-guide
const crypto = require('crypto');
const { AppError } = require('../utils');

const isProduction = () => String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true';
const serverKey = () => (process.env.MIDTRANS_SERVER_KEY || '').trim();

// Sandbox key berawalan "SB-Mid-...". Nilai contoh pada .env.example sengaja ditolak.
const isConfigured = () => Boolean(serverKey()) && !/ganti|xxxx|contoh/i.test(serverKey());

const snapBase = () => (isProduction() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com');
const apiBase = () => (isProduction() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com');
const authHeader = () => `Basic ${Buffer.from(`${serverKey()}:`).toString('base64')}`;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...options.headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(502, `Midtrans menolak permintaan [${response.status}] ${body.status_message || response.statusText}`);
  }
  return body;
}

// Membuat Snap transaction -> { token, redirect_url }
function createSnapTransaction(payload) {
  if (!isConfigured()) throw new AppError(503, 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di environment backend.');
  return request(`${snapBase()}/snap/v1/transactions`, { method: 'POST', body: JSON.stringify(payload) });
}

// Charge QRIS lewat Core API (khusus sandbox). Dipakai untuk mendapatkan URL gambar QR
// yang bisa di-scan/di-paste ke simulator Midtrans.
function chargeQrisCore(payload) {
  if (!isConfigured()) throw new AppError(503, 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di environment backend.');
  if (isProduction()) throw new AppError(403, 'QRIS Core hanya tersedia di sandbox.');
  return request(`${apiBase()}/v2/charge`, { method: 'POST', body: JSON.stringify(payload) });
}

// Status terkini sebuah transaksi (dipakai untuk sinkronisasi saat webhook belum/tidak sampai).
function getTransactionStatus(orderId) {
  if (!isConfigured()) throw new AppError(503, 'Midtrans belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di environment backend.');
  return request(`${apiBase()}/v2/${encodeURIComponent(orderId)}/status`, { method: 'GET' });
}

// signature_key = SHA512(order_id + status_code + gross_amount + server_key)
const signatureOf = (payload) =>
  crypto
    .createHash('sha512')
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey()}`)
    .digest('hex');

function verifySignature(payload) {
  if (!payload?.signature_key) return false;
  const expected = Buffer.from(signatureOf(payload));
  const given = Buffer.from(String(payload.signature_key));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// transaction_status Midtrans -> status internal (pending | success | failed | expired)
function mapStatus(transactionStatus, fraudStatus) {
  switch (transactionStatus) {
    case 'capture':
      if (fraudStatus === 'challenge') return 'pending';
      return fraudStatus === 'deny' ? 'failed' : 'success';
    case 'settlement':
      return 'success';
    case 'pending':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'failed';
    case 'expire':
      return 'expired';
    default:
      return 'pending';
  }
}

// payment_type Midtrans -> enum paymentMethod pada model Payment
const METHOD_BY_TYPE = {
  qris: 'qris',
  bank_transfer: 'bank_transfer',
  echannel: 'bank_transfer',
  cstore: 'cstore',
  gopay: 'ewallet',
  shopeepay: 'ewallet',
  credit_card: 'credit_card',
};
const methodOf = (paymentType) => METHOD_BY_TYPE[paymentType] || 'other';

// Ambil data yang perlu ditampilkan ke pembeli (QR / nomor VA / kode bayar).
function extractPaymentData(payload = {}) {
  const data = {};
  if (payload.qr_string) data.qrString = payload.qr_string;
  const va = Array.isArray(payload.va_numbers) ? payload.va_numbers[0] : null;
  if (va) {
    data.bank = va.bank;
    data.vaNumber = va.va_number;
  }
  if (payload.permata_va_number) {
    data.bank = 'permata';
    data.vaNumber = payload.permata_va_number;
  }
  if (payload.bill_key) {
    data.billKey = payload.bill_key;
    data.billerCode = payload.biller_code;
  }
  if (payload.payment_code) data.paymentCode = payload.payment_code;
  if (payload.store) data.store = payload.store;
  if (payload.acquirer) data.acquirer = payload.acquirer;
  return data;
}

module.exports = {
  isConfigured,
  isProduction,
  createSnapTransaction,
  chargeQrisCore,
  getTransactionStatus,
  verifySignature,
  mapStatus,
  methodOf,
  extractPaymentData,
};
