// Kirim email manual lewat Zoho ZeptoMail.
// Contoh:
//   npm run email:send -- --to budi@gmail.com --subject "Halo" --text "Tes kirim email"
//   npm run email:send -- --to "a@x.com,b@y.com" --subject "Promo" --html-file ./promo.html
//   npm run email:send -- --to budi@gmail.com --subject "Tes" --text "Hai" --dry-run
require('dotenv').config();
const fs = require('fs');
const { parseArgs } = require('util');
const { sendEmail } = require('../src/services/emailService');

const USAGE = `Pemakaian: npm run email:send -- --to <email[,email]> --subject <subjek> (--text <isi> | --html <isi> | --html-file <path>)
Opsi tambahan: --cc <email[,email]>  --bcc <email[,email]>  --reply-to <email>  --dry-run`;

const { values: a } = parseArgs({
  options: {
    to: { type: 'string' },
    subject: { type: 'string' },
    text: { type: 'string' },
    html: { type: 'string' },
    'html-file': { type: 'string' },
    cc: { type: 'string' },
    bcc: { type: 'string' },
    'reply-to': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined);

async function main() {
  if (a.help) return console.log(USAGE);
  const html = a['html-file'] ? fs.readFileSync(a['html-file'], 'utf8') : a.html;
  if (!a.to || !a.subject || (!html && !a.text)) {
    console.error(USAGE);
    process.exit(1);
  }

  const email = {
    to: list(a.to),
    subject: a.subject,
    html,
    text: a.text,
    cc: list(a.cc),
    bcc: list(a.bcc),
    replyTo: a['reply-to'],
  };

  if (a['dry-run']) {
    console.log('[dry-run] Email tidak dikirim. Pengirim:', process.env.EMAIL_FROM_ADDRESS || '(EMAIL_FROM_ADDRESS kosong)');
    return console.log(JSON.stringify(email, null, 2));
  }

  const { requestId } = await sendEmail(email);
  console.log(`Email terkirim ke ${email.to.join(', ')} (request_id: ${requestId})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
