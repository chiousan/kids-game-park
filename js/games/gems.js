/* 寶石消消樂 */
(function () {
  var N = 8, TYPES = 6, grid, score, timeLeft, totalT, phase, combo, sel, swapA, swapB, swapT, swapBack, d0;
  var bx, by, bs, cell, hintT, hint;
  var GEMS = ['red_diamond', 'blue_square', 'green_polygon', 'yellow_diamond', 'purple_polygon', 'grey_square'];
  var ASSETS = { sel: 'puzzle/selector', bomb: 'run/bomb' };
  GEMS.forEach(function (g, i) { ASSETS['g' + i] = 'puzzle/gem_' + g; });

  /* 關卡（依分數）：2 關 4 顆一樣會留下「炸彈寶石」、3 關出現冰塊（不能移動，要消兩次）、
     4 關出現時鐘寶石（+5 秒）、5 關多一種顏色 */
  var LV_AT = [0, 300, 800, 1500, 2400];
  var LV_MSG = ['', '新獎勵：一次消 4 顆會變出炸彈寶石', '新障礙：冰塊寶石（不能移動，要消兩次）', '新獎勵：時鐘寶石（消掉 +5 秒）', '多了一種顏色，更難了！'];
  var lvl = 1;
  function gem(t, r) {
    var g = { t: t, y: r, scale: 1, dying: false };
    if (lvl >= 3 && Math.random() < 0.04) g.ice = true;
    else if (lvl >= 4 && Math.random() < 0.04) g.special = 'clock';
    return g;
  }
  function freeze(n) {
    for (var k = 0; k < n; k++) { var g = grid[GG.randInt(0, N - 1)][GG.randInt(0, N - 1)]; if (g && !g.special) g.ice = true; }
  }
  function newType(r, c) {
    var t, tries = 0;
    do { t = GG.randInt(0, TYPES - 1); tries++; }
    while (tries < 20 && ((c >= 2 && grid[r][c - 1] && grid[r][c - 2] && grid[r][c - 1].t === t && grid[r][c - 2].t === t) ||
      (r >= 2 && grid[r - 1][c] && grid[r - 2][c] && grid[r - 1][c].t === t && grid[r - 2][c].t === t)));
    return t;
  }
  function fill() {
    grid = [];
    for (var r = 0; r < N; r++) { grid.push([]); for (var c = 0; c < N; c++) grid[r].push(null); }
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) { grid[r][c] = gem(newType(r, c), r - N - 1); grid[r][c].ice = false; grid[r][c].special = null; }
    if (!findMove()) fill();
  }
  function findMatches() {
    var m = [], r, c, k, any = false;
    for (r = 0; r < N; r++) m.push(new Array(N).fill(false));
    for (r = 0; r < N; r++) for (c = 0; c < N;) {
      k = c;
      while (k < N && grid[r][k] && grid[r][c] && grid[r][k].t === grid[r][c].t) k++;
      if (k - c >= 3) { for (var i = c; i < k; i++) m[r][i] = true; any = true; }
      c = Math.max(k, c + 1);
    }
    for (c = 0; c < N; c++) for (r = 0; r < N;) {
      k = r;
      while (k < N && grid[k][c] && grid[r][c] && grid[k][c].t === grid[r][c].t) k++;
      if (k - r >= 3) { for (var j = r; j < k; j++) m[j][c] = true; any = true; }
      r = Math.max(k, r + 1);
    }
    return any ? m : null;
  }
  function swapCells(a, b) { var t = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t; }
  function findMove() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var dirs = [[0, 1], [1, 0]];
      for (var d = 0; d < 2; d++) {
        var r2 = r + dirs[d][0], c2 = c + dirs[d][1];
        if (r2 >= N || c2 >= N || grid[r][c].ice || grid[r2][c2].ice) continue;
        swapCells([r, c], [r2, c2]);
        var ok = findMatches();
        swapCells([r, c], [r2, c2]);
        if (ok) return [[r, c], [r2, c2]];
      }
    }
    return null;
  }
  function trySwap(a, b) {
    if (phase !== 'idle') return;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
    if (grid[a[0]][a[1]].ice || grid[b[0]][b[1]].ice) { GG.sfx('hit'); GG.shake(3, 0.1); sel = null; return; }
    swapA = a; swapB = b; swapT = 0; swapBack = false; phase = 'swap'; sel = null; hint = null; hintT = 0;
    GG.sfx('move');
  }
  function clearMatches(m) {
    var n = 0, cx = 0, cy = 0, r, c, cnt = 0, first = null;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (m[r][c]) { cnt++; if (!first) first = [r, c]; }
    // 4 顆以上：留一顆變成炸彈寶石（第 2 關起）
    var makeBomb = null;
    if (lvl >= 2 && cnt >= 4 && combo === 0) {
      makeBomb = swapB && m[swapB[0]][swapB[1]] ? swapB : swapA && m[swapA[0]][swapA[1]] ? swapA : first;
      if (grid[makeBomb[0]][makeBomb[1]].ice || grid[makeBomb[0]][makeBomb[1]].special === 'bomb') makeBomb = null;
    }
    // 炸彈寶石被消掉時，連周圍 3x3 一起炸
    var q = [];
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (m[r][c] && grid[r][c].special === 'bomb') q.push([r, c]);
    while (q.length) {
      var b = q.pop();
      GG.burst(bx + (b[1] + 0.5) * cell, by + (b[0] + 0.5) * cell, { n: 14, colors: ['#ffb347', '#fff3a0', '#ff6b6b'], size: cell * 0.2, speed: 320 });
      GG.sfx('boom'); GG.shake(6, 0.2);
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = b[0] + dr, cc = b[1] + dc;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N || m[rr][cc]) continue;
        m[rr][cc] = true;
        if (grid[rr][cc].special === 'bomb') q.push([rr, cc]);
      }
    }
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (m[r][c]) {
      var g0 = grid[r][c];
      n++; cx += c; cy += r;
      if (g0.ice) { g0.ice = false; GG.burst(bx + (c + 0.5) * cell, by + (r + 0.5) * cell, { n: 6, colors: ['#bfefff', '#ffffff'], size: cell * 0.14, speed: 220 }); continue; }
      if (makeBomb && r === makeBomb[0] && c === makeBomb[1]) { g0.special = 'bomb'; continue; }
      if (g0.special === 'clock') { timeLeft = Math.min(totalT + 30, timeLeft + 5); GG.floatText(bx + (c + 0.5) * cell, by + (r + 0.5) * cell - cell, '+5 秒', '#9fe3ff', 28); }
      g0.dying = true;
      GG.burst(bx + (c + 0.5) * cell, by + (r + 0.5) * cell, { n: 3, img: '_star', size: cell * 0.3, speed: 200, life: 0.5 });
    }
    combo++;
    var pts = n * 10 * combo;
    score += pts; GG.setScore(score);
    var LA = LV_AT[lvl] * [1, 1.2, 1.4][d0];
    if (lvl < LV_AT.length && score >= LA) {
      lvl++; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]);
      if (lvl === 3) freeze(6);
      if (lvl === 5) TYPES = Math.min(6, TYPES + 1);
    }
    GG.floatText(bx + (cx / n + 0.5) * cell, by + (cy / n + 0.5) * cell, '+' + pts + (combo > 1 ? ' 連擊x' + combo : ''), '#ffe14d', 30);
    if (n >= 4) { timeLeft = Math.min(totalT, timeLeft + (n - 3) * 3); GG.shake(4, 0.15); }
    GG.sfx(combo > 1 ? 'clear' : 'pop');
    phase = 'clear';
  }
  function collapse() {
    for (var c = 0; c < N; c++) {
      var write = N - 1;
      for (var r = N - 1; r >= 0; r--) {
        var g = grid[r][c];
        if (g && !g.dying) { grid[r][c] = null; grid[write][c] = g; write--; }
        else grid[r][c] = null;
      }
      for (var k = write, sr = -1; k >= 0; k--, sr--) grid[k][c] = gem(GG.randInt(0, TYPES - 1), sr);
    }
    phase = 'fall';
  }
  var down0 = null;
  function cellAt(x, y) {
    var c = Math.floor((x - bx) / cell), r = Math.floor((y - by) / cell);
    return r < 0 || c < 0 || r >= N || c >= N ? null : [r, c];
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { lvl = n; if (n >= 3) freeze(6); };

  GG.define({
    assets: ASSETS,
    start: function (d) {
      d0 = d;
      TYPES = d === 2 ? 6 : 5;
      N = d === 0 ? 7 : 8;
      totalT = [150, 120, 90][d];
      timeLeft = totalT; score = 0; combo = 0; sel = null; hint = null; hintT = 0; lvl = 1; swapA = swapB = null;
      this.resize(GG.W, GG.H);
      fill(); phase = 'fall';
      GG.setScore(0);
    },
    resize: function (w, h) {
      bs = Math.min(w - 24, h - 100, 640);
      cell = Math.floor(bs / N); bs = cell * N;
      bx = Math.round((w - bs) / 2); by = Math.round((h - bs) / 2 + 30);
      GG.canvasLayer('bg').paint(function (g) {
        GG.bg(g, w, h, '#6a3fc4', '#2a1468');
        g.globalAlpha = 0.16;
        for (var k = 0; k < 16; k++) GG.spr(g, '_star', (k * 137) % w, (k * 251) % h, 26 + (k % 3) * 12);
        g.globalAlpha = 1;
        GG.panel(g, bx - 10, by - 10, bs + 20, bs + 20, 20, '#f3ecff');
        for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
          g.fillStyle = (r + c) % 2 ? '#e4d8fb' : '#efe7ff';
          g.fillRect(bx + c * cell, by + r * cell, cell, cell);
        }
        var tw = Math.min(bs, w - 40);
        g.fillStyle = 'rgba(0,0,0,0.3)'; GG.rr(g, (w - tw) / 2, by - 56, tw, 28, 14); g.fill();
      });
    },
    update: function (dt) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        var th = [[400, 900, 1600], [500, 1100, 2000], [500, 1200, 2200]][d0];
        GG.over({ score: score, win: true, title: '時間到！', stars: GG.starsFor(score, th[0], th[1], th[2]) });
        return;
      }
      var r, c, g;
      if (phase === 'swap') {
        swapT += dt / 0.16;
        if (swapT >= 1) {
          swapCells(swapA, swapB);
          if (swapBack) { phase = 'idle'; return; }
          var m = findMatches();
          if (m) { combo = 0; clearMatches(m); } else { swapBack = true; swapT = 0; GG.sfx('hit'); }
        }
      } else if (phase === 'clear') {
        var done = true;
        for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
          g = grid[r][c];
          if (g && g.dying) { g.scale -= dt / 0.2; if (g.scale > 0) done = false; }
        }
        if (done) collapse();
      } else if (phase === 'fall') {
        var moving = false;
        for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
          g = grid[r][c];
          if (g.y < r) { g.y = Math.min(r, g.y + dt * 12); moving = true; }
        }
        if (!moving) {
          var m2 = findMatches();
          if (m2) clearMatches(m2);
          else {
            phase = 'idle'; combo = 0;
            if (!findMove()) { fill(); phase = 'fall'; GG.floatText(bx + bs / 2, by + bs / 2, '重新洗牌！', '#fff', 36); }
          }
        }
      } else if (phase === 'idle') {
        hintT += dt;
        if (hintT > (d0 === 2 ? 8 : 4) && !hint) hint = findMove();
      }
    },
    draw: function (ctx, w) {
      var tw = Math.min(bs, w - 40), tx = (w - tw) / 2, ty = by - 56, p = timeLeft / totalT;
      ctx.fillStyle = p > 0.3 ? '#43d17a' : (p > 0.15 ? '#ffb300' : '#ff5252');
      GG.rr(ctx, tx, ty, Math.max(28, tw * p), 28, 14); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; GG.rr(ctx, tx, ty, tw, 28, 14); ctx.stroke();
      GG.text(ctx, Math.ceil(timeLeft) + ' 秒・第 ' + lvl + ' 關', w / 2, ty + 14, 18, '#fff', 'center', true);
      if (sel) GG.spr(ctx, 'sel', bx + (sel[1] + 0.5) * cell, by + (sel[0] + 0.5) * cell, cell * 1.05, cell * 1.05);
      ctx.save();
      ctx.beginPath(); ctx.rect(bx, by, bs, bs); ctx.clip();
      var pulse = hint ? 1 + Math.sin(Date.now() / 120) * 0.12 : 1;
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var g = grid[r][c];
        if (!g) continue;
        var x = c, y = g.y;
        if (phase === 'swap') {
          // A 格的寶石滑向 B、B 格滑向 A，動畫結束才真的交換
          var t = GG.ease(Math.min(1, swapT));
          if (r === swapA[0] && c === swapA[1]) { x = GG.lerp(swapA[1], swapB[1], t); y = GG.lerp(swapA[0], swapB[0], t); }
          else if (r === swapB[0] && c === swapB[1]) { x = GG.lerp(swapB[1], swapA[1], t); y = GG.lerp(swapB[0], swapA[0], t); }
        }
        var sc = Math.max(0, g.scale) * 0.86;
        if (hint && ((hint[0][0] === r && hint[0][1] === c) || (hint[1][0] === r && hint[1][1] === c))) sc *= pulse;
        var s = cell * sc;
        if (s > 0.5) {
          var gx = bx + (x + 0.5) * cell, gy = by + (y + 0.5) * cell;
          ctx.drawImage(GG.img['g' + g.t], gx - s / 2, gy - s / 2, s, s);
          if (g.special === 'bomb') GG.spr(ctx, 'bomb', gx + s * 0.18, gy + s * 0.18, s * 0.55, s * 0.55);
          else if (g.special === 'clock') {
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx + s * 0.25, gy + s * 0.25, s * 0.22, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = '#3d8bfd'; ctx.stroke();
            ctx.strokeStyle = GG.INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(gx + s * 0.25, gy + s * 0.25); ctx.lineTo(gx + s * 0.25, gy + s * 0.1); ctx.moveTo(gx + s * 0.25, gy + s * 0.25); ctx.lineTo(gx + s * 0.36, gy + s * 0.28); ctx.stroke();
          }
          if (g.ice) {
            ctx.fillStyle = 'rgba(190,235,255,0.6)'; GG.rr(ctx, gx - cell * 0.46, gy - cell * 0.46, cell * 0.92, cell * 0.92, cell * 0.14); ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(gx - cell * 0.3, gy - cell * 0.1); ctx.lineTo(gx - cell * 0.1, gy - cell * 0.3); ctx.stroke();
          }
        }
      }
      ctx.restore();
    },
    down: function (p) { down0 = { x: p.x, y: p.y, cell: cellAt(p.x, p.y) }; },
    move: function (p) {
      if (!down0 || !down0.cell) return;
      var d = GG.swipeDir(down0.x, down0.y, p.x, p.y, cell * 0.3);
      if (!d) return;
      var a = down0.cell, b = [a[0] + (d === 'down' ? 1 : d === 'up' ? -1 : 0), a[1] + (d === 'right' ? 1 : d === 'left' ? -1 : 0)];
      down0 = null;
      if (b[0] >= 0 && b[1] >= 0 && b[0] < N && b[1] < N) trySwap(a, b);
    },
    up: function () {
      if (!down0) return;
      var c = down0.cell; down0 = null;
      if (!c || phase !== 'idle') return;
      if (sel && Math.abs(sel[0] - c[0]) + Math.abs(sel[1] - c[1]) === 1) trySwap(sel, c);
      else if (sel && sel[0] === c[0] && sel[1] === c[1]) sel = null;
      else { sel = c; GG.sfx('click'); }
    }
  });
})();
