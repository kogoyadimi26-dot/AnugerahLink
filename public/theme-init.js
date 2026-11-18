// Dimuat sinkron di <head>, sebelum halaman digambar, supaya tidak ada kilatan warna lama.
// Warna tema dipasang lewat CSS custom property (CSSOM), bukan elemen <style>, supaya CSP tanpa 'unsafe-inline' tetap berlaku.
(function () {
  'use strict';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var cfg = null;

  // Nama variabel CSS -> kunci warna di konfigurasi tema.
  var COLOR_VARS = {
    '--green': 'primary', '--green-2': 'primaryHover', '--green-soft': 'primarySoft',
    '--gold': 'accent', '--gold-hi': 'accentStrong', '--gold-soft': 'accentSoft', '--gold-ink': 'accentInk',
    '--brown': 'brown', '--bg': 'background', '--surface': 'surface', '--ink': 'text', '--ink-muted': 'textMuted',
    '--line': 'border', '--brand': 'primary', '--on-primary': 'onPrimary', '--accent': 'success', '--danger': 'danger',
    '--heading': 'heading', '--hero-from': 'heroFrom', '--hero-to': 'heroTo', '--hero-ink': 'heroInk',
    '--footer-bg': 'footerBg', '--footer-ink': 'footerInk'
  };

  function isDark() {
    var mode = root.getAttribute('data-theme');
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return Boolean(mq && mq.matches);
  }

  function paint() {
    if (!cfg) return;
    var colors = isDark() ? cfg.dark : cfg.light;
    Object.keys(COLOR_VARS).forEach(function (name) {
      if (colors && colors[COLOR_VARS[name]]) root.style.setProperty(name, colors[COLOR_VARS[name]]);
    });
    if (cfg.radius) {
      root.style.setProperty('--radius-sm', cfg.radius.sm);
      root.style.setProperty('--radius', cfg.radius.md);
      root.style.setProperty('--radius-lg', cfg.radius.lg);
    }
    if (cfg.font) root.style.setProperty('--font', cfg.font);
  }

  // Dipanggil app.js saat konfigurasi tema berubah atau pengunjung memilih mode baru.
  window.applyThemeVars = function (t) { cfg = t || cfg; paint(); };
  if (mq && mq.addEventListener) mq.addEventListener('change', paint);

  try {
    var raw = localStorage.getItem('al-theme-cfg');
    if (raw) { cfg = JSON.parse(raw); paint(); }
  } catch (e) { /* penyimpanan diblokir: pakai tema bawaan dari styles.css */ }
})();
