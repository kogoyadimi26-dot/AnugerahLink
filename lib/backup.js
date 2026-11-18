'use strict';

// Cadangan dan pemulihan data: database SQLite dan folder foto.
// Cadangan dibuat dengan VACUUM INTO, jadi salinannya konsisten meski server sedang berjalan.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

// Membuat cadangan di folder baru: <backupRoot>/<waktu>/app.db dan photos/.
function createBackup({ dataFile, backupRoot, date = new Date() }) {
  if (!fs.existsSync(dataFile)) throw new Error(`Database tidak ditemukan: ${dataFile}`);
  const dest = path.join(backupRoot, stamp(date));
  fs.mkdirSync(dest, { recursive: true });
  const target = path.join(dest, 'app.db');
  const conn = new DatabaseSync(dataFile);
  try {
    conn.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    conn.close();
  }
  const photos = path.join(path.dirname(dataFile), 'photos');
  let photoCount = 0;
  if (fs.existsSync(photos)) {
    fs.cpSync(photos, path.join(dest, 'photos'), { recursive: true });
    photoCount = fs.readdirSync(photos).length;
  }
  return { dest, photoCount };
}

// Memulihkan cadangan ke folder data. Data yang ada lebih dulu disalin ke folder "sebelum-pulih-<waktu>".
function restoreBackup({ backupDir, dataFile, date = new Date() }) {
  const src = path.join(backupDir, 'app.db');
  if (!fs.existsSync(src)) throw new Error(`Cadangan tidak lengkap: app.db tidak ada di ${backupDir}`);
  const dataDir = path.dirname(dataFile);
  fs.mkdirSync(dataDir, { recursive: true });
  let safetyCopy = null;
  if (fs.existsSync(dataFile)) {
    safetyCopy = path.join(dataDir, 'sebelum-pulih-' + stamp(date));
    fs.mkdirSync(safetyCopy, { recursive: true });
    fs.copyFileSync(dataFile, path.join(safetyCopy, 'app.db'));
    const photos = path.join(dataDir, 'photos');
    if (fs.existsSync(photos)) fs.cpSync(photos, path.join(safetyCopy, 'photos'), { recursive: true });
  }
  fs.copyFileSync(src, dataFile);
  const srcPhotos = path.join(backupDir, 'photos');
  if (fs.existsSync(srcPhotos)) fs.cpSync(srcPhotos, path.join(dataDir, 'photos'), { recursive: true });
  return { safetyCopy };
}

// Menghapus folder cadangan yang lebih tua dari keepDays hari. Hanya folder dengan nama waktu yang dihapus.
function pruneBackups({ backupRoot, keepDays, now = new Date() }) {
  if (!fs.existsSync(backupRoot) || !(keepDays > 0)) return [];
  const cutoff = now.getTime() - keepDays * 86400000;
  const removed = [];
  for (const name of fs.readdirSync(backupRoot)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(name);
    if (!m) continue;
    const when = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])).getTime();
    if (when < cutoff) {
      fs.rmSync(path.join(backupRoot, name), { recursive: true, force: true });
      removed.push(name);
    }
  }
  return removed;
}

module.exports = { createBackup, restoreBackup, pruneBackups, stamp };
