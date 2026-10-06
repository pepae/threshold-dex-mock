/* Trade view: a simulated batch auction clearing every 100 ms. */
(function () {
  'use strict';
  var $ = APP.$, fmt = APP.fmt, hex = APP.hex, esc = APP.esc;
  var BASE_BATCH = 48213;
  var BASE_PRICE = { 'BTC-PERP': 98000, 'ETH-PERP': 3600 };

  var S;
  var t0 = Date.now();

  function asset() { return S.market === 'BTC-PERP' ? 'BTC' : 'ETH'; }
  function dp() { return S.market === 'BTC-PERP' ? 1 : 2; }

  function mkDepth(x) {
    var step = x > 10000 ? 5 : 0.5;
    var mid = Math.round(x / step) * step;
    var asks = [], bids = [];
    for (var i = 5; i >= 1; i--) { asks.push({ p: mid + i * step, q: 0.4 + Math.random() * 3.6 }); }
    for (var j = 1; j <= 5; j++) { bids.push({ p: mid - j * step, q: 0.4 + Math.random() * 3.6 }); }
    return { asks: asks, bids: bids };
  }

  function fresh(market, batchNo, sec, jumps) {
    var x = BASE_PRICE[market], hist = [];
    for (var i = 0; i < 60; i++) { x = x * (1 + (Math.random() - 0.5) * 0.0005); hist.push(x); }
    return {
      market: market, side: S ? S.side : 'buy', index: x, last: x, lastOrders: 212, lastKey: 21,
      batchNo: batchNo, sec: sec, hist: hist, recent: [], cipher: [], depth: mkDepth(x),
      order: null, pos: null, fills: [], jumps: jumps || { n: 0, cont: 0, batch: 0 }
    };
  }

  /* ---------- rendering ---------- */
  var barEls = [];
  function buildBars() {
    var box = $('bars');
    for (var i = 0; i < 60; i++) { var d = document.createElement('div'); box.appendChild(d); barEls.push(d); }
  }
  function renderBars() {
    var lo = Math.min.apply(null, S.hist), hi = Math.max.apply(null, S.hist), span = Math.max(hi - lo, 1e-9);
    for (var i = 0; i < 60; i++) { barEls[i].style.height = (18 + 82 * (S.hist[i] - lo) / span).toFixed(1) + '%'; }
  }
  function renderDepth() {
    var all = S.depth.asks.concat(S.depth.bids);
    var maxQ = Math.max.apply(null, all.map(function (r) { return r.q; }));
    var row = function (r, cls) {
      return '<div class="lvl ' + cls + '"><div class="bg" style="width:' + (100 * r.q / maxQ).toFixed(0) + '%"></div><span class="p">' + fmt(r.p, dp()) + '</span><span>' + r.q.toFixed(2) + '</span></div>';
    };
    $('asks').innerHTML = S.depth.asks.map(function (r) { return row(r, 'ask'); }).join('');
    $('bids').innerHTML = S.depth.bids.map(function (r) { return row(r, 'bid'); }).join('');
  }
  function renderRecent() {
    $('recent-rows').innerHTML = S.recent.map(function (r) {
      return '<div class="tr" role="row"><span role="cell">' + r.batch + '</span><span role="cell">' + r.orders + '</span><span role="cell">' + r.filled + '</span><span role="cell" class="teal">' + r.price + '</span><span role="cell">' + r.key + '</span></div>';
    }).join('');
  }
  function renderCipher() {
    $('cipher-list').innerHTML = S.cipher.map(function (c) {
      return '<div><span class="b">' + c.batch + '</span><span class="s">225 B</span><span class="h">' + c.hex + '</span></div>';
    }).join('');
  }
  function renderPrices() {
    var last = fmt(S.last, dp());
    $('index-price').textContent = fmt(S.index, dp());
    $('last-price-strip').textContent = last;
    $('last-price-big').textContent = last;
    $('depth-mid').textContent = last;
    $('last-orders').textContent = S.lastOrders;
    $('last-key').textContent = S.lastKey;
    $('next-batch').textContent = fmt(S.batchNo + 1, 0);
  }
  function renderSniper() {
    var j = S.jumps;
    var c = j.n ? 100 * j.cont / j.n : 0, b = j.n ? 100 * j.batch / j.n : 0;
    $('sn-cont').textContent = c.toFixed(1) + '%';
    $('sn-batch').textContent = b.toFixed(1) + '%';
    $('sn-cont-bar').style.width = c.toFixed(1) + '%';
    $('sn-batch-bar').style.width = b.toFixed(1) + '%';
    $('sn-n').textContent = fmt(j.n, 0);
  }
  function renderSide() {
    var buy = S.side === 'buy';
    $('side-buy').setAttribute('aria-pressed', buy ? 'true' : 'false');
    $('side-sell').setAttribute('aria-pressed', buy ? 'false' : 'true');
    var btn = $('submit-btn');
    btn.classList.toggle('sell', !buy);
    btn.textContent = (buy ? 'Encrypt and buy ' : 'Encrypt and sell ') + ($('size-input').value || '0') + ' ' + asset();
  }
  function renderMarket() {
    $('ticket-market').textContent = S.market;
    $('size-asset').textContent = asset();
    var tabs = document.querySelectorAll('#market-tabs .seg');
    for (var i = 0; i < tabs.length; i++) { tabs[i].setAttribute('aria-pressed', tabs[i].getAttribute('data-market') === S.market ? 'true' : 'false'); }
  }
  function renderOrder() {
    var o = S.order;
    $('order-card').hidden = !o;
    if (!o) { return; }
    $('order-hex').textContent = o.hex;
    var defs = [
      ['Encrypted in the browser', '225 bytes'],
      ['In batch #' + fmt(o.target, 0), 'sealed'],
      ['Committed by 3 of 4 nodes', '+' + o.commit + ' ms'],
      ['Key released by 3 of 5 keypers', '+' + o.key + ' ms'],
      ['Filled at the batch price', o.fill ? fmt(o.fill, dp()) : '']
    ];
    $('order-steps').innerHTML = defs.map(function (d, i) {
      var done = o.stage >= i + 1;
      return '<li class="' + (done ? 'done' : '') + '"><span class="dot" aria-hidden="true"></span><span>' + esc(d[0]) + '</span><span class="meta">' + (done ? esc(d[1]) : '') + '</span></li>';
    }).join('');
  }
  function renderPos() {
    var p = S.pos;
    $('pos-empty').hidden = !!p;
    $('pos-wrap').hidden = !p;
    if (!p) { return; }
    var pnl = (S.index - p.entry) * p.size * (p.side === 'buy' ? 1 : -1);
    $('pos-market').textContent = S.market;
    $('pos-side').textContent = p.side === 'buy' ? 'Long' : 'Short';
    $('pos-side').style.color = p.side === 'buy' ? 'var(--blue)' : 'var(--orange)';
    $('pos-size').textContent = fmt(p.size, 2) + ' ' + asset();
    $('pos-entry').textContent = fmt(p.entry, dp());
    $('pos-mark').textContent = fmt(S.index, dp());
    $('pos-pnl').textContent = (pnl >= 0 ? '+' : '') + fmt(pnl, 2) + ' USDC';
    $('pos-pnl').style.color = pnl >= 0 ? 'var(--teal)' : 'var(--orange)';
    $('fills').innerHTML = S.fills.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('');
  }
  function renderAll() {
    renderMarket(); renderSide(); renderBars(); renderDepth(); renderRecent(); renderCipher();
    renderPrices(); renderSniper(); renderOrder(); renderPos();
  }

  /* ---------- simulation ---------- */
  function tick() {
    var el = Date.now() - t0;
    var bn = BASE_BATCH + Math.floor(el / 100);
    var pct = el % 100;
    $('seal-bar').style.width = pct + '%';
    $('ms-left').textContent = 100 - pct;
    $('batch-no').textContent = fmt(bn, 0);

    if (bn !== S.batchNo) {
      S.batchNo = bn;
      S.index = S.index * (1 + (Math.random() - 0.5) * 0.0005);
      S.last = S.index * (1 + (Math.random() - 0.5) * 0.0002);
      S.lastOrders = 140 + Math.floor(Math.random() * 200);
      S.lastKey = 12 + Math.floor(Math.random() * 20);
      S.hist = S.hist.slice(1).concat([S.last]);
      renderBars(); renderPrices();
      if (bn % 3 === 0) {
        S.cipher = [{ batch: '#' + fmt(bn - 1, 0), hex: '0x03' + hex(44) }].concat(S.cipher).slice(0, 8);
        renderCipher();
      }
      var sec = Math.floor(el / 1000);
      if (sec !== S.sec) {
        S.sec = sec;
        S.recent = [{
          batch: '#' + fmt(bn - 1, 0), orders: String(S.lastOrders),
          filled: String(Math.floor(S.lastOrders * (0.55 + Math.random() * 0.2))),
          price: fmt(S.last, dp()), key: S.lastKey + ' ms'
        }].concat(S.recent).slice(0, 6);
        S.depth = mkDepth(S.index);
        // textbook sniping model: 40 price jumps per second
        for (var k = 0; k < 40; k++) {
          S.jumps.n++;
          if (Math.random() < 5 / 6) { S.jumps.cont++; }   // 5 equally fast snipers vs 1 market maker
          if (Math.random() < 1 / 100) { S.jumps.batch++; } // jump inside the last 1 ms of a 100 ms batch
        }
        renderRecent(); renderDepth(); renderSniper();
      }
      if (S.order && S.order.stage === 1 && bn > S.order.target) {
        S.order.stage = 2; S.order.at = el; renderOrder();
      }
      if (S.pos) { renderPos(); }
    }

    var o = S.order;
    if (o && o.stage >= 2 && o.stage < 5 && el - o.at > 220) {
      o.stage += 1; o.at = el;
      if (o.stage === 5) { fill(o); }
      renderOrder();
    }
  }

  function fill(o) {
    var px = S.last;
    o.fill = px;
    var p = S.pos;
    if (!p) { p = { side: o.side, size: o.size, entry: px }; }
    else if (p.side === o.side) { var ns = p.size + o.size; p = { side: p.side, size: ns, entry: (p.entry * p.size + px * o.size) / ns }; }
    else {
      var rest = p.size - o.size;
      p = rest > 1e-9 ? { side: p.side, size: rest, entry: p.entry } : (rest < -1e-9 ? { side: o.side, size: -rest, entry: px } : null);
    }
    S.pos = p;
    S.fills = ['#' + fmt(o.target, 0) + ' · ' + (o.side === 'buy' ? 'Buy ' : 'Sell ') + o.size + ' at ' + fmt(px, dp())].concat(S.fills).slice(0, 4);
    renderPos();
  }

  function submit() {
    var input = $('size-input');
    var size = parseFloat(input.value);
    if (!(size > 0)) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    input.removeAttribute('aria-invalid');
    S.order = {
      side: S.side, size: size, target: S.batchNo + 1, stage: 1, at: 0,
      hex: '0x03' + hex(96) + '…' + hex(8),
      commit: 24 + Math.floor(Math.random() * 20), key: 12 + Math.floor(Math.random() * 16)
    };
    renderOrder();
  }

  function pickMarket(m) {
    if (m === S.market) { return; }
    S = fresh(m, S.batchNo, S.sec, S.jumps);
    $('size-input').value = m === 'BTC-PERP' ? '0.25' : '4';
    $('price-input').value = '';
    renderAll();
  }

  /* ---------- wiring ---------- */
  S = fresh('BTC-PERP', BASE_BATCH, -1);
  buildBars();
  renderAll();
  $('side-buy').addEventListener('click', function () { S.side = 'buy'; renderSide(); });
  $('side-sell').addEventListener('click', function () { S.side = 'sell'; renderSide(); });
  $('size-input').addEventListener('input', renderSide);
  $('submit-btn').addEventListener('click', submit);
  $('market-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-market]');
    if (b) { pickMarket(b.getAttribute('data-market')); }
  });
  setInterval(tick, 50);
})();
