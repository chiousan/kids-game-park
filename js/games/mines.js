/* 踩地雷（懶惰重繪） */
(function () {
  var handIc = null;
  var C, R, M, cells, first, flagMode, elapsed, opened, ended, cs, ox, oy, pressT, pressCell, longDone, flags, boomAt, d0;
  var NUMC = ['', '#2f7bff', '#2e9e4f', '#ff4d4d', '#7b3fe4', '#c2410c', '#0e9aa7', '#333', '#777'];
  /* 一共 5 關，盤面和炸彈越來越多；有愛心，踩到炸彈扣一顆，用完才結束。
     2 關起：格子底下藏著愛心寶物　3 關起：藏著探測器（自動插旗 2 顆炸彈） */
  var CFG = [[[6, 7, 4], [7, 8, 6], [8, 9, 8], [8, 10, 10], [9, 11, 12]],
    [[7, 8, 6], [8, 10, 10], [9, 11, 13], [9, 12, 16], [10, 13, 19]],
    [[8, 10, 10], [9, 12, 15], [10, 13, 20], [10, 14, 24], [11, 15, 28]]];
  var LV_MSG = ['', '盤面變大！新獎勵：格子底下藏著愛心', '炸彈變多了！新獎勵：探測器（自動找出 2 顆炸彈）', '炸彈又變多了！', '最大的盤面，加油！'];
  var lvl = 1, hearts = 3, maxHearts = 3;
  function buildLevel() {
    var portrait = GG.H >= GG.W, cfg = CFG[d0][lvl - 1];
    C = portrait ? cfg[0] : cfg[1]; R = portrait ? cfg[1] : cfg[0]; M = cfg[2];
    cells = [];
    for (var i = 0; i < C * R; i++) cells.push({ mine: false, open: false, flag: false, n: 0, anim: 1 });
    first = true; opened = 0; ended = false; flags = 0; boomAt = null; pressCell = null;
    layout(GG.W, GG.H);
    if (lvl > 1) GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]);
  }

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
    // 寶物藏在安全的格子
    var safe = spots.slice(M);
    if (lvl >= 2 && safe.length) cells[idx(safe[0][0], safe[0][1])].item = 'heart';
    if (lvl >= 3 && safe.length > 1) cells[idx(safe[1][0], safe[1][1])].item = 'radar';
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
      if (k.item) findItem(k, p[0], p[1]);
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
    if (k.open && k.mine) return;
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
  function findItem(k, r, c) {
    var x = ox + (c + 0.5) * cs, y = oy + (r + 0.5) * cs;
    if (k.item === 'heart') { hearts = Math.min(5, hearts + 1); GG.floatText(x, y - cs, '找到愛心！+1', '#ff6b8a', 28); }
    else {
      var hid = cells.filter(function (q) { return q.mine && !q.flag && !q.open; });
      GG.shuffle(hid).slice(0, 2).forEach(function (q) { q.flag = true; flags++; });
      GG.floatText(x, y - cs, '探測器找到炸彈了！', '#9fe3ff', 28);
    }
    k.item = null; GG.sfx('power');
    GG.burst(x, y, { n: 10, img: '_star', size: cs * 0.4, speed: 260 });
  }
  function openOne(r, c) {
    if (ended) return;
    if (first) { first = false; plant(r, c); }
    var k = cells[idx(r, c)];
    if (k.mine) {
      // 踩到炸彈：扣一顆愛心，那顆炸彈變成拆掉的樣子；愛心用完才結束
      k.open = true; k.anim = 0; k.defused = true; hearts--; flags++;
      GG.sfx('boom'); GG.shake(12, 0.4);
      GG.burst(ox + (c + 0.5) * cs, oy + (r + 0.5) * cs, { n: 20, colors: ['#ff6b6b', '#ffd23f', '#ff9a2f'], size: cs * 0.3, speed: 360 });
      if (hearts > 0) { GG.floatText(ox + (c + 0.5) * cs, oy + r * cs, '小心！-1 愛心', '#ff6b6b', 28); return; }
      ended = true; boomAt = [r, c];
      cells.forEach(function (q) { if (q.mine) { q.open = true; q.anim = 0; } });
      GG.over({ score: Math.floor(elapsed), win: false, title: '愛心用完了！', scoreText: '到第 ' + lvl + ' 關', delay: 1300 });
      return;
    }
    reveal(r, c);
    GG.sfx('pop');
    if (opened === R * C - M) {
      ended = true;
      cells.forEach(function (q) { if (q.mine && !q.open) q.flag = true; });
      if (lvl < 5) {
        lvl++; GG.sfx('win');
        setTimeout(function () { if (GG.state() === 'play') { buildLevel(); GG.redraw(); } }, 1000);
        return;
      }
      var t = Math.floor(elapsed), par = [200, 420, 700][d0];
      GG.over({ score: t, win: true, stars: t <= par * 0.5 ? 3 : t <= par ? 2 : 1, title: '5 關全部完成！', scoreText: '用了 ' + t + ' 秒' });
    }
  }
  function layout(w, h) {
    if (!C) return;
    cs = Math.floor(Math.min((w - 24) / C, (h - 150) / R, 76));
    ox = Math.round((w - cs * C) / 2); oy = Math.round((h - 146 - cs * R) / 2) + 50;
    var bw = Math.min(280, w - 40);
    if (!handIc) handIc = GG.sprite(64, 64, function (g) { GG.hand(g, 30, 6, 46, false); });
    GG.setPad([{
      id: 'mode', x: (w - bw) / 2, y: h - 80, w: bw, h: 64, r: 32, label: flagMode ? '插旗模式' : '挖開模式', fs: 24,
      color: flagMode ? '#ff7043' : '#2e7d32', img: flagMode ? 'flag' : handIc,
      onDown: function () {
        flagMode = !flagMode; GG.sfx('click');
        this.label = flagMode ? '插旗模式' : '挖開模式'; this.color = flagMode ? '#ff7043' : '#2e7d32'; this.img = flagMode ? 'flag' : handIc;
      }
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

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { lvl = n; buildLevel(); };

  GG.define({
    lazy: true,
    assets: { bomb: 'run/bomb', flag: 'run/flag_red_a' },
    start: function (d) {
      d0 = d; lvl = 1; maxHearts = hearts = [3, 3, 2][d];
      flagMode = false; elapsed = 0;
      buildLevel();
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
      GG.hud('第 ' + lvl + ' 關・炸彈 ' + (M - flags) + '・' + Math.floor(elapsed) + ' 秒');
      return busy;
    },
    draw: function (ctx) {
      GG.lives(ctx, hearts, Math.max(maxHearts, hearts), 14, 28, 26);
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
          if (k.mine) {
            GG.spr(ctx, 'bomb', x + cs / 2, y + cs / 2, cs * 0.82 * s, cs * 0.82 * s, k.defused ? { alpha: 0.45 } : null);
            if (k.defused) { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = Math.max(3, cs * 0.08); ctx.beginPath(); ctx.moveTo(x + cs * 0.2, y + cs * 0.2); ctx.lineTo(x + cs * 0.8, y + cs * 0.8); ctx.moveTo(x + cs * 0.8, y + cs * 0.2); ctx.lineTo(x + cs * 0.2, y + cs * 0.8); ctx.stroke(); }
          }
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
