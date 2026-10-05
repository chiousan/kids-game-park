/* 太空射擊：星空背景用 CSS 捲動層 */
(function () {
  var W, H, S, ship, bullets, ebullets, enemies, items, booms, score, lives, maxLives, kills, fireT, spawnT, dd, inv, power, shield, boss, bossNext, t;

  function spawnEnemy() {
    var kind = Math.random() < 0.15 + dd * 0.1 ? 'shooter' : (Math.random() < 0.2 ? 'rock' : 'basic');
    var x = GG.rand(S, W - S);
    enemies.push({
      kind: kind, img: kind === 'shooter' ? 'enemy3' : kind === 'rock' ? GG.pick(['meteor1', 'meteor2']) : GG.pick(['enemy1', 'enemy2', 'enemy4']),
      spin: GG.rand(-2, 2), rot: 0, hitT: 0,
      x: x, x0: x, y: -S, hp: kind === 'shooter' ? 2 : kind === 'rock' ? 2 : 1, r: S * (kind === 'rock' ? 0.5 : 0.42),
      vy: H * GG.rand(0.08, 0.12) * (1 + dd * 0.2), amp: GG.rand(0, W * 0.1), ph: Math.random() * 6, fire: GG.rand(1.5, 3)
    });
  }
  function boom(x, y, big) {
    booms.push({ x: x, y: y, t: 0, big: big });
    GG.burst(x, y, { n: big ? 18 : 7, colors: ['#ffb347', '#fff3a0', '#ff6b6b'], size: big ? 14 : 9, speed: big ? 380 : 220, gravity: 0 });
    GG.sfx(big ? 'boom' : 'pop');
  }
  function hurt() {
    if (inv > 0) return;
    if (shield) { shield = false; inv = 1; GG.sfx('hit'); return; }
    lives--; inv = 2.2; GG.sfx('hurt'); GG.shake(10, 0.3);
    boom(ship.x, ship.y, false);
    if (lives <= 0) {
      boom(ship.x, ship.y, true);
      GG.over({ score: score, stars: GG.starsFor(kills, 15, 35, 60), text: '打倒了 ' + kills + ' 架敵機', delay: 900 });
    }
  }
  function drop(x, y) { if (Math.random() < 0.18) items.push({ x: x, y: y, kind: GG.pick(['power', 'power', 'shield', 'life']) }); }

  GG.define({
    countdown: true,
    assets: { ship: 'space/ship', enemy1: 'space/enemy1', enemy2: 'space/enemy2', enemy3: 'space/enemy3', enemy4: 'space/enemy4',
      boss: 'space/boss', laser: 'space/laser', elaser: 'space/elaser', pw_power: 'space/pw_power', pw_shield: 'space/pw_shield',
      pw_life: 'space/pw_life', shield: 'space/shield', fire: 'space/fire', meteor1: 'space/meteor1', meteor2: 'space/meteor2' },
    start: function (d) {
      dd = d; W = GG.W; H = GG.H; S = Math.max(44, Math.min(W, H) * 0.08);
      ship = { x: W / 2, y: H - S * 2 };
      bullets = []; ebullets = []; enemies = []; items = []; booms = [];
      maxLives = [5, 4, 3][d];
      score = 0; lives = maxLives; kills = 0; fireT = 0; spawnT = 1.5; inv = 1.5; power = 0; shield = false; boss = null; bossNext = 30; t = 0;
      this.resize(W, H);
      GG.setScore(0);
    },
    resize: function (w, h) {
      GG.scrollLayer('stars').set('space/bg', 0, 0, w, h, 256, 256);
      if (!ship) return;
      W = w; H = h; ship.x = GG.clamp(ship.x, S / 2, W - S / 2); ship.y = GG.clamp(ship.y, S, H - S);
    },
    update: function (dt) {
      t += dt;
      if (lives <= 0) return;
      GG.scrollLayer('stars').scroll(0, -t * 50);
      var kx = (GG.keys.ArrowRight ? 1 : 0) - (GG.keys.ArrowLeft ? 1 : 0), ky = (GG.keys.ArrowDown ? 1 : 0) - (GG.keys.ArrowUp ? 1 : 0);
      ship.x = GG.clamp(ship.x + kx * W * dt, S / 2, W - S / 2);
      ship.y = GG.clamp(ship.y + ky * W * dt, S, H - S * 0.6);
      if (inv > 0) inv -= dt;
      if (power > 0) power -= dt;
      fireT -= dt;
      if (fireT <= 0) {
        fireT = power > 0 ? 0.13 : 0.18;
        if (power > 0) bullets.push({ x: ship.x - S * 0.28, y: ship.y - S * 0.4, vx: -50 }, { x: ship.x + S * 0.28, y: ship.y - S * 0.4, vx: 50 }, { x: ship.x, y: ship.y - S * 0.5, vx: 0 });
        else bullets.push({ x: ship.x, y: ship.y - S * 0.5, vx: 0 });
        GG.sfx('shoot');
      }
      var i, j, b, e;
      for (i = bullets.length - 1; i >= 0; i--) { b = bullets[i]; b.y -= H * 1.3 * dt; b.x += b.vx * dt; if (b.y < -20) bullets.splice(i, 1); }
      if (!boss) {
        spawnT -= dt;
        if (spawnT <= 0) { spawnEnemy(); spawnT = GG.rand(0.8, 1.5) / (1 + dd * 0.3 + Math.min(0.8, t / 150)); }
        if (kills >= bossNext) {
          boss = { x: W / 2, y: -S * 2, r: S * 1.1, hp: 15 + dd * 10, max: 15 + dd * 10, dir: 1, fire: 2, enter: true, hitT: 0 };
          bossNext += 35; GG.sfx('power'); GG.floatText(W / 2, H * 0.4, '魔王出現了！', '#ff6b6b', 44);
        }
      }
      for (i = enemies.length - 1; i >= 0; i--) {
        e = enemies[i];
        e.y += e.vy * dt; e.ph += dt * 1.6; e.rot += e.spin * dt;
        if (e.hitT > 0) e.hitT -= dt;
        if (e.kind !== 'rock') e.x = GG.clamp(e.x0 + Math.sin(e.ph) * e.amp, e.r, W - e.r);
        if (e.kind === 'shooter') {
          e.fire -= dt;
          if (e.fire <= 0 && e.y > 0 && e.y < H * 0.6) {
            e.fire = GG.rand(2, 3.5) / (1 + dd * 0.25);
            var a = Math.atan2(ship.y - e.y, ship.x - e.x), sp = H * (0.25 + dd * 0.06);
            ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
          }
        }
        if (e.y > H + S) { enemies.splice(i, 1); continue; }
        if (GG.dist(e.x, e.y, ship.x, ship.y) < e.r + S * 0.28) { boom(e.x, e.y, false); enemies.splice(i, 1); hurt(); continue; }
        for (j = bullets.length - 1; j >= 0; j--) {
          b = bullets[j];
          if (Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) {
            bullets.splice(j, 1); e.hp--; e.hitT = 0.08;
            if (e.hp <= 0) {
              boom(e.x, e.y, false); drop(e.x, e.y);
              var pts = e.kind === 'basic' ? 10 : 20;
              score += pts; kills++; GG.setScore(score); GG.floatText(e.x, e.y, '+' + pts, '#fff', 22);
              enemies.splice(i, 1);
            }
            break;
          }
        }
      }
      if (boss) {
        if (boss.hitT > 0) boss.hitT -= dt;
        if (boss.enter) { boss.y += H * 0.15 * dt; if (boss.y >= H * 0.18) boss.enter = false; }
        else {
          boss.x += boss.dir * W * 0.15 * (1 + dd * 0.2) * dt;
          if (boss.x < boss.r || boss.x > W - boss.r) boss.dir *= -1;
          boss.fire -= dt;
          if (boss.fire <= 0) {
            boss.fire = 2.2 - dd * 0.4;
            var n = 3 + dd * 2;
            for (var k = 0; k < n; k++) {
              var ang = Math.PI / 2 + (k - (n - 1) / 2) * 0.28, spd = H * 0.25;
              ebullets.push({ x: boss.x, y: boss.y + boss.r * 0.5, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd });
            }
          }
        }
        for (j = bullets.length - 1; j >= 0; j--) {
          b = bullets[j];
          if (GG.dist(b.x, b.y, boss.x, boss.y) < boss.r) {
            bullets.splice(j, 1); boss.hp--; boss.hitT = 0.06;
            if (boss.hp <= 0) {
              boom(boss.x, boss.y, true); boom(boss.x - boss.r * 0.5, boss.y, true); boom(boss.x + boss.r * 0.5, boss.y + 10, true);
              GG.shake(14, 0.5);
              score += 300; GG.setScore(score); GG.floatText(boss.x, boss.y, '+300', '#ffe14d', 40);
              items.push({ x: boss.x, y: boss.y, kind: 'life' }, { x: boss.x + 40, y: boss.y, kind: 'power' });
              boss = null; GG.sfx('win');
              break;
            }
          }
        }
        if (boss && GG.dist(boss.x, boss.y, ship.x, ship.y) < boss.r + S * 0.28) hurt();
      }
      for (i = ebullets.length - 1; i >= 0; i--) {
        b = ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) { ebullets.splice(i, 1); continue; }
        if (GG.dist(b.x, b.y, ship.x, ship.y) < S * 0.28) { ebullets.splice(i, 1); hurt(); }
      }
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i]; it.y += H * 0.16 * dt;
        if (it.y > H + 30) { items.splice(i, 1); continue; }
        if (GG.dist(it.x, it.y, ship.x, ship.y) < S * 0.9) {
          if (it.kind === 'power') power = 12; else if (it.kind === 'shield') shield = true; else lives = Math.min(maxLives + 1, lives + 1);
          GG.sfx('power'); GG.floatText(it.x, it.y - 30, { power: '火力加強！', shield: '防護罩！', life: '+1 命' }[it.kind], '#fff', 26);
          items.splice(i, 1);
        }
      }
      for (i = booms.length - 1; i >= 0; i--) { booms[i].t += dt; if (booms[i].t > 0.4) booms.splice(i, 1); }
    },
    draw: function (ctx, w, h) {
      for (var i = 0; i < bullets.length; i++) GG.spr(ctx, 'laser', bullets[i].x, bullets[i].y, S * 0.13, S * 0.5);
      enemies.forEach(function (e) { GG.spr(ctx, e.img, e.x, e.y, e.r * 2.2, null, (e.kind === 'rock' || e.hitT > 0) ? { rot: e.rot, alpha: e.hitT > 0 ? 0.5 : 1 } : null); });
      if (boss) {
        GG.spr(ctx, 'boss', boss.x, boss.y, boss.r * 2.1, boss.r * 2.1, { rot: t * 1.5, alpha: boss.hitT > 0 ? 0.6 : 1 });
        var bw = Math.min(300, w * 0.6);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; GG.rr(ctx, (w - bw) / 2, 14, bw, 18, 9); ctx.fill();
        ctx.fillStyle = '#ff5252'; GG.rr(ctx, (w - bw) / 2, 14, Math.max(18, bw * boss.hp / boss.max), 18, 9); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; GG.rr(ctx, (w - bw) / 2, 14, bw, 18, 9); ctx.stroke();
      }
      for (i = 0; i < ebullets.length; i++) GG.spr(ctx, 'elaser', ebullets[i].x, ebullets[i].y, 24, 24);
      items.forEach(function (it) { GG.spr(ctx, 'pw_' + it.kind, it.x, it.y, S * 0.75, null); });
      booms.forEach(function (b) {
        var k = b.t / 0.4, r = (b.big ? S * 1.6 : S * 0.8) * GG.ease(k);
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff3a0';
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (lives > 0 && (inv <= 0 || Math.floor(inv * 10) % 2 === 0)) {
        GG.spr(ctx, 'fire', ship.x, ship.y + S * 0.62, S * 0.22, S * (0.45 + Math.sin(t * 40) * 0.08));
        GG.spr(ctx, 'ship', ship.x, ship.y, S * 1.1, null);
        if (shield) GG.spr(ctx, 'shield', ship.x, ship.y, S * 1.7, S * 1.7, { alpha: 0.85 });
      }
      GG.lives(ctx, lives, Math.max(maxLives, lives), 12, h - 30, 30);
      if (power > 0) GG.text(ctx, '火力 ' + Math.ceil(power), w - 14, h - 30, 20, '#ffd23f', 'right', true);
    },
    down: function (p) { this.d = { x: p.x, y: p.y, sx: ship.x, sy: ship.y }; },
    move: function (p) {
      if (!this.d) return;
      ship.x = GG.clamp(this.d.sx + (p.x - this.d.x) * 1.25, S / 2, W - S / 2);
      ship.y = GG.clamp(this.d.sy + (p.y - this.d.y) * 1.25, S, H - S * 0.6);
    },
    up: function () { this.d = null; }
  });
})();
