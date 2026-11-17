'use strict';

// Halaman kebijakan. Semua teks di sini DRAF dan harus ditinjau pengacara sebelum dipublikasikan.
// Setelah ditinjau, ubah reviewed menjadi true dan naikkan version (misalnya "v1").
// Versi ini dicatat pada setiap persetujuan pembeli, jadi perubahan teks dapat dibuktikan.
const COMPANY_PLACEHOLDER = 'BELUM DIISI: nama perusahaan';

module.exports = {
  version: 'v1-draft',
  reviewed: false,
  updatedAt: '2026-11-17',
  pages: {
    'kebijakan-privasi': {
      title: 'Kebijakan privasi',
      sections: [
        { h: 'Siapa kami', p: [`AnugerahLink dikelola oleh ${COMPANY_PLACEHOLDER}. Untuk pertanyaan tentang data Anda, hubungi kami lewat email yang tertera di footer.`] },
        { h: 'Data yang kami kumpulkan', p: ['Nama, email, telepon, nama kafe atau perusahaan, jenis pembeli, NPWP (jika Anda isi), alamat pengiriman, riwayat pesanan, dan pesan yang kami kirim kepada Anda.'] },
        { h: 'Untuk apa data digunakan', p: ['Memproses dan mengirim pesanan, membuat faktur, mengabari status pesanan, melayani pertanyaan, dan memenuhi kewajiban pencatatan keuangan dan pajak.'] },
        { h: 'Dasar pemrosesan', p: ['Persetujuan Anda saat mendaftar atau memesan, dan kewajiban hukum untuk catatan transaksi.'] },
        { h: 'Pihak lain', p: ['Penyedia pembayaran, penyedia email dan WhatsApp, serta kurir pengiriman hanya menerima data yang diperlukan untuk layanan mereka. Kami tidak menjual data Anda.'] },
        { h: 'Berapa lama data disimpan', p: ['Selama akun Anda aktif, dan selama diwajibkan hukum untuk catatan transaksi. Lama penyimpanan catatan transaksi: BELUM DITETAPKAN.'] },
        { h: 'Hak Anda', p: ['Anda dapat melihat dan mengunduh data Anda dari menu Akun, memperbaiki data, menghapus akun, dan menarik persetujuan. Saat akun dihapus, data pribadi pada pesanan dihapus dan catatan transaksi tetap disimpan tanpa identitas.'] },
        { h: 'Keamanan', p: ['Kata sandi disimpan dalam bentuk terenkripsi (hash). Akses staf dibatasi dan setiap perubahan dicatat.'] },
        { h: 'Penyimpanan di browser', p: ['Kami menyimpan keranjang dan status masuk di browser Anda. Kami tidak memakai iklan atau pelacak pihak ketiga.'] },
        { h: 'Perubahan', p: ['Jika kebijakan ini berubah, kami memberi tahu di situs. Persetujuan lama tetap tercatat dengan versi yang Anda setujui.'] },
      ],
    },
    syarat: {
      title: 'Syarat penggunaan',
      sections: [
        { h: 'Pemesanan', p: ['Harga per kg mengikuti kategori yang tampil saat Anda memesan. Stok dicadangkan saat pesanan dibuat.'] },
        { h: 'Pembayaran', p: ['Pembayaran dilakukan lewat transfer bank atau QRIS sesuai instruksi di halaman pesanan. Batas waktu pembayaran: BELUM DITETAPKAN.'] },
        { h: 'Pengiriman', p: ['Biaya dan jadwal pengiriman mengikuti ketentuan kategori lot dan alamat tujuan. Nomor resi dikirim lewat pesan setelah pesanan dikirim.'] },
        { h: 'Data yang Anda berikan', p: ['Anda bertanggung jawab atas kebenaran data pemesanan, termasuk alamat dan NPWP untuk faktur.'] },
        { h: 'Faktur', p: ['Faktur dapat diunduh dari halaman pesanan atau menu Akun. Faktur baru berlaku sebagai bukti pembayaran setelah berstatus LUNAS.'] },
      ],
    },
    pengembalian: {
      title: 'Klaim dan pengembalian',
      sections: [
        { h: 'Klaim kualitas', p: ['Jika lot yang diterima tidak sesuai dengan yang dipesan, laporkan lewat halaman Lacak pesanan dalam batas waktu klaim yang tertera di kebijakan Tentang kami.'] },
        { h: 'Proses', p: ['Tim meninjau laporan, dapat meminta foto dan contoh, lalu menentukan penyelesaian. Ketentuan penyelesaian (pengembalian, potongan, atau penggantian): BELUM DITETAPKAN.'] },
      ],
    },
  },
};
