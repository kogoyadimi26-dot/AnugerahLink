'use strict';

// Membuat cadangan database dan foto ke folder backups/.
// Pakai: node scripts/backup.js        (bisa dijalankan saat server sedang berjalan)
const path = require('path');
const { createBackup } = require('../lib/backup');

const root = path.join(__dirname, '..');
const dataFile = process.env.DATA_FILE || path.join(root, 'data', 'app.db');
const backupRoot = process.env.BACKUP_DIR || path.join(root, 'backups');

try {
  const { dest, photoCount } = createBackup({ dataFile, backupRoot });
  console.log(`Cadangan dibuat: ${dest}`);
  console.log(`Foto disalin: ${photoCount}`);
} catch (err) {
  console.error('Cadangan gagal:', err.message);
  process.exitCode = 1;
}
