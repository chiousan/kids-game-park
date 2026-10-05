/* 敲敲圓滾滾（打地鼠） */
(function () {
  var COLORS = ['blue', 'green', 'pink', 'purple', 'red'];
  var holes, cols, rows, hs, ox, oy, score, timeLeft, totalT, spawnT, d0, hits, combo, comboT;
  var ASSETS = { bomb: 'run/bomb', gold: 'blob/yellow_smile', golddizzy: 'blob/yellow_dizzy', hammer: 'bunny/carrot_gold' };
  COLORS.forEach(function (c) { ASSETS[c] = 'blob/' + c + '_happy'; ASSETS[c + 'd'] = 'blob/' + c + '_dizzy'; });

  function layout(w, h) {
    cols = d0 === 2 ? 4 : 3; rows = d0 === 0 ? 3 : 4;
    hs = Math.min((w - 30) / cols, (h - 90) / (rows + 0.2), 230);
    ox = (w - hs * cols) / 2; oy = (h - hs * rows) / 2 + 30;
    holes = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++)
      holes.push({ x: ox + hs * (c + 0.5), y: oy + hs * (r + 0.72), st: 'idle', t: 0, up: 0, kind: '', col: '' });
    GG.canvasLayer('bg').paint(function (g) {
      GG.bg(g, w, h, '#b8f08f', '#6cc444');
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (var k = 0; k < 18; k++) { g.beginPath(); g.ellipse((k * 157) % w, (k * 233) % h, 26, 10, 0, 0, Math.PI * 2); g.fill(); }
      holes.forEach(function (o) {
        g.fillStyle = '#7a4a24'; g.beginPath(); g.ellipse(o.x, o.y, hs * 0.42, hs * 0.16, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3d2412'; g.beginPath(); g.ellipse(o.x, o.y + 3, hs * 0.36, hs * 0.12, 0, 0, Math.PI * 2); g.fill();
      });
    });
  }
  function spawn() {
    var idle = holes.filter(function (o) { return o.st === 'idle'; });
    if (!idle.length) return;
    var o = GG.pick(idle), r = Math.random();
    o.st = 'up'; o.t = 0; o.up = 0;
    o.kind = d0 > 0 && r < [0, 0.12, 0.2][d0] ? 'bomb' : r > 0.9 ? 'gold' : 'blob';
    o.col = GG.pick(COLORS);
    o.stay = [1.6, 1.2, 0.9][d0] * GG.rand(0.85, 1.15);
  }
  function whack(o) {
    if (o.kind === 'bomb') {
      score = Math.max(0, score - 20); combo = 0;
      GG.sfx('boom'); GG.shake(12, 0.35);
      GG.burst(o.x, o.y - hs * 0.3, { n: 16, colors: ['#ff6b6b', '#ffd23f', '#555'], size: 14, speed: 320 });
      GG.floatText(o.x, o.y - hs * 0.6, '-20', '#ff6b6b', 34);
      o.st = 'down'; o.t = 0;
    } else {
      hits++; combo++; comboT = 1.2;
      var pts = (o.kind === 'gold' ? 30 : 10) + Math.min(combo - 1, 5) * 2;
      score += pts;
      GG.sfx(o.kind === 'gold' ? 'coin' : 'pop'); GG.shake(4, 0.12);
      GG.burst(o.x, o.y - hs * 0.35, { n: 8, img: '_star', size: hs * 0.18, speed: 260 });
      GG.floatText(o.x, o.y - hs * 0.7, '+' + pts + (combo >= 3 ? ' 連擊！' : ''), o.kind === 'gold' ? '#ffe14d' : '#fff', 30);
      o.st = 'hit'; o.t = 0;
    }
    GG.setScore(score);
  }

  GG.define({
    countdown: true,
    assets: ASSETS,
    start: function (d) {
      d0 = d; layout(GG.W, GG.H);
      totalT = [60, 60, 50][d]; timeLeft = totalT; score = 0; spawnT = 0.5; hits = 0; combo = 0; comboT = 0;
      GG.setScore(0);
    },
    resize: function (w, h) { if (d0 !== undefined) layout(w, h); },
    update: function (dt) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        var th = [[150, 300, 450], [200, 380, 550], [220, 420, 600]][d0];
        GG.over({ score: score, win: true, stars: GG.starsFor(score, th[0], th[1], th[2]), title: '時間到！', text: '敲到 ' + hits + ' 個圓滾滾' });
        return;
      }
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      spawnT -= dt;
      var rate = [0.95, 0.72, 0.55][d0] * (1 - Math.min(0.3, (totalT - timeLeft) / totalT * 0.3));
      if (spawnT <= 0) { spawn(); spawnT = rate * GG.rand(0.7, 1.2); }
      holes.forEach(function (o) {
        o.t += dt;
        if (o.st === 'up') { o.up = Math.min(1, o.t / 0.16); if (o.up >= 1) { o.st = 'stay'; o.t = 0; } }
        else if (o.st === 'stay') { if (o.t > o.stay) { o.st = 'down'; o.t = 0; if (o.kind !== 'bomb') combo = 0; } }
        else if (o.st === 'hit') { if (o.t > 0.35) { o.st = 'down'; o.t = 0; } }
        else if (o.st === 'down') { o.up = Math.max(0, 1 - o.t / 0.16); if (o.up <= 0) o.st = 'idle'; }
      });
    },
    draw: function (ctx, w) {
      var bs = hs * 0.66;
      holes.forEach(function (o) {
        if (o.st === 'idle') return;
        var rise = GG.back(o.up) * bs * 0.95;
        ctx.save();
        ctx.beginPath(); ctx.rect(o.x - hs * 0.5, o.y - hs, hs, hs); ctx.clip();
        var key = o.kind === 'bomb' ? 'bomb' : o.kind === 'gold' ? (o.st === 'hit' ? 'golddizzy' : 'gold') : (o.st === 'hit' ? o.col + 'd' : o.col);
        var squash = o.st === 'hit' ? 1 - Math.sin(Math.min(1, o.t / 0.15) * Math.PI) * 0.25 : 1;
        GG.spr(ctx, key, o.x, o.y + bs * 0.5 - rise, bs * (2 - squash), bs * squash);
        ctx.restore();
        // 洞口前緣蓋住身體下半部
        ctx.fillStyle = '#6a3d1c';
        ctx.beginPath(); ctx.ellipse(o.x, o.y, hs * 0.42, hs * 0.16, 0, 0, Math.PI); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; ctx.stroke();
      });
      GG.text(ctx, Math.ceil(timeLeft) + ' 秒', w / 2, 32, 30, timeLeft < 10 ? '#ff5252' : '#fff', 'center', true);
    },
    down: function (p) {
      for (var i = 0; i < holes.length; i++) {
        var o = holes[i];
        if ((o.st === 'stay' || o.st === 'up') && Math.abs(p.x - o.x) < hs * 0.45 && p.y < o.y + hs * 0.2 && p.y > o.y - hs * 0.85) { whack(o); return; }
      }
    }
  });
})();
