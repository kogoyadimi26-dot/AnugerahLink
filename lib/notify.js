'use strict';

// Pesan status pesanan lewat email dan WhatsApp. Pesan disimpan dulu di antrean (db.outbox),
// lalu dikirim oleh pengirim yang hanya aktif bila penyedia sudah diatur di lingkungan.
// Tanpa pengaturan, pesan tetap "menunggu" dan terlihat oleh admin. Tidak ada data yang dikirim ke pihak lain tanpa pengaturan.
const crypto = require('crypto');

const { deliveryEta } = require('./delivery');

const MAX_ATTEMPTS = 3;

function trackLink(order) {
  return `${process.env.PUBLIC_URL || ''}/#/track/${encodeURIComponent(order.number)}`;
}

const TEMPLATES = {
  late: (o) => {
    const e = deliveryEta(o, new Date().toISOString());
    const d = e.delay ? `${e.delay.days} hari ${e.delay.hours} jam` : '';
    return {
      subject: `Pesanan ${o.number} terlambat dari estimasi`,
      text: `Mohon maaf, pesanan ${o.number} terlambat ${d} dari estimasi tiba. Kami sedang memantau pengiriman dan akan mengabari Anda. Lacak pesanan di ${trackLink(o)}`,
    };
  },
  paid: (o) => ({
    subject: `Pembayaran ${o.number} kami terima`,
    text: `Terima kasih. Pembayaran pesanan ${o.number} sudah kami terima. Tim akan menyiapkan pengiriman dan mengabari Anda.`,
  }),
  shipped: (o) => {
    const s = o.shipment || {};
    const resi = s.waybill ? ` Nomor resi: ${s.waybill}${s.courier ? ' (' + s.courier + ')' : ''}.` : '';
    return { subject: `Pesanan ${o.number} sudah dikirim`, text: `Pesanan ${o.number} sudah dikirim.${resi} Lacak pesanan di ${trackLink(o)}` };
  },
  delivered: (o) => ({
    subject: `Pesanan ${o.number} sudah diantar`,
    text: `Pesanan ${o.number} sudah diantar. Mohon konfirmasi penerimaan di ${trackLink(o)}`,
  }),
  cancelled: (o) => ({
    subject: `Pesanan ${o.number} dibatalkan`,
    text: `Pesanan ${o.number} dibatalkan. Jika ada pertanyaan, balas pesan ini atau hubungi tim AnugerahLink.`,
  }),
};

// Dipanggil setiap kali status pesanan berubah. Hanya status yang punya templat yang masuk antrean.
function enqueueForOrder(db, order, event, now) {
  const template = TEMPLATES[event];
  if (!template) return [];
  db.outbox = db.outbox || [];
  const { subject, text } = template(order);
  const items = [];
  const base = { id: crypto.randomUUID(), orderNumber: order.number, event, subject, body: text, status: 'queued', attempts: 0, createdAt: now, lastError: null };
  if (order.customer.email) items.push({ ...base, id: crypto.randomUUID(), channel: 'email', to: order.customer.email });
  if (order.customer.phone) items.push({ ...base, id: crypto.randomUUID(), channel: 'whatsapp', to: order.customer.phone });
  db.outbox.push(...items);
  return items;
}

// Pengirim. Email memakai API HTTP (EMAIL_API_URL, EMAIL_API_KEY, EMAIL_FROM).
// WhatsApp memakai gateway HTTP (WA_API_URL, WA_API_TOKEN). Keduanya dikirim sebagai JSON.
function providers(env) {
  const out = {};
  if (env.EMAIL_API_URL && env.EMAIL_API_KEY && env.EMAIL_FROM) {
    out.email = async (item, doFetch) => {
      const res = await doFetch(env.EMAIL_API_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.EMAIL_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [item.to], subject: item.subject, text: item.body }),
      });
      if (!res.ok) throw new Error('Penyedia email menolak pesan (' + res.status + ').');
    };
  }
  if (env.WA_API_URL && env.WA_API_TOKEN) {
    out.whatsapp = async (item, doFetch) => {
      const res = await doFetch(env.WA_API_URL, {
        method: 'POST',
        headers: { Authorization: env.WA_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: item.to, message: item.body }),
      });
      if (!res.ok) throw new Error('Gateway WhatsApp menolak pesan (' + res.status + ').');
    };
  }
  return out;
}

// Kirim pesan yang masih menunggu. Mengembalikan ringkasan. Dipanggil berkala oleh server.
async function dispatchOutbox(store, env = process.env, doFetch = fetch, now = () => new Date().toISOString()) {
  const send = providers(env);
  const pending = (store.read().outbox || []).filter((m) => m.status === 'queued' && m.attempts < MAX_ATTEMPTS);
  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const item of pending) {
    if (!send[item.channel]) { summary.skipped++; continue; }
    let error = null;
    try { await send[item.channel](item, doFetch); } catch (err) { error = err.message || 'Gagal mengirim.'; }
    store.update((db) => {
      const m = (db.outbox || []).find((x) => x.id === item.id);
      if (!m) return;
      m.attempts += 1;
      if (error) {
        m.lastError = error;
        m.status = m.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
      } else {
        m.status = 'sent';
        m.sentAt = now();
        m.lastError = null;
      }
    });
    if (error) summary.failed++; else summary.sent++;
  }
  return summary;
}

function providerStatus(env = process.env) {
  return { email: Boolean(env.EMAIL_API_URL && env.EMAIL_API_KEY && env.EMAIL_FROM), whatsapp: Boolean(env.WA_API_URL && env.WA_API_TOKEN) };
}

// Email untuk akun pembeli: konfirmasi email dan atur ulang kata sandi. Tautannya berisi token sekali pakai.
const ACCOUNT_TEMPLATES = {
  verify: (url) => ({
    subject: 'Konfirmasi email akun AnugerahLink',
    text: `Klik tautan ini untuk mengonfirmasi email akun Anda. Tautan berlaku 3 hari: ${url}`,
  }),
  reset: (url) => ({
    subject: 'Atur ulang kata sandi AnugerahLink',
    text: `Klik tautan ini untuk membuat kata sandi baru. Tautan berlaku 60 menit dan hanya bisa dipakai sekali: ${url}. Jika Anda tidak meminta ini, abaikan pesan ini.`,
  }),
};

function enqueueAccountEmail(db, kind, to, url, now) {
  const template = ACCOUNT_TEMPLATES[kind];
  if (!template || !to) return null;
  db.outbox = db.outbox || [];
  const { subject, text } = template(url);
  const item = { id: crypto.randomUUID(), orderNumber: null, event: kind, channel: 'email', to, subject, body: text, status: 'queued', attempts: 0, createdAt: now, lastError: null };
  db.outbox.push(item);
  return item;
}

// Dipanggil berkala. Mengirim satu pemberitahuan keterlambatan per pesanan, lalu mencatat waktunya.
function notifyLateOrders(db, now) {
  const late = (db.orders || []).filter((o) => !o.lateNotifiedAt && o.status === 'shipped' && deliveryEta(o, now).status === 'terlambat');
  for (const o of late) {
    enqueueForOrder(db, o, 'late', now);
    o.lateNotifiedAt = now;
  }
  return late.map((o) => o.number);
}

module.exports = { notifyLateOrders, enqueueForOrder, enqueueAccountEmail, dispatchOutbox, providerStatus, TEMPLATES, MAX_ATTEMPTS };
