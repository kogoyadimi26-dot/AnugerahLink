'use strict';

// Akun demo untuk uji coba. Hanya aktif bila DEMO_ACCOUNTS=1 (npm run demo).
// Jangan aktifkan di server yang dipakai sungguhan: kata sandinya tercantum di sini.
const DEMO_USERS = [
  { name: 'Demo Admin', email: 'admin.demo@anugerahlink.local', role: 'admin', password: 'demo-admin-123' },
  { name: 'Demo Penilai', email: 'penilai.demo@anugerahlink.local', role: 'grader', password: 'demo-penilai-123' },
  { name: 'Demo Petugas', email: 'petugas.demo@anugerahlink.local', role: 'field_agent', password: 'demo-petugas-123' },
];

module.exports = { DEMO_USERS };
