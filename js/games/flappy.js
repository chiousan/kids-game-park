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
  function addRock(x) {
    var minTop = H * 0.12, maxTop = H - gh - gap - H * 0.1;
    var top = GG.rand(minTop, maxTop);
    rocks.push({ x: x, top: top, w: S * 1.25, passed: false });
    if (Math.random() < 0.7) stars.push({ x: x + S * 0.6, y: top + gap / 2, got: 0 });
  }
  function hurt() {
    if (inv > 0) return;
    lives--; inv = 1.6; GG.sfx('hurt'); GG.shake(10, 0.3);
    GG.burst(plane.x, plane.y, { n: 12, img: 'puff', size: 26, speed: 220, gravity: -40 });
    if (lives <= 0) {
      var th = [[5, 12, 25], [5, 12, 22], [4, 10, 18]][d0];
      GG.over({ score: score, stars: GG.starsFor(passed, th[0], th[1], th[2]), text: '穿過 ' + passed + ' 座岩石、收集 ' + starN + ' 顆星星', delay: 800 });
    }
  }
  function flap() {
    if (lives <= 0) return;
    flying = true;
    plane.vy = -H * 0.6;
    GG.sfx('jump');
    GG.burst(plane.x - S * 0.5, plane.y + S * 0.2, { n: 2, img: 'puffS', size: 18, speed: 60, gravity: -20, life: 0.5, angle: Math.PI, spread: 0.6 });
  }

  GG.define({
    countdown: true,
    assets: { p1: 'plane/planeRed1', p2: 'plane/planeRed2', p3: 'plane/planeRed3', rock: 'plane/rockGrass', rockDown: 'plane/rockGrassDown',
      star: 'plane/starGold', puff: 'plane/puffLarge', puffS: 'plane/puffSmall' },
    start: function (d) {
      d0 = d; layout();
      gap = H * [0.42, 0.35, 0.3][d];
      spacing = W * [0.7, 0.58, 0.5][d] + S * 2;
      plane = { x: W * 0.25, y: H * 0.45, vy: 0 };
      rocks = []; stars = []; dist = 0; nextX = W * 0.9; score = 0; passed = 0; starN = 0; lives = 3; inv = 0; t = 0; flying = false;
      GG.setScore(0);
    },
    resize: function () { layout(); if (plane) { rocks = []; stars = []; nextX = W * 0.9; } },
    update: function (dt) {
      t += dt;
      if (inv > 0) inv -= dt;
      var spd = W * [0.26, 0.32, 0.38][d0] + 60;
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
        if (!r.passed && r.x + r.w < plane.x) {
          r.passed = true; passed++; score += 10; GG.sfx('coin');
          GG.setScore(score);
        }
        // 岩石是尖的，碰撞範圍只算中間較粗的部分
        var inX = plane.x + pr > r.x + r.w * 0.25 && plane.x - pr < r.x + r.w * 0.75;
        if (inX && (plane.y - pr < r.top || plane.y + pr > r.top + gap)) hurt();
      }
      for (i = stars.length - 1; i >= 0; i--) {
        var s = stars[i];
        if (flying) s.x -= spd * dt;
        if (s.got) { s.got += dt; if (s.got > 0.35) stars.splice(i, 1); continue; }
        if (s.x < -30) { stars.splice(i, 1); continue; }
        if (GG.dist(s.x, s.y, plane.x, plane.y) < S * 0.65) {
          s.got = 0.01; starN++; score += 5; GG.setScore(score); GG.sfx('power');
          GG.burst(s.x, s.y, { n: 6, img: 'star', size: 16, speed: 200 });
        }
      }
      GG.scrollLayer('far').scroll(dist * 0.25, 0);
      GG.scrollLayer('ground').scroll(dist, 0);
    },
    draw: function (ctx, w, h) {
      rocks.forEach(function (r) {
        var bottomY = r.top + gap, groundY = h - gh;
        GG.spr(ctx, 'rockDown', r.x + r.w / 2, r.top / 2, r.w, r.top + 4);
        GG.spr(ctx, 'rock', r.x + r.w / 2, (bottomY + groundY) / 2 + 6, r.w, groundY - bottomY + 12);
      });
      stars.forEach(function (s) {
        GG.spr(ctx, 'star', s.x, s.y + Math.sin(t * 4 + s.x * 0.01) * 6, S * 0.6, S * 0.6, s.got ? { alpha: 1 - s.got / 0.35, sx: 1 + s.got * 2, sy: 1 + s.got * 2 } : null);
      });
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0)
        GG.spr(ctx, 'p' + (Math.floor(t * 18) % 3 + 1), plane.x, plane.y, S * 1.2, null, { rot: GG.clamp(plane.vy / H * 0.9, -0.5, 0.7) });
      GG.lives(ctx, lives, 3, 12, 30, 30);
      if (!flying && lives > 0) GG.text(ctx, '點畫面起飛！', w / 2, h * 0.3, 32, '#fff', 'center', true);
    },
    down: function () { flap(); },
    key: function (k) { if (k === ' ' || k === 'ArrowUp') flap(); }
  });
})();
