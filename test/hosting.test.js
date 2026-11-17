'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pruneBackups } = require('../lib/backup');

test('pruning keeps recent backups and removes only old timestamped folders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'al-prune-'));
  try {
    const old = '2026-09-01-010000';
    const recent = '2026-11-15-010000';
    fs.mkdirSync(path.join(root, old));
    fs.mkdirSync(path.join(root, recent));
    fs.mkdirSync(path.join(root, 'bukan-cadangan'));
    const removed = pruneBackups({ backupRoot: root, keepDays: 30, now: new Date(2026, 10, 17) });
    assert.deepEqual(removed, [old]);
    assert.ok(fs.existsSync(path.join(root, recent)));
    assert.ok(fs.existsSync(path.join(root, 'bukan-cadangan')), 'other folders are never touched');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
