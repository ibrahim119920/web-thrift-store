// Pengiriman email transaksional lewat Zoho ZeptoMail (REST API, berbasis kredit).
// Dipakai oleh script manual (scripts/send-email.js) dan nantinya oleh trigger otomatis
// (mis. setelah order dibuat / pembayaran sukses). Memakai fetch bawaan Node, tanpa dependency tambahan.
const { AppError } = require('../utils');

// Host API tergantung data center akun ZeptoMail: api.zeptomail.com (US), .in, .eu, .com.au, .jp, .ca, dst.
const apiUrl = () => `https://${process.env.ZEPTOMAIL_API_HOST || 'api.zeptomail.com'}/v1.1/email`;

// Token dari dashboard ZeptoMail biasanya sudah berawalan "Zoho-enczapikey "; terima keduanya.
function authHeader() {
  const token = (process.env.ZEPTOMAIL_TOKEN || '').trim();
  if (!token) throw new AppError(500, 'ZEPTOMAIL_TOKEN belum diatur');
  return token.startsWith('Zoho-enczapikey') ? token : `Zoho-enczapikey ${token}`;
}

// Menerima "a@x.com", { address, name }, atau array campuran keduanya.
function toRecipients(list) {
  if (!list) return undefined;
  const arr = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!arr.length) return undefined;
  return arr.map((r) => {
    const { address, name } = typeof r === 'string' ? { address: r.trim() } : r;
    return { email_address: { address, ...(name && { name }) } };
  });
}

/**
 * Kirim satu email.
 * @param {object} opts
 * @param {string|object|Array} opts.to         Penerima (wajib)
 * @param {string} opts.subject                 Subjek (wajib)
 * @param {string} [opts.html]                  Isi HTML
 * @param {string} [opts.text]                  Isi teks biasa (minimal salah satu html/text)
 * @param {string|object|Array} [opts.cc]
 * @param {string|object|Array} [opts.bcc]
 * @param {string|object} [opts.replyTo]
 * @param {{address: string, name?: string}} [opts.from]  Default dari env EMAIL_FROM_ADDRESS / EMAIL_FROM_NAME
 * @returns {Promise<{requestId: string, data: Array}>}
 */
async function sendEmail({ to, subject, html, text, cc, bcc, replyTo, from }) {
  const sender = from || { address: process.env.EMAIL_FROM_ADDRESS, name: process.env.EMAIL_FROM_NAME };
  if (!sender.address) throw new AppError(500, 'EMAIL_FROM_ADDRESS belum diatur');
  const recipients = toRecipients(to);
  if (!recipients) throw new AppError(400, 'Penerima email (to) wajib diisi');
  if (!subject) throw new AppError(400, 'Subjek email wajib diisi');
  if (!html && !text) throw new AppError(400, 'Isi email (html atau text) wajib diisi');

  const body = {
    from: { address: sender.address, ...(sender.name && { name: sender.name }) },
    to: recipients,
    subject,
    ...(html && { htmlbody: html }),
    ...(text && { textbody: text }),
    ...(cc && { cc: toRecipients(cc) }),
    ...(bcc && { bcc: toRecipients(bcc) }),
    ...(replyTo && { reply_to: toRecipients(replyTo).map((r) => r.email_address) }),
  };

  const res = await fetch(apiUrl(), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error || {};
    const details = (err.details || []).map((d) => `${d.code}${d.target ? ` (${d.target})` : ''}: ${d.message}`).join('; ');
    throw new AppError(502, `Gagal mengirim email [${res.status}] ${err.message || res.statusText}${details ? ` - ${details}` : ''}`);
  }
  return { requestId: json.request_id, data: json.data };
}

module.exports = { sendEmail };
