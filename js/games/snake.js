/* 貪食蛇 */
(function () {
  var cols, rows, cs, ox, oy, body, prev, dir, queue, food, bonus, stepT, stepLen, baseLen, wrap, score, growing, dead, eatPop, d0;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var GEMS = ['gem_red', 'gem_blue', 'gem_yellow', 'gem_green'];

  function layout(w, h) {
    var ctrlH = 90;
    var target = Math.min(w, h - ctrlH) > 700 ? 16 : 13;
    cs = Math.floor(Math.min(w - 16, h - ctrlH - 16) / target);
    cols = Math.floor((w - 16) / cs); rows = Math.floor((h - ctrlH - 16) / cs);
    ox = Math.round((w - cols * cs) / 2); oy = Math.round((h - ctrlH - rows * cs) / 2);
    var bw = Math.min(110, (w - 50) / 4), gap = 10, x0 = (w - (bw * 4 + gap * 3)) / 2, y0 = h - ctrlH + 8;
    GG.setPad(['left', 'up', 'down', 'right'].map(function (d, i) {
      return { id: d, icon: d, x: x0 + i * (bw + gap), y: y0, w: bw, h: ctrlH - 20, color: 'rgba(20,90,50,0.55)', onDown: function () { turn(d); } };
    }));
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
    if ((v[0] === -lv[0] && v[1] === -lv[1]) || d === last) return;
    if (queue.length < 3) queue.push(d);
  }
  function freeSpot() {
    for (var tries = 0; tries < 500; tries++) {
      var x = GG.randInt(1, cols - 2), y = GG.randInt(1, rows - 2), ok = true;
      for (var i = 0; i < body.length; i++) if (body[i][0] === x && body[i][1] === y) { ok = false; break; }
      if (ok) return { x: x, y: y, k: GG.pick(GEMS) };
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
    prev = body.map(function (p) { return p.slice(); });
    body.unshift([nx, ny]);
    if (growing > 0) { growing--; prev.push(prev[prev.length - 1].slice()); }
    else body.pop();
    var c = center([nx, ny]);
    if (nx === food.x && ny === food.y) {
      score += 1; growing += 1; eatPop = 1; GG.sfx('pop');
      GG.burst(c[0], c[1], { n: 6, img: '_star', size: cs * 0.5, speed: 200 });
      food = freeSpot();
      if (!bonus && Math.random() < 0.2) { bonus = freeSpot(); bonus.t = 7; }
      stepLen = Math.max(0.08, baseLen * Math.pow(0.99, score));
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
    GG.over({ score: score, stars: GG.starsFor(score, th[0], th[1], th[2]), text: '小蛇長到 ' + body.length + ' 節' });
  }

  var sw = null;
  GG.define({
    countdown: true,
    assets: { head: 'animals/snake', gem_red: 'run/gem_red', gem_blue: 'run/gem_blue', gem_yellow: 'run/gem_yellow', gem_green: 'run/gem_green' },
    start: function (d) {
      d0 = d;
      baseLen = [0.24, 0.17, 0.12][d];
      wrap = d < 2;
      layout(GG.W, GG.H);
      stepLen = baseLen;
      var cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];
      prev = body.map(function (p) { return p.slice(); });
      dir = 'right'; queue = []; food = freeSpot(); bonus = null;
      stepT = 0; score = 0; growing = 0; dead = false; eatPop = 0;
      GG.setScore(0);
    },
    resize: function (w, h) { layout(w, h); },
    update: function (dt) {
      if (dead) return;
      stepT += dt;
      while (stepT >= stepLen && !dead) { stepT -= stepLen; step(); }
      if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
      if (eatPop > 0) eatPop = Math.max(0, eatPop - dt * 4);
    },
    draw: function (ctx) {
      var bob = 1 + Math.sin(Date.now() / 200) * 0.08;
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
    },
    down: function (p) { sw = p; },
    move: function (p) { if (!sw) return; var d = GG.swipeDir(sw.x, sw.y, p.x, p.y, 22); if (d) { turn(d); sw = p; } },
    up: function () { sw = null; },
    key: function (k) {
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (m[k]) turn(m[k]);
    }
  });
})();
