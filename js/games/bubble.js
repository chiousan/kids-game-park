/* 泡泡龍：六角格泡泡，3 顆以上同色爆破，懸空的會掉下來 */
(function () {
  var ALL = ['blue', 'green', 'pink', 'purple', 'red', 'yellow'];
  var C = 10, grid, parity, colors, R, rowH, left, top, shooter, loseY, cur, nxt, shot, aim, pops, falls, score, shotsLeftRow, perRow, d0, dirty, over;
  var ASSETS = {};
  ALL.forEach(function (c) { ASSETS[c] = 'blob/' + c + '_happy'; ASSETS[c + 'd'] = 'blob/' + c + '_dizzy'; });

  function shifted(r) { return (r + parity) % 2 === 1; }
  function rowLen(r) { return shifted(r) ? C - 1 : C; }
  function pos(r, c) { return [left + R + c * 2 * R + (shifted(r) ? R : 0), top + R + r * rowH]; }
  function valid(r, c) { return r >= 0 && r < grid.length && c >= 0 && c < rowLen(r); }
  function nbrs(r, c) {
    var s = shifted(r);
    return s ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
      : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
  }
  function newRow() {
    var row = [];
    for (var c = 0; c < C; c++) row.push(c > 0 && Math.random() < 0.45 ? row[c - 1] : GG.randInt(0, colors - 1));
    return row;
  }
  function present() {
    var s = {};
    grid.forEach(function (row, r) { for (var c = 0; c < rowLen(r); c++) if (row[c] >= 0) s[row[c]] = 1; });
    var k = Object.keys(s).map(Number);
    return k.length ? k : [0];
  }
  function layout(w, h) {
    R = Math.min(w - 20, 760) / (2 * C + 1) / 1;
    rowH = R * 1.732;
    left = (w - (2 * R * C + R)) / 2; top = 60;
    shooter = { x: w / 2, y: h - R * 2.6 };
    loseY = shooter.y - R * 2.2;
    GG.canvasLayer('bg').paint(function (g) {
      GG.bg(g, w, h, '#ffd6f0', '#c9a5ff');
      g.fillStyle = 'rgba(255,255,255,0.3)';
      for (var k = 0; k < 10; k++) { g.beginPath(); g.arc((k * 191) % w, (k * 277) % h, 20 + (k % 4) * 16, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(left, top - 6, 2 * R * C + R, 6);
      g.strokeStyle = 'rgba(255,80,120,0.5)'; g.lineWidth = 3; g.setLineDash([12, 10]);
      g.beginPath(); g.moveTo(left, loseY); g.lineTo(left + 2 * R * C + R, loseY); g.stroke(); g.setLineDash([]);
      GG.panel(g, shooter.x - R * 1.8, shooter.y - R * 0.6, R * 3.6, R * 2.4, R, '#ffffff');
    });
    dirty = true;
  }
  function paintGrid() {
    dirty = false;
    GG.canvasLayer('grid').paint(function (g) {
      grid.forEach(function (row, r) {
        for (var c = 0; c < rowLen(r); c++) if (row[c] >= 0) { var p = pos(r, c); GG.spr(g, ALL[row[c]], p[0], p[1], R * 2.08, R * 2.08); }
      });
    });
  }
  function nextColor() { return GG.pick(present()); }
  function snap(x, y) {
    var r0 = Math.max(0, Math.round((y - top - R) / rowH)), best = null;
    while (grid.length <= r0 + 1) { var e = []; for (var i = 0; i < C; i++) e.push(-1); grid.push(e); }
    for (var r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (var c = 0; c < rowLen(r); c++) {
      if (grid[r][c] >= 0) continue;
      var p = pos(r, c), d = GG.dist(p[0], p[1], x, y);
      if (!best || d < best.d) best = { r: r, c: c, d: d };
    }
    return best;
  }
  function land(x, y, col) {
    var b = snap(x, y);
    if (!b) return;
    grid[b.r][b.c] = col;
    GG.sfx('bounce');
    // 找同色相連
    var seen = {}, stack = [[b.r, b.c]], group = [];
    while (stack.length) {
      var q = stack.pop(), k = q[0] + ',' + q[1];
      if (seen[k] || !valid(q[0], q[1]) || grid[q[0]][q[1]] !== col) continue;
      seen[k] = 1; group.push(q);
      nbrs(q[0], q[1]).forEach(function (n) { stack.push(n); });
    }
    var popped = false;
    if (group.length >= 3) {
      popped = true;
      group.forEach(function (q) {
        var p = pos(q[0], q[1]);
        pops.push({ x: p[0], y: p[1], col: grid[q[0]][q[1]], t: 0 });
        grid[q[0]][q[1]] = -1;
      });
      score += group.length * 10;
      GG.sfx('clear');
      // 沒有連到天花板的泡泡掉下來
      var conn = {}, st = [];
      for (var c0 = 0; c0 < rowLen(0); c0++) if (grid[0] && grid[0][c0] >= 0) st.push([0, c0]);
      while (st.length) {
        var q2 = st.pop(), k2 = q2[0] + ',' + q2[1];
        if (conn[k2] || !valid(q2[0], q2[1]) || grid[q2[0]][q2[1]] < 0) continue;
        conn[k2] = 1;
        nbrs(q2[0], q2[1]).forEach(function (n) { st.push(n); });
      }
      var dropped = 0;
      grid.forEach(function (row, r) {
        for (var c = 0; c < rowLen(r); c++) if (row[c] >= 0 && !conn[r + ',' + c]) {
          var p = pos(r, c);
          falls.push({ x: p[0], y: p[1], vx: GG.rand(-80, 80), vy: GG.rand(-150, 0), col: row[c] });
          row[c] = -1; dropped++;
        }
      });
      score += dropped * 20;
      var p0 = pos(b.r, b.c);
      GG.floatText(p0[0], p0[1], '+' + (group.length * 10 + dropped * 20), '#fff', 32);
      if (dropped) GG.shake(5, 0.2);
    }
    while (grid.length && grid[grid.length - 1].every(function (v) { return v < 0; })) grid.pop();
    GG.setScore(score);
    if (!popped) {
      shotsLeftRow--;
      if (shotsLeftRow <= 0) {
        grid.unshift(newRow()); parity = 1 - parity; shotsLeftRow = perRow; GG.sfx('hit'); GG.shake(6, 0.2);
        // 換排之後變成「內縮排」的那幾排，最後一格要讓它掉下來
        grid.forEach(function (row, r) {
          if (shifted(r) && row[C - 1] >= 0) {
            var pp = pos(r, C - 2);
            if (r > 0) falls.push({ x: pp[0] + 2 * R, y: pp[1], vx: 60, vy: -100, col: row[C - 1] });
            row[C - 1] = -1;
          }
        });
      }
    }
    dirty = true;
    if (!grid.length) {
      over = true;
      score += 500; GG.setScore(score);
      GG.over({ score: score, win: true, stars: 3, title: '全部清光了！', text: '清場獎勵 +500', delay: 800 });
      return;
    }
    for (var rr = 0; rr < grid.length; rr++) for (var cc = 0; cc < rowLen(rr); cc++) {
      if (grid[rr][cc] >= 0 && pos(rr, cc)[1] + R > loseY) {
        over = true;
        GG.over({ score: score, stars: GG.starsFor(score, 300, 800, 1500), title: '泡泡碰到線了！', delay: 800 });
        return;
      }
    }
    cur = nxt; nxt = nextColor();
    if (present().indexOf(cur) < 0) cur = nextColor();
  }
  function aimAngle(p) {
    var a = Math.atan2(p.y - shooter.y, p.x - shooter.x);
    if (a > 0) a = p.x < shooter.x ? -Math.PI + 0.15 : -0.15;
    return GG.clamp(a, -Math.PI + 0.15, -0.15);
  }
  // 預測軌跡（會在牆壁反彈）
  function trace(a, maxLen) {
    var x = shooter.x, y = shooter.y, vx = Math.cos(a), vy = Math.sin(a), pts = [], len = 0, minX = left + R, maxX = left + 2 * R * C;
    while (len < maxLen) {
      x += vx * 8; y += vy * 8; len += 8;
      if (x < minX) { x = minX; vx = -vx; }
      if (x > maxX) { x = maxX; vx = -vx; }
      if (y < top + R) break;
      var hit = false;
      for (var r = 0; r < grid.length && !hit; r++) for (var c = 0; c < rowLen(r); c++) {
        if (grid[r][c] < 0) continue;
        var p = pos(r, c);
        if (Math.abs(p[1] - y) < 2 * R && GG.dist(p[0], p[1], x, y) < R * 1.8) { hit = true; break; }
      }
      if (hit) break;
      if (len % 32 === 0) pts.push([x, y]);
    }
    return pts;
  }

  GG.define({
    assets: ASSETS,
    start: function (d) {
      d0 = d;
      colors = [4, 5, 6][d];
      perRow = [9, 7, 5][d]; shotsLeftRow = perRow;
      parity = 0; grid = [];
      for (var r = 0; r < [4, 5, 6][d]; r++) grid.push(newRow());
      pops = []; falls = []; score = 0; shot = null; aim = null; over = false;
      layout(GG.W, GG.H);
      cur = nextColor(); nxt = nextColor();
      GG.setScore(0);
    },
    resize: function (w, h) { if (grid) layout(w, h); },
    update: function (dt) {
      if (dirty) paintGrid();
      for (var i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 0.3) { GG.burst(pops[i].x, pops[i].y, { n: 4, img: '_star', size: R * 0.7, speed: 200 }); pops.splice(i, 1); } }
      for (i = falls.length - 1; i >= 0; i--) { var f = falls[i]; f.vy += 1400 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.y > GG.H + R) falls.splice(i, 1); }
      if (!shot || over) return;
      var steps = 6, sdt = dt / steps, minX = left + R, maxX = left + 2 * R * C;
      for (var s = 0; s < steps; s++) {
        shot.x += shot.vx * sdt; shot.y += shot.vy * sdt;
        if (shot.x < minX) { shot.x = minX; shot.vx = Math.abs(shot.vx); GG.sfx('bounce'); }
        if (shot.x > maxX) { shot.x = maxX; shot.vx = -Math.abs(shot.vx); GG.sfx('bounce'); }
        var stop = shot.y <= top + R;
        for (var r = 0; r < grid.length && !stop; r++) for (var c = 0; c < rowLen(r); c++) {
          if (grid[r][c] < 0) continue;
          var p = pos(r, c);
          if (GG.dist(p[0], p[1], shot.x, shot.y) < R * 1.75) { stop = true; break; }
        }
        if (stop) { var sh = shot; shot = null; land(sh.x, sh.y, sh.col); return; }
      }
    },
    draw: function (ctx) {
      if (aim && !shot && !over) {
        var pts = trace(aim.a, [2000, 900, 380][d0]);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        pts.forEach(function (q, i) { ctx.globalAlpha = 1 - i / (pts.length + 2); ctx.beginPath(); ctx.arc(q[0], q[1], R * 0.18, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = 1;
      }
      pops.forEach(function (p) { var k = p.t / 0.3; GG.spr(ctx, ALL[p.col] + 'd', p.x, p.y, R * 2.08 * (1 + k * 0.4), R * 2.08 * (1 + k * 0.4), { alpha: 1 - k }); });
      falls.forEach(function (f) { GG.spr(ctx, ALL[f.col] + 'd', f.x, f.y, R * 2.08, R * 2.08); });
      if (shot) GG.spr(ctx, ALL[shot.col], shot.x, shot.y, R * 2.08, R * 2.08);
      else if (!over) GG.spr(ctx, ALL[cur], shooter.x, shooter.y, R * 2.2, R * 2.2);
      GG.spr(ctx, ALL[nxt], shooter.x + R * 2.6, shooter.y + R * 0.6, R * 1.3, R * 1.3);
      GG.text(ctx, '下一顆', shooter.x + R * 2.6, shooter.y + R * 1.6, 14, '#fff', 'center', true);
      GG.text(ctx, '再 ' + shotsLeftRow + ' 發會下降', shooter.x - R * 4.2, shooter.y + R * 0.6, 15, '#fff', 'center', true);
    },
    down: function (p) { aim = { a: aimAngle(p) }; },
    move: function (p) { if (aim) aim.a = aimAngle(p); },
    up: function (p) {
      if (!aim || shot || over) { aim = null; return; }
      var a = aimAngle(p), sp = GG.H * 1.5;
      aim = null;
      shot = { x: shooter.x, y: shooter.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, col: cur };
      GG.sfx('shoot');
    }
  });
})();
