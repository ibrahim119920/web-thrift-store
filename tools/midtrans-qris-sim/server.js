#!/usr/bin/env node
'use strict';

/**
 * QRIS Midtrans Sandbox Simulator — server kecil tanpa dependency.
 *
 * Tugas server ini:
 *  - menyajikan folder public/ secara statis;
 *  - mem-proxy dua langkah form simulator Midtrans (karena simulator tidak
 *    mengirim header CORS sehingga fetch dari browser diblokir);
 *  - memvalidasi seluruh input dengan ketat (hanya sandbox, hanya QRIS).
 *
 * Tidak ada kredensial, tidak ada state di disk, tidak ada database.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = Number.parseInt(process.env.PORT, 10) || 4321;
const PUBLIC_DIR = path.join(__dirname, 'public');

const SIMULATOR_ORIGIN = 'https://simulator.sandbox.midtrans.com';
const SIMULATOR_SCAN_URL = SIMULATOR_ORIGIN + '/v2/qris/payment';
const SIMULATOR_HOST = 'simulator.sandbox.midtrans.com';
const QR_API_HOST = 'api.sandbox.midtrans.com';
const QR_API_HOST_ALLOWED = new Set([QR_API_HOST]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QR_PATH_RE = /^\/v2\/qris\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/qr-code\/?$/i;
const AMOUNT_FIELD_RE = /^(?:amount|gross_amount|total_amount|nominal|transaction_amount)$/i;

const MAX_BODY_BYTES = 32 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_SIM_RESPONSE_BYTES = 1024 * 1024;

const ISSUERS = ['gopay', 'dana', 'ovo', 'linkaja', 'airpay shopee'];

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/* ------------------------------------------------------------------ helpers */

function sendJson(res, status, payload) {
  if (res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendText(res, status, message) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(message);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0; // berhenti menyimpan, tetap drain socket
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, 'Body permintaan terlalu besar (maksimal 32 KB).'));
        return;
      }
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        reject(new HttpError(400, 'Body bukan JSON yang valid.'));
        return;
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        reject(new HttpError(400, 'Body harus berupa objek JSON.'));
        return;
      }
      resolve(parsed);
    });

    req.on('error', reject);
  });
}

function normalizeQrInput(raw) {
  if (typeof raw !== 'string') {
    throw new HttpError(400, 'Field "qr" wajib berupa string URL atau UUID.');
  }
  const value = raw.trim().replace(/^["'<]+|["'>]+$/g, '');
  if (!value) {
    throw new HttpError(400, 'Masukkan URL qr-code atau UUID transaksi terlebih dahulu.');
  }
  if (value.length > 500) {
    throw new HttpError(400, 'Input terlalu panjang (maksimal 500 karakter).');
  }

  if (UUID_RE.test(value)) {
    const uuid = value.toLowerCase();
    return {
      uuid,
      qrCodeUrl: `https://${QR_API_HOST}/v2/qris/${uuid}/qr-code`,
    };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(
      400,
      'Input harus UUID transaksi atau URL https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code.'
    );
  }

  if (url.protocol !== 'https:' || !QR_API_HOST_ALLOWED.has(url.hostname)) {
    throw new HttpError(
      400,
      'Hanya URL sandbox Midtrans (https://api.sandbox.midtrans.com/...) yang diterima. Simulator ini tidak menerima domain lain.'
    );
  }
  if (url.username || url.password || url.port) {
    throw new HttpError(400, 'URL tidak boleh memuat kredensial atau port khusus.');
  }

  const match = url.pathname.match(QR_PATH_RE);
  if (!match) {
    throw new HttpError(
      400,
      'Path URL harus /v2/qris/<uuid>/qr-code. URL halaman lain tidak bisa dipakai simulator.'
    );
  }

  const uuid = match[1].toLowerCase();
  return {
    uuid,
    qrCodeUrl: `https://${QR_API_HOST}/v2/qris/${uuid}/qr-code`,
  };
}

function decodeEntities(input) {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    });
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+))/g;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[name] = decodeEntities(value);
  }
  for (const booleanAttr of ['checked', 'selected', 'disabled', 'readonly', 'required']) {
    if (attrs[booleanAttr] === undefined) {
      const flag = new RegExp(`(?:^|\\s)${booleanAttr}(?:\\s|=|$)`, 'i');
      if (flag.test(source)) attrs[booleanAttr] = '';
    }
  }
  return attrs;
}

function formValue(attrs, type) {
  if (attrs.value !== undefined) return attrs.value;
  if (type === 'checkbox' || type === 'radio') return 'on';
  return '';
}

/** Parse semua <form> pada HTML simulator: action, method, dan field-nya. */
function parseForms(html) {
  const forms = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let formMatch;

  while ((formMatch = formRe.exec(html))) {
    const attrs = parseAttrs(formMatch[1]);
    const inner = formMatch[2];
    const fields = {};

    const inputRe = /<input\b([^>]*?)\/?>/gi;
    let inputMatch;
    while ((inputMatch = inputRe.exec(inner))) {
      const inputAttrs = parseAttrs(inputMatch[1]);
      if (!inputAttrs.name) continue;
      const type = (inputAttrs.type || 'text').toLowerCase();
      if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) continue;
      if ((type === 'checkbox' || type === 'radio') && inputAttrs.checked === undefined) continue;
      fields[inputAttrs.name] = formValue(inputAttrs, type);
    }

    const textareaRe = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
    let textareaMatch;
    while ((textareaMatch = textareaRe.exec(inner))) {
      const textareaAttrs = parseAttrs(textareaMatch[1]);
      if (textareaAttrs.name) {
        fields[textareaAttrs.name] = decodeEntities(
          textareaMatch[2].replace(/<[^>]*>/g, '')
        );
      }
    }

    const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
    let selectMatch;
    while ((selectMatch = selectRe.exec(inner))) {
      const selectAttrs = parseAttrs(selectMatch[1]);
      if (!selectAttrs.name) continue;
      const options = [];
      const optionRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      let optionMatch;
      while ((optionMatch = optionRe.exec(selectMatch[2]))) {
        const optionAttrs = parseAttrs(optionMatch[1]);
        options.push({
          value: optionAttrs.value !== undefined
            ? optionAttrs.value
            : decodeEntities(optionMatch[2].replace(/<[^>]*>/g, '')).trim(),
          selected: optionAttrs.selected !== undefined,
          disabled: optionAttrs.disabled !== undefined,
        });
      }
      const selected = options.find((option) => option.selected && !option.disabled)
        || options.find((option) => !option.disabled);
      if (selected) fields[selectAttrs.name] = selected.value;
    }

    forms.push({
      action: attrs.action || '',
      method: (attrs.method || 'post').toUpperCase(),
      fields,
    });
  }

  return forms;
}

/** Ambil teks yang terlihat dari halaman simulator (tanpa HTML mentah). */
function extractPageText(html) {
  const articleStart = html.indexOf('<article');
  const articleEnd = html.indexOf('</article>');
  let fragment = html;
  if (articleStart !== -1 && articleEnd > articleStart) {
    fragment = html.slice(articleStart, articleEnd + '</article>'.length);
  } else {
    const bodyStart = html.indexOf('<body');
    if (bodyStart !== -1) fragment = html.slice(bodyStart);
  }

  fragment = fragment
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|h[1-6]|td|th|section|header|footer|form|label|option)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  fragment = decodeEntities(fragment)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return fragment.join('\n');
}

function findLabeledValue(lines, labels) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const label of labels) {
      const re = new RegExp(`^${label}\\b\\s*[:\\-]?\\s*(.*)$`, 'i');
      const match = line.match(re);
      if (!match) continue;
      const inline = match[1].trim();
      if (inline) return inline;
      const next = lines[i + 1];
      if (next && next.length <= 120) return next;
    }
  }
  return null;
}

function cleanAmountValue(value) {
  if (!value) return null;
  const match = value.match(/Rp\.?\s*([\d.,]+)|([\d][\d.,]*)/i);
  if (!match) return null;
  const raw = (match[1] || match[2] || '').trim();
  return raw || null;
}

function excerpt(text, limit) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  return flat.slice(0, limit - 1).trimEnd() + '…';
}

/**
 * exploreData pada form simulator berisi JSON transaksi. Ini sumber paling
 * andal untuk merchant/nominal/acquirer, karena tidak bergantung pada teks
 * yang kebetulan tampil di halaman.
 */
function parseExploreData(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 16_000) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const payee = data.payee_information;
  const amount = data.amount;

  let amountValue = null;
  if (amount && typeof amount === 'object' && amount.value !== undefined && amount.value !== null) {
    const numeric = Number(amount.value);
    amountValue = Number.isFinite(numeric) ? String(numeric) : String(amount.value);
  }

  return {
    merchant: payee && typeof payee.name === 'string' && payee.name.trim() ? payee.name.trim() : null,
    amount: amountValue,
    currency: amount && typeof amount.currency === 'string' ? amount.currency : null,
    acquirer: typeof data.acquirer === 'string' && data.acquirer.trim() ? data.acquirer.trim() : null,
    paymentId: typeof data.payment_id === 'string' ? data.payment_id : null,
  };
}

/** Hasil akhir simulator biasanya memuat "Order ID <id> Status <PAID|...>". */
function parseOrderStatus(flatText) {
  const match = flatText.match(/Order\s*ID\s+([A-Za-z0-9._-]{1,80})\s+Status\s+([A-Za-z_]{1,40})/i);
  if (!match) return null;
  return { orderId: match[1], status: match[2].toUpperCase() };
}

function pickMessage(lines, status) {
  const patterns = status === 'paid'
    ? [/\bpaid\b/i, /success/i, /berhasil/i]
    : status === 'failed'
      ? [/failed to be processed/i, /unparsable/i, /expired/i, /not found/i, /invalid/i, /failed/i, /denied/i, /cancel/i]
      : [];

  for (const line of lines) {
    if (line.length < 200 && patterns.some((re) => re.test(line))) return line;
  }
  return excerpt(lines.slice(0, 4).join(' '), 300);
}

async function simulatorPost(targetUrl, formBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const networkError = (error) => {
    if (error && error.name === 'AbortError') {
      return new HttpError(504, `Simulator Midtrans tidak merespons dalam ${TIMEOUT_MS / 1000} detik. Coba lagi.`);
    }
    if (controller.signal.aborted) {
      return new HttpError(504, `Simulator Midtrans tidak merespons dalam ${TIMEOUT_MS / 1000} detik. Coba lagi.`);
    }
    return new HttpError(
      502,
      'Tidak bisa menghubungi simulator Midtrans sandbox. Periksa koneksi internet lalu coba lagi.',
      error && error.message
    );
  };

  try {
    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'midtrans-qris-sim/1.0 (sandbox testing tool)',
        },
        body: formBody.toString(),
      });
    } catch (error) {
      throw networkError(error);
    }

    let finalUrl;
    try {
      finalUrl = new URL(response.url || targetUrl);
    } catch {
      throw new HttpError(502, 'Simulator mengembalikan URL respons yang tidak valid.');
    }
    if (finalUrl.hostname !== SIMULATOR_HOST) {
      throw new HttpError(502, 'Simulator mengalihkan ke domain yang tidak diizinkan. Permintaan dibatalkan.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new HttpError(502, 'Simulator mengembalikan respons non-HTML. Format simulator mungkin berubah.');
    }

    let html;
    try {
      html = await response.text();
    } catch (error) {
      throw networkError(error);
    }

    if (html.length > MAX_SIM_RESPONSE_BYTES) {
      throw new HttpError(502, 'Respons simulator terlalu besar untuk diproses.');
    }
    if (!response.ok) {
      throw new HttpError(502, `Simulator merespons dengan status HTTP ${response.status}.`);
    }

    return { html, status: response.status, finalUrl };
  } finally {
    clearTimeout(timer);
  }
}

function simulatorUrlFromAction(action) {
  if (typeof action !== 'string' || !action.trim()) {
    throw new HttpError(400, 'Aksi form simulator tidak ditemukan. Jalankan Scan QR ulang.');
  }
  if (action.length > 2048) {
    throw new HttpError(400, 'Aksi form simulator terlalu panjang.');
  }

  let url;
  try {
    url = new URL(action, SIMULATOR_ORIGIN + '/v2/qris/');
  } catch {
    throw new HttpError(400, 'Aksi form simulator bukan URL yang valid.');
  }

  if (url.protocol !== 'https:' || url.hostname !== SIMULATOR_HOST) {
    throw new HttpError(400, `Aksi form harus berada di ${SIMULATOR_HOST}.`);
  }
  if (!url.pathname.startsWith('/v2/qris/')) {
    throw new HttpError(400, 'Aksi form simulator di luar jalur QRIS. Permintaan ditolak.');
  }

  return url.toString();
}

function sanitizeFields(raw) {
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpError(400, 'Field "fields" harus berupa objek.');
  }

  const entries = Object.entries(raw);
  if (entries.length > 64) {
    throw new HttpError(400, 'Terlalu banyak field form (maksimal 64).');
  }

  const fields = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z0-9_.:\[\]-]{1,80}$/.test(key)) {
      throw new HttpError(400, `Nama field tidak valid: ${key.slice(0, 40)}`);
    }
    if (typeof value !== 'string') {
      throw new HttpError(400, `Nilai field ${key} harus string.`);
    }
    if (value.length > 16_000) {
      throw new HttpError(400, `Nilai field ${key} terlalu panjang.`);
    }
    fields[key] = value;
  }
  return fields;
}

function validateAmount(raw) {
  if (typeof raw === 'number') raw = String(raw);
  if (typeof raw !== 'string') {
    throw new HttpError(400, 'Nominal harus berupa angka.');
  }
  const value = raw.trim().replace(/[.\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new HttpError(400, 'Nominal harus angka positif, maksimal 2 desimal.');
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new HttpError(400, 'Nominal harus lebih besar dari 0.');
  }
  if (numeric > 1_000_000_000_000) {
    throw new HttpError(400, 'Nominal terlalu besar.');
  }
  return value;
}

/* --------------------------------------------------------------- endpoints */

async function handleScan(req, res) {
  const body = await readJsonBody(req);
  const normalized = normalizeQrInput(body.qr);

  const { html } = await simulatorPost(SIMULATOR_SCAN_URL, new URLSearchParams({
    qrCodeUrl: normalized.qrCodeUrl,
  }));

  const lines = extractPageText(html).split('\n').filter(Boolean);

  if (/unparsable|tidak dapat dibaca/i.test(lines.join(' '))) {
    throw new HttpError(
      422,
      'Simulator tidak dapat membaca QR tersebut. Pastikan transaksi masih valid, belum kedaluwarsa, dan URL berasal dari respons QRIS Core API sandbox.',
      { simulatorMessage: pickMessage(lines, 'failed') }
    );
  }

  const forms = parseForms(html);
  const payForm = forms.find(
    (form) => form.action && (form.fields.referenceId || form.fields.exploreData)
  ) || forms.find(
    (form) => form.action && !Object.keys(form.fields).includes('qrCodeUrl')
  );

  if (!payForm) {
    if (lines.length > 0) {
      const simulatorMessage = pickMessage(lines, 'failed');
      throw new HttpError(
        422,
        `Simulator tidak menampilkan form pembayaran. Pesan simulator: ${simulatorMessage}`,
        { simulatorMessage }
      );
    }
    throw new HttpError(
      502,
      'Simulator tidak mengembalikan form pembayaran. Format halaman simulator mungkin berubah.'
    );
  }

  const action = simulatorUrlFromAction(payForm.action);

  let amountField = null;
  for (const key of Object.keys(payForm.fields)) {
    if (AMOUNT_FIELD_RE.test(key)) {
      amountField = key;
      break;
    }
  }

  const explore = parseExploreData(payForm.fields.exploreData);

  const amountFromField = amountField ? String(payForm.fields[amountField] || '').trim() : '';
  const needsAmount = Boolean(amountField) && !amountFromField;
  const amountFromText = cleanAmountValue(
    findLabeledValue(lines, ['gross amount', 'amount', 'total amount', 'nominal'])
  );
  const transactionAmount = amountFromField || (explore && explore.amount) || amountFromText || null;

  const merchant = (explore && explore.merchant)
    || findLabeledValue(lines, ['merchant name', 'merchant', 'nama merchant']);
  const acquirer = (explore && explore.acquirer) || findLabeledValue(lines, ['acquirer', 'issuer']);
  const statusText = findLabeledValue(lines, ['status', 'transaction status']);

  sendJson(res, 200, {
    ok: true,
    input: normalized,
    action,
    method: 'POST',
    fields: payForm.fields,
    amountField,
    needsAmount,
    amount: needsAmount ? null : transactionAmount,
    suggestedAmount: needsAmount ? transactionAmount : null,
    currency: explore ? explore.currency : null,
    merchant: merchant || null,
    acquirer: acquirer || null,
    referenceId: payForm.fields.referenceId || null,
    statusText: statusText || null,
    summary: excerpt(lines.join(' · '), 1500),
  });
}

async function handlePay(req, res) {
  const body = await readJsonBody(req);

  const action = simulatorUrlFromAction(body.action);
  const fields = sanitizeFields(body.fields);

  const issuer = typeof body.issuer === 'string' ? body.issuer.trim().toLowerCase() : 'gopay';
  if (!ISSUERS.includes(issuer)) {
    throw new HttpError(400, `Issuer tidak dikenal. Pilih salah satu: ${ISSUERS.join(', ')}.`);
  }

  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const amount = validateAmount(body.amount);
    const targetField = Object.keys(fields).find((key) => AMOUNT_FIELD_RE.test(key));
    if (!targetField) {
      throw new HttpError(
        400,
        'Form simulator ini tidak memiliki field nominal. Nominal mengikuti nilai transaksi.'
      );
    }
    fields[targetField] = amount;
  }

  // Isi/override field issuer hanya jika simulator memang memintanya, lalu
  // pastikan issuer selalu terkirim sesuai protokol simulator.
  fields.issuer = issuer;

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);

  const { html } = await simulatorPost(action, form);
  const lines = extractPageText(html).split('\n').filter(Boolean);
  const flat = lines.join(' ');

  const order = parseOrderStatus(flat);
  let status = 'unknown';
  if (order) {
    if (order.status === 'PAID') status = 'paid';
    else if (/^(FAILED|FAIL|DENIED|DENY|EXPIRED|EXPIRE|CANCELLED|CANCELED|CANCEL|ERROR)$/.test(order.status)) {
      status = 'failed';
    }
  } else if (/failed to be processed|unparsable|expired|not found|invalid|denied|cancel|failed/i.test(flat)) {
    status = 'failed';
  } else if (/\bpaid\b|success|berhasil/i.test(flat)) {
    status = 'paid';
  }

  sendJson(res, 200, {
    ok: true,
    status,
    paid: status === 'paid',
    message: pickMessage(lines, status),
    orderId: order ? order.orderId : null,
    simulatorStatus: order ? order.status : null,
    summary: excerpt(lines.join(' · '), 1500),
  });
}

/* ------------------------------------------------------------------ static */

function resolveStaticPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    throw new HttpError(400, 'Path tidak valid.');
  }
  if (decoded.includes('\0')) throw new HttpError(400, 'Path tidak valid.');

  let relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relative);

  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
    throw new HttpError(403, 'Akses ditolak.');
  }
  if (path.basename(resolved).startsWith('.')) {
    throw new HttpError(404, 'File tidak ditemukan.');
  }
  return resolved;
}

async function handleStatic(req, res) {
  const filePath = resolveStaticPath(new URL(req.url, 'http://localhost').pathname);

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    sendText(res, 404, 'File tidak ditemukan.');
    return;
  }

  if (!stat.isFile()) {
    sendText(res, 404, 'File tidak ditemukan.');
    return;
  }

  const type = STATIC_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
      "style-src 'self'; script-src 'self'; connect-src 'self'; " +
      "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

/* ------------------------------------------------------------------ router */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        throw new HttpError(405, 'Endpoint ini hanya menerima POST.');
      }
      if (url.pathname === '/api/scan') {
        await handleScan(req, res);
        return;
      }
      if (url.pathname === '/api/pay') {
        await handlePay(req, res);
        return;
      }
      throw new HttpError(404, 'Endpoint tidak ditemukan.');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      throw new HttpError(405, 'Metode tidak didukung.');
    }

    await handleStatic(req, res);
  } catch (error) {
    if (res.writableEnded) return;

    if (error instanceof HttpError) {
      if (error.status >= 500) {
        console.error(`[midtrans-qris-sim] ${req.method} ${url.pathname} -> ${error.status}: ${error.message}`);
        if (error.details) console.error('[midtrans-qris-sim] detail:', error.details);
      }
      sendJson(res, error.status, {
        ok: false,
        error: {
          status: error.status,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    console.error(`[midtrans-qris-sim] unhandled error on ${req.method} ${url.pathname}:`, error);
    sendJson(res, 500, {
      ok: false,
      error: {
        status: 500,
        message: 'Terjadi kesalahan internal di server simulator. Cek log konsol server.',
      },
    });
  }
});

server.requestTimeout = TIMEOUT_MS + 10_000;
server.headersTimeout = 25_000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[midtrans-qris-sim] berjalan di http://localhost:${PORT}`);
    console.log('[midtrans-qris-sim] hanya menerima QRIS Midtrans sandbox. Tekan Ctrl+C untuk berhenti.');
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[midtrans-qris-sim] Port ${PORT} sudah dipakai. Jalankan dengan PORT lain, misalnya PORT=4322.`);
    } else {
      console.error('[midtrans-qris-sim] Gagal menjalankan server:', error);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  server,
  normalizeQrInput,
  parseForms,
  extractPageText,
  parseExploreData,
  parseOrderStatus,
  simulatorUrlFromAction,
};
