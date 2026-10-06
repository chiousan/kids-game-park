/* 四子棋：雙人或對電腦（懶惰重繪；棋盤框預先畫好，挖洞後蓋在棋子上面） */
(function () {
  var COLS = 7, ROWS = 6, board, turn, mode, cs, ox, oy, frame, drop, winLine, over, aiT, hoverC;
  var NAME = ['藍方', '紅方'];
  /* 一局一局打下去：第 2 局起最下面有石頭（佔位置）、第 3 局起有星星格（棋子停在上面可以再下一次）。
     對電腦：你每贏一局電腦就變強（想得更遠），連贏 5 局就是冠軍；雙人：先贏 3 局的人獲勝。 */
  var ROCK = 2, round = 1, wins = [0, 0], stars = [], roundEnd = 0;
  var R_MSG = ['', '新障礙：石頭（佔住格子）', '新獎勵：星星格（棋子停在上面可以再下一次）', '石頭變多了！', '最後一局，加油！'];
  function setupRound() {
    board = [];
    for (var r = 0; r < ROWS; r++) { board.push([]); for (var c = 0; c < COLS; c++) board[r].push(-1); }
    var nRock = round >= 4 ? 4 : round >= 2 ? 2 : 0;
    for (var k = 0; k < nRock; k++) {
      var cc = GG.pick([0, 1, 2, 4, 5, 6]), rr = lowest(cc);
      if (rr >= ROWS - 2) board[rr][cc] = ROCK;
    }
    stars = [];
    if (round >= 3) for (k = 0; k < 2; k++) stars.push([GG.randInt(2, ROWS - 2), GG.randInt(0, COLS - 1)]);
    turn = mode ? 0 : (round + 1) % 2; drop = null; winLine = null; over = false; aiT = 0; hoverC = -1; roundEnd = 0;
    if (round > 1) GG.banner('第 ' + round + ' 局', R_MSG[Math.min(round, R_MSG.length) - 1] + (mode ? '・電腦變強了！' : ''));
  }
  function starAt(r, c) { for (var i = 0; i < stars.length; i++) if (stars[i][0] === r && stars[i][1] === c) return i; return -1; }

  function layout(w, h) {
    cs = Math.floor(Math.min((w - 40) / COLS, (h - 150) / (ROWS + 0.6), 120));
    ox = Math.round((w - cs * COLS) / 2); oy = Math.round((h - cs * ROWS) / 2) + 30;
    var pad = cs * 0.18;
    frame = GG.sprite(cs * COLS + pad * 2, cs * ROWS + pad * 2, function (g, fw, fh) {
      g.fillStyle = '#6a4ce0'; GG.rr(g, 0, 0, fw, fh, cs * 0.3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; GG.rr(g, 6, 6, fw - 12, cs * 0.3, cs * 0.15); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { g.beginPath(); g.arc(pad + cs * (c + 0.5), pad + cs * (r + 0.5), cs * 0.4, 0, 7); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,60,0.35)';
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) { g.beginPath(); g.arc(pad + cs * (c + 0.5), pad + cs * (r + 0.5), cs * 0.4, 0, 7); g.stroke(); }
      g.lineWidth = 5; g.strokeStyle = GG.INK; GG.rr(g, 2.5, 2.5, fw - 5, fh - 5, cs * 0.3); g.stroke();
    });
    frame.pad = pad;
    GG.canvasLayer('bg').paint(function (g) {
      GG.bg(g, w, h, '#ffe8a3', '#ffb35c');
      g.fillStyle = '#dbe9ff'; GG.rr(g, ox - pad, oy - pad, cs * COLS + pad * 2, cs * ROWS + pad * 2, cs * 0.3); g.fill();
    });
  }
  function lowest(c) { for (var r = ROWS - 1; r >= 0; r--) if (board[r][c] < 0) return r; return -1; }
  function lineAt(b, r, c, p) {
    var D = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var d = 0; d < 4; d++) {
      var cells = [[r, c]];
      for (var k = 1; k < 4; k++) { var rr = r + D[d][0] * k, cc = c + D[d][1] * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== p) break; cells.push([rr, cc]); }
      for (k = 1; k < 4; k++) { rr = r - D[d][0] * k; cc = c - D[d][1] * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== p) break; cells.unshift([rr, cc]); }
      if (cells.length >= 4) return cells;
    }
    return null;
  }
  function play(c) {
    if (over || drop) return;
    var r = lowest(c);
    if (r < 0) return;
    drop = { c: c, r: r, y: oy - cs * 0.7, vy: 0, p: turn };
    GG.sfx('click');
  }
  function landed() {
    var d = drop; drop = null;
    board[d.r][d.c] = d.p;
    GG.sfx('bounce');
    var line = lineAt(board, d.r, d.c, d.p);
    if (line) {
      winLine = line; over = true;
      line.forEach(function (q) { GG.burst(ox + cs * (q[1] + 0.5), oy + cs * (q[0] + 0.5), { n: 6, img: '_star', size: cs * 0.35, speed: 260 }); });
      wins[d.p]++; GG.sfx('win');
      var champ = mode ? (d.p === 1 || wins[0] >= 5) : wins[d.p] >= 3;
      if (champ) {
        var title = mode ? (d.p === 0 ? '你是四子棋冠軍！' : '電腦贏了！') : NAME[d.p] + '獲勝！';
        GG.over({ win: mode ? d.p === 0 : true, title: title, text: mode ? '你贏了 ' + wins[0] + ' 局' : '局數 ' + wins[0] + ' : ' + wins[1], delay: 1300 });
      } else { roundEnd = 1.8; turn = d.p; }
      hud();
      return;
    }
    if (board.every(function (row) { return row.every(function (v) { return v >= 0; }); })) { over = true; roundEnd = 1.5; turn = -1; return; }
    var si = starAt(d.r, d.c);
    if (si >= 0) {
      stars.splice(si, 1); GG.sfx('power');
      GG.floatText(ox + cs * (d.c + 0.5), oy + cs * d.r, '星星！再下一次', '#ffe14d', 26);
      hud();
      if (mode && turn === 1) aiT = 0.6;
      return;
    }
    turn = 1 - turn; hud();
    if (mode && turn === 1) aiT = 0.55;
  }
  function hud() { GG.hud('第 ' + round + ' 局・' + (mode ? '你 ' + wins[0] + ' 勝' : '藍 ' + wins[0] + ' : ' + wins[1] + ' 紅')); }

  /* 電腦：困難用 alpha-beta 往後想 4 步；簡單會贏就贏、偶爾擋 */
  function score4(b) {
    var s = 0, D = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < ROWS; r++) {
      if (b[r][3] === 1) s += 3; else if (b[r][3] === 0) s -= 3;
      for (var c = 0; c < COLS; c++) for (var d = 0; d < 4; d++) {
        var a = 0, h = 0, ok = true;
        for (var k = 0; k < 4; k++) {
          var rr = r + D[d][0] * k, cc = c + D[d][1] * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) { ok = false; break; }
          if (b[rr][cc] === 1) a++; else if (b[rr][cc] === 0) h++;
        }
        if (!ok || (a && h)) continue;
        s += a === 3 ? 5 : a === 2 ? 2 : 0;
        s -= h === 3 ? 6 : h === 2 ? 2 : 0;
      }
    }
    return s;
  }
  function search(b, depth, alpha, beta, me) {
    var moves = [3, 2, 4, 1, 5, 0, 6].filter(function (c) { return b[0][c] < 0; });
    if (!moves.length || depth === 0) return { s: score4(b) };
    var best = { s: me ? -1e9 : 1e9, c: moves[0] };
    for (var i = 0; i < moves.length; i++) {
      var c = moves[i], r;
      for (r = ROWS - 1; r >= 0; r--) if (b[r][c] < 0) break;
      b[r][c] = me ? 1 : 0;
      var v = lineAt(b, r, c, me ? 1 : 0) ? { s: me ? 100000 + depth : -100000 - depth } : search(b, depth - 1, alpha, beta, !me);
      b[r][c] = -1;
      if (me ? v.s > best.s : v.s < best.s) best = { s: v.s, c: c };
      if (me) alpha = Math.max(alpha, v.s); else beta = Math.min(beta, v.s);
      if (beta <= alpha) break;
    }
    return best;
  }
  function aiMove() {
    var b = board.map(function (r) { return r.slice(); });
    if (mode === 2) return search(b, Math.min(5, 3 + round), -1e9, 1e9, true).c;
    var moves = [0, 1, 2, 3, 4, 5, 6].filter(function (c) { return b[0][c] < 0; });
    for (var p = 1; p >= 0; p--) {
      if (p === 0 && Math.random() < Math.max(0.05, 0.45 - (round - 1) * 0.1)) break; // 簡單模式有時候忘了擋（越後面的局越少忘）
      for (var i = 0; i < moves.length; i++) {
        var c = moves[i], r = lowest(c);
        b[r][c] = p;
        var win = lineAt(b, r, c, p);
        b[r][c] = -1;
        if (win) return c;
      }
    }
    var w = moves.map(function (c) { return 4 - Math.abs(c - 3) + Math.random() * 3; });
    return moves[w.indexOf(Math.max.apply(null, w))];
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { round = n; setupRound(); };

  GG.define({
    lazy: true,
    modes: [
      { label: '雙人對戰', value: 0, cls: 'b-blue' },
      { label: '對電腦・簡單', value: 1, cls: 'b-easy' },
      { label: '對電腦・困難', value: 2, cls: 'b-hard' }
    ],
    assets: { s0: 'board/chipBlueWhite', s1: 'board/chipRedWhite', rock: 'race/rock1' },
    start: function (m) {
      mode = m; round = 1; wins = [0, 0];
      setupRound();
      layout(GG.W, GG.H);
      hud();
    },
    resize: function (w, h) { if (board) layout(w, h); },
    update: function (dt) {
      var busy = roundEnd > 0 || stars.length > 0;
      if (roundEnd > 0) { roundEnd -= dt; if (roundEnd <= 0) { round++; setupRound(); hud(); } }
      if (drop) {
        busy = true;
        drop.vy += GG.H * 4 * dt; drop.y += drop.vy * dt;
        var ty = oy + cs * (drop.r + 0.5);
        if (drop.y >= ty) { drop.y = ty; landed(); }
      } else if (mode && turn === 1 && !over && roundEnd <= 0) {
        busy = true; aiT -= dt;
        if (aiT <= 0) play(aiMove());
      }
      return busy;
    },
    draw: function (ctx, w) {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (board[r][c] === ROCK) GG.spr(ctx, 'rock', ox + cs * (c + 0.5), oy + cs * (r + 0.5), cs * 0.86, cs * 0.86);
        else if (board[r][c] >= 0) GG.spr(ctx, 's' + board[r][c], ox + cs * (c + 0.5), oy + cs * (r + 0.5), cs * 0.86, cs * 0.86);
        else if (starAt(r, c) >= 0) GG.spr(ctx, '_star', ox + cs * (c + 0.5), oy + cs * (r + 0.5), cs * 0.6 * (1 + Math.sin(Date.now() / 200) * 0.08), cs * 0.6 * (1 + Math.sin(Date.now() / 200) * 0.08), { alpha: 0.85 });
      }
      if (drop) GG.spr(ctx, 's' + drop.p, ox + cs * (drop.c + 0.5), drop.y, cs * 0.86, cs * 0.86);
      ctx.drawImage(frame, ox - frame.pad, oy - frame.pad, cs * COLS + frame.pad * 2, cs * ROWS + frame.pad * 2);
      if (!drop && !over && turn >= 0 && !(mode && turn === 1)) {
        var hc = hoverC >= 0 ? hoverC : 3;
        GG.spr(ctx, 's' + turn, ox + cs * (hc + 0.5), oy - cs * 0.75, cs * 0.7, cs * 0.7, { alpha: 0.85 });
      }
      if (winLine) {
        var a = winLine[0], b = winLine[winLine.length - 1];
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ox + cs * (a[1] + 0.5), oy + cs * (a[0] + 0.5)); ctx.lineTo(ox + cs * (b[1] + 0.5), oy + cs * (b[0] + 0.5)); ctx.stroke();
      }
      var tip = roundEnd > 0 ? (turn < 0 ? '平手！再來一局' : mode ? (turn === 0 ? '你贏了這一局！' : '') : NAME[turn] + '贏了這一局！') : mode ? (turn === 0 ? '輪到你了' : '電腦思考中…') : '輪到' + NAME[turn];
      GG.text(ctx, tip, w / 2, oy - cs * 1.45, 26, turn === 1 ? '#e8463c' : '#2f7bff', 'center', '#ffffff');
    },
    down: function (p) { hoverC = GG.clamp(Math.floor((p.x - ox) / cs), 0, COLS - 1); },
    move: function (p) { hoverC = GG.clamp(Math.floor((p.x - ox) / cs), 0, COLS - 1); GG.redraw(); },
    up: function (p) {
      if ((mode && turn === 1) || roundEnd > 0) return;
      var c = Math.floor((p.x - ox) / cs);
      if (c >= 0 && c < COLS) play(c);
    }
  });
})();
