// Dimuat sinkron di <head>, sebelum halaman digambar, supaya tidak ada kilatan warna lama.
// Memakai pilihan tema pengunjung dan salinan CSS tema terakhir (disimpan di browser ini).
(function () {
  'use strict';
  try {
    var mode = localStorage.getItem('al-theme');
    if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
    var css = localStorage.getItem('al-theme-css');
    if (css) {
      var el = document.createElement('style');
      el.id = 'theme-vars';
      el.textContent = css;
      document.head.appendChild(el);
    }
  } catch (e) { /* penyimpanan diblokir: pakai tema bawaan dari styles.css */ }
})();
