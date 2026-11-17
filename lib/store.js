'use strict';

// JSON file store. Each update works on a deep copy and writes the file atomically
// (write to a temp file, then rename). If the update throws, nothing is saved.
// Fine for pilot volume. Move to a database before several admins work at once.
const fs = require('fs');
const path = require('path');

class Store {
  constructor(file, seedFn) {
    this.file = file;
    this.db = null;
    this.seedFn = seedFn;
  }

  load() {
    if (fs.existsSync(this.file)) {
      this.db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } else {
      this.db = this.seedFn();
      this.save(this.db);
    }
    return this.db;
  }

  save(db) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, this.file);
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

module.exports = { Store };
