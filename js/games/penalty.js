/* 點球大戰：滑動射門，騙過企鵝守門員（第 4 關換成好多隻手的章魚） */
(function () {
  var W, H, goal, spot, ballR, shots, goals, phase, shot, keeper, msg, msgT, swipe, d0, history, t;
  var TOTAL = 10;

  function layout() {
    W = GG.W; H = GG.H;
    var gw = Math.min(W * 0.84, H * 0.75);
    goal = { x: (W - gw) / 2, y: H * 0.15, w: gw, h: gw * 0.42 };
    spot = { x: W / 2, y: H * 0.8 };
    ballR = Math.min(W, H) * 0.06;
    var gy0 = goal.y + goal.h;
    GG.canvasLayer('bg').paint(function (g, w, h) {
      GG.bg(g, w, gy0, '#8fd8ff', '#d9f3ff');
      GG.tile(g, 'hills', 0, 0, w, gy0, gy0, 0, 0);
      for (var i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#5cc85a' : '#6fd66a';
        var y0 = gy0 + (h - gy0) * Math.pow(i / 10, 1.3), y1 = gy0 + (h - gy0) * Math.pow((i + 1) / 10, 1.3);
        g.fillRect(0, y0, w, y1 - y0 + 1);
      }
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, gy0); g.lineTo(w, gy0); g.stroke();
      var bx = goal.w * 0.18;
      g.beginPath(); g.moveTo(goal.x - bx, gy0); g.lineTo(goal.x - bx * 1.6, gy0 + goal.h * 0.55); g.lineTo(goal.x + goal.w + bx * 1.6, gy0 + goal.h * 0.55); g.lineTo(goal.x + goal.w + bx, gy0); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(spot.x, spot.y + ballR * 0.9, 10, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(goal.x, goal.y, goal.w, goal.h);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
      g.beginPath();
      for (var gx = goal.x; gx <= goal.x + goal.w; gx += 16) { g.moveTo(gx, goal.y); g.lineTo(gx, gy0); }
      for (var gyy = goal.y; gyy <= gy0; gyy += 16) { g.moveTo(goal.x, gyy); g.lineTo(goal.x + goal.w, gyy); }
      g.stroke();
    });
  }
  /* 關卡：第 4 球起有角落金星（射中加 5 分）、第 7 球起有人牆、第 9 球起人牆會移動、守門員變大 */
  var LV_MSG = ['', '新獎勵：射中角落的金星 +5 分', '新障礙：小企鵝人牆（低球會被擋住）', '人牆會移動、章魚守門員上場（好多隻手）！'];
  var lvl = 1, bonus = 0, star = null, wall = null;
  function resetKick() {
    phase = 'aim'; shot = null;
    var nl = shots < 3 ? 1 : shots < 6 ? 2 : shots < 8 ? 3 : 4;
    if (nl > lvl) { lvl = nl; GG.banner('第 ' + lvl + ' 關', LV_MSG[lvl - 1]); }
    keeper = { x: W / 2, tx: W / 2, ty: goal.y + goal.h * 0.62, dive: 0, dir: 0, react: 0, sizeW: goal.w * 0.2 * (lvl >= 4 ? 1.12 : 1),
      anim: new GG.Anim(lvl >= 4 ? 'octopus' : 'penguin') };
    star = lvl >= 2 ? { x: Math.random() < 0.5 ? goal.x + ballR * 1.6 : goal.x + goal.w - ballR * 1.6, y: goal.y + ballR * 1.5, r: ballR * 1.5 } : null;
    wall = lvl >= 3 ? { x0: goal.x + goal.w * GG.rand(0.3, 0.7), x: 0, w: goal.w * 0.28, mv: lvl >= 4 } : null;
    if (wall) { wall.x = wall.x0; wall.pg = [0, 1, 2].map(function () { return new GG.Anim('penguinS'); }); }
  }
  function wallTop() { return goal.y + goal.h * 0.55; }
  /* 落點：手指放開的位置就是射門的位置；在球門線下方就放開（短滑）時，順著滑動方向延伸到球門 */
  function aimPoint(sx, sy, ex, ey) {
    var gy0 = goal.y + goal.h, dx = ex - sx, dy = ey - sy;
    if (dy > -30) return null;
    var tx, ty;
    if (ey <= gy0) { tx = ex; ty = ey; }
    else { var k = (spot.y - (goal.y + goal.h * 0.5)) / -dy; tx = spot.x + dx * k; ty = goal.y + goal.h * 0.5; }
    // 稍微超出一點點還是算在框內（對小朋友寬鬆），超出很多才是射偏
    var mx = ballR * 1.2;
    if (tx > goal.x - mx && tx < goal.x + goal.w + mx) tx = GG.clamp(tx, goal.x + ballR * 0.6, goal.x + goal.w - ballR * 0.6);
    if (ty > goal.y - mx && ty < gy0) ty = GG.clamp(ty, goal.y + ballR * 0.6, gy0 - ballR * 0.5);
    return { x: tx, y: ty };
  }
  function kick(tx, ty) {
    shot = { sx: spot.x, sy: spot.y, tx: tx, ty: ty, t: 0, dur: 0.55 };
    phase = 'fly'; GG.sfx('shoot');
    var guessRight = Math.random() < [0.25, 0.45, 0.65][d0];
    var inGoal = tx > goal.x && tx < goal.x + goal.w;
    var target = guessRight || !inGoal ? tx : (tx < W / 2 ? goal.x + goal.w * GG.rand(0.65, 0.9) : goal.x + goal.w * GG.rand(0.1, 0.35));
    keeper.tx = GG.clamp(target, goal.x + keeper.sizeW * 0.3, goal.x + goal.w - keeper.sizeW * 0.3);
    keeper.ty = GG.clamp(ty, goal.y + goal.h * 0.25, goal.y + goal.h * 0.62);
    keeper.react = [0.35, 0.25, 0.14][d0];
    keeper.speed = goal.w * [0.8, 1.05, 1.4][d0];
  }
  function result(kind) {
    phase = 'result'; msgT = 0; shots++;
    history.push(kind === 'goal');
    if (kind === 'goal') {
      goals++; msg = '進球！'; GG.sfx('goal'); GG.shake(6, 0.2);
      GG.burst(shot.tx, shot.ty, { n: 22, img: '_star', size: 26, speed: 380 });
      if (star && GG.dist(shot.tx, shot.ty, star.x, star.y) < star.r * 1.2) { bonus += 5; msg = '進球！金星 +5'; GG.sfx('coin'); }
    } else if (kind === 'save') { msg = '被撲掉了！'; GG.sfx('hit'); }
    else if (kind === 'wall') {
      msg = '被人牆擋住了！'; GG.sfx('hit');
      var wi = GG.clamp(Math.floor((shot.tx - (wall.x - wall.w / 2)) / (wall.w / 3)), 0, 2); wall.pg[wi].hit(1);
    }
    else { msg = '射偏了！'; GG.sfx('lose'); }
    // 守門員：被射進就頭暈、撲到就抱球開心
    keeper.anim.set(kind === 'goal' ? 'dizzy' : kind === 'save' ? 'catch' : 'idle');
    GG.hud('進球 ' + goals + ' / ' + shots);
  }

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { shots = [0, 3, 6, 8][Math.min(n, 4) - 1]; history = new Array(shots).fill(true); goals = shots; resetKick(); };

  GG.define({
    assets: GG.extend(GG.rigAssets(['penguin', 'penguinS', 'octopus']), { ball: 'sport/soccer', hills: 'run/background_color_hills' }),
    start: function (d) {
      d0 = d; layout();
      shots = 0; goals = 0; history = []; t = 0; lvl = 1; bonus = 0;
      resetKick();
      GG.hud('進球 0 / 0');
    },
    resize: function () { layout(); if (keeper && phase !== 'fly') resetKick(); },
    update: function (dt) {
      t += dt;
      keeper.anim.update(dt);
      if (wall) wall.pg.forEach(function (a) { a.update(dt); });
      if (wall && wall.mv && phase === 'aim') wall.x = GG.clamp(wall.x0 + Math.sin(t * 1.5) * goal.w * 0.2, goal.x + wall.w / 2, goal.x + goal.w - wall.w / 2);
      if (phase === 'aim') { keeper.x = W / 2 + Math.sin(t * 2) * goal.w * 0.08; return; }
      if (phase === 'fly') {
        shot.t += dt / shot.dur;
        keeper.react -= dt;
        if (keeper.react > 0) keeper.anim.set('ready');
        if (keeper.react <= 0) {
          var dx = keeper.tx - keeper.x, step = keeper.speed * dt;
          keeper.x = Math.abs(dx) <= step ? keeper.tx : keeper.x + step * (dx > 0 ? 1 : -1);
          keeper.dive = Math.min(1, keeper.dive + dt * 4);
          keeper.dir = keeper.tx < W / 2 - 5 ? -1 : keeper.tx > W / 2 + 5 ? 1 : 0;
          keeper.anim.set(keeper.dir < 0 ? 'diveL' : keeper.dir > 0 ? 'diveR' : 'ready');
        }
        if (shot.t >= 1) {
          shot.t = 1;
          var inGoal = shot.tx > goal.x + ballR * 0.3 && shot.tx < goal.x + goal.w - ballR * 0.3 && shot.ty > goal.y + ballR * 0.3 && shot.ty < goal.y + goal.h;
          var kcy = GG.lerp(goal.y + goal.h * 0.62, keeper.ty, keeper.dive);
          var saved = Math.abs(shot.tx - keeper.x) < keeper.sizeW * (0.5 + keeper.dive * 0.4) && Math.abs(shot.ty - kcy) < goal.h * 0.45;
          var walled = wall && inGoal && Math.abs(shot.tx - wall.x) < wall.w / 2 && shot.ty > wallTop();
          result(!inGoal ? 'miss' : walled ? 'wall' : saved ? 'save' : 'goal');
        }
        return;
      }
      if (phase === 'result') {
        msgT += dt;
        if (msgT > 1.4) {
          if (shots >= TOTAL) GG.over({ score: goals * 10 + bonus, win: goals >= 5, stars: GG.starsFor(goals, 4, 6, 8), title: goals >= 7 ? '射門大師！' : goals >= 5 ? '表現不錯！' : '再接再厲！', scoreText: '10 球進了 ' + goals + ' 球' + (bonus ? '（金星 +' + bonus + '）' : ''), delay: 200 });
          else resetKick();
        }
      }
    },
    draw: function (ctx, w, h) {
      var gy0 = goal.y + goal.h, kw = keeper.sizeW * 1.6;
      if (star) GG.spr(ctx, '_star', star.x, star.y, star.r * 2 * (1 + Math.sin(t * 5) * 0.08), star.r * 2 * (1 + Math.sin(t * 5) * 0.08), { alpha: 0.9 });
      var ky = GG.lerp(goal.y + goal.h * 0.62, keeper.ty, keeper.dive);
      var ka = keeper.anim, kh = kw * 0.95, oct = ka.rig.name === 'octopus';
      if (oct) {
        // 章魚：頭是部件圖，觸手即時畫（會像波浪一樣擺）
        var os = kh * 0.85 / ka.rig.def.h, ox = keeper.x + ka.rig.root.x * os, oy = ky + kh * 0.05;
        // 觸手只畫在球門框裡面
        ctx.save(); ctx.beginPath(); ctx.rect(goal.x + 6, goal.y + 6, goal.w - 12, goal.h * 1.2); ctx.clip();
        GG.drawTentacles(ctx, ox, oy, os, t, ka.mode);
        ctx.restore();
        ka.draw(ctx, keeper.x, oy, os, false);
      } else {
        ka.draw(ctx, keeper.x, ky + kh * 0.5, kh / ka.rig.def.h, false, { spin: keeper.dir * keeper.dive * 1.3 });
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(goal.x, gy0); ctx.lineTo(goal.x, goal.y); ctx.lineTo(goal.x + goal.w, goal.y); ctx.lineTo(goal.x + goal.w, gy0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(goal.x, gy0); ctx.lineTo(goal.x, goal.y); ctx.lineTo(goal.x + goal.w, goal.y); ctx.lineTo(goal.x + goal.w, gy0); ctx.stroke();
      if (wall) {
        // 人牆：三隻小企鵝站在球門前，輪流晃動
        var wh = gy0 - wallTop(), bwid = wall.w / 3;
        for (var q = 0; q < 3; q++) wall.pg[q].draw(ctx, wall.x - wall.w / 2 + bwid * (q + 0.5), gy0 + wh * 0.04, wh * 1.08 / wall.pg[q].rig.def.h, false);
      }
      var bxp = spot.x, byp = spot.y, sc = 1;
      if (shot) {
        var k = GG.ease(Math.min(1, shot.t));
        bxp = GG.lerp(shot.sx, shot.tx, k); byp = GG.lerp(shot.sy, shot.ty, k) - Math.sin(k * Math.PI) * h * 0.06; sc = GG.lerp(1, 0.42, k);
      }
      GG.spr(ctx, 'ball', bxp, byp, ballR * 2 * sc, ballR * 2 * sc, { rot: shot ? shot.t * 12 : 0 });
      if (swipe && swipe.cur && phase === 'aim') {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6; ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(swipe.x, swipe.y); ctx.lineTo(swipe.cur.x, swipe.cur.y); ctx.stroke();
        ctx.setLineDash([]);
        // 準星：顯示球會飛到哪裡
        var ap = aimPoint(swipe.x, swipe.y, swipe.cur.x, swipe.cur.y);
        if (ap) {
          var ok = ap.x > goal.x && ap.x < goal.x + goal.w && ap.y > goal.y && ap.y < goal.y + goal.h;
          ctx.strokeStyle = ok ? '#ffe14d' : '#ff6b6b'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(ap.x, ap.y, ballR * 0.8, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ap.x - ballR * 1.1, ap.y); ctx.lineTo(ap.x + ballR * 1.1, ap.y); ctx.moveTo(ap.x, ap.y - ballR * 1.1); ctx.lineTo(ap.x, ap.y + ballR * 1.1); ctx.stroke();
        }
      }
      var dotR = Math.min(16, w / 40), sx = (w - TOTAL * dotR * 2.8) / 2 + dotR * 1.4;
      for (var n = 0; n < TOTAL; n++) {
        ctx.fillStyle = n < history.length ? (history[n] ? '#43d17a' : '#ff5252') : 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(sx + n * dotR * 2.8, h - dotR * 2, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; ctx.stroke();
      }
      if (phase === 'result') GG.text(ctx, msg, w / 2, h * 0.58, 54, msg === '進球！' ? '#ffe14d' : '#fff', 'center', true, 1 + Math.max(0, 0.3 - msgT));
    },
    hintAt: function () { return phase === 'aim' && shots === 0 ? { x: spot.x, y: spot.y, dx: 1, dy: -(spot.y - goal.y - goal.h * 0.3) / GG.clamp(Math.min(W, H) * 0.13, 64, 110), tip: '從球滑到球門角落，放開射門！', ty: goal.y + goal.h + 34 } : false; },
    down: function (p) { if (phase === 'aim') swipe = { x: p.x, y: p.y, cur: p }; },
    move: function (p) { if (swipe) swipe.cur = p; },
    up: function (p) {
      if (!swipe || phase !== 'aim') { swipe = null; return; }
      var a = aimPoint(swipe.x, swipe.y, p.x, p.y), tap = Math.abs(p.x - swipe.x) < 16 && Math.abs(p.y - swipe.y) < 16;
      swipe = null;
      if (a) kick(a.x, a.y);
      // 年紀小的直接點球門也可以射門
      else if (tap && p.x > goal.x && p.x < goal.x + goal.w && p.y > goal.y && p.y < goal.y + goal.h) kick(p.x, GG.clamp(p.y, goal.y + ballR * 0.6, goal.y + goal.h - ballR * 0.5));
    }
  });
})();
