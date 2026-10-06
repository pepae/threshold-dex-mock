/* Keyper ring: an SVG animation of one batch being committed and unlocked.
   Five keypers sit on a ring, four committee nodes on an inner ring, the batch in the middle.
   Flight times are the simulated network delays, scaled up so they can be watched. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var COL = { blue: '#5AA9FF', teal: '#34D1B2', orange: '#FFA94D', amber: '#FFC857', red: '#FF8A8A', line: '#2A313C', faint: '#1F2630', panel: '#151A22', text: '#E7EBF0', muted: '#A3ADBA', dim: '#3A4350' };
  var W = 680, H = 472, CX = 340, CY = 236, RK = 172, RC = 96, R_CENTER = 46;
  var K_ANG = [-90, -18, 54, 126, 198];
  var C_ANG = [-54, 18, 162, 234];
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) { e.setAttribute(k, attrs[k]); } }
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function polar(r, deg) { var a = deg * Math.PI / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
  function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function bez(a, c, b, p) {
    var q = 1 - p;
    return { x: q * q * a.x + 2 * q * p * c.x + p * p * b.x, y: q * q * a.y + 2 * q * p * c.y + p * p * b.y };
  }

  function Ring(svg, cb) {
    this.svg = svg;
    this.cb = cb || {};
    this.parts = [];
    this.pulses = [];
    this.events = [];
    this.raf = null;
    this.running = false;
    this.build();
  }

  Ring.prototype.build = function () {
    var s = this.svg, self = this;
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    el('circle', { cx: CX, cy: CY, r: RK, fill: 'none', stroke: COL.faint, 'stroke-width': 1.5, 'stroke-dasharray': '2 7' }, s);
    el('circle', { cx: CX, cy: CY, r: RC, fill: 'none', stroke: COL.faint, 'stroke-width': 1 }, s);
    this.spokes = el('g', {}, s);
    this.fx = el('g', {}, s);
    this.partLayer = el('g', {}, s);

    // committee nodes
    this.cPos = C_ANG.map(function (a) { return polar(RC, a); });
    this.cEls = this.cPos.map(function (p, j) {
      var g = el('g', {}, s);
      var r = el('rect', { x: p.x - 13, y: p.y - 13, width: 26, height: 26, rx: 6, fill: '#10203A', stroke: COL.blue, 'stroke-width': 1.5 }, g);
      var t = el('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'IBM Plex Mono, monospace', fill: COL.text }, g);
      t.textContent = 'C' + (j + 1);
      return { g: g, rect: r };
    });

    // center: the batch
    this.center = el('g', {}, s);
    this.cCircle = el('circle', { cx: CX, cy: CY, r: R_CENTER, fill: COL.panel, stroke: COL.dim, 'stroke-width': 2.5 }, this.center);
    this.lockG = el('g', {}, this.center);
    this.shackle = el('path', { d: 'M' + (CX - 8) + ' ' + (CY - 6) + ' v-6 a8 8 0 0 1 16 0 v6', fill: 'none', stroke: COL.muted, 'stroke-width': 3, 'stroke-linecap': 'round' }, this.lockG);
    this.lockBody = el('rect', { x: CX - 13, y: CY - 7, width: 26, height: 19, rx: 4, fill: COL.muted }, this.lockG);
    this.dots = [0, 1, 2].map(function (i) {
      return el('circle', { cx: CX - 12 + i * 12, cy: CY + 27, r: 3.5, fill: 'none', stroke: COL.dim, 'stroke-width': 1.5 }, self.center);
    });
    this.cText = el('text', { x: CX, y: CY + R_CENTER + 20, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'IBM Plex Mono, monospace', fill: COL.muted, stroke: COL.panel, 'stroke-width': 5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, s);

    // keypers
    this.kPos = K_ANG.map(function (a) { return polar(RK, a); });
    this.kEls = this.kPos.map(function (p, i) {
      var g = el('g', { 'class': 'kp', role: 'button', tabindex: 0, 'aria-label': 'Keyper K' + (i + 1) + ': click to stop or restart' }, s);
      var ring = el('circle', { 'class': 'kp-ring', cx: p.x, cy: p.y, r: 29, fill: '#10251F', stroke: '#2E7D6B', 'stroke-width': 2 }, g);
      var name = el('text', { x: p.x, y: p.y - 1, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, 'font-family': 'IBM Plex Mono, monospace', fill: COL.text }, g);
      name.textContent = 'K' + (i + 1);
      var st = el('text', { x: p.x, y: p.y + 14, 'text-anchor': 'middle', 'font-size': 10.5, 'font-family': 'IBM Plex Mono, monospace', fill: COL.muted }, g);
      var lp = polar(RK + 50, K_ANG[i]);
      var cos = Math.cos(K_ANG[i] * Math.PI / 180);
      var anchor = Math.abs(cos) < 0.2 ? 'middle' : (cos > 0 ? 'start' : 'end');
      var reg = el('text', { x: lp.x + (anchor === 'start' ? -14 : anchor === 'end' ? 14 : 0), y: lp.y + (K_ANG[i] === -90 ? 4 : 4), 'text-anchor': anchor, 'font-size': 12, fill: COL.muted, 'font-family': 'IBM Plex Sans, sans-serif' }, s);
      var act = function (e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        if (self.cb.onToggle) { self.cb.onToggle(i); }
      };
      g.addEventListener('click', act);
      g.addEventListener('keydown', act);
      return { g: g, ring: ring, st: st, reg: reg };
    });
    this.setCenter('idle');
  };

  Ring.prototype.setNodes = function (online, regionNames, kRegion) {
    for (var i = 0; i < 5; i++) {
      var k = this.kEls[i];
      k.ring.setAttribute('fill', online[i] ? '#10251F' : '#2A1616');
      k.ring.setAttribute('stroke', online[i] ? '#2E7D6B' : '#8A3B3B');
      k.ring.setAttribute('stroke-dasharray', online[i] ? 'none' : '4 4');
      k.st.textContent = online[i] ? 'ready' : 'offline';
      k.st.setAttribute('fill', online[i] ? COL.muted : COL.red);
      k.reg.textContent = regionNames[kRegion[i]];
    }
    this.online = online.slice();
  };

  Ring.prototype.setCenter = function (state, label) {
    var stroke = COL.dim, lock = COL.muted, open = false;
    if (state === 'committed') { stroke = COL.blue; lock = COL.blue; }
    if (state === 'open') { stroke = COL.teal; lock = COL.teal; open = true; }
    if (state === 'waiting') { stroke = COL.red; lock = COL.red; }
    this.cCircle.setAttribute('stroke', stroke);
    this.lockBody.setAttribute('fill', lock);
    this.shackle.setAttribute('stroke', lock);
    this.shackle.setAttribute('transform', open ? 'translate(9 -7) rotate(28 ' + (CX + 8) + ' ' + (CY - 6) + ')' : '');
    if (label !== undefined) { this.cText.textContent = label; this.cText.setAttribute('fill', state === 'waiting' ? COL.red : (state === 'open' ? COL.teal : COL.muted)); }
  };

  Ring.prototype.setDots = function (n, paused) {
    for (var i = 0; i < 3; i++) {
      var on = i < n;
      this.dots[i].setAttribute('fill', on ? COL.teal : 'none');
      this.dots[i].setAttribute('stroke', on ? COL.teal : (paused ? COL.red : COL.dim));
    }
  };

  /* particle from a to b along a curve; bend > 0 bends clockwise */
  Ring.prototype.particle = function (a, b, t0, dur, color, opts) {
    opts = opts || {};
    var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var bend = opts.bend === undefined ? 26 : opts.bend;
    var ctrl = opts.ctrl || { x: mid.x - dy / len * bend, y: mid.y + dx / len * bend };
    var r = opts.r || 5.5;
    var halo = el('circle', { r: r * 2.4, fill: color, opacity: 0 }, this.partLayer);
    var trail = el('circle', { r: r * 0.6, fill: color, opacity: 0 }, this.partLayer);
    var head = el('circle', { r: r, fill: color, opacity: 0 }, this.partLayer);
    var p = { a: a, b: b, c: ctrl, t0: t0, dur: dur, head: head, trail: trail, halo: halo, op: opts.opacity || 1, onArrive: opts.onArrive, done: false };
    this.parts.push(p);
    return p;
  };

  Ring.prototype.pulse = function (t0, r0, r1, dur, color, width) {
    if (REDUCED) { return; }
    var c = el('circle', { cx: CX, cy: CY, r: r0, fill: 'none', stroke: color, 'stroke-width': width || 2, opacity: 0 }, this.fx);
    this.pulses.push({ c: c, t0: t0, r0: r0, r1: r1, dur: dur });
  };

  Ring.prototype.at = function (t, fn) { this.events.push({ t: t, fn: fn, done: false }); };

  Ring.prototype.clear = function () {
    this.parts.forEach(function (p) { p.head.remove(); p.trail.remove(); p.halo.remove(); });
    this.pulses.forEach(function (p) { p.c.remove(); });
    this.parts = []; this.pulses = []; this.events = [];
    while (this.spokes.firstChild) { this.spokes.firstChild.remove(); }
  };

  Ring.prototype.stop = function () {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  };

  /* batch: { bn, commit, shares[5] (ms or null), paused, orders }, early: keyper index or -1 */
  Ring.prototype.play = function (batch, early) {
    var self = this;
    this.stop();
    this.clear();
    var stage = function (i, text, paused) { if (self.cb.onStage) { self.cb.onStage(i, text, !!paused); } };
    var bnTxt = '#' + APP.fmt(batch.bn, 0);

    this.setCenter('sealed', 'sealed');
    this.setDots(0, false);
    for (var i = 0; i < 5; i++) {
      var k = this.kEls[i];
      k.st.textContent = batch.shares[i] === null ? 'offline' : 'ready';
      k.ring.setAttribute('stroke-width', 2);
      if (batch.shares[i] !== null) { k.ring.setAttribute('stroke', '#2E7D6B'); }
    }
    stage(0, 'Committee signing batch ' + bnTxt);

    // 1. committee signatures fly to the batch
    var commitDisp = 600 + batch.commit * 2.2;
    var factors = [0.72, 0.88, 1.0, 1.22];
    this.cPos.forEach(function (p, j) {
      self.particle(p, { x: CX, y: CY }, 0, commitDisp * factors[j], COL.blue, { bend: 14, r: 4.5 });
    });
    var tCert = commitDisp;
    this.at(tCert, function () {
      self.setCenter('committed', 'committed by 3 of 4');
      self.pulse(tCert, R_CENTER, RK - 30, 420, COL.blue, 2);
      stage(1, 'Commit certificate sent to the keypers');
    });

    // optional early share: arrives before the commit, which is the violation
    if (early >= 0 && batch.shares[early] !== null) {
      this.at(200, function () {
        self.kEls[early].ring.setAttribute('stroke', COL.amber);
        self.kEls[early].ring.setAttribute('stroke-width', 3);
        self.kEls[early].st.textContent = 'early!';
      });
      this.particle(this.kPos[early], { x: CX, y: CY }, 200, 700, COL.amber, {
        r: 6.5,
        onArrive: function () {
          self.pulse(900, R_CENTER, R_CENTER + 40, 480, COL.amber, 3);
          if (self.cb.onEarly) { self.cb.onEarly(early, batch.bn); }
        }
      });
    }

    // 2. each online keyper sends its share once it has the certificate
    var tShare = tCert + 420;
    var flights = [];
    for (var n = 0; n < 5; n++) {
      if (batch.shares[n] !== null) { flights.push({ i: n, ms: batch.shares[n], d: 520 + batch.shares[n] * 14 }); }
    }
    var sorted = flights.slice().sort(function (a, b) { return a.d - b.d; });
    sorted.forEach(function (f, rank) { f.rank = rank; });
    var arrived = 0;
    flights.forEach(function (f) {
      var needed = !batch.paused && f.rank < 3;
      var col = batch.paused || needed ? COL.teal : COL.dim;
      self.at(tShare, function () { self.kEls[f.i].st.textContent = APP.ms(f.ms); });
      // faint spoke while the share travels
      el('line', { x1: self.kPos[f.i].x, y1: self.kPos[f.i].y, x2: CX, y2: CY, stroke: COL.faint, 'stroke-width': 1 }, self.spokes);
      self.particle(self.kPos[f.i], { x: CX, y: CY }, tShare, f.d, col, {
        r: needed ? 7 : 5.5,
        onArrive: function () {
          if (batch.paused || needed) {
            arrived = Math.min(arrived + 1, 3);
            self.setDots(arrived, batch.paused);
            if (needed && f.rank === 2) { self.kEls[f.i].ring.setAttribute('stroke', COL.teal); self.kEls[f.i].ring.setAttribute('stroke-width', 3); }
          } else {
            self.kEls[f.i].st.textContent = 'spare';
          }
        }
      });
      // gossip: the same share also goes to the neighbouring keypers
      if (!REDUCED) {
        [-1, 1].forEach(function (dir) {
          var j = (f.i + dir + 5) % 5;
          if (batch.shares[j] === null) { return; }
          var midAng = K_ANG[f.i] + dir * 36;
          var c = polar(RK * 1.32, midAng);
          self.particle(self.kPos[f.i], self.kPos[j], tShare, f.d * 1.1, COL.teal, { ctrl: c, r: 3.5, opacity: 0.5 });
        });
      }
    });

    var end;
    if (!batch.paused) {
      var tKey = tShare + sorted[2].d;
      this.at(tShare + 1, function () { stage(2, 'Shares in flight to batch ' + bnTxt); });
      this.at(tKey, function () {
        self.setCenter('open', 'key released: 3 of 5');
        self.pulse(tKey, R_CENTER, R_CENTER + 70, 520, COL.teal, 3);
        stage(3, 'Third share arrived: batch ' + bnTxt + ' unlocked');
      });
      var tDec = tKey + 260;
      this.at(tDec, function () { stage(4, 'Decrypting ' + APP.fmt(batch.orders, 0) + ' orders, one price per market'); });
      this.cPos.forEach(function (p) { self.particle({ x: CX, y: CY }, p, tDec, 520, COL.orange, { bend: -14, r: 4.5 }); });
      end = Math.max(tDec + 520 + 1300, 3600);
    } else {
      var last = flights.length ? sorted[sorted.length - 1].d : 0;
      this.at(tShare + 1, function () { stage(2, 'Waiting for a third share: only ' + flights.length + ' keypers online', true); });
      this.at(tShare + last + 80, function () {
        self.setCenter('waiting', 'waiting for keys');
        self.pulse(tShare + last + 80, R_CENTER, R_CENTER + 26, 700, COL.red, 2);
      });
      end = tShare + last + 2200;
    }

    this.start = performance.now();
    this.end = end;
    this.running = true;
    var frame = function (now) {
      if (!self.running) { return; }
      var t = now - self.start;
      self.events.forEach(function (ev) { if (!ev.done && t >= ev.t) { ev.done = true; ev.fn(); } });
      self.parts.forEach(function (p) {
        if (p.done) { return; }
        var q = (t - p.t0) / p.dur;
        if (q < 0) { return; }
        if (q >= 1) {
          p.done = true; p.head.setAttribute('opacity', 0); p.trail.setAttribute('opacity', 0); p.halo.setAttribute('opacity', 0);
          if (p.onArrive) { p.onArrive(); }
          return;
        }
        var e = ease(q), pos = bez(p.a, p.c, p.b, e), tp = bez(p.a, p.c, p.b, ease(Math.max(0, q - 0.07)));
        p.head.setAttribute('cx', pos.x); p.head.setAttribute('cy', pos.y); p.head.setAttribute('opacity', p.op);
        p.trail.setAttribute('cx', tp.x); p.trail.setAttribute('cy', tp.y); p.trail.setAttribute('opacity', p.op * 0.4);
        p.halo.setAttribute('cx', pos.x); p.halo.setAttribute('cy', pos.y); p.halo.setAttribute('opacity', p.op * 0.18);
      });
      self.pulses.forEach(function (pl) {
        var q = (t - pl.t0) / pl.dur;
        if (q < 0 || q > 1) { pl.c.setAttribute('opacity', 0); return; }
        pl.c.setAttribute('r', pl.r0 + (pl.r1 - pl.r0) * q);
        pl.c.setAttribute('opacity', (1 - q) * 0.9);
      });
      if (t >= self.end) {
        self.running = false;
        if (self.cb.onEnd) { self.cb.onEnd(); }
        return;
      }
      self.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  };

  window.KeyperRing = Ring;
})();
