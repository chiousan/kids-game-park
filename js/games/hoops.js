/* 投籃高手：像彈弓一樣往後拉再放開投籃 */
(function () {
  var W, H, floorY, G, ball, hoop, aim, score, timeLeft, totalT, streak, d0, msgs, netT, guide, t;

  function layout() {
    W = GG.W; H = GG.H;
    floorY = H * 0.86;
    G = H * 1.7;
  }
  function newBall() {
    var r = Math.max(20, Math.min(W, H) * 0.042);
    var far = d0 === 0 ? 0.35 : 0.48;
    ball = { x: W * GG.rand(0.1, far), y: floorY - r - GG.rand(0, H * 0.25), r: r, vx: 0, vy: 0, flying: false, rot: 0, life: 0, touched: false, scored: false };
    ball.x0 = ball.x; ball.y0 = ball.y;
  }
  function rimPts() {
    return [{ x: hoop.x - hoop.rw / 2, y: hoop.y }, { x: hoop.x + hoop.rw / 2, y: hoop.y }];
  }
  function launchVel(p) {
    var dx = aim.x - p.x, dy = aim.y - p.y;
    var len = Math.sqrt(dx * dx + dy * dy), max = Math.min(W, H) * 0.42;
    if (len > max) { dx *= max / len; dy *= max / len; }
    var k = Math.sqrt(G * W) / (Math.min(W, H) * 0.3);
    return { vx: dx * k, vy: dy * k, len: Math.min(len, max) };
  }

  GG.define({
    assets: { ball: 'sport/basketball', bg: 'run/background_color_trees', p: 'chars/purple_front' },
    start: function (d) {
      d0 = d;
      layout();
      totalT = [75, 60, 50][d];
      guide = [26, 10, 0][d];
      timeLeft = totalT; score = 0; streak = 0; msgs = []; netT = 0; t = 0;
      hoop = { x: W * 0.8, y: H * 0.4, rw: Math.max(70, Math.min(W, H) * 0.14), base: H * 0.4, ph: 0 };
      newBall();
      GG.setScore(0);
    },
    resize: function () {
      if (!hoop) return;
      layout();
      hoop.x = W * 0.8; hoop.base = H * 0.4; hoop.y = hoop.base;
      hoop.rw = Math.max(70, Math.min(W, H) * 0.14);
      newBall();
    },
    update: function (dt) {
      t += dt;
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; GG.over({ score: score, win: true, title: '時間到！', text: '投進了 ' + Math.round(score / 2) + ' 球左右' }); return; }
      if (d0 === 2 || (d0 === 1 && score >= 10)) {
        hoop.ph += dt * (d0 === 2 ? 1.3 : 0.8);
        hoop.y = hoop.base + Math.sin(hoop.ph) * H * 0.12;
      }
      if (netT > 0) netT -= dt;
      for (var i = msgs.length - 1; i >= 0; i--) { msgs[i].t += dt; if (msgs[i].t > 1.1) msgs.splice(i, 1); }
      if (!ball.flying) return;
      var steps = 4, sdt = dt / steps, b = ball;
      for (var s = 0; s < steps; s++) {
        var py = b.y;
        b.vy += G * sdt;
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        b.rot += b.vx * sdt * 0.02;
        // 籃框兩端
        rimPts().forEach(function (q) {
          var dx = b.x - q.x, dy = b.y - q.y, dd = Math.sqrt(dx * dx + dy * dy), min = b.r + 4;
          if (dd < min && dd > 0) {
            var nx = dx / dd, ny = dy / dd, dot = b.vx * nx + b.vy * ny;
            b.x = q.x + nx * min; b.y = q.y + ny * min;
            if (dot < 0) { b.vx -= 1.6 * dot * nx; b.vy -= 1.6 * dot * ny; GG.sfx('bounce'); }
            b.touched = true;
          }
        });
        // 籃板
        var bbX = hoop.x + hoop.rw / 2 + 8, bbTop = hoop.y - hoop.rw * 1.15, bbBot = hoop.y + hoop.rw * 0.25;
        if (b.vx > 0 && b.x + b.r > bbX && b.x < bbX + 12 && b.y > bbTop && b.y < bbBot) { b.x = bbX - b.r; b.vx = -b.vx * 0.55; b.touched = true; GG.sfx('bounce'); }
        // 進球判定：由上往下穿過籃框
        if (!b.scored && py < hoop.y && b.y >= hoop.y && b.x > hoop.x - hoop.rw / 2 + b.r * 0.3 && b.x < hoop.x + hoop.rw / 2 - b.r * 0.3) {
          b.scored = true; streak++;
          var far = (hoop.x - b.x0) > W * 0.5;
          var pts = (far ? 3 : 2) + (b.touched ? 0 : 1);
          score += pts; GG.setScore(score); netT = 0.5;
          msgs.push({ s: (!b.touched ? '空心！' : '進球！') + ' +' + pts, x: hoop.x, y: hoop.y - hoop.rw, t: 0 });
          if (streak >= 3) { timeLeft = Math.min(totalT, timeLeft + 2); msgs.push({ s: '連進 ' + streak + ' 球！時間 +2', x: W / 2, y: H * 0.25, t: 0 }); }
          GG.sfx('goal');
        }
        if (b.y + b.r > floorY) { b.y = floorY - b.r; b.vy = -b.vy * 0.55; b.vx *= 0.8; if (Math.abs(b.vy) > 80) GG.sfx('bounce'); }
      }
      b.life += dt;
      if (b.x < -b.r * 3 || b.x > W + b.r * 3 || b.life > 3.2) {
        if (!b.scored) streak = 0;
        newBall();
      }
    },
    draw: function (ctx, w, h) {
      GG.tile(ctx, 'bg', 0, 0, w, floorY, floorY, 0, 0);
      // 球場地板
      ctx.fillStyle = '#e8a35c'; ctx.fillRect(0, floorY, w, h - floorY);
      ctx.fillStyle = '#d58c45';
      for (var x = 0; x < w; x += 70) ctx.fillRect(x, floorY, 4, h - floorY);
      ctx.fillStyle = GG.INK; ctx.fillRect(0, floorY - 2, w, 5);
      // 籃架
      var bbX = hoop.x + hoop.rw / 2 + 8, bbTop = hoop.y - hoop.rw * 1.15, bbH = hoop.rw * 1.4;
      ctx.fillStyle = '#7d8597'; ctx.fillRect(bbX + 14, bbTop + bbH * 0.5, 14, floorY - bbTop - bbH * 0.5);
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 3; ctx.strokeRect(bbX + 14, bbTop + bbH * 0.5, 14, floorY - bbTop - bbH * 0.5);
      ctx.fillStyle = '#ffffff'; GG.rr(ctx, bbX, bbTop, 14, bbH, 4); ctx.fill();
      ctx.lineWidth = 3.5; ctx.strokeStyle = GG.INK; GG.rr(ctx, bbX, bbTop, 14, bbH, 4); ctx.stroke();
      // 輔助線
      if (aim && !ball.flying && aim.cur) {
        var v = launchVel(aim.cur);
        var n = guide || 4, tt = 0;
        for (var i = 1; i <= n; i++) {
          tt = i * 0.05;
          var gx = ball.x + v.vx * tt, gy = ball.y + v.vy * tt + 0.5 * G * tt * tt;
          ctx.fillStyle = 'rgba(255,255,255,' + (1 - i / (n + 1)) + ')';
          ctx.beginPath(); ctx.arc(gx, gy, 6, 0, Math.PI * 2); ctx.fill();
        }
        // 力量條
        var pw = v.len / (Math.min(W, H) * 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; GG.rr(ctx, ball.x - 40, ball.y + ball.r + 14, 80, 12, 6); ctx.fill();
        ctx.fillStyle = pw > 0.8 ? '#ff5252' : '#43d17a'; GG.rr(ctx, ball.x - 40, ball.y + ball.r + 14, 80 * pw, 12, 6); ctx.fill();
      }
      // 籃網（後半）
      var rx = hoop.x - hoop.rw / 2, rw = hoop.rw, ny = hoop.y, nh = rw * 0.75 * (1 + (netT > 0 ? Math.sin(netT * 20) * 0.12 : 0));
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (var k = 0; k <= 6; k++) {
        var top = rx + rw * k / 6, bot = rx + rw * 0.2 + rw * 0.6 * k / 6;
        ctx.moveTo(top, ny); ctx.lineTo(bot, ny + nh);
      }
      for (var j = 1; j <= 3; j++) {
        var yy = ny + nh * j / 3, sh = rw * 0.2 * j / 3;
        ctx.moveTo(rx + sh, yy); ctx.lineTo(rx + rw - sh, yy);
      }
      ctx.stroke();
      // 球
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(ball.x, floorY + 3, ball.r * 0.9, ball.r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      GG.spr(ctx, 'ball', ball.x, ball.y, ball.r * 2, ball.r * 2, { rot: ball.rot });
      // 籃框（前緣）
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx, ny); ctx.lineTo(rx + rw, ny); ctx.stroke();
      ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(rx, ny); ctx.lineTo(rx + rw, ny); ctx.stroke();
      // 時間
      GG.text(ctx, Math.ceil(timeLeft) + ' 秒', w / 2, 34, 30, timeLeft < 10 ? '#ff5252' : '#fff', 'center', true);
      msgs.forEach(function (m) {
        ctx.globalAlpha = Math.max(0, 1 - m.t / 1.1);
        GG.text(ctx, m.s, m.x, m.y - m.t * 60, 30, '#ffe14d', 'center', true);
      });
      ctx.globalAlpha = 1;
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
