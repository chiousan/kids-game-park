/* 桌上冰球：兩人面對面，或對電腦 */
(function () {
  var W, H, rk, R, pr, gw, puck, ms, score, mode, freezeT, msg, WIN = 7, aiSpeed;

  function layout() {
    W = GG.W; H = GG.H;
    var m = 14;
    rk = { x0: m, y0: m, x1: W - m, y1: H - m };
    rk.w = rk.x1 - rk.x0; rk.h = rk.y1 - rk.y0; rk.cx = (rk.x0 + rk.x1) / 2; rk.cy = (rk.y0 + rk.y1) / 2;
    R = Math.min(rk.w, rk.h) * 0.075;
    pr = R * 0.66;
    gw = Math.min(rk.w * 0.4, 300);
  }
  function resetPositions(serveTo) {
    puck = { x: rk.cx, y: rk.cy + (serveTo === 0 ? 1 : serveTo === 1 ? -1 : 0) * rk.h * 0.12, vx: 0, vy: 0 };
    ms = [
      { x: rk.cx, y: rk.y1 - rk.h * 0.12, vx: 0, vy: 0, tx: rk.cx, ty: rk.y1 - rk.h * 0.12, tid: null, img: 'blue' },
      { x: rk.cx, y: rk.y0 + rk.h * 0.12, vx: 0, vy: 0, tx: rk.cx, ty: rk.y0 + rk.h * 0.12, tid: null, img: 'red' }
    ];
  }
  function clampMallet(m, i) {
    var minY = i === 0 ? rk.cy + R : rk.y0 + R, maxY = i === 0 ? rk.y1 - R : rk.cy - R;
    m.tx = GG.clamp(m.tx, rk.x0 + R, rk.x1 - R);
    m.ty = GG.clamp(m.ty, minY, maxY);
  }
  function scoreGoal(who) {
    score[who]++;
    GG.sfx('goal');
    GG.hud('藍 ' + score[0] + ' : ' + score[1] + ' 紅');
    msg = who === 0 ? '藍方得分！' : (mode ? '電腦得分！' : '紅方得分！');
    freezeT = 1.3;
    if (score[who] >= WIN) {
      var title = mode ? (who === 0 ? '你贏了！' : '電腦贏了！') : (who === 0 ? '藍方獲勝！' : '紅方獲勝！');
      GG.over({ win: mode ? who === 0 : true, title: title, text: '比數 ' + score[0] + ' : ' + score[1], icon: who === 0 ? 'assets/icons/hockey.png' : undefined, delay: 900 });
    }
    resetPositions(who === 0 ? 1 : 0);
  }
  function ai(dt) {
    var m = ms[1], home = { x: rk.cx, y: rk.y0 + rk.h * 0.1 };
    if (puck.y < rk.cy - pr * 0.3) {
      // 先繞到冰球後方，再朝對方球門方向「穿過」冰球擊出
      var gx = rk.cx - puck.x, gy = rk.y1 - puck.y, gl = Math.sqrt(gx * gx + gy * gy) || 1;
      gx /= gl; gy /= gl;
      var close = GG.dist(m.x, m.y, puck.x, puck.y) < R + pr + R * 0.4;
      if (puck.y < m.y - R * 0.3) { m.tx = puck.x + (puck.x < m.x ? R * 2.2 : -R * 2.2); m.ty = puck.y - R * 2.2; }
      else if (close) { m.tx = puck.x + gx * R * 1.5; m.ty = puck.y + gy * R * 1.5; }
      else { m.tx = puck.x - gx * R * 1.1; m.ty = puck.y - gy * R * 1.1; }
    } else { m.tx = rk.cx + (puck.x - rk.cx) * 0.55; m.ty = home.y; }
    clampMallet(m, 1);
    var dx = m.tx - m.x, dy = m.ty - m.y, d = Math.sqrt(dx * dx + dy * dy), step = aiSpeed * dt;
    var nx = d <= step ? m.tx : m.x + dx / d * step, ny = d <= step ? m.ty : m.y + dy / d * step;
    m.vx = (nx - m.x) / dt; m.vy = (ny - m.y) / dt; m.x = nx; m.y = ny;
  }
  function collide(m) {
    var dx = puck.x - m.x, dy = puck.y - m.y, d = Math.sqrt(dx * dx + dy * dy), min = R + pr;
    if (d >= min || d === 0) return;
    var nx = dx / d, ny = dy / d;
    puck.x = m.x + nx * min; puck.y = m.y + ny * min;
    var rvx = puck.vx - m.vx, rvy = puck.vy - m.vy, dot = rvx * nx + rvy * ny;
    if (dot < 0) {
      puck.vx -= 1.9 * dot * nx; puck.vy -= 1.9 * dot * ny;
      GG.sfx('bounce');
    }
  }

  GG.define({
    modes: [
      { label: '雙人對戰', value: 0, cls: 'b-blue' },
      { label: '對電腦・簡單', value: 1, cls: 'b-easy' },
      { label: '對電腦・困難', value: 2, cls: 'b-hard' }
    ],
    assets: { blue: 'board/chipBlueWhite_border', red: 'board/chipRedWhite_border', puck: 'board/chipBlackWhite' },
    start: function (m) {
      mode = m; layout();
      aiSpeed = Math.min(W, H) * (m === 1 ? 0.55 : 1.25);
      score = [0, 0]; freezeT = 0.6; msg = '';
      resetPositions(0);
      GG.hud('藍 0 : 0 紅');
    },
    resize: function () { if (!puck) return; layout(); resetPositions(-1); },
    update: function (dt) {
      if (dt <= 0) return;
      // 玩家球拍：快速追手指，速度用來算擊球力道
      for (var i = 0; i < 2; i++) {
        if (i === 1 && mode) continue;
        var m = ms[i];
        clampMallet(m, i);
        var nx = GG.lerp(m.x, m.tx, Math.min(1, dt * 30)), ny = GG.lerp(m.y, m.ty, Math.min(1, dt * 30));
        m.vx = (nx - m.x) / dt; m.vy = (ny - m.y) / dt; m.x = nx; m.y = ny;
      }
      if (mode) ai(dt);
      if (freezeT > 0) { freezeT -= dt; if (freezeT <= 0) msg = ''; return; }
      var steps = 6, sdt = dt / steps, maxV = Math.min(W, H) * 3.2;
      for (var s = 0; s < steps; s++) {
        puck.x += puck.vx * sdt; puck.y += puck.vy * sdt;
        var inMouth = Math.abs(puck.x - rk.cx) < gw / 2 - pr * 0.2;
        if (puck.x - pr < rk.x0) { puck.x = rk.x0 + pr; puck.vx = Math.abs(puck.vx) * 0.9; GG.sfx('bounce'); }
        if (puck.x + pr > rk.x1) { puck.x = rk.x1 - pr; puck.vx = -Math.abs(puck.vx) * 0.9; GG.sfx('bounce'); }
        if (!inMouth) {
          if (puck.y - pr < rk.y0) { puck.y = rk.y0 + pr; puck.vy = Math.abs(puck.vy) * 0.9; GG.sfx('bounce'); }
          if (puck.y + pr > rk.y1) { puck.y = rk.y1 - pr; puck.vy = -Math.abs(puck.vy) * 0.9; GG.sfx('bounce'); }
        } else {
          if (puck.y < rk.y0 - pr) { scoreGoal(0); return; }
          if (puck.y > rk.y1 + pr) { scoreGoal(1); return; }
        }
        collide(ms[0]); collide(ms[1]);
        var v = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
        if (v > maxV) { puck.vx *= maxV / v; puck.vy *= maxV / v; }
      }
      var f = Math.pow(0.55, dt);
      puck.vx *= f; puck.vy *= f;
    },
    draw: function (ctx, w, h) {
      GG.bg(ctx, w, h, '#2a6fd6', '#174a9e');
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; GG.rr(ctx, rk.x0, rk.y0 + 6, rk.w, rk.h, 30); ctx.fill();
      ctx.fillStyle = '#eef8ff'; GG.rr(ctx, rk.x0, rk.y0, rk.w, rk.h, 30); ctx.fill();
      // 冰面線條
      ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(rk.x0, rk.cy); ctx.lineTo(rk.x1, rk.cy); ctx.stroke();
      ctx.strokeStyle = '#7cc4ff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(rk.cx, rk.cy, Math.min(rk.w, rk.h) * 0.16, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rk.cx, rk.y0, gw * 0.55, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(rk.cx, rk.y1, gw * 0.55, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = GG.INK; GG.rr(ctx, rk.x0, rk.y0, rk.w, rk.h, 30); ctx.stroke();
      // 球門
      ctx.fillStyle = '#ff6b6b'; GG.rr(ctx, rk.cx - gw / 2, rk.y0 - 8, gw, 14, 7); ctx.fill();
      ctx.fillStyle = '#4fa3ff'; GG.rr(ctx, rk.cx - gw / 2, rk.y1 - 6, gw, 14, 7); ctx.fill();
      // 比分（上方的字轉 180 度給對面的人看）
      GG.text(ctx, String(score[0]), rk.x0 + 40, rk.cy + 50, 56, 'rgba(79,163,255,0.55)');
      ctx.save(); ctx.translate(rk.x1 - 40, rk.cy - 50); ctx.rotate(Math.PI);
      GG.text(ctx, String(score[1]), 0, 0, 56, 'rgba(255,107,107,0.55)');
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(puck.x + 3, puck.y + 5, pr, pr, 0, 0, Math.PI * 2); ctx.fill();
      GG.spr(ctx, 'puck', puck.x, puck.y, pr * 2, pr * 2);
      for (var i = 0; i < 2; i++) {
        var m = ms[i];
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(m.x + 4, m.y + 7, R, R, 0, 0, Math.PI * 2); ctx.fill();
        GG.spr(ctx, m.img, m.x, m.y, R * 2.1, R * 2.1);
      }
      if (msg) {
        GG.text(ctx, msg, w / 2, rk.cy + 70, 40, '#ffe14d', 'center', true);
        if (!mode) { ctx.save(); ctx.translate(w / 2, rk.cy - 70); ctx.rotate(Math.PI); GG.text(ctx, msg, 0, 0, 40, '#ffe14d', 'center', true); ctx.restore(); }
      }
    },
    down: function (p) {
      var i = p.y > rk.cy ? 0 : 1;
      if (i === 1 && mode) return;
      ms[i].tid = p.id; ms[i].tx = p.x; ms[i].ty = p.y;
    },
    move: function (p) {
      for (var i = 0; i < 2; i++) if (ms[i].tid === p.id) { ms[i].tx = p.x; ms[i].ty = p.y; }
    },
    up: function (p) {
      for (var i = 0; i < 2; i++) if (ms[i].tid === p.id) ms[i].tid = null;
    }
  });
})();
