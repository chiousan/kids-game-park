/* 拆部件角色：每個部件一張圖，繞自己的樞紐點轉動；動作每一格即時計算，做出「身體律動感」。
 * 資料在 js/rigs.js（tools 產生）。動作的數值依畫面審核員訂的標準：
 * 走路一個循環 0.5–0.6 秒、兩腳 ±25–30° 交叉；跑步 0.36–0.42 秒 ±40–45°；
 * 起跳前下蹲 scaleY 0.82；起跳伸展 1.12；落地壓扁 0.80 再彈到 1.05；被打到後仰 15–25° 再衰減擺盪。
 * 只用 ES5 寫法，舊 iPad 也能跑。 */
(function () {
  var GG = window.GG;
  var D2R = Math.PI / 180;

  // 把 b 的欄位複製到 a（合併 assets 用）
  GG.extend = function (a, b) { for (var k in b) a[k] = b[k]; return a; };
  // 遊戲用：把需要的角色部件圖加進 assets
  GG.rigAssets = function (names) {
    var m = {};
    names.forEach(function (n) {
      var R = GG.RIGS[n];
      R.parts.forEach(function (p) { for (var v in p.img) m['R_' + n + '_' + p.img[v].k] = 'rig/' + n + '/' + p.img[v].k; });
    });
    return m;
  };

  // 被打到時閃白：每張部件圖先做一張白色剪影存起來
  var whiteCache = {};
  function whiteOf(key) {
    if (whiteCache[key]) return whiteCache[key];
    var im = GG.img[key]; if (!im || !im.width) return null;
    var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    var g = c.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    return (whiteCache[key] = c);
  }
  function mul(m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  function local(x, y, r, sx, sy) {
    var c = Math.cos(r), s = Math.sin(r);
    return [c * sx, s * sx, -s * sy, c * sy, x, y];
  }

  /* 一個角色：pose[部件] = {r 角度(度), x, y 位移, sx, sy 縮放, v 表情}；root 是整隻（以腳底為原點） */
  GG.Rig = function (name) {
    this.name = name; this.def = GG.RIGS[name];
    this.byName = {}; var self = this;
    this.def.parts.forEach(function (p) { self.byName[p.n] = p; });
    this.reset();
  };
  GG.Rig.prototype.reset = function () {
    this.pose = {};
    for (var n in this.byName) this.pose[n] = { r: 0, x: 0, y: 0, sx: 1, sy: 1, v: null };
    this.root = { r: 0, x: 0, y: 0, sx: 1, sy: 1 };
  };
  GG.Rig.prototype.has = function (n) { return !!this.byName[n]; };
  // o: {flip, flash, alpha, face, spin, spinY, after(ctx, 部件名, 矩陣)}；s = 實際高度 / 原始高度
  GG.Rig.prototype.draw = function (ctx, x, y, s, o) {
    o = o || {};
    var dpr = GG.dpr, R = this.root, f = o.flip ? -1 : 1;
    var base = [s * f, 0, 0, s, x, y];
    // spin：整隻繞身體中心翻轉（二段跳翻一圈）；spinY＝中心離腳底的原始像素高度
    if (o.spin) base = mul(mul(mul(base, [1, 0, 0, 1, 0, -o.spinY]), local(0, 0, o.spin, 1, 1)), [1, 0, 0, 1, 0, o.spinY]);
    base = mul(mul(base, local(R.x, R.y, R.r * D2R, 1, 1)), local(0, 0, 0, R.sx, R.sy));
    var world = {}, self = this;
    function W(n) {
      if (world[n]) return world[n];
      var p = self.byName[n], q = self.pose[n];
      var m = mul(p.parent ? W(p.parent) : base, local(p.x + q.x, p.y + q.y, q.r * D2R, q.sx, q.sy));
      return (world[n] = m);
    }
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    var parts = this.def.parts;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], q = this.pose[p.n], v = q.v && p.img[q.v] ? q.v : (o.face && p.img[o.face] ? o.face : 'base');
      if (o.hide && o.hide[p.n]) continue;
      var info = p.img[v]; if (!info) continue;
      var key = 'R_' + this.name + '_' + info.k, im = o.flash ? whiteOf(key) : GG.img[key];
      if (!im || !im.width) continue;
      var m = W(p.n);
      ctx.setTransform(dpr * m[0], dpr * m[1], dpr * m[2], dpr * m[3], dpr * m[4], dpr * m[5]);
      ctx.drawImage(im, -info.px, -info.py);
      if (o.after) o.after(ctx, p.n, m);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (o.alpha !== undefined) ctx.globalAlpha = 1;
    this.world = world;
  };
  // 某個部件的樞紐點在畫面上的位置（掛東西、畫星星用）
  GG.Rig.prototype.pointOf = function (n, dx, dy) {
    var m = this.world && this.world[n]; if (!m) return null;
    dx = dx || 0; dy = dy || 0;
    return { x: m[0] * dx + m[2] * dy + m[4], y: m[1] * dx + m[3] * dy + m[5] };
  };

  /* ---------- 動作：GG.Anim(角色名, 種類) ----------
   * mode：idle、walk、run、crouch、jump、fall、land、hurt、dizzy、cheer（依種類各自解讀）
   * 遊戲每一格呼叫 update(dt, speed)，speed 用來依移動距離推進步伐（腳才不會滑動） */
  GG.Anim = function (name, kind) {
    this.rig = new GG.Rig(name); this.kind = kind || name;
    this.mode = 'idle'; this.mt = 0; this.t = Math.random() * 10; this.ph = Math.random();
    this.blink = 1 + Math.random() * 3; this.hurtT = 9; this.landT = 9; this.flashT = 0; this.hurtDir = 1;
    this.face = null; this.faceT = 0;
  };
  var A = GG.Anim.prototype;
  A.set = function (mode) { if (mode !== this.mode) { this.mode = mode; this.mt = 0; } };
  A.hit = function (dir) { this.hurtT = 0; this.flashT = 0.32; this.hurtDir = dir || 1; this.faceFor('x', 0.4); };
  A.land = function (k) { this.landT = 0; this.landK = k || 1; }; // k：壓扁程度（彈簧 1.5＝壓到 0.70）
  A.faceFor = function (f, t) { this.face = f; this.faceT = t; };
  function wob(t, a) { return a * Math.exp(-6 * t) * Math.cos(18 * t); }
  A.update = function (dt, speed) {
    var R = this.rig, P, k = this.kind;
    this.t += dt; this.mt += dt; this.hurtT += dt; this.landT += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.faceT > 0) { this.faceT -= dt; if (this.faceT <= 0) this.face = null; }
    this.blink -= dt; if (this.blink < -0.12) this.blink = 2.5 + Math.random() * 1.5;
    R.reset(); P = R.pose; // reset 會換新的 pose 物件，要在 reset 之後才取
    var f = MOTION[k] || MOTION.generic;
    f.call(this, R, P, dt, speed || 0);
    // 共用：被打到後仰（往受擊反方向），衰減擺盪 0.45 秒；落地壓扁再彈回
    if (this.hurtT < 0.5) R.root.r += wob(this.hurtT, -20 * this.hurtDir);
    if (this.landT < 0.32) {
      // 0.1 秒壓到 0.80 → 0.1 秒彈到 1.05 → 0.12 秒回到 1.0（彈簧感）
      var q = this.landT, d = 0.2 * (this.landK || 1), sq = q < 0.1 ? 1 - d * (q / 0.1) : q < 0.2 ? 1 - d + (d + 0.05) * ((q - 0.1) / 0.1) : 1.05 - 0.05 * Math.min(1, (q - 0.2) / 0.12);
      R.root.sy *= sq; R.root.sx *= 1 + (1 - sq) * 0.9;
    }
    // 表情：被打到 X 眼；眨眼
    var face = this.face || (this.blink < 0 ? 'blink' : null);
    for (var n in P) if (face && R.byName[n].img[face]) P[n].v = face;
  };
  A.draw = function (ctx, x, y, s, flip, extra) {
    var fl = this.flashT > 0 && Math.floor(this.flashT / 0.08) % 2 === 1; // 閃白兩次
    extra = extra || {};
    this.rig.draw(ctx, x, y, s, { flip: flip, flash: fl, alpha: extra.alpha, after: extra.after, spin: extra.spin, spinY: extra.spinY || this.rig.def.h * 0.45, hide: extra.hide });
  };

  var MOTION = {
    generic: function (R, P) { R.root.sy = 1 + Math.sin(this.t * 3.5) * 0.015; },
    /* 主角兔（側身）：走路兩腳交叉、跑步、先蹲再跳、空中、落地、受傷、暈眩、慶祝 */
    bunny: function (R, P, dt, spd) {
      var m = this.mode, t = this.t, k;
      var breathe = Math.sin(t * Math.PI * 2 / 1.8);
      if (m === 'walk' || m === 'run') {
        var run = m === 'run', cyc = run ? 0.4 : 0.56;
        // 依移動距離推進（步長約身高 0.6 倍）；沒給速度就依時間
        this.ph += spd ? spd * dt / (run ? 150 : 110) : dt / cyc;
        var a = this.ph * Math.PI * 2, A = run ? 42 : 28;
        P.legF.r = Math.sin(a) * A; P.legB.r = -Math.sin(a) * A;
        P.footF.r = -P.legF.r * 0.5 + Math.max(0, -Math.cos(a)) * (run ? 20 : 12);
        P.footB.r = -P.legB.r * 0.5 + Math.max(0, Math.cos(a)) * (run ? 20 : 12);
        P.legF.y = -Math.max(0, Math.cos(a)) * 6; P.legB.y = -Math.max(0, -Math.cos(a)) * 6;
        P.pawF.r = -Math.sin(a) * (run ? 35 : 20); P.pawB.r = Math.sin(a) * (run ? 35 : 20);
        R.root.y = -Math.abs(Math.cos(a)) * (run ? 6 : 3.5); // 兩腳交叉那一格最高
        R.root.r = run ? 10 : 4;
        P.earF.r = Math.sin(a - 0.6) * 7 - (run ? 18 : 0); P.earB.r = Math.sin(a - 1.0) * 7 - (run ? 18 : 0);
        P.head.r = Math.sin(a * 2) * 2;
      } else if (m === 'crouch') {
        k = Math.min(1, this.mt / 0.08);
        R.root.sy = 1 - 0.18 * k; R.root.sx = 1 + 0.12 * k;
        P.legF.r = -20 * k; P.legB.r = -20 * k; P.footF.r = 20 * k; P.footB.r = 20 * k;
        P.earF.r = 10 * k; P.earB.r = 10 * k;
      } else if (m === 'jump') {
        k = Math.max(0, 1 - this.mt / 0.25);
        R.root.sy = 1 + 0.12 * k; R.root.sx = 1 - 0.09 * k;
        P.legF.r = -20; P.legB.r = -24; P.footF.r = 25; P.footB.r = 25;
        P.pawF.r = -38; P.pawB.r = -30; P.earF.r = -20; P.earB.r = -24;
      } else if (m === 'fall') {
        P.legF.r = 15; P.legB.r = 10; P.footF.r = -10;
        P.pawF.r = -45; P.pawB.r = -40;
        var j = Math.sin(t * 9 * Math.PI * 2) * 8;
        P.earF.r = -6 + j; P.earB.r = -8 - j;
        this.faceFor('wide', 0.05);
      } else if (m === 'dizzy') {
        P.head.r = Math.sin(t * 3 * Math.PI * 2) * 10;
        P.earF.r = Math.sin(t * 6) * 12; P.earB.r = -Math.sin(t * 6) * 12;
        this.faceFor('x', 0.05);
      } else if (m === 'cheer') {
        var hop = (this.mt % 0.5) / 0.5;
        R.root.y = -Math.sin(hop * Math.PI) * 18;
        P.pawF.r = -150 + Math.sin(t * 12) * 30; P.pawB.r = -140 - Math.sin(t * 12) * 30;
        P.earF.r = Math.sin(t * 10) * 12; P.earB.r = -Math.sin(t * 10) * 12;
        this.faceFor('happy', 0.05);
      } else {
        // 待機呼吸：scaleY 1.00–1.03（1.8 秒一次），頭慢一點跟上，耳朵錯開擺動
        R.root.sy = 1 + (breathe + 1) * 0.015;
        P.head.y = Math.sin(t * Math.PI * 2 / 1.8 - 0.35) * 1.5;
        P.earF.r = Math.sin(t * 1.7) * 4; P.earB.r = Math.sin(t * 1.7 + 1.2) * 4;
      }
    },
    /* 地鼠：待機頭左右張望（每 0.6 秒換方向）、鼻子抽動；被敲到壓扁＋暈暈 */
    mole: function (R, P) {
      var m = this.mode, t = this.t;
      if (m === 'hurt' || m === 'dizzy') {
        var q = this.mt;
        R.root.sy = q < 0.1 ? 1 - 0.3 * (q / 0.1) : 0.7 + 0.3 * Math.min(1, (q - 0.1) / 0.25);
        R.root.sx = 2 - R.root.sy;
        R.root.r = Math.sin(t * 3 * Math.PI * 2) * 6;
        this.faceFor('spiral', 0.05);
      } else if (m === 'pop') {
        var p = Math.min(1, this.mt / 0.16);
        R.root.sy = p < 1 ? 0.9 + 0.18 * p : 1 + Math.max(0, 0.08 - (this.mt - 0.16) * 0.4);
        R.root.sx = 2 - R.root.sy;
      } else {
        var dir = Math.floor(t / 0.6) % 2 ? 1 : -1;
        R.root.r = dir * 8 * Math.min(1, (t % 0.6) / 0.15);
        P.face.x = dir * 6;
        var tw = (t % 1.3) < 0.18;
        if (R.has('nose')) { P.nose.sx = tw ? 1.12 : 1; P.nose.sy = tw ? 0.9 : 1; }
        P.pawL.r = Math.sin(t * 5) * 6; P.pawR.r = -Math.sin(t * 5 + 1) * 6;
        R.root.sy *= 1 + Math.sin(t * Math.PI * 2 / 1.8) * 0.015;
      }
    },
    /* 企鵝守門員：待機左右晃 ±6°（1Hz）、預備下蹲、撲球（往撲的方向伸展、旋轉到 ±75°）、抱球微笑、暈眩 */
    penguin: function (R, P) {
      var m = this.mode, t = this.t;
      if (m === 'ready') {
        R.root.sy = 0.88; R.root.sx = 1.08;
        P.wingL.r = -20; P.wingR.r = 20;
      } else if (m === 'diveL' || m === 'diveR') {
        var s = m === 'diveL' ? -1 : 1, k = Math.min(1, this.mt / 0.18);
        R.root.sx = 1 + 0.1 * k; R.root.sy = 1 - 0.05 * k; // 轉身（±75°）由遊戲繞身體中心轉
        P['wing' + (s < 0 ? 'L' : 'R')].r = -40 * s * k; P['wing' + (s < 0 ? 'R' : 'L')].r = 30 * s * k;
      } else if (m === 'catch') {
        P.wingL.r = 35; P.wingR.r = -35; this.faceFor('happy', 0.05);
        R.root.y = -Math.abs(Math.sin(this.mt * 8)) * 6 * Math.max(0, 1 - this.mt);
      } else if (m === 'dizzy') {
        R.root.r = Math.sin(t * 3 * Math.PI * 2) * 8; this.faceFor('x', 0.05);
      } else if (m === 'hurt') {
        R.root.r = wob(this.mt, -18);
      } else {
        R.root.r = Math.sin(t * Math.PI * 2) * 6;
        P.wingL.r = Math.sin(t * 4) * 6; P.wingR.r = -Math.sin(t * 4 + 0.6) * 6;
        R.root.sy = 1 + Math.sin(t * Math.PI * 2 / 1.8) * 0.015;
      }
    },
    penguinS: function (R, P) { MOTION.penguin.call(this, R, P); },
    octopus: function (R, P) {
      var m = this.mode, t = this.t;
      R.root.y = Math.sin(t * 2.4) * 4;
      if (m === 'diveL' || m === 'diveR') { var s = m === 'diveL' ? -1 : 1; R.root.r = 30 * s * Math.min(1, this.mt / 0.15); R.root.x = 20 * s; }
      else if (m === 'catch') this.faceFor('happy', 0.05);
      else if (m === 'dizzy') { R.root.r = Math.sin(t * 3 * Math.PI * 2) * 8; this.faceFor('x', 0.05); }
      else R.root.sy = 1 + Math.sin(t * Math.PI * 2 / 1.6) * 0.02;
    },
    /* 貓咪漁夫：尾巴擺 ±15°（1.5 秒）、甩竿（前傾＋手臂揮出）、收線（手左右交替）、釣到開心、被河豚嚇一跳 */
    cat: function (R, P) {
      var m = this.mode, t = this.t;
      P.tail.r = Math.sin(t * Math.PI * 2 / 1.5) * 15;
      if (m === 'cast') {
        var k = this.mt < 0.25 ? -this.mt / 0.25 : Math.min(1, (this.mt - 0.25) / 0.15) * 1.6 - 1;
        P.arm.r = -30 * k; R.root.r = 10 * Math.max(0, k);
      } else if (m === 'reel') {
        P.arm.r = Math.sin(t * 14) * 6; P.head.r = Math.sin(t * 7) * 2;
      } else if (m === 'happy') {
        R.root.y = -Math.abs(Math.sin(this.mt * 9)) * 10 * Math.max(0, 1 - this.mt / 1.2);
        this.faceFor('happy', 0.05); P.tail.r = Math.sin(t * 12) * 25;
      } else if (m === 'scared') {
        R.root.r = wob(this.mt, -14); this.faceFor('wide', 0.05); P.tail.sy = 1.15;
      } else {
        R.root.sy = 1 + Math.sin(t * Math.PI * 2 / 1.8) * 0.015;
        P.head.r = Math.sin(t * 0.8) * 3;
      }
    },
    /* 刺蝟：四腳小碎步（0.3 秒一循環）、身體上下 */
    hedgehog: function (R, P, dt, spd) {
      this.ph += dt / 0.3;
      var a = this.ph * Math.PI * 2;
      P.footF1.y = -Math.max(0, Math.sin(a)) * 14; P.footB2.y = -Math.max(0, Math.sin(a)) * 14;
      P.footF2.y = -Math.max(0, -Math.sin(a)) * 14; P.footB1.y = -Math.max(0, -Math.sin(a)) * 14;
      P.footF1.x = Math.cos(a) * 8; P.footF2.x = -Math.cos(a) * 8; P.footB1.x = -Math.cos(a) * 8; P.footB2.x = Math.cos(a) * 8;
      R.root.y = -Math.abs(Math.sin(a)) * 3; R.root.r = Math.sin(a * 2) * 2;
    },
    /* 青蛙：蹲 0.15 秒（scaleY 0.75）→ 跳（伸展 1.2）→ 落地壓扁；遊戲用 mode 控制 */
    frog: function (R, P) {
      var m = this.mode, t = this.t, k;
      if (m === 'crouch') { k = Math.min(1, this.mt / 0.15); R.root.sy = 1 - 0.25 * k; R.root.sx = 1 + 0.15 * k; P.legL.r = 12 * k; P.legR.r = -12 * k; }
      else if (m === 'jump') { k = Math.max(0, 1 - this.mt / 0.3); R.root.sy = 1 + 0.2 * k; R.root.sx = 1 - 0.12 * k; P.legL.r = -35; P.legR.r = 35; P.legL.y = 18; P.legR.y = 18; }
      else R.root.sy = 1 + Math.sin(t * Math.PI * 2 / 1.4) * 0.03; // 喉嚨鼓鼓
    },
    /* 會飛的：翅膀 ±40° 以 9Hz 拍動（蜜蜂 15Hz），身體上下 3px */
    bird: function (R, P) { flap.call(this, R, P, 9, 40); },
    sparrow: function (R, P) { flap.call(this, R, P, 8, 42); },
    bee: function (R, P) { flap.call(this, R, P, 15, 32); }
  };
  function flap(R, P, hz, amp) {
    var a = Math.sin(this.t * hz * Math.PI * 2);
    P.wingF.r = a * amp; P.wingB.r = a * amp * 0.9;
    R.root.y = -Math.sin(this.t * hz * Math.PI * 2 + 1) * 3;
    if (this.mode === 'dizzy') R.root.r = Math.sin(this.t * 3 * Math.PI * 2) * 15;
  }
  GG.MOTION = MOTION;

  /* 章魚觸手：在遊戲裡即時畫（像波浪一樣擺），有描邊；gloves：哪幾隻戴手套 */
  GG.drawTentacles = function (ctx, x, y, s, t, mode) {
    // s＝頭的縮放（和 rig 一樣）；(x, y)＝頭的底部中央。下面 4 隻捲在地上、上面 4 隻往兩側舉高（戴手套的 2 隻）
    var spec = GG.RIGS.octopus.tentacles, col = spec.color, suck = spec.sucker;
    var dive = mode === 'diveL' ? -1 : mode === 'diveR' ? 1 : 0;
    for (var i = 0; i < 8; i++) {
      var side = i < 4 ? -1 : 1, j = i % 4, up = j >= 2;
      var bx = x + side * (up ? 52 + (j - 2) * 10 : 12 + j * 13) * s, by = y - (up ? 34 + (j - 2) * 16 : 6) * s, len = (up ? 105 + (j - 2) * 15 : 62) * s, pts = [];
      for (var q = 0; q <= 12; q++) {
        var f = q / 12, ang;
        if (up) ang = 0.05 - f * (0.75 + (j - 2) * 0.4) + Math.sin(t * 2.6 + i) * 0.22 * f;    // 往兩側伸出去再往上舉
        else ang = 0.15 + f * 0.25 - Math.max(0, f - 0.65) * 3.2 + Math.sin(t * 3 + i * 1.7) * 0.2 * f; // 貼地往外，尖端往上捲
        if (dive && up && side === dive) ang -= 0.6 * f;
        pts.push([bx + Math.cos(ang) * side * len * f, by + Math.sin(ang) * len * f, (9.5 - 6 * f) * s]);
      }
      for (var pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? col : '#3a3850';
        for (q = 0; q < pts.length; q++) { var p = pts[q]; ctx.beginPath(); ctx.arc(p[0], p[1], p[2] + (pass ? 0 : 3.2 * s), 0, Math.PI * 2); ctx.fill(); }
      }
      if (!up) {
        ctx.fillStyle = suck;
        for (q = 3; q < 10; q += 2) { var sp = pts[q]; ctx.beginPath(); ctx.arc(sp[0], sp[1] + sp[2] * 0.35, sp[2] * 0.38, 0, Math.PI * 2); ctx.fill(); }
      } else if (j === 3) {
        var e = pts[pts.length - 1];
        ctx.fillStyle = '#3a3850'; ctx.beginPath(); ctx.arc(e[0], e[1], 13 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(e[0], e[1], 10 * s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a3850'; ctx.lineWidth = 2 * s;
        for (var k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(e[0] + k * 3.4 * s, e[1] - 9 * s); ctx.lineTo(e[0] + k * 3.4 * s, e[1] - 4 * s); ctx.stroke(); }
      }
    }
  };
})();
