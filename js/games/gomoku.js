/* 五子棋：雙人或對電腦（藍方先下） */
(function () {
  var N = 13, board, turn, mode, history, winLine, over, aiT, cs, ox, oy, lastPop, thinking;
  var NAME = ['藍方企鵝', '紅方狐狸'];
  /* 一局一局打下去：第 2 局起盤面有石頭（不能下）、第 3 局起有星星格（下在上面可以再下一手）。
     對電腦：你每贏一局電腦就變強，連贏 5 局就是冠軍；雙人：先贏 3 局的人獲勝。 */
  var ROCK = -3, round = 1, wins = [0, 0], stars = [], roundEnd = 0;
  var R_MSG = ['', '新障礙：石頭格（不能下）', '新獎勵：星星格（下在上面可以再下一手）', '石頭變多了！', '最後一局，加油！'];
  function setupRound() {
    board = [];
    for (var r = 0; r < N; r++) { board.push([]); for (var c = 0; c < N; c++) board[r].push(-1); }
    var nRock = round >= 4 ? 6 : round >= 2 ? 4 : 0;
    for (var k = 0; k < nRock / 2; k++) {
      var rr = GG.randInt(1, N - 2), cc = GG.randInt(1, N - 2);
      if (Math.abs(rr - (N >> 1)) + Math.abs(cc - (N >> 1)) < 2) continue;
      board[rr][cc] = ROCK; board[N - 1 - rr][N - 1 - cc] = ROCK;
    }
    stars = [];
    if (round >= 3) for (k = 0; k < 2; k++) {
      var sr = GG.randInt(2, N - 3), sc = GG.randInt(2, N - 3);
      if (board[sr][sc] === -1) stars.push([sr, sc]);
    }
    turn = (round + 1) % 2 === 0 || mode ? 0 : 1; history = []; winLine = null; over = false; aiT = 0; lastPop = 1; thinking = false; roundEnd = 0;
    if (round > 1) GG.banner('第 ' + round + ' 局', R_MSG[Math.min(round, R_MSG.length) - 1] + (mode ? '・電腦變強了！' : ''));
    hud();
  }
  function starAt(r, c) { for (var i = 0; i < stars.length; i++) if (stars[i][0] === r && stars[i][1] === c) return i; return -1; }

  function layout(w, h) {
    var ctrl = 90;
    cs = Math.floor(Math.min((w - 30) / N, (h - ctrl - 70) / N));
    ox = Math.round((w - cs * N) / 2); oy = Math.round((h - ctrl - cs * N) / 2) + 34;
    var bw = Math.min(220, w * 0.4);
    GG.setPad([{ id: 'undo', x: (w - bw) / 2, y: h - ctrl + 12, w: bw, h: ctrl - 26, r: 28, label: '悔棋', fs: 24, color: '#8d5a2b',
      onDown: undo }]);
    GG.canvasLayer('bg').paint(function (g, w, h) {
      GG.bg(g, w, h, '#f6d7a7', '#e2ae6c');
      var bs = cs * N;
      g.fillStyle = 'rgba(90,50,20,0.35)'; GG.rr(g, ox - 12, oy - 6, bs + 24, bs + 24, 20); g.fill();
      var gr = g.createLinearGradient(ox, oy, ox + bs, oy + bs);
      gr.addColorStop(0, '#f2c57c'); gr.addColorStop(1, '#dca35a');
      g.fillStyle = gr; GG.rr(g, ox - 12, oy - 12, bs + 24, bs + 24, 20); g.fill();
      g.lineWidth = 4; g.strokeStyle = GG.INK; GG.rr(g, ox - 12, oy - 12, bs + 24, bs + 24, 20); g.stroke();
      g.strokeStyle = 'rgba(80,45,15,0.7)'; g.lineWidth = 2;
      g.beginPath();
      for (var i = 0; i < N; i++) {
        var p = ox + cs * (i + 0.5);
        g.moveTo(p, oy + cs / 2); g.lineTo(p, oy + bs - cs / 2);
        g.moveTo(ox + cs / 2, oy + cs * (i + 0.5)); g.lineTo(ox + bs - cs / 2, oy + cs * (i + 0.5));
      }
      g.stroke();
      g.fillStyle = 'rgba(80,45,15,0.8)';
      [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]].forEach(function (q) { g.beginPath(); g.arc(ox + cs * (q[1] + 0.5), oy + cs * (q[0] + 0.5), 4.5, 0, Math.PI * 2); g.fill(); });
    });
  }
  function at(r, c) { return r >= 0 && c >= 0 && r < N && c < N ? board[r][c] : -2; }
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function lineFrom(r, c, p) {
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1], cells = [[r, c]];
      for (var k = 1; at(r + dr * k, c + dc * k) === p; k++) cells.push([r + dr * k, c + dc * k]);
      for (k = 1; at(r - dr * k, c - dc * k) === p; k++) cells.unshift([r - dr * k, c - dc * k]);
      if (cells.length >= 5) return cells;
    }
    return null;
  }
  function place(r, c) {
    board[r][c] = turn;
    history.push([r, c]);
    lastPop = 0;
    GG.sfx('pop');
    var line = lineFrom(r, c, turn);
    if (line) {
      winLine = line; over = true;
      line.forEach(function (q) { GG.burst(ox + cs * (q[1] + 0.5), oy + cs * (q[0] + 0.5), { n: 4, img: '_star', size: cs * 0.5, speed: 220 }); });
      wins[turn]++;
      GG.sfx('win');
      var champ = mode ? (turn === 1 || wins[0] >= 5) : wins[turn] >= 3;
      if (champ) {
        var title = mode ? (turn === 0 ? '你是五子棋冠軍！' : '電腦贏了！') : NAME[turn] + '獲勝！';
        GG.over({ win: mode ? turn === 0 : true, title: title, text: mode ? '你贏了 ' + wins[0] + ' 局' : '局數 ' + wins[0] + ' : ' + wins[1], delay: 1300 });
      } else roundEnd = 1.8;
      return;
    }
    // 下在星星格：再下一手
    var si = starAt(r, c);
    if (si >= 0) {
      stars.splice(si, 1);
      GG.sfx('power'); GG.floatText(ox + cs * (c + 0.5), oy + cs * r, '星星！再下一手', '#ffe14d', 26);
      hud();
      if (mode && turn === 1) { aiT = 0.6; thinking = true; }
      return;
    }
    if (history.length >= N * N) { over = true; GG.over({ title: '平手！', win: true, delay: 600 }); return; }
    turn = 1 - turn;
    hud();
    if (mode && turn === 1) { aiT = 0.45; thinking = true; }
  }
  function undo() {
    if (over || thinking || roundEnd > 0 || !history.length) return;
    var n = mode ? 2 : 1;
    for (var i = 0; i < n && history.length; i++) {
      var m = history.pop();
      board[m[0]][m[1]] = -1;
      turn = 1 - turn;
    }
    if (mode) turn = 0;
    GG.sfx('click'); hud();
  }
  function hud() { GG.hud('第 ' + round + ' 局・' + (mode ? '你 ' + wins[0] + ' 勝' : '藍 ' + wins[0] + ' : ' + wins[1] + ' 紅')); }

  /* 電腦：每個空格評估「自己進攻分」+「阻擋對手分」 */
  function evalCell(r, c, p) {
    var total = 0;
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1], cnt = 1, open = 0, k;
      for (k = 1; at(r + dr * k, c + dc * k) === p; k++) cnt++;
      if (at(r + dr * k, c + dc * k) === -1) open++;
      for (k = 1; at(r - dr * k, c - dc * k) === p; k++) cnt++;
      if (at(r - dr * k, c - dc * k) === -1) open++;
      if (cnt >= 5) total += 100000;
      else if (cnt === 4) total += open === 2 ? 12000 : open === 1 ? 1500 : 0;
      else if (cnt === 3) total += open === 2 ? 1200 : open === 1 ? 120 : 0;
      else if (cnt === 2) total += open === 2 ? 110 : open === 1 ? 12 : 0;
      else total += open === 2 ? 10 : open === 1 ? 2 : 0;
    }
    return total;
  }
  function aiMove() {
    if (!history.length) return [N >> 1, N >> 1];
    var cand = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (board[r][c] !== -1) continue;
      var near = false;
      for (var dr = -2; dr <= 2 && !near; dr++) for (var dc = -2; dc <= 2; dc++) if (at(r + dr, c + dc) >= 0) { near = true; break; }
      if (!near) continue;
      var atk = evalCell(r, c, 1), def = evalCell(r, c, 0);
      var defW = mode === 2 ? 0.9 : Math.min(0.9, 0.35 + (round - 1) * 0.15), noise = mode === 2 ? 60 : Math.max(80, 700 - (round - 1) * 160);
      var s = atk + def * defW + Math.random() * noise;
      cand.push({ r: r, c: c, s: s });
    }
    cand.sort(function (a, b) { return b.s - a.s; });
    // 簡單模式偶爾不選最好的那一步
    var pick = cand[0];
    if (mode === 1 && cand.length > 2 && cand[0].s < 10000 && Math.random() < Math.max(0.1, 0.5 - (round - 1) * 0.1)) pick = cand[GG.randInt(1, Math.min(3, cand.length - 1))];
    return [pick.r, pick.c];
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
    assets: { s0: 'animals/tok_blue', s1: 'animals/tok_red', rock: 'race/rock1' } /* 藍方企鵝、紅方狐狸 */,
    start: function (m) {
      mode = m; round = 1; wins = [0, 0];
      setupRound();
      layout(GG.W, GG.H);
    },
    resize: function (w, h) { if (board) layout(w, h); },
    update: function (dt) {
      var busy = lastPop < 1 || thinking || roundEnd > 0 || stars.length > 0;
      if (roundEnd > 0) { roundEnd -= dt; if (roundEnd <= 0) { round++; setupRound(); } }
      if (lastPop < 1) lastPop = Math.min(1, lastPop + dt / 0.25);
      if (thinking && !over) {
        aiT -= dt;
        if (aiT <= 0) { thinking = false; var mv = aiMove(); place(mv[0], mv[1]); }
      }
      return busy;
    },
    draw: function (ctx, w, h) {
      var last = history[history.length - 1];
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var v = board[r][c];
        if (v === ROCK) { GG.spr(ctx, 'rock', ox + cs * (c + 0.5), oy + cs * (r + 0.5), cs * 0.95, cs * 0.95); continue; }
        if (v < 0) continue;
        var sc = last && last[0] === r && last[1] === c ? GG.ease(lastPop) * (1 + Math.sin(lastPop * Math.PI) * 0.2) : 1;
        var x = ox + cs * (c + 0.5), y = oy + cs * (r + 0.5);
        ctx.fillStyle = 'rgba(60,30,10,0.3)';
        ctx.beginPath(); ctx.arc(x + 2, y + 4, cs * 0.44 * sc, 0, Math.PI * 2); ctx.fill();
        GG.spr(ctx, 's' + v, x, y, cs * 0.92 * sc, cs * 0.92 * sc);
      }
      stars.forEach(function (q) { GG.spr(ctx, '_star', ox + cs * (q[1] + 0.5), oy + cs * (q[0] + 0.5), cs * 0.85 * (1 + Math.sin(Date.now() / 200) * 0.08), cs * 0.85 * (1 + Math.sin(Date.now() / 200) * 0.08), { alpha: 0.85 }); });
      if (roundEnd > 0) GG.text(ctx, (mode ? (turn === 0 ? '你贏了這一局！' : '') : NAME[turn] + '贏了這一局！'), w / 2, oy + cs * N / 2, 40, '#ffe14d', 'center', true);
      if (last && !winLine) {
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ox + cs * (last[1] + 0.5), oy + cs * (last[0] + 0.5), cs * 0.5, 0, Math.PI * 2); ctx.stroke();
      }
      if (winLine) {
        var a = winLine[0], b = winLine[winLine.length - 1];
        ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ox + cs * (a[1] + 0.5), oy + cs * (a[0] + 0.5)); ctx.lineTo(ox + cs * (b[1] + 0.5), oy + cs * (b[0] + 0.5)); ctx.stroke();
      }
      // 輪到誰
      GG.spr(ctx, 's' + turn, w / 2 - 70, oy - 40, 34, 34);
      GG.text(ctx, mode ? (turn === 0 ? '輪到你了' : '電腦思考中…') : '輪到' + NAME[turn], w / 2 + 14, oy - 40, 22, turn === 0 ? '#2f7bff' : '#e8463c', 'center', '#ffffff');
    },
    up: function (p) {
      if (over || thinking || roundEnd > 0 || (mode && turn === 1)) return;
      var c = Math.floor((p.x - ox) / cs), r = Math.floor((p.y - oy) / cs);
      if (r < 0 || c < 0 || r >= N || c >= N || board[r][c] !== -1) return;
      place(r, c);
    }
  });
})();
