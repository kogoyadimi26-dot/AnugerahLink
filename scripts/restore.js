'use strict';

// Memulihkan cadangan. HENTIKAN server dulu (Ctrl+C), lalu jalankan:
//   node scripts/restore.js backups/<folder-cadangan> --yes
// Data yang ada disalin dulu ke folder "data/sebelum-pulih-<waktu>", jadi tidak hilang.
const path = require('path');
const { restoreBackup } = require('../lib/backup');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const backupDir = args.find((a) => !a.startsWith('--'));
if (!backupDir || !args.includes('--yes')) {
  console.error('Pakai: node scripts/restore.js <folder-cadangan> --yes');
  process.exit(1);
}
const dataFile = process.env.DATA_FILE || path.join(root, 'data', 'app.db');

try {
  const { safetyCopy } = restoreBackup({ backupDir: path.resolve(backupDir), dataFile });
  console.log(`Cadangan dipulihkan ke ${dataFile}`);
  if (safetyCopy) console.log(`Data sebelumnya disimpan di: ${safetyCopy}`);
} catch (err) {
  console.error('Pemulihan gagal:', err.message);
  process.exitCode = 1;
}
