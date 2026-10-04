/* 點球大戰：滑動射門，騙過守門員 */
(function () {
  var W, H, goal, spot, ballR, shots, goals, phase, shot, keeper, msg, msgT, swipe, d0, history, t;
  var TOTAL = 10;

  function layout() {
    W = GG.W; H = GG.H;
    var gw = Math.min(W * 0.84, H * 0.75);
    goal = { x: (W - gw) / 2, y: H * 0.14, w: gw, h: gw * 0.42 };
    spot = { x: W / 2, y: H * 0.8 };
    ballR = Math.min(W, H) * 0.06;
  }
  function resetKick() {
    phase = 'aim'; shot = null;
    keeper = { x: W / 2, tx: W / 2, y: goal.y + goal.h * 0.62, dive: 0, dir: 0, react: 0, sizeW: goal.w * 0.2 };
  }
  function kick(dx, dy) {
    // 往上滑的長度決定高度，左右位移決定方向
    var up = Math.max(0, -dy);
    var tx = spot.x + dx * 1.9;
    var ty = goal.y + goal.h - (up - 60) * 0.8;
    shot = { sx: spot.x, sy: spot.y, tx: tx, ty: ty, t: 0, dur: 0.55, done: false };
    phase = 'fly';
    GG.sfx('shoot');
    // 守門員判斷：難度越高越常猜對方向
    var guessRight = Math.random() < [0.4, 0.6, 0.78][d0];
    var inGoal = tx > goal.x && tx < goal.x + goal.w;
    var target = guessRight || !inGoal ? tx : (tx < W / 2 ? goal.x + goal.w * GG.rand(0.65, 0.9) : goal.x + goal.w * GG.rand(0.1, 0.35));
    keeper.tx = GG.clamp(target, goal.x + keeper.sizeW * 0.3, goal.x + goal.w - keeper.sizeW * 0.3);
    keeper.ty = GG.clamp(ty, goal.y + goal.h * 0.2, goal.y + goal.h * 0.62);
    keeper.react = [0.3, 0.2, 0.1][d0];
    keeper.speed = goal.w * [0.95, 1.25, 1.6][d0];
  }
  function result(kind) {
    phase = 'result'; msgT = 0;
    shots++;
    history.push(kind === 'goal');
    if (kind === 'goal') { goals++; msg = '進球！'; GG.sfx('goal'); }
    else if (kind === 'save') { msg = '被撲掉了！'; GG.sfx('hit'); }
    else { msg = '射偏了！'; GG.sfx('lose'); }
    GG.hud('進球 ' + goals + ' / ' + shots);
  }

  GG.define({
    assets: { ball: 'sport/soccer', k_front: 'chars/yellow_front', k_jump: 'chars/yellow_jump', k_hit: 'chars/yellow_hit', k_idle: 'chars/yellow_idle',
      bg: 'run/background_color_hills' },
    start: function (d) {
      d0 = d; layout();
      shots = 0; goals = 0; history = []; t = 0;
      resetKick();
      GG.hud('進球 0 / 0');
    },
    resize: function () { if (!keeper) return; layout(); if (phase !== 'fly') resetKick(); },
    update: function (dt) {
      t += dt;
      if (phase === 'aim') {
        keeper.x = W / 2 + Math.sin(t * 2) * goal.w * 0.08;
        return;
      }
      if (phase === 'fly') {
        shot.t += dt / shot.dur;
        keeper.react -= dt;
        if (keeper.react <= 0) {
          var dx = keeper.tx - keeper.x, step = keeper.speed * dt;
          if (Math.abs(dx) <= step) keeper.x = keeper.tx; else keeper.x += step * (dx > 0 ? 1 : -1);
          keeper.dive = Math.min(1, keeper.dive + dt * 4);
          keeper.dir = keeper.tx < W / 2 - 5 ? -1 : keeper.tx > W / 2 + 5 ? 1 : 0;
        }
        if (shot.t >= 1) {
          shot.t = 1;
          var inGoal = shot.tx > goal.x + ballR * 0.3 && shot.tx < goal.x + goal.w - ballR * 0.3 && shot.ty > goal.y + ballR * 0.3 && shot.ty < goal.y + goal.h;
          var reachX = keeper.sizeW * (0.55 + keeper.dive * 0.45), reachY = goal.h * 0.5;
          var kcy = GG.lerp(goal.y + goal.h * 0.62, keeper.ty, keeper.dive);
          var saved = Math.abs(shot.tx - keeper.x) < reachX && Math.abs(shot.ty - kcy) < reachY;
          result(!inGoal ? 'miss' : saved ? 'save' : 'goal');
        }
        return;
      }
      if (phase === 'result') {
        msgT += dt;
        if (msgT > 1.4) {
          if (shots >= TOTAL) GG.over({ score: goals, win: goals >= 5, title: goals >= 7 ? '射門大師！' : goals >= 5 ? '表現不錯！' : '再接再厲！', scoreText: '10 球進了 ' + goals + ' 球', delay: 200 });
          else resetKick();
        }
      }
    },
    draw: function (ctx, w, h) {
      // 天空與看台
      GG.tile(ctx, 'bg', 0, 0, w, goal.y + goal.h, goal.y + goal.h, 0, 0);
      // 草地條紋
      var gy0 = goal.y + goal.h;
      for (var i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? '#5cc85a' : '#6fd66a';
        var y0 = gy0 + (h - gy0) * Math.pow(i / 10, 1.3), y1 = gy0 + (h - gy0) * Math.pow((i + 1) / 10, 1.3);
        ctx.fillRect(0, y0, w, y1 - y0 + 1);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, gy0); ctx.lineTo(w, gy0); ctx.stroke();
      var bx = goal.w * 0.18;
      ctx.beginPath(); ctx.moveTo(goal.x - bx, gy0); ctx.lineTo(goal.x - bx * 1.6, gy0 + goal.h * 0.55); ctx.lineTo(goal.x + goal.w + bx * 1.6, gy0 + goal.h * 0.55); ctx.lineTo(goal.x + goal.w + bx, gy0); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(spot.x, spot.y + ballR * 0.9, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      // 球網
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var gx = goal.x; gx <= goal.x + goal.w; gx += 16) { ctx.moveTo(gx, goal.y); ctx.lineTo(gx, goal.y + goal.h); }
      for (var gyy = goal.y; gyy <= goal.y + goal.h; gyy += 16) { ctx.moveTo(goal.x, gyy); ctx.lineTo(goal.x + goal.w, gyy); }
      ctx.stroke();
      // 守門員
      var kw = keeper.sizeW * 1.35;
      var ky = GG.lerp(goal.y + goal.h * 0.62, keeper.ty || goal.y + goal.h * 0.62, keeper.dive);
      var key = phase === 'result' && msg === '進球！' ? 'k_hit' : keeper.dive > 0.2 ? 'k_jump' : 'k_front';
      GG.spr(ctx, key, keeper.x, ky, kw, kw, { rot: keeper.dir * keeper.dive * 1.1 });
      // 門柱（在守門員前面）
      ctx.lineCap = 'round';
      ctx.strokeStyle = GG.INK; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(goal.x, gy0); ctx.lineTo(goal.x, goal.y); ctx.lineTo(goal.x + goal.w, goal.y); ctx.lineTo(goal.x + goal.w, gy0); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(goal.x, gy0); ctx.lineTo(goal.x, goal.y); ctx.lineTo(goal.x + goal.w, goal.y); ctx.lineTo(goal.x + goal.w, gy0); ctx.stroke();
      // 球（飛行時依距離縮小，做出遠近感）
      var bxp = spot.x, byp = spot.y, sc = 1;
      if (shot) {
        var k = GG.ease(Math.min(1, shot.t));
        bxp = GG.lerp(shot.sx, shot.tx, k);
        byp = GG.lerp(shot.sy, shot.ty, k) - Math.sin(k * Math.PI) * h * 0.06;
        sc = GG.lerp(1, 0.42, k);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(bxp, (shot ? GG.lerp(spot.y, Math.min(shot.ty, gy0), GG.ease(Math.min(1, shot.t))) : spot.y) + ballR * sc, ballR * sc, ballR * sc * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      GG.spr(ctx, 'ball', bxp, byp, ballR * 2 * sc, ballR * 2 * sc, { rot: shot ? shot.t * 12 : 0 });
      // 瞄準線
      if (swipe && swipe.cur && phase === 'aim') {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(swipe.x, swipe.y); ctx.lineTo(swipe.cur.x, swipe.cur.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      // 射門紀錄
      var dotR = Math.min(16, w / 40), total = TOTAL * dotR * 2.8, sx = (w - total) / 2 + dotR * 1.4;
      for (var n = 0; n < TOTAL; n++) {
        ctx.fillStyle = n < history.length ? (history[n] ? '#43d17a' : '#ff5252') : 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(sx + n * dotR * 2.8, h - dotR * 2, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = GG.INK; ctx.stroke();
      }
      if (phase === 'result') GG.text(ctx, msg, w / 2, h * 0.58, 54 * (1 + Math.max(0, 0.3 - msgT)), msg === '進球！' ? '#ffe14d' : '#fff', 'center', true);
      if (phase === 'aim' && shots === 0 && !swipe) GG.text(ctx, '從球往球門滑動射門！', w / 2, h * 0.66, 26, '#fff', 'center', true);
    },
    down: function (p) { if (phase === 'aim') swipe = { x: p.x, y: p.y, cur: p, t: Date.now() }; },
    move: function (p) { if (swipe) swipe.cur = p; },
    up: function (p) {
      if (!swipe || phase !== 'aim') { swipe = null; return; }
      var dx = p.x - swipe.x, dy = p.y - swipe.y;
      swipe = null;
      if (dy > -50) return;
      kick(dx, dy);
    }
  });
})();
