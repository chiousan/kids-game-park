/* 飛飛小飛機：點一下往上飛（背景與地面用 CSS 捲動） */
(function () {
  var W, H, gh, S, plane, rocks, stars, dist, nextX, score, passed, starN, lives, inv, d0, t, flying, gap, spacing;

  function layout() {
    W = GG.W; H = GG.H;
    gh = Math.round(Math.max(50, H * 0.09));
    S = Math.max(54, Math.min(W, H) * 0.09);
    var bh = H - gh + 10;
    GG.canvasLayer('sky').paint(function (g, w, h) { GG.bg(g, w, h, '#bfe9ff', '#f4fbff'); });
    GG.scrollLayer('far').set('plane/background', 0, 0, W, bh, Math.round(bh * 800 / 480), bh, 'repeat-x');
    GG.scrollLayer('ground').set('plane/groundGrass', 0, H - gh - 10, W, gh + 10, Math.round((gh + 10) * 808 / 71), gh + 10, 'repeat-x');
  }
  // 關卡：穿過越多岩石關卡越高，空隙變小、速度變快，出現新障礙與新獎勵
  var LV_AT = [0, 5, 12, 20, 30, 42];
  var LV_MSG = ['', '速度變快！新獎勵：愛心', '新障礙：會上下移動的岩石　新獎勵：防護泡泡', '新障礙：飛飛怪',
    '空隙變小了！新獎勵：大星星（+20）', '最高難度！'];
  var lvl = 1, shield = false, foes = [];
  function curGap() { return Math.max(H * 0.24, gap * (1 - (lvl - 1) * 0.05)); }
  function addRock(x) {
    var g = curGap(), minTop = H * 0.12, maxTop = H - gh - g - H * 0.1;
    var top = GG.rand(minTop, maxTop);
    var r = { x: x, top: top, top0: top, g: g, w: S * 1.25, passed: false, mv: lvl >= 3 && Math.random() < 0.4 ? Math.min(H * 0.09, (maxTop - minTop) / 2) : 0, ph: Math.random() * 6 };
    if (r.mv) r.top0 = GG.clamp(top, minTop + r.mv, maxTop - r.mv);
    rocks.push(r);
    var q = Math.random(), kind = lvl >= 2 && lives < 3 && q < 0.08 ? 'heart' : lvl >= 3 && !shield && q < 0.15 ? 'shield' : lvl >= 5 && q < 0.25 ? 'big' : 'star';
    if (kind !== 'star' || Math.random() < 0.7) stars.push({ x: x + S * 0.6, rock: r, got: 0, kind: kind });
    // 第 4 關起，岩石之間偶爾會有飛飛怪
    if (lvl >= 4 && Math.random() < 0.35) foes.push({ x: x + spacing / 2 + S, y0: GG.rand(H * 0.25, H - gh - H * 0.2), ph: Math.random() * 6, f: 0 });
  }
  function hurt() {
    if (inv > 0) return;
    if (shield) { shield = false; inv = 1; GG.sfx('hit'); GG.floatText(plane.x, plane.y - S, '防護泡泡擋住了！', '#9fe3ff', 26); return; }
    lives--; inv = 1.6; GG.sfx('hurt'); GG.shake(10, 0.3);
    GG.burst(plane.x, plane.y, { n: 12, img: 'puff', size: 26, speed: 220, gravity: -40 });
    if (lives <= 0) {
      var th = [[5, 12, 25], [5, 12, 22], [4, 10, 18]][d0];
      GG.over({ score: score, stars: GG.starsFor(passed, th[0], th[1], th[2]), text: '飛到第 ' + lvl + ' 關，穿過 ' + passed + ' 座岩石', delay: 800 });
    }
  }
  function flap() {
    if (lives <= 0) return;
    flying = true;
    plane.vy = -H * 0.6;
    GG.sfx('jump');
    GG.burst(plane.x - S * 0.5, plane.y + S * 0.2, { n: 2, img: 'puffS', size: 18, speed: 60, gravity: -20, life: 0.5, angle: Math.PI, spread: 0.6 });
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { passed = LV_AT[Math.min(n, LV_AT.length) - 1]; lvl = n; };

  GG.define({
    countdown: true,
    assets: { p1: 'plane/planeRed1', p2: 'plane/planeRed2', p3: 'plane/planeRed3', rock: 'plane/rockGrass', rockDown: 'plane/rockGrassDown',
      star: 'plane/starGold', puff: 'plane/puffLarge', puffS: 'plane/puffSmall', bubble: 'space/shield',
      wing1: 'bunny/wingMan1', wing2: 'bunny/wingMan2', wing3: 'bunny/wingMan3', wing4: 'bunny/wingMan4' },
    start: function (d) {
      d0 = d; layout();
      gap = H * [0.42, 0.35, 0.3][d];
      spacing = W * [0.7, 0.58, 0.5][d] + S * 2;
      plane = { x: W * 0.25, y: H * 0.45, vy: 0 };
      rocks = []; stars = []; foes = []; lvl = 1; shield = false; dist = 0; nextX = W * 0.9; score = 0; passed = 0; starN = 0; lives = 3; inv = 0; t = 0; flying = false;
      GG.setScore(0);
    },
    resize: function () { layout(); if (plane) { rocks = []; stars = []; nextX = W * 0.9; } },
    update: function (dt) {
      t += dt;
      if (inv > 0) inv -= dt;
      var spd = (W * [0.26, 0.32, 0.38][d0] + 60) * (1 + (lvl - 1) * 0.07);
      if (!flying) { plane.y = H * 0.45 + Math.sin(t * 3) * 12; }
      else {
        dist += spd * dt;
        plane.vy = Math.min(H * 0.9, plane.vy + H * 1.9 * dt);
        plane.y += plane.vy * dt;
        if (plane.y < S * 0.5) { plane.y = S * 0.5; plane.vy = 0; }
        if (plane.y > H - gh - S * 0.4) { plane.y = H - gh - S * 0.4; plane.vy = -H * 0.7; hurt(); }
        nextX -= spd * dt;
        if (nextX <= W + S) { addRock(W + S * 2); nextX += spacing; }
      }
      var pr = S * 0.32;
      for (var i = rocks.length - 1; i >= 0; i--) {
        var r = rocks[i];
        if (flying) r.x -= spd * dt;
        if (r.x + r.w < -20) { rocks.splice(i, 1); continue; }
        if (r.mv) r.top = r.top0 + Math.sin(t * 1.3 + r.ph) * r.mv;
        if (!r.passed && r.x + r.w < plane.x) {
          r.passed = true; passed++; score += 10; GG.sfx('coin');
          GG.setScore(score);
          if (lvl < LV_AT.length && passed >= LV_AT[lvl]) { lvl++; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]); }
        }
        // 岩石是尖的，碰撞範圍只算中間較粗的部分
        var inX = plane.x + pr > r.x + r.w * 0.25 && plane.x - pr < r.x + r.w * 0.75;
        if (inX && (plane.y - pr < r.top || plane.y + pr > r.top + r.g)) hurt();
      }
      for (i = stars.length - 1; i >= 0; i--) {
        var s = stars[i];
        if (flying) s.x -= spd * dt;
        s.y = s.rock.top + s.rock.g / 2;
        if (s.got) { s.got += dt; if (s.got > 0.35) stars.splice(i, 1); continue; }
        if (s.x < -30) { stars.splice(i, 1); continue; }
        if (GG.dist(s.x, s.y, plane.x, plane.y) < S * 0.65) {
          s.got = 0.01; GG.sfx('power');
          if (s.kind === 'heart') { lives = Math.min(3, lives + 1); GG.floatText(s.x, s.y - 30, '+1 愛心', '#ff6b8a', 28); }
          else if (s.kind === 'shield') { shield = true; GG.floatText(s.x, s.y - 30, '防護泡泡！', '#9fe3ff', 28); }
          else { var pts = s.kind === 'big' ? 20 : 5; starN++; score += pts; GG.setScore(score); if (pts > 5) GG.floatText(s.x, s.y - 30, '+20', '#ffe14d', 30); }
          GG.burst(s.x, s.y, { n: 6, img: 'star', size: 16, speed: 200 });
        }
      }
      for (i = foes.length - 1; i >= 0; i--) {
        var f = foes[i];
        if (flying) f.x -= spd * dt * 1.15;
        f.ph += dt * 2.5; f.f += dt * 10;
        f.y = f.y0 + Math.sin(f.ph) * H * 0.08;
        if (f.x < -S) { foes.splice(i, 1); continue; }
        if (GG.dist(f.x, f.y, plane.x, plane.y) < S * 0.45) { hurt(); GG.burst(f.x, f.y, { n: 8, img: 'puff', size: 22, speed: 200, gravity: -40 }); foes.splice(i, 1); }
      }
      GG.scrollLayer('far').scroll(dist * 0.25, 0);
      GG.scrollLayer('ground').scroll(dist, 0);
    },
    draw: function (ctx, w, h) {
      rocks.forEach(function (r) {
        var bottomY = r.top + r.g, groundY = h - gh;
        GG.spr(ctx, 'rockDown', r.x + r.w / 2, r.top / 2, r.w, r.top + 4);
        GG.spr(ctx, 'rock', r.x + r.w / 2, (bottomY + groundY) / 2 + 6, r.w, groundY - bottomY + 12);
      });
      stars.forEach(function (s) {
        var key = s.kind === 'heart' ? '_heart' : s.kind === 'shield' ? 'bubble' : 'star', sz = S * (s.kind === 'big' || s.kind === 'heart' || s.kind === 'shield' ? 0.9 : 0.6);
        GG.spr(ctx, key, s.x, s.y + Math.sin(t * 4 + s.x * 0.01) * 6, sz, sz, s.got ? { alpha: 1 - s.got / 0.35, sx: 1 + s.got * 2, sy: 1 + s.got * 2 } : null);
      });
      foes.forEach(function (f) {
        // 深色底圈讓白翅膀在淺色天空上也看得清楚
        ctx.fillStyle = 'rgba(58,56,80,0.32)'; ctx.beginPath(); ctx.arc(f.x, f.y, S * 0.62, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,90,90,0.9)'; ctx.stroke();
        GG.spr(ctx, 'wing' + (Math.floor(f.f) % 4 + 1), f.x, f.y, S * 1.6, null, { flip: true });
      });
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0)
        GG.spr(ctx, 'p' + (Math.floor(t * 18) % 3 + 1), plane.x, plane.y, S * 1.2, null, { rot: GG.clamp(plane.vy / H * 0.9, -0.5, 0.7) });
      if (shield) GG.spr(ctx, 'bubble', plane.x, plane.y, S * 1.7, S * 1.7, { alpha: 0.7 });
      GG.lives(ctx, lives, 3, 12, 30, 30);
      GG.hudText(ctx, '第 ' + lvl + ' 關', w - 18, 30, 22, '#fff', 'right');
      if (!flying && lives > 0) GG.text(ctx, '點畫面起飛！', w / 2, h * 0.24, 32, '#fff', 'center', true);
    },
    hintAt: function () { return { x: plane.x + S * 1.6, y: plane.y + S * 0.4, tip: '點一下往上飛', ty: plane.y - S * 1.4 }; },
    down: function () { flap(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') flap(); }
  });
})();
