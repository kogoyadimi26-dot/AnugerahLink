'use strict';

// Halaman Tentang yang bisa diubah admin. Disimpan di pengaturan situs; bagian yang belum diubah memakai teks standar.
const { ApiError } = require('./validate');
const business = require('../config/business');

const ICONS = ['coin', 'passport', 'check'];
const MAX = { eyebrow: 60, title: 120, lead: 300, mission: 600, claimTitle: 120, claimText: 600, paragraph: 1200, pillarTitle: 80, pillarText: 400, newsDate: 40, newsTitle: 160 };
const LIMITS = { history: 10, pillars: 8, news: 10, newsBody: 10 };

// Teks biasa saja: tanpa tanda < atau >, dan tidak kosong bila wajib.
function text(fields, key, value, max, required) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) {
    if (required) fields[key] = 'Wajib diisi.';
    return '';
  }
  if (v.length > max) fields[key] = `Maksimal ${max} karakter.`;
  else if (/[<>]/.test(v)) fields[key] = 'Gunakan teks biasa, tanpa tanda < atau >.';
  return v;
}

function list(input, limit) {
  return Array.isArray(input) ? input.slice(0, limit + 1) : [];
}

function validateAbout(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid_input', 'Data halaman tidak valid.');
  const fields = {};
  const out = {
    eyebrow: text(fields, 'eyebrow', input.eyebrow, MAX.eyebrow, true),
    title: text(fields, 'title', input.title, MAX.title, true),
    lead: text(fields, 'lead', input.lead, MAX.lead, false),
    mission: text(fields, 'mission', input.mission, MAX.mission, true),
    claim: {
      title: text(fields, 'claimTitle', input.claim && input.claim.title, MAX.claimTitle, true),
      text: text(fields, 'claimText', input.claim && input.claim.text, MAX.claimText, true),
    },
    history: [],
    pillars: [],
    news: [],
  };
  const history = list(input.history, LIMITS.history);
  if (history.length > LIMITS.history) fields.history = `Maksimal ${LIMITS.history} paragraf.`;
  history.forEach((p, i) => {
    const v = text(fields, `history.${i}`, p, MAX.paragraph, false);
    if (v) out.history.push(v);
  });
  if (!out.history.length) fields.history = 'Tambahkan minimal satu paragraf sejarah.';

  const pillars = list(input.pillars, LIMITS.pillars);
  if (pillars.length > LIMITS.pillars) fields.pillars = `Maksimal ${LIMITS.pillars} kartu.`;
  pillars.forEach((p, i) => {
    const icon = ICONS.includes(p && p.icon) ? p.icon : 'check';
    out.pillars.push({
      icon,
      title: text(fields, `pillars.${i}.title`, p && p.title, MAX.pillarTitle, true),
      text: text(fields, `pillars.${i}.text`, p && p.text, MAX.pillarText, true),
    });
  });

  const news = list(input.news, LIMITS.news);
  if (news.length > LIMITS.news) fields.news = `Maksimal ${LIMITS.news} berita.`;
  news.forEach((n, i) => {
    const bodies = list(n && n.body, LIMITS.newsBody).map((b, j) => text(fields, `news.${i}.body.${j}`, b, MAX.paragraph, false)).filter(Boolean);
    if (bodies.length > LIMITS.newsBody) fields[`news.${i}.body`] = `Maksimal ${LIMITS.newsBody} paragraf.`;
    out.news.push({
      date: text(fields, `news.${i}.date`, n && n.date, MAX.newsDate, true),
      title: text(fields, `news.${i}.title`, n && n.title, MAX.newsTitle, true),
      body: bodies,
    });
  });

  if (Object.keys(fields).length) throw new ApiError(400, 'invalid_input', 'Periksa isian halaman Tentang.', fields);
  return out;
}

// Halaman yang tampil = teks standar, ditimpa dengan yang disimpan admin.
function aboutFor(settings) {
  const saved = settings && settings.about;
  return saved ? { ...business.about, ...saved } : business.about;
}

module.exports = { validateAbout, aboutFor, ABOUT_ICONS: ICONS, ABOUT_LIMITS: LIMITS };
