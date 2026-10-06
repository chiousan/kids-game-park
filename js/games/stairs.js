/* 小朋友下樓梯：1～4 人一起玩（iPad 橫放、大家坐同一邊，每人一組 ← → 鍵）。
 * 樓梯一直往上升，站在樓梯上一路往下走：碰到天花板的尖刺、踩到尖刺樓梯會扣血，掉到最下面就出局。
 * 越往下越快，也會出現新的樓梯種類和獎勵。多人時最後還活著的人獲勝。
 */
(function () {
  var W, H, top, bot, ctrlH, hudH, playH, PW, PH, BH, np, players, plats, speed, spawnY, floorN, lvl, t, endT, hintT, used, lastType;
  var COLORS = ['#ff5c5c', '#ff7aa8', '#4fa3ff', '#ffc61a'];
  var NAMES = ['白兔', '粉兔', '藍兔', '黃兔'];
  var MAXHP = 10;
  var LV_AT = [0, 10, 20, 30, 45, 60, 80];
  var LV_MSG = ['', '新樓梯：輸送帶（會把你往旁邊帶）', '新障礙：尖刺樓梯（踩到扣血）　新獎勵：愛心', '新樓梯：彈簧（會彈很高）',
    '新樓梯：一踩就翻的樓梯　新獎勵：無敵星星', '樓梯升得更快了！', '最高速度！'];
  var SPEED = [0.09, 0.11, 0.125, 0.14, 0.155, 0.17, 0.19];
  var ASSETS = { grass: 'stairs/ground_grass_small', stone: 'stairs/ground_stone_small', wood: 'stairs/ground_wood_small',
    sand: 'stairs/ground_sand_small', sandBroken: 'stairs/ground_sand_small_broken', spring: 'bunny/spring', springOut: 'bunny/spring_out' };
  for (var pi = 1; pi <= 4; pi++) ['stand', 'ready', 'jump', 'hurt'].forEach(function (k) { ASSETS['p' + pi + '_' + k] = 'stairs/p' + pi + '_' + k; });

  function layout() {
    W = GG.W; H = GG.H;
    hudH = 58;
    ctrlH = Math.round(GG.clamp(H * 0.17, 104, 150));
    top = hudH + 30;
    bot = H - ctrlH;
    playH = bot - top;
    PW = Math.min(W * (np > 2 ? 0.17 : 0.2), 200);
    PH = Math.round(PW * 0.3);
    BH = Math.round(GG.clamp(playH * 0.15, 56, 86));
    setPad();
    GG.canvasLayer('bg').paint(function (g, w, h) {
      GG.bg(g, w, h, '#cfe9ff', '#e8dcff');
      // 兩側的磚牆
      for (var y = top; y < bot; y += 26) for (var side = 0; side < 2; side++) {
        g.fillStyle = (Math.floor(y / 26) % 2) ? '#b9a6e8' : '#c7b7f0';
        g.fillRect(side ? w - 12 : 0, y, 12, 26);
      }
      // 上方資訊列
      g.fillStyle = '#5b4bb5'; g.fillRect(0, 0, w, hudH);
      // 天花板尖刺
      g.fillStyle = '#7d7a96'; g.fillRect(0, hudH, w, 8);
      var n = Math.ceil(w / 34);
      for (var i = 0; i < n; i++) {
        var x = i * 34;
        g.beginPath(); g.moveTo(x, hudH + 8); g.lineTo(x + 34, hudH + 8); g.lineTo(x + 17, top); g.closePath();
        var gr = g.createLinearGradient(x, 0, x + 34, 0); gr.addColorStop(0, '#f2f3f8'); gr.addColorStop(1, '#a9adbf');
        g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = GG.INK; g.stroke();
      }
      // 下方控制區
      g.fillStyle = '#3a2f7a'; g.fillRect(0, bot, w, h - bot);
      g.fillStyle = '#ff6b6b'; g.fillRect(0, bot, w, 5);
    });
  }
  function setPad() {
    var list = [], sw = W / np, bw = Math.min(sw * 0.42, 170), bh = ctrlH - 30, y = H - ctrlH + 18;
    for (var i = 0; i < np; i++) {
      var x0 = i * sw;
      [['L', 'left', x0 + Math.max(8, sw * 0.04)], ['R', 'right', x0 + sw - Math.max(8, sw * 0.04) - bw]].forEach(function (k) {
        list.push({ id: k[0] + i, icon: k[1], x: k[2], y: y, w: bw, h: bh, r: 22, color: COLORS[i], colorDown: '#ffffff', textColor: '#fff', hit: 4,
          onDown: function () { used = true; } });
      });
    }
    GG.setPad(list);
  }
  function pickType() {
    var pool = [['normal', 6]];
    if (lvl >= 2) pool.push(['convL', 1.2], ['convR', 1.2]);
    if (lvl >= 3 && lastType !== 'spike') pool.push(['spike', 1.3 + (lvl - 3) * 0.25]);
    if (lvl >= 4) pool.push(['spring', 1]);
    if (lvl >= 5) pool.push(['flip', 1.3]);
    var sum = 0, r;
    pool.forEach(function (q) { sum += q[1]; });
    r = Math.random() * sum;
    for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return 'normal';
  }
  function addPlat(y, type, x, w) {
    type = type || pickType();
    lastType = type;
    var p = { x: x === undefined ? GG.rand(PW / 2 + 16, W - PW / 2 - 16) : x, y: y, w: w || PW, type: type, floor: ++floorN, t: 0, broken: 0, item: null, used: 0 };
    if (type === 'normal') {
      var q = Math.random();
      if (lvl >= 3 && q < 0.08) p.item = 'heart';
      else if (lvl >= 5 && q < 0.13) p.item = 'star';
    }
    plats.push(p);
  }
  function hurt(p, n, why) {
    if (p.star > 0 || p.hurtT > 0) return;
    p.hp -= n; p.hurtT = 0.7;
    GG.sfx('hurt'); GG.shake(6, 0.2);
    GG.floatText(p.x, p.y - BH * 1.2, '-' + n + (why ? ' ' + why : ''), '#ff6b6b', 24);
    if (p.hp <= 0) die(p);
  }
  function die(p) {
    if (p.dead) return;
    p.dead = true; p.deadT = 0; p.plat = null; p.vy = -playH * 0.6; p.hp = Math.max(0, p.hp);
    GG.sfx('lose');
    GG.burst(p.x, p.y - BH / 2, { n: 12, img: '_star', size: 20, speed: 260 });
    var alive = players.filter(function (q) { return !q.dead; });
    if ((np === 1 && !alive.length) || (np > 1 && alive.length <= 1)) endT = 1.1;
  }
  /* 掉到最下面：扣 4 滴血，放回上面的樓梯（血用完才出局，對小朋友比較友善） */
  function rescue(p) {
    p.hp -= 4;
    GG.sfx('hurt'); GG.shake(8, 0.25);
    if (p.hp <= 0) { die(p); return; }
    var best = null;
    plats.forEach(function (q) {
      if (q.broken || q.type === 'spike' || q.type === 'flip' || q.y < top + playH * 0.3 || q.y > top + playH * 0.65) return;
      if (!best || Math.abs(q.x - p.x) < Math.abs(best.x - p.x)) best = q;
    });
    if (!best) { addPlat(top + playH * 0.45, 'normal', GG.clamp(p.x, PW / 2 + 16, W - PW / 2 - 16)); best = plats[plats.length - 1]; best.floor = p.floor; }
    p.x = best.x; p.y = best.y; p.vy = 0; p.plat = best; p.last = best; p.hurtT = 1.5;
    GG.floatText(p.x, p.y - BH * 1.4, '-4 救回來了！', '#ff8a8a', 24);
  }
  function finish() {
    if (np === 1) {
      var f = players[0].floor;
      GG.over({ score: f, stars: GG.starsFor(f, 15, 35, 60), title: '掉下去了！', text: '走到地下 ' + f + ' 層', icon: 'assets/stairs/p1_hurt.png' });
      return;
    }
    var alive = players.filter(function (q) { return !q.dead; }), win;
    if (alive.length) win = alive[0];
    else win = players.slice().sort(function (a, b) { return b.floor - a.floor; })[0];
    var lines = players.map(function (q) { return (q.i + 1) + 'P ' + NAMES[q.i] + '：' + q.floor + ' 層'; }).join('　');
    GG.over({ score: win.floor, win: true, stars: 3, title: (win.i + 1) + 'P ' + NAMES[win.i] + '贏了！', text: lines, icon: 'assets/stairs/p' + (win.i + 1) + '_jump.png' });
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { players.forEach(function (q) { q.floor = LV_AT[Math.min(n, LV_AT.length) - 1]; }); };

  GG.define({
    noHint: true,
    countdown: true,
    modes: [
      { label: '1 人玩', value: 1, cls: 'b-easy' },
      { label: '2 人一起玩', value: 2, cls: 'b-mid' },
      { label: '3 人一起玩', value: 3, cls: 'b-blue' },
      { label: '4 人一起玩', value: 4, cls: 'b-hard' }
    ],
    assets: ASSETS,
    start: function (m) {
      np = m; floorN = 0; lvl = 1; t = 0; endT = 0; hintT = 0; used = false; lastType = '';
      layout();
      plats = [];
      // 出發的大平台
      var startY = top + playH * 0.58;
      addPlat(startY, 'normal', W / 2, Math.min(W * 0.8, PW * (np + 1.4)));
      plats[0].item = null;
      floorN = 0; plats[0].floor = 0;
      spawnY = startY;
      while (spawnY < bot + 60) { spawnY += playH * GG.rand(0.17, 0.23); addPlat(spawnY); }
      players = [];
      for (var i = 0; i < np; i++) {
        var px = W / 2 + (i - (np - 1) / 2) * Math.min(PW * 0.9, W * 0.8 / np);
        players.push({ i: i, x: px, y: startY, vx: 0, vy: 0, hp: MAXHP, plat: plats[0], last: plats[0], dead: false, deadT: 0, floor: 0, face: 1, hurtT: 0, star: 0, spring: 0 });
      }
      speed = playH * SPEED[0];
      GG.hud('地下 0 層');
    },
    resize: function () { if (players) { layout(); } },
    update: function (dt) {
      t += dt; hintT += dt;
      if (endT > 0) { endT -= dt; if (endT <= 0) { finish(); return; } }
      // 關卡：看跑最深的人
      var deepest = 0;
      players.forEach(function (q) { deepest = Math.max(deepest, q.floor); });
      if (lvl < LV_AT.length && deepest >= LV_AT[lvl]) { lvl++; GG.banner('地下 ' + LV_AT[lvl - 1] + ' 層', LV_MSG[lvl - 1]); }
      speed = GG.lerp(speed, playH * SPEED[lvl - 1], Math.min(1, dt));
      var dy = speed * dt;
      // 樓梯往上升
      for (var i = plats.length - 1; i >= 0; i--) {
        var pl = plats[i];
        pl.y -= dy; pl.t += dt;
        if (pl.broken) { pl.broken += dt; if (pl.broken > 0.8) { plats.splice(i, 1); continue; } }
        if (pl.used > 0) pl.used -= dt;
        if (pl.y < top - 40) plats.splice(i, 1);
      }
      spawnY -= dy;
      while (spawnY < bot + 60) { spawnY += playH * GG.rand(0.17, 0.23); addPlat(spawnY); }
      var G = playH * 2.4, maxFall = playH * 1.3;
      players.forEach(function (p) {
        if (p.hurtT > 0) p.hurtT -= dt;
        if (p.star > 0) p.star -= dt;
        if (p.dead) { p.deadT += dt; p.vy += G * dt; p.y += p.vy * dt; return; }
        var k = GG.keys, dir = (GG.held('R' + p.i) ? 1 : 0) - (GG.held('L' + p.i) ? 1 : 0);
        if (p.i === 0) dir += (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
        if (p.i === 1) dir += (k.d ? 1 : 0) - (k.a ? 1 : 0);
        dir = GG.clamp(dir, -1, 1);
        if (dir) { p.face = dir; used = true; }
        p.x += dir * W * 0.3 * dt;
        if (p.plat) {
          var q = p.plat;
          if (plats.indexOf(q) < 0 || q.broken || Math.abs(p.x - q.x) > q.w / 2 + 8) p.plat = null;
          else {
            p.y = q.y;
            if (q.type === 'convL' || q.type === 'convR') p.x += (q.type === 'convR' ? 1 : -1) * W * 0.12 * dt;
            if (q.type === 'flip' && q.t - q.stepT > 0.35 && !q.broken) { q.broken = 0.01; p.plat = null; GG.sfx('hit'); }
          }
        }
        if (!p.plat) {
          var oy = p.y;
          p.vy = Math.min(maxFall, p.vy + G * dt);
          p.y += p.vy * dt;
          if (p.vy >= 0) for (var j = 0; j < plats.length; j++) {
            var pl2 = plats[j];
            if (pl2.broken || Math.abs(p.x - pl2.x) > pl2.w / 2 + 8) continue;
            if (oy <= pl2.y + dy + 2 && p.y >= pl2.y) { land(p, pl2); break; }
          }
        }
        p.x = GG.clamp(p.x, 20, W - 20);
        // 天花板
        if (p.y - BH < top) {
          hurt(p, 3, '好痛！');
          p.plat = null; p.y = top + BH + 4; p.vy = Math.max(p.vy, playH * 0.3);
        }
        if (p.y - BH > bot) rescue(p);
      });
      GG.hud(np === 1 ? '地下 ' + players[0].floor + ' 層' : '最深 地下 ' + deepest + ' 層');
    },
    draw: function (ctx, w, h) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top - 30, w, bot - top + 30); ctx.clip();
      plats.forEach(function (pl) {
        var img = { normal: 'grass', convL: 'wood', convR: 'wood', spike: 'stone', spring: 'grass', flip: pl.broken ? 'sandBroken' : 'sand' }[pl.type];
        var drop = pl.broken ? pl.broken * pl.broken * 400 : 0;
        GG.spr(ctx, img, pl.x, pl.y + PH / 2 + drop, pl.w, PH, pl.broken ? { rot: pl.broken * 1.2, alpha: Math.max(0, 1 - pl.broken) } : null);
        if (pl.type === 'convL' || pl.type === 'convR') {
          var d = pl.type === 'convR' ? 1 : -1, off = ((t * 60) % 30) * d;
          ctx.save(); ctx.beginPath(); ctx.rect(pl.x - pl.w / 2 + 6, pl.y, pl.w - 12, PH * 0.5); ctx.clip();
          for (var ax = -pl.w / 2 - 30; ax < pl.w / 2 + 30; ax += 30) GG.icon(ctx, d > 0 ? 'right' : 'left', pl.x + ax + off, pl.y + PH * 0.25, PH * 0.4, '#ffe14d');
          ctx.restore();
        } else if (pl.type === 'spike') {
          var n = Math.max(3, Math.floor(pl.w / 22)), sw = pl.w * 0.9 / n, x0 = pl.x - pl.w * 0.45;
          ctx.fillStyle = '#e8eaf2'; ctx.strokeStyle = GG.INK; ctx.lineWidth = 2.5;
          for (var k2 = 0; k2 < n; k2++) {
            ctx.beginPath(); ctx.moveTo(x0 + k2 * sw, pl.y + 2); ctx.lineTo(x0 + (k2 + 0.5) * sw, pl.y - PH * 0.55); ctx.lineTo(x0 + (k2 + 1) * sw, pl.y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
          }
        } else if (pl.type === 'spring') {
          GG.spr(ctx, pl.used > 0 ? 'springOut' : 'spring', pl.x, pl.y - PH * 0.3, PH * 1.5, null);
        }
        if (pl.item) GG.spr(ctx, pl.item === 'heart' ? '_heart' : '_star', pl.x, pl.y - PH * 0.9 + Math.sin(t * 4) * 4, PH * 1.2, PH * 1.2);
      });
      players.forEach(function (p) {
        if (p.dead && p.deadT > 2) return;
        if (!p.dead && p.hurtT > 0 && Math.floor(p.hurtT * 12) % 2) return;
        var key = 'p' + (p.i + 1) + '_' + (p.dead || p.hurtT > 0.4 ? 'hurt' : p.spring > 0 && !p.plat ? 'jump' : p.plat ? 'stand' : 'ready');
        if (p.star > 0) { ctx.fillStyle = 'rgba(255,225,77,' + (0.35 + Math.sin(t * 16) * 0.15) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y - BH / 2, BH * 0.62, 0, Math.PI * 2); ctx.fill(); }
        GG.spr(ctx, key, p.x, p.y - BH / 2, BH / GG.ratio(key), BH, { flip: p.face < 0, rot: p.dead ? p.deadT * 4 : 0 });
        if (np > 1 && !p.dead) {
          ctx.fillStyle = COLORS[p.i]; GG.rr(ctx, p.x - 18, p.y - BH - 26, 36, 22, 11); ctx.fill();
          GG.text(ctx, (p.i + 1) + 'P', p.x, p.y - BH - 15, 16, '#fff', 'center', true);
        }
      });
      ctx.restore();
      // 上方：每個人的血量和樓層
      var sw = w / np;
      players.forEach(function (p) {
        var x0 = p.i * sw + 8, cx = x0 + 22;
        var hk = 'p' + (p.i + 1) + '_stand';
        GG.spr(ctx, hk, cx, hudH / 2, (hudH - 10) / GG.ratio(hk), hudH - 10, p.dead ? { alpha: 0.4 } : null);
        var bw = Math.min(sw - (sw < 270 ? 100 : 130), 220), bx = x0 + 44, by = hudH / 2 - 9;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; GG.rr(ctx, bx, by, bw, 18, 9); ctx.fill();
        var f = Math.max(0, p.hp) / MAXHP;
        ctx.fillStyle = f > 0.5 ? '#43d17a' : f > 0.25 ? '#ffb300' : '#ff5252';
        if (f > 0) { GG.rr(ctx, bx, by, Math.max(18, bw * f), 18, 9); ctx.fill(); }
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; GG.rr(ctx, bx, by, bw, 18, 9); ctx.stroke();
        GG.text(ctx, p.dead ? '出局' : (sw < 270 ? p.floor + ' 層' : '地下 ' + p.floor + ' 層'), bx + bw + 8, hudH / 2, 18, p.dead ? '#ff8a8a' : '#fff', 'left', true);
        if (np > 1) {
          // 控制鍵上方標示是誰的
          GG.text(ctx, (p.i + 1) + 'P ' + NAMES[p.i], p.i * sw + sw / 2, h - ctrlH + 10, 15, '#fff', 'center', true);
        }
      });
    },
    drawTop: function (ctx, w) {
      // 教學：還沒按過之前，手套示範按 ← →（畫在按鍵上面）
      if (used || hintT >= 6) return;
      var bt = GG.button((Math.floor(hintT / 0.8) % 2 ? 'R' : 'L') + '0');
      if (bt) GG.hand(ctx, bt.x + bt.w / 2, bt.y + bt.h * 0.3, Math.min(56, bt.h * 0.55), (hintT % 0.8) < 0.4);
      GG.text(ctx, np > 1 ? '每個人按自己顏色的 ← → 鍵' : '按 ← → 鍵左右移動', w / 2, bot - 62, 26, '#5b4bb5', 'center', '#ffffff');
      GG.text(ctx, '站在樓梯上往下走，別碰到上面的尖刺！', w / 2, bot - 26, 22, '#5b4bb5', 'center', '#ffffff');
    }
  });

  function land(p, pl) {
    p.y = pl.y; p.vy = 0; p.plat = pl; p.spring = 0;
    p.floor = Math.max(p.floor, pl.floor);
    if (pl.type === 'spike') hurt(p, 3, '尖刺！');
    else if (pl.type === 'spring') { p.plat = null; p.vy = -playH * 1.05; p.spring = 1; pl.used = 0.3; GG.sfx('jump'); }
    else {
      if (pl.type === 'flip') pl.stepT = pl.t;
      if (p.last !== pl && p.hp < MAXHP) { p.hp++; }
      GG.sfx('bounce');
    }
    p.last = pl;
    if (pl.item) {
      if (pl.item === 'heart') { p.hp = Math.min(MAXHP, p.hp + 3); GG.floatText(p.x, p.y - BH * 1.3, '+3 愛心', '#ff6b8a', 24); }
      else { p.star = 5; GG.floatText(p.x, p.y - BH * 1.3, '無敵星星！', '#ffe14d', 24); }
      pl.item = null; GG.sfx('power');
    }
  }
})();
