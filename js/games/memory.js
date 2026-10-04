/* 動物翻翻樂（記憶翻牌） */
(function () {
  var POOL = ['bear', 'chick', 'cow', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'hippo', 'monkey', 'owl', 'panda',
    'parrot', 'penguin', 'pig', 'rabbit', 'zebra', 'whale', 'narwhal', 'chicken', 'horse', 'sloth', 'walrus'];
  var ASSETS = { star: 'run/star' };
  POOL.forEach(function (n) { ASSETS[n] = 'animals/' + n; });
  var cards, cols, rows, pairs, open, moves, matched, elapsed, waitT, preview, cw, ch, ox, oy, gap, backSpr;

  function layout(w, h) {
    if (!pairs) return;
    var n = pairs * 2, best = null;
    // 依畫面比例挑最適合的行列
    for (var c = 2; c <= n; c++) {
      if (n % c) continue;
      var r = n / c;
      var size = Math.min((w - 24) / c, (h - 70) / r / 1.25);
      if (!best || size > best.size) best = { c: c, r: r, size: size };
    }
    cols = best.c; rows = best.r;
    gap = Math.max(8, best.size * 0.09);
    cw = Math.min(best.size - gap, 170); ch = cw * 1.25;
    ox = (w - (cols * cw + (cols - 1) * gap)) / 2;
    oy = (h - (rows * ch + (rows - 1) * gap)) / 2 + 16;
    // 卡背先畫好一張，翻牌時直接縮放
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
      var st = GG.img.star;
      if (st && st.width) g.drawImage(st, w2 / 2 - w2 * 0.28, h2 / 2 - w2 * 0.28, w2 * 0.56, w2 * 0.56);
    });
  }
  function cardRect(i) {
    var c = i % cols, r = Math.floor(i / cols);
    return [ox + c * (cw + gap), oy + r * (ch + gap)];
  }
  function hud() { GG.hud(moves + ' 步・' + Math.floor(elapsed) + ' 秒'); }

  GG.define({
    assets: ASSETS,
    start: function (d) {
      pairs = [6, 8, 12][d];
      var pick = GG.shuffle(POOL.slice()).slice(0, pairs);
      var faces = GG.shuffle(pick.concat(pick));
      cards = faces.map(function (f) { return { f: f, flip: 1, target: 1, matched: false, pop: 0 }; });
      open = []; moves = 0; matched = 0; elapsed = 0; waitT = 0;
      preview = [2.5, 1.5, 0.8][d];
      layout(GG.W, GG.H);
      hud();
    },
    resize: layout,
    update: function (dt) {
      if (preview > 0) {
        preview -= dt;
        if (preview <= 0) cards.forEach(function (c) { c.target = 0; });
      } else elapsed += dt;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c.flip < c.target) c.flip = Math.min(c.target, c.flip + dt / 0.18);
        else if (c.flip > c.target) c.flip = Math.max(c.target, c.flip - dt / 0.18);
        if (c.matched && c.pop < 1) c.pop = Math.min(1, c.pop + dt / 0.4);
      }
      if (waitT > 0) {
        waitT -= dt;
        if (waitT <= 0) { open.forEach(function (k) { cards[k].target = 0; }); open = []; }
      }
      hud();
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#ffe3ec', '#ffbcd0');
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (var k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc((k * 173) % w, (k * 271) % h, 30 + (k % 4) * 18, 0, Math.PI * 2); ctx.fill(); }
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i], p = cardRect(i);
        var sx = Math.abs(Math.cos(c.flip * Math.PI));
        var face = c.flip > 0.5;
        var bounce = c.matched ? 1 + Math.sin(c.pop * Math.PI) * 0.12 : 1;
        var dw = cw * sx * bounce, dh = ch * bounce;
        if (dw < 1) continue;
        var cx = p[0] + cw / 2, cy = p[1] + ch / 2;
        ctx.fillStyle = 'rgba(160,40,80,0.25)';
        GG.rr(ctx, cx - dw / 2, cy - dh / 2 + 6, dw, dh, 16); ctx.fill();
        if (face) {
          ctx.fillStyle = c.matched ? '#fff6cf' : '#ffffff';
          GG.rr(ctx, cx - dw / 2 + 2, cy - dh / 2 + 2, dw - 4, dh - 4, 16); ctx.fill();
          ctx.lineWidth = 3.5; ctx.strokeStyle = c.matched ? '#ffb300' : GG.INK;
          GG.rr(ctx, cx - dw / 2 + 2, cy - dh / 2 + 2, dw - 4, dh - 4, 16); ctx.stroke();
          var aw = cw * 0.78 * bounce;
          GG.spr(ctx, c.f, cx, cy, aw * sx, aw * GG.ratio(c.f));
        } else {
          ctx.drawImage(backSpr, cx - dw / 2, cy - dh / 2, dw, dh);
        }
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
            a.matched = b.matched = true; matched++; open = [];
            GG.sfx('coin');
            if (matched === pairs) {
              hud();
              GG.over({ score: moves, win: true, scoreText: moves + ' 步完成', text: '花了 ' + Math.floor(elapsed) + ' 秒', title: '全部配對成功！' });
            }
          } else waitT = 0.8;
        }
        return;
      }
    }
  });
})();
