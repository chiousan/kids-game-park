/* 2048（懶惰重繪：沒有動畫時不重畫） */
(function () {
  var N = 4, grid, score, sprites, animT, pops, spawnP4, won, pending, d0, maxTile;
  var bs, cell, gap, sx, sy;
  var ANIM = 0.11;
  var COLORS = {
    2: ['#fff4d6', '#7a5b2e'], 4: ['#ffe6a8', '#7a5b2e'], 8: ['#ffc06b', '#fff'], 16: ['#ff9f4a', '#fff'],
    32: ['#ff7b54', '#fff'], 64: ['#ff5252', '#fff'], 128: ['#ffd54f', '#fff'], 256: ['#ffca28', '#fff'],
    512: ['#9ccc65', '#fff'], 1024: ['#26c6da', '#fff'], 2048: ['#ab47bc', '#fff'], 4096: ['#5c6bc0', '#fff']
  };
  var tileCache = {};
  /* 關卡：依最大數字升關。石頭＝擋路的障礙（不會動、幾步後碎掉）；星星＝萬用方塊（和任何數字合併變兩倍） */
  var STONE = -1, STAR = -2;
  var LV_AT = [0, 64, 128, 256, 512, 1024];
  var LV_MSG = ['', '新障礙：石頭方塊（擋路，10 步後碎掉）', '新獎勵：星星萬用方塊（和誰合併都變兩倍）', '石頭變多了，4 也變多了！',
    '新獎勵：一次合併 3 組以上，接下來 8 步分數加倍', '最高難度！'];
  var lvl = 1, life = {}, doubleMoves = 0;
  function canMerge(a, b) { return (a > 0 && a === b) || (a === STAR && b > 0) || (b === STAR && a > 0); }
  function mergeVal(a, b) { return a === STAR ? b * 2 : b === STAR ? a * 2 : a * 2; }

  function empty() { var g = []; for (var r = 0; r < N; r++) { g.push([]); for (var c = 0; c < N; c++) g[r].push(0); } return g; }
  function spawn() {
    var free = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!grid[r][c]) free.push([r, c]);
    if (!free.length) return;
    var p = GG.pick(free);
    grid[p[0]][p[1]] = lvl >= 3 && Math.random() < 0.07 ? STAR : Math.random() < spawnP4 + (lvl >= 4 ? 0.1 : 0) ? 4 : 2;
    pops.push({ r: p[0], c: p[1], t: 0, kind: 'new' });
  }
  function spawnStone() {
    var free = [], stones = 0;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { if (!grid[r][c]) free.push([r, c]); if (grid[r][c] === STONE) stones++; }
    if (free.length < 4 || stones >= (lvl >= 4 ? 2 : 1)) return;
    var p = GG.pick(free);
    grid[p[0]][p[1]] = STONE; life[p[0] + ',' + p[1]] = 10;
    pops.push({ r: p[0], c: p[1], t: 0, kind: 'new' });
  }
  function canMove() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = grid[r][c];
      if (!v) return true;
      if (c + 1 < N && canMerge(v, grid[r][c + 1])) return true;
      if (r + 1 < N && canMerge(v, grid[r + 1][c])) return true;
    }
    return false;
  }
  function cellXY(r, c) { return [sx + gap + c * (cell + gap), sy + gap + r * (cell + gap)]; }
  // 每種數字方塊只畫一次，之後直接貼圖
  function tileImg(v) {
    var k = v + '|' + Math.round(cell);
    if (tileCache[k]) return tileCache[k];
    var col = COLORS[v] || ['#3d2c8d', '#fff'];
    if (v === STONE || v === STAR) return (tileCache[k] = GG.sprite(cell, cell + 6, function (g, s) {
      var r = s * 0.18;
      g.fillStyle = 'rgba(58,56,80,0.35)'; GG.rr(g, 2, 7, s - 4, s - 4, r); g.fill();
      g.fillStyle = v === STONE ? '#9a98a8' : '#8e5cf0'; GG.rr(g, 2, 2, s - 4, s - 4, r); g.fill();
      if (v === STONE) {
        g.strokeStyle = 'rgba(58,56,80,0.45)'; g.lineWidth = Math.max(2, s * 0.03);
        g.beginPath(); g.moveTo(s * 0.2, s * 0.3); g.lineTo(s * 0.45, s * 0.45); g.lineTo(s * 0.4, s * 0.7); g.moveTo(s * 0.45, s * 0.45); g.lineTo(s * 0.75, s * 0.38); g.stroke();
      } else GG.spr(g, '_star', s / 2, s / 2, s * 0.66, s * 0.66);
      g.fillStyle = 'rgba(255,255,255,0.3)'; GG.rr(g, s * 0.14, s * 0.1, s * 0.72, s * 0.18, s * 0.09); g.fill();
      g.lineWidth = Math.max(2.5, s * 0.045); g.strokeStyle = GG.INK; GG.rr(g, 2, 2, s - 4, s - 4, r); g.stroke();
    }));
    return (tileCache[k] = GG.sprite(cell, cell + 6, function (g, s) {
      var r = s * 0.18;
      g.fillStyle = 'rgba(58,56,80,0.35)'; GG.rr(g, 2, 7, s - 4, s - 4, r); g.fill();
      g.fillStyle = col[0]; GG.rr(g, 2, 2, s - 4, s - 4, r); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; GG.rr(g, s * 0.14, s * 0.1, s * 0.72, s * 0.18, s * 0.09); g.fill();
      g.lineWidth = Math.max(2.5, s * 0.045); g.strokeStyle = GG.INK; GG.rr(g, 2, 2, s - 4, s - 4, r); g.stroke();
      var digits = String(v).length, fs = s * (digits <= 2 ? 0.46 : digits === 3 ? 0.36 : 0.28);
      g.font = '900 ' + Math.round(fs) + 'px ' + GG.FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (col[1] === '#fff') { g.lineJoin = 'round'; g.lineWidth = fs * 0.18; g.strokeStyle = GG.INK; g.strokeText(String(v), s / 2, s / 2 + 3); }
      g.fillStyle = col[1]; g.fillText(String(v), s / 2, s / 2 + 3);
    }));
  }
  function drawTile(ctx, v, x, y, s) {
    var o = (cell - s) / 2;
    ctx.drawImage(tileImg(v), x + o, y + o, s, s * (cell + 6) / cell);
  }
  function move(dir) {
    if (animT < 1) { pending = dir; return; }
    var ng = empty(), moved = false, gained = 0, sp = [], merged = [];
    function slide(seg) {
      var target = 0, last = null;
      for (var j = 0; j < seg.length; j++) {
        var r = seg[j][0], c = seg[j][1], v = grid[r][c];
        if (!v) continue;
        var to;
        if (last && canMerge(last.v, v)) {
          to = last.to;
          var nv = mergeVal(last.v, v);
          ng[to[0]][to[1]] = nv; gained += nv;
          merged.push({ r: to[0], c: to[1], t: 0, kind: 'merge', v: nv });
          last = null;
        } else {
          to = seg[target]; ng[to[0]][to[1]] = v; last = { v: v, to: to }; target++;
        }
        if (to[0] !== r || to[1] !== c) moved = true;
        sp.push({ v: v, fr: r, fc: c, tr: to[0], tc: to[1] });
      }
    }
    for (var i = 0; i < N; i++) {
      var cells = [];
      for (var k = 0; k < N; k++) {
        if (dir === 0) cells.push([k, i]);
        else if (dir === 2) cells.push([N - 1 - k, i]);
        else if (dir === 3) cells.push([i, k]);
        else cells.push([i, N - 1 - k]);
      }
      // 石頭不會動：把一行從石頭的位置切成幾段，各自往前推
      var seg = [];
      for (k = 0; k <= N; k++) {
        if (k === N || grid[cells[k][0]][cells[k][1]] === STONE) {
          slide(seg); seg = [];
          if (k < N) { var sc = cells[k]; ng[sc[0]][sc[1]] = STONE; sp.push({ v: STONE, fr: sc[0], fc: sc[1], tr: sc[0], tc: sc[1] }); }
        } else seg.push(cells[k]);
      }
    }
    if (!moved) return;
    if (doubleMoves > 0) { gained *= 2; doubleMoves--; }
    if (lvl >= 5 && merged.length >= 3) { doubleMoves = 8; GG.floatText(GG.W / 2, sy - 10, '分數加倍 8 步！', '#ffe14d', 34); }
    grid = ng; score += gained; sprites = sp; animT = 0; pops = merged;
    GG.setScore(score);
    GG.sfx(gained ? 'pop' : 'move');
    // 石頭倒數，時間到就碎掉
    for (var key in life) {
      var rc = key.split(','), rr = +rc[0], cc2 = +rc[1];
      if (grid[rr][cc2] !== STONE) { delete life[key]; continue; }
      if (--life[key] <= 0) {
        grid[rr][cc2] = 0; delete life[key];
        var sp2 = cellXY(rr, cc2);
        GG.burst(sp2[0] + cell / 2, sp2[1] + cell / 2, { n: 10, colors: ['#9a98a8', '#6d6b7a'], size: cell * 0.12, speed: 240 });
      }
    }
    spawn();
    if (lvl >= 2 && Math.random() < (lvl >= 4 ? 0.14 : 0.09)) spawnStone();
    maxTile = 0;
    for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) maxTile = Math.max(maxTile, grid[r2][c2]);
    merged.forEach(function (m) {
      if (m.v >= 32) {
        var p = cellXY(m.r, m.c);
        GG.burst(p[0] + cell / 2, p[1] + cell / 2, { n: m.v >= 256 ? 14 : 6, img: '_star', size: cell * 0.25, speed: 260, life: 0.6 });
      }
    });
    if (lvl < LV_AT.length && maxTile >= LV_AT[lvl]) { lvl++; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]); }
    if (maxTile >= 2048 && !won) { won = true; GG.sfx('win'); GG.floatText(GG.W / 2, sy - 10, '合出 2048 了！', '#ffe14d', 40); }
    if (!canMove()) setTimeout(function () {
      var th = d0 === 0 ? [64, 256, 1024] : [128, 512, 2048];
      GG.over({ score: score, win: won, stars: GG.starsFor(maxTile, th[0], th[1], th[2]), title: won ? '太厲害了！' : '沒有路可以走了', text: '最大的數字是 ' + maxTile });
    }, 400);
  }

  var touch0 = null;
  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { lvl = n; if (n >= 2) spawnStone(); };

  GG.define({
    lazy: true,
    start: function (d) {
      d0 = d;
      N = d === 0 ? 5 : 4;
      spawnP4 = d === 2 ? 0.2 : 0.08;
      pending = -1; grid = empty(); score = 0; sprites = []; pops = []; animT = 1; won = false; maxTile = 2; lvl = 1; life = {}; doubleMoves = 0;
      spawn(); spawn();
      GG.setScore(0);
      this.resize(GG.W, GG.H);
    },
    resize: function (w, h) {
      bs = Math.min(w - 32, h - 32, 620);
      sx = (w - bs) / 2; sy = (h - bs) / 2;
      gap = bs * (N === 5 ? 0.025 : 0.03);
      cell = (bs - gap * (N + 1)) / N;
      tileCache = {};
      GG.canvasLayer('bg').paint(function (g) {
        GG.bg(g, w, h, '#fff1dc', '#ffd9b0');
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (var k = 0; k < 8; k++) { g.beginPath(); g.arc((k * 211) % w, (k * 337) % h, 30 + (k % 3) * 20, 0, Math.PI * 2); g.fill(); }
        GG.panel(g, sx, sy, bs, bs, bs * 0.05, '#c9a27a');
        for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
          var p = cellXY(r, c);
          g.fillStyle = 'rgba(255,255,255,0.28)'; GG.rr(g, p[0], p[1], cell, cell, cell * 0.16); g.fill();
        }
      });
    },
    update: function (dt) {
      var busy = false;
      if (animT < 1) {
        busy = true;
        animT = Math.min(1, animT + dt / ANIM);
        if (animT >= 1 && pending >= 0) { var pd = pending; pending = -1; move(pd); }
      } else for (var i = 0; i < pops.length; i++) if (pops[i].t < 1) { pops[i].t = Math.min(1, pops[i].t + dt / 0.18); busy = true; }
      return busy;
    },
    draw: function (ctx) {
      if (animT < 1) {
        var t = GG.ease(animT);
        for (var i = 0; i < sprites.length; i++) {
          var s = sprites[i], a = cellXY(s.fr, s.fc), b = cellXY(s.tr, s.tc);
          drawTile(ctx, s.v, GG.lerp(a[0], b[0], t), GG.lerp(a[1], b[1], t), cell);
        }
        return;
      }
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var v = grid[r][c];
        if (!v) continue;
        var size = cell;
        for (var j = 0; j < pops.length; j++) {
          var pp = pops[j];
          if (pp.r === r && pp.c === c && pp.t < 1) size = pp.kind === 'new' ? cell * GG.back(pp.t) : cell * (1 + 0.18 * Math.sin(pp.t * Math.PI));
        }
        var q = cellXY(r, c);
        if (size > 1) drawTile(ctx, v, q[0], q[1], size);
        if (v === STONE && life[r + ',' + c]) GG.text(ctx, String(life[r + ',' + c]), q[0] + cell * 0.8, q[1] + cell * 0.22, cell * 0.22, '#fff', 'center', true);
      }
      var side = sx > 170, ht = '第 ' + lvl + ' 關' + (doubleMoves > 0 ? (side ? '' : '・') + '加倍 ' + doubleMoves + ' 步' : '');
      GG.hudText(ctx, ht, side ? sx / 2 : GG.W / 2, side ? sy + 30 : Math.max(24, sy - 22), 20, doubleMoves > 0 ? '#ffe14d' : '#fff', 'center');
    },
    down: function (p) { touch0 = p; },
    up: function (p) {
      if (!touch0) return;
      var d = GG.swipeDir(touch0.x, touch0.y, p.x, p.y, 20);
      touch0 = null;
      if (d) move({ up: 0, right: 1, down: 2, left: 3 }[d]);
    },
    key: function (k) {
      var m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
      if (k in m) move(m[k]);
    }
  });
})();
