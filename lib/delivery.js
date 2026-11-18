'use strict';

// Estimasi tiba dan keterlambatan. Dihitung dari tanggal pesanan dikirim (shipment.shippedAt).
// Janji dihitung dari batas akhir perkiraan transit, supaya keterlambatan tidak dianggap terlalu cepat.
const config = require('../config/business');

const HOUR = 3600000;
const DAY = 24 * HOUR;

function entryAt(order, status) {
  const e = (order.timeline || []).find((t) => t.status === status);
  return e ? e.at : null;
}

// Mengubah selisih waktu menjadi hari dan jam.
function breakdown(ms) {
  const totalHours = Math.max(0, Math.round(ms / HOUR));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24, totalHours };
}

function deliveryEta(order, nowIso, cfg = config.delivery) {
  if (order.status === 'cancelled') return { status: 'dibatalkan', label: 'Dibatalkan' };
  const shippedAt = (order.shipment && order.shipment.shippedAt) || entryAt(order, 'shipped');
  if (!shippedAt) return { status: 'belum_dikirim', label: 'Belum dikirim', earliest: null, latest: null };

  const t0 = Date.parse(shippedAt);
  const earliest = new Date(t0 + cfg.transitDaysMin * DAY).toISOString();
  const latest = new Date(t0 + cfg.transitDaysMax * DAY).toISOString();
  const promised = Date.parse(latest);
  const deliveredAt = entryAt(order, 'delivered');

  if (deliveredAt) {
    const late = Date.parse(deliveredAt) - promised;
    if (late <= 0) return { status: 'tepat_waktu', label: 'Diantar tepat waktu', earliest, latest, deliveredAt };
    const delay = breakdown(late);
    return { status: 'terlambat', label: `Diantar terlambat ${delay.days} hari ${delay.hours} jam`, earliest, latest, deliveredAt, delay };
  }

  const diff = promised - Date.parse(nowIso);
  if (diff >= 0) {
    const remaining = breakdown(diff);
    return { status: 'dalam_perjalanan', label: `Sisa ${remaining.days} hari ${remaining.hours} jam`, earliest, latest, remaining };
  }
  const delay = breakdown(-diff);
  return { status: 'terlambat', label: `Terlambat ${delay.days} hari ${delay.hours} jam`, earliest, latest, delay };
}

module.exports = { deliveryEta, breakdown };
