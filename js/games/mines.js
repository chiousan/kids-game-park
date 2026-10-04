/* 踩地雷 */
(function () {
  var C, R, M, cells, first, flagMode, elapsed, opened, ended, cs, ox, oy, pressT, pressCell, longDone, flags, boomAt;
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
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      if (Math.abs(r - sr) <= 1 && Math.abs(c - sc) <= 1) continue;
      spots.push([r, c]);
    }
    GG.shuffle(spots);
    for (var i = 0; i < M; i++) cells[idx(spots[i][0], spots[i][1])].mine = true;
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) {
      var n = 0;
      neighbors(r, c, function (a, b) { if (cells[idx(a, b)].mine) n++; });
      cells[idx(r, c)].n = n;
    }
  }
  function reveal(r, c) {
    var stack = [[r, c]];
    while (stack.length) {
      var p = stack.pop(), k = cells[idx(p[0], p[1])];
      if (k.open || k.flag) continue;
      k.open = true; k.anim = 0; opened++;
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
      // 數字周圍旗子數量對了，就一次打開其餘鄰格
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
      cells.forEach(function (q) { if (q.mine) q.open = true; });
      GG.sfx('boom');
      GG.over({ score: Math.floor(elapsed), win: false, title: '踩到炸彈了！', scoreText: '再試一次吧', delay: 1200 });
      return;
    }
    reveal(r, c);
    GG.sfx('pop');
    if (opened === R * C - M) {
      ended = true;
      cells.forEach(function (q) { if (q.mine) q.flag = true; });
      GG.over({ score: Math.floor(elapsed), win: true, title: '全部找到了！', scoreText: '用了 ' + Math.floor(elapsed) + ' 秒' });
    }
  }
  function layout(w, h) {
    if (!C) return;
    cs = Math.floor(Math.min((w - 20) / C, (h - 100) / R, 72));
    ox = Math.round((w - cs * C) / 2); oy = Math.round((h - 90 - cs * R) / 2) + 6;
    var bw = Math.min(260, w - 40);
    GG.setPad([{
      id: 'mode', x: (w - bw) / 2, y: h - 76, w: bw, h: 62, r: 31,
      label: '挖開模式', fs: 22,
      color: '#2e7d32',
      onDown: function () { flagMode = !flagMode; this.label = flagMode ? '插旗模式' : '挖開模式'; this.color = flagMode ? '#ff7043' : '#2e7d32'; GG.sfx('click'); }
    }]);
  }
  function cellAt(x, y) {
    var c = Math.floor((x - ox) / cs), r = Math.floor((y - oy) / cs);
    if (r < 0 || c < 0 || r >= R || c >= C) return null;
    return [r, c];
  }

  GG.define({
    assets: { bomb: 'run/bomb', flag: 'run/flag_red_a' },
    fmt: function (v) { return v + ' 秒'; },
    start: function (d) {
      var portrait = GG.H >= GG.W;
      var cfg = [[8, 8, 8], [9, 12, 16], [12, 16, 36]][d];
      C = portrait ? cfg[0] : cfg[1]; R = portrait ? cfg[1] : cfg[0]; M = cfg[2];
      cells = [];
      for (var i = 0; i < C * R; i++) cells.push({ mine: false, open: false, flag: false, n: 0, anim: 1 });
      first = true; flagMode = false; elapsed = 0; opened = 0; ended = false; flags = 0; boomAt = null;
      pressCell = null;
      layout(GG.W, GG.H);
    },
    resize: layout,
    update: function (dt) {
      if (!first && !ended) elapsed += dt;
      cells.forEach(function (k) { if (k.anim < 1) k.anim = Math.min(1, k.anim + dt / 0.2); });
      if (pressCell && !longDone) {
        pressT += dt;
        if (pressT > 0.42) { longDone = true; tapCell(pressCell[0], pressCell[1], !flagMode); }
      }
      GG.hud('炸彈 ' + (M - flags) + '・' + Math.floor(elapsed) + ' 秒');
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#bfeaa0', '#86cf62');
      ctx.fillStyle = 'rgba(40,90,20,0.3)'; GG.rr(ctx, ox - 10, oy - 4, cs * C + 20, cs * R + 20, 18); ctx.fill();
      ctx.fillStyle = '#4e9a2e'; GG.rr(ctx, ox - 10, oy - 10, cs * C + 20, cs * R + 20, 18); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; GG.rr(ctx, ox - 10, oy - 10, cs * C + 20, cs * R + 20, 18); ctx.stroke();
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
        var k = cells[idx(r, c)], x = ox + c * cs, y = oy + r * cs;
        if (!k.open) {
          ctx.fillStyle = (r + c) % 2 ? '#62c43c' : '#72d14a';
          ctx.fillRect(x, y, cs, cs);
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, cs, cs * 0.14);
          ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y + cs * 0.86, cs, cs * 0.14);
          if (pressCell && pressCell[0] === r && pressCell[1] === c && !longDone) {
            ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, pressT) + ')'; ctx.fillRect(x, y, cs, cs);
          }
          if (k.flag) GG.spr(ctx, 'flag', x + cs / 2 + cs * 0.05, y + cs / 2, cs * 0.72, cs * 0.72);
        } else {
          ctx.fillStyle = (r + c) % 2 ? '#f0d9a8' : '#f7e6bf';
          if (boomAt && boomAt[0] === r && boomAt[1] === c) ctx.fillStyle = '#ff6b6b';
          ctx.fillRect(x, y, cs, cs);
          var s = GG.ease(k.anim);
          if (k.mine) GG.spr(ctx, 'bomb', x + cs / 2, y + cs / 2, cs * 0.82 * s, cs * 0.82 * s);
          else if (k.n) GG.text(ctx, String(k.n), x + cs / 2, y + cs / 2 + 2, cs * 0.62 * s, NUMC[k.n], 'center', '#ffffff');
        }
      }
    },
    down: function (p) {
      pressCell = cellAt(p.x, p.y); pressT = 0; longDone = false;
    },
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
