/* 跳跳大冒險（無盡跑酷）：背景用 CSS 捲動層，主畫布只畫角色 */
(function () {
  // 關卡：跑越遠關卡越高，速度變快、出現新的障礙和獎勵
  var LV_AT = [0, 150, 350, 600, 900, 1300];
  var LV_MSG = ['', '新障礙：彈簧怪　新獎勵：紅蘿蔔', '新障礙：飛飛怪　新獎勵：金色紅蘿蔔', '新障礙：連續障礙　新獎勵：噴射背包',
    '速度變快！新獎勵：愛心', '最高速度！飛飛怪變多了'];
  var lvl, jet, jetT;
  var jumped, W, H, gy, S, T, p, obs, coins, speed, speed0, accel, dist, coinN, carrotN, nextGap, jumps, t, lives, inv, d0, deco;

  function reset() {
    W = GG.W; H = GG.H;
    S = Math.max(60, Math.min(H * 0.12, 112));
    T = Math.round(S * 0.8);
    gy = Math.round(H - T * 1.5);
  }
  function paintLayers() {
    var th = gy + Math.round(T * 0.35);
    GG.canvasLayer('sky').paint(function (g, w, h) { GG.bg(g, w, h, '#a6e4ff', '#e2f7ff'); });
    GG.scrollLayer('far').set('bunny/bg_layer2', 0, 0, W, th, th, th, 'repeat-x');
    GG.scrollLayer('mid').set('bunny/bg_layer3', 0, 0, W, th, th, th, 'repeat-x');
    GG.scrollLayer('near').set('bunny/bg_layer4', 0, 0, W, th, th, th, 'repeat-x');
    // 地面：草地頂 + 泥土，做成一片可以左右重複的圖
    var gh = H - gy;
    var tileC = GG.sprite(T, gh, function (g) {
      g.drawImage(GG.img.top, 0, 0, T, T);
      for (var y = T; y < gh; y += T) g.drawImage(GG.img.dirt, 0, y, T, T);
    });
    GG.scrollLayer('ground').set(tileC, 0, gy, W, gh, T, gh, 'repeat-x');
  }
  function spawnObstacle() {
    var x = W + 60;
    var flyChance = lvl < 3 ? 0 : (d0 === 0 ? 0.15 : 0.22) + (lvl - 3) * 0.06;
    if (Math.random() < flyChance) {
      var high = d0 === 0 || Math.random() < 0.5, wing = Math.random() < 0.6, fw = S * 0.95;
      obs.push({ anim: wing ? ['wingMan1', 'wingMan2', 'wingMan3', 'wingMan4'] : ['flyMan_fly', 'flyMan_still_fly'], x: x, w: fw, h: fw * 0.75,
        y: gy - (high ? S * 1.55 : S * 0.55) - fw * 0.75, f: 0, walk: 0.12, fly: true });
    } else {
      var n = lvl >= 4 && Math.random() < 0.15 + (lvl - 4) * 0.08 + d0 * 0.05 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var k = GG.pick(lvl >= 2 ? ['spike', 'spike', 'cactus', 'spring'] : ['spike', 'cactus']);
        var o = k === 'spike' ? { anim: ['spikeMan_walk1', 'spikeMan_walk2'], w: S * 0.75, h: S * 0.95, walk: 0.15 }
          : k === 'cactus' ? { img: 'cactus', w: S * 0.7, h: S * 0.8, walk: 0 } : { img: 'springMan_stand', w: S * 0.75, h: S * 0.8, walk: 0 };
        o.x = x + i * S; o.y = gy - o.h; o.f = Math.random() * 3;
        obs.push(o);
      }
    }
    if (Math.random() < 0.65) {
      var cy = gy - S * GG.rand(1.6, 2.4), cn = GG.randInt(3, 5), r = Math.random();
      // 中間那顆依關卡換成特別獎勵
      var special = lvl >= 3 && r < 0.1 ? 'gold' : lvl >= 2 && r < 0.35 ? 'carrot' : 'coin';
      for (var k2 = 0; k2 < cn; k2++) coins.push({ x: x + S * 2.3 + k2 * S * 0.75, y: cy - Math.sin(k2 / (cn - 1) * Math.PI) * S * 0.6, got: 0, kind: k2 === (cn >> 1) ? special : 'coin' });
    }
    if (lvl >= 4 && !jet && Math.random() < 0.07) coins.push({ x: x + S * 4, y: gy - S * 2, got: 0, kind: 'jet' });
    else if (lvl >= 5 && lives < 3 && Math.random() < 0.06) coins.push({ x: x + S * 4, y: gy - S * 2.2, got: 0, kind: 'heart' });
    if (Math.random() < 0.5) deco.push({ k: GG.pick(['grass1', 'grass2', 'mushroom_red', 'mushroom_brown']), x: x + S * GG.rand(3, 5) });
    nextGap = speed * GG.rand(1.1, 1.9) * (d0 === 0 ? 1.35 : 1) + S * 2.5;
  }
  function jump() {
    jumped = true;
    if (jet) return;
    if (p.onGround) { p.vy = -H * 1.25; p.onGround = false; jumps = 1; GG.sfx('jump'); }
    else if (jumps < 2) { p.vy = -H * 1.0; jumps = 2; GG.sfx('jump'); GG.burst(p.x + S / 2, p.y + S, { n: 5, colors: ['#fff'], size: 10, speed: 120, gravity: 0, life: 0.4 }); }
  }
  function score() { return Math.floor(dist / 10) + coinN * 5 + Math.round(carrotN * 20); }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { dist = LV_AT[Math.min(n, LV_AT.length) - 1] * 10 + 10; };

  GG.define({
    countdown: true,
    assets: {
      walk1: 'bunny/hero_walk1', walk2: 'bunny/hero_walk2', jump: 'bunny/hero_jump', hurt: 'bunny/hero_hurt', stand: 'bunny/hero_stand',
      spikeMan_walk1: 'bunny/spikeMan_walk1', spikeMan_walk2: 'bunny/spikeMan_walk2', springMan_stand: 'bunny/springMan_stand', cactus: 'bunny/cactus',
      wingMan1: 'bunny/wingMan1', wingMan2: 'bunny/wingMan2', wingMan3: 'bunny/wingMan3', wingMan4: 'bunny/wingMan4',
      flyMan_fly: 'bunny/flyMan_fly', flyMan_still_fly: 'bunny/flyMan_still_fly',
      carrotGold: 'bunny/carrot_gold', jetItem: 'bunny/jetpack_item', jetOn: 'bunny/jetpack',
      g1: 'bunny/gold_1', g2: 'bunny/gold_2', g3: 'bunny/gold_3', g4: 'bunny/gold_4', carrot: 'bunny/carrot',
      grass1: 'bunny/grass1', grass2: 'bunny/grass2', mushroom_red: 'bunny/mushroom_red', mushroom_brown: 'bunny/mushroom_brown',
      top: 'run/terrain_grass_block_top', dirt: 'run/terrain_grass_block_center'
    },
    start: function (d) {
      d0 = d;
      reset();
      speed0 = W * [0.3, 0.38, 0.48][d] + 150;
      accel = [3, 6, 10][d];
      speed = speed0; dist = 0; coinN = 0; carrotN = 0; t = 0; jumps = 0; lives = 3; inv = 0; jumped = false; lvl = 1; jet = 0; jetT = 0;
      p = { x: W * 0.16, y: gy - S, vy: 0, onGround: true };
      obs = []; coins = []; deco = []; nextGap = W * 0.7;
      paintLayers();
      GG.setScore(0);
    },
    resize: function () {
      reset();
      if (!p) return;
      p.x = W * 0.16; p.y = Math.min(p.y, gy - S); obs = []; coins = []; deco = [];
      paintLayers();
    },
    update: function (dt) {
      t += dt;
      // 升關
      var m = dist / 10;
      if (lvl < LV_AT.length && m >= LV_AT[lvl]) { lvl++; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]); }
      var cap = speed0 * (1 + (lvl - 1) * 0.14);
      speed = Math.min(cap, speed + accel * dt * 4);
      var dx = speed * dt * (jumped ? 1 : 0.7); // 還沒跳過之前放慢，讓小朋友先學會跳
      dist += dx; nextGap -= dx;
      if (nextGap <= 0) spawnObstacle();
      if (inv > 0) inv -= dt;
      if (jet > 0) {
        // 噴射背包：飛在空中、不怕障礙，空中會出現一排金幣
        jet -= dt; jetT -= dt; inv = Math.max(inv, 0.3);
        p.y = GG.lerp(p.y, gy - S * 3.2, Math.min(1, dt * 4)); p.vy = 0; p.onGround = false;
        if (jetT <= 0) { jetT = 0.18; coins.push({ x: W + 20, y: gy - S * 2.6, got: 0, kind: 'coin' }); }
        GG.burst(p.x + S * 0.2, p.y + S * 0.9, { n: 1, colors: ['#ffb347', '#fff3a0'], size: 10, speed: 80, gravity: 300, angle: Math.PI / 2, life: 0.4 });
        if (jet <= 0) { jet = 0; p.vy = 0; }
      } else {
        p.vy += H * 3.2 * dt; p.y += p.vy * dt;
      }
      if (p.y >= gy - S) { p.y = gy - S; p.vy = 0; if (!p.onGround) { p.onGround = true; jumps = 0; } }
      var hx = p.x + S * 0.25, hy = p.y + S * 0.25, hw = S * 0.5, hh = S * 0.7;
      for (var i = obs.length - 1; i >= 0; i--) {
        var o = obs[i];
        o.x -= dx + speed * o.walk * dt; o.f += dt * 8;
        if (o.x + o.w < -40) { obs.splice(i, 1); continue; }
        var m = o.w * 0.22;
        if (inv <= 0 && hx < o.x + o.w - m && hx + hw > o.x + m && hy < o.y + o.h - m * 0.5 && hy + hh > o.y + m) {
          lives--; inv = 1.6; GG.sfx('hurt'); GG.shake(10, 0.3);
          GG.burst(o.x + o.w / 2, o.y + o.h / 2, { n: 12, img: '_star', size: 20, speed: 300 });
          obs.splice(i, 1);
          if (lives <= 0) {
            var m2 = Math.floor(dist / 10), th = [[200, 500, 1000], [300, 700, 1300], [400, 900, 1600]][d0];
            GG.over({ score: score(), stars: GG.starsFor(m2, th[0], th[1], th[2]), text: '跑到第 ' + lvl + ' 關、' + m2 + ' 公尺，金幣 ' + coinN, delay: 900 });
            return;
          }
        }
      }
      for (i = coins.length - 1; i >= 0; i--) {
        var c = coins[i];
        c.x -= dx;
        if (c.got) { c.got += dt; c.y -= 260 * dt; if (c.got > 0.35) coins.splice(i, 1); continue; }
        if (c.x < -30) { coins.splice(i, 1); continue; }
        if (GG.dist(c.x, c.y, p.x + S / 2, p.y + S / 2) < S * 0.7) {
          c.got = 0.01;
          if (c.kind === 'carrot') { carrotN++; GG.sfx('power'); GG.floatText(c.x, c.y - 30, '+20', '#ff9a2f', 30); }
          else if (c.kind === 'gold') { carrotN += 2.5; GG.sfx('power'); GG.floatText(c.x, c.y - 30, '+50', '#ffe14d', 34); GG.burst(c.x, c.y, { n: 10, img: '_star', size: 22, speed: 260 }); }
          else if (c.kind === 'jet') { jet = 4; jetT = 0; GG.sfx('power'); GG.floatText(c.x, c.y - 30, '噴射背包！', '#fff', 30); }
          else if (c.kind === 'heart') { lives = Math.min(3, lives + 1); GG.sfx('power'); GG.floatText(c.x, c.y - 30, '+1 愛心', '#ff6b8a', 30); }
          else { coinN++; GG.sfx('coin'); }
        }
      }
      for (i = deco.length - 1; i >= 0; i--) { deco[i].x -= dx; if (deco[i].x < -S * 2) deco.splice(i, 1); }
      GG.scrollLayer('far').scroll(dist * 0.08, 0);
      GG.scrollLayer('mid').scroll(dist * 0.18, 0);
      GG.scrollLayer('near').scroll(dist * 0.35, 0);
      GG.scrollLayer('ground').scroll(dist, 0);
      GG.setScore(score());
    },
    draw: function (ctx, w, h) {
      deco.forEach(function (d) { GG.spr(ctx, d.k, d.x, gy - S * 0.3, S * 0.7, null); });
      var frame = Math.floor(t * 10) % 4 + 1;
      coins.forEach(function (c) {
        var o = c.got ? { alpha: Math.max(0, 1 - c.got / 0.35) } : null;
        if (c.kind === 'carrot' || c.kind === 'gold') GG.spr(ctx, c.kind === 'gold' ? 'carrotGold' : 'carrot', c.x, c.y, S * 0.7, null, o || { rot: Math.sin(t * 5) * 0.2 });
        else if (c.kind === 'jet') GG.spr(ctx, 'jetItem', c.x, c.y + Math.sin(t * 4) * 6, S * 0.7, null, o);
        else if (c.kind === 'heart') GG.spr(ctx, '_heart', c.x, c.y + Math.sin(t * 4) * 6, S * 0.6, S * 0.6, o);
        else { var gk = 'g' + frame, ch = S * 0.55; GG.spr(ctx, gk, c.x, c.y, ch / GG.ratio(gk), ch, o); }
      });
      obs.forEach(function (o) {
        var key = o.anim ? o.anim[Math.floor(o.f) % o.anim.length] : o.img;
        GG.spr(ctx, key, o.x + o.w / 2, o.y + o.h / 2, o.w * 1.15, null);
      });
      var shadow = GG.clamp(1 - (gy - S - p.y) / (H * 0.5), 0.3, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(p.x + S / 2, gy + 3, S * 0.32 * shadow, 6 * shadow, 0, 0, Math.PI * 2); ctx.fill();
      if (inv <= 0 || jet > 0 || Math.floor(inv * 10) % 2 === 0) {
        var key = inv > 1.2 ? 'hurt' : !p.onGround ? 'jump' : (Math.floor(t * 9) % 2 ? 'walk1' : 'walk2');
        var bh = S * 1.5;
        if (jet > 0) GG.spr(ctx, 'jetOn', p.x + S * 0.12, p.y + S - bh * 0.42, bh * 0.42, null);
        GG.spr(ctx, key, p.x + S / 2, p.y + S - bh / 2 + 4, bh * GG.ratio(key) === 0 ? bh : bh / GG.ratio(key), bh);
      }
      GG.lives(ctx, lives, 3, 14, 34, 34);
      GG.hudText(ctx, '第 ' + lvl + ' 關', w - 18, 34, 22, '#fff', 'right');
    }
    , hintAt: function () { return jumped ? false : { x: p.x + S * 1.6, y: p.y + S * 0.3, tip: '點畫面跳起來！' }; },
    down: function () { jump(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') jump(); }
  });
})();
