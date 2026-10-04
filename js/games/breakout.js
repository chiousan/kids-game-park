/* 打磚塊 */
(function () {
  var W, H, bricks, balls, pad, lives, level, score, speed0, speed, br, drops, parts, padW0, wideT, d0, flashT;
  var ROWC = ['red', 'yellow', 'green', 'blue', 'purple', 'grey'];
  var PCOL = { red: '#ff6b6b', yellow: '#ffd23f', green: '#7ed957', blue: '#4fb3ff', purple: '#b07cff', grey: '#cfd3dc' };

  function buildLevel() {
    bricks = [];
    var cols = W > 700 ? 10 : 8, rows = Math.min(4 + level, 8);
    var m = 14, top = 70, gap = 4;
    var bw = (W - m * 2 - gap * (cols - 1)) / cols, bh = bw / 2;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      // 不同關卡用不同圖案
      var pattern = level % 4;
      if (pattern === 2 && (r + c) % 2 === 1 && r > 0) continue;
      if (pattern === 3 && Math.abs(c - (cols - 1) / 2) > rows - r + 0.5) continue;
      var hp = (level >= 3 && r < 2) || (d0 === 2 && r === 0) ? 2 : 1;
      var col = hp > 1 ? 'grey' : ROWC[r % 5];
      bricks.push({ x: m + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, hp: hp, col: col });
    }
  }
  function newBall() {
    balls = [{ x: pad.x, y: pad.y - br - 2, vx: 0, vy: 0, stuck: true }];
  }
  function launch() {
    balls.forEach(function (b) {
      if (!b.stuck) return;
      b.stuck = false;
      var a = GG.rand(-0.5, 0.5);
      b.vx = Math.sin(a) * speed; b.vy = -Math.cos(a) * speed;
    });
  }
  function burst(x, y, col) {
    for (var i = 0; i < 6 && parts.length < 80; i++) {
      parts.push({ x: x, y: y, vx: GG.rand(-180, 180), vy: GG.rand(-200, 60), t: 0.6, col: col });
    }
  }
  function hitBrick(b, k) {
    b.hp--;
    if (b.hp > 0) b.col = 'blue';
    if (b.hp <= 0) {
      bricks.splice(k, 1);
      score += 10 * level; GG.setScore(score);
      burst(b.x + b.w / 2, b.y + b.h / 2, PCOL[b.col]);
      GG.sfx('pop');
      if (Math.random() < 0.13) drops.push({ x: b.x + b.w / 2, y: b.y, kind: GG.pick(['wide', 'multi', 'multi', 'life', 'wide']) });
      if (!bricks.length) {
        level++; GG.sfx('win'); flashT = 1.2;
        speed = speed0 * (1 + (level - 1) * 0.06);
        buildLevel(); newBall(); drops = [];
      }
    } else GG.sfx('bounce');
  }

  function stepBall(b, dt) {
    var dist = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * dt;
    var n = Math.max(1, Math.ceil(dist / (br * 0.7)));
    var sdt = dt / n;
    for (var s = 0; s < n; s++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      if (b.x < br) { b.x = br; b.vx = Math.abs(b.vx); GG.sfx('bounce'); }
      if (b.x > W - br) { b.x = W - br; b.vx = -Math.abs(b.vx); GG.sfx('bounce'); }
      if (b.y < br) { b.y = br; b.vy = Math.abs(b.vy); GG.sfx('bounce'); }
      // 板子
      if (b.vy > 0 && b.y + br >= pad.y && b.y - br <= pad.y + pad.h && b.x >= pad.x - pad.w / 2 - br && b.x <= pad.x + pad.w / 2 + br) {
        var rel = GG.clamp((b.x - pad.x) / (pad.w / 2), -1, 1);
        var a = rel * 1.05;
        b.vx = Math.sin(a) * speed; b.vy = -Math.cos(a) * speed;
        b.y = pad.y - br;
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
      br_purple: 'puzzle/brick_purple', br_grey: 'puzzle/brick_grey', paddle: 'puzzle/paddle', ball: 'puzzle/ball', star: 'puzzle/star' },
    start: function (d) {
      d0 = d;
      W = GG.W; H = GG.H;
      speed0 = H * [0.5, 0.65, 0.8][d];
      padW0 = W * [0.26, 0.2, 0.15][d];
      speed = speed0; lives = 3; level = 1; score = 0; drops = []; parts = []; wideT = 0; flashT = 1.2;
      br = Math.max(7, Math.min(W, H) * 0.014);
      pad = { x: W / 2, y: H - 80, w: padW0, h: Math.max(18, padW0 * 0.16) };
      buildLevel(); newBall();
      GG.setScore(0);
    },
    resize: function (w, h) {
      if (!pad) return;
      W = w; H = h; pad.y = H - 80; pad.x = GG.clamp(pad.x, 0, W);
    },
    update: function (dt) {
      if (GG.keys.ArrowLeft) pad.x -= W * 1.2 * dt;
      if (GG.keys.ArrowRight) pad.x += W * 1.2 * dt;
      pad.x = GG.clamp(pad.x, pad.w / 2, W - pad.w / 2);
      if (wideT > 0) { wideT -= dt; pad.w = GG.lerp(pad.w, padW0 * 1.6, 0.2); if (wideT <= 0) wideT = 0; }
      else pad.w = GG.lerp(pad.w, padW0, 0.2);
      if (flashT > 0) flashT -= dt;
      for (var i = balls.length - 1; i >= 0; i--) {
        var b = balls[i];
        if (b.stuck) { b.x = pad.x; b.y = pad.y - br - 2; continue; }
        stepBall(b, dt);
        if (balls[i] !== b) continue; // 過關時球被重設
        if (b.y > H + br * 2) balls.splice(i, 1);
      }
      if (!balls.length) {
        lives--; GG.sfx('hit');
        if (lives <= 0) { GG.over({ score: score, text: '打到第 ' + level + ' 關' }); return; }
        newBall();
      }
      for (i = drops.length - 1; i >= 0; i--) {
        var dp = drops[i];
        dp.y += H * 0.28 * dt;
        if (dp.y > pad.y - 10 && dp.y < pad.y + pad.h + 10 && Math.abs(dp.x - pad.x) < pad.w / 2 + 16) {
          GG.sfx('power');
          if (dp.kind === 'wide') wideT = 12;
          else if (dp.kind === 'life') lives = Math.min(5, lives + 1);
          else {
            var src = balls.filter(function (x) { return !x.stuck; })[0];
            if (src && balls.length < 12) {
              for (var k = -1; k <= 1; k += 2) {
                var a = Math.atan2(src.vx, -src.vy) + k * 0.45;
                balls.push({ x: src.x, y: src.y, vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed, stuck: false });
              }
            }
          }
          drops.splice(i, 1);
        } else if (dp.y > H + 20) drops.splice(i, 1);
      }
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.t -= dt; p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t <= 0) parts.splice(i, 1);
      }
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#3a2b8a', '#140c3d');
      ctx.globalAlpha = 0.12;
      for (var k = 0; k < 12; k++) GG.spr(ctx, 'star', (k * 197) % w, (k * 311) % h, 30 + (k % 3) * 14);
      ctx.globalAlpha = 1;
      for (var i = 0; i < bricks.length; i++) {
        var q = bricks[i];
        ctx.drawImage(GG.img['br_' + q.col], q.x, q.y, q.w, q.h);
      }
      for (i = 0; i < parts.length; i++) {
        var p = parts[i];
        GG.spr(ctx, 'star', p.x, p.y, 16, 16, { alpha: Math.max(0, p.t / 0.6), rot: p.t * 8 });
      }
      for (i = 0; i < drops.length; i++) {
        var dp = drops[i];
        var col = dp.kind === 'wide' ? '#29b6f6' : dp.kind === 'life' ? '#ff5c8a' : '#ffc61a';
        ctx.fillStyle = col; GG.rr(ctx, dp.x - 34, dp.y - 15, 68, 30, 15); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; GG.rr(ctx, dp.x - 34, dp.y - 15, 68, 30, 15); ctx.stroke();
        if (dp.kind === 'life') GG.spr(ctx, '_heart', dp.x, dp.y, 24, 24);
        else GG.text(ctx, dp.kind === 'wide' ? '變寬' : '分身', dp.x, dp.y + 1, 15, '#fff', 'center', true);
      }
      GG.spr(ctx, 'paddle', pad.x, pad.y + pad.h / 2, pad.w, pad.h * 1.4);
      for (i = 0; i < balls.length; i++) GG.spr(ctx, 'ball', balls[i].x, balls[i].y, br * 2.2, br * 2.2);
      for (i = 0; i < lives; i++) GG.spr(ctx, '_heart', 28 + i * 34, 32, 30, 30);
      GG.text(ctx, '第 ' + level + ' 關', w - 16, 32, 22, '#fff', 'right', true);
      if (balls.length && balls[0].stuck) GG.text(ctx, '點一下發球', w / 2, pad.y - 60, 26, '#fff', 'center', true);
      if (flashT > 0) { ctx.globalAlpha = Math.min(1, flashT); GG.text(ctx, '第 ' + level + ' 關', w / 2, h * 0.5, 56, '#ffd23f', 'center', true); ctx.globalAlpha = 1; }
    },
    down: function (p) { this.dragX = p.x; this.padX0 = pad.x; this.moved = false; },
    move: function (p) {
      if (Math.abs(p.x - this.dragX) > 6) this.moved = true;
      pad.x = this.padX0 + (p.x - this.dragX) * 1.3;
    },
    up: function () { launch(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') launch(); }
  });
})();
