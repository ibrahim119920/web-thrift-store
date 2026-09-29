// Menjalankan koleksi Postman dengan Newman dan menyimpan hasil lengkap (request, response, assertion) ke JSON.
// Pemakaian: node scripts/run-tests.js [file-output.json]
const newman = require('newman');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const repoRoot = path.join(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, 'postman', 'newman-result.json');

function parseJsonText(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function pretty(value) {
  if (value === null) return '(tidak ada)';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function firstLines(value, limit = 5) {
  return pretty(value).split(/\r?\n/).slice(0, limit).join('\n');
}

function printExecutionDetails(executions) {
  console.log('\n=== RINCIAN PENGUJIAN API ===');
  executions.forEach((execution, index) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Pengujian ${index + 1}: ${execution.name}`);
    console.log(`Kelompok : ${execution.folder}`);
    console.log(`API      : ${execution.method} ${execution.url}`);
    console.log('Payload  :');
    console.log(pretty(execution.requestPayload));
    console.log(`Status   : ${execution.code || '-'} ${execution.statusText || ''} (${execution.timeMs || 0} ms)`);
    console.log('Hasil (5 baris pertama):');
    console.log(firstLines(execution.responseResult));
    console.log('Assertion:');
    if (!execution.assertions.length) {
      console.log('- (tidak ada)');
    } else {
      execution.assertions.forEach((assertion) => {
        console.log(`- [${assertion.passed ? 'LULUS' : 'GAGAL'}] ${assertion.name}${assertion.error ? `: ${assertion.error}` : ''}`);
      });
    }
  });
}

newman.run(
  {
    collection: path.join(repoRoot, 'postman', 'WantToSell.postman_collection.json'),
    color: 'off',
    envVar: [{ key: 'PAYMENT_SERVER_KEY', value: process.env.PAYMENT_SERVER_KEY || '' }],
  },
  (err, summary) => {
    if (err) throw err;
    const executions = summary.run.executions.map((e) => {
      const requestBody = e.request.body ? e.request.body.raw : null;
      const responseBody = e.response ? e.response.stream.toString() : null;
      return {
        name: e.item.name,
        folder: e.item.parent && e.item.parent().name,
        description: e.request.description && (e.request.description.content || e.request.description),
        method: e.request.method,
        url: e.request.url.toString(),
        requestHeaders: e.request.headers.toJSON().filter((h) => !h.disabled),
        requestBody,
        requestPayload: parseJsonText(requestBody),
        code: e.response && e.response.code,
        statusText: e.response && e.response.status,
        timeMs: e.response && e.response.responseTime,
        responseBody,
        responseResult: parseJsonText(responseBody),
        assertions: (e.assertions || []).map((a) => ({ name: a.assertion, passed: !a.error, error: a.error && a.error.message })),
      };
    });
    fs.writeFileSync(out, JSON.stringify({ stats: summary.run.stats, timings: summary.run.timings, executions }, null, 2));
    printExecutionDetails(executions);
    const failed = summary.run.failures.length;
    console.log(`\nHasil disimpan: ${out}\nAssertion gagal: ${failed}`);
    process.exit(failed ? 1 : 0);
  }
);
