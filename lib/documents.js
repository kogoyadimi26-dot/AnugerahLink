'use strict';

// Dokumen PDF untuk pesanan besar:
//   - perjanjian: dibuat dari penawaran yang disetujui kedua pihak (versi dan hash tercantum);
//   - dokumen pengiriman: daftar kemasan, daftar lot, hasil mutu, dan pernyataan asal.
// Ketentuan di perjanjian adalah draf sampai config/legal.js ditinjau pengacara.
const crypto = require('crypto');
const { Page, buildPdf } = require('./pdf');
const legal = require('../config/legal');
const proposals = require('./proposals');
const config = require('../config/business');

const DELIVERY_LABEL = { collect_jayapura: 'Diambil di Jayapura', delivered: 'Diantar ke alamat tujuan' };
const FREIGHT_LABEL = { buyer: 'pembeli', anugerah: 'AnugerahLink (dihitung terpisah, sesuai biaya)' };
const TERMS = [
  'Harga per kg sesuai tingkat pada daftar harga. Tidak ada diskon volume pada tahap pertama.',
  'Uang muka tidak dikembalikan bila pembeli membatalkan setelah lot dicadangkan. Dikembalikan bila AnugerahLink yang membatalkan.',
  'Tidak ada kredit untuk pembeli baru.',
  'Mutu setiap lot sesuai tingkat, grade, dan skor cupping yang tercantum pada penawaran. Klaim diajukan dalam 48 jam setelah pengantaran, disertai uraian dan foto.',
  'Pembatalan setelah perjanjian hanya dengan kesepakatan tertulis kedua pihak.',
  'Jadwal pengiriman adalah perkiraan. Batas keterlambatan dan kompensasinya perlu dirumuskan pengacara.',
  'Pesanan ekspor berada di luar cakupan tahap pertama.',
  'Hukum yang berlaku dan penyelesaian sengketa perlu ditentukan pengacara.',
];

function idr(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function kgText(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kg';
}
function tierName(t) {
  return (config.tiers[t] && config.tiers[t].label) || t;
}
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Membungkus teks agar tidak keluar dari lebar halaman A4 dengan margin.
function wrap(text, max = 92) {
  const words = String(text).split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) { out.push(cur); cur = w; } else { cur = next; }
  }
  if (cur || out.length === 0) out.push(cur);
  return out;
}

// Penulis halaman: menulis baris demi baris dan pindah halaman otomatis.
class Writer {
  constructor() {
    this.pages = [];
    this.newPage();
  }
  newPage() {
    this.page = new Page();
    this.pages.push(this.page);
    this.y = 790;
  }
  need(h) {
    if (this.y - h < 60) this.newPage();
  }
  text(str, { size = 10, bold = false, gap = 14 } = {}) {
    for (const part of wrap(str)) {
      this.need(gap);
      this.page.text(50, this.y, part, { size, bold });
      this.y -= gap;
    }
  }
  heading(str) {
    this.y -= 8;
    this.need(40);
    this.text(str, { size: 11, bold: true, gap: 18 });
  }
  row(left, right, { bold = false } = {}) {
    this.need(14);
    this.page.text(50, this.y, left, { bold });
    this.page.text(545, this.y, right, { bold, align: 'right' });
    this.y -= 14;
  }
  build() {
    const pdf = buildPdf(this.pages);
    return { pdf, sha256: sha256Hex(pdf) };
  }
}

// Perjanjian untuk penawaran yang sudah disetujui kedua pihak.
function agreementPdf(p, offer, agreedAt) {
  const f = p.form || {};
  const w = new Writer();
  w.text('PERJANJIAN PEMBELIAN KOPI PAPUA', { size: 14, bold: true, gap: 22 });
  if (!legal.reviewed) w.text('DRAF: ketentuan belum ditinjau pengacara dan belum berlaku untuk pesanan nyata.', { bold: true });
  w.text(`No. proposal: ${p.reference}    Versi penawaran: ${offer.version}    Kode ketentuan: ${legal.version}`);
  w.text(`Disetujui kedua pihak: ${agreedAt}`);

  w.heading('1. Para pihak');
  w.text('Penjual: AnugerahLink.');
  w.text(`Pembeli: ${f.company}, NPWP ${f.npwp}, nomor izin usaha ${f.licence}.`);
  w.text(`Kontak: ${f.contactName}${f.contactRole ? ` (${f.contactRole})` : ''}, telepon ${f.phone}, email ${f.email}.`);
  w.text(`Alamat tujuan: ${f.address}, ${f.city}, ${f.country || 'Indonesia'}.`);

  w.heading('2. Lot dan harga');
  for (const l of offer.lines) {
    w.text(`${l.lotCode}  ${tierName(l.tier)}  ${kgText(l.kg)} x ${idr(l.pricePerKg)} per kg = ${idr(l.amount)}`);
  }
  w.row('Total', idr(offer.total), { bold: true });

  w.heading('3. Pembayaran dan pengiriman');
  const dp = Math.round((offer.total * proposals.DEPOSIT_PCT) / 100);
  w.text(`Uang muka ${proposals.DEPOSIT_PCT} persen (${idr(dp)}) dibayar dalam ${proposals.DEPOSIT_DUE_DAYS} hari setelah perjanjian. Pelunasan (${idr(offer.total - dp)}) dibayar sebelum pengiriman.`);
  w.text(`Syarat pengiriman: ${DELIVERY_LABEL[offer.deliveryTerms] || offer.deliveryTerms}. Ongkir ditanggung ${FREIGHT_LABEL[f.freightBy] || '-'}.`);
  w.text(`Penawaran berlaku sampai ${offer.validUntil}.`);

  w.heading('4. Ketentuan (draf, perlu ditinjau pengacara)');
  for (const item of TERMS) w.text(`- ${item}`);

  w.heading('5. Persetujuan');
  w.text(`Perjanjian ini berlaku ketika kedua pihak menyetujui versi penawaran ${offer.version} di aplikasi. Sidik jari penawaran (SHA-256): ${offer.hash}.`);
  return w.build();
}

// Dokumen pengiriman untuk lot-lot pesanan. lots: [{ lotCode, kg, view }] dengan view dari domain.publicLot.
function shipmentDocsPdf(p, lots, now) {
  const f = p.form || {};
  const w = new Writer();
  w.text('DOKUMEN PENGIRIMAN KOPI PAPUA', { size: 14, bold: true, gap: 22 });
  w.text(`No. proposal: ${p.reference}    Pembeli: ${f.company}    Dibuat: ${now}`);
  w.text(`Tujuan: ${f.address}, ${f.city}, ${f.country || 'Indonesia'}.`);

  w.heading('1. Daftar kemasan (packing list)');
  for (const l of lots) {
    w.text(`${l.lotCode}: ${kgText(l.kg)}, kemasan ${f.packaging || 'sesuai kesepakatan'}. Jumlah karung dan berat per karung diisi saat penimbangan: ________`);
  }
  w.row('Total berat', kgText(lots.reduce((a, l) => a + l.kg, 0)), { bold: true });

  w.heading('2. Daftar lot (lot list)');
  for (const l of lots) {
    const v = l.view || {};
    w.text(`${l.lotCode}  ${tierName(v.tier || '')}  panen ${v.harvestDate || '-'}  proses ${v.process || '-'}  kelompok ${v.groupName || '-'}`);
  }

  w.heading('3. Hasil mutu (quality results)');
  for (const l of lots) {
    const v = l.view || {};
    w.text(`${l.lotCode}: grade ${v.grade || '-'}, skor cupping ${v.cupScore || '-'}, proses ${v.process || '-'}.`);
  }

  w.heading('4. Pernyataan asal (origin statement)');
  for (const l of lots) {
    const v = l.view || {};
    w.text(`${l.lotCode} berasal dari ${v.regionName || '-'}${v.regency ? `, ${v.regency}` : ''}, dikelola kelompok ${v.groupName || '-'}, panen ${v.harvestDate || '-'}.`);
  }
  w.text('Kami menyatakan bahwa data asal dan mutu di atas sesuai catatan lot kami.');
  w.text('Nama dan tanda tangan: ______________________    Tanggal: ____________');
  return w.build();
}

module.exports = { agreementPdf, shipmentDocsPdf, idr, wrap };
