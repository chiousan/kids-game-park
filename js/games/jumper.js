/* 跳跳兔：踩著雲台一直往上跳（世界座標往上為負，攝影機跟著兔兔） */
(function () {
  var W, H, G, V, pw, ph, bun, plats, items, clouds, camY, topY, best, lives, inv, d0, t, moveDir, jet, carrotN, coinN;

  function layout() {
    W = GG.W; H = GG.H;
    G = H * 1.8; V = H * 1.3;
    pw = Math.min(W * 0.26, 190); ph = pw * 0.36;
    GG.canvasLayer('sky').paint(function (g, w, h) {
      GG.bg(g, w, h, '#8fdcff', '#fff0f6');
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (var k = 0; k < 6; k++) { var x = (k * 263) % w, y = (k * 149) % h; g.beginPath(); g.arc(x, y, 30, 0, 7); g.arc(x + 30, y + 6, 24, 0, 7); g.arc(x - 30, y + 8, 22, 0, 7); g.fill(); }
    });
  }
  function addPlat(y) {
    var lvl = Math.min(1, -y / (H * 40));
    var r = Math.random(), kind = 'grass';
    if (r < [0.12, 0.22, 0.3][d0] + lvl * 0.1) kind = 'move';
    else if (d0 > 0 && r > 1 - ([0, 0.08, 0.14][d0] + lvl * 0.06)) kind = 'break';
    var p = { x: GG.rand(pw / 2 + 6, W - pw / 2 - 6), y: y, kind: kind, vx: kind === 'move' ? GG.pick([-1, 1]) * W * GG.rand(0.12, 0.22) : 0, broken: 0 };
    plats.push(p);
    if (kind === 'grass') {
      var q = Math.random();
      if (q < 0.1) items.push({ kind: 'spring', p: p, dx: GG.rand(-pw * 0.25, pw * 0.25), used: 0 });
      else if (q < 0.13 && -y > H * 3) items.push({ kind: 'jet', x: p.x, y: y - ph * 1.4 });
      else if (q < 0.45) items.push({ kind: Math.random() < 0.25 ? 'carrot' : 'coin', x: p.x, y: y - ph * 1.6 });
    }
    return p;
  }
  function fill() {
    var gapMin = H * [0.11, 0.13, 0.15][d0], gapMax = H * [0.2, 0.26, 0.31][d0];
    while (topY > camY - H) {
      var lvl = Math.min(1, -topY / (H * 40));
      topY -= GG.rand(gapMin, gapMin + (gapMax - gapMin) * (0.5 + lvl * 0.5));
      addPlat(topY);
    }
  }
  function hurt() {
    lives--; inv = 1.5; GG.sfx('hurt'); GG.shake(10, 0.3);
    if (lives <= 0) {
      var m = Math.floor(best / (H * 0.1)), th = [[30, 80, 150], [40, 100, 200], [50, 120, 250]][d0];
      GG.over({ score: m * 10 + coinN * 5 + carrotN * 20, stars: GG.starsFor(m, th[0], th[1], th[2]), text: '跳到 ' + m + ' 公尺高', delay: 600 });
      return;
    }
    // 救援：在兔兔下方放一片雲台，再彈起來
    var p = { x: GG.clamp(bun.x, pw / 2 + 6, W - pw / 2 - 6), y: camY + H * 0.75, kind: 'grass', vx: 0, broken: 0, rescue: 1 };
    plats.push(p);
    bun.y = p.y - ph * 0.5; bun.vy = -V;
    GG.floatText(bun.x, bun.y - camY - 60, '救援雲台！', '#fff', 30);
  }

  GG.define({
    countdown: true,
    assets: { jump: 'bunny/bunny2_jump', stand: 'bunny/bunny2_stand', ready: 'bunny/bunny2_ready', hurt: 'bunny/bunny2_hurt',
      grass: 'bunny/ground_grass_small', move: 'bunny/ground_snow_small', brk: 'bunny/ground_cake_small',
      spring: 'bunny/spring', springOut: 'bunny/spring_out', jet: 'bunny/jetpack_item', jetOn: 'bunny/jetpack', carrot: 'bunny/carrot',
      g1: 'bunny/gold_1', g2: 'bunny/gold_2', g3: 'bunny/gold_3', g4: 'bunny/gold_4', cloud: 'bunny/cloud' },
    start: function (d) {
      d0 = d; layout();
      plats = []; items = []; camY = -H; best = 0; lives = 3; inv = 0; t = 0; moveDir = 0; jet = 0; carrotN = 0; coinN = 0;
      var base = { x: W / 2, y: -H * 0.12, kind: 'grass', vx: 0, broken: 0 };
      plats.push(base); topY = base.y;
      bun = { x: W / 2, y: base.y - ph * 0.5, vx: 0, vy: -V, face: 1, startY: base.y };
      fill();
      clouds = [];
      for (var i = 0; i < 4; i++) clouds.push({ x: Math.random() * W, y: Math.random() * H, s: GG.rand(0.6, 1) });
      GG.setScore(0);
    },
    resize: function () { layout(); },
    update: function (dt) {
      t += dt;
      if (inv > 0) inv -= dt;
      var k = GG.keys, dir = moveDir || ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0));
      bun.vx = GG.lerp(bun.vx, dir * W * 0.85, Math.min(1, dt * 10));
      if (dir) bun.face = dir;
      bun.x += bun.vx * dt;
      if (bun.x < -20) bun.x += W + 40; else if (bun.x > W + 20) bun.x -= W + 40;
      if (jet > 0) { jet -= dt; bun.vy = -V * 1.4; GG.burst(bun.x, bun.y - camY + 10, { n: 1, colors: ['#ffb347', '#fff3a0'], size: 10, speed: 80, gravity: 300, angle: Math.PI / 2, life: 0.4 }); }
      else bun.vy += G * dt;
      var oldY = bun.y;
      bun.y += bun.vy * dt;
      // 只有往下掉的時候才會踩到雲台
      if (bun.vy > 0 && jet <= 0) {
        for (var i = 0; i < plats.length; i++) {
          var p = plats[i];
          if (p.broken) continue;
          var topP = p.y - ph * 0.35;
          if (oldY <= topP && bun.y >= topP && Math.abs(bun.x - p.x) < pw * 0.55) {
            if (p.kind === 'break') { p.broken = 0.01; GG.sfx('hit'); continue; }
            bun.y = topP; bun.vy = -V; GG.sfx('jump');
            for (var si = 0; si < items.length; si++) {
              var sp = items[si];
              if (sp.kind === 'spring' && sp.p === p && Math.abs(bun.x - (p.x + sp.dx)) < 42) {
                bun.vy = -V * 1.6; sp.used = 0.4; GG.sfx('power');
                GG.floatText(bun.x, topP - camY - 60, '彈簧！', '#fff', 28);
              }
            }
            GG.burst(bun.x, topP - camY, { n: 4, colors: ['#ffffff'], size: 8, speed: 100, gravity: 0, life: 0.3 });
            break;
          }
        }
      }
      for (i = plats.length - 1; i >= 0; i--) {
        p = plats[i];
        if (p.vx) { p.x += p.vx * dt; if (p.x < pw / 2 || p.x > W - pw / 2) p.vx = -p.vx; }
        if (p.broken) p.broken += dt;
        if (p.y > camY + H + 100 || p.broken > 0.6) plats.splice(i, 1);
      }
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        var ix = it.p ? it.p.x + it.dx : it.x, iy = it.p ? it.p.y - ph * 0.5 : it.y;
        if (iy > camY + H + 100 || (it.p && plats.indexOf(it.p) < 0)) { items.splice(i, 1); continue; }
        if (it.got) continue;
        if (Math.abs(bun.x - ix) < 40 && Math.abs(bun.y - 20 - iy) < 50) {
          if (it.kind === 'spring') { /* 彈簧在踩到雲台時處理 */ }
          else if (it.kind === 'jet') { jet = 2.5; it.got = 1; items.splice(i, 1); GG.sfx('power'); GG.floatText(ix, iy - camY - 30, '噴射背包！', '#fff', 30); }
          else if (it.kind === 'coin') { coinN++; items.splice(i, 1); GG.sfx('coin'); }
          else if (it.kind === 'carrot') { carrotN++; items.splice(i, 1); GG.sfx('power'); GG.floatText(ix, iy - camY - 30, '+20', '#ff9a2f', 28); }
        }
        if (it.used) it.used = Math.max(0, it.used - dt);
      }
      // 攝影機只往上跟
      var target = bun.y - H * 0.45;
      if (target < camY) camY = target;
      best = Math.max(best, bun.startY - bun.y);
      fill();
      if (bun.y > camY + H + 40 && inv <= 0) hurt();
      GG.setScore(Math.floor(best / (H * 0.1)) * 10 + coinN * 5 + carrotN * 20);
    },
    draw: function (ctx, w, h) {
      clouds.forEach(function (c) {
        var y = ((c.y - camY * 0.3) % (h + 200) + h + 200) % (h + 200) - 100;
        GG.spr(ctx, 'cloud', c.x, y, 140 * c.s, null, { alpha: 0.85 });
      });
      var frame = Math.floor(t * 10) % 4 + 1;
      plats.forEach(function (p) {
        var y = p.y - camY;
        if (y < -60 || y > h + 60) return;
        var key = p.kind === 'move' ? 'move' : p.kind === 'break' ? 'brk' : 'grass';
        GG.spr(ctx, key, p.x, y + (p.broken ? p.broken * 200 : 0), pw, ph, p.broken ? { alpha: 1 - p.broken / 0.6, rot: p.broken * 1.5 } : null);
      });
      items.forEach(function (it) {
        var ix = it.p ? it.p.x + it.dx : it.x, iy = (it.p ? it.p.y - ph * 0.5 : it.y) - camY;
        if (iy < -60 || iy > h + 60) return;
        if (it.kind === 'spring') GG.spr(ctx, it.used ? 'springOut' : 'spring', ix, iy - 10, 46, null);
        else if (it.kind === 'jet') GG.spr(ctx, 'jet', ix, iy, 46, null, { rot: Math.sin(t * 4) * 0.2 });
        else if (it.kind === 'carrot') GG.spr(ctx, 'carrot', ix, iy, 44, null, { rot: Math.sin(t * 5) * 0.2 });
        else GG.spr(ctx, 'g' + frame, ix, iy, 36, 36);
      });
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0) {
        var key = inv > 1.1 ? 'hurt' : bun.vy < 0 ? 'jump' : 'ready', bh = Math.min(110, h * 0.11);
        if (jet > 0) GG.spr(ctx, 'jetOn', bun.x - bun.face * bh * 0.2, bun.y - camY - bh * 0.4, bh * 0.5, null);
        GG.spr(ctx, key, bun.x, bun.y - camY - bh / 2 + 4, bh / GG.ratio(key), bh, bun.face < 0 ? { flip: true } : null);
      }
      GG.lives(ctx, lives, 3, 12, 30, 30);
      GG.text(ctx, Math.floor(best / (h * 0.1)) + ' 公尺', w - 14, 30, 22, '#fff', 'right', true);
      if (t < 3) GG.text(ctx, '按住左邊或右邊移動', w / 2, h * 0.88, 24, '#fff', 'center', true);
    },
    down: function (p) { this.tid = p.id; moveDir = p.x < GG.W / 2 ? -1 : 1; },
    move: function (p) { if (p.id === this.tid) moveDir = p.x < GG.W / 2 ? -1 : 1; },
    up: function (p) { if (p.id === this.tid) moveDir = 0; }
  });
})();
