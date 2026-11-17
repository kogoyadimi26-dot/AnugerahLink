'use strict';

// Akun tim, peran, sesi, dan catatan audit.
// Kata sandi disimpan sebagai hash scrypt. Token sesi disimpan sebagai hash SHA-256.
const crypto = require('crypto');
const { ApiError, Problems, str, oneOf, email } = require('./validate');

const SESSION_HOURS = 12;
const ROLES = {
  admin: { label: 'Admin', perms: ['*'] },
  grader: { label: 'Penilai', perms: ['lots.read', 'grade'] },
  field_agent: { label: 'Petugas lapangan', perms: ['lots.read', 'intake'] },
};
const ROLE_KEYS = Object.keys(ROLES);

function can(role, perm) {
  const r = ROLES[role];
  if (!r) return false;
  return r.perms.includes('*') || r.perms.includes(perm);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password || ''), parts[1], expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLES[u.role] ? ROLES[u.role].label : u.role, active: u.active };
}

// Buat akun pemilik bila belum ada pengguna sama sekali.
function ensureOwner(db, owner, now) {
  if ((db.users || []).length > 0) return false;
  db.users = db.users || [];
  db.users.push({
    id: crypto.randomUUID(), name: owner.name || 'Pemilik', email: owner.email.toLowerCase(),
    role: 'admin', passwordHash: hashPassword(owner.password), active: true, createdAt: now,
  });
  return true;
}

function login(db, email, password, now) {
  const user = (db.users || []).find((u) => u.email === String(email || '').trim().toLowerCase());
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, 'invalid_login', 'Email atau kata sandi tidak benar.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = (db.sessions || []).filter((s) => Date.parse(s.expiresAt) > Date.parse(now));
  db.sessions.push({
    id: crypto.randomUUID(), tokenHash: sha256(token), userId: user.id,
    createdAt: now, expiresAt: new Date(Date.parse(now) + SESSION_HOURS * 3600000).toISOString(),
  });
  return { token, user: publicUser(user) };
}

function logout(db, token) {
  db.sessions = (db.sessions || []).filter((s) => s.tokenHash !== sha256(token));
}

// Pengguna dari token sesi, atau null bila tidak sah, kedaluwarsa, atau nonaktif.
function userFromToken(db, token, now) {
  if (!token) return null;
  const s = (db.sessions || []).find((x) => x.tokenHash === sha256(token));
  if (!s || Date.parse(s.expiresAt) <= Date.parse(now)) return null;
  const user = (db.users || []).find((u) => u.id === s.userId);
  if (!user || !user.active) return null;
  return user;
}

// Catatan audit: siapa, kapan, dan tindakan apa. Tidak menyimpan isi data.
function logAudit(db, { user, action, status, now }) {
  db.audit = db.audit || [];
  db.audit.push({
    id: crypto.randomUUID(), at: now,
    userId: user ? user.id : null, userName: user ? user.name : null, role: user ? user.role : null,
    action, status,
  });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
}

function activeAdmins(db) {
  return (db.users || []).filter((u) => u.active && u.role === 'admin').length;
}

function createUser(db, body, now) {
  const problems = new Problems();
  const name = str(problems, body, 'name', { min: 2, max: 80, required: true, label: 'Nama' });
  const addr = email(problems, body, 'email');
  const role = oneOf(problems, body, 'role', ROLE_KEYS, { required: true, label: 'Peran' });
  const password = str(problems, body, 'password', { min: 10, max: 200, required: true, label: 'Kata sandi' });
  problems.throwIfAny();
  if ((db.users || []).some((u) => u.email === addr)) {
    throw new ApiError(409, 'email_taken', 'Email ini sudah dipakai akun lain.');
  }
  const user = { id: crypto.randomUUID(), name, email: addr, role, passwordHash: hashPassword(password), active: true, createdAt: now };
  db.users = db.users || [];
  db.users.push(user);
  return user;
}

function updateUser(db, id, body, actorId, now) {
  const user = (db.users || []).find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'not_found', 'Pengguna tidak ditemukan.');
  const problems = new Problems();
  const nextActive = body.active === undefined ? user.active : (body.active === true || body.active === 'true');
  const nextRole = body.role === undefined ? user.role : oneOf(problems, body, 'role', ROLE_KEYS, { required: true, label: 'Peran' });
  const nextPassword = body.password ? str(problems, body, 'password', { min: 10, max: 200, label: 'Kata sandi' }) : null;
  const losesAdmin = user.role === 'admin' && user.active && (!nextActive || nextRole !== 'admin');
  if (!nextActive && user.id === actorId) problems.add('active', 'Anda tidak bisa menonaktifkan akun sendiri.');
  if (losesAdmin && activeAdmins(db) <= 1) problems.add('role', 'Harus ada minimal satu admin yang aktif.');
  problems.throwIfAny();
  user.active = nextActive;
  user.role = nextRole;
  if (nextPassword) user.passwordHash = hashPassword(nextPassword);
  if (!nextActive) db.sessions = (db.sessions || []).filter((s) => s.userId !== user.id);
  user.updatedAt = now;
  return user;
}

module.exports = {
  ROLES, ROLE_KEYS, can, hashPassword, verifyPassword, publicUser, ensureOwner,
  login, logout, userFromToken, logAudit, createUser, updateUser, SESSION_HOURS,
};
