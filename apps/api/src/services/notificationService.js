// Email transaksional otomatis untuk siklus order. Tidak pernah melempar error ke pemanggil:
// kegagalan email hanya dicatat di log supaya checkout/pembayaran tetap berhasil.
const { Order } = require('../models');
const { sendEmail } = require('./emailService');

const idr = (n) => `Rp${Number(n).toLocaleString('id-ID')}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (d) => new Date(d).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB';

// Email dinonaktifkan bila token belum diisi (mis. development/test) atau EMAIL_NOTIFICATIONS=false.
function enabled() {
  const token = process.env.ZEPTOMAIL_TOKEN || '';
  return process.env.EMAIL_NOTIFICATIONS !== 'false' && token && !token.includes('ganti-dengan') && !!process.env.EMAIL_FROM_ADDRESS;
}

const TEMPLATES = {
  created: (o) => ({
    subject: `Pesanan ${o.orderNumber} dibuat - selesaikan pembayaran`,
    intro: 'Terima kasih sudah berbelanja! Pesanan Anda sudah kami terima dan barangnya kami amankan untuk Anda.',
    note: `Selesaikan pembayaran sebelum <b>${fmtDate(o.expiresAt)}</b>. Setelah itu pesanan dibatalkan otomatis dan barang tersedia kembali untuk pembeli lain (barang thrift hanya 1 pcs).`,
  }),
  paid: (o) => ({
    subject: `Pembayaran pesanan ${o.orderNumber} berhasil`,
    intro: 'Pembayaran Anda sudah kami terima. Pesanan akan segera kami proses.',
  }),
  processing: (o) => ({
    subject: `Pesanan ${o.orderNumber} sedang dikemas`,
    intro: 'Pesanan Anda sedang kami kemas dan akan segera dikirim.',
  }),
  shipped: (o) => ({
    subject: `Pesanan ${o.orderNumber} sudah dikirim`,
    intro: 'Pesanan Anda sudah diserahkan ke kurir.',
    note: `Kurir: <b>${esc(o.shipping.courier.toUpperCase())} ${esc(o.shipping.service.toUpperCase())}</b><br>No. resi: <b>${esc(o.shipping.trackingNumber)}</b>`,
  }),
  completed: (o) => ({
    subject: `Pesanan ${o.orderNumber} selesai`,
    intro: 'Pesanan Anda telah selesai. Semoga suka dengan pilihannya! Jangan lupa tinggalkan ulasan.',
  }),
  cancelled: (o) => ({
    subject: `Pesanan ${o.orderNumber} dibatalkan`,
    intro: 'Pesanan Anda dibatalkan (dibatalkan manual atau melewati batas waktu pembayaran). Barang kembali tersedia di toko.',
  }),
};

function render(order, user, { subject, intro, note }) {
  const rows = order.items.map((i) => `<tr><td style="padding:4px 0">${esc(i.name)}</td><td align="right">${idr(i.price)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
<h2 style="margin-bottom:0">WantToSell</h2>
<p>Halo ${esc(user.name)},</p><p>${intro}</p>${note ? `<p>${note}</p>` : ''}
<p style="margin-bottom:4px"><b>No. pesanan: ${esc(order.orderNumber)}</b></p>
<table width="100%" style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;border-collapse:collapse">${rows}
<tr><td style="padding:4px 0">Ongkir</td><td align="right">${idr(order.shippingCost)}</td></tr>
<tr><td><b>Total</b></td><td align="right"><b>${idr(order.total)}</b></td></tr></table>
<p style="color:#888;font-size:12px">Email otomatis, mohon tidak membalas.</p></div>`;
  const text = `Halo ${user.name},\n\n${[intro, note].filter(Boolean).join('\n').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')}\nNo. pesanan: ${order.orderNumber}\nTotal: ${idr(order.total)}`;
  return { subject, html, text };
}

/**
 * Kirim email untuk event order ('created' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled').
 * Fire-and-forget: panggil tanpa await.
 */
function notifyOrder(orderId, event) {
  if (!enabled() || !TEMPLATES[event]) return;
  setImmediate(async () => {
    try {
      const order = await Order.findById(orderId).populate('userId', 'name email');
      if (!order || !order.userId?.email) return;
      const mail = render(order, order.userId, TEMPLATES[event](order));
      await sendEmail({ to: { address: order.userId.email, name: order.userId.name }, ...mail });
    } catch (e) {
      console.error(`Email "${event}" untuk order ${orderId} gagal:`, e.message);
    }
  });
}

module.exports = { notifyOrder };
