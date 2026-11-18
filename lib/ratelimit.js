'use strict';

// Pembatas percobaan (masuk, pendaftaran, pencarian pesanan, atur ulang kata sandi).
//
// Keadaan disimpan di dalam basis data (`db.rateLimits`) bila `store` diberikan, sehingga:
//   - batas tetap berlaku setelah server dimulai ulang, dan
//   - semua proses yang membuka basis data yang sama memakai hitungan yang sama.
// Tanpa `store`, keadaan disimpan di memori (dipakai pengujian).
//
// Aturan default: 5 kegagalan per email dalam 15 menit mengunci email itu selama 15 menit.
// Alamat IP punya batas lebih longgar (20 kegagalan), supaya satu kantor di belakang satu IP tidak terkunci.

const DEFAULT_RULES = {
  email: { max: 5, windowMs: 15 * 60000, lockMs: 15 * 60000 },
  ip: { max: 20, windowMs: 15 * 60000, lockMs: 15 * 60000 },
};
const PRUNE_AT = 1000;

// Menerapkan satu kegagalan ke catatan. Mengembalikan catatan baru (tidak mengubah argumen).
function applyFailure(entry, rule, t) {
  const fails = (entry ? entry.fails : []).filter((ts) => t - ts < rule.windowMs);
  fails.push(t);
  if (fails.length >= rule.max) return { fails: [], lockedUntil: t + rule.lockMs };
  return { fails, lockedUntil: entry ? entry.lockedUntil : 0 };
}

class LoginLimiter {
  constructor({ rules, now = () => Date.now(), store = null } = {}) {
    this.rules = rules || DEFAULT_RULES;
    this.now = now;
    this.store = store;
    this.entries = new Map(); // dipakai hanya bila tanpa store
  }

  _key(scope, id) {
    return `${scope}:${id}`;
  }

  _read(key) {
    if (this.store) {
      const all = this.store.read().rateLimits || {};
      return all[key] || null;
    }
    return this.entries.get(key) || null;
  }

  // Mengembalikan detik tunggu bila terkunci, atau 0 bila boleh mencoba.
  retryAfter(scope, id) {
    const e = this._read(this._key(scope, id));
    if (!e) return 0;
    const t = this.now();
    if (e.lockedUntil > t) return Math.ceil((e.lockedUntil - t) / 1000);
    return 0;
  }

  recordFailure(scope, id) {
    const rule = this.rules[scope];
    if (!rule) throw new Error(`Aturan pembatas tidak dikenal: ${scope}`);
    const t = this.now();
    const key = this._key(scope, id);
    if (this.store) {
      this.store.update((db) => {
        db.rateLimits = db.rateLimits || {};
        db.rateLimits[key] = applyFailure(db.rateLimits[key], rule, t);
        pruneStored(db.rateLimits, t);
      });
      return;
    }
    this.entries.set(key, applyFailure(this.entries.get(key), rule, t));
    if (this.entries.size >= PRUNE_AT) pruneMap(this.entries, t);
  }

  // Sukses masuk menghapus catatan kegagalan untuk email itu.
  recordSuccess(scope, id) {
    const key = this._key(scope, id);
    if (this.store) {
      this.store.update((db) => {
        if (db.rateLimits) delete db.rateLimits[key];
      });
      return;
    }
    this.entries.delete(key);
  }
}

function pruneStored(bag, t) {
  if (Object.keys(bag).length < PRUNE_AT) return;
  for (const [k, e] of Object.entries(bag)) {
    if (e.lockedUntil <= t && e.fails.length === 0) delete bag[k];
  }
}

function pruneMap(map, t) {
  for (const [k, e] of map) {
    if (e.lockedUntil <= t && e.fails.length === 0) map.delete(k);
  }
}

module.exports = { LoginLimiter, applyFailure };
