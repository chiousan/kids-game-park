/* 方塊堆疊 */
(function () {
  var COLS = 10, ROWS = 20;
  var SHAPES = [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]], // S
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]], // J
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]]  // L
  ];
  var COLORS = ['#29d2ff', '#ffd23f', '#b05cff', '#43d17a', '#ff5252', '#2f7bff', '#ff9a2f'];
  var board, cur, next, bag, score, lines, level, baseSpeed, fallT, lockT, clearing, clearT, dead;
  var cell, bx, by, side, sprites = [], ghostOn;
  var rep = { left: 0, right: 0, down: 0 };

  function newBoard() { var b = []; for (var r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(-1)); return b; }
  function fromBag() {
    if (!bag.length) bag = GG.shuffle([0, 1, 2, 3, 4, 5, 6]);
    return bag.pop();
  }
  function piece(t) {
    var m = SHAPES[t].map(function (row) { return row.slice(); });
    return { t: t, m: m, x: Math.floor((COLS - m.length) / 2), y: t === 0 ? -1 : 0 };
  }
  function fits(m, x, y) {
    for (var r = 0; r < m.length; r++) for (var c = 0; c < m.length; c++) {
      if (!m[r][c]) continue;
      var bx2 = x + c, by2 = y + r;
      if (bx2 < 0 || bx2 >= COLS || by2 >= ROWS) return false;
      if (by2 >= 0 && board[by2][bx2] >= 0) return false;
    }
    return true;
  }
  function rotated(m) {
    var n = m.length, o = [];
    for (var r = 0; r < n; r++) { o.push([]); for (var c = 0; c < n; c++) o[r].push(m[n - 1 - c][r]); }
    return o;
  }
  function spawn() {
    cur = piece(next); next = fromBag();
    fallT = 0; lockT = 0;
    if (!fits(cur.m, cur.x, cur.y)) {
      dead = true;
      GG.sfx('boom');
      GG.over({ score: score, text: '消除了 ' + lines + ' 行・等級 ' + level });
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
    lock();
  }
  function lock() {
    for (var r = 0; r < cur.m.length; r++) for (var c = 0; c < cur.m.length; c++) {
      if (cur.m[r][c] && cur.y + r >= 0) board[cur.y + r][cur.x + c] = cur.t;
    }
    GG.sfx('bounce');
    cur = null;
    var full = [];
    for (r = 0; r < ROWS; r++) if (board[r].every(function (v) { return v >= 0; })) full.push(r);
    if (full.length) { clearing = full; clearT = 0; GG.sfx(full.length >= 4 ? 'power' : 'clear'); }
    else spawn();
  }
  function finishClear() {
    var n = clearing.length;
    clearing.forEach(function (r) { board.splice(r, 1); board.unshift(new Array(COLS).fill(-1)); });
    clearing = null;
    lines += n;
    score += [0, 100, 300, 500, 800][n] * level;
    var lv = Math.floor(lines / 10) + 1;
    if (lv > level) { level = lv; GG.sfx('win'); }
    GG.setScore(score);
    spawn();
  }
  function interval() { return Math.max(0.06, baseSpeed * Math.pow(0.85, level - 1)); }

  function makeSprites() {
    sprites = [];
    for (var i = 0; i < 7; i++) sprites.push(GG.img['b' + i]);
  }
  var ASSETS = {};
  for (var ai = 0; ai < 7; ai++) ASSETS['b' + ai] = 'puzzle/block' + ai;

  function holdBtn(id, icon, x, y, w, h, fn) {
    return {
      id: id, icon: icon, x: x, y: y, w: w, h: h,
      onDown: function () { fn(); if (id in rep) rep[id] = -0.17; },
      onUp: function () { if (id in rep) rep[id] = 0; }
    };
  }

  var drag = null;
  GG.define({
    assets: ASSETS,
    start: function (d) {
      baseSpeed = [0.9, 0.65, 0.42][d];
      ghostOn = d < 2;
      board = newBoard(); bag = []; score = 0; lines = 0; level = 1 + (d === 2 ? 2 : 0); clearing = null; dead = false;
      rep.left = rep.right = rep.down = 0;
      next = fromBag(); spawn();
      GG.setScore(0);
    },
    resize: function (w, h) {
      var ctrlH = Math.min(120, Math.max(90, h * 0.13));
      cell = Math.floor(Math.min((h - ctrlH - 24) / ROWS, (w - 32) / (COLS + 5.5)));
      side = cell * 4.5;
      var total = cell * COLS + 14 + side;
      bx = Math.round((w - total) / 2); by = Math.round((h - ctrlH - cell * ROWS) / 2);
      makeSprites();
      var gap = 10, n = 5, bw = Math.min(130, (w - 24 - gap * (n - 1)) / n), bh = ctrlH - 20;
      var x0 = (w - (bw * n + gap * (n - 1))) / 2, y0 = h - ctrlH + 6;
      var lb = ['left', 'right', 'rotate', 'down', 'drop'];
      GG.setPad([
        holdBtn('left', lb[0], x0, y0, bw, bh, function () { moveX(-1); }),
        holdBtn('right', lb[1], x0 + (bw + gap), y0, bw, bh, function () { moveX(1); }),
        holdBtn('rot', lb[2], x0 + (bw + gap) * 2, y0, bw, bh, rotate),
        holdBtn('down', lb[3], x0 + (bw + gap) * 3, y0, bw, bh, softDrop),
        holdBtn('drop', lb[4], x0 + (bw + gap) * 4, y0, bw, bh, hardDrop)
      ]);
    },
    update: function (dt) {
      if (dead) return;
      if (clearing) { clearT += dt; if (clearT > 0.3) finishClear(); return; }
      if (!cur) return;
      ['left', 'right', 'down'].forEach(function (k) {
        if (!GG.held(k)) return;
        rep[k] += dt;
        while (rep[k] > 0.05) {
          rep[k] -= 0.05;
          if (k === 'down') softDrop(); else moveX(k === 'left' ? -1 : 1);
        }
      });
      if (!cur) return;
      if (fits(cur.m, cur.x, cur.y + 1)) {
        fallT += dt;
        if (fallT >= interval()) { fallT = 0; cur.y++; }
      } else {
        lockT += dt;
        if (lockT > 0.45) lock();
      }
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#3d7bff', '#1b3a9e');
      var bw = cell * COLS, bh = cell * ROWS;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; GG.rr(ctx, bx - 8, by - 2, bw + 16, bh + 16, 16); ctx.fill();
      ctx.fillStyle = '#e8f0ff'; GG.rr(ctx, bx - 8, by - 8, bw + 16, bh + 16, 16); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; GG.rr(ctx, bx - 8, by - 8, bw + 16, bh + 16, 16); ctx.stroke();
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#dbe6fb' : '#e5edfd';
        ctx.fillRect(bx + c * cell, by + r * cell, cell, cell);
      }
      for (r = 0; r < ROWS; r++) {
        var flash = clearing && clearing.indexOf(r) >= 0;
        for (c = 0; c < COLS; c++) {
          var v = board[r][c];
          if (v < 0) continue;
          if (flash) { ctx.fillStyle = (Math.floor(clearT * 20) % 2) ? '#fff' : '#ffe680'; ctx.fillRect(bx + c * cell, by + r * cell, cell, cell); }
          else ctx.drawImage(sprites[v], bx + c * cell, by + r * cell, cell, cell);
        }
      }
      if (cur) {
        if (ghostOn) {
          var gy = cur.y;
          while (fits(cur.m, cur.x, gy + 1)) gy++;
          ctx.globalAlpha = 0.25;
          for (r = 0; r < cur.m.length; r++) for (c = 0; c < cur.m.length; c++) {
            if (cur.m[r][c] && gy + r >= 0) ctx.drawImage(sprites[cur.t], bx + (cur.x + c) * cell, by + (gy + r) * cell, cell, cell);
          }
          ctx.globalAlpha = 1;
        }
        for (r = 0; r < cur.m.length; r++) for (c = 0; c < cur.m.length; c++) {
          if (cur.m[r][c] && cur.y + r >= 0) ctx.drawImage(sprites[cur.t], bx + (cur.x + c) * cell, by + (cur.y + r) * cell, cell, cell);
        }
      }
      // 側邊資訊
      var sx = bx + bw + 16, sw = side;
      function panel(y, hh) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; GG.rr(ctx, sx, y + 5, sw, hh, 14); ctx.fill();
        ctx.fillStyle = '#ffffff'; GG.rr(ctx, sx, y, sw, hh, 14); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; GG.rr(ctx, sx, y, sw, hh, 14); ctx.stroke();
      }
      panel(by - 8, cell * 5.2);
      GG.text(ctx, '下一個', sx + sw / 2, by - 8 + cell * 0.75, Math.max(13, cell * 0.55), GG.INK);
      var m = SHAPES[next], ps = cell * 0.8, n = m.length;
      var ox = sx + (sw - n * ps) / 2, oy = by - 8 + cell * 1.4 + (cell * 3.4 - n * ps) / 2;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) ctx.drawImage(sprites[next], ox + c * ps, oy + r * ps, ps, ps);
      var iy = by + cell * 5.8;
      [['行數', lines], ['等級', level]].forEach(function (it, i) {
        var y0 = iy + i * cell * 3.4;
        panel(y0, cell * 2.9);
        GG.text(ctx, it[0], sx + sw / 2, y0 + cell * 0.8, Math.max(13, cell * 0.55), '#7a7896');
        GG.text(ctx, String(it[1]), sx + sw / 2, y0 + cell * 1.95, cell * 1.1, '#ffb300', 'center', true);
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
