/* 打磚塊（磚塊畫在獨立圖層，打碎時才重畫） */
(function () {
  var W, H, bricks, balls, pad, lives, maxLives, level, score, speed0, speed, br, drops, padW0, wideT, d0, flashT, dirty;
  var ROWC = ['red', 'yellow', 'green', 'blue', 'purple'];
  var PCOL = { red: '#ff6b6b', yellow: '#ffd23f', green: '#7ed957', blue: '#4fb3ff', purple: '#b07cff', grey: '#cfd3dc' };

  function buildLevel() {
    bricks = [];
    var cols = W > 700 ? 10 : 8, rows = Math.min(3 + level, 7);
    var m = 14, top = 80, gap = 4;
    var bw = (W - m * 2 - gap * (cols - 1)) / cols, bh = bw / 2;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var pattern = level % 4;
      if (pattern === 2 && (r + c) % 2 === 1 && r > 0) continue;
      if (pattern === 3 && Math.abs(c - (cols - 1) / 2) > rows - r + 0.5) continue;
      var hp = (level >= 3 && r === 0) || (d0 === 2 && r === 0) ? 2 : 1;
      bricks.push({ x: m + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, hp: hp, col: hp > 1 ? 'grey' : ROWC[r % 5] });
    }
    dirty = true;
  }
  function paintBricks() {
    dirty = false;
    GG.canvasLayer('bricks').paint(function (g) {
      for (var i = 0; i < bricks.length; i++) { var q = bricks[i]; g.drawImage(GG.img['br_' + q.col], q.x, q.y, q.w, q.h); }
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
  function hitBrick(b, k) {
    b.hp--;
    dirty = true;
    if (b.hp > 0) { b.col = 'blue'; GG.sfx('bounce'); return; }
    bricks.splice(k, 1);
    score += 10 * level; GG.setScore(score);
    GG.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 6, colors: [PCOL[b.col], '#fff'], size: 9, speed: 220 });
    GG.sfx('pop');
    if (Math.random() < 0.16) drops.push({ x: b.x + b.w / 2, y: b.y, kind: GG.pick(['wide', 'multi', 'multi', 'life', 'wide', 'slow']) });
    if (!bricks.length) {
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
        if (dx === 0 && dy === 0) b.vy = -b.vy;
        else if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.abs(b.vx) * (dx > 0 ? 1 : -1); b.x = cx + (dx > 0 ? br : -br); }
        else { b.vy = Math.abs(b.vy) * (dy > 0 ? 1 : -1); b.y = cy + (dy > 0 ? br : -br); }
        hitBrick(q, k);
        return;
      }
    }
  }

  GG.define({
    assets: { br_red: 'puzzle/brick_red', br_yellow: 'puzzle/brick_yellow', br_green: 'puzzle/brick_green', br_blue: 'puzzle/brick_blue',
      br_purple: 'puzzle/brick_purple', br_grey: 'puzzle/brick_grey', paddle: 'puzzle/paddle', ball: 'puzzle/ball' },
    start: function (d) {
      d0 = d;
      W = GG.W; H = GG.H;
      speed0 = H * [0.4, 0.5, 0.62][d];
      padW0 = W * [0.32, 0.25, 0.19][d];
      maxLives = [5, 4, 3][d];
      speed = speed0; lives = maxLives; level = 1; score = 0; drops = []; wideT = 0; flashT = 1.5;
      br = Math.max(9, Math.min(W, H) * 0.016);
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
          GG.floatText(dp.x, dp.y - 30, { wide: '變寬！', life: '+1 命', slow: '變慢！', multi: '分身！' }[dp.kind], '#fff', 28);
          if (dp.kind === 'wide') wideT = 14;
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
        var dp = drops[i], col = { wide: '#29b6f6', life: '#ff5c8a', slow: '#43d17a', multi: '#ffc61a' }[dp.kind];
        ctx.fillStyle = col; GG.rr(ctx, dp.x - 36, dp.y - 16, 72, 32, 16); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; GG.rr(ctx, dp.x - 36, dp.y - 16, 72, 32, 16); ctx.stroke();
        if (dp.kind === 'life') GG.spr(ctx, '_heart', dp.x, dp.y, 26, 26);
        else GG.text(ctx, { wide: '變寬', slow: '變慢', multi: '分身' }[dp.kind], dp.x, dp.y + 1, 16, '#fff', 'center', true);
      }
      var sq = pad.squash;
      GG.spr(ctx, 'paddle', pad.x, pad.y + pad.h / 2, pad.w * (1 + sq * 0.08), pad.h * 1.4 * (1 - sq * 0.25));
      for (i = 0; i < balls.length; i++) GG.spr(ctx, 'ball', balls[i].x, balls[i].y, br * 2.2, br * 2.2);
      GG.lives(ctx, lives, Math.max(maxLives, lives), 14, 36, 30);
      GG.text(ctx, '第 ' + level + ' 關', w - 16, 36, 22, '#fff', 'right', true);
      if (balls.length && balls[0].stuck) GG.text(ctx, '點一下發球', w / 2, pad.y - 70, 28, '#fff', 'center', true);
      if (flashT > 0) { ctx.globalAlpha = Math.min(1, flashT); GG.text(ctx, '第 ' + level + ' 關', w / 2, h * 0.55, 60, '#ffd23f', 'center', true); ctx.globalAlpha = 1; }
    },
    down: function (p) { this.dragX = p.x; this.padX0 = pad.x; },
    move: function (p) { pad.x = this.padX0 + (p.x - this.dragX) * 1.4; },
    up: function () { launch(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') launch(); }
  });
})();
