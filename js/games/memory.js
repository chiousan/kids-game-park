/* 動物翻翻樂（記憶翻牌，懶惰重繪） */
(function () {
  var POOL = ['bear', 'chick', 'cow', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'hippo', 'monkey', 'owl', 'panda',
    'parrot', 'penguin', 'pig', 'rabbit', 'zebra', 'whale', 'narwhal', 'chicken', 'horse', 'sloth', 'walrus'];
  var ASSETS = {};
  POOL.forEach(function (n) { ASSETS[n] = 'animals/' + n; });
  var cards, cols, rows, pairs, open, moves, matched, elapsed, waitT, preview, cw, ch, ox, oy, gap, backSpr, faceSpr, d0;
  /* 一共 5 關，每關牌越來越多：
     2 關「閃電牌」（配對後全部牌亮一下）、3 關「搗蛋猴」（翻錯時偶爾把兩張牌換位置）、
     4 關「幸運牌」（配對後少算 3 步）、5 關記憶時間變短、搗蛋猴更常出現 */
  var PAIRS = [[3, 4, 5, 6, 8], [4, 6, 8, 9, 10], [6, 8, 10, 11, 12]];
  var LV_MSG = ['', '新獎勵：閃電牌（配對後全部亮一下）', '新障礙：搗蛋猴會偷偷換牌！', '新獎勵：幸運牌（少算 3 步）', '記憶時間變短，搗蛋猴更調皮了！'];
  var lvl = 1, peekT = 0, monkey = null;
  function startLevel() {
    var np = PAIRS[d0][lvl - 1], normal = np - (lvl >= 2 ? 1 : 0) - (lvl >= 4 ? 1 : 0);
    var pick = GG.shuffle(POOL.slice()).slice(0, normal);
    if (lvl >= 2) pick.push('peek');
    if (lvl >= 4) pick.push('luck');
    pairs = np;
    cards = GG.shuffle(pick.concat(pick)).map(function (f) { return { f: f, flip: 1, target: 1, matched: false, pop: 0 }; });
    open = []; matched = 0; waitT = 0; peekT = 0; monkey = null;
    preview = [3, 2, 1.2][d0] * (lvl >= 5 ? 0.6 : 1) + (lvl - 1) * 0.4;
    layout(GG.W, GG.H);
    if (lvl > 1) GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]);
  }

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
          if (cd.f === 'peek') {
            g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(w2 / 2, h2 / 2, w2 * 0.36, 0, 7); g.fill();
            g.fillStyle = '#ffffff'; g.strokeStyle = GG.INK; g.lineWidth = 4; g.beginPath();
            var cx = w2 / 2, cy = h2 / 2, k = w2 * 0.3;
            g.moveTo(cx + k * 0.15, cy - k); g.lineTo(cx - k * 0.5, cy + k * 0.1); g.lineTo(cx, cy + k * 0.1); g.lineTo(cx - k * 0.2, cy + k); g.lineTo(cx + k * 0.55, cy - k * 0.15); g.lineTo(cx + k * 0.05, cy - k * 0.15); g.closePath(); g.fill(); g.stroke();
          } else if (cd.f === 'luck') {
            GG.spr(g, '_star', w2 / 2, h2 * 0.44, aw * 0.8, aw * 0.8);
            GG.text(g, '-3 步', w2 / 2, h2 * 0.8, w2 * 0.2, '#ff5c8a', 'center', true);
          } else GG.spr(g, cd.f, w2 / 2, h2 / 2, aw, aw * GG.ratio(cd.f));
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
  function hud() { GG.hud('第 ' + lvl + ' 關・' + moves + ' 步'); }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { lvl = n; startLevel(); };

  GG.define({
    lazy: true,
    assets: ASSETS,
    start: function (d) {
      d0 = d; lvl = 1; moves = 0; elapsed = 0;
      startLevel();
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
        if (waitT <= 0) {
          open.forEach(function (k) { cards[k].target = 0; }); open = []; busy = true;
          // 搗蛋猴：翻錯之後，偶爾把兩張還沒配對的牌偷偷換位置
          if (lvl >= 3 && Math.random() < (lvl >= 5 ? 0.45 : 0.3)) {
            var left = [];
            cards.forEach(function (c2, k2) { if (!c2.matched) left.push(k2); });
            if (left.length >= 4) {
              GG.shuffle(left);
              var a = left[0], b = left[1], tmp = cards[a]; cards[a] = cards[b]; cards[b] = tmp;
              monkey = { a: a, b: b, t: 0 };
              GG.sfx('hit');
            }
          }
        }
      }
      if (monkey) { busy = true; monkey.t += dt; if (monkey.t > 1.4) monkey = null; }
      if (peekT > 0) {
        busy = true; peekT -= dt;
        if (peekT <= 0) cards.forEach(function (c3, k3) { if (!c3.matched && open.indexOf(k3) < 0) c3.target = 0; });
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
      if (monkey) {
        [monkey.a, monkey.b].forEach(function (k) {
          var q = cardRect(k), up = Math.sin(Math.min(1, monkey.t / 0.3) * Math.PI / 2) * 20;
          GG.spr(ctx, 'monkey', q[0] + cw / 2, q[1] + ch * 0.2 - up, cw * 0.6, null, { alpha: Math.min(1, (1.4 - monkey.t) * 3) });
        });
        GG.text(ctx, '搗蛋猴把兩張牌換位置了！', w / 2, Math.max(28, oy / 2), 26, '#fff', 'center', '#8d5a2b');
      }
    },
    hintAt: function () { return preview > 0 ? false : null; },
    up: function (p) {
      if (preview > 0 || waitT > 0 || peekT > 0) return;
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
            if (a.f === 'peek') { peekT = 1.5; cards.forEach(function (c4) { if (!c4.matched) c4.target = 1; }); GG.floatText(GG.W / 2, oy, '閃電！全部亮一下', '#ffe14d', 32); }
            if (a.f === 'luck') { moves = Math.max(0, moves - 3); GG.floatText(GG.W / 2, oy, '幸運！少算 3 步', '#ff5c8a', 32); }
            open.forEach(function (k) { var q = cardRect(k); GG.burst(q[0] + cw / 2, q[1] + ch / 2, { n: 8, img: '_star', size: cw * 0.22, speed: 260 }); });
            open = [];
            GG.sfx('coin');
            if (matched === pairs) {
              hud();
              if (lvl < 5) { lvl++; GG.sfx('win'); setTimeout(function () { if (GG.state() === 'play') { startLevel(); GG.redraw(); } }, 900); }
              else {
                var total = 0; PAIRS[d0].forEach(function (n) { total += n; });
                GG.over({ score: moves, win: true, stars: moves <= total * 1.5 ? 3 : moves <= total * [2.2, 1.9, 1.7][d0] ? 2 : 1,
                  scoreText: '5 關共 ' + moves + ' 步', text: '花了 ' + Math.floor(elapsed) + ' 秒', title: '5 關全部過關！' });
              }
            }
          } else waitT = d0 === 0 ? 1.1 : 0.85;
        }
        return;
      }
    }
  });
})();
