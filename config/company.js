'use strict';

// Data perusahaan untuk faktur. Nilai "BELUM DIISI" harus diganti dengan data resmi sebelum faktur dipakai.
// Isi dari dokumen pendirian dan NPWP perusahaan. Faktur akan menampilkan "BELUM DIISI" bila belum diisi.
module.exports = {
  name: 'BELUM DIISI: nama resmi perusahaan',
  address: 'BELUM DIISI: alamat kantor',
  phone: 'BELUM DIISI',
  email: 'BELUM DIISI',
  npwp: 'BELUM DIISI: NPWP perusahaan',
  bank: { name: 'BELUM DIISI: nama bank', accountName: 'BELUM DIISI', accountNumber: 'BELUM DIISI' },
};
