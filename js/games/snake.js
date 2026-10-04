/* 貪食蛇 */
(function () {
  var cols, rows, cs, ox, oy, body, prev, dir, queue, food, bonus, stepT, stepLen, baseLen, wrap, score, growing, dead, eatPop;
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function layout(w, h) {
    var ctrlH = 86;
    var target = Math.min(w, h - ctrlH) > 700 ? 17 : 14;
    cs = Math.floor(Math.min(w - 16, h - ctrlH - 16) / target);
    cols = Math.floor((w - 16) / cs); rows = Math.floor((h - ctrlH - 16) / cs);
    ox = Math.round((w - cols * cs) / 2); oy = Math.round((h - ctrlH - rows * cs) / 2);
    var bw = Math.min(110, (w - 50) / 4), gap = 10, x0 = (w - (bw * 4 + gap * 3)) / 2, y0 = h - ctrlH + 8;
    GG.setPad(['left', 'up', 'down', 'right'].map(function (d, i) {
      return { id: d, icon: d, x: x0 + i * (bw + gap), y: y0, w: bw, h: ctrlH - 18, color: 'rgba(20,90,50,0.55)', onDown: function () { turn(d); } };
    }));
  }
  function turn(d) {
    var last = queue.length ? queue[queue.length - 1] : dir;
    var v = DIRS[d], lv = DIRS[last];
    if (v[0] === -lv[0] && v[1] === -lv[1]) return;
    if (d === last) return;
    if (queue.length < 3) queue.push(d);
  }
  function freeSpot() {
    for (var tries = 0; tries < 500; tries++) {
      var x = GG.randInt(0, cols - 1), y = GG.randInt(0, rows - 1), ok = true;
      for (var i = 0; i < body.length; i++) if (body[i][0] === x && body[i][1] === y) { ok = false; break; }
      if (food && food.x === x && food.y === y) ok = false;
      if (ok) return { x: x, y: y };
    }
    return { x: 0, y: 0 };
  }
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
    if (nx === food.x && ny === food.y) {
      score += 1; growing += 1; eatPop = 1; GG.sfx('pop');
      food = freeSpot(); food.k = GG.pick(['gem_red', 'gem_blue', 'gem_yellow', 'gem_green']);
      if (!bonus && Math.random() < 0.18) { bonus = freeSpot(); bonus.t = 6; }
      stepLen = Math.max(0.055, baseLen * Math.pow(0.985, score));
    }
    if (bonus && nx === bonus.x && ny === bonus.y) { score += 5; growing += 2; bonus = null; eatPop = 1; GG.sfx('coin'); }
    GG.setScore(score);
  }
  function die() {
    dead = true; GG.sfx('hit');
    GG.over({ score: score, text: '小蛇長到 ' + body.length + ' 節' });
  }
  function cellCenter(p) { return [ox + (p[0] + 0.5) * cs, oy + (p[1] + 0.5) * cs]; }

  var sw = null;
  GG.define({
    assets: { head: 'animals/snake', gem_red: 'run/gem_red', gem_blue: 'run/gem_blue', gem_yellow: 'run/gem_yellow', gem_green: 'run/gem_green' },
    start: function (d) {
      layout(GG.W, GG.H);
      baseLen = [0.16, 0.12, 0.085][d];
      wrap = d === 0;
      stepLen = baseLen;
      var cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];
      prev = body.map(function (p) { return p.slice(); });
      dir = 'right'; queue = []; food = null; food = freeSpot(); food.k = 'gem_red'; bonus = null;
      stepT = 0; score = 0; growing = 0; dead = false; eatPop = 0;
      GG.setScore(0);
    },
    resize: layout,
    update: function (dt) {
      if (dead) return;
      stepT += dt;
      while (stepT >= stepLen && !dead) { stepT -= stepLen; step(); }
      if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
      if (eatPop > 0) eatPop = Math.max(0, eatPop - dt * 4);
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#9be7a9', '#5cc277');
      ctx.fillStyle = 'rgba(30,90,50,0.3)'; GG.rr(ctx, ox - 8, oy - 2, cols * cs + 16, rows * cs + 16, 16); ctx.fill();
      ctx.fillStyle = '#c8f2b0'; GG.rr(ctx, ox - 8, oy - 8, cols * cs + 16, rows * cs + 16, 16); ctx.fill();
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#b4e99a' : '#c6f1ad';
        ctx.fillRect(ox + x * cs, oy + y * cs, cs, cs);
      }
      ctx.lineWidth = 4; ctx.strokeStyle = wrap ? 'rgba(58,56,80,0.35)' : GG.INK;
      GG.rr(ctx, ox - 8, oy - 8, cols * cs + 16, rows * cs + 16, 16); ctx.stroke();
      var bob = 1 + Math.sin(Date.now() / 200) * 0.08;
      GG.spr(ctx, food.k, ox + (food.x + 0.5) * cs, oy + (food.y + 0.5) * cs, cs * 1.35 * bob, cs * 1.35 * bob);
      if (bonus && (bonus.t > 2 || Math.floor(bonus.t * 6) % 2)) GG.spr(ctx, '_star', ox + (bonus.x + 0.5) * cs, oy + (bonus.y + 0.5) * cs, cs * 1.1 * bob, cs * 1.1 * bob, { rot: Math.sin(Date.now() / 300) * 0.3 });
      // 蛇身：在上一步與這一步之間內插，看起來是平滑移動
      var t = dead ? 1 : Math.min(1, stepT / stepLen);
      var pts = [];
      for (var i = 0; i < body.length; i++) {
        var a = prev[i] || body[i], b = body[i];
        if (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1) pts.push(null, cellCenter(b));
        else {
          var pa = cellCenter(a), pb = cellCenter(b);
          pts.push([GG.lerp(pa[0], pb[0], t), GG.lerp(pa[1], pb[1], t)]);
        }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // 粗外框 → 身體 → 亮面，三層描繪出卡通感
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
      // 頭：卡通蛇圖，朝前進方向旋轉
      var hp = pts[0] || cellCenter(body[0]);
      var v = DIRS[dir], ang = Math.atan2(v[1], v[0]) - Math.PI / 2;
      var hs = cs * 1.45 * (1 + eatPop * 0.2);
      GG.spr(ctx, 'head', hp[0], hp[1], hs, hs * GG.ratio('head'), { rot: ang });
    },
    down: function (p) { sw = p; },
    move: function (p) {
      if (!sw) return;
      var d = GG.swipeDir(sw.x, sw.y, p.x, p.y, 22);
      if (d) { turn(d); sw = p; }
    },
    up: function () { sw = null; },
    key: function (k) {
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      if (m[k]) turn(m[k]);
    }
  });
})();
