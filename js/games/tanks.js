/* 坦克對戰：雙人同一台 iPad（上下各一組搖桿），或對電腦 */
(function () {
  var W, H, mode, ctrlH, ar, cell, cols, rows, walls, tanks, bullets, booms, kills, WIN = 3, t, endT;
  // 牆的位置：以中間那一排為 0，上半部定義好再 180 度鏡射到下半部，地圖保證公平
  var PATTERN = [[4, 0], [2, 0], [1, -2], [2, -2], [6, -2], [7, -2], [4, -3], [0, -4]];
  // 橫放用的寬地圖（13x5），雙方從對角出發
  var LPATTERN = [[6, 0], [3, 0], [2, -1], [5, -1], [9, -2], [10, -2]];
  var land = false, hintT = 0;
  /* 越打越刺激（看總擊倒數）：1 次後地圖出現道具（三連發、護盾、加速）、2 次後出現會爆炸的油桶、
     4 次後砲彈可以反彈兩次而且更快。對電腦時，你每打倒電腦一次，電腦就變強一點。 */
  var LV_MSG = ['', '新道具：三連發、護盾、加速（開過去就能撿）', '新障礙：油桶（打到會爆炸！）', '砲彈可以反彈兩次，而且更快了！'];
  var phase = 1, items = [], itemT = 0, barrels = [], aiBoost = 0;
  function freeCell() {
    for (var tries = 0; tries < 60; tries++) {
      var x = ar.x + (GG.randInt(0, cols - 1) + 0.5) * cell, y = ar.y + (GG.randInt(1, rows - 2) + 0.5) * cell;
      if (!hitWall(x, y, cell * 0.4) && tanks.every(function (tk) { return GG.dist(tk.x, tk.y, x, y) > cell * 1.5; })) return { x: x, y: y };
    }
    return null;
  }
  function setPhase() {
    var tot = kills[0] + kills[1], np = tot >= 4 ? 4 : tot >= 2 ? 3 : tot >= 1 ? 2 : 1;
    if (np <= phase) return;
    phase = np;
    GG.banner(phase === 2 ? '道具出現了！' : phase === 3 ? '小心油桶！' : '最後決戰！', LV_MSG[phase - 1]);
    if (phase >= 3 && !barrels.length) {
      var a = freeCell();
      if (a) { barrels.push({ x: a.x, y: a.y }); barrels.push({ x: ar.x * 2 + ar.w - a.x, y: ar.y * 2 + ar.h - a.y }); }
    }
  }
  function explode(b) {
    barrels.splice(barrels.indexOf(b), 1);
    booms.push({ x: b.x, y: b.y, t: 0 });
    GG.sfx('boom'); GG.shake(10, 0.3);
    tanks.forEach(function (tk) { if (!tk.dead && tk.shield <= 0 && GG.dist(tk.x, tk.y, b.x, b.y) < cell * 1.3 && !endT) destroy(tk); });
  }

  function layout() {
    W = GG.W; H = GG.H;
    ctrlH = Math.round(Math.min(170, Math.max(120, H * 0.15)));
    var top = mode ? 8 : ctrlH, bottom = H - ctrlH;
    land = W > H * 1.2;
    cols = land ? 13 : 9;
    cell = Math.floor(Math.min((W - 16) / cols, (bottom - top) / (land ? 5 : 7)));
    rows = land ? 5 : Math.floor((bottom - top) / cell);
    if (rows % 2 === 0) rows--;
    ar = { x: Math.round((W - cell * cols) / 2), y: Math.round(top + (bottom - top - cell * rows) / 2) };
    ar.w = cell * cols; ar.h = cell * rows;
    var mid = (rows - 1) / 2, seen = {};
    walls = [];
    (land ? LPATTERN : PATTERN).forEach(function (p, i) {
      var r = mid + p[1];
      if (r < (land ? 0 : 1)) return;
      [[p[0], r], [cols - 1 - p[0], rows - 1 - r]].forEach(function (q) {
        var k = q[0] + ',' + q[1];
        if (seen[k]) return;
        seen[k] = 1;
        walls.push({ x: ar.x + q[0] * cell, y: ar.y + q[1] * cell, w: cell, h: cell, img: i % 3 === 2 ? 'crateMetal' : 'crateWood' });
      });
    });
    setPad();
    GG.canvasLayer('bg').paint(function (g, w, h) {
      g.fillStyle = '#3d4a2a'; g.fillRect(0, 0, w, h);
      GG.tile(g, 'grass', ar.x, ar.y, ar.w, ar.h, cell, 0, 0);
      g.lineWidth = 5; g.strokeStyle = GG.INK; g.strokeRect(ar.x - 2.5, ar.y - 2.5, ar.w + 5, ar.h + 5);
      walls.forEach(function (wl) {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wl.x + 5, wl.y + 7, wl.w, wl.h);
        g.drawImage(GG.img[wl.img], wl.x, wl.y, wl.w, wl.h);
      });
    });
  }
  function spawnPos(i) {
    if (land) return { x: i === 0 ? ar.x + cell * 0.5 : ar.x + ar.w - cell * 0.5, y: i === 0 ? ar.y + ar.h - cell * 0.5 : ar.y + cell * 0.5, a: i === 0 ? 0 : Math.PI };
    return { x: ar.x + ar.w / 2, y: i === 0 ? ar.y + ar.h - cell * 0.5 : ar.y + cell * 0.5, a: i === 0 ? -Math.PI / 2 : Math.PI / 2 };
  }
  function makeTank(i) {
    var s = spawnPos(i);
    return { i: i, x: s.x, y: s.y, a: s.a, ax: 0, ay: 0, mag: 0, fire: false, cool: 0, dead: 0, shield: 0, touched: false, img: i === 0 ? 'tank_blue' : 'tank_red',
      bullet: i === 0 ? 'bulletBlue1_outline' : 'bulletRed1_outline', knob: null, stuckT: 0, wanderT: 0, wanderA: 0, lx: s.x, ly: s.y };
  }

  /* 固定搖桿（左）＋圓形開火鈕（右）。上方的紅方面對面坐，所以左右對調 */
  function setPad() {
    var list = [], R = Math.round(GG.clamp(ctrlH * 0.36, 48, 70)), fr = Math.round(R * 1.05);
    [0, 1].forEach(function (i) {
      if (i === 1 && mode) return;
      var cy = i === 0 ? H - ctrlH / 2 : ctrlH / 2, sx = i === 0 ? W * 0.17 : W * 0.83, fx = i === 0 ? W * 0.83 : W * 0.17;
      sx = GG.clamp(sx, R + 30, W - R - 30); fx = GG.clamp(fx, fr + 30, W - fr - 30);
      list.push(GG.stick({ id: 'stick' + i, cx: sx, cy: cy, R: R, color: i === 0 ? '#8fc4ff' : '#ff9a9a',
        zone: { x: i === 0 ? 0 : W / 2, y: cy - ctrlH / 2, w: W / 2, h: ctrlH },
        onStick: function (b) {
          var tk = tanks && tanks[i];
          if (!tk) return;
          tk.mag = b.mag > 0.2 ? Math.min(1, b.mag * 1.25) : 0;
          if (b.mag > 0.2) { tk.ax = b.ax; tk.ay = b.ay; }
          tk.knob = b.down;
          if (b.down) tk.touched = true;
        } }));
      var fd = ctrlH * 0.84;
      list.push({ id: 'fire' + i, round: true, icon: 'fire', color: i === 0 ? '#4fa3ff' : '#ff6b6b', colorDown: '#ffe14d',
        x: fx - fd / 2, y: cy - fd / 2, w: fd, h: fd, hit: ctrlH * 0.3,
        onDown: function () { var tk = tanks && tanks[i]; if (tk) { tk.fire = true; tk.cool = Math.min(tk.cool, 0); } },
        onUp: function () { var tk = tanks && tanks[i]; if (tk) tk.fire = false; } });
    });
    GG.setPad(list);
  }

  function hitWall(x, y, r) {
    if (x - r < ar.x || x + r > ar.x + ar.w || y - r < ar.y || y + r > ar.y + ar.h) return true;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var cx = GG.clamp(x, w.x, w.x + w.w), cy = GG.clamp(y, w.y, w.y + w.h);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
    for (var bi = 0; bi < barrels.length; bi++) if (GG.dist(x, y, barrels[bi].x, barrels[bi].y) < r + cell * 0.3) return true;
    return false;
  }
  function moveTank(tk, dt) {
    var r = cell * 0.37;
    if (tk.mag > 0.2) {
      var want = Math.atan2(tk.ay, tk.ax), diff = want - tk.a;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var turn = (tk.turn || 16) * dt;
      tk.a += Math.abs(diff) < turn ? diff : turn * (diff > 0 ? 1 : -1);
      var sp = cell * 2.4 * tk.mag * (Math.abs(diff) > 1.2 ? 0.55 : 1) * (tk.speedT > 0 ? 1.5 : 1) * dt;
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
    if (mine >= (tk.triple > 0 ? 9 : 3)) return;
    tk.cool = 0.45;
    var bx = tk.x + Math.cos(tk.a) * cell * 0.45, by = tk.y + Math.sin(tk.a) * cell * 0.45;
    if (hitWall(bx, by, 2)) return;
    var sp = cell * 6 * (phase >= 4 ? 1.15 : 1);
    (tk.triple > 0 ? [-0.22, 0, 0.22] : [0]).forEach(function (da) {
      bullets.push({ x: bx, y: by, vx: Math.cos(tk.a + da) * sp, vy: Math.sin(tk.a + da) * sp, owner: tk.i, bounces: 0, age: 0, img: tk.bullet });
    });
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
    tk.turn = (hard ? 4.5 : 2.5) + aiBoost * 0.6;
    if (e.dead) { tk.mag = 0; tk.fire = false; return; }
    var ang = Math.atan2(e.y - tk.y, e.x - tk.x), see = lineClear(tk.x, tk.y, e.x, e.y);
    var diff = ang - tk.a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    tk.fire = see && Math.abs(diff) < (hard ? 0.15 : 0.35) && Math.random() < (hard ? 0.22 : 0.04) + aiBoost * 0.03;
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
    GG.sfx('boom'); GG.shake(10, 0.3);
    kills[1 - tk.i]++;
    GG.hud('藍 ' + kills[0] + ' : ' + kills[1] + ' 紅');
    if (mode && tk.i === 1) aiBoost++;
    setPhase();
    if (kills[1 - tk.i] >= WIN) {
      var who = 1 - tk.i;
      endT = 1;
      var title = mode ? (who === 0 ? '你贏了！' : '電腦贏了！') : (who === 0 ? '藍方獲勝！' : '紅方獲勝！');
      GG.over({ win: mode ? who === 0 : true, title: title, text: '比數 ' + kills[0] + ' : ' + kills[1], delay: 1300 });
    }
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { kills = [Math.min(2, n - 1), Math.max(0, n - 3)]; setPhase(); };

  GG.define({
    noHint: true,
    modes: [
      { label: '雙人對戰', value: 0, cls: 'b-blue' },
      { label: '對電腦・簡單', value: 1, cls: 'b-easy' },
      { label: '對電腦・困難', value: 2, cls: 'b-hard' }
    ],
    assets: {
      tank_blue: 'tank/tank_blue', tank_red: 'tank/tank_red', bulletBlue1_outline: 'tank/bulletBlue1_outline', bulletRed1_outline: 'tank/bulletRed1_outline',
      crateWood: 'tank/crateWood', crateMetal: 'tank/crateMetal', grass: 'tank/tileGrass1', sand: 'tank/tileSand1',
      barrel: 'race/barrel_red', shieldFx: 'space/shield', bolt: 'space/w_lightning',
      ex1: 'tank/explosion1', ex2: 'tank/explosion2', ex3: 'tank/explosion3', ex4: 'tank/explosion4', ex5: 'tank/explosion5', smoke: 'tank/explosionSmoke3'
    },
    start: function (m) {
      mode = m;
      tanks = null;
      layout();
      tanks = [makeTank(0), makeTank(1)];
      bullets = []; booms = []; kills = [0, 0]; t = 0; endT = 0; hintT = 0; phase = 1; items = []; itemT = 0; barrels = []; aiBoost = 0;
      GG.hud('藍 0 : 0 紅');
    },
    resize: function () {
      if (!tanks) return;
      layout();
      tanks.forEach(function (tk) { var s = spawnPos(tk.i); tk.x = s.x; tk.y = s.y; });
      bullets = [];
    },
    update: function (dt) {
      t += dt; hintT += dt;
      if (GG.keys) {
        var k = GG.keys, tk0 = tanks[0];
        var kx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), ky = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
        if (kx || ky) { var kd = Math.sqrt(kx * kx + ky * ky); tk0.ax = kx / kd; tk0.ay = ky / kd; tk0.mag = 1; }
        else if (!tk0.knob) tk0.mag = 0;
        if (k[' ']) fire(tk0);
      }
      // 道具：每隔一段時間出現一個，開過去就撿到
      if (phase >= 2 && !endT) {
        itemT += dt;
        if (itemT > 6 && items.length < 2) { itemT = 0; var fc = freeCell(); if (fc) items.push({ x: fc.x, y: fc.y, kind: GG.pick(['triple', 'shield', 'speed']) }); }
      }
      for (var ii = items.length - 1; ii >= 0; ii--) {
        for (var ti = 0; ti < 2; ti++) {
          var tt2 = tanks[ti];
          if (tt2.dead || GG.dist(tt2.x, tt2.y, items[ii].x, items[ii].y) > cell * 0.6) continue;
          var kd2 = items[ii].kind;
          if (kd2 === 'triple') tt2.triple = 8; else if (kd2 === 'shield') { tt2.shield = 6; tt2.shieldItem = true; } else tt2.speedT = 6;
          GG.sfx('power');
          GG.floatText(tt2.x, tt2.y - cell * 0.6, { triple: '三連發！', shield: '護盾！', speed: '加速！' }[kd2], '#ffe14d', 26);
          items.splice(ii, 1); break;
        }
      }
      for (var i = 0; i < 2; i++) {
        var tk = tanks[i];
        tk.cool -= dt;
        if (tk.triple > 0) tk.triple -= dt;
        if (tk.speedT > 0) tk.speedT -= dt;
        if (tk.shield > 0) { tk.shield -= dt; if (tk.shield <= 0) tk.shieldItem = false; }
        if (tk.dead > 0) {
          tk.dead -= dt;
          if (tk.dead <= 0 && !endT) { var s = spawnPos(i); tk.x = s.x; tk.y = s.y; tk.a = s.a; tk.dead = 0; tk.shield = 1.5; tk.shieldItem = false; tk.triple = 0; tk.speedT = 0; }
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
          var hitB = null;
          for (var bk = 0; bk < barrels.length; bk++) if (GG.dist(nx, ny, barrels[bk].x, barrels[bk].y) < cell * 0.32) { hitB = barrels[bk]; break; }
          if (hitB) { explode(hitB); gone = true; break; }
          if (hitWall(nx, ny, 3)) {
            if (b.bounces >= (phase >= 4 ? 2 : 1)) { gone = true; break; }
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
            if (GG.dist(b.x, b.y, tt.x, tt.y) < cell * 0.4) {
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
      barrels.forEach(function (b) { GG.spr(ctx, 'barrel', b.x, b.y, cell * 0.62, cell * 0.62); });
      items.forEach(function (it) {
        var pulse = 1 + Math.sin(t * 6) * 0.08, sz = cell * 0.62 * pulse;
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(it.x, it.y, sz * 0.62, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffb02e'; ctx.stroke();
        if (it.kind === 'triple') [-1, 0, 1].forEach(function (k) { GG.spr(ctx, 'bulletBlue1_outline', it.x + k * sz * 0.22, it.y, sz * 0.18, sz * 0.4, { rot: k * 0.3 }); });
        else if (it.kind === 'shield') GG.spr(ctx, 'shieldFx', it.x, it.y, sz, sz);
        else GG.spr(ctx, 'bolt', it.x, it.y, sz * 0.9, sz * 0.9);
      });
      bullets.forEach(function (b) { GG.spr(ctx, b.img, b.x, b.y, cell * 0.18, cell * 0.32, { rot: Math.atan2(b.vy, b.vx) + Math.PI / 2 }); });
      tanks.forEach(function (tk) {
        if (tk.dead) return;
        if (tk.shield > 0 && !tk.shieldItem && Math.floor(tk.shield * 10) % 2) return;
        // 坦克圖的砲管朝下，所以要減 90 度
        GG.spr(ctx, tk.img, tk.x, tk.y, cell * 0.8, cell * 0.8 * GG.ratio(tk.img), { rot: tk.a - Math.PI / 2 });
        if (tk.shield > 0 && tk.shieldItem) GG.spr(ctx, 'shieldFx', tk.x, tk.y, cell * 1.1, cell * 1.1, { alpha: 0.6 });
        if (tk.triple > 0 || tk.speedT > 0) GG.text(ctx, tk.triple > 0 ? '×3' : '快', tk.x, tk.y - cell * 0.62, 18, '#ffe14d', 'center', true);
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
      // 教學：還沒碰搖桿的玩家，在他的搖桿上示範推桿
      [0, 1].forEach(function (i) {
        var st = GG.button('stick' + i), fb = GG.button('fire' + i), tk = tanks[i];
        if (!st || !fb || tk.touched || hintT > 8) return;
        ctx.save();
        ctx.translate(st.cx, st.cy);
        if (i === 1) ctx.rotate(Math.PI);
        var k = Math.sin(hintT * 3);
        GG.hand(ctx, k * st.R * 0.5, -st.R * 0.3, st.R * 1.2, true);
        GG.text(ctx, '推這裡開坦克', 0, -st.R * 1.45, 20, '#fff', 'center', true);
        ctx.restore();
        ctx.save();
        ctx.translate(fb.x + fb.w / 2, fb.y + fb.h / 2);
        if (i === 1) ctx.rotate(Math.PI);
        GG.text(ctx, '按這裡開砲', 0, -fb.h * 0.62, 20, '#fff', 'center', true);
        ctx.restore();
      });
    },
    key: function () { }
  });

  function drawCtrl(ctx, x, y, w, hh, i) {
    ctx.fillStyle = i === 0 ? 'rgba(30,80,170,0.55)' : 'rgba(170,40,40,0.55)';
    ctx.fillRect(x, y, w, hh);
    ctx.save();
    ctx.translate(w / 2, y + hh / 2);
    if (i === 1) ctx.rotate(Math.PI);
    GG.text(ctx, i === 0 ? (mode ? '你（藍方）' : '藍方') : '紅方', 0, -14, 24, '#fff', 'center', true);
    for (var k = 0; k < WIN; k++) GG.spr(ctx, '_star', (k - 1) * 36, 22, 30, 30, k < kills[i] ? null : { alpha: 0.3 });
    ctx.restore();
  }
})();
