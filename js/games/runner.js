/* 跳跳大冒險（無盡跑酷） */
(function () {
  var W, H, gy, S, T, p, obs, coins, speed, speed0, accel, dist, coinN, nextGap, jumps, t, dead, deco;

  var GROUND = [
    { k: 'cactus', w: 0.9, h: 0.9 }, { k: 'rock', w: 0.85, h: 0.8 },
    { k: 'snail', w: 0.95, h: 0.75, walk: 0.15, anim: ['snail_walk_a', 'snail_walk_b'] },
    { k: 'slime', w: 0.85, h: 0.6, walk: 0.25, anim: ['slime_normal_walk_a', 'slime_normal_walk_b'] },
    { k: 'spike', w: 0.85, h: 0.75, walk: 0.2, anim: ['slime_spike_walk_a', 'slime_spike_walk_b'] }
  ];

  function reset() {
    W = GG.W; H = GG.H;
    S = Math.max(56, Math.min(H * 0.12, 110));
    T = Math.round(S * 0.8);
    gy = Math.round(H - T * 1.6);
  }
  function spawnObstacle() {
    var x = W + 60, r = Math.random();
    var lvl = Math.min(1, dist / 6000);
    if (r < 0.22 + lvl * 0.1 && dist > 800) {
      var high = Math.random() < 0.5, bee = Math.random() < 0.5;
      var bw = S * 0.75;
      obs.push({ kind: 'fly', anim: bee ? ['bee_a', 'bee_b'] : ['fly_a', 'fly_b'], x: x, w: bw, h: bw * 0.85,
        y: gy - (high ? S * 1.3 : S * 0.5) - bw * 0.85, f: 0, walk: 0.15 });
    } else {
      var n = Math.random() < 0.2 + lvl * 0.25 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var g = GG.pick(GROUND);
        var ow = S * g.w, oh = S * g.h;
        obs.push({ kind: g.k, img: g.k, anim: g.anim, walk: g.walk || 0, x: x + i * S * 0.95, w: ow, h: oh, y: gy - oh, f: Math.random() * 3 });
      }
    }
    if (Math.random() < 0.6) {
      var cy = gy - S * GG.rand(1.7, 2.6), cn = GG.randInt(3, 5);
      for (var k = 0; k < cn; k++) coins.push({ x: x + S * 2.2 + k * S * 0.7, y: cy - Math.sin(k / (cn - 1) * Math.PI) * S * 0.6, got: 0 });
    }
    if (Math.random() < 0.5) deco.push({ k: GG.pick(['bush', 'grass', 'mushroom_red', 'fence']), x: x + S * GG.rand(3, 5) });
    nextGap = speed * GG.rand(0.9, 1.7) + S * 2.2;
  }
  function jump() {
    if (dead) return;
    if (p.onGround) { p.vy = -H * 1.3; p.onGround = false; jumps = 1; GG.sfx('jump'); }
    else if (jumps < 2) { p.vy = -H * 1.05; jumps = 2; GG.sfx('jump'); }
  }

  GG.define({
    assets: {
      walk_a: 'run/p_walk_a', walk_b: 'run/p_walk_b', jump: 'run/p_jump', hit: 'run/p_hit',
      cactus: 'run/cactus', rock: 'run/rock', bush: 'run/bush', grass: 'run/grass', mushroom_red: 'run/mushroom_red', fence: 'run/fence',
      snail_walk_a: 'run/snail_walk_a', snail_walk_b: 'run/snail_walk_b',
      slime_normal_walk_a: 'run/slime_normal_walk_a', slime_normal_walk_b: 'run/slime_normal_walk_b',
      slime_spike_walk_a: 'run/slime_spike_walk_a', slime_spike_walk_b: 'run/slime_spike_walk_b',
      bee_a: 'run/bee_a', bee_b: 'run/bee_b', fly_a: 'run/fly_a', fly_b: 'run/fly_b',
      top: 'run/terrain_grass_block_top', dirt: 'run/terrain_grass_block_center',
      sky: 'run/background_color_hills', clouds: 'run/background_clouds'
    },
    start: function (d) {
      reset();
      speed0 = W * [0.38, 0.5, 0.65][d] + 200;
      accel = [6, 10, 16][d];
      speed = speed0; dist = 0; coinN = 0; t = 0; dead = false; jumps = 0;
      p = { x: W * 0.16, y: gy - S, vy: 0, onGround: true };
      obs = []; coins = []; deco = []; nextGap = W * 0.6;
      GG.setScore(0);
    },
    resize: function () {
      if (!p) return;
      var oldGy = gy;
      reset();
      p.x = W * 0.16;
      var dy = gy - oldGy;
      p.y += dy; obs.forEach(function (o) { o.y += dy; }); coins.forEach(function (c) { c.y += dy; });
    },
    update: function (dt) {
      t += dt;
      if (dead) return;
      speed += accel * dt;
      var dx = speed * dt;
      dist += dx;
      nextGap -= dx;
      if (nextGap <= 0) spawnObstacle();
      p.vy += H * 3.4 * dt;
      p.y += p.vy * dt;
      if (p.y >= gy - S) { p.y = gy - S; p.vy = 0; if (!p.onGround) { p.onGround = true; jumps = 0; } }
      var hx = p.x + S * 0.22, hy = p.y + S * 0.2, hw = S * 0.56, hh = S * 0.75;
      for (var i = obs.length - 1; i >= 0; i--) {
        var o = obs[i];
        o.x -= dx + speed * o.walk * dt;
        o.f += dt * 7;
        if (o.x + o.w < -40) { obs.splice(i, 1); continue; }
        var m = o.w * 0.18;
        if (hx < o.x + o.w - m && hx + hw > o.x + m && hy < o.y + o.h - m * 0.5 && hy + hh > o.y + m) {
          dead = true; GG.sfx('hit');
          var sc = Math.floor(dist / 10) + coinN * 10;
          GG.over({ score: sc, text: '跑了 ' + Math.floor(dist / 10) + ' 公尺，撿到 ' + coinN + ' 枚金幣', delay: 900 });
          return;
        }
      }
      for (i = coins.length - 1; i >= 0; i--) {
        var c = coins[i];
        c.x -= dx;
        if (c.got) { c.got += dt; c.y -= 220 * dt; if (c.got > 0.4) coins.splice(i, 1); continue; }
        if (c.x < -30) { coins.splice(i, 1); continue; }
        if (GG.dist(c.x, c.y, p.x + S / 2, p.y + S / 2) < S * 0.62) { c.got = 0.01; coinN++; GG.sfx('coin'); }
      }
      for (i = deco.length - 1; i >= 0; i--) { deco[i].x -= dx; if (deco[i].x < -S * 2) deco.splice(i, 1); }
      GG.setScore(Math.floor(dist / 10) + coinN * 10);
    },
    draw: function (ctx, w, h) {
      // 遠景：Kenney 山丘背景平鋪，慢速捲動做出景深
      ctx.fillStyle = '#d0f4f7'; ctx.fillRect(0, 0, w, h);
      var bgS = gy + T * 0.2;
      GG.tile(ctx, 'sky', 0, 0, w, bgS, bgS, -dist * 0.15, 0);
      GG.tile(ctx, 'clouds', 0, 0, w, bgS * 0.5, bgS * 0.5, -dist * 0.05 - t * 12, 0);
      deco.forEach(function (d) { GG.spr(ctx, d.k, d.x, gy - S * 0.35, S * 0.75, S * 0.75); });
      // 地面
      GG.tile(ctx, 'top', 0, gy, w, T, T, -dist, 0);
      GG.tile(ctx, 'dirt', 0, gy + T, w, h - gy - T, T, -dist, 0);
      coins.forEach(function (c) {
        var squish = Math.max(0.15, Math.abs(Math.cos(t * 5 + c.x * 0.02)));
        GG.spr(ctx, '_coin', c.x, c.y, S * 0.6 * squish, S * 0.6, c.got ? { alpha: Math.max(0, 1 - c.got / 0.4) } : null);
      });
      obs.forEach(function (o) {
        var key = o.anim ? o.anim[Math.floor(o.f) % 2] : o.img;
        GG.spr(ctx, key, o.x + o.w / 2, o.y + o.h / 2 - o.h * 0.08, o.w * 1.25, o.w * 1.25);
      });
      // 主角
      var key = dead ? 'hit' : (!p.onGround ? 'jump' : (Math.floor(t * 9) % 2 ? 'walk_a' : 'walk_b'));
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      var shadow = GG.clamp(1 - (gy - S - p.y) / (H * 0.5), 0.3, 1);
      ctx.beginPath(); ctx.ellipse(p.x + S / 2, gy + 3, S * 0.32 * shadow, 6 * shadow, 0, 0, Math.PI * 2); ctx.fill();
      GG.spr(ctx, key, p.x + S / 2, p.y + S / 2 - S * 0.06, S * 1.3, S * 1.3,
        !p.onGround && !dead ? { rot: GG.clamp(p.vy / H * 0.2, -0.25, 0.25) } : null);
      if (t < 2.5 && !dead) GG.text(ctx, '點畫面跳躍・空中再點一次二段跳', w / 2, gy + T * 0.8, 22, '#fff', 'center', true);
    },
    down: function () { jump(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') jump(); }
  });
})();
