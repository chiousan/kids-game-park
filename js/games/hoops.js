/* 投籃高手：像彈弓一樣往後拉再放開投籃（背景圖層只畫一次） */
(function () {
  var W, H, floorY, G, ball, hoop, aim, score, made, timeLeft, totalT, streak, d0, netT, guide, t;

  function layout() {
    W = GG.W; H = GG.H; floorY = H * 0.86; G = H * 1.7;
    GG.canvasLayer('bg').paint(function (g, w, h) {
      GG.bg(g, w, floorY, '#9ee0ff', '#dff5ff');
      GG.tile(g, 'bg', 0, 0, w, floorY, floorY, 0, 0);
      g.fillStyle = '#e8a35c'; g.fillRect(0, floorY, w, h - floorY);
      g.fillStyle = '#d58c45';
      for (var x = 0; x < w; x += 70) g.fillRect(x, floorY, 4, h - floorY);
      g.fillStyle = GG.INK; g.fillRect(0, floorY - 2, w, 5);
    });
  }
  function newBall() {
    var r = Math.max(22, Math.min(W, H) * 0.045), far = d0 === 0 ? 0.32 : 0.45;
    ball = { x: W * GG.rand(0.1, far), y: floorY - r - GG.rand(0, H * 0.22), r: r, vx: 0, vy: 0, flying: false, rot: 0, life: 0, touched: false, scored: false };
    ball.x0 = ball.x;
  }
  function launchVel(p) {
    var dx = aim.x - p.x, dy = aim.y - p.y, len = Math.sqrt(dx * dx + dy * dy), max = Math.min(W, H) * 0.42;
    if (len > max) { dx *= max / len; dy *= max / len; }
    var k = Math.sqrt(G * W) / (Math.min(W, H) * 0.3);
    return { vx: dx * k, vy: dy * k, len: Math.min(len, max) };
  }

  GG.define({
    assets: { ball: 'sport/basketball', bg: 'run/background_color_trees' },
    start: function (d) {
      d0 = d; layout();
      totalT = [90, 75, 60][d];
      guide = [32, 18, 7][d];
      timeLeft = totalT; score = 0; made = 0; streak = 0; netT = 0; t = 0;
      hoop = { x: W * 0.8, y: H * 0.42, rw: Math.max(84, Math.min(W, H) * 0.17), base: H * 0.42, ph: 0 };
      newBall();
      GG.setScore(0);
    },
    resize: function () {
      layout();
      if (!hoop) return;
      hoop.x = W * 0.8; hoop.base = hoop.y = H * 0.42; hoop.rw = Math.max(84, Math.min(W, H) * 0.17);
      newBall();
    },
    update: function (dt) {
      t += dt; timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        var th = [[4, 8, 14], [5, 10, 16], [5, 10, 15]][d0];
        GG.over({ score: score, win: true, stars: GG.starsFor(made, th[0], th[1], th[2]), title: '時間到！', text: '投進了 ' + made + ' 球' });
        return;
      }
      if (d0 === 2) { hoop.ph += dt * 1.1; hoop.y = hoop.base + Math.sin(hoop.ph) * H * 0.1; }
      if (netT > 0) netT -= dt;
      if (!ball.flying) return;
      var steps = 4, sdt = dt / steps, b = ball;
      for (var s = 0; s < steps; s++) {
        var py = b.y;
        b.vy += G * sdt; b.x += b.vx * sdt; b.y += b.vy * sdt; b.rot += b.vx * sdt * 0.02;
        [hoop.x - hoop.rw / 2, hoop.x + hoop.rw / 2].forEach(function (qx) {
          var dx = b.x - qx, dy = b.y - hoop.y, dd = Math.sqrt(dx * dx + dy * dy), min = b.r + 4;
          if (dd < min && dd > 0) {
            var nx = dx / dd, ny = dy / dd, dot = b.vx * nx + b.vy * ny;
            b.x = qx + nx * min; b.y = hoop.y + ny * min;
            if (dot < 0) { b.vx -= 1.6 * dot * nx; b.vy -= 1.6 * dot * ny; GG.sfx('bounce'); }
            b.touched = true;
          }
        });
        var bbX = hoop.x + hoop.rw / 2 + 8, bbTop = hoop.y - hoop.rw * 1.15, bbBot = hoop.y + hoop.rw * 0.25;
        if (b.vx > 0 && b.x + b.r > bbX && b.x < bbX + 12 && b.y > bbTop && b.y < bbBot) { b.x = bbX - b.r; b.vx = -b.vx * 0.55; b.touched = true; GG.sfx('bounce'); }
        if (!b.scored && py < hoop.y && b.y >= hoop.y && b.x > hoop.x - hoop.rw / 2 + b.r * 0.2 && b.x < hoop.x + hoop.rw / 2 - b.r * 0.2) {
          b.scored = true; streak++; made++;
          var pts = ((hoop.x - b.x0) > W * 0.5 ? 3 : 2) + (b.touched ? 0 : 1);
          score += pts; GG.setScore(score); netT = 0.5;
          GG.floatText(hoop.x, hoop.y - hoop.rw, (!b.touched ? '空心！' : '進球！') + ' +' + pts, '#ffe14d', 32);
          GG.burst(hoop.x, hoop.y + 20, { n: 14, img: '_star', size: 22, speed: 300 });
          if (streak >= 3) { timeLeft = Math.min(totalT, timeLeft + 3); GG.floatText(W / 2, H * 0.25, '連進 ' + streak + ' 球！時間 +3', '#fff', 30); }
          GG.sfx('goal');
        }
        if (b.y + b.r > floorY) { b.y = floorY - b.r; b.vy = -b.vy * 0.55; b.vx *= 0.8; if (Math.abs(b.vy) > 80) GG.sfx('bounce'); }
      }
      b.life += dt;
      if (b.x < -b.r * 3 || b.x > W + b.r * 3 || b.life > 3 || (b.scored && b.life > 1.6)) { if (!b.scored) streak = 0; newBall(); }
    },
    draw: function (ctx, w, h) {
      var bbX = hoop.x + hoop.rw / 2 + 8, bbTop = hoop.y - hoop.rw * 1.15, bbH = hoop.rw * 1.4;
      ctx.fillStyle = '#7d8597'; ctx.fillRect(bbX + 14, bbTop + bbH * 0.5, 14, floorY - bbTop - bbH * 0.5);
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 3; ctx.strokeRect(bbX + 14, bbTop + bbH * 0.5, 14, floorY - bbTop - bbH * 0.5);
      ctx.fillStyle = '#fff'; GG.rr(ctx, bbX, bbTop, 14, bbH, 4); ctx.fill();
      ctx.lineWidth = 3.5; ctx.strokeStyle = GG.INK; GG.rr(ctx, bbX, bbTop, 14, bbH, 4); ctx.stroke();
      if (aim && !ball.flying && aim.cur) {
        var v = launchVel(aim.cur), n = guide;
        for (var i = 1; i <= n; i++) {
          var tt = i * 0.05, gx = ball.x + v.vx * tt, gy = ball.y + v.vy * tt + 0.5 * G * tt * tt;
          ctx.fillStyle = 'rgba(255,255,255,' + (1 - i / (n + 1)) + ')';
          ctx.beginPath(); ctx.arc(gx, gy, 6, 0, Math.PI * 2); ctx.fill();
        }
        var pw = v.len / (Math.min(W, H) * 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; GG.rr(ctx, ball.x - 40, ball.y + ball.r + 14, 80, 12, 6); ctx.fill();
        ctx.fillStyle = pw > 0.8 ? '#ff5252' : '#43d17a'; GG.rr(ctx, ball.x - 40, ball.y + ball.r + 14, 80 * pw, 12, 6); ctx.fill();
      }
      var rx = hoop.x - hoop.rw / 2, rw = hoop.rw, ny = hoop.y, nh = rw * 0.75 * (1 + (netT > 0 ? Math.sin(netT * 20) * 0.15 : 0));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (var k = 0; k <= 6; k++) { ctx.moveTo(rx + rw * k / 6, ny); ctx.lineTo(rx + rw * 0.2 + rw * 0.6 * k / 6, ny + nh); }
      for (var j = 1; j <= 3; j++) { var yy = ny + nh * j / 3, sh = rw * 0.2 * j / 3; ctx.moveTo(rx + sh, yy); ctx.lineTo(rx + rw - sh, yy); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(ball.x, floorY + 3, ball.r * 0.9, ball.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      GG.spr(ctx, 'ball', ball.x, ball.y, ball.r * 2, ball.r * 2, { rot: ball.rot });
      ctx.lineCap = 'round';
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(rx, ny); ctx.lineTo(rx + rw, ny); ctx.stroke();
      ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(rx, ny); ctx.lineTo(rx + rw, ny); ctx.stroke();
      GG.text(ctx, Math.ceil(timeLeft) + ' 秒', w / 2, 34, 30, timeLeft < 10 ? '#ff5252' : '#fff', 'center', true);
      if (t < 3 && !ball.flying) GG.text(ctx, '手指往後拉，放開就投籃！', w / 2, floorY + (h - floorY) / 2, 24, '#fff', 'center', true);
    },
    down: function (p) { if (!ball.flying) aim = { x: p.x, y: p.y, cur: p }; },
    move: function (p) { if (aim) aim.cur = p; },
    up: function (p) {
      if (!aim || ball.flying) { aim = null; return; }
      var v = launchVel(p);
      aim = null;
      if (v.len < 25) return;
      ball.vx = v.vx; ball.vy = v.vy; ball.flying = true; ball.life = 0;
      GG.sfx('jump');
    }
  });
})();
