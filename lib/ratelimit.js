'use strict';

// Pembatas percobaan masuk. Disimpan di memori: angka ini hilang saat server dimulai ulang,
// yang cukup untuk tim kecil dan tidak perlu menyimpan data tambahan.
// Aturan default: 5 kegagalan per email dalam 15 menit mengunci email itu selama 15 menit.
// Alamat IP punya batas lebih longgar (20 kegagalan), supaya satu kantor di belakang satu IP tidak terkunci.
class LoginLimiter {
  constructor({ rules, now = () => Date.now() } = {}) {
    this.rules = rules || {
      email: { max: 5, windowMs: 15 * 60000, lockMs: 15 * 60000 },
      ip: { max: 20, windowMs: 15 * 60000, lockMs: 15 * 60000 },
    };
    this.now = now;
    this.entries = new Map(); // kunci -> { fails: [timestamps], lockedUntil }
  }

  _entry(key) {
    if (!this.entries.has(key)) this.entries.set(key, { fails: [], lockedUntil: 0 });
    return this.entries.get(key);
  }

  // Mengembalikan detik tunggu bila terkunci, atau 0 bila boleh mencoba.
  retryAfter(scope, id) {
    const key = `${scope}:${id}`;
    const e = this.entries.get(key);
    if (!e) return 0;
    const t = this.now();
    if (e.lockedUntil > t) return Math.ceil((e.lockedUntil - t) / 1000);
    return 0;
  }

  recordFailure(scope, id) {
    const rule = this.rules[scope];
    const t = this.now();
    const e = this._entry(`${scope}:${id}`);
    e.fails = e.fails.filter((ts) => t - ts < rule.windowMs);
    e.fails.push(t);
    if (e.fails.length >= rule.max) {
      e.lockedUntil = t + rule.lockMs;
      e.fails = [];
    }
    this._prune(t);
  }

  // Sukses masuk menghapus catatan kegagalan untuk email itu.
  recordSuccess(scope, id) {
    this.entries.delete(`${scope}:${id}`);
  }

  _prune(t) {
    if (this.entries.size < 1000) return;
    for (const [k, e] of this.entries) {
      if (e.lockedUntil <= t && e.fails.length === 0) this.entries.delete(k);
    }
  }
}

module.exports = { LoginLimiter };
