/* 小小遊戲樂園 — 共用遊戲引擎 v2
 * 舊款 iPad 順暢的關鍵：
 *   1. 分層繪圖：不會動的背景畫在「背景層」只畫一次；捲動背景用 CSS 位移（交給 GPU 合成）；
 *      主畫布每幀只畫會動的角色。
 *   2. 自動畫質：掉幀時自動降低解析度，並記住這台裝置適合的畫質。
 *   3. 外框字快取、懶惰重繪（棋盤類沒變化就不重畫）。
 * 只用 ES2017 語法、觸控事件、Canvas 2D。美術素材：Kenney.nl（CC0）。
 */
(function () {
  'use strict';
  var GG = window.GG = window.GG || {};

  /* ---------- 儲存 ---------- */
  GG.load = function (k, d) {
    try { var v = localStorage.getItem('gg_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  };
  GG.save = function (k, v) {
    try { localStorage.setItem('gg_' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ }
  };

  /* ---------- 音效：WebAudio 合成 ---------- */
  var AC = null, noiseBuf = null, muted = GG.load('muted', false);
  function unlockAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try {
      AC = new C();
      var b = AC.createBuffer(1, 1, 22050), s = AC.createBufferSource();
      s.buffer = b; s.connect(AC.destination); s.start(0);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  document.addEventListener('touchend', unlockAudio, true);
  document.addEventListener('mousedown', unlockAudio, true);
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!AC || muted) return;
    var t = AC.currentTime + (delay || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (!AC || muted || !noiseBuf) return;
    var t = AC.currentTime, s = AC.createBufferSource(), g = AC.createGain();
    s.buffer = noiseBuf;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(g); g.connect(AC.destination);
    s.start(t); s.stop(t + dur);
  }
  function seq(notes, step, type, vol) {
    for (var i = 0; i < notes.length; i++) tone(notes[i], step * 1.4, type, vol, null, i * step);
  }
  var SFX = {
    click: function () { tone(660, 0.06, 'square', 0.05); },
    move: function () { tone(440, 0.05, 'triangle', 0.08); },
    pop: function () { tone(520, 0.1, 'sine', 0.18, 1040); },
    coin: function () { tone(988, 0.08, 'square', 0.06); tone(1319, 0.16, 'square', 0.06, null, 0.08); },
    jump: function () { tone(300, 0.18, 'square', 0.06, 700); },
    bounce: function () { tone(420, 0.06, 'sine', 0.18); },
    shoot: function () { tone(900, 0.08, 'square', 0.04, 300); },
    hit: function () { tone(220, 0.14, 'sawtooth', 0.1, 90); },
    hurt: function () { tone(330, 0.12, 'square', 0.08, 160); tone(250, 0.18, 'square', 0.06, 120, 0.1); },
    boom: function () { noise(0.4, 0.25); tone(120, 0.3, 'sawtooth', 0.1, 40); },
    clear: function () { seq([660, 880, 1100], 0.06, 'triangle', 0.12); },
    power: function () { seq([523, 659, 784, 1047], 0.05, 'square', 0.06); },
    win: function () { seq([523, 659, 784, 1047, 1319], 0.11, 'triangle', 0.16); },
    lose: function () { seq([392, 330, 262], 0.16, 'triangle', 0.14); },
    goal: function () { noise(0.5, 0.1); seq([784, 988, 1175], 0.09, 'square', 0.08); },
    tick: function () { tone(880, 0.08, 'sine', 0.12); },
    go: function () { tone(1320, 0.25, 'sine', 0.14); },
    splash: function () { noise(0.25, 0.12); tone(600, 0.15, 'sine', 0.08, 200); }
  };
  GG.sfx = function (n) { try { if (SFX[n]) SFX[n](); } catch (e) { /* 忽略 */ } };

  /* ---------- 小工具 ---------- */
  GG.FONT = '"Arial Rounded MT Bold", -apple-system, "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif';
  GG.INK = '#3a3850';
  GG.rand = function (a, b) { return a + Math.random() * (b - a); };
  GG.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  GG.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  GG.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  GG.lerp = function (a, b, t) { return a + (b - a) * t; };
  GG.dist = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  GG.shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  GG.ease = function (t) { return 1 - (1 - t) * (1 - t); };
  GG.back = function (t) { var c = 1.7; t -= 1; return t * t * ((c + 1) * t + c) + 1; }; // 彈跳感
  GG.rr = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  GG.panel = function (ctx, x, y, w, h, r, fill, line) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; GG.rr(ctx, x, y + 6, w, h, r); ctx.fill();
    ctx.fillStyle = fill; GG.rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.lineWidth = line || 4; ctx.strokeStyle = GG.INK; GG.rr(ctx, x, y, w, h, r); ctx.stroke();
  };

  /* ---------- 畫質（解析度）：掉幀時自動往下調 ---------- */
  var QUALITY = [2, 1.5, 1];
  var dev = window.devicePixelRatio || 1;
  var qi = GG.load('quality', dev >= 2 ? 1 : 2);
  function applyQuality() { GG.dpr = Math.min(dev, QUALITY[qi]); }
  applyQuality();

  /* ---------- 外框字快取：strokeText 很貴，畫好一次重複使用 ---------- */
  var tcache = new Map();
  GG.text = function (ctx, s, x, y, size, color, align, outline, sc) {
    size = Math.round(size); sc = sc || 1;
    if (!outline) {
      ctx.font = '900 ' + size + 'px ' + GG.FONT;
      ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(s, x, y);
      return;
    }
    var key = s + '|' + size + '|' + color + '|' + outline, e = tcache.get(key);
    if (e) { tcache.delete(key); tcache.set(key, e); }
    else {
      var lw = Math.max(3, size * 0.18), pad = Math.ceil(lw + 2), font = '900 ' + size + 'px ' + GG.FONT;
      var m = document.createElement('canvas').getContext('2d');
      m.font = font;
      var tw = Math.ceil(m.measureText(s).width) + pad * 2, th = Math.ceil(size * 1.45) + pad;
      var c = document.createElement('canvas');
      c.width = Math.ceil(tw * GG.dpr); c.height = Math.ceil(th * GG.dpr);
      var g = c.getContext('2d');
      g.scale(GG.dpr, GG.dpr);
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = outline === true ? GG.INK : outline;
      g.strokeText(s, tw / 2, th / 2);
      g.fillStyle = color; g.fillText(s, tw / 2, th / 2);
      e = { c: c, w: tw, h: th, pad: pad };
      tcache.set(key, e);
      if (tcache.size > 260) tcache.delete(tcache.keys().next().value);
    }
    var ew = e.w * sc, eh = e.h * sc;
    var ax = align === 'left' ? x - e.pad * sc : align === 'right' ? x - ew + e.pad * sc : x - ew / 2;
    ctx.drawImage(e.c, ax, y - eh / 2, ew, eh);
  };
  GG.sprite = function (w, h, draw) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * GG.dpr); c.height = Math.ceil(h * GG.dpr);
    var g = c.getContext('2d');
    g.scale(GG.dpr, GG.dpr);
    draw(g, w, h);
    return c;
  };
  GG.bg = function (ctx, w, h, c1, c2) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };

  /* ---------- 圖片素材 ---------- */
  GG.img = {};
  var COMMON = { _win: 'bunny/hero_jump', _lose: 'bunny/hero_hurt', _star: 'ui/star', _heart: 'ui/heart', _heart0: 'ui/heart_empty',
    _coin: 'bunny/gold_1' };
  function loadImages(map, done) {
    var keys = Object.keys(map), left = keys.length;
    if (!left) { done(); return; }
    keys.forEach(function (k) {
      var im = new Image();
      im.onload = im.onerror = function () { if (--left === 0) done(); };
      im.src = 'assets/' + map[k] + (map[k].indexOf('.') < 0 ? '.png' : '');
      GG.img[k] = im;
    });
  }
  /* 以 (x,y) 為中心畫圖；o = {rot, flip, alpha, sx, sy} */
  GG.spr = function (ctx, key, x, y, w, h, o) {
    var im = typeof key === 'string' ? GG.img[key] : key;
    if (!im || !im.width) return;
    if (h === undefined || h === null) h = w * (im.height / im.width);
    if (!o) { ctx.drawImage(im, x - w / 2, y - h / 2, w, h); return; }
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip || o.sx || o.sy) ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  };
  GG.ratio = function (key) { var im = GG.img[key]; return im && im.width ? im.height / im.width : 1; };
  GG.tile = function (ctx, key, x, y, w, h, size, offX, offY) {
    var im = GG.img[key];
    if (!im || !im.width) return;
    var sh = size * im.height / im.width;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    var ox = ((offX || 0) % size + size) % size, oy = ((offY || 0) % sh + sh) % sh;
    for (var yy = y - sh + oy; yy < y + h; yy += sh)
      for (var xx = x - size + ox; xx < x + w; xx += size) ctx.drawImage(im, xx, yy, size + 0.5, sh + 0.5);
    ctx.restore();
  };

  /* ---------- 分層：背景畫布（只在版面改變時重畫）與捲動層（CSS 位移） ---------- */
  var layers = {};
  function addEl(el) {
    el.style.position = 'absolute'; el.style.left = '0'; el.style.top = '0';
    el.style.pointerEvents = 'none';
    stage.insertBefore(el, cv);
  }
  /* 背景畫布：ly.paint(function(g, w, h){...}) 在 resize 時呼叫 */
  GG.canvasLayer = function (id, lowres) {
    var ly = layers[id];
    if (!ly) {
      var c = document.createElement('canvas');
      addEl(c);
      ly = layers[id] = { c: c, g: c.getContext('2d') };
      ly.paint = function (fn) {
        var s = lowres ? Math.min(GG.dpr, 1) : GG.dpr;
        c.width = Math.round(W * s); c.height = Math.round(H * s);
        c.style.width = W + 'px'; c.style.height = H + 'px';
        ly.g.setTransform(s, 0, 0, s, 0, 0);
        ly.g.clearRect(0, 0, W, H);
        fn(ly.g, W, H);
      };
    }
    return ly;
  };
  /* 捲動層：用重複的背景圖（圖片路徑或畫布）鋪滿方框，捲動只改 CSS transform */
  GG.scrollLayer = function (id) {
    var ly = layers[id];
    if (!ly) {
      var box = document.createElement('div'), inner = document.createElement('div');
      box.style.overflow = 'hidden';
      inner.style.position = 'absolute'; inner.style.left = '0'; inner.style.top = '0';
      inner.style.webkitTransform = inner.style.transform = 'translate3d(0,0,0)';
      box.appendChild(inner);
      addEl(box);
      ly = layers[id] = { box: box, inner: inner, tw: 1, th: 1, lx: null, ly: null };
      ly.set = function (src, x, y, w, h, tw, th, repeat) {
        ly.tw = tw; ly.th = th;
        box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
        inner.style.width = (w + tw * 2) + 'px'; inner.style.height = (h + th * 2) + 'px';
        inner.style.backgroundImage = 'url(' + (typeof src === 'string' ? 'assets/' + src + '.png' : src.toDataURL()) + ')';
        inner.style.backgroundSize = tw + 'px ' + th + 'px';
        inner.style.backgroundRepeat = repeat || 'repeat';
        ly.lx = ly.ly = null;
        ly.scroll(0, 0);
      };
      ly.scroll = function (ox, oy) {
        var px = -Math.round(((ox % ly.tw) + ly.tw) % ly.tw), py = -Math.round(((oy % ly.th) + ly.th) % ly.th);
        if (px === ly.lx && py === ly.ly) return;
        ly.lx = px; ly.ly = py;
        inner.style.webkitTransform = inner.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
      };
      ly.show = function (v) { box.style.display = v ? '' : 'none'; };
    }
    return ly;
  };

  /* ---------- 粒子特效、飄字、震動 ---------- */
  var parts = [];
  GG.burst = function (x, y, o) {
    o = o || {};
    var n = o.n || 10;
    for (var i = 0; i < n && parts.length < 160; i++) {
      var a = o.angle !== undefined ? o.angle + GG.rand(-o.spread || -0.5, o.spread || 0.5) : Math.random() * Math.PI * 2;
      var sp = (o.speed || 220) * GG.rand(0.4, 1);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), life: o.life || 0.7, t: 0,
        size: (o.size || 12) * GG.rand(0.6, 1.2), g: o.gravity === undefined ? 600 : o.gravity, img: o.img,
        col: o.colors ? GG.pick(o.colors) : null, rot: Math.random() * 6, spin: GG.rand(-8, 8) });
    }
  };
  GG.floatText = function (x, y, s, color, size) {
    parts.push({ x: x, y: y, vx: 0, vy: -70, life: 1, t: 0, text: s, col: color || '#ffe14d', size: size || 30, g: 0 });
  };
  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.spin || 0) * dt;
    }
  }
  function drawParts() {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = 1 - p.t / p.life;
      if (p.text) {
        ctx.globalAlpha = Math.min(1, k * 2);
        GG.text(ctx, p.text, p.x, p.y, p.size, p.col, 'center', true, 1 + Math.max(0, 0.25 - p.t));
      } else if (p.img) {
        GG.spr(ctx, p.img, p.x, p.y, p.size, p.size, { rot: p.rot, alpha: k });
      } else {
        ctx.globalAlpha = k; ctx.fillStyle = p.col || '#fff';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
  var shakeT = 0, shakeA = 0;
  GG.shake = function (amount, dur) { shakeA = amount || 8; shakeT = dur || 0.25; };
  function updateShake(dt) {
    if (shakeT <= 0) return;
    shakeT -= dt;
    var a = shakeT > 0 ? shakeA * (shakeT / 0.25) : 0;
    var tr = shakeT > 0 ? 'translate3d(' + GG.rand(-a, a).toFixed(1) + 'px,' + GG.rand(-a, a).toFixed(1) + 'px,0)' : '';
    stage.style.webkitTransform = stage.style.transform = tr;
  }
  /* HUD 膠囊底框（Poki 慣例：資訊放在半透明深色圓角底上） */
  GG.pill = function (ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(20,16,50,0.45)'; GG.rr(ctx, x, y, w, h, h / 2); ctx.fill();
  };
  GG.hudText = function (ctx, s, x, y, size, color, align) {
    ctx.font = '900 ' + Math.round(size) + 'px ' + GG.FONT;
    var tw = ctx.measureText(s).width + size * 1.1, h = size * 1.6;
    var x0 = align === 'left' ? x - size * 0.55 : align === 'right' ? x - tw + size * 0.55 : x - tw / 2;
    GG.pill(ctx, x0, y - h / 2, tw, h);
    GG.text(ctx, s, x, y, size, color || '#fff', align || 'center', true);
  };
  /* 愛心生命值（放在膠囊底上，空心愛心半透明白） */
  GG.lives = function (ctx, n, max, x, y, s) {
    s = Math.max(s, 34);
    GG.pill(ctx, x - s * 0.3, y - s * 0.68, max * s * 1.1 + s * 0.5, s * 1.36);
    for (var i = 0; i < max; i++) GG.spr(ctx, i < n ? '_heart' : '_heart0', x + i * s * 1.1 + s / 2, y, s, s);
  };

  /* ---------- 向量小圖示 ---------- */
  GG.icon = function (ctx, name, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = ctx.strokeStyle = color || '#fff';
    ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var h = s / 2;
    function tri(rot) {
      ctx.save(); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(h * 0.75, 0); ctx.lineTo(-h * 0.55, -h * 0.75); ctx.lineTo(-h * 0.55, h * 0.75); ctx.closePath();
      ctx.lineWidth = s * 0.12; ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    if (name === 'right') tri(0);
    else if (name === 'down') tri(Math.PI / 2);
    else if (name === 'left') tri(Math.PI);
    else if (name === 'up') tri(-Math.PI / 2);
    else if (name === 'rotate') {
      ctx.beginPath(); ctx.arc(0, 0, h * 0.62, -Math.PI * 0.35, Math.PI * 1.25); ctx.stroke();
      var a = -Math.PI * 0.35, px = Math.cos(a) * h * 0.62, py = Math.sin(a) * h * 0.62;
      ctx.beginPath(); ctx.moveTo(px + h * 0.42, py - h * 0.05); ctx.lineTo(px - h * 0.1, py - h * 0.42); ctx.lineTo(px - h * 0.05, py + h * 0.3); ctx.closePath(); ctx.fill();
    } else if (name === 'drop') {
      ctx.save(); ctx.translate(0, -h * 0.2); tri(Math.PI / 2); ctx.restore();
      ctx.beginPath(); ctx.moveTo(-h * 0.7, h * 0.72); ctx.lineTo(h * 0.7, h * 0.72); ctx.stroke();
    } else if (name === 'fire') {
      ctx.beginPath(); ctx.arc(0, 0, h * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, h * 0.8, 0, Math.PI * 2); ctx.lineWidth = s * 0.08; ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------- 介面與遊戲迴圈 ---------- */
  var cv, ctx, stage, overlay, elHud, elBest, elTitle, elSnd, elPause;
  var W = 0, H = 0, game = null, meta = null, diff = 0;
  var state = 'boot'; // boot | menu | count | play | paused | over
  var loopId = 0, last = 0, needDraw = true, started = false, countT = 0;
  var pad = [], owners = {};
  var perf = { n: 0, t: 0, skip: 40 };

  GG.state = function () { return state; };
  GG.diff = function () { return diff; };
  GG.redraw = function () { needDraw = true; };

  function resize() {
    if (!stage) return;
    var r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    cv.width = Math.round(W * GG.dpr); cv.height = Math.round(H * GG.dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    GG.W = W; GG.H = H;
    tcache.clear();
    if (game && game.resize && state !== 'boot') game.resize(W, H);
    needDraw = true; perf.skip = 40;
  }
  function lowerQuality() {
    if (qi >= QUALITY.length - 1) return;
    qi++; GG.save('quality', qi); applyQuality();
    resize();
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
  /* 固定搖桿：底座固定不動，旋鈕跟著手指；推的方向高亮 */
  function drawStick(b) {
    var R = b.R, x = b.cx, y = b.cy, kx = b.kx || 0, ky = b.ky || 0;
    ctx.globalAlpha = b.down ? 1 : 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; circle(x, y + 6, R + 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; circle(x, y, R + 8); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    var dirs = b.only === 'x' ? ['left', 'right'] : ['up', 'right', 'down', 'left'];
    for (var i = 0; i < dirs.length; i++) {
      var d = dirs[i], a = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[d];
      var on = b.down && b.dir === d;
      GG.icon(ctx, d, x + Math.cos(a) * R * 0.74, y + Math.sin(a) * R * 0.74, R * (on ? 0.36 : 0.28), on ? '#ffe14d' : 'rgba(255,255,255,0.95)');
    }
    var kr = R * 0.46, px = x + kx * 0.62, py = y + ky * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; circle(px, py + 5, kr); ctx.fill();
    ctx.fillStyle = b.color || '#ffffff'; circle(px, py, kr); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse ? ctx.ellipse(px - kr * 0.25, py - kr * 0.35, kr * 0.4, kr * 0.22, -0.4, 0, Math.PI * 2) : ctx.arc(px - kr * 0.25, py - kr * 0.35, kr * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  /* 圓形動作鈕（開火、跳躍等） */
  function drawRound(b) {
    var r = Math.min(b.w, b.h) / 2, x = b.x + b.w / 2, y = b.y + b.h / 2, sink = b.down ? 4 : 0;
    ctx.globalAlpha = b.down ? 1 : 0.88;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(x, y + 6, r); ctx.fill();
    ctx.fillStyle = b.down ? (b.colorDown || '#ffffff') : (b.color || '#ff5c5c'); circle(x, y + sink, r); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; circle(x, y + sink, r - 7); ctx.stroke();
    var fg = b.down ? GG.INK : (b.textColor || '#fff');
    if (b.img) GG.spr(ctx, b.img, x, y + sink, r * 1.5, r * 1.5);
    else if (b.icon) GG.icon(ctx, b.icon, x, y + sink, r * 0.75, fg);
    if (b.label) GG.text(ctx, b.label, x, y + sink + (b.icon || b.img ? r * 0.62 : 0), b.fs || r * 0.42, '#fff', 'center', true);
    ctx.globalAlpha = 1;
  }
  function drawPad() {
    for (var i = 0; i < pad.length; i++) {
      var b = pad[i];
      if (b.hidden || b.ghost) continue; // ghost：可以按但由遊戲自己畫
      if (b.stick) { drawStick(b); continue; }
      if (b.round) { drawRound(b); continue; }
      var r = b.r === undefined ? 20 : b.r, sink = b.down ? 4 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      GG.rr(ctx, b.x, b.y + 5, b.w, b.h, r); ctx.fill();
      ctx.fillStyle = b.down ? (b.colorDown || '#ffffff') : (b.color || 'rgba(255,255,255,0.3)');
      GG.rr(ctx, b.x, b.y + sink, b.w, b.h, r); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      GG.rr(ctx, b.x + 1.5, b.y + sink + 1.5, b.w - 3, b.h - 3, r); ctx.stroke();
      var fg = b.down ? GG.INK : (b.textColor || '#fff');
      var lx = b.x + b.w / 2;
      if (b.img) { GG.spr(ctx, b.img, b.x + b.h * 0.62, b.y + b.h / 2 + sink, b.h * 0.66, b.h * 0.66); lx += b.h * 0.3; }
      if (b.icon) GG.icon(ctx, b.icon, b.x + b.w / 2, b.y + b.h / 2 + sink, Math.min(b.w, b.h) * 0.5, fg);
      if (b.label) GG.text(ctx, b.label, lx, b.y + b.h / 2 + sink, b.fs || Math.min(b.w, b.h) * 0.36, fg);
    }
  }
  /* 關卡橫幅：「第 N 關」＋這一關新出現的東西（新障礙／新獎勵），顯示約 2.4 秒 */
  var banner = null;
  GG.banner = function (title, sub, color) { banner = { t: 0, title: title, sub: sub || '', color: color || '#ffe14d' }; GG.sfx('power'); };
  function drawBanner() {
    if (!banner) return;
    var k = banner.t, a = k < 0.25 ? k / 0.25 : k > 2.1 ? Math.max(0, (2.4 - k) / 0.3) : 1;
    var y = H * 0.3, bh = banner.sub ? 104 : 74, sc = k < 0.25 ? GG.back(k / 0.25) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,16,50,0.62)';
    ctx.fillRect(0, y - bh / 2, W, bh);
    ctx.fillStyle = banner.color; ctx.fillRect(0, y - bh / 2, W, 5); ctx.fillRect(0, y + bh / 2 - 5, W, 5);
    GG.text(ctx, banner.title, W / 2, y - (banner.sub ? 16 : 0), 42, banner.color, 'center', true, sc);
    if (banner.sub) GG.text(ctx, banner.sub, W / 2, y + 28, 24, '#ffffff', 'center', true);
    ctx.globalAlpha = 1;
  }
  /* 開局操作示範：依操作類型畫手套動畫，第一次碰畫面就消失。
     遊戲可設 noHint（自己畫）或 hintAt() 回傳 {x, y, dx, dy, tip} 自訂位置與動作 */
  var hintT = 0, hintOff = false;
  function hintActive() { return state === 'play' && !hintOff && !game.noHint && meta.ctrl && hintT < 7; }
  function drawHint() {
    if (!hintActive()) return;
    var at = game.hintAt ? game.hintAt() : null;
    if (at === false) return;
    at = at || {};
    var s = GG.clamp(Math.min(W, H) * 0.13, 64, 110), k = (hintT % 1.6) / 1.6, e = GG.ease(Math.min(1, k * 1.5));
    var x0 = at.x === undefined ? W / 2 : at.x, y0 = at.y === undefined ? H * 0.62 : at.y, x = x0, y = y0, press = true, tip;
    var c = meta.ctrl;
    if (c === 'tap') { press = k % 0.8 < 0.3; tip = '點一下'; }
    else if (c === 'drag') { x += Math.sin(hintT * 3) * s * 1.2; tip = '按住左右拖曳'; }
    else if (c === 'swipe') {
      var dv = [[1, 0], [0, 1], [-1, 0], [0, -1]][Math.floor(hintT / 1.6) % 4];
      x += dv[0] * s * 1.3 * e; y += dv[1] * s * 1.3 * e; press = k < 0.7; tip = '手指滑一下';
    } else if (c === 'aim') {
      x += (at.dx === undefined ? -0.8 : at.dx) * s * e; y += (at.dy === undefined ? 0.9 : at.dy) * s * e; press = k < 0.75; tip = '按住往後拉，放開！';
    } else if (c === 'flick') {
      x += (at.dx || 0) * s * e; y += (at.dy === undefined ? -1.8 : at.dy) * s * e; press = k < 0.7; tip = '往目標滑過去';
    } else return;
    GG.hand(ctx, x, y, s, press);
    GG.text(ctx, at.tip || tip, x0, at.ty === undefined ? y0 - s * 0.9 : at.ty, 26, '#fff', 'center', true);
  }
  function draw() {
    ctx.setTransform(GG.dpr, 0, 0, GG.dpr, 0, 0);
    if (!started) {
      // 開始前：用封面圖當背景（放大後自然有模糊感）
      var cimg = GG.img._cover;
      if (cimg && cimg.width) {
        var k = Math.max(W / cimg.width, H / cimg.height) * 1.08;
        ctx.drawImage(cimg, (W - cimg.width * k) / 2, (H - cimg.height * k) / 2, cimg.width * k, cimg.height * k);
      } else GG.bg(ctx, W, H, meta.c1, meta.c2);
      return;
    }
    if (!game.opaque) ctx.clearRect(0, 0, W, H);
    if (game.draw) game.draw(ctx, W, H);
    drawParts();
    drawPad();
    if (game.drawTop) game.drawTop(ctx, W, H);
    drawHint();
    drawBanner();
    if (state === 'count') {
      var n = Math.ceil(countT), f = countT - Math.floor(countT);
      var s = n > 0 ? String(n) : '開始！';
      GG.text(ctx, s, W / 2, H * 0.42, Math.min(W, H) * 0.2, '#ffe14d', 'center', true, 0.8 + f * 0.5);
    }
  }
  function loop(id) {
    return function tick(t) {
      if (id !== loopId) return;
      requestAnimationFrame(tick);
      var raw = (t - last) / 1000;
      last = t;
      var dt = raw > 0.05 ? 0.05 : raw < 0 ? 0 : raw;
      var changed = false;
      if (state === 'play') {
        changed = game.update(dt) !== false || !game.lazy;
        if (hintActive()) { hintT += dt; changed = true; }
        if (banner) { banner.t += dt; changed = true; if (banner.t > 2.4) banner = null; }
        // 量測順暢度：持續低於約 45fps 就降畫質
        if (perf.skip > 0) perf.skip--;
        else if (raw < 0.2) {
          perf.n++; perf.t += raw;
          if (perf.n >= 90) { if (perf.t / perf.n > 0.022) lowerQuality(); perf.n = 0; perf.t = 0; }
        }
      } else if (state === 'count') {
        var before = Math.ceil(countT);
        countT -= dt;
        if (Math.ceil(countT) !== before) GG.sfx(countT > 0 ? 'tick' : 'go');
        if (countT <= -0.45) { state = 'play'; last = performance.now(); }
        changed = true;
      }
      if (state === 'play' || state === 'count' || state === 'over') { updateParts(dt); updateShake(dt); if (parts.length) changed = true; }
      if (changed || needDraw) { needDraw = false; draw(); }
    };
  }
  /* 測試用：同步推進 n 個畫格 */
  GG.step = function (n, dt) {
    for (var i = 0; i < n; i++) {
      if (state === 'count') { countT = -1; state = 'play'; }
      if (state !== 'play') break;
      game.update(dt || 1 / 60); updateParts(dt || 1 / 60);
    }
    draw();
  };

  /* 虛擬按鈕 */
  GG.setPad = function (list) { pad = list || []; needDraw = true; };
  GG.held = function (id) {
    for (var i = 0; i < pad.length; i++) if (pad[i].id === id) return pad[i].down;
    return false;
  };
  GG.button = function (id) {
    for (var i = 0; i < pad.length; i++) if (pad[i].id === id) return pad[i];
    return null;
  };
  function releaseAll() {
    for (var i = 0; i < pad.length; i++) {
      pad[i].down = false;
      if (pad[i].stick) stickSet(pad[i], null);
      if (pad[i].onUp) pad[i].onUp({});
    }
    owners = {};
  }
  /* 搖桿數值：ax/ay 單位方向、mag 推的力道（0~1）、dir 四方向（推太輕為 null）；
     only:'x' 只取左右。數值有變就呼叫 b.onStick(b, dir有沒有改變) */
  function stickSet(b, p) {
    var dx = 0, dy = 0;
    if (p) { dx = p.x - b.cx; dy = b.only === 'x' ? 0 : p.y - b.cy; }
    var d = Math.sqrt(dx * dx + dy * dy), R = b.R;
    if (d > R) { dx = dx / d * R; dy = dy / d * R; d = R; }
    b.kx = dx; b.ky = dy; b.mag = d / R;
    b.ax = d ? dx / d : 0; b.ay = d ? dy / d : 0;
    var nd = b.mag < (b.dead || 0.3) ? null : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    var changed = nd !== b.dir;
    b.dir = nd;
    if (b.onStick) b.onStick(b, changed);
  }
  /* 建立一支固定搖桿：zone 是可以開始觸控的範圍（比外觀大，小手不用按很準） */
  GG.stick = function (o) {
    var R = o.R, z = o.zone || { x: o.cx - R * 1.8, y: o.cy - R * 1.8, w: R * 3.6, h: R * 3.6 };
    return { id: o.id || 'stick', stick: true, cx: o.cx, cy: o.cy, R: R, x: z.x, y: z.y, w: z.w, h: z.h,
      only: o.only, dead: o.dead, color: o.color, onStick: o.onStick, kx: 0, ky: 0, mag: 0, ax: 0, ay: 0, dir: null };
  };
  /* 卡通手套（教學提示）：指尖在 (x,y)，press=true 時往下按 */
  GG.hand = function (c, x, y, s, press) {
    c.save();
    c.translate(x, y + (press ? s * 0.06 : 0));
    if (press) {
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = s * 0.05;
      c.beginPath(); c.arc(0, -s * 0.02, s * 0.22, 0, Math.PI * 2); c.stroke();
    }
    c.rotate(-0.35);
    c.lineWidth = s * 0.055; c.strokeStyle = GG.INK; c.fillStyle = '#ffffff'; c.lineJoin = 'round';
    GG.rr(c, -s * 0.11, 0, s * 0.22, s * 0.55, s * 0.11); c.fill(); c.stroke();          // 食指
    GG.rr(c, -s * 0.26, s * 0.32, s * 0.6, s * 0.5, s * 0.2); c.fill(); c.stroke();       // 手掌
    GG.rr(c, -s * 0.11, s * 0.08, s * 0.22, s * 0.4, s * 0.11); c.fill();                 // 蓋住食指和手掌的接縫
    c.beginPath(); c.ellipse ? c.ellipse(-s * 0.3, s * 0.5, s * 0.1, s * 0.17, -0.6, 0, Math.PI * 2) : c.arc(-s * 0.3, s * 0.5, s * 0.12, 0, Math.PI * 2);
    c.fill(); c.stroke();                                                                  // 大拇指
    c.fillStyle = '#ff6fa5'; GG.rr(c, -s * 0.24, s * 0.8, s * 0.56, s * 0.17, s * 0.07); c.fill(); c.stroke(); // 袖口
    c.restore();
  };
  function pt(id, cx, cy) {
    var r = cv.getBoundingClientRect();
    return { id: id, x: cx - r.left, y: cy - r.top };
  }
  function onDown(p) {
    if (state !== 'play') return;
    needDraw = true;
    for (var i = pad.length - 1; i >= 0; i--) {
      var b = pad[i];
      if (b.hidden) continue;
      var m = b.hit || 0;
      if (p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m) {
        if (b.down && b.stick) continue; // 這支搖桿已經有別的手指在用
        b.down = true; owners[p.id] = b; hintOff = true;
        if (b.stick) stickSet(b, p);
        if (b.onDown) b.onDown(p);
        return;
      }
    }
    owners[p.id] = 'game';
    hintOff = true;
    if (game.down) game.down(p);
  }
  function onMove(p) {
    var o = owners[p.id];
    if (!o || state !== 'play') return;
    if (o === 'game') { if (game.move) game.move(p); }
    else {
      if (o.stick) { stickSet(o, p); needDraw = true; }
      if (o.onMove) o.onMove(p);
    }
  }
  function onUp(p) {
    var o = owners[p.id];
    delete owners[p.id];
    if (!o || state !== 'play') return;
    needDraw = true;
    if (o === 'game') { if (game.up) game.up(p); }
    else { o.down = false; if (o.stick) stickSet(o, null); if (o.onUp) o.onUp(p); }
  }
  function bindInput() {
    function each(e, fn) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        fn(pt(t.identifier, t.clientX, t.clientY));
      }
    }
    cv.addEventListener('touchstart', function (e) { each(e, onDown); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { each(e, onMove); }, { passive: false });
    cv.addEventListener('touchend', function (e) { each(e, onUp); }, { passive: false });
    cv.addEventListener('touchcancel', function (e) { each(e, onUp); }, { passive: false });
    var mdown = false;
    cv.addEventListener('mousedown', function (e) { mdown = true; onDown(pt('m', e.clientX, e.clientY)); });
    window.addEventListener('mousemove', function (e) { if (mdown) onMove(pt('m', e.clientX, e.clientY)); });
    window.addEventListener('mouseup', function (e) { if (mdown) { mdown = false; onUp(pt('m', e.clientX, e.clientY)); } });
    GG.keys = {};
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { togglePause(); return; }
      if (/^Arrow| /.test(e.key)) e.preventDefault();
      if (state !== 'play') return;
      needDraw = true;
      hintOff = true;
      if (!GG.keys[e.key] && game.key) game.key(e.key);
      GG.keys[e.key] = true;
    });
    window.addEventListener('keyup', function (e) { GG.keys[e.key] = false; });
  }
  GG.swipeDir = function (x0, y0, x1, y1, min) {
    var dx = x1 - x0, dy = y1 - y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < (min || 24)) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  };

  /* ---------- 頂部資訊列 ---------- */
  var hudText = '';
  GG.hud = function (s) { if (s !== hudText) { hudText = s; elHud.textContent = s; } };
  GG.setScore = function (n) { GG.hud('分數 ' + n); };
  function bestKey(d) { return 'best_' + meta.id + '_' + d; }
  function fmtBest(v) { return v + (meta.unit || ''); }
  function showBest() {
    if (meta.cat === 'duo') { elBest.style.display = 'none'; return; }
    var b = GG.load(bestKey(diff), null);
    elBest.style.display = b === null ? 'none' : '';
    elBest.textContent = '最佳 ' + (b === null ? '' : fmtBest(b));
  }

  /* ---------- 選單 ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  /* 操作方式小圖：用同一隻卡通手套畫，搭配搖桿或箭頭 */
  function ctrlPic(type) {
    var c = document.createElement('canvas'), s = 2, w = 132, h = 96;
    c.width = w * s; c.height = h * s; c.className = 'ctrl-pic';
    var g = c.getContext('2d');
    g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.08)'; GG.rr(g, 0, 0, w, h, 18); g.fill();
    function arrow(x1, y1, x2, y2) {
      g.strokeStyle = '#ff8a3d'; g.fillStyle = '#ff8a3d'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      var a = Math.atan2(y2 - y1, x2 - x1);
      g.beginPath(); g.moveTo(x2 + Math.cos(a) * 6, y2 + Math.sin(a) * 6);
      g.lineTo(x2 + Math.cos(a + 2.3) * 11, y2 + Math.sin(a + 2.3) * 11); g.lineTo(x2 + Math.cos(a - 2.3) * 11, y2 + Math.sin(a - 2.3) * 11);
      g.closePath(); g.fill();
    }
    if (type === 'stick') {
      g.fillStyle = 'rgba(80,80,120,0.25)'; g.beginPath(); g.arc(52, 48, 32, 0, 7); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#8a86a8'; g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(62, 40, 15, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = GG.INK; g.stroke();
      arrow(92, 48, 118, 48); arrow(52, 12, 52, 4);
      GG.hand(g, 64, 42, 50, true);
    } else if (type === 'drag') {
      arrow(46, 30, 16, 30); arrow(86, 30, 116, 30);
      GG.hand(g, 66, 30, 54, true);
    } else if (type === 'tap') {
      GG.hand(g, 66, 26, 60, true);
    } else if (type === 'swipe') {
      arrow(66, 24, 66, 6); arrow(84, 40, 112, 40); arrow(48, 40, 20, 40); arrow(66, 56, 66, 74);
      GG.hand(g, 66, 40, 46, false);
    } else if (type === 'aim') {
      g.setLineDash([6, 7]); g.strokeStyle = '#ff8a3d'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(40, 70); g.quadraticCurveTo(70, -10, 118, 34); g.stroke(); g.setLineDash([]);
      GG.hand(g, 34, 66, 40, true);
    } else if (type === 'lr') {
      [[34, 'left'], [98, 'right']].forEach(function (k) {
        g.fillStyle = '#ff5c5c'; GG.rr(g, k[0] - 22, 34, 44, 40, 10); g.fill();
        GG.icon(g, k[1], k[0], 54, 20, '#fff');
      });
      GG.hand(g, 98, 56, 44, true);
    } else if (type === 'dpad') {
      [[0, -1, 'rotate'], [-1, 0, 'left'], [1, 0, 'right'], [0, 1, 'down']].forEach(function (k) {
        g.fillStyle = '#3d6fe0'; GG.rr(g, 40 + k[0] * 24 - 11, 48 + k[1] * 24 - 11, 22, 22, 6); g.fill();
        GG.icon(g, k[2], 40 + k[0] * 24, 48 + k[1] * 24, 12, '#fff');
      });
      g.fillStyle = '#ff7b3d'; g.beginPath(); g.arc(104, 52, 18, 0, 7); g.fill();
      GG.icon(g, 'drop', 104, 52, 16, '#fff');
      GG.hand(g, 64, 50, 40, true);
    } else if (type === 'flick') {
      arrow(66, 60, 66, 8);
      GG.hand(g, 66, 62, 40, true);
    } else if (type === 'gesture') {
      arrow(50, 22, 22, 22); arrow(82, 22, 110, 22); arrow(66, 50, 66, 84);
      GG.hand(g, 66, 26, 46, true);
    }
    return c;
  }
  GG.menu = function (o) {
    overlay.innerHTML = '';
    var card = el('div', 'card' + (o.cls ? ' ' + o.cls : '')), root = card;
    if (o.cover) {
      card.className += ' card-start';
      var left = el('div', 'card-left'), cv2 = el('img', 'card-cover');
      cv2.src = o.cover; cv2.alt = '';
      left.appendChild(cv2);
      if (o.ctrl) {
        var how = el('div', 'card-how');
        how.appendChild(ctrlPic(o.ctrl));
        how.appendChild(el('p', '', o.how || ''));
        left.appendChild(how);
      }
      card.appendChild(left);
      var right = el('div', 'card-right');
      card.appendChild(right);
      if (o.title) right.appendChild(el('h2', '', o.title));
      card = right;
    }
    if (o.icon) { var im = el('img', 'card-icon'); im.src = o.icon; im.alt = ''; card.appendChild(im); }
    if (o.title && !o.cover) card.appendChild(el('h2', '', o.title));
    if (o.stars !== undefined) {
      var row = el('div', 'stars');
      for (var s = 0; s < 3; s++) {
        var st = el('img', 'star' + (s < o.stars ? ' on' : ''));
        st.src = 'assets/ui/star.png'; st.alt = '';
        st.style.animationDelay = (0.25 + s * 0.22) + 's';
        row.appendChild(st);
      }
      card.appendChild(row);
    }
    if (o.lines) for (var i = 0; i < o.lines.length; i++) {
      var ln = o.lines[i];
      if (ln) card.appendChild(el('p', ln.cls || '', ln.text || ln));
    }
    var box = el('div', 'card-btns');
    (o.buttons || []).forEach(function (b) {
      var btn = el('button', 'btn ' + (b.cls || ''));
      btn.appendChild(el('span', 'btn-main', b.label));
      if (b.sub) btn.appendChild(el('span', 'btn-sub', b.sub));
      btn.addEventListener('click', function () { GG.sfx('click'); b.fn(); });
      box.appendChild(btn);
    });
    card.appendChild(box);
    overlay.appendChild(root);
    if (o.confetti) {
      var cols = ['#ff5c8a', '#ffd23f', '#43d17a', '#4fa3ff', '#b07cff', '#ff9a2f'];
      for (var c = 0; c < 28; c++) {
        var cf = el('i', 'confetti');
        cf.style.left = (Math.random() * 100) + '%';
        cf.style.background = GG.pick(cols);
        cf.style.animationDelay = (Math.random() * 0.8) + 's';
        cf.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
        overlay.appendChild(cf);
      }
    }
    overlay.className = 'show';
  };
  function hideMenu() { overlay.className = ''; overlay.innerHTML = ''; }
  function modes() {
    if (game.modes) return game.modes;
    return [
      { label: '簡單', value: 0, cls: 'b-easy' },
      { label: '普通', value: 1, cls: 'b-mid' },
      { label: '困難', value: 2, cls: 'b-hard' }
    ];
  }
  function iconPath() { return 'assets/icons/' + meta.id + '.png'; }
  function coverPath() { return 'assets/covers/' + meta.id + '.jpg'; }
  var AGES = ['4–6 歲', '7–9 歲', '10–12 歲'];
  function showStart() {
    state = 'menu'; releaseAll(); needDraw = true; started = false;
    GG.menu({
      cover: coverPath(), ctrl: meta.ctrl, how: meta.how, title: meta.name,
      buttons: modes().map(function (m) {
        var b = meta.cat === 'duo' ? null : GG.load(bestKey(m.value), null);
        var sub = [];
        if (!game.modes) sub.push(AGES[m.value]);
        if (b !== null) sub.push('最佳 ' + fmtBest(b));
        return { label: m.label, cls: m.cls, sub: sub.join('・'), fn: function () { begin(m.value); } };
      }).concat([{ label: '回首頁', cls: 'b-home', fn: goHome }])
    });
  }
  function begin(v) {
    diff = v;
    hideMenu(); releaseAll();
    parts = [];
    game.start(v);
    started = true; hintT = 0; hintOff = false; banner = null;
    if (game.countdown) { state = 'count'; countT = 3; }
    else state = 'play';
    last = performance.now();
    showBest();
    needDraw = true; perf.skip = 40;
  }
  function goHome() { location.href = 'index.html'; }
  function togglePause() {
    if (state === 'play' || state === 'count') {
      state = 'paused'; releaseAll();
      GG.menu({
        icon: 'assets/bunny/hero_stand.png', title: '休息一下',
        buttons: [
          { label: '繼續玩', cls: 'b-easy', fn: function () { hideMenu(); state = 'play'; last = performance.now(); needDraw = true; } },
          { label: '重新開始', cls: 'b-mid', fn: function () { begin(diff); } },
          { label: meta.cat === 'duo' ? '換模式' : '換難度', cls: 'b-blue', fn: showStart },
          { label: '回首頁', cls: 'b-home', fn: goHome }
        ]
      });
    } else if (state === 'paused') {
      hideMenu(); state = 'play'; last = performance.now(); needDraw = true;
    }
  }

  /* 遊戲結束：o = {score, win, title, text, scoreText, icon, delay, stars} */
  GG.over = function (o) {
    if (state !== 'play') return;
    state = 'over'; releaseAll(); needDraw = true;
    var isRecord = false, best = null;
    if (meta.cat !== 'duo' && typeof o.score === 'number') {
      best = GG.load(bestKey(diff), null);
      var ok = meta.lower ? o.win : true;
      if (ok && (best === null || (meta.lower ? o.score < best : o.score > best))) {
        isRecord = best !== null || o.score > 0 || meta.lower;
        best = o.score; GG.save(bestKey(diff), best);
      }
    }
    var happy = o.win || isRecord || (o.stars || 0) >= 2;
    GG.sfx(happy ? 'win' : 'lose');
    setTimeout(function () {
      var lines = [];
      if (o.text) lines.push(o.text);
      if (typeof o.score === 'number') lines.push({ text: o.scoreText || ('得分 ' + fmtBest(o.score)), cls: 'big' });
      if (isRecord) lines.push({ text: '新紀錄！', cls: 'record' });
      else if (best !== null) lines.push({ text: '最佳紀錄 ' + fmtBest(best), cls: 'muted' });
      GG.menu({
        icon: o.icon || (happy ? 'assets/bunny/hero_jump.png' : 'assets/bunny/hero_hurt.png'),
        cls: happy ? 'card-happy' : '',
        title: o.title || (o.win ? '過關了！' : '再試一次！'),
        stars: o.stars, confetti: happy,
        lines: lines,
        buttons: [
          { label: '再玩一次', cls: 'b-easy', fn: function () { begin(diff); } },
          { label: meta.cat === 'duo' ? '換模式' : '換難度', cls: 'b-mid', fn: showStart },
          { label: '回首頁', cls: 'b-home', fn: goHome }
        ]
      });
      showBest();
    }, o.delay === undefined ? 700 : o.delay);
  };

  /* 依分數給星星：s1/s2/s3 為門檻 */
  GG.starsFor = function (v, s1, s2, s3) { return v >= s3 ? 3 : v >= s2 ? 2 : v >= s1 ? 1 : 0; };

  GG.define = function (def) {
    game = def;
    loopId++; last = performance.now();
    requestAnimationFrame(loop(loopId));
    var map = {}, k;
    for (k in COMMON) map[k] = COMMON[k];
    map._cover = 'covers/' + meta.id + '.jpg';
    if (def.assets) for (k in def.assets) map[k] = def.assets[k];
    GG.menu({ icon: iconPath(), title: meta.name, lines: [{ text: '載入中…', cls: 'muted' }] });
    loadImages(map, function () {
      state = 'menu';
      if (game.init) game.init();
      resize();
      showStart();
    });
  };

  /* ---------- 頂部列的向量圖示 ---------- */
  var SVG = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5V20h4.5v-5h3v5H18v-9.5" fill="#fff"/></svg>',
    snd: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.6" fill="#fff"/><rect x="14" y="5" width="4" height="14" rx="1.6" fill="#fff"/></svg>'
  };

  function boot() {
    var m = /[?&]g=([a-z0-9]+)/.exec(location.search);
    meta = m ? GG.findGame(m[1]) : null;
    if (!meta) { goHome(); return; }
    GG.meta = meta;
    document.title = meta.name + '｜小小遊戲樂園';
    document.documentElement.style.setProperty('--c1', meta.c1);
    document.documentElement.style.setProperty('--c2', meta.c2);
    cv = document.getElementById('cv');
    ctx = cv.getContext('2d');
    stage = document.getElementById('stage');
    overlay = document.getElementById('overlay');
    elHud = document.getElementById('hud');
    elBest = document.getElementById('best');
    elTitle = document.getElementById('title');
    elSnd = document.getElementById('snd');
    elPause = document.getElementById('pause');
    document.getElementById('home').innerHTML = SVG.home;
    elPause.innerHTML = SVG.pause;
    elSnd.innerHTML = muted ? SVG.mute : SVG.snd;
    elTitle.innerHTML = '';
    var ti = document.createElement('img'); ti.src = iconPath(); ti.alt = '';
    elTitle.appendChild(ti);
    elTitle.appendChild(document.createTextNode(meta.name));
    elSnd.addEventListener('click', function () {
      muted = !muted; GG.save('muted', muted);
      elSnd.innerHTML = muted ? SVG.mute : SVG.snd;
      unlockAudio(); GG.sfx('click');
    });
    elPause.addEventListener('click', togglePause);
    bindInput();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 120); setTimeout(resize, 500); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && (state === 'play' || state === 'count')) togglePause(); });
    var s = document.createElement('script');
    s.src = 'js/games/' + meta.id + '.js';
    document.body.appendChild(s);
  }
  if (document.getElementById('cv')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
