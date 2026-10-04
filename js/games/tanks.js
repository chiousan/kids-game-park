/* 坦克對戰：雙人同一台 iPad（上下各一組搖桿），或對電腦 */
(function () {
  var W, H, mode, ctrlH, ar, cell, cols, rows, walls, tanks, bullets, booms, kills, WIN = 3, t, endT;
  // 牆的位置：以中間那一排為 0，上半部定義好再 180 度鏡射到下半部，地圖保證公平
  var PATTERN = [[4, 0], [2, 0], [1, -2], [2, -2], [6, -2], [7, -2], [4, -3], [0, -4]];

  function layout() {
    W = GG.W; H = GG.H;
    ctrlH = Math.round(Math.min(170, Math.max(120, H * 0.15)));
    var top = mode ? 8 : ctrlH, bottom = H - ctrlH;
    cols = 9;
    cell = Math.floor(Math.min(W / cols, (bottom - top) / 7));
    rows = Math.floor((bottom - top) / cell);
    if (rows % 2 === 0) rows--;
    ar = { x: Math.round((W - cell * cols) / 2), y: Math.round(top + (bottom - top - cell * rows) / 2) };
    ar.w = cell * cols; ar.h = cell * rows;
    var mid = (rows - 1) / 2, seen = {};
    walls = [];
    PATTERN.forEach(function (p, i) {
      var r = mid + p[1];
      if (r < 1) return;
      [[p[0], r], [cols - 1 - p[0], rows - 1 - r]].forEach(function (q) {
        var k = q[0] + ',' + q[1];
        if (seen[k]) return;
        seen[k] = 1;
        walls.push({ x: ar.x + q[0] * cell, y: ar.y + q[1] * cell, w: cell, h: cell, img: i % 3 === 2 ? 'crateMetal' : 'crateWood' });
      });
    });
    setPad();
  }
  function spawnPos(i) {
    return { x: ar.x + ar.w / 2, y: i === 0 ? ar.y + ar.h - cell * 0.5 : ar.y + cell * 0.5, a: i === 0 ? -Math.PI / 2 : Math.PI / 2 };
  }
  function makeTank(i) {
    var s = spawnPos(i);
    return { i: i, x: s.x, y: s.y, a: s.a, ax: 0, ay: 0, mag: 0, fire: false, cool: 0, dead: 0, shield: 1.5, img: i === 0 ? 'tank_blue' : 'tank_red',
      bullet: i === 0 ? 'bulletBlue1_outline' : 'bulletRed1_outline', knob: null, stuckT: 0, wanderT: 0, wanderA: 0, lx: s.x, ly: s.y };
  }

  /* 搖桿與開火鈕：ghost 按鈕只負責觸控，外觀由 draw 自己畫 */
  function stickPad(i, x, y, w, h, cx, cy) {
    var R = ctrlH * 0.34;
    return {
      id: 'stick' + i, x: x, y: y, w: w, h: h, ghost: true, cx: cx, cy: cy, R: R,
      onDown: function (p) { this.onMove(p); },
      onMove: function (p) {
        var dx = p.x - this.cx, dy = p.y - this.cy, d = Math.sqrt(dx * dx + dy * dy);
        var tk = tanks && tanks[i];
        if (!tk) return;
        tk.mag = Math.min(1, d / this.R);
        if (d > 4) { tk.ax = dx / d; tk.ay = dy / d; }
        tk.knob = { x: this.cx + (d > this.R ? dx / d * this.R : dx), y: this.cy + (d > this.R ? dy / d * this.R : dy) };
      },
      onUp: function () { var tk = tanks && tanks[i]; if (tk) { tk.mag = 0; tk.knob = null; } }
    };
  }
  function firePad(i, x, y, w, h, cx, cy) {
    return {
      id: 'fire' + i, x: x, y: y, w: w, h: h, ghost: true, cx: cx, cy: cy, R: ctrlH * 0.3,
      onDown: function () { var tk = tanks && tanks[i]; if (tk) tk.fire = true; },
      onUp: function () { var tk = tanks && tanks[i]; if (tk) tk.fire = false; }
    };
  }
  function setPad() {
    var list = [], y1 = H - ctrlH;
    list.push(stickPad(0, 0, y1, W / 2, ctrlH, W * 0.2, y1 + ctrlH / 2));
    list.push(firePad(0, W / 2, y1, W / 2, ctrlH, W * 0.8, y1 + ctrlH / 2));
    if (!mode) {
      list.push(stickPad(1, W / 2, 0, W / 2, ctrlH, W * 0.8, ctrlH / 2));
      list.push(firePad(1, 0, 0, W / 2, ctrlH, W * 0.2, ctrlH / 2));
    }
    GG.setPad(list);
  }

  function hitWall(x, y, r) {
    if (x - r < ar.x || x + r > ar.x + ar.w || y - r < ar.y || y + r > ar.y + ar.h) return true;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var cx = GG.clamp(x, w.x, w.x + w.w), cy = GG.clamp(y, w.y, w.y + w.h);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
    return false;
  }
  function moveTank(tk, dt) {
    var r = cell * 0.34;
    if (tk.mag > 0.2) {
      var want = Math.atan2(tk.ay, tk.ax), diff = want - tk.a;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var turn = (tk.turn || 7) * dt;
      tk.a += Math.abs(diff) < turn ? diff : turn * (diff > 0 ? 1 : -1);
      var sp = cell * 2.3 * tk.mag * (Math.abs(diff) > 1.2 ? 0.3 : 1) * dt;
      var nx = tk.x + Math.cos(tk.a) * sp, ny = tk.y + Math.sin(tk.a) * sp;
      // 分開檢查 x / y，可以沿著牆滑動
      if (!hitWall(nx, tk.y, r)) tk.x = nx;
      if (!hitWall(tk.x, ny, r)) tk.y = ny;
    }
    var o = tanks[1 - tk.i];
    if (!o.dead) {
      var dx = tk.x - o.x, dy = tk.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < r * 2 && d > 0) {
        var push = (r * 2 - d) / 2, px = tk.x + dx / d * push, py = tk.y + dy / d * push;
        if (!hitWall(px, py, r)) { tk.x = px; tk.y = py; }
      }
    }
  }
  function fire(tk) {
    if (tk.cool > 0 || tk.dead) return;
    var mine = bullets.filter(function (b) { return b.owner === tk.i; }).length;
    if (mine >= 3) return;
    tk.cool = 0.45;
    var bx = tk.x + Math.cos(tk.a) * cell * 0.45, by = tk.y + Math.sin(tk.a) * cell * 0.45;
    if (hitWall(bx, by, 2)) return;
    var sp = cell * 6;
    bullets.push({ x: bx, y: by, vx: Math.cos(tk.a) * sp, vy: Math.sin(tk.a) * sp, owner: tk.i, bounces: 0, age: 0, img: tk.bullet });
    GG.sfx('shoot');
  }
  function lineClear(x1, y1, x2, y2) {
    var d = GG.dist(x1, y1, x2, y2), n = Math.ceil(d / (cell * 0.25));
    for (var i = 1; i < n; i++) {
      var x = GG.lerp(x1, x2, i / n), y = GG.lerp(y1, y2, i / n);
      if (hitWall(x, y, 3)) return false;
    }
    return true;
  }
  function aiThink(tk, dt) {
    var e = tanks[0], hard = mode === 2;
    tk.turn = hard ? 6 : 3.5;
    if (e.dead) { tk.mag = 0; tk.fire = false; return; }
    var ang = Math.atan2(e.y - tk.y, e.x - tk.x), see = lineClear(tk.x, tk.y, e.x, e.y);
    var diff = ang - tk.a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    tk.fire = see && Math.abs(diff) < (hard ? 0.12 : 0.3) && Math.random() < (hard ? 0.5 : 0.08);
    if (tk.wanderT > 0) {
      tk.wanderT -= dt; tk.ax = Math.cos(tk.wanderA); tk.ay = Math.sin(tk.wanderA); tk.mag = 1; return;
    }
    var d = GG.dist(tk.x, tk.y, e.x, e.y);
    if (see && d < cell * 3) { tk.ax = Math.cos(ang); tk.ay = Math.sin(ang); tk.mag = 0.25; }
    else { tk.ax = Math.cos(ang); tk.ay = Math.sin(ang); tk.mag = 1; }
    // 卡住了就隨便換個方向走一下
    tk.stuckT += dt;
    if (tk.stuckT > 0.4) {
      if (GG.dist(tk.x, tk.y, tk.lx, tk.ly) < cell * 0.15 && tk.mag > 0.5) { tk.wanderT = GG.rand(0.5, 1.1); tk.wanderA = Math.random() * Math.PI * 2; }
      tk.stuckT = 0; tk.lx = tk.x; tk.ly = tk.y;
    }
  }
  function destroy(tk) {
    tk.dead = 1.4; tk.mag = 0;
    booms.push({ x: tk.x, y: tk.y, t: 0 });
    GG.sfx('boom');
    kills[1 - tk.i]++;
    GG.hud('藍 ' + kills[0] + ' : ' + kills[1] + ' 紅');
    if (kills[1 - tk.i] >= WIN) {
      var who = 1 - tk.i;
      endT = 1;
      var title = mode ? (who === 0 ? '你贏了！' : '電腦贏了！') : (who === 0 ? '藍方獲勝！' : '紅方獲勝！');
      GG.over({ win: mode ? who === 0 : true, title: title, text: '比數 ' + kills[0] + ' : ' + kills[1], delay: 1300 });
    }
  }

  GG.define({
    modes: [
      { label: '雙人對戰', value: 0, cls: 'b-blue' },
      { label: '對電腦・簡單', value: 1, cls: 'b-easy' },
      { label: '對電腦・困難', value: 2, cls: 'b-hard' }
    ],
    assets: {
      tank_blue: 'tank/tank_blue', tank_red: 'tank/tank_red', bulletBlue1_outline: 'tank/bulletBlue1_outline', bulletRed1_outline: 'tank/bulletRed1_outline',
      crateWood: 'tank/crateWood', crateMetal: 'tank/crateMetal', grass: 'tank/tileGrass1', sand: 'tank/tileSand1',
      ex1: 'tank/explosion1', ex2: 'tank/explosion2', ex3: 'tank/explosion3', ex4: 'tank/explosion4', ex5: 'tank/explosion5', smoke: 'tank/explosionSmoke3'
    },
    start: function (m) {
      mode = m;
      tanks = null;
      layout();
      tanks = [makeTank(0), makeTank(1)];
      bullets = []; booms = []; kills = [0, 0]; t = 0; endT = 0;
      GG.hud('藍 0 : 0 紅');
    },
    resize: function () {
      if (!tanks) return;
      layout();
      tanks.forEach(function (tk) { var s = spawnPos(tk.i); tk.x = s.x; tk.y = s.y; });
      bullets = [];
    },
    update: function (dt) {
      t += dt;
      if (GG.keys) {
        var k = GG.keys, tk0 = tanks[0];
        var kx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), ky = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
        if (kx || ky) { var kd = Math.sqrt(kx * kx + ky * ky); tk0.ax = kx / kd; tk0.ay = ky / kd; tk0.mag = 1; }
        else if (!tk0.knob) tk0.mag = 0;
        if (k[' ']) fire(tk0);
      }
      for (var i = 0; i < 2; i++) {
        var tk = tanks[i];
        tk.cool -= dt;
        if (tk.shield > 0) tk.shield -= dt;
        if (tk.dead > 0) {
          tk.dead -= dt;
          if (tk.dead <= 0 && !endT) { var s = spawnPos(i); tk.x = s.x; tk.y = s.y; tk.a = s.a; tk.dead = 0; tk.shield = 1.5; }
          continue;
        }
        if (i === 1 && mode) aiThink(tk, dt);
        moveTank(tk, dt);
        if (tk.fire) fire(tk);
      }
      for (i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.age += dt;
        var steps = 3, sdt = dt / steps, gone = false;
        for (var st = 0; st < steps && !gone; st++) {
          var nx = b.x + b.vx * sdt, ny = b.y + b.vy * sdt;
          if (hitWall(nx, ny, 3)) {
            if (b.bounces >= 1) { gone = true; break; }
            b.bounces++;
            GG.sfx('bounce');
            if (hitWall(nx, b.y, 3)) b.vx = -b.vx;
            if (hitWall(b.x, ny, 3)) b.vy = -b.vy;
            continue;
          }
          b.x = nx; b.y = ny;
          for (var j = 0; j < 2; j++) {
            var tt = tanks[j];
            if (tt.dead || j === b.owner) continue; // 自己的砲彈不會打到自己（對小孩比較友善）
            if (GG.dist(b.x, b.y, tt.x, tt.y) < cell * 0.36) {
              gone = true;
              if (tt.shield <= 0 && !endT) destroy(tt);
              break;
            }
          }
        }
        if (gone) { booms.push({ x: b.x, y: b.y, t: 0.3, small: true }); bullets.splice(i, 1); }
      }
      for (i = booms.length - 1; i >= 0; i--) { booms[i].t += dt; if (booms[i].t > 0.6) booms.splice(i, 1); }
    },
    draw: function (ctx, w, h) {
      ctx.fillStyle = '#3d4a2a'; ctx.fillRect(0, 0, w, h);
      GG.tile(ctx, 'grass', ar.x, ar.y, ar.w, ar.h, cell, 0, 0);
      ctx.lineWidth = 5; ctx.strokeStyle = GG.INK; ctx.strokeRect(ar.x - 2.5, ar.y - 2.5, ar.w + 5, ar.h + 5);
      walls.forEach(function (wl) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wl.x + 5, wl.y + 7, wl.w, wl.h);
        ctx.drawImage(GG.img[wl.img], wl.x, wl.y, wl.w, wl.h);
      });
      bullets.forEach(function (b) { GG.spr(ctx, b.img, b.x, b.y, cell * 0.14, cell * 0.25, { rot: Math.atan2(b.vy, b.vx) + Math.PI / 2 }); });
      tanks.forEach(function (tk) {
        if (tk.dead) return;
        if (tk.shield > 0 && Math.floor(tk.shield * 10) % 2) return;
        // 坦克圖的砲管朝下，所以要減 90 度
        GG.spr(ctx, tk.img, tk.x, tk.y, cell * 0.72, cell * 0.72 * GG.ratio(tk.img), { rot: tk.a - Math.PI / 2 });
      });
      booms.forEach(function (b) {
        var f = Math.min(4, Math.floor(b.t / 0.12));
        var s = b.small ? cell * 0.45 : cell * 1.3;
        GG.spr(ctx, 'ex' + (f + 1), b.x, b.y, s, s);
      });
      // 控制區
      var y1 = h - ctrlH;
      drawCtrl(ctx, 0, y1, w, ctrlH, 0);
      if (!mode) drawCtrl(ctx, 0, 0, w, ctrlH, 1);
    },
    key: function () { }
  });

  function drawCtrl(ctx, x, y, w, hh, i) {
    ctx.fillStyle = i === 0 ? 'rgba(30,80,170,0.55)' : 'rgba(170,40,40,0.55)';
    ctx.fillRect(x, y, w, hh);
    var tk = tanks[i];
    var pads = [GG.button('stick' + i), GG.button('fire' + i)];
    var st = pads[0], fr = pads[1];
    if (!st || !fr) return;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(st.cx, st.cy, st.R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    var kn = tk.knob || { x: st.cx, y: st.cy };
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(kn.x, kn.y, st.R * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; ctx.stroke();
    ctx.fillStyle = fr.down ? '#ffe14d' : (i === 0 ? '#4fa3ff' : '#ff6b6b');
    ctx.beginPath(); ctx.arc(fr.cx, fr.cy + (fr.down ? 3 : 0), fr.R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = GG.INK; ctx.stroke();
    GG.icon(ctx, 'fire', fr.cx, fr.cy + (fr.down ? 3 : 0), fr.R * 0.9, '#fff');
    ctx.save();
    ctx.translate(w / 2, y + hh / 2);
    if (i === 1) ctx.rotate(Math.PI);
    GG.text(ctx, i === 0 ? '藍方' : '紅方', 0, 0, 24, '#fff', 'center', true);
    for (var k = 0; k < WIN; k++) {
      ctx.fillStyle = k < kills[i] ? '#ffe14d' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc((k - 1) * 22, 28, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
})();
