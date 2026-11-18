'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'offsite-backup.sh');

test('salin cadangan keluar server menolak jalan tanpa tujuan', () => {
  const env = { ...process.env };
  delete env.RCLONE_REMOTE;
  const r = spawnSync('bash', [SCRIPT], { env, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RCLONE_REMOTE belum diatur/);
});
