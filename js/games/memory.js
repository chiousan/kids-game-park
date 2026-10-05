/* 動物翻翻樂（記憶翻牌，懶惰重繪） */
(function () {
  var POOL = ['bear', 'chick', 'cow', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'hippo', 'monkey', 'owl', 'panda',
    'parrot', 'penguin', 'pig', 'rabbit', 'zebra', 'whale', 'narwhal', 'chicken', 'horse', 'sloth', 'walrus'];
  var ASSETS = {};
  POOL.forEach(function (n) { ASSETS[n] = 'animals/' + n; });
  var cards, cols, rows, pairs, open, moves, matched, elapsed, waitT, preview, cw, ch, ox, oy, gap, backSpr, faceSpr, d0;

  function layout(w, h) {
    if (!pairs) return;
    var n = pairs * 2, best = null;
    for (var c = 2; c <= n; c++) {
      if (n % c) continue;
      var r = n / c, size = Math.min((w - 24) / c, (h - 70) / r / 1.25);
      if (!best || size > best.size) best = { c: c, r: r, size: size };
    }
    cols = best.c; rows = best.r;
    gap = Math.max(8, best.size * 0.09);
    cw = Math.min(best.size - gap, 170); ch = cw * 1.25;
    ox = (w - (cols * cw + (cols - 1) * gap)) / 2;
    oy = (h - (rows * ch + (rows - 1) * gap)) / 2 + 16;
    backSpr = GG.sprite(cw, ch, function (g, w2, h2) {
      var gr = g.createLinearGradient(0, 0, w2, h2);
      gr.addColorStop(0, '#ff7aa8'); gr.addColorStop(1, '#ff4f86');
      g.fillStyle = gr; GG.rr(g, 2, 2, w2 - 4, h2 - 4, 16); g.fill();
      g.save(); GG.rr(g, 2, 2, w2 - 4, h2 - 4, 16); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      for (var y = -h2; y < h2 * 2; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w2, y + w2 * 0.6); g.lineTo(w2, y + w2 * 0.6 + 9); g.lineTo(0, y + 9); g.fill(); }
      g.restore();
      g.lineWidth = 3.5; g.strokeStyle = GG.INK; GG.rr(g, 2, 2, w2 - 4, h2 - 4, 16); g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.75)'; GG.rr(g, 9, 9, w2 - 18, h2 - 18, 11); g.stroke();
      GG.spr(g, '_star', w2 / 2, h2 / 2, w2 * 0.5, w2 * 0.5);
    });
    // 每張動物牌面先畫好
    faceSpr = {};
    cards.forEach(function (cd) {
      if (faceSpr[cd.f]) return;
      faceSpr[cd.f] = [false, true].map(function (done) {
        return GG.sprite(cw, ch, function (g, w2, h2) {
          g.fillStyle = done ? '#fff6cf' : '#ffffff'; GG.rr(g, 2, 2, w2 - 4, h2 - 4, 16); g.fill();
          g.lineWidth = 3.5; g.strokeStyle = done ? '#ffb300' : GG.INK; GG.rr(g, 2, 2, w2 - 4, h2 - 4, 16); g.stroke();
          var aw = w2 * 0.78;
          GG.spr(g, cd.f, w2 / 2, h2 / 2, aw, aw * GG.ratio(cd.f));
        });
      });
    });
    GG.canvasLayer('bg').paint(function (g) {
      GG.bg(g, w, h, '#ffe3ec', '#ffbcd0');
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (var k = 0; k < 9; k++) { g.beginPath(); g.arc((k * 173) % w, (k * 271) % h, 30 + (k % 4) * 18, 0, Math.PI * 2); g.fill(); }
    });
  }
  function cardRect(i) { var c = i % cols, r = Math.floor(i / cols); return [ox + c * (cw + gap), oy + r * (ch + gap)]; }
  function hud() { GG.hud(moves + ' 步・' + Math.floor(elapsed) + ' 秒'); }

  GG.define({
    lazy: true,
    assets: ASSETS,
    start: function (d) {
      d0 = d;
      pairs = [6, 8, 10][d];
      var pick = GG.shuffle(POOL.slice()).slice(0, pairs);
      cards = GG.shuffle(pick.concat(pick)).map(function (f) { return { f: f, flip: 1, target: 1, matched: false, pop: 0 }; });
      open = []; moves = 0; matched = 0; elapsed = 0; waitT = 0;
      preview = [3, 2, 1.2][d];
      layout(GG.W, GG.H);
      hud();
    },
    resize: function (w, h) { if (cards) layout(w, h); },
    update: function (dt) {
      var busy = false;
      if (preview > 0) {
        busy = true; preview -= dt;
        if (preview <= 0) cards.forEach(function (c) { c.target = 0; });
      } else elapsed += dt;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c.flip !== c.target) { busy = true; c.flip = c.flip < c.target ? Math.min(c.target, c.flip + dt / 0.18) : Math.max(c.target, c.flip - dt / 0.18); }
        if (c.matched && c.pop < 1) { busy = true; c.pop = Math.min(1, c.pop + dt / 0.4); }
      }
      if (waitT > 0) {
        waitT -= dt;
        if (waitT <= 0) { open.forEach(function (k) { cards[k].target = 0; }); open = []; busy = true; }
      }
      hud();
      return busy;
    },
    draw: function (ctx, w) {
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i], p = cardRect(i);
        var sx = Math.abs(Math.cos(c.flip * Math.PI));
        var bounce = c.matched ? 1 + Math.sin(c.pop * Math.PI) * 0.12 : 1;
        var dw = cw * sx * bounce, dh = ch * bounce;
        if (dw < 1) continue;
        var cx = p[0] + cw / 2, cy = p[1] + ch / 2;
        ctx.fillStyle = 'rgba(160,40,80,0.22)';
        ctx.fillRect(cx - dw / 2 + 4, cy - dh / 2 + 7, dw - 8, dh - 4);
        ctx.drawImage(c.flip > 0.5 ? faceSpr[c.f][c.matched ? 1 : 0] : backSpr, cx - dw / 2, cy - dh / 2, dw, dh);
      }
      if (preview > 0) GG.text(ctx, '記住牠們！', w / 2, Math.max(28, oy / 2), 30, '#ffffff', 'center', '#d6336c');
    },
    up: function (p) {
      if (preview > 0 || waitT > 0) return;
      for (var i = 0; i < cards.length; i++) {
        var r = cardRect(i);
        if (p.x < r[0] || p.x > r[0] + cw || p.y < r[1] || p.y > r[1] + ch) continue;
        var c = cards[i];
        if (c.matched || c.target === 1 || open.length >= 2) return;
        c.target = 1; open.push(i); GG.sfx('click');
        if (open.length === 2) {
          moves++;
          var a = cards[open[0]], b = cards[open[1]];
          if (a.f === b.f) {
            a.matched = b.matched = true; matched++;
            open.forEach(function (k) { var q = cardRect(k); GG.burst(q[0] + cw / 2, q[1] + ch / 2, { n: 8, img: '_star', size: cw * 0.22, speed: 260 }); });
            open = [];
            GG.sfx('coin');
            if (matched === pairs) {
              hud();
              var par = pairs * [2.2, 1.9, 1.7][d0];
              GG.over({ score: moves, win: true, stars: moves <= pairs * 1.5 ? 3 : moves <= par ? 2 : 1,
                scoreText: moves + ' 步完成', text: '花了 ' + Math.floor(elapsed) + ' 秒', title: '全部配對成功！' });
            }
          } else waitT = d0 === 0 ? 1.1 : 0.85;
        }
        return;
      }
    }
  });
})();
