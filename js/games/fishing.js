/* 釣魚樂：點水裡的魚，小船開過去放下魚鉤 */
(function () {
  var W, H, waterY, sandY, boat, hook, fish, score, caught, timeLeft, totalT, spawnT, d0, t;
  // lv：第幾關開始出現。bad＝會扣分的障礙魚；time＝時間泡泡；gold＝黃金魚
  var TYPES = [
    { k: 'fish_blue', pts: 10, s: 1, sp: 1, lv: 1, w: 3 }, { k: 'fish_green', pts: 10, s: 1, sp: 1, lv: 1, w: 3 }, { k: 'fish_orange', pts: 15, s: 0.9, sp: 1.2, lv: 1, w: 2 },
    { k: 'fish_pink', pts: 20, s: 0.8, sp: 1.4, lv: 2, w: 2 }, { k: 'fish_red', pts: 25, s: 1.1, sp: 1.1, lv: 2, w: 2 }, { k: 'fish_brown', pts: -15, s: 1, sp: 0.8, bad: true, lv: 2, w: 1.2 },
    { k: 'fish_grey', pts: 30, s: 1.5, sp: 0.7, lv: 3, w: 1.5 }, { k: 'fish_skeleton', pts: -10, s: 1, sp: 1.3, bad: true, lv: 3, w: 1.2 }, { k: 'bubble', pts: 0, s: 0.9, sp: 0.6, time: true, lv: 3, w: 0.8 },
    { k: 'fish_orange', pts: 60, s: 1.05, sp: 1.7, gold: true, lv: 4, w: 0.6 }
  ];
  var LV_MSG = ['', '新魚：粉紅魚、紅魚　新障礙：河豚（扣分）', '新魚：大灰魚（+30）　新障礙：骨頭魚　新獎勵：時間泡泡 +5 秒', '魚游更快了！新獎勵：黃金魚（+60）'];
  var lvl = 1, el = 0;

  function layout() {
    W = GG.W; H = GG.H;
    waterY = H * 0.2; sandY = H * 0.88;
    GG.canvasLayer('bg').paint(function (g, w, h) {
      GG.bg(g, w, waterY, '#9fe3ff', '#e4f8ff');
      g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(w * 0.85, waterY * 0.45, waterY * 0.25, 0, 7); g.fill();
      var gr = g.createLinearGradient(0, waterY, 0, h);
      gr.addColorStop(0, '#4fc8ea'); gr.addColorStop(1, '#1d6fb0');
      g.fillStyle = gr; g.fillRect(0, waterY, w, h - waterY);
      g.globalAlpha = 0.5;
      ['background_seaweed_a', 'background_seaweed_c', 'background_rock_a', 'background_seaweed_e', 'background_rock_b'].forEach(function (k, i) {
        GG.spr(g, k, (i + 0.5) * w / 5, sandY - 50, 120, 120);
      });
      g.globalAlpha = 1;
      GG.tile(g, 'sandTop', 0, sandY - 10, w, 64, 64, 0, 0);
      GG.tile(g, 'sand', 0, sandY + 54, w, h - sandY, 64, 0, 0);
      ['seaweed_green_a', 'seaweed_pink_a', 'rock_a', 'seaweed_orange_a', 'seaweed_green_c', 'rock_b', 'seaweed_grass_a'].forEach(function (k, i) {
        GG.spr(g, k, ((i * 0.15 + 0.07) % 1) * w, sandY - 20, 70, null);
      });
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4;
      g.beginPath();
      for (var x = 0; x <= w; x += 20) g.lineTo(x, waterY + Math.sin(x * 0.05) * 4);
      g.stroke();
    });
  }
  function spawnFish() {
    var pool = TYPES.filter(function (q) { return q.lv <= lvl && !(d0 === 0 && q.bad && lvl < 3); }), sum = 0, r;
    pool.forEach(function (q) { sum += q.w; });
    r = Math.random() * sum;
    var ty = pool[0];
    for (var n = 0; n < pool.length; n++) { r -= pool[n].w; if (r <= 0) { ty = pool[n]; break; } }
    var dir = Math.random() < 0.5 ? 1 : -1, size = Math.min(W, H) * 0.16 * ty.s;
    fish.push({ ty: ty, x: dir > 0 ? -size : W + size, y: GG.rand(waterY + H * 0.12, sandY - size * 0.6), dir: dir, size: size,
      sp: W * [0.08, 0.12, 0.16][d0] * ty.sp * GG.rand(0.8, 1.2) * (1 + (lvl - 1) * 0.15), ph: Math.random() * 6, hooked: false });
  }
  function hookPos() { return { x: boat.x + 50, y: hook.y }; }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { el = (n - 1) * totalT / 4 + 0.1; };

  GG.define({
    countdown: true,
    assets: { boatman: 'blob/yellow_smile', bubble: 'fish/bubble_a', sand: 'fish/terrain_sand_a', sandTop: 'fish/terrain_sand_top_a',
      fish_blue: 'fish/fish_blue', fish_green: 'fish/fish_green', fish_orange: 'fish/fish_orange', fish_pink: 'fish/fish_pink', fish_red: 'fish/fish_red',
      fish_grey: 'fish/fish_grey', fish_skeleton: 'fish/fish_skeleton', fish_brown: 'fish/fish_brown',
      background_seaweed_a: 'fish/background_seaweed_a', background_seaweed_c: 'fish/background_seaweed_c', background_seaweed_e: 'fish/background_seaweed_e',
      background_rock_a: 'fish/background_rock_a', background_rock_b: 'fish/background_rock_b',
      seaweed_green_a: 'fish/seaweed_green_a', seaweed_green_c: 'fish/seaweed_green_c', seaweed_pink_a: 'fish/seaweed_pink_a',
      seaweed_orange_a: 'fish/seaweed_orange_a', seaweed_grass_a: 'fish/seaweed_grass_a', rock_a: 'fish/rock_a', rock_b: 'fish/rock_b' },
    start: function (d) {
      d0 = d; layout();
      totalT = [75, 60, 50][d]; timeLeft = totalT; lvl = 1; el = 0; score = 0; caught = 0; spawnT = 0; t = 0;
      boat = { x: W / 2, tx: W / 2 };
      hook = { st: 'idle', y: waterY - 10, ty: 0, fish: null };
      fish = [];
      for (var i = 0; i < 6; i++) { spawnFish(); fish[i].x = GG.rand(W * 0.1, W * 0.9); }
      GG.setScore(0);
    },
    resize: function () { layout(); if (boat) { boat.x = boat.tx = W / 2; hook.st = 'idle'; hook.y = waterY - 10; } },
    update: function (dt) {
      t += dt; timeLeft -= dt; el += dt;
      var nl = Math.min(4, 1 + Math.floor(el / (totalT / 4)));
      if (nl > lvl) { lvl = nl; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]); }
      if (timeLeft <= 0) {
        timeLeft = 0;
        var th = [[100, 220, 350], [120, 260, 400], [120, 260, 400]][d0];
        GG.over({ score: score, win: true, stars: GG.starsFor(score, th[0], th[1], th[2]), title: '時間到！', text: '釣到 ' + caught + ' 條魚' });
        return;
      }
      spawnT -= dt;
      if (spawnT <= 0 && fish.length < [8, 9, 10][d0]) { spawnFish(); spawnT = GG.rand(0.6, 1.3); }
      boat.x = GG.lerp(boat.x, boat.tx, Math.min(1, dt * 8));
      var hr = Math.min(W, H) * [0.07, 0.055, 0.045][d0];
      if (hook.st === 'move' && Math.abs(boat.x - boat.tx) < 6) hook.st = 'drop';
      if (hook.st === 'drop') {
        hook.y += H * 1.1 * dt;
        for (var i = 0; i < fish.length; i++) {
          var f = fish[i];
          if (!f.hooked && Math.abs(f.x - (boat.x + 50)) < f.size * 0.5 + hr && Math.abs(f.y - hook.y) < f.size * 0.3 + hr) {
            f.hooked = true; hook.fish = f; hook.st = 'reel'; GG.sfx('splash');
            GG.burst(f.x, f.y, { n: 6, img: 'bubble', size: 16, speed: 120, gravity: -200, life: 0.8 });
            break;
          }
        }
        if (hook.st === 'drop' && hook.y >= hook.ty) hook.st = 'reel';
      } else if (hook.st === 'reel') {
        hook.y -= H * (hook.fish ? 0.75 : 1.2) * dt;
        if (hook.fish) { hook.fish.x = boat.x + 50; hook.fish.y = hook.y + hook.fish.size * 0.3; }
        if (hook.y <= waterY - 10) {
          hook.y = waterY - 10; hook.st = 'idle';
          if (hook.fish) {
            var f2 = hook.fish, pts = f2.ty.pts;
            if (f2.ty.time) { timeLeft += 5; GG.sfx('power'); GG.floatText(boat.x, waterY - 70, '+5 秒', '#9fe3ff', 34); fish.splice(fish.indexOf(f2), 1); hook.fish = null; return; }
            score = Math.max(0, score + pts); GG.setScore(score);
            if (pts > 0) { caught++; GG.sfx('coin'); GG.burst(boat.x, waterY - 40, { n: 10, img: '_star', size: 22, speed: 280 }); }
            else { GG.sfx('hurt'); GG.shake(8, 0.25); }
            GG.floatText(boat.x, waterY - 70, (pts > 0 ? '+' : '') + pts, pts > 0 ? '#ffe14d' : '#ff6b6b', 34);
            fish.splice(fish.indexOf(f2), 1);
            hook.fish = null;
          }
        }
      }
      for (i = fish.length - 1; i >= 0; i--) {
        f = fish[i];
        if (f.hooked) continue;
        f.x += f.dir * f.sp * dt; f.ph += dt * 3;
        if (f.x < -f.size * 2 || f.x > W + f.size * 2) fish.splice(i, 1);
      }
      if (Math.random() < dt * 2) GG.burst(GG.rand(0, W), sandY - 20, { n: 1, img: 'bubble', size: GG.rand(8, 16), speed: 20, gravity: -120, life: 2.5 });
    },
    draw: function (ctx, w) {
      fish.forEach(function (f) {
        var wob = f.hooked ? Math.sin(t * 30) * 0.3 : 0;
        if (f.ty.gold) { ctx.fillStyle = 'rgba(255,225,77,' + (0.4 + Math.sin(t * 8) * 0.15) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * 0.6, 0, Math.PI * 2); ctx.fill(); }
        if (f.ty.time) {
          GG.spr(ctx, 'bubble', f.x, f.y + Math.sin(f.ph) * 6, f.size, f.size);
          GG.text(ctx, '+5秒', f.x, f.y + Math.sin(f.ph) * 6, f.size * 0.26, '#2a6fd6');
          return;
        }
        GG.spr(ctx, f.ty.k, f.x, f.y + (f.hooked ? 0 : Math.sin(f.ph) * 6), f.size, null, { flip: f.dir < 0, rot: f.hooked ? -Math.PI / 2 + wob : 0 });
      });
      // 釣線與魚鉤
      var bx = boat.x, rodX = bx + 50, hp = hookPos();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rodX, waterY - 70); ctx.lineTo(rodX, hp.y); ctx.stroke();
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(rodX - 6, hp.y + 4, 8, 0, Math.PI); ctx.stroke();
      // 小船
      var by = waterY - 8 + Math.sin(t * 2) * 3;
      GG.spr(ctx, 'boatman', bx, by - 52, 74, 74);
      ctx.strokeStyle = '#8d5a2b'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(bx + 18, by - 40); ctx.lineTo(rodX, waterY - 70); ctx.stroke();
      ctx.fillStyle = '#c96f3b'; ctx.beginPath();
      ctx.moveTo(bx - 70, by - 22); ctx.lineTo(bx + 70, by - 22); ctx.lineTo(bx + 50, by + 10); ctx.lineTo(bx - 50, by + 10); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; ctx.stroke();
      ctx.fillStyle = '#ffd166'; ctx.fillRect(bx - 66, by - 22, 132, 8);
      GG.hudText(ctx, Math.ceil(timeLeft) + ' 秒', 22, 30, 26, timeLeft < 10 ? '#ff6b6b' : '#fff', 'left');
      GG.hudText(ctx, '第 ' + lvl + ' 關', w - 18, 30, 22, '#fff', 'right');
    },
    hintAt: function () {
      if (caught > 0 || hook.st !== 'idle') return false;
      var f = null;
      for (var i = 0; i < fish.length; i++) if (!fish[i].ty.bad && fish[i].x > W * 0.15 && fish[i].x < W * 0.85) { f = fish[i]; break; }
      return f ? { x: f.x, y: f.y, tip: '點水裡的魚，小船會去釣！', ty: f.y - f.size * 0.9 } : false;
    },
    down: function (p) {
      if (hook.st !== 'idle') return;
      boat.tx = GG.clamp(p.x - 50, 80, W - 80);
      hook.ty = GG.clamp(p.y + 20, waterY + 40, sandY - 10);
      hook.st = 'move';
      GG.sfx('click');
    }
  });
})();
