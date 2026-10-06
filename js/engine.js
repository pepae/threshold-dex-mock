/* Engine room: latency model per batch, controls, panels, and the keyper ring. */
(function () {
  'use strict';
  var $ = APP.$, fmt = APP.fmt, ms = APP.ms, hex = APP.hex, esc = APP.esc;

  /* Simulated one-way delays in ms. Keypers K1,K2 sit in region A with the gateway,
     K3,K4 in region B, K5 in region C. Committee: C1,C2 in A, C3 in B, C4 in C. */
  var PROFILES = {
    one: { label: 'One region', regions: ['Zone a', 'Zone b', 'Zone c'], hop: ['gateway here', 'under 1 ms away', 'under 1 ms away'], commit: [2, 5], kp: [[1, 2], [1, 2], [1, 3], [1, 3], [1, 3]] },
    europe: { label: 'Europe', regions: ['EU Central', 'EU North', 'EU West'], hop: ['gateway here', 'about 20 ms away', 'about 10 ms away'], commit: [20, 50], kp: [[1, 3], [1, 3], [12, 24], [12, 24], [8, 14]] },
    global: { label: 'Global', regions: ['EU Central', 'US East', 'Asia Pacific'], hop: ['gateway here', 'about 45 ms away', 'about 110 ms away'], commit: [150, 250], kp: [[1, 3], [1, 3], [55, 75], [55, 75], [100, 140]] }
  };
  var K_REGION = [0, 0, 1, 1, 2];
  var PAIRING_MS = 0.7, CORES = 16;
  var BATCHES_PER_CYCLE = 25;

  var S = { profile: 'europe', load: 1000, online: [true, true, true, true, true], batchNo: 48213, log: [], evidence: null, earlyNext: false, latest: null, active: false };

  function rnd(a) { return a[0] + Math.random() * (a[1] - a[0]); }

  function mkBatch() {
    var P = PROFILES[S.profile];
    var shares = P.kp.map(function (rg, i) { return S.online[i] ? rnd(rg) : null; });
    var ok = shares.filter(function (v) { return v !== null; }).sort(function (a, b) { return a - b; });
    var paused = ok.length < 3;
    var commit = rnd(P.commit);
    var orders = Math.round(S.load * (0.9 + Math.random() * 0.2));
    var key = paused ? 0 : ok[2] + 2;
    var dec = paused ? 0 : orders * PAIRING_MS / CORES * (0.94 + Math.random() * 0.12);
    var clr = paused ? 0 : 1 + orders / 1500;
    return { bn: S.batchNo, orders: orders, shares: shares, commit: commit, key: key, dec: dec, clr: clr, total: 50 + commit + key + dec + clr, paused: paused, root: '0x' + hex(8) };
  }

  function logRow(b) {
    return { bn: b.bn, html: '<div class="tr" role="row"><span role="cell">#' + fmt(b.bn, 0) + '</span><span role="cell">' + fmt(b.orders, 0) + '</span><span role="cell">' + ms(b.commit) +
      '</span><span role="cell">' + (b.paused ? 'waiting' : ms(b.key)) + '</span><span role="cell">' + (b.paused ? '' : ms(b.dec)) + '</span><span role="cell">' + (b.paused ? '' : ms(b.total)) +
      '</span><span role="cell" class="muted">' + (b.paused ? '' : b.root) + '</span><span role="cell" style="color:' + (b.paused ? 'var(--red)' : 'var(--teal)') + '">' + (b.paused ? 'Paused' : 'Cleared') + '</span></div>' };
  }

  /* ---------- controls ---------- */
  function renderControls() {
    $('profile-btns').innerHTML = ['one', 'europe', 'global'].map(function (k) {
      return '<button type="button" class="seg" data-profile="' + k + '" aria-pressed="' + (k === S.profile) + '">' + PROFILES[k].label + '</button>';
    }).join('');
    $('load-btns').innerHTML = [100, 1000, 10000].map(function (n) {
      return '<button type="button" class="seg mono" data-load="' + n + '" aria-pressed="' + (n === S.load) + '">' + fmt(n, 0) + '</button>';
    }).join('');
    $('keyper-btns').innerHTML = S.online.map(function (on, i) {
      return '<button type="button" class="seg kp mono" data-kp="' + i + '" aria-pressed="' + on + '">K' + (i + 1) + (on ? ' on' : ' off') + '</button>';
    }).join('');
  }

  /* ---------- panels ---------- */
  function renderPanels() {
    var b = S.latest, P = PROFILES[S.profile];
    var onCount = S.online.filter(Boolean).length;

    var banner = $('banner');
    banner.classList.toggle('paused', b.paused);
    banner.textContent = b.paused
      ? 'Paused: ' + onCount + ' of 5 keypers online, threshold is 3. No batch is decrypted and no order is readable. Trading resumes when a keyper returns.'
      : 'Live: ' + onCount + ' of 5 keypers online. Each batch key comes from the third-fastest share.';

    $('ring-bn').textContent = fmt(b.bn, 0);
    $('pipe-bn').textContent = fmt(b.bn, 0);
    $('race-bn').textContent = fmt(b.bn, 0);
    $('pipe-total').textContent = b.paused ? 'stalled' : ms(b.total);
    $('pipe-total').style.color = b.paused ? 'var(--red)' : 'var(--text)';
    $('pipe-sub').textContent = 'from batch close to fills, ' + P.label.toLowerCase() + ' profile';

    var segs = [
      { name: 'Wait for the batch to close', v: 50, c: '#3A4350', note: 'Average; 0 to 100 ms' },
      { name: 'Commit certificate, 3 of 4', v: b.commit, c: '#5AA9FF', note: 'Two hops between committee nodes' }
    ];
    if (b.paused) {
      segs.push({ name: 'Key, 3 of 5 shares', v: null, c: '#8A3B3B', note: 'Only ' + onCount + ' keypers online; nothing is decrypted' });
    } else {
      segs.push({ name: 'Key, 3 of 5 shares', v: b.key, c: '#34D1B2', note: 'One hop to the third-fastest keyper, plus combining' });
      segs.push({ name: 'Decrypt ' + fmt(b.orders, 0) + ' orders', v: b.dec, c: '#FFA94D', note: 'One pairing per order, ' + CORES + ' cores' });
      segs.push({ name: 'Clear, margin, funding', v: b.clr, c: '#C9D1DB', note: 'One uniform price per market' });
    }
    var sum = b.paused ? (50 + b.commit) / 0.6 : b.total;
    $('pipe-bar').innerHTML = segs.map(function (g) {
      var w = g.v === null ? 40 : 100 * g.v / sum;
      return '<div style="width:' + w.toFixed(2) + '%;background:' + g.c + '"></div>';
    }).join('');
    $('pipe-legend').innerHTML = segs.map(function (g) {
      return '<div class="pl" role="row"><span class="sw" style="background:' + g.c + '" aria-hidden="true"></span><span role="cell">' + esc(g.name) + '</span><span role="cell" class="ms">' + (g.v === null ? 'waiting' : ms(g.v)) + '</span><span role="cell" class="nt">' + esc(g.note) + '</span></div>';
    }).join('');

    var warn = !b.paused && b.dec > 100;
    $('dec-ms').textContent = b.paused ? 'idle' : ms(b.dec);
    $('dec-ms').style.color = warn ? 'var(--orange)' : 'var(--text)';
    $('dec-load').textContent = fmt(S.load, 0);
    $('dec-cores').textContent = String(Math.max(1, Math.ceil(S.load * 10 * PAIRING_MS / 1000)));
    $('dec-warn').hidden = !warn;

    var node = function (n, role, dot, state, red) {
      return '<div class="node"><span class="d" style="background:' + dot + '" aria-hidden="true"></span><span class="n">' + n + '</span><span class="r">' + role + '</span><span class="s"' + (red ? ' style="color:var(--red)"' : '') + '>' + state + '</span></div>';
    };
    var kNode = function (i) { var v = b.shares[i]; return node('K' + (i + 1), 'Keyper', S.online[i] ? 'var(--teal)' : 'var(--red)', v === null ? 'offline' : ms(v), v === null); };
    var cNode = function (n) { return node(n, 'Committee', 'var(--blue)', 'signing', false); };
    var regions = [
      [node('GW', 'Gateway', '#C9D1DB', 'online', false), cNode('C1'), cNode('C2'), kNode(0), kNode(1)],
      [cNode('C3'), kNode(2), kNode(3)],
      [cNode('C4'), kNode(4)]
    ];
    $('regions').innerHTML = regions.map(function (nodes, r) {
      return '<div class="region"><div class="region-head"><b>' + P.regions[r] + '</b><span class="muted small">' + P.hop[r] + '</span></div>' + nodes.join('') + '</div>';
    }).join('');

    var maxShare = Math.max.apply(null, b.shares.map(function (v) { return v === null ? 0 : v; }).concat([1]));
    var order = [0, 1, 2, 3, 4].sort(function (x, y) {
      var a = b.shares[x], c = b.shares[y];
      if (a === null) { return 1; }
      if (c === null) { return -1; }
      return a - c;
    });
    $('race').innerHTML = order.map(function (i, rank) {
      var v = b.shares[i], reg = P.regions[K_REGION[i]];
      if (v === null) {
        return '<div class="rc"><span class="mono">K' + (i + 1) + '</span><div><div class="tk"></div><span class="nt">' + reg + ', stopped</span></div><span class="ms" style="color:var(--red)">offline</span></div>';
      }
      var third = !b.paused && rank === 2;
      var note = b.paused ? 'waiting for a third share' : (rank < 3 ? 'share ' + (rank + 1) + ' of 3' + (third ? ': opens the batch' : '') : 'not needed this batch');
      var c = third ? 'var(--teal)' : (rank < 2 && !b.paused ? '#2E7D6B' : '#3A4350');
      return '<div class="rc"><span class="mono">K' + (i + 1) + '</span><div><div class="tk"><div class="fl" style="width:' + (100 * v / maxShare).toFixed(1) + '%;background:' + c + '"></div></div><span class="nt">' + reg + ', ' + note + '</span></div><span class="ms"' + (third ? ' style="color:var(--teal)"' : '') + '>' + ms(v) + '</span></div>';
    }).join('');

    $('log-rows').innerHTML = S.log.map(function (r) { return r.html; }).join('');
  }

  function renderEvidence() {
    $('evidence').hidden = !S.evidence;
    $('ev-text').textContent = S.evidence || '';
  }

  /* ---------- the ring ---------- */
  var steps = document.querySelectorAll('#ring-steps li');
  var ring = new window.KeyperRing($('ring-svg'), {
    onToggle: function (i) { toggleKeyper(i); },
    onStage: function (i, text, paused) {
      for (var k = 0; k < steps.length; k++) { steps[k].classList.toggle('active', k === i); }
      var st = $('ring-stage');
      st.textContent = text;
      st.classList.toggle('paused', paused);
    },
    onEarly: function (i, bn) {
      S.evidence = 'K' + (i + 1) + ' published its signed share for batch #' + fmt(bn, 0) + ' before the commit certificate existed. The share verifies against K' + (i + 1) + "'s public key, so it is proof of the violation. This mock logs it; a production venue could slash the keyper's stake.";
      renderEvidence();
    },
    onEnd: function () { if (S.active) { cycle(true); } }
  });

  function cycle(advance) {
    if (advance) { S.batchNo += BATCHES_PER_CYCLE; }
    S.latest = mkBatch();
    var bn = S.latest.bn;
    S.log = [logRow(S.latest)].concat(S.log.filter(function (r) { return r.bn !== bn; })).slice(0, 7);
    renderPanels();
    var early = -1;
    if (S.earlyNext) {
      S.earlyNext = false;
      early = S.online[3] ? 3 : S.online.indexOf(true);
    }
    ring.setNodes(S.online, PROFILES[S.profile].regions, K_REGION);
    ring.play(S.latest, early);
  }

  function apply(change) {
    for (var k in change) { if (Object.prototype.hasOwnProperty.call(change, k)) { S[k] = change[k]; } }
    renderControls();
    if (S.active) { cycle(false); } else { S.latest = mkBatch(); renderPanels(); ring.setNodes(S.online, PROFILES[S.profile].regions, K_REGION); }
  }

  function toggleKeyper(i) {
    var on = S.online.slice();
    on[i] = !on[i];
    apply({ online: on });
  }

  /* ---------- wiring ---------- */
  $('profile-btns').addEventListener('click', function (e) { var b = e.target.closest('[data-profile]'); if (b) { apply({ profile: b.getAttribute('data-profile') }); } });
  $('load-btns').addEventListener('click', function (e) { var b = e.target.closest('[data-load]'); if (b) { apply({ load: Number(b.getAttribute('data-load')) }); } });
  $('keyper-btns').addEventListener('click', function (e) { var b = e.target.closest('[data-kp]'); if (b) { toggleKeyper(Number(b.getAttribute('data-kp'))); } });
  $('early-btn').addEventListener('click', function () {
    if (S.online.indexOf(true) < 0) { return; }
    S.earlyNext = true;
    if (S.active) { cycle(false); }
  });
  $('ev-dismiss').addEventListener('click', function () { S.evidence = null; renderEvidence(); });

  function onView(v) {
    var want = v === 'engine';
    if (want === S.active) { return; }
    S.active = want;
    if (want) { cycle(false); } else { ring.stop(); }
  }
  window.addEventListener('viewchange', function (e) { onView(e.detail); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { onView('hidden'); } else { onView(APP.view()); }
  });

  renderControls();
  S.latest = mkBatch();
  S.log = [logRow(S.latest)];
  renderPanels();
  renderEvidence();
  ring.setNodes(S.online, PROFILES[S.profile].regions, K_REGION);
})();
