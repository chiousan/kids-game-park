/* 踩地雷（懶惰重繪） */
(function () {
  var C, R, M, cells, first, flagMode, elapsed, opened, ended, cs, ox, oy, pressT, pressCell, longDone, flags, boomAt, d0;
  var NUMC = ['', '#2f7bff', '#2e9e4f', '#ff4d4d', '#7b3fe4', '#c2410c', '#0e9aa7', '#333', '#777'];

  function idx(r, c) { return r * C + c; }
  function neighbors(r, c, fn) {
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < R && cc < C) fn(rr, cc);
    }
  }
  function plant(sr, sc) {
    var spots = [];
    // 第一下周圍 2 格內都不放炸彈，保證一開始就能打開一大片
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (Math.abs(r - sr) > 1 || Math.abs(c - sc) > 1) spots.push([r, c]);
    GG.shuffle(spots);
    for (var i = 0; i < M; i++) cells[idx(spots[i][0], spots[i][1])].mine = true;
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) {
      var n = 0;
      neighbors(r, c, function (a, b) { if (cells[idx(a, b)].mine) n++; });
      cells[idx(r, c)].n = n;
    }
  }
  function reveal(r, c) {
    var stack = [[r, c]], k0 = 0;
    while (stack.length) {
      var p = stack.pop(), k = cells[idx(p[0], p[1])];
      if (k.open || k.flag) continue;
      k.open = true; k.anim = -Math.min(0.4, k0 * 0.012); k0++; opened++;
      if (k.n === 0 && !k.mine) neighbors(p[0], p[1], function (a, b) { if (!cells[idx(a, b)].open) stack.push([a, b]); });
    }
  }
  function tapCell(r, c, asFlag) {
    if (ended) return;
    var k = cells[idx(r, c)];
    if (asFlag) {
      if (k.open) return;
      k.flag = !k.flag; flags += k.flag ? 1 : -1;
      GG.sfx('click');
      return;
    }
    if (k.flag) return;
    if (k.open) {
      if (k.n > 0) {
        var f = 0;
        neighbors(r, c, function (a, b) { if (cells[idx(a, b)].flag) f++; });
        if (f === k.n) neighbors(r, c, function (a, b) { var q = cells[idx(a, b)]; if (!q.open && !q.flag) openOne(a, b); });
      }
      return;
    }
    openOne(r, c);
  }
  function openOne(r, c) {
    if (ended) return;
    if (first) { first = false; plant(r, c); }
    var k = cells[idx(r, c)];
    if (k.mine) {
      k.open = true; ended = true; boomAt = [r, c];
      cells.forEach(function (q) { if (q.mine) { q.open = true; q.anim = 0; } });
      GG.sfx('boom'); GG.shake(12, 0.4);
      GG.burst(ox + (c + 0.5) * cs, oy + (r + 0.5) * cs, { n: 20, colors: ['#ff6b6b', '#ffd23f', '#ff9a2f'], size: cs * 0.3, speed: 360 });
      GG.over({ score: Math.floor(elapsed), win: false, title: '踩到炸彈了！', scoreText: '再試一次吧', delay: 1300 });
      return;
    }
    reveal(r, c);
    GG.sfx('pop');
    if (opened === R * C - M) {
      ended = true;
      cells.forEach(function (q) { if (q.mine) q.flag = true; });
      var t = Math.floor(elapsed), par = [60, 150, 300][d0];
      GG.over({ score: t, win: true, stars: t <= par * 0.5 ? 3 : t <= par ? 2 : 1, title: '全部找到了！', scoreText: '用了 ' + t + ' 秒' });
    }
  }
  function layout(w, h) {
    if (!C) return;
    cs = Math.floor(Math.min((w - 24) / C, (h - 110) / R, 76));
    ox = Math.round((w - cs * C) / 2); oy = Math.round((h - 96 - cs * R) / 2) + 8;
    var bw = Math.min(260, w - 40);
    GG.setPad([{
      id: 'mode', x: (w - bw) / 2, y: h - 80, w: bw, h: 64, r: 32, label: flagMode ? '插旗模式' : '挖開模式', fs: 24,
      color: flagMode ? '#ff7043' : '#2e7d32',
      onDown: function () { flagMode = !flagMode; this.label = flagMode ? '插旗模式' : '挖開模式'; this.color = flagMode ? '#ff7043' : '#2e7d32'; GG.sfx('click'); }
    }]);
    GG.canvasLayer('bg').paint(function (g) {
      GG.bg(g, w, h, '#bfeaa0', '#86cf62');
      GG.panel(g, ox - 10, oy - 10, cs * C + 20, cs * R + 20, 18, '#4e9a2e');
    });
  }
  function cellAt(x, y) {
    var c = Math.floor((x - ox) / cs), r = Math.floor((y - oy) / cs);
    return r < 0 || c < 0 || r >= R || c >= C ? null : [r, c];
  }

  GG.define({
    lazy: true,
    assets: { bomb: 'run/bomb', flag: 'run/flag_red_a' },
    start: function (d) {
      d0 = d;
      var portrait = GG.H >= GG.W;
      var cfg = [[8, 8, 6], [9, 12, 12], [10, 14, 24]][d];
      C = portrait ? cfg[0] : cfg[1]; R = portrait ? cfg[1] : cfg[0]; M = cfg[2];
      cells = [];
      for (var i = 0; i < C * R; i++) cells.push({ mine: false, open: false, flag: false, n: 0, anim: 1 });
      first = true; flagMode = false; elapsed = 0; opened = 0; ended = false; flags = 0; boomAt = null; pressCell = null;
      layout(GG.W, GG.H);
    },
    resize: layout,
    update: function (dt) {
      var busy = false;
      if (!first && !ended) elapsed += dt;
      cells.forEach(function (k) { if (k.anim < 1) { k.anim = Math.min(1, k.anim + dt / 0.2); busy = true; } });
      if (pressCell && !longDone) {
        busy = true; pressT += dt;
        if (pressT > 0.42) { longDone = true; tapCell(pressCell[0], pressCell[1], !flagMode); }
      }
      GG.hud('炸彈 ' + (M - flags) + '・' + Math.floor(elapsed) + ' 秒');
      return busy;
    },
    draw: function (ctx) {
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var k = cells[idx(r, c)], x = ox + c * cs, y = oy + r * cs;
        if (!k.open || k.anim < 0) {
          ctx.fillStyle = (r + c) % 2 ? '#62c43c' : '#72d14a'; ctx.fillRect(x, y, cs, cs);
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, cs, cs * 0.14);
          ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y + cs * 0.86, cs, cs * 0.14);
          if (pressCell && pressCell[0] === r && pressCell[1] === c && !longDone) {
            ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, pressT) + ')'; ctx.fillRect(x, y, cs, cs);
          }
          if (k.flag) GG.spr(ctx, 'flag', x + cs * 0.55, y + cs / 2, cs * 0.72, cs * 0.72);
        } else {
          ctx.fillStyle = boomAt && boomAt[0] === r && boomAt[1] === c ? '#ff6b6b' : (r + c) % 2 ? '#f0d9a8' : '#f7e6bf';
          ctx.fillRect(x, y, cs, cs);
          var s = GG.back(Math.max(0, k.anim));
          if (k.mine) GG.spr(ctx, 'bomb', x + cs / 2, y + cs / 2, cs * 0.82 * s, cs * 0.82 * s);
          else if (k.n) GG.text(ctx, String(k.n), x + cs / 2, y + cs / 2 + 2, cs * 0.62, NUMC[k.n], 'center', '#ffffff', s);
        }
      }
    },
    down: function (p) { pressCell = cellAt(p.x, p.y); pressT = 0; longDone = false; },
    move: function (p) {
      var c = cellAt(p.x, p.y);
      if (!c || !pressCell || c[0] !== pressCell[0] || c[1] !== pressCell[1]) pressCell = null;
    },
    up: function () {
      if (pressCell && !longDone) tapCell(pressCell[0], pressCell[1], flagMode);
      pressCell = null;
    }
  });
})();
