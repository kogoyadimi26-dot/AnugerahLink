'use strict';

// Pembaruan dari kurir. Kurir (atau penyedia pelacakan) mengirim kejadian per nomor resi ke webhook.
// Setiap kejadian disimpan di pesanan; "Sudah diantar" menandai pesanan diantar. Kejadian ganda diabaikan.
const { ApiError, str, oneOf, Problems } = require('./validate');
const domain = require('./domain');
const { deliveryEta } = require('./delivery');

const COURIER_EVENTS = {
  picked_up: 'Diambil kurir',
  in_transit: 'Dalam perjalanan',
  out_for_delivery: 'Sedang diantar',
  delivered: 'Sudah diantar',
  exception: 'Kendala pengiriman',
};

function handleCourierEvent(db, body, now) {
  const problems = new Problems();
  const waybill = str(problems, body, 'waybill', { required: true, max: 60, label: 'Nomor resi' });
  const status = oneOf(problems, body, 'status', Object.keys(COURIER_EVENTS), { required: true, label: 'Status' });
  const location = str(problems, body, 'location', { max: 120, label: 'Lokasi' });
  const note = str(problems, body, 'note', { max: 200, label: 'Catatan' });
  const at = body.at ? new Date(body.at) : new Date(now);
  if (Number.isNaN(at.getTime())) problems.add('at', 'Waktu kejadian tidak valid.');
  problems.throwIfAny();

  const order = (db.orders || []).find((o) => o.shipment && o.shipment.waybill === waybill);
  if (!order) throw new ApiError(404, 'not_found', 'Tidak ada pesanan dengan nomor resi tersebut.');

  const shipment = order.shipment;
  shipment.events = shipment.events || [];
  const at_ = at.toISOString();
  if (shipment.events.some((e) => e.status === status && e.at === at_)) return { order, duplicate: true };

  shipment.events.push({ status, label: COURIER_EVENTS[status], at: at_, location: location || '', note: note || '' });
  shipment.events.sort((a, b) => a.at.localeCompare(b.at));
  shipment.lastStatus = status;
  shipment.lastEventAt = shipment.events[shipment.events.length - 1].at;

  if (status === 'delivered' && order.status === 'shipped') {
    domain.updateOrderStatus(db, order.id, { status: 'delivered', note: 'Kurir mengonfirmasi pengiriman.' }, now);
  }
  return { order, duplicate: false };
}

// Pesanan yang sudah dikirim tetapi melewati estimasi tiba. Untuk daftar staf.
function lateOrders(db, now) {
  return (db.orders || [])
    .filter((o) => o.status === 'shipped')
    .map((o) => ({ o, eta: deliveryEta(o, now) }))
    .filter((x) => x.eta.status === 'terlambat')
    .sort((a, b) => b.eta.delay.totalHours - a.eta.delay.totalHours)
    .map(({ o, eta }) => ({
      number: o.number,
      customerName: o.customer.name,
      company: o.customer.company || '',
      phone: o.customer.phone || '',
      email: o.customer.email || '',
      courier: (o.shipment && o.shipment.courier) || '',
      waybill: (o.shipment && o.shipment.waybill) || '',
      shippedAt: (o.shipment && o.shipment.shippedAt) || null,
      promisedBy: eta.latest,
      delayLabel: eta.label,
      delay: eta.delay,
      lastEvent: o.shipment && o.shipment.events && o.shipment.events.length ? o.shipment.events[o.shipment.events.length - 1] : null,
      lateNotifiedAt: o.lateNotifiedAt || null,
    }));
}

module.exports = { handleCourierEvent, lateOrders, COURIER_EVENTS };
