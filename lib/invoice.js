'use strict';

// Faktur PDF untuk satu pesanan. Data perusahaan diambil dari config/company.js.
const { Page, buildPdf } = require('./pdf');
const company = require('../config/company');

const PAID = ['paid', 'shipped', 'delivered', 'completed'];

function rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function kg(n) { return Number(n || 0).toLocaleString('id-ID') + ' kg'; }
function tgl(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function invoicePdf(order, now = new Date().toISOString()) {
  const p = new Page();
  const c = order.customer || {};
  const paid = PAID.includes(order.status);

  // Kop perusahaan
  p.text(40, 800, company.name, { size: 14, bold: true });
  p.text(40, 785, company.address, { size: 9 });
  p.text(40, 772, `Telepon ${company.phone} | ${company.email}`, { size: 9 });
  p.text(40, 759, `NPWP ${company.npwp}`, { size: 9 });

  // Judul dan nomor
  p.text(555, 800, 'FAKTUR', { size: 18, bold: true, align: 'right' });
  p.text(555, 782, `No. faktur: INV-${order.number}`, { size: 9, align: 'right' });
  p.text(555, 768, `No. pesanan: ${order.number}`, { size: 9, align: 'right' });
  p.text(555, 754, `Tanggal: ${tgl(order.createdAt)}`, { size: 9, align: 'right' });
  p.text(555, 740, `Status: ${paid ? 'LUNAS' : 'BELUM LUNAS'}`, { size: 9, bold: true, align: 'right' });
  p.line(40, 728, 555, 728, 1);

  // Pembeli
  p.text(40, 712, 'Ditagihkan kepada', { size: 10, bold: true });
  const buyerLines = [
    c.name,
    c.company || '',
    `NPWP: ${c.npwp || 'tidak diisi'}`,
    `Telepon: ${c.phone || '-'}`,
    `Email: ${c.email || '-'}`,
    `Alamat: ${[c.street, c.city].filter(Boolean).join(', ') || '-'}`,
  ].filter((l) => l !== '');
  buyerLines.forEach((l, i) => p.text(40, 697 - i * 14, l, { size: 9 }));

  // Tabel barang
  let y = 596;
  const cols = { no: 40, lot: 70, cat: 200, kg: 365, price: 440, total: 555 };
  p.text(cols.no, y, 'No', { size: 9, bold: true });
  p.text(cols.lot, y, 'Lot', { size: 9, bold: true });
  p.text(cols.cat, y, 'Kategori', { size: 9, bold: true });
  p.text(cols.kg, y, 'Jumlah', { size: 9, bold: true, align: 'right' });
  p.text(cols.price, y, 'Harga/kg', { size: 9, bold: true, align: 'right' });
  p.text(cols.total, y, 'Jumlah harga', { size: 9, bold: true, align: 'right' });
  p.line(40, y - 5, 555, y - 5, 0.8);
  y -= 20;
  order.lines.forEach((line, i) => {
    p.text(cols.no, y, String(i + 1), { size: 9 });
    p.text(cols.lot, y, line.lotCode, { size: 9 });
    p.text(cols.cat, y, line.tierLabel || line.tier || '', { size: 9 });
    p.text(cols.kg, y, kg(line.kg), { size: 9, align: 'right' });
    p.text(cols.price, y, rp(line.pricePerKg), { size: 9, align: 'right' });
    p.text(cols.total, y, rp(line.lineTotal), { size: 9, align: 'right' });
    y -= 16;
  });
  p.line(40, y + 8, 555, y + 8, 0.5);

  // Ringkasan
  y -= 6;
  p.text(440, y, 'Subtotal', { size: 9, align: 'right' }); p.text(555, y, rp(order.subtotal), { size: 9, align: 'right' }); y -= 14;
  p.text(440, y, 'Ongkir', { size: 9, align: 'right' }); p.text(555, y, rp(order.shipping), { size: 9, align: 'right' }); y -= 14;
  p.text(440, y, 'Total', { size: 10, bold: true, align: 'right' }); p.text(555, y, rp(order.total), { size: 10, bold: true, align: 'right' });

  // Pembayaran
  y -= 40;
  p.text(40, y, 'Pembayaran', { size: 10, bold: true }); y -= 14;
  p.text(40, y, `Transfer ke ${company.bank.name}, a.n. ${company.bank.accountName}, no. rekening ${company.bank.accountNumber}.`, { size: 9 }); y -= 13;
  p.text(40, y, `Cantumkan nomor pesanan ${order.number} sebagai berita transfer.`, { size: 9 });

  p.line(40, 90, 555, 90, 0.5);
  p.text(40, 76, `Faktur dibuat otomatis oleh AnugerahLink pada ${tgl(now)}. ${paid ? '' : 'Faktur ini belum lunas.'}`.trim(), { size: 8 });
  p.text(40, 64, 'Untuk pertanyaan tentang faktur ini, hubungi tim AnugerahLink.', { size: 8 });
  return buildPdf([p]);
}

module.exports = { invoicePdf };
