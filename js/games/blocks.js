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
  var rep = { left: 0, right: 0, down: 0 };
  var ASSETS = {};
  for (var ai = 0; ai < 7; ai++) ASSETS['b' + ai] = 'puzzle/block' + ai;

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
  function spawn() {
    cur = piece(next); next = fromBag(); fallT = 0; lockT = 0;
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
  function rotate() {
    if (!cur || clearing || cur.t === 1) return;
    var m = rotated(cur.m), kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (fits(m, cur.x + kicks[i], cur.y)) { cur.m = m; cur.x += kicks[i]; lockT = 0; GG.sfx('click'); return; }
    }
    if (fits(m, cur.x, cur.y - 1)) { cur.m = m; cur.y -= 1; GG.sfx('click'); }
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
    var lv = Math.floor(lines / 10) + 1 + (d0 === 2 ? 1 : 0);
    if (lv > level) { level = lv; GG.sfx('win'); GG.floatText(GG.W / 2, GG.H * 0.4, '升級！等級 ' + level, '#ffe14d', 40); }
    GG.setScore(score);
    spawn();
  }
  function interval() { return Math.max(0.1, baseSpeed * Math.pow(0.88, level - 1)); }
  function holdBtn(id, icon, x, y, w, h, fn) {
    return { id: id, icon: icon, x: x, y: y, w: w, h: h, color: 'rgba(20,40,120,0.45)',
      onDown: function () { fn(); if (id in rep) rep[id] = -0.18; },
      onUp: function () { if (id in rep) rep[id] = 0; } };
  }
  // 已落地的方塊畫在獨立的圖層，只有落地或消行時才重畫
  function paintBoard() {
    boardDirty = false;
    GG.canvasLayer('stack').paint(function (g) {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var v = board[r][c];
        if (v >= 0 && !(clearing && clearing.indexOf(r) >= 0)) g.drawImage(GG.img['b' + v], bx + c * cell, by + r * cell, cell, cell);
      }
    });
  }

  var drag = null;
  GG.define({
    assets: ASSETS,
    start: function (d) {
      d0 = d;
      baseSpeed = [1.1, 0.85, 0.6][d];
      ghostOn = d < 2;
      board = newBoard(); bag = []; score = 0; lines = 0; level = 1 + (d === 2 ? 1 : 0); clearing = null; dead = false;
      rep.left = rep.right = rep.down = 0;
      next = fromBag(); spawn();
      boardDirty = true;
      GG.setScore(0);
    },
    resize: function (w, h) {
      var ctrlH = Math.min(120, Math.max(90, h * 0.13));
      cell = Math.floor(Math.min((h - ctrlH - 24) / ROWS, (w - 32) / (COLS + 5.5)));
      side = cell * 4.5;
      var total = cell * COLS + 16 + side;
      bx = Math.round((w - total) / 2); by = Math.round((h - ctrlH - cell * ROWS) / 2);
      var gap = 10, n = 5, bw = Math.min(130, (w - 24 - gap * (n - 1)) / n), bh = ctrlH - 20;
      var x0 = (w - (bw * n + gap * (n - 1))) / 2, y0 = h - ctrlH + 6;
      GG.setPad([
        holdBtn('left', 'left', x0, y0, bw, bh, function () { moveX(-1); }),
        holdBtn('right', 'right', x0 + (bw + gap), y0, bw, bh, function () { moveX(1); }),
        holdBtn('rot', 'rotate', x0 + (bw + gap) * 2, y0, bw, bh, rotate),
        holdBtn('down', 'down', x0 + (bw + gap) * 3, y0, bw, bh, softDrop),
        holdBtn('drop', 'drop', x0 + (bw + gap) * 4, y0, bw, bh, hardDrop)
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
      if (clearing) { clearT += dt; if (clearT > 0.3) finishClear(); }
      else if (cur) {
        ['left', 'right', 'down'].forEach(function (k) {
          if (!GG.held(k)) return;
          rep[k] += dt;
          while (rep[k] > 0.06) { rep[k] -= 0.06; if (k === 'down') softDrop(); else moveX(k === 'left' ? -1 : 1); }
        });
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
      }
      var sx = bx + cell * COLS + 16, m = SHAPES[next], ps = cell * 0.8, n = m.length;
      var ox = sx + (side - n * ps) / 2, oy = by - 8 + cell * 1.4 + (cell * 3.4 - n * ps) / 2;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) ctx.drawImage(GG.img['b' + next], ox + c * ps, oy + r * ps, ps, ps);
      [lines, level].forEach(function (v, i) {
        GG.text(ctx, String(v), sx + side / 2, by + cell * 5.8 + i * cell * 3.4 + cell * 1.95, cell * 1.1, '#ffb300', 'center', true);
      });
    },
    down: function (p) { drag = { x0: p.x, y0: p.y, lastX: p.x, moved: false, t: Date.now() }; },
    move: function (p) {
      if (!drag) return;
      while (p.x - drag.lastX > cell) { moveX(1); drag.lastX += cell; drag.moved = true; }
      while (drag.lastX - p.x > cell) { moveX(-1); drag.lastX -= cell; drag.moved = true; }
    },
    up: function (p) {
      if (!drag) return;
      var dy = p.y - drag.y0, dx = p.x - drag.x0, quick = Date.now() - drag.t < 350;
      if (!drag.moved && dy > cell * 3 && quick && Math.abs(dy) > Math.abs(dx)) hardDrop();
      else if (!drag.moved && Math.abs(dx) < 12 && Math.abs(dy) < 12) rotate();
      drag = null;
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
