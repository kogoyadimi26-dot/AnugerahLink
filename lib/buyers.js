'use strict';

// Akun pembeli: daftar, masuk, profil, alamat tersimpan, dan ganti kata sandi.
// Akun pembeli terpisah dari akun tim. Sesi disimpan di db.sessions dengan kind "buyer" dan buyerId.
const crypto = require('crypto');
const { ApiError, Problems, str, oneOf, email, phone } = require('./validate');
const auth = require('./auth');
const { npwpField } = require('./domain');

const BUYER_SESSION_DAYS = 30;
const MAX_ADDRESSES = 5;
const BUYER_TYPES = ['specialty_cafe', 'premium_roaster', 'roaster', 'papua_business', 'other'];
const CONSENT_VERSION = require('../config/legal').version;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function publicBuyer(b) {
  return {
    id: b.id, name: b.name, email: b.email, phone: b.phone, company: b.company, buyerType: b.buyerType, npwp: b.npwp || '',
    createdAt: b.createdAt, emailVerified: Boolean(b.emailVerifiedAt), addresses: (b.addresses || []).map((a) => ({ ...a })),
  };
}

function validPassword(problems, password) {
  if (typeof password !== 'string' || password.length < 10) problems.add('password', 'Kata sandi minimal 10 karakter.');
  else if (password.length > 200) problems.add('password', 'Kata sandi maksimal 200 karakter.');
}

function signupBuyer(db, body, now) {
  const problems = new Problems();
  const name = str(problems, body, 'name', { min: 2, max: 80, required: true, label: 'Nama' });
  const address = email(problems, body, 'email');
  const tel = phone(problems, body, 'phone');
  const company = str(problems, body, 'company', { max: 120, label: 'Perusahaan' });
  const buyerType = oneOf(problems, body, 'buyerType', BUYER_TYPES, { required: true, label: 'Jenis pembeli' });
  validPassword(problems, body.password);
  if (body.consent !== true) problems.add('consent', 'Setujui kebijakan privasi untuk membuat akun.');
  problems.throwIfAny();
  db.buyers = db.buyers || [];
  if (db.buyers.some((b) => b.email === address)) {
    throw new ApiError(409, 'email_taken', 'Email ini sudah terdaftar. Silakan masuk.', { email: 'Email ini sudah terdaftar.' });
  }
  const buyer = {
    id: crypto.randomUUID(), name, email: address, phone: tel, company, buyerType,
    passwordHash: auth.hashPassword(body.password), addresses: [],
    consentAt: now, consentVersion: CONSENT_VERSION, createdAt: now, lastSignInAt: now,
  };
  db.buyers.push(buyer);
  return { buyer, token: openSession(db, buyer.id, now) };
}

function openSession(db, buyerId, now) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = (db.sessions || []).filter((s) => Date.parse(s.expiresAt) > Date.parse(now));
  db.sessions.push({
    id: crypto.randomUUID(), kind: 'buyer', buyerId, tokenHash: sha256(token),
    createdAt: now, expiresAt: new Date(Date.parse(now) + BUYER_SESSION_DAYS * 86400000).toISOString(),
  });
  return token;
}

function loginBuyer(db, emailAddress, password, now) {
  const address = String(emailAddress || '').trim().toLowerCase();
  const buyer = (db.buyers || []).find((b) => b.email === address);
  if (!buyer || !auth.verifyPassword(password, buyer.passwordHash)) {
    throw new ApiError(401, 'invalid_login', 'Email atau kata sandi tidak benar.');
  }
  buyer.lastSignInAt = now;
  return { buyer, token: openSession(db, buyer.id, now) };
}

function buyerFromToken(db, token, now) {
  if (!token) return null;
  const s = (db.sessions || []).find((x) => x.kind === 'buyer' && x.tokenHash === sha256(token));
  if (!s || Date.parse(s.expiresAt) <= Date.parse(now)) return null;
  return (db.buyers || []).find((b) => b.id === s.buyerId) || null;
}

function logoutBuyer(db, token) {
  db.sessions = (db.sessions || []).filter((s) => s.tokenHash !== sha256(token || ''));
}

function findBuyer(db, id) {
  const b = (db.buyers || []).find((x) => x.id === id);
  if (!b) throw new ApiError(404, 'not_found', 'Akun tidak ditemukan.');
  return b;
}

function updateProfile(db, buyerId, body) {
  const b = findBuyer(db, buyerId);
  const problems = new Problems();
  const name = str(problems, body, 'name', { min: 2, max: 80, required: true, label: 'Nama' });
  const tel = phone(problems, body, 'phone');
  const company = str(problems, body, 'company', { max: 120, label: 'Perusahaan' });
  const buyerType = oneOf(problems, body, 'buyerType', BUYER_TYPES, { required: true, label: 'Jenis pembeli' });
  const npwp = npwpField(problems, body);
  problems.throwIfAny();
  Object.assign(b, { name, phone: tel, company, buyerType, npwp });
  return b;
}

function changePassword(db, buyerId, body) {
  const b = findBuyer(db, buyerId);
  if (!auth.verifyPassword(body.current, b.passwordHash)) {
    throw new ApiError(400, 'invalid_input', 'Kata sandi lama tidak benar.', { current: 'Kata sandi lama tidak benar.' });
  }
  const problems = new Problems();
  validPassword(problems, body.password);
  problems.throwIfAny();
  b.passwordHash = auth.hashPassword(body.password);
  return b;
}

// Alamat tersimpan. Satu alamat boleh ditandai utama; alamat utama dipakai saat checkout.
function addressFields(body) {
  const problems = new Problems();
  const out = {
    label: str(problems, body, 'label', { max: 40, label: 'Label' }) || 'Alamat',
    recipient: str(problems, body, 'recipient', { min: 2, max: 80, required: true, label: 'Penerima' }),
    phone: phone(problems, body, 'phone'),
    street: str(problems, body, 'street', { min: 5, max: 200, required: true, label: 'Alamat lengkap' }),
    city: str(problems, body, 'city', { min: 2, max: 80, required: true, label: 'Kota' }),
    province: str(problems, body, 'province', { max: 80, label: 'Provinsi' }),
    postal: str(problems, body, 'postal', { max: 10, label: 'Kode pos' }),
  };
  if (out.postal && !/^\d{5}$/.test(out.postal)) problems.add('postal', 'Kode pos terdiri dari 5 angka.');
  problems.throwIfAny();
  return out;
}

function addAddress(db, buyerId, body, now) {
  const b = findBuyer(db, buyerId);
  b.addresses = b.addresses || [];
  if (b.addresses.length >= MAX_ADDRESSES) throw new ApiError(409, 'limit', `Alamat tersimpan maksimal ${MAX_ADDRESSES}.`);
  const fields = addressFields(body);
  const makeDefault = body.isDefault === true || b.addresses.length === 0;
  if (makeDefault) b.addresses.forEach((a) => { a.isDefault = false; });
  const addr = { id: crypto.randomUUID(), ...fields, isDefault: makeDefault, createdAt: now };
  b.addresses.push(addr);
  return addr;
}

function updateAddress(db, buyerId, addrId, body) {
  const b = findBuyer(db, buyerId);
  const addr = (b.addresses || []).find((a) => a.id === addrId);
  if (!addr) throw new ApiError(404, 'not_found', 'Alamat tidak ditemukan.');
  Object.assign(addr, addressFields(body));
  if (body.isDefault === true) b.addresses.forEach((a) => { a.isDefault = a.id === addrId; });
  return addr;
}

function removeAddress(db, buyerId, addrId) {
  const b = findBuyer(db, buyerId);
  const before = (b.addresses || []).length;
  b.addresses = (b.addresses || []).filter((a) => a.id !== addrId);
  if (b.addresses.length === before) throw new ApiError(404, 'not_found', 'Alamat tidak ditemukan.');
  if (!b.addresses.some((a) => a.isDefault) && b.addresses[0]) b.addresses[0].isDefault = true;
}

// Ekspor data pembeli: profil, alamat, dan pesanan (tanpa kata sandi).
function exportBuyer(db, buyerId, publicOrder) {
  const b = findBuyer(db, buyerId);
  const orders = (db.orders || []).filter((o) => o.buyerId === buyerId).map((o) => publicOrder(o));
  return {
    exportedAt: new Date().toISOString(),
    profile: publicBuyer(b),
    consent: { version: b.consentVersion, givenAt: b.consentAt },
    orders,
  };
}

// Hapus akun pembeli. Data pribadi pada pesanan dan pesan dihapus; catatan transaksi (nomor, barang, jumlah, tanggal) tetap ada.
function deleteBuyer(db, buyerId, password, now) {
  const b = findBuyer(db, buyerId);
  if (!auth.verifyPassword(password, b.passwordHash)) {
    throw new ApiError(400, 'invalid_input', 'Kata sandi tidak benar.', { password: 'Kata sandi tidak benar.' });
  }
  const contacts = [b.email, b.phone].filter(Boolean);
  for (const o of db.orders || []) {
    if (o.buyerId !== buyerId && !contacts.includes(o.customer.email)) continue;
    o.buyerId = null;
    o.customer = { name: '[dihapus]', company: '', buyerType: o.customer.buyerType, phone: '', email: '', city: '', street: '', npwp: '', notes: '' };
  }
  for (const m of db.outbox || []) {
    if (contacts.includes(m.to)) m.to = '[dihapus]';
  }
  db.buyers = (db.buyers || []).filter((x) => x.id !== buyerId);
  db.sessions = (db.sessions || []).filter((s) => s.buyerId !== buyerId);
  db.audit = db.audit || [];
  db.audit.push({ id: crypto.randomUUID(), at: now, userId: null, userName: 'Pembeli', role: 'buyer', action: 'buyer.delete', status: 200, detail: 'Akun pembeli dihapus atas permintaan pemilik akun.' });
  return true;
}

// Konfirmasi email dan atur ulang kata sandi. Token acak hanya dikirim lewat email; yang disimpan adalah hash SHA-256-nya.
const VERIFY_MS = 3 * 86400000;
const RESET_MS = 60 * 60000;
const RESEND_MS = 60000;

function issueToken(now, ttlMs) {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, record: { hash: sha256(token), expiresAt: new Date(Date.parse(now) + ttlMs).toISOString(), sentAt: now } };
}

// Membuat tautan konfirmasi baru. Mengembalikan token untuk dikirim lewat email.
function requestVerification(db, buyerId, now) {
  const b = findBuyer(db, buyerId);
  if (b.emailVerifiedAt) return { alreadyVerified: true };
  if (b.emailVerify && Date.parse(now) - Date.parse(b.emailVerify.sentAt) < RESEND_MS) {
    throw new ApiError(429, 'too_soon', 'Tunggu sebentar sebelum mengirim ulang email konfirmasi.');
  }
  const { token, record } = issueToken(now, VERIFY_MS);
  b.emailVerify = record;
  return { token, email: b.email };
}

function confirmEmail(db, token, now) {
  const hash = sha256(String(token || ''));
  const b = (db.buyers || []).find((x) => x.emailVerify && x.emailVerify.hash === hash);
  if (!b || Date.parse(b.emailVerify.expiresAt) <= Date.parse(now)) {
    throw new ApiError(400, 'invalid_token', 'Tautan tidak valid atau sudah kedaluwarsa. Kirim ulang email konfirmasi dari akun Anda.');
  }
  b.emailVerifiedAt = now;
  delete b.emailVerify;
  return b;
}

// Permintaan atur ulang. Selalu diam bila email tidak terdaftar, agar tidak bisa dipakai untuk mencari akun.
function requestPasswordReset(db, emailAddress, now) {
  const address = String(emailAddress || '').trim().toLowerCase();
  const b = (db.buyers || []).find((x) => x.email === address);
  if (!b) return null;
  if (b.passwordReset && Date.parse(now) - Date.parse(b.passwordReset.sentAt) < RESEND_MS) return null;
  const { token, record } = issueToken(now, RESET_MS);
  b.passwordReset = record;
  return { token, email: b.email };
}

function resetPassword(db, token, password, now) {
  const hash = sha256(String(token || ''));
  const b = (db.buyers || []).find((x) => x.passwordReset && x.passwordReset.hash === hash);
  if (!b || Date.parse(b.passwordReset.expiresAt) <= Date.parse(now)) {
    throw new ApiError(400, 'invalid_token', 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan atur ulang yang baru.');
  }
  const problems = new Problems();
  validPassword(problems, password);
  problems.throwIfAny();
  b.passwordHash = auth.hashPassword(password);
  b.emailVerifiedAt = b.emailVerifiedAt || now; // klik tautan di email membuktikan kepemilikan email
  delete b.passwordReset;
  db.sessions = (db.sessions || []).filter((s) => s.buyerId !== b.id);
  return b;
}

// Tampilan untuk staf: daftar pembeli dengan status email dan jumlah pesanan. Tanpa kata sandi atau token.
const STAFF_LIST_LIMIT = 200;

function listBuyersForStaff(db, query, now) {
  const q = String(query || '').trim().toLowerCase().slice(0, 100);
  const orders = db.orders || [];
  return (db.buyers || [])
    .filter((b) => !q || [b.name, b.email, b.company, b.phone].some((v) => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, STAFF_LIST_LIMIT)
    .map((b) => ({
      id: b.id, name: b.name, email: b.email, phone: b.phone || '', company: b.company || '', buyerType: b.buyerType,
      createdAt: b.createdAt, lastSignInAt: b.lastSignInAt || null,
      emailVerified: Boolean(b.emailVerifiedAt), emailVerifiedAt: b.emailVerifiedAt || null,
      resetPending: Boolean(b.passwordReset && Date.parse(b.passwordReset.expiresAt) > Date.parse(now)),
      orderCount: orders.filter((o) => o.buyerId === b.id).length,
    }));
}

// Staf menandai email terverifikasi bila pembeli tidak bisa menerima email. Dicatat di riwayat.
function staffVerifyBuyer(db, buyerId, now) {
  const b = findBuyer(db, buyerId);
  if (b.emailVerifiedAt) throw new ApiError(409, 'already_verified', 'Email ini sudah terverifikasi.');
  b.emailVerifiedAt = now;
  delete b.emailVerify;
  return b;
}

// Staf mengirim tautan atur ulang ke email pembeli. Mengikuti batas yang sama dengan permintaan dari pembeli.
function staffSendReset(db, buyerId, now) {
  const b = findBuyer(db, buyerId);
  const r = requestPasswordReset(db, b.email, now);
  if (!r) throw new ApiError(429, 'too_soon', 'Tautan atur ulang baru saja dikirim. Tunggu sebentar lalu coba lagi.');
  return r;
}

module.exports = {
  BUYER_SESSION_DAYS,
  exportBuyer, deleteBuyer,
  listBuyersForStaff, staffVerifyBuyer, staffSendReset,
  BUYER_TYPES, CONSENT_VERSION, MAX_ADDRESSES, publicBuyer,
  signupBuyer, loginBuyer, buyerFromToken, logoutBuyer, updateProfile, changePassword,
  addAddress, updateAddress, removeAddress,
  requestVerification, confirmEmail, requestPasswordReset, resetPassword,
};
