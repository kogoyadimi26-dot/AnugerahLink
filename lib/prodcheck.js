'use strict';

// Pemeriksaan sebelum aplikasi dijalankan untuk pengguna sungguhan (NODE_ENV=production).
// Mengembalikan daftar masalah dalam Bahasa Indonesia. Daftar kosong berarti boleh jalan.
const DEFAULT_PASSWORD = 'ganti-saya-sekarang-123';

function productionProblems(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];
  const problems = [];
  if (!env.OWNER_EMAIL) problems.push('OWNER_EMAIL belum diisi.');
  if (!env.OWNER_PASSWORD) problems.push('OWNER_PASSWORD belum diisi.');
  else {
    if (env.OWNER_PASSWORD === DEFAULT_PASSWORD) problems.push('OWNER_PASSWORD masih memakai kata sandi contoh. Ganti dengan kata sandi sendiri.');
    if (env.OWNER_PASSWORD.length < 12) problems.push('OWNER_PASSWORD minimal 12 karakter.');
  }
  if (env.DEMO_ACCOUNTS === '1') problems.push('DEMO_ACCOUNTS=1 tidak boleh dipakai untuk data sungguhan.');
  if (env.DEV_RELOAD === '1') problems.push('DEV_RELOAD=1 hanya untuk pengembangan di komputer Anda.');
  return problems;
}

module.exports = { productionProblems, DEFAULT_PASSWORD };
