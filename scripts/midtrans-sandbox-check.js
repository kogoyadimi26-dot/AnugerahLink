'use strict';

// Uji satu tagihan ke Midtrans sandbox dan tampilkan BENTUK respons mentah (nama field dan tipe),
// lalu hasil yang diekstrak aplikasi. Nilai (nomor VA, QR, kunci) tidak dicetak.
// Cara pakai (di komputer Anda):
//   MIDTRANS_SERVER_KEY=SB-Mid-server-... node scripts/midtrans-sandbox-check.js va_bca
//   MIDTRANS_SERVER_KEY=SB-Mid-server-... node scripts/midtrans-sandbox-check.js qris
const { METHODS, midtransConfig, midtransOrderId, createCharge } = require('../lib/payments');

function shape(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length ? [`array(${value.length}) of`, shape(value[0], depth + 1)] : 'array(0)';
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = depth < 4 ? shape(value[k], depth + 1) : typeof value[k];
    return out;
  }
  return typeof value; // hanya tipe, tanpa isi
}

async function rawCharge(cfg, method, amount, orderNumber, paymentId) {
  const m = METHODS[method];
  const body = {
    payment_type: m.kind === 'va' ? 'bank_transfer' : 'qris',
    transaction_details: { order_id: midtransOrderId(orderNumber, paymentId), gross_amount: amount },
  };
  if (m.kind === 'va') body.bank_transfer = { bank: m.bank };
  if (m.kind === 'qris') body.qris = { acquirer: 'gopay' };
  const res = await fetch(`${cfg.base}/v2/charge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Basic ' + Buffer.from(cfg.key + ':').toString('base64'),
    },
    body: JSON.stringify(body),
  });
  return { httpStatus: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  const method = process.argv[2] || 'va_bca';
  if (!METHODS[method]) {
    console.error(`Metode tidak dikenal: ${method}. Pilih: ${Object.keys(METHODS).join(', ')}`);
    process.exit(1);
  }
  const cfg = midtransConfig();
  if (!cfg) {
    console.error('MIDTRANS_SERVER_KEY belum diisi. Isi dulu di terminal Anda, lalu jalankan lagi.');
    process.exit(1);
  }
  if (cfg.env !== 'sandbox') {
    console.error('Skrip ini hanya untuk sandbox. Atur MIDTRANS_ENV tidak diisi atau sandbox.');
    process.exit(1);
  }
  console.log(`Lingkungan: ${cfg.env}`);

  const stamp = Date.now().toString(36);
  const paymentId = `chk${stamp}`.padEnd(12, '0');
  const orderNumber = `CHK-${stamp}`;
  const amount = 100000;

  try {
    const raw = await rawCharge(cfg, method, amount, orderNumber, paymentId);
    console.log(`\n1) Respons mentah Midtrans (HTTP ${raw.httpStatus}), bentuk saja:`);
    console.log(JSON.stringify(shape(raw.data), null, 2));

    const charge = await createCharge({ paymentId, method, amount, orderNumber, now: new Date().toISOString() });
    console.log('\n2) Hasil yang diekstrak aplikasi (bentuk saja):');
    console.log(JSON.stringify(shape(charge.instructions), null, 2));
    console.log('\nSelesai. Kirim output ini (tanpa nilai rahasia) ke chat untuk dicocokkan.');
  } catch (err) {
    console.error('Gagal:', err.status || '', err.code || '', err.message || err);
    process.exitCode = 1;
  }
}

main();
