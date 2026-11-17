'use strict';

// Penyimpanan SQLite (bawaan Node, tanpa paket tambahan).
// Setiap koleksi disimpan sebagai baris (koleksi, id, data JSON). Setiap perubahan
// disimpan dalam satu transaksi: jika gagal, tidak ada yang berubah.
// Data lama (data/db.json) diimpor sekali saat pertama kali dijalankan.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const RECORD_COLLECTIONS = ['regions', 'groups', 'lots', 'orders', 'feedback', 'users', 'sessions', 'audit'];

class SqlStore {
  constructor(file, seedFn, legacyJsonFile) {
    this.file = file;
    this.seedFn = seedFn;
    this.legacyJsonFile = legacyJsonFile;
    this.db = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.conn = new DatabaseSync(file);
    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS records (
        coll TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (coll, id)
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  hasData() {
    return this.conn.prepare('SELECT COUNT(*) AS n FROM records').get().n > 0;
  }

  load() {
    if (!this.hasData()) {
      const legacy = this.legacyJsonFile && fs.existsSync(this.legacyJsonFile) ? JSON.parse(fs.readFileSync(this.legacyJsonFile, 'utf8')) : null;
      this.db = legacy || this.seedFn();
      if (!legacy) this.db.users = this.db.users || [];
      this.save(this.db);
      if (legacy) fs.renameSync(this.legacyJsonFile, this.legacyJsonFile + '.migrated');
      return this.db;
    }
    const db = { version: 1, counters: {} };
    for (const c of RECORD_COLLECTIONS) db[c] = [];
    const rows = this.conn.prepare('SELECT coll, id, data FROM records ORDER BY rowid').all();
    for (const row of rows) {
      if (!db[row.coll]) db[row.coll] = [];
      db[row.coll].push(JSON.parse(row.data));
    }
    for (const row of this.conn.prepare('SELECT key, value FROM meta').all()) {
      if (row.key === 'counters') db.counters = JSON.parse(row.value);
      if (row.key === 'version') db.version = Number(row.value);
    }
    this.db = db;
    return db;
  }

  // Simpan seluruh keadaan dalam satu transaksi.
  save(db) {
    this.conn.exec('BEGIN');
    try {
      const upsert = this.conn.prepare(
        'INSERT INTO records (coll, id, data) VALUES (?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data'
      );
      const keep = new Map();
      for (const c of RECORD_COLLECTIONS) {
        keep.set(c, new Set());
        for (const rec of db[c] || []) {
          upsert.run(c, rec.id, JSON.stringify(rec));
          keep.get(c).add(rec.id);
        }
      }
      // Hapus baris yang sudah tidak ada di keadaan baru.
      const existing = this.conn.prepare('SELECT coll, id FROM records').all();
      const del = this.conn.prepare('DELETE FROM records WHERE coll = ? AND id = ?');
      for (const row of existing) {
        if (!keep.has(row.coll) || !keep.get(row.coll).has(row.id)) del.run(row.coll, row.id);
      }
      const meta = this.conn.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      meta.run('counters', JSON.stringify(db.counters || {}));
      meta.run('version', String(db.version || 1));
      this.conn.exec('COMMIT');
    } catch (err) {
      this.conn.exec('ROLLBACK');
      throw err;
    }
  }

  read() {
    return this.db;
  }

  update(fn) {
    const draft = structuredClone(this.db);
    const result = fn(draft);
    this.save(draft);
    this.db = draft;
    return result;
  }
}

module.exports = { SqlStore, RECORD_COLLECTIONS };
