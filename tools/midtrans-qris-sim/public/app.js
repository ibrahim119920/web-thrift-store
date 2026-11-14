'use strict';

/**
 * Logika klien QRIS Simulator (tanpa library).
 *
 * Bagian parsing (normalizeMidtransInput, parseQrisPayload, classifyPayload)
 * sengaja tidak menyentuh DOM agar bisa diuji langsung dengan Node.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QR_PATH_RE = /^\/v2\/qris\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/qr-code\/?$/i;
const QR_API_HOST = 'api.sandbox.midtrans.com';

/** Ubah UUID atau URL qr-code Midtrans menjadi URL kanonik, atau null. */
function normalizeMidtransInput(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/^["'<]+|["'>]+$/g, '');
  if (!value) return null;

  if (UUID_RE.test(value)) {
    const uuid = value.toLowerCase();
    return { uuid, url: `https://${QR_API_HOST}/v2/qris/${uuid}/qr-code` };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname !== QR_API_HOST) return null;
  if (url.username || url.password || url.port) return null;

  const match = url.pathname.match(QR_PATH_RE);
  if (!match) return null;

  const uuid = match[1].toLowerCase();
  return { uuid, url: `https://${QR_API_HOST}/v2/qris/${uuid}/qr-code` };
}

/** Parse TLV EMVCo sederhana menjadi Map<tag, value>. */
function parseTlv(payload) {
  const tags = new Map();
  let index = 0;
  let guard = 0;

  while (index < payload.length) {
    if (index + 4 > payload.length) {
      throw new Error(`Struktur TLV terpotong pada posisi ${index}.`);
    }
    const tag = payload.slice(index, index + 2);
    const lengthText = payload.slice(index + 2, index + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) {
      throw new Error(`Tag/length TLV tidak valid pada posisi ${index}.`);
    }
    const length = Number.parseInt(lengthText, 10);
    const start = index + 4;
    const end = start + length;
    if (end > payload.length) {
      throw new Error(`Nilai tag ${tag} melebihi panjang payload.`);
    }
    tags.set(tag, payload.slice(start, end));
    index = end;
    guard += 1;
    if (guard > 500) throw new Error('Payload memiliki terlalu banyak tag.');
  }

  return tags;
}

/** Baca merchant (59), kota (60), nominal (54), dan mata uang (53) dari payload QRIS. */
function parseQrisPayload(payload) {
  if (typeof payload !== 'string') throw new Error('Payload QRIS bukan string.');
  const value = payload.trim();
  if (!value.startsWith('000201')) {
    throw new Error('Payload QRIS harus diawali "000201".');
  }

  const tags = parseTlv(value);
  const payloadFormat = tags.get('00');
  if (payloadFormat && payloadFormat !== '01') {
    throw new Error('Payload format indicator tidak dikenali (harus "01").');
  }

  return {
    merchant: (tags.get('59') || '').trim(),
    city: (tags.get('60') || '').trim(),
    amount: (tags.get('54') || '').trim(),
    currency: (tags.get('53') || '').trim(),
    country: (tags.get('58') || '').trim(),
    payloadFormat: payloadFormat || '',
  };
}

/** Klasifikasikan hasil scan/paste: URL Midtrans, payload QRIS EMV, URL lain, atau teks asing. */
function classifyPayload(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { type: 'empty' };

  const midtrans = normalizeMidtransInput(value);
  if (midtrans) return { type: 'midtrans', ...midtrans };

  if (value.startsWith('000201')) {
    try {
      return { type: 'qris-emv', qris: parseQrisPayload(value) };
    } catch (error) {
      return {
        type: 'qris-emv-invalid',
        message: error instanceof Error ? error.message : 'Payload QRIS tidak valid.',
      };
    }
  }

  let url = null;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }
  if (url) return { type: 'unsupported-url', url: value };

  return { type: 'unknown' };
}

/* ------------------------------------------------------------------- klien */

function boot() {
  const el = (id) => document.getElementById(id);

  const qrInput = el('qrInput');
  const scanButton = el('scanButton');
  const cameraButton = el('cameraButton');
  const stopCameraButton = el('stopCameraButton');
  const qrFile = el('qrFile');
  const cameraWrap = el('cameraWrap');
  const cameraVideo = el('cameraVideo');
  const previewWrap = el('previewWrap');
  const previewImage = el('previewImage');
  const cameraSupport = el('cameraSupport');
  const classifyMessage = el('classifyMessage');
  const globalStatus = el('globalStatus');

  const scanCard = el('scanCard');
  const resultMerchant = el('resultMerchant');
  const resultAmount = el('resultAmount');
  const resultAcquirer = el('resultAcquirer');
  const resultStatus = el('resultStatus');
  const resultUuid = el('resultUuid');
  const resultSummary = el('resultSummary');

  const payCard = el('payCard');
  const amountFieldWrap = el('amountFieldWrap');
  const amountInput = el('amountInput');
  const amountReadonly = el('amountReadonly');
  const issuerSelect = el('issuerSelect');
  const payButton = el('payButton');
  const rescanButton = el('rescanButton');

  const resultCard = el('resultCard');
  const paymentBadge = el('paymentBadge');
  const paymentOrder = el('paymentOrder');
  const paymentMessage = el('paymentMessage');
  const paymentSummary = el('paymentSummary');

  const historyEmpty = el('historyEmpty');
  const historyTable = el('historyTable');
  const historyBody = el('historyBody');
  const resetHistoryButton = el('resetHistoryButton');

  const state = {
    scan: null,
    stream: null,
    detector: null,
    timer: null,
    cameraActive: false,
    busy: false,
  };

  const history = [];

  /* ------------------------------------------------------------- utilities */

  function setStatus(text, tone) {
    globalStatus.textContent = text || '';
    globalStatus.className = 'status' + (tone ? ` status-${tone}` : '');
  }

  function showClassify(text, tone) {
    classifyMessage.textContent = text;
    classifyMessage.className = 'note note-multiline' + (tone ? ` note-${tone}` : '');
    classifyMessage.hidden = !text;
  }

  function clearClassify() {
    classifyMessage.textContent = '';
    classifyMessage.hidden = true;
  }

  function formatAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim();
    let numeric = null;
    if (/^\d+$/.test(raw)) numeric = Number(raw);
    else if (/^\d+\.\d{1,2}$/.test(raw)) numeric = Number(raw);
    if (numeric === null || !Number.isFinite(numeric)) return raw;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  async function postJson(path, payload) {
    let response;
    try {
      response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Tidak dapat menghubungi server lokal. Pastikan server.js masih berjalan.');
    }

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message = data && data.error && data.error.message
        ? data.error.message
        : `Server merespons dengan HTTP ${response.status}.`;
      const error = new Error(message);
      if (data && data.error && data.error.details && data.error.details.simulatorMessage) {
        error.simulatorMessage = data.error.details.simulatorMessage;
      }
      throw error;
    }

    if (!data || data.ok !== true) {
      throw new Error('Respons server tidak valid.');
    }
    return data;
  }

  function setBusy(busy) {
    state.busy = busy;
    scanButton.disabled = busy;
    payButton.disabled = busy || !state.scan;
    scanButton.setAttribute('aria-busy', busy ? 'true' : 'false');
    payButton.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  /* ---------------------------------------------------------------- kamera */

  function cameraSupportMessage() {
    if (!window.isSecureContext) {
      return 'Halaman ini tidak berada di secure context. Kamera hanya aktif lewat localhost atau HTTPS — gunakan unggah gambar atau tempel URL.';
    }
    if (typeof window.BarcodeDetector !== 'function') {
      return 'Browser ini belum menyediakan BarcodeDetector (umumnya Firefox/Safari). Gunakan "Unggah gambar QR" atau tempel URL/UUID di atas.';
    }
    return 'Kamera siap. Pastikan halaman ini dibuka di localhost.';
  }

  function cameraErrorMessage(error) {
    const name = error && error.name ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return 'Izin kamera ditolak atau diblokir. Buka pengaturan situs di browser, izinkan kamera untuk localhost, lalu coba lagi. Alternatif: unggah gambar QR atau tempel URL/UUID.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
      return 'Tidak ada kamera yang bisa dipakai. Colokkan kamera atau gunakan unggah gambar / tempel URL.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Kamera sedang dipakai aplikasi lain atau tidak dapat dibuka. Tutup aplikasi lain lalu coba lagi.';
    }
    return `Kamera tidak dapat dimulai (${name || 'unknown error'}). Gunakan unggah gambar QR atau tempel URL.`;
  }

  async function createDetector() {
    if (typeof window.BarcodeDetector !== 'function') {
      throw new Error('BarcodeDetector tidak tersedia di browser ini.');
    }
    if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (!formats.includes('qr_code')) {
        throw new Error('Browser tidak mendukung deteksi format QR.');
      }
    }
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  }

  function scheduleFrameScan() {
    if (!state.cameraActive) return;
    state.timer = window.setTimeout(async () => {
      if (!state.cameraActive) return;
      try {
        const codes = await state.detector.detect(cameraVideo);
        if (codes && codes.length > 0) {
          const raw = codes[0].rawValue;
          stopCamera();
          handleDetected(raw, 'kamera');
          return;
        }
      } catch {
        // Frame individual bisa gagal (mis. video belum siap); lanjut saja.
      }
      scheduleFrameScan();
    }, 350);
  }

  async function startCamera() {
    clearClassify();

    if (!window.isSecureContext) {
      showClassify(
        'Kamera hanya bisa diakses lewat localhost atau HTTPS. Buka http://localhost:4321, bukan IP jaringan.',
        'error'
      );
      return;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      showClassify(
        'Browser ini tidak menyediakan akses kamera (getUserMedia). Gunakan unggah gambar QR atau tempel URL.',
        'error'
      );
      return;
    }
    if (typeof window.BarcodeDetector !== 'function') {
      showClassify(
        'Browser ini tidak mendukung BarcodeDetector, jadi kamera tidak bisa memindai QR. Gunakan "Unggah gambar QR" atau tempel URL/UUID.',
        'error'
      );
      return;
    }

    try {
      state.detector = await createDetector();
    } catch (error) {
      showClassify(
        `Deteksi QR tidak tersedia: ${error.message} Gunakan unggah gambar atau tempel URL.`,
        'error'
      );
      return;
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
    } catch (error) {
      if (error && error.name === 'OverconstrainedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (retryError) {
          showClassify(cameraErrorMessage(retryError), 'error');
          return;
        }
      } else {
        showClassify(cameraErrorMessage(error), 'error');
        return;
      }
    }

    state.stream = stream;
    cameraVideo.srcObject = stream;
    cameraWrap.hidden = false;
    cameraButton.hidden = true;
    stopCameraButton.hidden = false;
    state.cameraActive = true;

    try {
      await cameraVideo.play();
    } catch {
      // Sebagian browser menolak autoplay; video tetap tampil.
    }

    scheduleFrameScan();
  }

  function stopCamera() {
    state.cameraActive = false;
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.stream) {
      for (const track of state.stream.getTracks()) track.stop();
      state.stream = null;
    }
    cameraVideo.srcObject = null;
    cameraWrap.hidden = true;
    cameraButton.hidden = false;
    stopCameraButton.hidden = true;
  }

  /* -------------------------------------------------------------- klasifikasi */

  function showQrisDetails(classification) {
    if (classification.type === 'qris-emv-invalid') {
      showClassify(
        `Payload QRIS tidak dapat dibaca: ${classification.message}\n` +
          'Payload EMVCo tidak memuat URL/UUID transaksi. Ambil URL qr-code dari halaman pembayaran storefront lalu tempel di atas.',
        'error'
      );
      return;
    }

    const qris = classification.qris;
    const parts = [];
    parts.push('QRIS EMV terdeteksi (bukan URL transaksi).');
    parts.push(`Merchant: ${qris.merchant || 'tidak tercantum'}`);
    if (qris.city) parts.push(`Kota: ${qris.city}`);
    parts.push(`Nominal: ${qris.amount ? formatAmount(qris.amount) : 'tidak dicantumkan (statis/dinamis)'}`);
    if (qris.currency && qris.currency !== '360') parts.push(`Mata uang: ${qris.currency}`);
    parts.push(
      'Payload QRIS tidak menyimpan UUID transaksi Midtrans, jadi tidak bisa langsung dibayar di simulator. ' +
        'Salin URL qr-code atau UUID dari halaman pembayaran storefront, lalu tempel di kolom input.'
    );
    showClassify(parts.join('\n'), 'warn');
  }

  function handleDetected(raw, source) {
    const classification = classifyPayload(raw);

    if (classification.type === 'midtrans') {
      qrInput.value = classification.url;
      showClassify(`QR Midtrans terbaca dari ${source}. Menghubungi simulator…`, 'ok');
      runScan(classification.url);
      return;
    }

    if (classification.type === 'qris-emv' || classification.type === 'qris-emv-invalid') {
      showQrisDetails(classification);
      return;
    }

    if (classification.type === 'unsupported-url') {
      let host = classification.url;
      try {
        host = new URL(classification.url).hostname;
      } catch {
        // biarkan teks asli
      }
      showClassify(
        `QR berisi URL non-Midtrans (${host}). Simulator ini hanya menerima URL qr-code dari api.sandbox.midtrans.com.`,
        'error'
      );
      return;
    }

    showClassify(
      'QR/teks tidak dikenali. Yang diterima: URL https://api.sandbox.midtrans.com/v2/qris/<uuid>/qr-code, UUID polos, atau payload QRIS 000201….',
      'error'
    );
  }

  /* -------------------------------------------------------------------- scan */

  function renderScan(data) {
    resultMerchant.textContent = data.merchant || 'Tidak tercantum di halaman simulator';
    resultAcquirer.textContent = data.acquirer || 'Tidak tercantum';
    resultStatus.textContent = data.statusText || 'Menunggu pembayaran';
    resultUuid.textContent = data.input.uuid;
    resultUuid.title = data.input.uuid;
    resultSummary.textContent = data.summary || '—';

    if (data.amount) {
      resultAmount.textContent = formatAmount(data.amount) || String(data.amount);
    } else if (data.needsAmount) {
      resultAmount.textContent = data.suggestedAmount
        ? `Belum diisi (nominal transaksi: ${formatAmount(data.suggestedAmount) || data.suggestedAmount})`
        : 'Belum ditentukan oleh simulator';
    } else {
      resultAmount.textContent = 'Tidak tersedia';
    }

    if (data.needsAmount) {
      amountFieldWrap.hidden = false;
      amountInput.value = data.suggestedAmount ? String(data.suggestedAmount).replace(/[^\d]/g, '') : '';
      amountReadonly.hidden = true;
    } else {
      amountFieldWrap.hidden = true;
      amountReadonly.hidden = false;
      amountReadonly.textContent = data.amount
        ? `Nominal mengikuti transaksi: ${formatAmount(data.amount) || data.amount}. Nilai tidak dapat diubah.`
        : 'Simulator tidak menyediakan field nominal. Nilai mengikuti transaksi yang dibuat backend.';
    }

    scanCard.hidden = false;
    payCard.hidden = false;
    payButton.disabled = false;

    if (data.needsAmount) {
      amountInput.focus();
    }
  }

  async function runScan(qrValue) {
    if (state.busy) return;

    let target = qrValue;
    if (!target) {
      const classification = classifyPayload(qrInput.value);
      if (classification.type === 'midtrans') {
        target = classification.url;
        qrInput.value = classification.url;
      } else if (classification.type === 'qris-emv' || classification.type === 'qris-emv-invalid') {
        showQrisDetails(classification);
        setStatus('QRIS EMV tidak bisa dipakai langsung. Tempel URL/UUID transaksi.', 'error');
        return;
      } else {
        showClassify(
          'Isi URL qr-code Midtrans atau UUID transaksi terlebih dahulu. Contoh: 11111111-1111-4111-8111-111111111111.',
          'error'
        );
        return;
      }
    }

    setBusy(true);
    setStatus('Menghubungi simulator Midtrans…');
    scanCard.hidden = true;
    payCard.hidden = true;
    resultCard.hidden = true;
    state.scan = null;

    try {
      const data = await postJson('/api/scan', { qr: target });
      state.scan = data;
      renderScan(data);
      setStatus(
        `Simulator menerima QR. ${data.needsAmount ? 'Isi nominal lalu pilih issuer.' : 'Periksa nominal lalu pilih issuer.'}`,
        'ok'
      );
      clearClassify();
    } catch (error) {
      const detail = error.simulatorMessage ? ` Pesan simulator: ${error.simulatorMessage}` : '';
      showClassify(`${error.message}${detail}`, 'error');
      setStatus('Scan gagal. Baca pesan di atas.', 'error');
      payButton.disabled = true;
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------------------- bayar */

  function statusLabel(status) {
    if (status === 'paid') return 'PAID';
    if (status === 'failed') return 'GAGAL';
    return 'TIDAK DIKENALI';
  }

  function pushHistory(entry) {
    history.unshift(entry);
    if (history.length > 20) history.pop();
    renderHistory();
  }

  function renderHistory() {
    historyBody.replaceChildren();

    if (history.length === 0) {
      historyEmpty.hidden = false;
      historyTable.hidden = true;
      return;
    }

    historyEmpty.hidden = true;
    historyTable.hidden = false;

    for (const entry of history) {
      const row = document.createElement('tr');

      const timeCell = document.createElement('td');
      timeCell.textContent = entry.time;

      const uuidCell = document.createElement('td');
      uuidCell.className = 'mono';
      uuidCell.textContent = `${entry.uuid.slice(0, 8)}…`;
      uuidCell.title = entry.uuid;

      const amountCell = document.createElement('td');
      amountCell.textContent = entry.amount ? formatAmount(entry.amount) || entry.amount : '—';

      const issuerCell = document.createElement('td');
      issuerCell.textContent = entry.issuer;

      const statusCell = document.createElement('td');
      statusCell.textContent = statusLabel(entry.status);
      statusCell.className = `status-text status-${entry.status}`;

      row.append(timeCell, uuidCell, amountCell, issuerCell, statusCell);
      historyBody.append(row);
    }
  }

  async function pay() {
    if (!state.scan || state.busy) return;

    let amount = null;
    if (state.scan.needsAmount) {
      const digits = amountInput.value.replace(/[^\d]/g, '');
      if (!digits || digits === '0') {
        showClassify('Isi nominal transaksi (angka lebih besar dari 0) sebelum membayar.', 'error');
        amountInput.focus();
        return;
      }
      amount = digits;
    }

    const payload = {
      action: state.scan.action,
      fields: state.scan.fields,
      issuer: issuerSelect.value,
    };
    if (amount) payload.amount = amount;

    setBusy(true);
    setStatus('Mengirim pembayaran ke simulator…');

    try {
      const data = await postJson('/api/pay', payload);

      paymentBadge.textContent = statusLabel(data.status);
      paymentBadge.className = `badge badge-${data.status}`;
      if (data.orderId) {
        paymentOrder.hidden = false;
        paymentOrder.textContent = `Order ID: ${data.orderId}${data.simulatorStatus ? ` · status simulator: ${data.simulatorStatus}` : ''}`;
      } else {
        paymentOrder.hidden = true;
        paymentOrder.textContent = '';
      }
      paymentMessage.textContent = data.message || 'Simulator tidak memberi pesan.';
      paymentSummary.textContent = data.summary || '—';
      resultCard.hidden = false;

      pushHistory({
        time: new Date().toLocaleTimeString('id-ID', { hour12: false }),
        uuid: state.scan.input.uuid,
        amount: amount || state.scan.amount || null,
        issuer: issuerSelect.value,
        status: data.status,
      });

      if (data.status === 'paid') {
        setStatus('Pembayaran berhasil: simulator menyatakan PAID.', 'ok');
      } else if (data.status === 'failed') {
        setStatus('Pembayaran gagal menurut simulator. Lihat pesan aslinya di bawah.', 'error');
      } else {
        setStatus('Simulator merespons, tetapi status tidak dapat dipastikan. Periksa teks respons.', 'warn');
      }

      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      const detail = error.simulatorMessage ? ` Pesan simulator: ${error.simulatorMessage}` : '';
      paymentBadge.textContent = 'ERROR';
      paymentBadge.className = 'badge badge-failed';
      paymentOrder.hidden = true;
      paymentOrder.textContent = '';
      paymentMessage.textContent = `${error.message}${detail}`;
      paymentSummary.textContent = '';
      resultCard.hidden = false;
      setStatus('Pembayaran gagal dikirim. Baca pesan di bawah.', 'error');
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------------- events */

  scanButton.addEventListener('click', () => runScan(null));

  qrInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runScan(null);
    }
  });

  cameraButton.addEventListener('click', startCamera);
  stopCameraButton.addEventListener('click', () => {
    stopCamera();
    setStatus('Kamera dihentikan.');
  });

  rescanButton.addEventListener('click', () => {
    qrInput.focus();
    qrInput.select();
    setStatus('Tempel URL/UUID (atau scan ulang), lalu tekan Scan QR.');
  });

  payButton.addEventListener('click', pay);

  resetHistoryButton.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
    setStatus('Riwayat di halaman ini sudah direset.');
  });

  qrFile.addEventListener('change', async () => {
    const file = qrFile.files && qrFile.files[0];
    if (!file) return;

    clearClassify();

    if (!file.type.startsWith('image/')) {
      showClassify('File harus berupa gambar (PNG/JPG/WebP).', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showClassify('Ukuran gambar terlalu besar (maksimal 8 MB).', 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewImage.src = objectUrl;
    previewWrap.hidden = false;
    previewImage.onload = () => URL.revokeObjectURL(objectUrl);

    if (typeof window.BarcodeDetector !== 'function') {
      showClassify(
        'Browser ini tidak mendukung BarcodeDetector, jadi gambar tidak bisa dibaca otomatis. Tempel URL/UUID secara manual.',
        'error'
      );
      qrFile.value = '';
      return;
    }

    setStatus('Membaca QR dari gambar…');

    try {
      const detector = await createDetector();
      let source;
      if (typeof window.createImageBitmap === 'function') {
        source = await createImageBitmap(file);
      } else {
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Gambar tidak dapat dimuat.'));
          image.src = objectUrl;
        });
      }

      const codes = await detector.detect(source);
      if (source.close) source.close();

      if (!codes || codes.length === 0) {
        showClassify(
          'Tidak ada QR yang terdeteksi pada gambar. Pastikan QR terlihat jelas, tidak blur, dan memenuhi gambar.',
          'error'
        );
        setStatus('Gambar tidak memuat QR yang terbaca.', 'error');
        return;
      }

      handleDetected(codes[0].rawValue, 'unggahan gambar');
    } catch (error) {
      showClassify(
        `Gagal membaca QR dari gambar: ${error.message || 'kesalahan tidak diketahui'}. Coba screenshot yang lebih tajam atau tempel URL.`,
        'error'
      );
    } finally {
      qrFile.value = '';
    }
  });

  window.addEventListener('pagehide', stopCamera);

  cameraSupport.textContent = cameraSupportMessage();
  renderHistory();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeMidtransInput,
    parseTlv,
    parseQrisPayload,
    classifyPayload,
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
