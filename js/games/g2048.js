/* 2048 */
(function () {
  var N = 4, grid, score, sprites, animT, pops, spawnP4, won, keepGoing;
  var bx, by, bs, cell, gap, sx, sy;
  var ANIM = 0.11;
  var COLORS = {
    2: ['#fff4d6', '#7a5b2e'], 4: ['#ffe6a8', '#7a5b2e'], 8: ['#ffc06b', '#fff'], 16: ['#ff9f4a', '#fff'],
    32: ['#ff7b54', '#fff'], 64: ['#ff5252', '#fff'], 128: ['#ffd54f', '#fff'], 256: ['#ffca28', '#fff'],
    512: ['#9ccc65', '#fff'], 1024: ['#26c6da', '#fff'], 2048: ['#ab47bc', '#fff'], 4096: ['#5c6bc0', '#fff']
  };

  function empty() { var g = []; for (var r = 0; r < N; r++) { g.push([]); for (var c = 0; c < N; c++) g[r].push(0); } return g; }
  function spawn() {
    var free = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!grid[r][c]) free.push([r, c]);
    if (!free.length) return;
    var p = GG.pick(free);
    grid[p[0]][p[1]] = Math.random() < spawnP4 ? 4 : 2;
    pops.push({ r: p[0], c: p[1], t: 0, kind: 'new' });
  }
  function canMove() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = grid[r][c];
      if (!v) return true;
      if (c + 1 < N && grid[r][c + 1] === v) return true;
      if (r + 1 < N && grid[r + 1][c] === v) return true;
    }
    return false;
  }
  // dir: 0 上 1 右 2 下 3 左
  var pending = -1;
  function move(dir) {
    if (animT < 1) { pending = dir; return; }
    var ng = empty(), moved = false, gained = 0, sp = [], merged = [];
    for (var i = 0; i < N; i++) {
      var cells = [];
      for (var k = 0; k < N; k++) {
        if (dir === 0) cells.push([k, i]);
        else if (dir === 2) cells.push([N - 1 - k, i]);
        else if (dir === 3) cells.push([i, k]);
        else cells.push([i, N - 1 - k]);
      }
      var target = 0, lastVal = 0;
      for (k = 0; k < N; k++) {
        var r = cells[k][0], c = cells[k][1], v = grid[r][c];
        if (!v) continue;
        var to;
        if (lastVal === v) {
          to = cells[target - 1];
          ng[to[0]][to[1]] = v * 2;
          gained += v * 2;
          merged.push({ r: to[0], c: to[1], t: 0, kind: 'merge' });
          lastVal = 0;
        } else {
          to = cells[target];
          ng[to[0]][to[1]] = v;
          lastVal = v;
          target++;
        }
        if (to[0] !== r || to[1] !== c) moved = true;
        sp.push({ v: v, fr: r, fc: c, tr: to[0], tc: to[1] });
      }
    }
    if (!moved) return;
    grid = ng; score += gained; sprites = sp; animT = 0;
    pops = merged;
    GG.setScore(score);
    GG.sfx(gained ? 'pop' : 'move');
    spawn();
    var best = 0;
    for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) best = Math.max(best, grid[r2][c2]);
    if (best >= 2048 && !won) { won = true; GG.sfx('win'); }
    if (!canMove()) setTimeout(function () {
      GG.over({ score: score, win: won, title: won ? '太厲害了！' : '沒有路可以走了', text: '最大的數字是 ' + best });
    }, 400);
  }

  function cellXY(r, c) { return [sx + gap + c * (cell + gap), sy + gap + r * (cell + gap)]; }
  function drawTile(ctx, v, x, y, s) {
    var col = COLORS[v] || ['#3d2c8d', '#fff'];
    var o = (cell - s) / 2, r = s * 0.18;
    ctx.fillStyle = 'rgba(58,56,80,0.35)';
    GG.rr(ctx, x + o, y + o + 5, s, s, r); ctx.fill();
    ctx.fillStyle = col[0];
    GG.rr(ctx, x + o, y + o, s, s, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    GG.rr(ctx, x + o + s * 0.12, y + o + s * 0.08, s * 0.76, s * 0.2, s * 0.1); ctx.fill();
    ctx.lineWidth = Math.max(2.5, s * 0.045); ctx.strokeStyle = GG.INK;
    GG.rr(ctx, x + o, y + o, s, s, r); ctx.stroke();
    var digits = String(v).length;
    var fs = s * (digits <= 2 ? 0.46 : digits === 3 ? 0.36 : 0.28);
    if (col[1] === '#fff') GG.text(ctx, String(v), x + cell / 2, y + cell / 2 + 2, fs, '#fff', 'center', true);
    else GG.text(ctx, String(v), x + cell / 2, y + cell / 2 + 2, fs, col[1]);
  }

  var touch0 = null;
  GG.define({
    start: function (d) {
      N = d === 0 ? 5 : 4;
      spawnP4 = d === 2 ? 0.35 : 0.1;
      pending = -1; grid = empty(); score = 0; sprites = []; pops = []; animT = 1; won = false; keepGoing = false;
      spawn(); spawn();
      GG.setScore(0);
      this.resize(GG.W, GG.H);
    },
    resize: function (w, h) {
      bs = Math.min(w - 32, h - 32, 620);
      sx = (w - bs) / 2; sy = (h - bs) / 2;
      gap = bs * (N === 5 ? 0.025 : 0.03);
      cell = (bs - gap * (N + 1)) / N;
    },
    update: function (dt) {
      if (animT < 1) {
        animT = Math.min(1, animT + dt / ANIM);
        if (animT >= 1 && pending >= 0) { var pd = pending; pending = -1; move(pd); }
      }
      for (var i = 0; i < pops.length; i++) if (animT >= 1) pops[i].t = Math.min(1, pops[i].t + dt / 0.18);
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#fff1dc', '#ffd9b0');
      ctx.fillStyle = 'rgba(58,56,80,0.3)';
      GG.rr(ctx, sx, sy + 8, bs, bs, bs * 0.05); ctx.fill();
      ctx.fillStyle = '#c9a27a';
      GG.rr(ctx, sx, sy, bs, bs, bs * 0.05); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = GG.INK;
      GG.rr(ctx, sx, sy, bs, bs, bs * 0.05); ctx.stroke();
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var p = cellXY(r, c);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        GG.rr(ctx, p[0], p[1], cell, cell, cell * 0.16); ctx.fill();
      }
      if (animT < 1) {
        var t = GG.ease(animT);
        for (var i = 0; i < sprites.length; i++) {
          var s = sprites[i], a = cellXY(s.fr, s.fc), b = cellXY(s.tr, s.tc);
          drawTile(ctx, s.v, GG.lerp(a[0], b[0], t), GG.lerp(a[1], b[1], t), cell);
        }
        return;
      }
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
        var v = grid[r][c];
        if (!v) continue;
        var size = cell;
        for (var j = 0; j < pops.length; j++) {
          var pp = pops[j];
          if (pp.r === r && pp.c === c && pp.t < 1) {
            size = pp.kind === 'new' ? cell * GG.ease(pp.t) : cell * (1 + 0.18 * Math.sin(pp.t * Math.PI));
          }
        }
        var q = cellXY(r, c);
        if (size > 1) drawTile(ctx, v, q[0], q[1], size);
      }
    },
    down: function (p) { touch0 = p; },
    up: function (p) {
      if (!touch0) return;
      var d = GG.swipeDir(touch0.x, touch0.y, p.x, p.y, 20);
      touch0 = null;
      if (d) move({ up: 0, right: 1, down: 2, left: 3 }[d]);
    },
    key: function (k) {
      var m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
      if (k in m) move(m[k]);
    }
  });
})();
