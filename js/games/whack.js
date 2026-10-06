/* 敲敲圓滾滾（打地鼠） */
(function () {
  var COLORS = ['blue', 'green', 'pink', 'purple', 'red'];
  var holes, cols, rows, hs, ox, oy, score, timeLeft, totalT, spawnT, d0, hits, combo, comboT;
  // 關卡：時間每過 1/5 升一關，冒出來更快，並加入新障礙與新獎勵
  var LV_MSG = ['', '新障礙：炸彈（不能敲）　新獎勵：時鐘 +5 秒', '新障礙：戴安全帽的要敲 2 下　新獎勵：星星分數加倍',
    '一次冒出兩隻！', '最快速度！'];
  var lvl = 1, doubleT = 0;
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
    var o = GG.pick(idle), r = Math.random(), bc = lvl >= 2 ? 0.08 + (lvl - 2) * 0.03 + d0 * 0.04 : 0;
    o.st = 'up'; o.t = 0; o.up = 0;
    if (r < bc) o.kind = 'bomb';
    else if (lvl >= 2 && r < bc + 0.05) o.kind = 'clock';
    else if (lvl >= 3 && r < bc + 0.1) o.kind = 'star';
    else if (lvl >= 3 && r < bc + 0.25) o.kind = 'helmet';
    else o.kind = r > 0.9 ? 'gold' : 'blob';
    o.col = GG.pick(COLORS);
    o.stay = [1.6, 1.2, 0.9][d0] * GG.rand(0.85, 1.15) * (1 - (lvl - 1) * 0.08);
  }
  function whack(o) {
    if (o.kind === 'bomb') {
      score = Math.max(0, score - 20); combo = 0;
      GG.sfx('boom'); GG.shake(12, 0.35);
      GG.burst(o.x, o.y - hs * 0.3, { n: 16, colors: ['#ff6b6b', '#ffd23f', '#555'], size: 14, speed: 320 });
      GG.floatText(o.x, o.y - hs * 0.6, '-20', '#ff6b6b', 34);
      o.st = 'down'; o.t = 0;
    } else if (o.kind === 'helmet') {
      // 第一下先把安全帽敲掉
      o.kind = 'blob'; o.t = 0; o.stay += 0.4;
      GG.sfx('bounce'); GG.shake(3, 0.1);
      GG.burst(o.x, o.y - hs * 0.55, { n: 6, colors: ['#9aa3b5', '#ffffff'], size: 10, speed: 220 });
      return;
    } else if (o.kind === 'clock') {
      timeLeft += 5; GG.sfx('power');
      GG.floatText(o.x, o.y - hs * 0.6, '+5 秒', '#9fe3ff', 34);
      o.st = 'down'; o.t = 0;
    } else if (o.kind === 'star') {
      doubleT = 6; GG.sfx('power');
      GG.floatText(o.x, o.y - hs * 0.6, '分數加倍！', '#ffe14d', 34);
      GG.burst(o.x, o.y - hs * 0.35, { n: 10, img: '_star', size: hs * 0.2, speed: 280 });
      o.st = 'down'; o.t = 0;
    } else {
      hits++; combo++; comboT = 1.2;
      var pts = ((o.kind === 'gold' ? 30 : 10) + Math.min(combo - 1, 5) * 2) * (doubleT > 0 ? 2 : 1);
      score += pts;
      GG.sfx(o.kind === 'gold' ? 'coin' : 'pop'); GG.shake(4, 0.12);
      GG.burst(o.x, o.y - hs * 0.35, { n: 8, img: '_star', size: hs * 0.18, speed: 260 });
      GG.floatText(o.x, o.y - hs * 0.7, '+' + pts + (combo >= 3 ? ' 連擊！' : ''), o.kind === 'gold' ? '#ffe14d' : '#fff', 30);
      o.st = 'hit'; o.t = 0;
    }
    GG.setScore(score);
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { GG._whackEl = (n - 1) * totalT / 5 + 0.1; };

  GG.define({
    countdown: true,
    assets: ASSETS,
    start: function (d) {
      d0 = d; layout(GG.W, GG.H);
      totalT = [60, 60, 50][d]; timeLeft = totalT; score = 0; spawnT = 0.5; hits = 0; combo = 0; comboT = 0; lvl = 1; doubleT = 0; this.el = 0;
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
      if (doubleT > 0) doubleT -= dt;
      if (GG._whackEl) { this.el = GG._whackEl; GG._whackEl = 0; }
      this.el += dt;
      var nl = Math.min(5, 1 + Math.floor(this.el / (totalT / 5)));
      if (nl > lvl) { lvl = nl; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]); }
      spawnT -= dt;
      var rate = [0.95, 0.72, 0.55][d0] * (1 - (lvl - 1) * 0.08);
      if (spawnT <= 0) { spawn(); if (lvl >= 4 && Math.random() < 0.4) spawn(); spawnT = rate * GG.rand(0.7, 1.2); }
      holes.forEach(function (o) {
        o.t += dt;
        if (o.st === 'up') { o.up = Math.min(1, o.t / 0.16); if (o.up >= 1) { o.st = 'stay'; o.t = 0; } }
        else if (o.st === 'stay') { if (o.t > o.stay) { o.st = 'down'; o.t = 0; if (o.kind === 'blob' || o.kind === 'gold' || o.kind === 'helmet') combo = 0; } }
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
        var cy = o.y + bs * 0.5 - rise;
        if (o.kind === 'clock') {
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x, cy, bs * 0.42, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 6; ctx.strokeStyle = '#3d8bfd'; ctx.stroke();
          ctx.strokeStyle = GG.INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(o.x, cy); ctx.lineTo(o.x, cy - bs * 0.26); ctx.moveTo(o.x, cy); ctx.lineTo(o.x + bs * 0.18, cy + bs * 0.06); ctx.stroke();
          GG.text(ctx, '+5', o.x, cy + bs * 0.2, bs * 0.2, '#3d8bfd');
        } else if (o.kind === 'star') GG.spr(ctx, '_star', o.x, cy, bs * 0.9, bs * 0.9, { rot: Math.sin(o.t * 6) * 0.2 });
        else {
          GG.spr(ctx, key, o.x, cy, bs * (2 - squash), bs * squash);
          if (o.kind === 'helmet') {
            ctx.fillStyle = '#9aa3b5'; ctx.beginPath(); ctx.ellipse(o.x, cy - bs * 0.22, bs * 0.5, bs * 0.36, 0, Math.PI, 0); ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; ctx.stroke();
            ctx.fillStyle = '#c7cdd9'; ctx.fillRect(o.x - bs * 0.56, cy - bs * 0.25, bs * 1.12, bs * 0.1);
            ctx.strokeRect(o.x - bs * 0.56, cy - bs * 0.25, bs * 1.12, bs * 0.1);
          }
        }
        ctx.restore();
        // 洞口前緣蓋住身體下半部
        ctx.fillStyle = '#6a3d1c';
        ctx.beginPath(); ctx.ellipse(o.x, o.y, hs * 0.42, hs * 0.16, 0, 0, Math.PI); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; ctx.stroke();
      });
      GG.hudText(ctx, Math.ceil(timeLeft) + ' 秒', w / 2, 32, 28, timeLeft < 10 ? '#ff6b6b' : '#fff', 'center');
      GG.hudText(ctx, '第 ' + lvl + ' 關', w - 18, 32, 22, '#fff', 'right');
      if (doubleT > 0) GG.hudText(ctx, '分數 ×2', 18, 32, 22, '#ffe14d', 'left');
    },
    down: function (p) {
      for (var i = 0; i < holes.length; i++) {
        var o = holes[i];
        if ((o.st === 'stay' || o.st === 'up') && Math.abs(p.x - o.x) < hs * 0.45 && p.y < o.y + hs * 0.2 && p.y > o.y - hs * 0.85) { whack(o); return; }
      }
    }
  });
})();
