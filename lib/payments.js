'use strict';

// Pembayaran online: virtual account dan QRIS.
// - Dengan MIDTRANS_SERVER_KEY: memakai Midtrans Core API (sandbox atau production).
// - Tanpa kunci: penyedia simulasi lokal untuk uji coba alur.
// Data kartu atau rekening pembeli tidak pernah disimpan di aplikasi ini.
const crypto = require('crypto');
const { ApiError } = require('./validate');

const METHODS = {
  va_bca: { label: 'Virtual Account BCA', kind: 'va', bank: 'bca' },
  va_bni: { label: 'Virtual Account BNI', kind: 'va', bank: 'bni' },
  qris: { label: 'QRIS', kind: 'qris' },
};
const MIDTRANS_BASE = { sandbox: 'https://api.sandbox.midtrans.com', production: 'https://api.midtrans.com' };
const VA_EXPIRY_HOURS = 24;

function midtransConfig() {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return null;
  const env = process.env.MIDTRANS_ENV === 'production' ? 'production' : 'sandbox';
  return { key, env, base: MIDTRANS_BASE[env] };
}

function randomDigits(n) {
  let s = '';
  while (s.length < n) s += String(crypto.randomInt(0, 10));
  return s;
}

// Kode pesanan untuk Midtrans harus unik per transaksi.
function midtransOrderId(orderNumber, paymentId) {
  return `${orderNumber}-${paymentId.slice(0, 8)}`;
}

// Buat tagihan. Mengembalikan providerRef (kunci untuk pesan konfirmasi) dan petunjuk untuk pembeli.
async function createCharge({ paymentId, method, amount, orderNumber, now }) {
  const m = METHODS[method];
  if (!m) throw new ApiError(400, 'invalid_input', 'Pilih metode pembayaran.');
  const cfg = midtransConfig();
  if (cfg) return midtransCharge(cfg, { paymentId, method, amount, orderNumber, now });
  return simulatedCharge({ paymentId, method, amount, orderNumber, now });
}

async function midtransCharge(cfg, { paymentId, method, amount, orderNumber, now }) {
  const m = METHODS[method];
  const orderId = midtransOrderId(orderNumber, paymentId);
  const body = {
    payment_type: m.kind === 'va' ? 'bank_transfer' : 'qris',
    transaction_details: { order_id: orderId, gross_amount: amount },
  };
  if (m.kind === 'va') body.bank_transfer = { bank: m.bank };
  if (m.kind === 'qris') body.qris = { acquirer: 'gopay' };

  let res;
  try {
    res = await fetch(`${cfg.base}/v2/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(cfg.key + ':').toString('base64'),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(502, 'provider_unreachable', 'Pembayaran belum bisa dibuat sekarang. Coba lagi sebentar.');
  }
  const data = await res.json().catch(() => ({}));
  const code = String(data.status_code || res.status);
  if (!res.ok || !['200', '201'].includes(code)) {
    throw new ApiError(502, 'provider_error', 'Pembayaran belum bisa dibuat. Silakan hubungi tim.');
  }
  if (m.kind === 'va') {
    const va = (data.va_numbers || [])[0];
    if (!va) throw new ApiError(502, 'provider_error', 'Nomor virtual account tidak diterima. Silakan hubungi tim.');
    return {
      providerRef: orderId,
      instructions: { kind: 'va', bank: m.label, vaNumber: va.va_number, amount, expiresAt: data.expiry_time || null },
    };
  }
  const qr = (data.actions || []).find((a) => a.name === 'generate-qr-code');
  return {
    providerRef: orderId,
    instructions: { kind: 'qris', label: 'QRIS', qrUrl: qr ? qr.url : null, payload: data.qr_string || null, amount },
  };
}

function simulatedCharge({ paymentId, method, amount, orderNumber, now }) {
  const m = METHODS[method];
  if (m.kind === 'va') {
    const vaNumber = `${method === 'va_bca' ? '014' : '009'}88000${randomDigits(8)}`;
    return {
      providerRef: `sbx-${paymentId}`,
      instructions: { kind: 'va', bank: m.label, vaNumber, amount, expiresAt: new Date(Date.parse(now) + VA_EXPIRY_HOURS * 3600000).toISOString() },
    };
  }
  return {
    providerRef: `sbx-${paymentId}`,
    instructions: { kind: 'qris', label: 'QRIS', qrUrl: null, payload: `SBX-QRIS|${orderNumber}|${paymentId}|${amount}`, amount },
  };
}

// Tanda tangan notifikasi Midtrans: SHA-512 atas order_id + status_code + gross_amount + server key.
function midtransSignature(n, serverKey) {
  return crypto.createHash('sha512').update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`).digest('hex');
}
function verifyMidtransNotification(n, serverKey) {
  if (!serverKey || !n || typeof n.signature_key !== 'string') return false;
  const expected = Buffer.from(midtransSignature(n, serverKey), 'hex');
  const given = Buffer.from(n.signature_key, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
// Status yang berarti dana sudah masuk.
function isMidtransPaid(n) {
  return n.transaction_status === 'settlement' || (n.transaction_status === 'capture' && n.fraud_status === 'accept');
}

// Tanda tangan webhook: HMAC-SHA256 atas "<timestamp>.<body>", sehingga pesan lama tidak bisa diputar ulang.
const WEBHOOK_MAX_AGE_SECONDS = 300;

function signWebhook(rawBody, secret, timestamp) {
  if (!Number.isInteger(timestamp)) throw new TypeError('timestamp harus bilangan bulat (detik Unix)');
  return crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
}

// Mengembalikan true hanya bila tanda tangan cocok DAN timestamp masih dalam 5 menit.
function verifyWebhook(rawBody, signature, secret, timestampHeader, nowMs = Date.now()) {
  if (!secret || typeof signature !== 'string' || typeof timestampHeader !== 'string') return false;
  if (!/^\d{1,12}$/.test(timestampHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (Math.abs(nowMs / 1000 - timestamp) > WEBHOOK_MAX_AGE_SECONDS) return false;
  if (!/^[0-9a-f]+$/i.test(signature)) return false;
  const expected = Buffer.from(signWebhook(rawBody, secret, timestamp), 'hex');
  if (signature.length !== expected.length * 2) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expected);
}

module.exports = {
  METHODS, midtransConfig, midtransOrderId, createCharge,
  midtransSignature, verifyMidtransNotification, isMidtransPaid,
  signWebhook, verifyWebhook, WEBHOOK_MAX_AGE_SECONDS,
};
