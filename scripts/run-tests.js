// Menjalankan koleksi Postman dengan Newman dan menyimpan hasil lengkap (request, response, assertion) ke JSON.
// Pemakaian: node scripts/run-tests.js [file-output.json]
const newman = require('newman');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const repoRoot = path.join(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, 'postman', 'newman-result.json');
newman.run(
  {
    collection: path.join(repoRoot, 'postman', 'WantToSell.postman_collection.json'),
    reporters: ['cli'],
    color: 'off',
    envVar: [{ key: 'PAYMENT_SERVER_KEY', value: process.env.PAYMENT_SERVER_KEY || '' }],
  },
  (err, summary) => {
    if (err) throw err;
    const executions = summary.run.executions.map((e) => ({
      name: e.item.name,
      folder: e.item.parent && e.item.parent().name,
      description: e.request.description && (e.request.description.content || e.request.description),
      method: e.request.method,
      url: e.request.url.toString(),
      requestHeaders: e.request.headers.toJSON().filter((h) => !h.disabled),
      requestBody: e.request.body ? e.request.body.raw : null,
      code: e.response && e.response.code,
      statusText: e.response && e.response.status,
      timeMs: e.response && e.response.responseTime,
      responseBody: e.response ? e.response.stream.toString() : null,
      assertions: (e.assertions || []).map((a) => ({ name: a.assertion, passed: !a.error, error: a.error && a.error.message })),
    }));
    fs.writeFileSync(out, JSON.stringify({ stats: summary.run.stats, timings: summary.run.timings, executions }, null, 2));
    const failed = summary.run.failures.length;
    console.log(`\nHasil disimpan: ${out}\nAssertion gagal: ${failed}`);
    process.exit(failed ? 1 : 0);
  }
);
