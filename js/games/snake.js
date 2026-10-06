/* 貪食蛇 */
(function () {
  var stick, used, hintT, cols, rows, cs, ox, oy, body, prev, dir, queue, food, bonus, stepT, stepLen, baseLen, wrap, score, growing, dead, eatPop, d0;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var GEMS = ['gem_red', 'gem_blue', 'gem_yellow', 'gem_green'];
  // 關卡：吃越多關卡越高，變快、出現石頭障礙與新獎勵
  var LV_AT = [0, 5, 12, 20, 30, 42];
  var LV_MSG = ['', '變快了！新獎勵：星星（+5）', '新障礙：石頭（不能撞）　新獎勵：金幣（+10）', '石頭變多了　新獎勵：時鐘（變慢）',
    '石頭更多、更快了！', '最高速度！'];
  var ROCKS_AT = [0, 0, 3, 5, 7, 9];
  var lvl = 1, rocks = [], coin = null, clock = null, slowT = 0;
  function rockAt(x, y) { for (var i = 0; i < rocks.length; i++) if (rocks[i].x === x && rocks[i].y === y) return true; return false; }
  function addRocks(n) {
    var h = body[0];
    for (var k = 0, tries = 0; k < n && tries < 400; tries++) {
      var x = GG.randInt(1, cols - 2), y = GG.randInt(1, rows - 2);
      if (Math.abs(x - h[0]) + Math.abs(y - h[1]) < 5 || rockAt(x, y) || (food && food.x === x && food.y === y)) continue;
      var onBody = false;
      for (var i = 0; i < body.length; i++) if (body[i][0] === x && body[i][1] === y) { onBody = true; break; }
      if (onBody) continue;
      rocks.push({ x: x, y: y }); k++;
    }
  }
  function speedLen() { return Math.max(0.075, baseLen * Math.pow(0.99, score) * (1 - (lvl - 1) * 0.04)) * (slowT > 0 ? 1.6 : 1); }

  function layout(w, h) {
    // 固定搖桿：直放在下方正中間，橫放在左邊
    var R = Math.round(GG.clamp(Math.min(w, h) * 0.11, 54, 84)), land = w > h * 1.15;
    var bx = 0, bw = w, bh = h, sx, sy, zone;
    if (land) {
      var side = R * 2 + 80;
      bx = side; bw = w - side; sx = side / 2; sy = h - R - 44;
      zone = { x: 0, y: sy - R * 2.4, w: side, h: h - sy + R * 2.4 };
    } else {
      var ctrl = R * 2 + 48;
      bh = h - ctrl; sx = w / 2; sy = h - ctrl / 2;
      zone = { x: 0, y: h - ctrl, w: w, h: ctrl };
    }
    var target = Math.min(bw, bh) > 700 ? 16 : 13;
    cs = Math.floor(Math.min(bw - 16, bh - 16) / target);
    cols = Math.floor((bw - 16) / cs); rows = Math.floor((bh - 16) / cs);
    ox = bx + Math.round((bw - cols * cs) / 2); oy = Math.round((bh - rows * cs) / 2);
    stick = GG.stick({ cx: sx, cy: sy, R: R, zone: zone, color: '#7cf0a0',
      onStick: function (b, changed) { if (b.dir) { used = true; if (changed) turn(b.dir); } } });
    GG.setPad([stick]);
    GG.canvasLayer('bg').paint(function (g) {
      GG.bg(g, w, h, '#9be7a9', '#5cc277');
      GG.panel(g, ox - 8, oy - 8, cols * cs + 16, rows * cs + 16, 16, '#c8f2b0');
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        g.fillStyle = (x + y) % 2 ? '#b4e99a' : '#c6f1ad'; g.fillRect(ox + x * cs, oy + y * cs, cs, cs);
      }
      if (wrap) { g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.setLineDash([10, 10]); g.strokeRect(ox, oy, cols * cs, rows * cs); g.setLineDash([]); }
    });
  }
  function turn(d) {
    var last = queue.length ? queue[queue.length - 1] : dir;
    var v = DIRS[d], lv = DIRS[last];
    if (d === last) return;
    if (v[0] === -lv[0] && v[1] === -lv[1]) {
      // 往反方向推：自動先轉 90 度再掉頭（小朋友常常這樣推）
      if (queue.length > 1) return;
      var side = lv[0] ? (body[0][1] > rows / 2 ? 'up' : 'down') : (body[0][0] > cols / 2 ? 'left' : 'right');
      queue.push(side, d);
      return;
    }
    if (queue.length < 3) queue.push(d);
  }
  function freeSpot() {
    for (var tries = 0; tries < 500; tries++) {
      var x = GG.randInt(1, cols - 2), y = GG.randInt(1, rows - 2), ok = true;
      for (var i = 0; i < body.length; i++) if (body[i][0] === x && body[i][1] === y) { ok = false; break; }
      if (ok && !rockAt(x, y)) return { x: x, y: y, k: GG.pick(GEMS) };
    }
    return { x: 1, y: 1, k: GEMS[0] };
  }
  function center(p) { return [ox + (p[0] + 0.5) * cs, oy + (p[1] + 0.5) * cs]; }
  function step() {
    if (queue.length) dir = queue.shift();
    var v = DIRS[dir], h = body[0], nx = h[0] + v[0], ny = h[1] + v[1];
    if (wrap) { nx = (nx + cols) % cols; ny = (ny + rows) % rows; }
    else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return die();
    for (var i = 0; i < body.length - (growing ? 0 : 1); i++) if (body[i][0] === nx && body[i][1] === ny) return die();
    if (rockAt(nx, ny)) return die();
    prev = body.map(function (p) { return p.slice(); });
    body.unshift([nx, ny]);
    if (growing > 0) { growing--; prev.push(prev[prev.length - 1].slice()); }
    else body.pop();
    var c = center([nx, ny]);
    if (nx === food.x && ny === food.y) {
      score += 1; growing += 1; eatPop = 1; GG.sfx('pop');
      GG.burst(c[0], c[1], { n: 6, img: '_star', size: cs * 0.5, speed: 200 });
      food = freeSpot();
      if (lvl >= 2 && !bonus && Math.random() < 0.22) { bonus = freeSpot(); bonus.t = 7; }
      if (lvl >= 3 && !coin && Math.random() < 0.2) { coin = freeSpot(); coin.t = 8; }
      if (lvl >= 4 && !clock && Math.random() < 0.12) { clock = freeSpot(); clock.t = 8; }
      if (lvl < LV_AT.length && score >= LV_AT[lvl]) {
        lvl++; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]);
        addRocks(ROCKS_AT[lvl - 1] - rocks.length);
      }
      stepLen = speedLen();
    }
    if (coin && nx === coin.x && ny === coin.y) {
      score += 10; coin = null; GG.sfx('coin');
      GG.floatText(c[0], c[1] - cs, '+10', '#ffe14d', 32);
    }
    if (clock && nx === clock.x && ny === clock.y) {
      slowT = 6; clock = null; GG.sfx('power'); stepLen = speedLen();
      GG.floatText(c[0], c[1] - cs, '變慢了！', '#9fe3ff', 30);
    }
    if (bonus && nx === bonus.x && ny === bonus.y) {
      score += 5; growing += 2; bonus = null; eatPop = 1; GG.sfx('coin');
      GG.floatText(c[0], c[1] - cs, '+5', '#ffe14d', 32);
    }
    GG.setScore(score);
  }
  function die() {
    dead = true; GG.sfx('hurt'); GG.shake(8, 0.25);
    var th = [[5, 12, 25], [8, 18, 30], [10, 20, 35]][d0];
    GG.over({ score: score, stars: GG.starsFor(score, th[0], th[1], th[2]), text: '到第 ' + lvl + ' 關，小蛇長到 ' + body.length + ' 節' });
  }

  var sw = null;
  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { score = LV_AT[Math.min(n, LV_AT.length) - 1]; lvl = n; addRocks(ROCKS_AT[n - 1]); };

  GG.define({
    noHint: true,
    countdown: true,
    assets: { rock: 'race/rock1', head: 'animals/snake', gem_red: 'run/gem_red', gem_blue: 'run/gem_blue', gem_yellow: 'run/gem_yellow', gem_green: 'run/gem_green' },
    start: function (d) {
      d0 = d;
      baseLen = [0.24, 0.17, 0.12][d];
      wrap = d < 2;
      layout(GG.W, GG.H);
      stepLen = baseLen;
      var cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];
      prev = body.map(function (p) { return p.slice(); });
      dir = 'right'; queue = []; rocks = []; lvl = 1; coin = null; clock = null; slowT = 0; food = freeSpot(); bonus = null;
      stepT = 0; score = 0; growing = 0; dead = false; eatPop = 0; used = false; hintT = 0;
      GG.setScore(0);
    },
    resize: function (w, h) { layout(w, h); },
    update: function (dt) {
      if (dead) return;
      hintT += dt;
      stepT += dt;
      while (stepT >= stepLen && !dead) { stepT -= stepLen; step(); }
      if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
      if (coin) { coin.t -= dt; if (coin.t <= 0) coin = null; }
      if (clock) { clock.t -= dt; if (clock.t <= 0) clock = null; }
      if (slowT > 0) { slowT -= dt; if (slowT <= 0) stepLen = speedLen(); }
      if (eatPop > 0) eatPop = Math.max(0, eatPop - dt * 4);
    },
    draw: function (ctx) {
      var bob = 1 + Math.sin(Date.now() / 200) * 0.08;
      rocks.forEach(function (r) { GG.spr(ctx, 'rock', ox + (r.x + 0.5) * cs, oy + (r.y + 0.5) * cs, cs * 1.1, cs * 1.1); });
      if (coin && (coin.t > 2 || Math.floor(coin.t * 6) % 2)) GG.spr(ctx, '_coin', ox + (coin.x + 0.5) * cs, oy + (coin.y + 0.5) * cs, cs * 1.1 * bob, cs * 1.1 * bob);
      if (clock && (clock.t > 2 || Math.floor(clock.t * 6) % 2)) {
        var kx = ox + (clock.x + 0.5) * cs, ky = oy + (clock.y + 0.5) * cs;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(kx, ky, cs * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#3d8bfd'; ctx.stroke();
        ctx.strokeStyle = GG.INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx, ky - cs * 0.32); ctx.moveTo(kx, ky); ctx.lineTo(kx + cs * 0.22, ky + cs * 0.06); ctx.stroke();
      }
      GG.spr(ctx, food.k, ox + (food.x + 0.5) * cs, oy + (food.y + 0.5) * cs, cs * 1.35 * bob, cs * 1.35 * bob);
      if (bonus && (bonus.t > 2 || Math.floor(bonus.t * 6) % 2)) GG.spr(ctx, '_star', ox + (bonus.x + 0.5) * cs, oy + (bonus.y + 0.5) * cs, cs * 1.2 * bob, cs * 1.2 * bob);
      var t = dead ? 1 : Math.min(1, stepT / stepLen), pts = [];
      for (var i = 0; i < body.length; i++) {
        var a = prev[i] || body[i], b = body[i];
        if (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1) pts.push(null, center(b));
        else { var pa = center(a), pb = center(b); pts.push([GG.lerp(pa[0], pb[0], t), GG.lerp(pa[1], pb[1], t)]); }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var layers = [[cs * 0.86, GG.INK, 0], [cs * 0.7, '#3ccf6a', 0], [cs * 0.2, 'rgba(255,255,255,0.35)', -cs * 0.14]];
      for (var k = 0; k < 3; k++) {
        ctx.strokeStyle = layers[k][1]; ctx.lineWidth = layers[k][0];
        ctx.beginPath();
        var pen = false, off = layers[k][2];
        for (i = 0; i < pts.length; i++) {
          if (!pts[i]) { pen = false; continue; }
          if (!pen) { ctx.moveTo(pts[i][0], pts[i][1] + off); ctx.lineTo(pts[i][0] + 0.01, pts[i][1] + off); pen = true; }
          else ctx.lineTo(pts[i][0], pts[i][1] + off);
        }
        ctx.stroke();
      }
      var hp = pts[0] || center(body[0]), v = DIRS[dir], hs = cs * 1.45 * (1 + eatPop * 0.2);
      GG.spr(ctx, 'head', hp[0], hp[1], hs, hs * GG.ratio('head'), { rot: Math.atan2(v[1], v[0]) - Math.PI / 2 });
      GG.hudText(ctx, '第 ' + lvl + ' 關' + (slowT > 0 ? '・變慢中' : ''), ox + cols * cs - 12, oy + 24, 20, '#fff', 'right');
      // 教學：還沒碰搖桿前，手套示範往上推
      if (!used && hintT < 6) {
        var k = (hintT % 1.6) / 1.6, push = Math.min(1, k * 2.5);
        GG.hand(ctx, stick.cx, stick.cy - stick.R * 0.55 * push, stick.R * 1.3, k > 0.15);
        GG.text(ctx, '推搖桿讓小蛇轉彎', stick.cx, stick.cy - stick.R * 1.75, 22, '#fff', 'center', true);
      }
    },
    down: function (p) { sw = p; used = true; },
    move: function (p) { if (!sw) return; var d = GG.swipeDir(sw.x, sw.y, p.x, p.y, 22); if (d) { turn(d); sw = p; } },
    up: function () { sw = null; },
    key: function (k) {
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (m[k]) turn(m[k]);
    }
  });
})();
