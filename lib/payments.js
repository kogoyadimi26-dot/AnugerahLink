'use strict';

// Pembayaran online: virtual account dan QRIS.
// Saat ini hanya penyedia "sandbox" (simulasi). Untuk penyedia sungguhan (mis. Midtrans atau Xendit),
// ganti isi createCharge dan verifyWebhook; alur pesanan tidak berubah.
// Data kartu atau rekening pembeli tidak pernah disimpan di aplikasi ini.
const crypto = require('crypto');

const METHODS = {
  va_bca: { label: 'Virtual Account BCA', kind: 'va', bankCode: '014' },
  va_bni: { label: 'Virtual Account BNI', kind: 'va', bankCode: '009' },
  qris: { label: 'QRIS', kind: 'qris', bankCode: null },
};
const VA_EXPIRY_HOURS = 24;

function randomDigits(n) {
  let s = '';
  while (s.length < n) s += String(crypto.randomInt(0, 10));
  return s;
}

// Buat tagihan. Mengembalikan petunjuk untuk pembeli.
function createCharge({ paymentId, method, amount, orderNumber, now }) {
  const m = METHODS[method];
  if (!m) throw new Error(`Metode tidak dikenal: ${method}`);
  if (m.kind === 'va') {
    // Nomor VA = kode bank + kode perusahaan (sandbox: 5 digit) + nomor unik.
    const vaNumber = `${m.bankCode}${'88000'}${randomDigits(8)}`;
    return {
      providerRef: `sbx-${paymentId}`,
      instructions: { kind: 'va', bank: m.label, vaNumber, amount, expiresAt: new Date(Date.parse(now) + VA_EXPIRY_HOURS * 3600000).toISOString() },
    };
  }
  // QRIS: payload teks. Penyedia sungguhan mengembalikan string QRIS yang dirender menjadi gambar.
  const payload = `SBX-QRIS|${orderNumber}|${paymentId}|${amount}`;
  return {
    providerRef: `sbx-${paymentId}`,
    instructions: { kind: 'qris', label: 'QRIS', payload, amount },
  };
}

// Verifikasi pesan dari penyedia: tanda tangan HMAC-SHA256 atas isi mentah, dengan rahasia dari lingkungan.
function signWebhook(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}
function verifyWebhook(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string') return false;
  const expected = Buffer.from(signWebhook(rawBody, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

module.exports = { METHODS, createCharge, signWebhook, verifyWebhook };
