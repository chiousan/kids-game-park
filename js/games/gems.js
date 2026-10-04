/* 寶石消消樂 */
(function () {
  var N = 8, TYPES = 6, grid, score, timeLeft, totalTime, phase, combo, sel, swapA, swapB, swapT, swapBack;
  var bx, by, bs, cell, sprites = [], floats, sparks = [], hintT, hint;
  var GEMS = ['red_diamond', 'blue_square', 'green_polygon', 'yellow_diamond', 'purple_polygon', 'grey_square'];
  var ASSETS = { star: 'puzzle/star', sel: 'puzzle/selector' };
  GEMS.forEach(function (g, i) { ASSETS['g' + i] = 'puzzle/gem_' + g; });
  function makeSprites() { sprites = GEMS.map(function (g, i) { return GG.img['g' + i]; }); }

  function gem(t, r) { return { t: t, y: r, scale: 1, dying: false }; }
  function newType(r, c) {
    var t, tries = 0;
    do {
      t = GG.randInt(0, TYPES - 1); tries++;
    } while (tries < 20 && ((c >= 2 && grid[r][c - 1] && grid[r][c - 2] && grid[r][c - 1].t === t && grid[r][c - 2].t === t) ||
      (r >= 2 && grid[r - 1][c] && grid[r - 2][c] && grid[r - 1][c].t === t && grid[r - 2][c].t === t)));
    return t;
  }
  function fill() {
    grid = [];
    for (var r = 0; r < N; r++) { grid.push([]); for (var c = 0; c < N; c++) grid[r].push(null); }
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) grid[r][c] = gem(newType(r, c), r - N - 1);
    if (!findMove()) fill();
  }
  function findMatches() {
    var m = [], r, c, k;
    for (r = 0; r < N; r++) m.push(new Array(N).fill(false));
    var any = false;
    for (r = 0; r < N; r++) {
      for (c = 0; c < N;) {
        k = c;
        while (k < N && grid[r][k] && grid[r][c] && grid[r][k].t === grid[r][c].t) k++;
        if (k - c >= 3) { for (var i = c; i < k; i++) m[r][i] = true; any = true; }
        c = Math.max(k, c + 1);
      }
    }
    for (c = 0; c < N; c++) {
      for (r = 0; r < N;) {
        k = r;
        while (k < N && grid[k][c] && grid[r][c] && grid[k][c].t === grid[r][c].t) k++;
        if (k - r >= 3) { for (var j = r; j < k; j++) m[j][c] = true; any = true; }
        r = Math.max(k, r + 1);
      }
    }
    return any ? m : null;
  }
  function swapCells(a, b) { var t = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t; }
  function findMove() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var dirs = [[0, 1], [1, 0]];
      for (var d = 0; d < 2; d++) {
        var r2 = r + dirs[d][0], c2 = c + dirs[d][1];
        if (r2 >= N || c2 >= N) continue;
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
    swapA = a; swapB = b; swapT = 0; swapBack = false; phase = 'swap'; sel = null; hint = null; hintT = 0;
    GG.sfx('move');
  }
  function clearMatches(m) {
    var n = 0;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (m[r][c]) { grid[r][c].dying = true; n++; }
    combo++;
    var pts = n * 10 * combo;
    score += pts;
    GG.setScore(score);
    var cx = 0, cy = 0, k = 0;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (m[r][c]) { cx += c; cy += r; k++; }
    floats.push({ x: bx + (cx / k + 0.5) * cell, y: by + (cy / k + 0.5) * cell, s: '+' + pts + (combo > 1 ? ' 連擊x' + combo : ''), t: 0 });
    if (n >= 4) timeLeft = Math.min(totalTime, timeLeft + (n - 3) * 2);
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
      for (var k = write, spawnRow = -1; k >= 0; k--, spawnRow--) grid[k][c] = gem(GG.randInt(0, TYPES - 1), spawnRow);
    }
    phase = 'fall';
  }

  var down0 = null;
  function cellAt(x, y) {
    var c = Math.floor((x - bx) / cell), r = Math.floor((y - by) / cell);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    return [r, c];
  }

  GG.define({
    assets: ASSETS,
    start: function (d) {
      TYPES = d === 0 ? 5 : 6;
      N = d === 0 ? 7 : 8;
      totalTime = [120, 90, 60][d];
      timeLeft = totalTime; score = 0; combo = 0; sel = null; floats = []; sparks = []; hint = null; hintT = 0;
      this.resize(GG.W, GG.H);
      fill();
      phase = 'fall';
      GG.setScore(0);
    },
    resize: function (w, h) {
      bs = Math.min(w - 24, h - 90, 640);
      cell = Math.floor(bs / N);
      bs = cell * N;
      bx = Math.round((w - bs) / 2); by = Math.round((h - bs) / 2 + 30);
      makeSprites();
    },
    update: function (dt) {
      if (phase !== 'end') {
        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; phase = 'end'; GG.over({ score: score, win: true, title: '時間到！' }); return; }
      }
      for (var i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 1) floats.splice(i, 1); }
      for (i = sparks.length - 1; i >= 0; i--) {
        var sp = sparks[i]; sp.t += dt; sp.vy += 500 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt;
        if (sp.t > 0.6) sparks.splice(i, 1);
      }
      var r, c, g;
      if (phase === 'swap') {
        swapT += dt / 0.16;
        if (swapT >= 1) {
          swapCells(swapA, swapB);
          if (swapBack) { phase = 'idle'; return; }
          var m = findMatches();
          if (m) { combo = 0; clearMatches(m); }
          else { swapBack = true; swapT = 0; GG.sfx('hit'); }
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
            if (!findMove()) { fill(); phase = 'fall'; floats.push({ x: bx + bs / 2, y: by + bs / 2, s: '重新洗牌！', t: 0 }); }
          }
        }
      } else if (phase === 'idle') {
        hintT += dt;
        if (hintT > 6 && !hint) hint = findMove();
      }
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#5b2fb0', '#22105a');
      // 背景小星星
      ctx.globalAlpha = 0.18;
      for (var k = 0; k < 14; k++) GG.spr(ctx, 'star', (k * 137) % w, (k * 251) % h, 26 + (k % 3) * 10);
      ctx.globalAlpha = 1;
      // 時間條
      var tw = Math.min(bs, w - 40), tx = (w - tw) / 2, ty = by - 50;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; GG.rr(ctx, tx, ty, tw, 26, 13); ctx.fill();
      var p = timeLeft / totalTime;
      ctx.fillStyle = p > 0.3 ? '#43d17a' : (p > 0.15 ? '#ffb300' : '#ff5252');
      if (p > 0) { GG.rr(ctx, tx, ty, Math.max(26, tw * p), 26, 13); ctx.fill(); }
      ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; GG.rr(ctx, tx, ty, tw, 26, 13); ctx.stroke();
      GG.text(ctx, Math.ceil(timeLeft) + ' 秒', w / 2, ty + 13, 16, '#fff', 'center', true);
      // 棋盤
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; GG.rr(ctx, bx - 10, by - 4, bs + 20, bs + 20, 20); ctx.fill();
      ctx.fillStyle = '#f3ecff'; GG.rr(ctx, bx - 10, by - 10, bs + 20, bs + 20, 20); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; GG.rr(ctx, bx - 10, by - 10, bs + 20, bs + 20, 20); ctx.stroke();
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#e4d8fb' : '#efe7ff';
        ctx.fillRect(bx + c * cell, by + r * cell, cell, cell);
      }
      if (sel) GG.spr(ctx, 'sel', bx + (sel[1] + 0.5) * cell, by + (sel[0] + 0.5) * cell, cell * 1.05, cell * 1.05);
      ctx.save();
      ctx.beginPath(); ctx.rect(bx, by, bs, bs); ctx.clip();
      var hintPulse = hint ? 1 + Math.sin(Date.now() / 120) * 0.1 : 1;
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
        var g = grid[r][c];
        if (!g) continue;
        var x = c, y = g.y;
        if (phase === 'swap') {
          // 不論正向或退回，A 格的寶石都滑向 B、B 格滑向 A，動畫結束才真的交換
          var t = GG.ease(Math.min(1, swapT));
          if (r === swapA[0] && c === swapA[1]) { x = GG.lerp(swapA[1], swapB[1], t); y = GG.lerp(swapA[0], swapB[0], t); }
          else if (r === swapB[0] && c === swapB[1]) { x = GG.lerp(swapB[1], swapA[1], t); y = GG.lerp(swapB[0], swapA[0], t); }
        }
        var sc = Math.max(0, g.scale) * 0.86;
        if (hint && ((hint[0][0] === r && hint[0][1] === c) || (hint[1][0] === r && hint[1][1] === c))) sc *= hintPulse;
        var s = cell * sc;
        if (s > 0.5) GG.spr(ctx, sprites[g.t], bx + (x + 0.5) * cell, by + (y + 0.5) * cell, s, s);
      }
      ctx.restore();
      for (var i = 0; i < sparks.length; i++) {
        var sp = sparks[i];
        GG.spr(ctx, 'star', sp.x, sp.y, cell * 0.4 * (1 - sp.t / 0.6), null, { alpha: 1 - sp.t / 0.6, rot: sp.t * 6 });
      }
      for (i = 0; i < floats.length; i++) {
        var f = floats[i];
        ctx.globalAlpha = 1 - f.t;
        GG.text(ctx, f.s, f.x, f.y - f.t * 50, 28, '#ffe14d', 'center', true);
      }
      ctx.globalAlpha = 1;
    },
    down: function (p) { down0 = { x: p.x, y: p.y, cell: cellAt(p.x, p.y) }; },
    move: function (p) {
      if (!down0 || !down0.cell) return;
      var d = GG.swipeDir(down0.x, down0.y, p.x, p.y, cell * 0.35);
      if (!d) return;
      var a = down0.cell, b = [a[0] + (d === 'down' ? 1 : d === 'up' ? -1 : 0), a[1] + (d === 'right' ? 1 : d === 'left' ? -1 : 0)];
      down0 = null;
      if (b[0] >= 0 && b[1] >= 0 && b[0] < N && b[1] < N) trySwap(a, b);
    },
    up: function (p) {
      if (!down0) return;
      var c = down0.cell; down0 = null;
      if (!c || phase !== 'idle') return;
      if (sel && Math.abs(sel[0] - c[0]) + Math.abs(sel[1] - c[1]) === 1) trySwap(sel, c);
      else if (sel && sel[0] === c[0] && sel[1] === c[1]) sel = null;
      else { sel = c; GG.sfx('click'); }
    }
  });
})();
