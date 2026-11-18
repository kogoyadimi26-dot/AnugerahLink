'use strict';

// Masuk cepat untuk pembeli: tautan sekali pakai lewat email, dan masuk dengan akun Google (OpenID Connect).
const crypto = require('crypto');
const https = require('https');
const auth = require('./auth');
const buyers = require('./buyers');
const { ApiError } = require('./validate');

const LINK_MS = 15 * 60000;
const RESEND_MS = 60000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Tautan masuk baru. Mengembalikan token untuk dikirim lewat email; null bila email tidak terdaftar atau baru saja dikirim.
function requestLoginLink(db, emailAddress, now) {
  const address = String(emailAddress || '').trim().toLowerCase();
  const b = (db.buyers || []).find((x) => x.email === address);
  if (!b) return null;
  if (b.loginLink && Date.parse(now) - Date.parse(b.loginLink.sentAt) < RESEND_MS) return null;
  const token = crypto.randomBytes(32).toString('hex');
  b.loginLink = { hash: sha256(token), expiresAt: new Date(Date.parse(now) + LINK_MS).toISOString(), sentAt: now };
  return { token, email: b.email };
}

// Menukar tautan sekali pakai menjadi sesi masuk. Tautan langsung hangus setelah dipakai.
function consumeLoginLink(db, token, now) {
  const hash = sha256(String(token || ''));
  const b = (db.buyers || []).find((x) => x.loginLink && x.loginLink.hash === hash);
  if (!b || Date.parse(b.loginLink.expiresAt) <= Date.parse(now)) {
    throw new ApiError(400, 'invalid_link', 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.');
  }
  b.loginLink = null;
  if (!b.emailVerifiedAt) b.emailVerifiedAt = now; // klik tautan di email membuktikan kepemilikan email
  b.lastSignInAt = now;
  return { buyer: b, token: buyers.openSession(db, b.id, now) };
}

// ---- Google ----

// Google aktif hanya bila kedua kunci dan alamat publik sudah diatur di lingkungan server.
function googleConfig() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  if (!id || !secret || !base) return null;
  return { id, secret, redirectUri: `${base}/api/buyer/google/callback` };
}

function googleEnabled() {
  return Boolean(googleConfig());
}

function googleAuthUrl(state) {
  const c = googleConfig();
  const q = new URLSearchParams({
    client_id: c.id, redirect_uri: c.redirectUri, response_type: 'code',
    scope: 'openid email profile', state, prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

function httpsJson(method, url, form) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = form ? new URLSearchParams(form).toString() : '';
    const req = https.request({
      host: u.hostname, path: u.pathname + u.search, method,
      headers: form ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {},
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Respons Google tidak valid.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Google tidak menjawab.')));
    req.on('error', reject);
    if (form) req.write(body);
    req.end();
  });
}

// Menukar kode dari Google, lalu memeriksa identitas dari token ID Google.
async function googleIdentity(code) {
  const c = googleConfig();
  const fail = () => new ApiError(400, 'google_failed', 'Masuk dengan Google gagal. Coba lagi.');
  const tok = await httpsJson('POST', 'https://oauth2.googleapis.com/token', {
    code, client_id: c.id, client_secret: c.secret, redirect_uri: c.redirectUri, grant_type: 'authorization_code',
  });
  if (!tok || !tok.id_token) throw fail();
  const info = await httpsJson('GET', `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tok.id_token)}`);
  const issuerOk = info && ['accounts.google.com', 'https://accounts.google.com'].includes(info.iss);
  const notExpired = info && Number(info.exp) * 1000 > Date.now();
  const verified = info && (info.email_verified === true || info.email_verified === 'true');
  if (!issuerOk || info.aud !== c.id || !notExpired || !verified || !info.email) throw fail();
  return { email: String(info.email).trim().toLowerCase(), name: String(info.name || info.email.split('@')[0]).slice(0, 80) };
}

// Masuk dengan Google: pembeli lama dikenali lewat email; pembeli baru dibuat tanpa kata sandi.
function signInWithGoogle(db, identity, now) {
  db.buyers = db.buyers || [];
  let b = db.buyers.find((x) => x.email === identity.email);
  if (!b) {
    b = {
      id: crypto.randomUUID(), name: identity.name, email: identity.email, phone: '', company: '',
      buyerType: 'specialty_cafe', passwordHash: auth.hashPassword(crypto.randomBytes(24).toString('hex')),
      addresses: [], consentAt: now, consentVersion: buyers.CONSENT_VERSION, createdAt: now, lastSignInAt: now,
      emailVerifiedAt: now, googleSignIn: true,
    };
    db.buyers.push(b);
  }
  if (!b.emailVerifiedAt) b.emailVerifiedAt = now; // Google sudah memverifikasi email
  b.lastSignInAt = now;
  return { buyer: b, token: buyers.openSession(db, b.id, now) };
}

module.exports = {
  requestLoginLink, consumeLoginLink,
  googleEnabled, googleConfig, googleAuthUrl, googleIdentity, signInWithGoogle,
};
