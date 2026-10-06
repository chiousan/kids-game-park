/* 打磚塊（磚塊畫在獨立圖層，打碎時才重畫） */
(function () {
  var W, H, bricks, balls, pad, lives, maxLives, level, score, speed0, speed, br, drops, padW0, wideT, d0, flashT, dirty;
  var ROWC = ['red', 'yellow', 'green', 'blue', 'purple'];
  var PCOL = { red: '#ff6b6b', yellow: '#ffd23f', green: '#7ed957', blue: '#4fb3ff', purple: '#b07cff', grey: '#cfd3dc' };

  /* 每一關出現新的磚塊種類：
     2 關：硬磚（要打 2 下）　3 關：鐵磚（打不破）＋炸彈磚（會炸掉旁邊）　4 關：會左右移動的磚　5 關起：3 下的超硬磚 */
  var LV_MSG = ['', '新障礙：硬磚要打 2 下　新道具：變慢、愛心', '新障礙：打不破的鐵磚　新獎勵：炸彈磚', '新障礙：會移動的磚塊　新道具：火球',
    '新障礙：超硬磚要打 3 下', '球變快了！'];
  var tt = 0, fireT = 0;
  function buildLevel() {
    bricks = [];
    var cols = W > 700 ? 10 : 8, rows = Math.min(3 + level, 7);
    var m = 14, top = 80, gap = 4;
    var bw = (W - m * 2 - gap * (cols - 1)) / cols, bh = bw / 2;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var pattern = level % 4;
      if (pattern === 2 && (r + c) % 2 === 1 && r > 0) continue;
      if (pattern === 3 && Math.abs(c - (cols - 1) / 2) > rows - r + 0.5) continue;
      var q = { x: m + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, hp: 1, col: ROWC[r % 5] };
      if ((level >= 2 || d0 === 2) && r === 0) { q.hp = 2; q.col = 'grey'; }
      if (level >= 5 && r <= 1) { q.hp = r === 0 ? 3 : 2; q.col = 'grey'; }
      if (level >= 3 && r === rows - 1 && c % 3 === 1) { q.steel = true; q.hp = 99; }
      else if (level >= 3 && r > 0 && Math.random() < 0.08) q.bomb = true;
      if (level >= 4 && r === rows - 2) { q.mv = true; q.x0 = q.x; }
      bricks.push(q);
    }
    dirty = true;
    if (level > 1) GG.banner('第 ' + level + ' 關', LV_MSG[Math.min(level, LV_MSG.length) - 1]);
  }
  function drawBrick(g, q) {
    g.drawImage(GG.img['br_' + (q.steel ? 'grey' : q.col)], q.x, q.y, q.w, q.h);
    if (q.steel) {
      g.lineWidth = 4; g.strokeStyle = '#5b6070'; g.strokeRect(q.x + 3, q.y + 3, q.w - 6, q.h - 6);
      g.fillStyle = '#5b6070';
      [0.2, 0.8].forEach(function (f) { g.beginPath(); g.arc(q.x + q.w * f, q.y + q.h / 2, 3, 0, 7); g.fill(); });
    } else if (q.bomb) GG.spr(g, 'bomb', q.x + q.w / 2, q.y + q.h / 2, q.h * 0.9, q.h * 0.9);
    else if (q.hp >= 2) GG.text(g, String(q.hp), q.x + q.w / 2, q.y + q.h / 2, q.h * 0.6, '#fff', 'center', true);
  }
  function paintBricks() {
    dirty = false;
    GG.canvasLayer('bricks').paint(function (g) {
      for (var i = 0; i < bricks.length; i++) { var q = bricks[i]; if (!q.mv) drawBrick(g, q); }
    });
  }
  function newBall() { balls = [{ x: pad.x, y: pad.y - br - 2, vx: 0, vy: 0, stuck: true }]; }
  function launch() {
    balls.forEach(function (b) {
      if (!b.stuck) return;
      b.stuck = false;
      var a = GG.rand(-0.45, 0.45);
      b.vx = Math.sin(a) * speed; b.vy = -Math.cos(a) * speed;
    });
  }
  function hitBrick(b, k, force) {
    if (b.steel) { GG.sfx('bounce'); return; }
    b.hp = force ? 0 : b.hp - 1;
    dirty = true;
    if (b.hp > 0) { b.col = b.hp >= 2 ? 'grey' : 'blue'; GG.sfx('bounce'); return; }
    bricks.splice(k, 1);
    if (b.bomb) {
      // 炸彈磚：把旁邊的磚一起炸掉
      GG.sfx('boom'); GG.shake(8, 0.25);
      GG.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 16, colors: ['#ffb347', '#fff3a0', '#ff6b6b'], size: 12, speed: 320 });
      var near = bricks.filter(function (o) { return !o.steel && Math.abs(o.x - b.x) < b.w * 1.6 && Math.abs(o.y - b.y) < b.h * 1.6; });
      near.forEach(function (o) { var j = bricks.indexOf(o); if (j >= 0) hitBrick(o, j, true); });
      if (!bricks.length) return;
    }
    score += 10 * level; GG.setScore(score);
    GG.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 6, colors: [PCOL[b.col], '#fff'], size: 9, speed: 220 });
    GG.sfx('pop');
    if (Math.random() < 0.16) {
      var pool = ['wide', 'multi', 'multi'].concat(level >= 2 ? ['slow', 'life', 'wide'] : []).concat(level >= 4 ? ['fire', 'fire'] : []);
      drops.push({ x: b.x + b.w / 2, y: b.y, kind: GG.pick(pool) });
    }
    if (!bricks.some(function (o) { return !o.steel; })) {
      level++; GG.sfx('win'); flashT = 1.5;
      speed = speed0 * (1 + (level - 1) * 0.04);
      GG.burst(W / 2, H / 2, { n: 30, img: '_star', size: 30, speed: 400 });
      buildLevel(); newBall(); drops = [];
    }
  }
  function stepBall(b, dt) {
    var dist = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * dt;
    var n = Math.max(1, Math.ceil(dist / (br * 0.7))), sdt = dt / n;
    for (var s = 0; s < n; s++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      if (b.x < br) { b.x = br; b.vx = Math.abs(b.vx); GG.sfx('bounce'); }
      if (b.x > W - br) { b.x = W - br; b.vx = -Math.abs(b.vx); GG.sfx('bounce'); }
      if (b.y < br) { b.y = br; b.vy = Math.abs(b.vy); GG.sfx('bounce'); }
      // 板子判定稍微寬一點，對小朋友比較友善
      if (b.vy > 0 && b.y + br >= pad.y - 4 && b.y - br <= pad.y + pad.h && b.x >= pad.x - pad.w / 2 - br * 1.5 && b.x <= pad.x + pad.w / 2 + br * 1.5) {
        var rel = GG.clamp((b.x - pad.x) / (pad.w / 2), -1, 1), a = rel * 1.0;
        b.vx = Math.sin(a) * speed; b.vy = -Math.cos(a) * speed;
        b.y = pad.y - br - 4;
        pad.squash = 1;
        GG.sfx('bounce');
      }
      for (var k = bricks.length - 1; k >= 0; k--) {
        var q = bricks[k];
        var cx = GG.clamp(b.x, q.x, q.x + q.w), cy = GG.clamp(b.y, q.y, q.y + q.h);
        var dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > br * br) continue;
        if (fireT > 0 && !q.steel) { hitBrick(q, k, true); k = Math.min(k, bricks.length); continue; } // 火球直接穿過去
        if (dx === 0 && dy === 0) b.vy = -b.vy;
        else if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.abs(b.vx) * (dx > 0 ? 1 : -1); b.x = cx + (dx > 0 ? br : -br); }
        else { b.vy = Math.abs(b.vy) * (dy > 0 ? 1 : -1); b.y = cy + (dy > 0 ? br : -br); }
        hitBrick(q, k);
        return;
      }
    }
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { level = n; buildLevel(); newBall(); };

  GG.define({
    assets: { br_red: 'puzzle/brick_red', br_yellow: 'puzzle/brick_yellow', br_green: 'puzzle/brick_green', br_blue: 'puzzle/brick_blue',
      br_purple: 'puzzle/brick_purple', br_grey: 'puzzle/brick_grey', paddle: 'puzzle/paddle', ball: 'puzzle/ball', bomb: 'run/bomb' },
    start: function (d) {
      d0 = d;
      W = GG.W; H = GG.H;
      speed0 = H * [0.4, 0.5, 0.62][d];
      padW0 = W * [0.32, 0.25, 0.19][d];
      maxLives = [5, 4, 3][d];
      speed = speed0; lives = maxLives; level = 1; score = 0; drops = []; wideT = 0; flashT = 1.5; tt = 0; fireT = 0;
      br = Math.max(12, Math.min(W, H) * 0.022);
      pad = { x: W / 2, y: H - 90, w: padW0, h: Math.max(20, padW0 * 0.15), squash: 0 };
      buildLevel(); newBall();
      this.resize(W, H);
      GG.setScore(0);
    },
    resize: function (w, h) {
      GG.canvasLayer('bg').paint(function (g) {
        GG.bg(g, w, h, '#4b37a8', '#170d45');
        g.globalAlpha = 0.14;
        for (var k = 0; k < 14; k++) GG.spr(g, '_star', (k * 197) % w, (k * 311) % h, 30 + (k % 3) * 14);
        g.globalAlpha = 1;
      });
      if (!pad) return;
      W = w; H = h; pad.y = H - 90; pad.x = GG.clamp(pad.x, 0, W);
      dirty = true;
    },
    update: function (dt) {
      tt += dt;
      if (fireT > 0) fireT -= dt;
      // 會移動的磚
      // 會移動的那一列：整列一起移動，限制在畫面內不會疊在一起
      var mv = bricks.filter(function (q) { return q.mv; });
      if (mv.length) {
        var lo = Math.min.apply(null, mv.map(function (q) { return q.x0; })), hi = Math.max.apply(null, mv.map(function (q) { return q.x0 + q.w; }));
        var shift = GG.clamp(Math.sin(tt * 1.2) * mv[0].w * 0.9, 4 - lo, W - 4 - hi);
        mv.forEach(function (q) { q.x = q.x0 + shift; });
      }
      if (GG.keys.ArrowLeft) pad.x -= W * 1.2 * dt;
      if (GG.keys.ArrowRight) pad.x += W * 1.2 * dt;
      pad.x = GG.clamp(pad.x, pad.w / 2, W - pad.w / 2);
      pad.w = GG.lerp(pad.w, wideT > 0 ? padW0 * 1.6 : padW0, 0.2);
      if (wideT > 0) wideT -= dt;
      if (pad.squash > 0) pad.squash = Math.max(0, pad.squash - dt * 6);
      if (flashT > 0) flashT -= dt;
      for (var i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];
        if (b.stuck) { b.x = pad.x; b.y = pad.y - br - 2; continue; }
        stepBall(b, dt);
        if (balls[i] !== b) continue;
        if (b.y > H + br * 2) balls.splice(i, 1);
      }
      if (!balls.length) {
        lives--; GG.sfx('hurt'); GG.shake(8, 0.3);
        if (lives <= 0) { GG.over({ score: score, stars: GG.starsFor(level, 2, 3, 4), text: '打到第 ' + level + ' 關' }); return; }
        newBall();
      }
      for (i = drops.length - 1; i >= 0; i--) {
        var dp = drops[i];
        dp.y += H * 0.25 * dt;
        if (dp.y > pad.y - 16 && dp.y < pad.y + pad.h + 16 && Math.abs(dp.x - pad.x) < pad.w / 2 + 30) {
          GG.sfx('power');
          GG.floatText(dp.x, dp.y - 30, { wide: '變寬！', life: '+1 命', slow: '變慢！', multi: '分身！', fire: '火球！' }[dp.kind], '#fff', 28);
          if (dp.kind === 'wide') wideT = 14;
          else if (dp.kind === 'fire') fireT = 7;
          else if (dp.kind === 'life') lives = Math.min(maxLives + 1, lives + 1);
          else if (dp.kind === 'slow') { speed = speed0 * 0.8; balls.forEach(function (x) { var v = Math.sqrt(x.vx * x.vx + x.vy * x.vy) || 1; x.vx *= speed / v; x.vy *= speed / v; }); }
          else {
            var src = balls.filter(function (x) { return !x.stuck; })[0];
            if (src && balls.length < 10) for (var k = -1; k <= 1; k += 2) {
              var a = Math.atan2(src.vx, -src.vy) + k * 0.45;
              balls.push({ x: src.x, y: src.y, vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed, stuck: false });
            }
          }
          drops.splice(i, 1);
        } else if (dp.y > H + 20) drops.splice(i, 1);
      }
      if (dirty) paintBricks();
    },
    draw: function (ctx, w, h) {
      for (var i = 0; i < drops.length; i++) {
        var dp = drops[i], col = { wide: '#29b6f6', life: '#ff5c8a', slow: '#43d17a', multi: '#ffc61a', fire: '#ff7b3d' }[dp.kind];
        ctx.fillStyle = col; GG.rr(ctx, dp.x - 36, dp.y - 16, 72, 32, 16); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; GG.rr(ctx, dp.x - 36, dp.y - 16, 72, 32, 16); ctx.stroke();
        if (dp.kind === 'life') GG.spr(ctx, '_heart', dp.x, dp.y, 26, 26);
        else GG.text(ctx, { wide: '變寬', slow: '變慢', multi: '分身', fire: '火球' }[dp.kind], dp.x, dp.y + 1, 18, '#fff', 'center', true);
      }
      for (i = 0; i < bricks.length; i++) if (bricks[i].mv) drawBrick(ctx, bricks[i]);
      if (fireT > 0) for (i = 0; i < balls.length; i++) {
        ctx.fillStyle = 'rgba(255,140,40,0.45)'; ctx.beginPath(); ctx.arc(balls[i].x, balls[i].y, br * 2, 0, Math.PI * 2); ctx.fill();
      }
      var sq = pad.squash;
      GG.spr(ctx, 'paddle', pad.x, pad.y + pad.h / 2, pad.w * (1 + sq * 0.08), pad.h * 1.4 * (1 - sq * 0.25));
      for (i = 0; i < balls.length; i++) GG.spr(ctx, 'ball', balls[i].x, balls[i].y, br * 2.2, br * 2.2);
      GG.lives(ctx, lives, Math.max(maxLives, lives), 14, 36, 30);
      GG.hudText(ctx, '第 ' + level + ' 關', w - 18, 36, 22, '#fff', 'right');
      if (balls.length && balls[0].stuck) GG.text(ctx, '點一下發球', w / 2, pad.y - 70, 28, '#fff', 'center', true);
    },
    hintAt: function () { return { x: pad.x, y: pad.y + 30, tip: '按住左右拖曳板子', ty: pad.y - 120 }; },
    down: function (p) { this.dragX = p.x; this.padX0 = pad.x; },
    move: function (p) { pad.x = this.padX0 + (p.x - this.dragX) * 1.4; },
    up: function () { launch(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') launch(); }
  });
})();
