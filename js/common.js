/* Shared helpers and view routing. Plain scripts, no build step, so the page also opens from disk. */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var custom = (params.get('name') || '').replace(/[^\w .&+-]/g, '').trim().slice(0, 40);

  window.APP = {
    brand: custom || 'Threshold DEX',
    $: function (id) { return document.getElementById(id); },
    fmt: function (v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); },
    ms: function (v) { return v < 10 ? v.toFixed(1) + ' ms' : Math.round(v) + ' ms'; },
    hex: function (n) {
      var s = '', h = '0123456789abcdef';
      for (var i = 0; i < n; i++) { s += h.charAt(Math.floor(Math.random() * 16)); }
      return s;
    },
    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    view: function () { return window.location.hash === '#engine' ? 'engine' : 'trade'; }
  };

  function route() {
    var $ = APP.$;
    var engine = APP.view() === 'engine';
    $('view-trade').hidden = engine;
    $('view-engine').hidden = !engine;
    $('nav-trade').setAttribute('aria-current', engine ? 'false' : 'page');
    $('nav-engine').setAttribute('aria-current', engine ? 'page' : 'false');
    document.body.classList.toggle('on-engine', engine);
    window.dispatchEvent(new CustomEvent('viewchange', { detail: APP.view() }));
  }

  APP.$('brand-name').textContent = APP.brand;
  document.title = APP.brand + ' · encrypted batch auction mock';
  window.addEventListener('hashchange', route);
  window.addEventListener('load', route);
})();
