/* 方塊堆疊 */
(function () {
  var COLS = 10, ROWS = 20;
  var SHAPES = [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  ];
  var board, cur, next, bag, score, lines, level, baseSpeed, fallT, lockT, clearing, clearT, dead, d0;
  var cell, bx, by, side, ghostOn, boardDirty = true;
  var hintT = 0, used = false, rep = { left: 0, right: 0, down: 0 };
  var ASSETS = {};
  for (var ai = 0; ai < 7; ai++) ASSETS['b' + ai] = 'puzzle/block' + ai;
  ASSETS.bomb = 'run/bomb';

  function newBoard() { var b = []; for (var r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(-1)); return b; }
  function fromBag() { if (!bag.length) bag = GG.shuffle([0, 1, 2, 3, 4, 5, 6]); return bag.pop(); }
  function piece(t) {
    var m = SHAPES[t].map(function (row) { return row.slice(); });
    return { t: t, m: m, x: Math.floor((COLS - m.length) / 2), y: t === 0 ? -1 : 0 };
  }
  function fits(m, x, y) {
    for (var r = 0; r < m.length; r++) for (var c = 0; c < m.length; c++) {
      if (!m[r][c]) continue;
      var x2 = x + c, y2 = y + r;
      if (x2 < 0 || x2 >= COLS || y2 >= ROWS) return false;
      if (y2 >= 0 && board[y2][x2] >= 0) return false;
    }
    return true;
  }
  function rotated(m) {
    var n = m.length, o = [];
    for (var r = 0; r < n; r++) { o.push([]); for (var c = 0; c < n; c++) o[r].push(m[n - 1 - c][r]); }
    return o;
  }
  /* 等級（每消 6 行升一級）：2 級起有炸彈方塊（落地時炸掉周圍）、3 級起下面會冒出垃圾行、4 級起垃圾行更常出現 */
  var LV_MSG = ['', '新獎勵：炸彈方塊（落地時炸掉周圍 3x3）', '新障礙：下面會冒出灰色垃圾行！', '垃圾行更常出現、速度更快了！', '最高速度！'];
  var garbageT = 0, greySpr = null;
  function spawn() {
    cur = piece(next); next = fromBag(); fallT = 0; lockT = 0;
    // 炸彈方塊：其中一格是炸彈
    if (level >= 2 && Math.random() < 0.1) {
      var cellsOf = [];
      for (var r0 = 0; r0 < cur.m.length; r0++) for (var c0 = 0; c0 < cur.m.length; c0++) if (cur.m[r0][c0]) cellsOf.push([r0, c0]);
      cur.bomb = GG.pick(cellsOf);
    }
    if (!fits(cur.m, cur.x, cur.y)) {
      dead = true; GG.sfx('boom'); GG.shake(10, 0.3);
      var th = [[3, 10, 25], [5, 15, 35], [8, 20, 40]][d0];
      GG.over({ score: score, stars: GG.starsFor(lines, th[0], th[1], th[2]), text: '消除了 ' + lines + ' 行・等級 ' + level });
    }
  }
  function moveX(d) {
    if (!cur || clearing) return false;
    if (fits(cur.m, cur.x + d, cur.y)) { cur.x += d; lockT = 0; GG.sfx('move'); return true; }
    return false;
  }
  function rotateBomb(b, n) { return b ? [b[1], n - 1 - b[0]] : b; }
  function rotate() {
    if (!cur || clearing || cur.t === 1) return;
    var m = rotated(cur.m), kicks = [0, -1, 1, -2, 2], ob = cur.bomb;
    cur.bomb = rotateBomb(ob, m.length);
    for (var i = 0; i < kicks.length; i++) {
      if (fits(m, cur.x + kicks[i], cur.y)) { cur.m = m; cur.x += kicks[i]; lockT = 0; GG.sfx('click'); return; }
    }
    if (fits(m, cur.x, cur.y - 1)) { cur.m = m; cur.y -= 1; GG.sfx('click'); return; }
    cur.bomb = ob;
  }
  function addGarbage() {
    if (board[0].some(function (v) { return v >= 0; })) return;
    var gap = GG.randInt(0, COLS - 1), row = [];
    for (var c = 0; c < COLS; c++) row.push(c === gap ? -1 : 7);
    board.shift(); board.push(row);
    if (cur && !fits(cur.m, cur.x, cur.y)) cur.y--;
    boardDirty = true; GG.sfx('hit'); GG.shake(5, 0.2);
    GG.floatText(bx + cell * COLS / 2, by + cell * (ROWS - 2), '垃圾行來了！', '#ff8a8a', 30);
  }
  function softDrop() {
    if (!cur || clearing) return;
    if (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; fallT = 0; GG.setScore(score); }
  }
  function hardDrop() {
    if (!cur || clearing) return;
    var n = 0;
    while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; n++; }
    score += n * 2; GG.setScore(score);
    GG.shake(3, 0.1);
    lock();
  }
  function lock() {
    for (var r = 0; r < cur.m.length; r++) for (var c = 0; c < cur.m.length; c++) {
      if (cur.m[r][c] && cur.y + r >= 0) board[cur.y + r][cur.x + c] = cur.t;
    }
    if (cur.bomb) {
      var br = cur.y + cur.bomb[0], bc = cur.x + cur.bomb[1];
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = br + dr, cc = bc + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) board[rr][cc] = -1;
      }
      GG.sfx('boom'); GG.shake(8, 0.3);
      GG.burst(bx + (bc + 0.5) * cell, by + (br + 0.5) * cell, { n: 18, colors: ['#ffb347', '#fff3a0', '#ff6b6b'], size: cell * 0.3, speed: 320 });
      score += 50; GG.setScore(score);
    }
    GG.sfx('bounce');
    cur = null; boardDirty = true;
    var full = [];
    for (r = 0; r < ROWS; r++) if (board[r].every(function (v) { return v >= 0; })) full.push(r);
    if (full.length) {
      clearing = full; clearT = 0; GG.sfx(full.length >= 4 ? 'power' : 'clear');
      full.forEach(function (row) {
        for (var k = 0; k < COLS; k += 2) GG.burst(bx + (k + 0.5) * cell, by + (row + 0.5) * cell, { n: 2, img: '_star', size: cell * 0.5, speed: 240 });
      });
      if (full.length >= 2) GG.floatText(bx + cell * COLS / 2, by + full[0] * cell, ['', '', '好棒！', '超讚！', '太神了！'][full.length], '#ffe14d', 40);
    } else spawn();
  }
  function finishClear() {
    var n = clearing.length;
    clearing.forEach(function (r) { board.splice(r, 1); board.unshift(new Array(COLS).fill(-1)); });
    clearing = null; boardDirty = true;
    lines += n;
    score += [0, 100, 300, 500, 800][n] * level;
    var lv = Math.floor(lines / 6) + 1 + (d0 === 2 ? 1 : 0);
    if (lv > level) { level = lv; GG.banner('等級 ' + level, LV_MSG[Math.min(level, LV_MSG.length) - 1]); }
    GG.setScore(score);
    spawn();
  }
  function interval() { return Math.max(0.1, baseSpeed * Math.pow(0.88, level - 1)); }
  // 已落地的方塊畫在獨立的圖層，只有落地或消行時才重畫
  function paintBoard() {
    boardDirty = false;
    GG.canvasLayer('stack').paint(function (g) {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var v = board[r][c];
        if (v >= 0 && !(clearing && clearing.indexOf(r) >= 0)) g.drawImage(v === 7 ? greySpr : GG.img['b' + v], bx + c * cell, by + r * cell, cell, cell);
      }
    });
  }

  var drag = null;
  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { level = n; lines = (n - 1) * 6; };

  GG.define({
    noHint: true,
    assets: ASSETS,
    start: function (d) {
      d0 = d;
      baseSpeed = [1.1, 0.85, 0.6][d];
      ghostOn = d < 2;
      board = newBoard(); bag = []; score = 0; lines = 0; level = 1 + (d === 2 ? 1 : 0); clearing = null; dead = false;
      hintT = 0; used = false; rep.left = rep.right = rep.down = 0; garbageT = 0;
      next = fromBag(); spawn();
      boardDirty = true;
      GG.setScore(0);
    },
    resize: function (w, h) {
      greySpr = GG.sprite(64, 64, function (g) {
        g.fillStyle = '#8f8da0'; GG.rr(g, 2, 2, 60, 60, 10); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)'; GG.rr(g, 8, 6, 48, 12, 6); g.fill();
        g.lineWidth = 3; g.strokeStyle = '#5b5970'; GG.rr(g, 2, 2, 60, 60, 10); g.stroke();
      });
      // 十字鍵依位置擺（←→ 移動、↑ 旋轉、↓ 加速），另一邊一顆「直接落下」大圓鈕。
      // 直放：按鍵在棋盤下方；橫放：十字鍵在左、落下鈕在右
      var land = w > h * 1.15, ctrlH = land ? 0 : Math.round(GG.clamp(h * 0.28, 210, 290));
      cell = Math.floor(Math.min((h - ctrlH - 28) / ROWS, (w - 32) / (COLS + 5.5)));
      side = cell * 4.5;
      var total = cell * COLS + 16 + side;
      bx = Math.round((w - total) / 2); by = Math.round((h - ctrlH - cell * ROWS) / 2);
      var bs = land ? Math.min(90, (bx - 24) / 3.05) : Math.min(96, ctrlH / 3.1);
      var pcx = land ? bx / 2 : bs * 1.5 + 24, pcy = land ? h * 0.62 : h - ctrlH / 2;
      var dr = land ? Math.min(70, (bx - 40) / 2) : Math.min(80, ctrlH * 0.36);
      var dcx = land ? w - bx / 2 : w - dr - 30, dcy = pcy;
      function key(id, icon, dx, dy, fn) {
        return { id: id, icon: icon, x: pcx + dx * bs - bs / 2, y: pcy + dy * bs - bs / 2, w: bs - 6, h: bs - 6, r: 18,
          color: 'rgba(20,40,120,0.6)', hit: 6,
          onDown: function () { fn(); used = true; if (id in rep) rep[id] = -0.2; },
          onUp: function () { if (id in rep) rep[id] = 0; } };
      }
      GG.setPad([
        key('rot', 'rotate', 0, -1, rotate),
        key('left', 'left', -1, 0, function () { moveX(-1); }),
        key('right', 'right', 1, 0, function () { moveX(1); }),
        key('down', 'down', 0, 1, softDrop),
        { id: 'drop', round: true, icon: 'drop', label: '落下', color: '#ff7b3d', colorDown: '#ffe14d',
          x: dcx - dr, y: dcy - dr, w: dr * 2, h: dr * 2, hit: 12, onDown: function () { hardDrop(); used = true; } }
      ]);
      var bwid = cell * COLS, bht = cell * ROWS, sx = bx + bwid + 16;
      GG.canvasLayer('bg').paint(function (g) {
        GG.bg(g, w, h, '#4f8bff', '#1b3a9e');
        GG.panel(g, bx - 8, by - 8, bwid + 16, bht + 16, 16, '#e8f0ff');
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          g.fillStyle = (r + c) % 2 ? '#dbe6fb' : '#e5edfd'; g.fillRect(bx + c * cell, by + r * cell, cell, cell);
        }
        GG.panel(g, sx, by - 8, side, cell * 5.2, 14, '#fff');
        GG.text(g, '下一個', sx + side / 2, by - 8 + cell * 0.75, Math.max(13, cell * 0.55), GG.INK);
        [['行數', 0], ['等級', 1]].forEach(function (it) {
          var y0b = by + cell * 5.8 + it[1] * cell * 3.4;
          GG.panel(g, sx, y0b, side, cell * 2.9, 14, '#fff');
          GG.text(g, it[0], sx + side / 2, y0b + cell * 0.8, Math.max(13, cell * 0.55), '#7a7896');
        });
      });
      boardDirty = true;
      if (board) paintBoard();
    },
    update: function (dt) {
      if (dead) return;
      hintT += dt;
      if (level >= 3 && !clearing) {
        garbageT += dt;
        if (garbageT > (level >= 4 ? 14 : 20)) { garbageT = 0; addGarbage(); }
      }
      // 按住 ← → ↓ 會連續移動
      ['left', 'right', 'down'].forEach(function (k) {
        if (!GG.held(k) || !cur || clearing) return;
        rep[k] += dt;
        while (rep[k] > 0.07) { rep[k] -= 0.07; if (k === 'down') softDrop(); else moveX(k === 'left' ? -1 : 1); }
      });
      if (clearing) { clearT += dt; if (clearT > 0.3) finishClear(); }
      else if (cur) {
        if (cur) {
          if (fits(cur.m, cur.x, cur.y + 1)) { fallT += dt; if (fallT >= interval()) { fallT = 0; cur.y++; } }
          else { lockT += dt; if (lockT > 0.6) lock(); }
        }
      }
      if (boardDirty) paintBoard();
    },
    draw: function (ctx) {
      if (clearing) {
        ctx.fillStyle = (Math.floor(clearT * 20) % 2) ? '#fff' : '#ffe680';
        clearing.forEach(function (r) { ctx.fillRect(bx, by + r * cell, cell * COLS, cell); });
      }
      if (cur) {
        if (ghostOn) {
          var gy = cur.y;
          while (fits(cur.m, cur.x, gy + 1)) gy++;
          ctx.globalAlpha = 0.25;
          for (var r = 0; r < cur.m.length; r++) for (var c = 0; c < cur.m.length; c++)
            if (cur.m[r][c] && gy + r >= 0) ctx.drawImage(GG.img['b' + cur.t], bx + (cur.x + c) * cell, by + (gy + r) * cell, cell, cell);
          ctx.globalAlpha = 1;
        }
        for (r = 0; r < cur.m.length; r++) for (c = 0; c < cur.m.length; c++)
          if (cur.m[r][c] && cur.y + r >= 0) ctx.drawImage(GG.img['b' + cur.t], bx + (cur.x + c) * cell, by + (cur.y + r) * cell, cell, cell);
        if (cur.bomb && cur.y + cur.bomb[0] >= 0) GG.spr(ctx, 'bomb', bx + (cur.x + cur.bomb[1] + 0.5) * cell, by + (cur.y + cur.bomb[0] + 0.5) * cell, cell * 0.9, cell * 0.9);
      }
      var sx = bx + cell * COLS + 16, m = SHAPES[next], ps = cell * 0.8, n = m.length;
      var ox = sx + (side - n * ps) / 2, oy = by - 8 + cell * 1.4 + (cell * 3.4 - n * ps) / 2;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) ctx.drawImage(GG.img['b' + next], ox + c * ps, oy + r * ps, ps, ps);
      [lines, level].forEach(function (v, i) {
        GG.text(ctx, String(v), sx + side / 2, by + cell * 5.8 + i * cell * 3.4 + cell * 1.95, cell * 1.1, '#ffb300', 'center', true);
      });
      if (!used && hintT < 8) {
        // 手套依序示範按：← → ↑ 落下
        var seq = ['left', 'right', 'rot', 'drop'], tips = ['← → 移動方塊', '← → 移動方塊', '↑ 旋轉', '落下：直接掉到底'];
        var ph = Math.floor(hintT / 1.4) % 4, k = (hintT % 1.4) / 1.4, bt = GG.button(seq[ph]);
        if (bt) {
          GG.hand(ctx, bt.x + bt.w / 2, bt.y + bt.h / 2, Math.max(56, bt.h * 0.9), k > 0.3 && k < 0.7);
          GG.text(ctx, tips[ph], bx + cell * COLS / 2, by + cell * ROWS * 0.4, Math.max(20, cell * 0.9), '#fff', 'center', true);
        }
      }
    },
    down: function (p) { drag = { x0: p.x, y0: p.y, lastX: p.x, lastY: p.y, moved: false, soft: false, t: Date.now() }; },
    move: function (p) {
      if (!drag) return;
      var step = cell * 0.9;
      while (p.x - drag.lastX > step) { moveX(1); drag.lastX += step; drag.moved = true; }
      while (drag.lastX - p.x > step) { moveX(-1); drag.lastX -= step; drag.moved = true; }
      // 慢慢往下拖＝加速往下
      if (Math.abs(p.y - drag.y0) > Math.abs(p.x - drag.x0)) {
        while (p.y - drag.lastY > cell * 1.2) { softDrop(); drag.lastY += cell * 1.2; drag.soft = true; }
      }
    },
    up: function (p) {
      if (!drag) return;
      var dy = p.y - drag.y0, dx = p.x - drag.x0, quick = Date.now() - drag.t < 320;
      if (quick && dy > cell * 2.5 && dy > Math.abs(dx) * 1.5) hardDrop();          // 往下快速一滑＝直接落下
      else if (!drag.moved && !drag.soft && Math.abs(dx) < 14 && Math.abs(dy) < 14) rotate(); // 點一下＝旋轉
      drag = null; used = true;
    },
    key: function (k) {
      if (k === 'ArrowLeft') moveX(-1);
      else if (k === 'ArrowRight') moveX(1);
      else if (k === 'ArrowUp') rotate();
      else if (k === 'ArrowDown') softDrop();
      else if (k === ' ') hardDrop();
    }
  });
})();
