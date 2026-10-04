/* 公路賽車 */
(function () {
  var W, H, lanes, roadW, roadX, laneW, car, traffic, items, side, speed, speed0, accel, dist, coinN, spawnT, dead, t, crashT, d0;
  var CARS = ['car1', 'car2', 'car3', 'car4', 'car5', 'car6'];
  var SIDE = ['tree_large', 'tree_small', 'tree_large', 'tires_red', 'rock1'];

  function layout() {
    W = GG.W; H = GG.H;
    roadW = Math.min(W * 0.72, laneCount() * 150);
    roadX = (W - roadW) / 2;
    laneW = roadW / laneCount();
  }
  function laneCount() { return lanes || 3; }
  function laneX(i) { return roadX + laneW * (i + 0.5); }
  function carW() { return laneW * 0.52; }

  function spawn() {
    var lane = GG.randInt(0, lanes - 1);
    // 同一排不要把所有車道都擋住
    var blocked = traffic.filter(function (o) { return o.y < H * 0.25; }).map(function (o) { return o.lane; });
    if (blocked.length >= lanes - 1 && blocked.indexOf(lane) < 0) return;
    var r = Math.random();
    if (r < 0.75) {
      var k = GG.pick(CARS), cw = carW();
      traffic.push({ kind: 'car', img: k, lane: lane, x: laneX(lane), y: -cw * 2, w: cw, h: cw * GG.ratio(k), v: GG.rand(0.3, 0.6) });
    } else {
      var ob = GG.pick(['cone_down', 'barrel_blue', 'barrel_red']), ow = laneW * 0.32;
      traffic.push({ kind: 'obj', img: ob, lane: lane, x: laneX(lane) + GG.rand(-laneW * 0.15, laneW * 0.15), y: -ow, w: ow, h: ow * GG.ratio(ob), v: 0 });
    }
    if (Math.random() < 0.55) {
      var cl = GG.randInt(0, lanes - 1);
      if (cl !== lane) for (var i = 0; i < 3; i++) items.push({ x: laneX(cl), y: -laneW * (1 + i * 0.7), got: 0 });
    }
  }
  function addSide(y) {
    var left = Math.random() < 0.5;
    var k = GG.pick(SIDE), s = Math.min(roadX * 0.8, laneW * (k.indexOf('tree') === 0 ? 1.1 : 0.6));
    if (s < 20) return;
    var x = left ? GG.rand(s / 2, roadX - s / 2 - 10) : GG.rand(roadX + roadW + 10 + s / 2, W - s / 2);
    side.push({ k: k, x: x, y: y, s: s });
  }

  GG.define({
    assets: {
      player: 'race/player', car1: 'race/car1', car2: 'race/car2', car3: 'race/car3', car4: 'race/car4', car5: 'race/car5', car6: 'race/car6',
      cone_down: 'race/cone_down', barrel_blue: 'race/barrel_blue', barrel_red: 'race/barrel_red',
      tree_large: 'race/tree_large', tree_small: 'race/tree_small', tires_red: 'race/tires_red', rock1: 'race/rock1', grass: 'race/grass'
    },
    start: function (d) {
      d0 = d;
      lanes = d === 2 ? 4 : 3;
      layout();
      speed0 = H * [0.55, 0.7, 0.85][d];
      accel = H * [0.008, 0.012, 0.018][d];
      speed = speed0; dist = 0; coinN = 0; spawnT = 1; dead = false; t = 0; crashT = 0;
      var cw = carW();
      car = { x: W / 2, tx: W / 2, y: H - cw * 2.6, w: cw, h: cw * GG.ratio('player'), tilt: 0 };
      traffic = []; items = []; side = [];
      for (var y = 0; y < H; y += 120) addSide(y);
      GG.setScore(0);
    },
    resize: function () {
      if (!car) return;
      var oldX = roadX, oldW = roadW;
      layout();
      var map = function (x) { return roadX + (x - oldX) / oldW * roadW; };
      car.x = car.tx = map(car.x);
      var cw = carW();
      car.w = cw; car.h = cw * GG.ratio('player'); car.y = H - cw * 2.6;
      traffic.forEach(function (o) { o.x = map(o.x); });
      items.forEach(function (o) { o.x = map(o.x); });
    },
    update: function (dt) {
      t += dt;
      if (dead) { crashT += dt; return; }
      speed += accel * dt;
      var dy = speed * dt;
      dist += dy;
      if (GG.keys.ArrowLeft) car.tx -= roadW * 1.4 * dt;
      if (GG.keys.ArrowRight) car.tx += roadW * 1.4 * dt;
      car.tx = GG.clamp(car.tx, roadX + car.w / 2 + 4, roadX + roadW - car.w / 2 - 4);
      var nx = GG.lerp(car.x, car.tx, Math.min(1, dt * 12));
      car.tilt = GG.clamp((nx - car.x) / (dt * W) * 0.6, -0.35, 0.35);
      car.x = nx;
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = GG.rand(0.45, 0.9) * (H * 0.7 / speed) * [1.3, 1, 0.8][d0]; }
      var hw = car.w * 0.38, hh = car.h * 0.42;
      for (var i = traffic.length - 1; i >= 0; i--) {
        var o = traffic[i];
        o.y += dy * (1 - o.v);
        if (o.y > H + o.h) { traffic.splice(i, 1); continue; }
        if (Math.abs(o.x - car.x) < hw + o.w * 0.38 && Math.abs(o.y - car.y) < hh + o.h * 0.4) {
          dead = true; GG.sfx('boom');
          GG.over({ score: Math.floor(dist / 20) + coinN * 10, text: '開了 ' + Math.floor(dist / 20) + ' 公尺，吃到 ' + coinN + ' 枚金幣', delay: 1100 });
          return;
        }
      }
      for (i = items.length - 1; i >= 0; i--) {
        var c = items[i];
        c.y += dy;
        if (c.got) { c.got += dt; if (c.got > 0.35) items.splice(i, 1); continue; }
        if (c.y > H + 40) { items.splice(i, 1); continue; }
        if (Math.abs(c.x - car.x) < car.w * 0.7 && Math.abs(c.y - car.y) < car.h * 0.55) { c.got = 0.01; coinN++; GG.sfx('coin'); }
      }
      for (i = side.length - 1; i >= 0; i--) { side[i].y += dy; if (side[i].y > H + 120) side.splice(i, 1); }
      if (Math.random() < dy / 110) addSide(-100);
      GG.setScore(Math.floor(dist / 20) + coinN * 10);
    },
    draw: function (ctx, w, h) {
      GG.tile(ctx, 'grass', 0, 0, w, h, 96, 0, dist);
      // 路肩紅白條紋
      var curbW = Math.max(10, laneW * 0.12), seg = 44, off = dist % (seg * 2);
      ctx.fillStyle = '#5b6573'; ctx.fillRect(roadX, 0, roadW, h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (var y = -seg * 2 + off; y < h; y += seg * 2) ctx.fillRect(roadX, y, roadW, seg);
      [roadX - curbW, roadX + roadW].forEach(function (x) {
        for (var y2 = -seg * 2 + off; y2 < h; y2 += seg) {
          ctx.fillStyle = Math.round((y2 - off) / seg) % 2 ? '#ffffff' : '#e8463c';
          ctx.fillRect(x, y2, curbW, seg);
        }
      });
      ctx.fillStyle = GG.INK; ctx.fillRect(roadX - curbW - 3, 0, 3, h); ctx.fillRect(roadX + roadW + curbW, 0, 3, h);
      // 車道虛線
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var l = 1; l < lanes; l++) {
        var lx = roadX + laneW * l - 3;
        for (var y3 = -60 + (dist % 80); y3 < h; y3 += 80) GG.rr(ctx, lx, y3, 6, 44, 3), ctx.fill();
      }
      side.forEach(function (s) { GG.spr(ctx, s.k, s.x, s.y, s.s, s.s * GG.ratio(s.k)); });
      items.forEach(function (c) {
        var sq = Math.max(0.15, Math.abs(Math.cos(t * 5 + c.y * 0.02)));
        GG.spr(ctx, '_coin', c.x, c.y, laneW * 0.32 * sq, laneW * 0.32, c.got ? { alpha: 1 - c.got / 0.35 } : null);
      });
      traffic.forEach(function (o) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        GG.rr(ctx, o.x - o.w / 2 + 5, o.y - o.h / 2 + 8, o.w, o.h, o.w * 0.3); ctx.fill();
        GG.spr(ctx, o.img, o.x, o.y, o.w, o.h);
      });
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      GG.rr(ctx, car.x - car.w / 2 + 6, car.y - car.h / 2 + 10, car.w, car.h, car.w * 0.3); ctx.fill();
      GG.spr(ctx, 'player', car.x, car.y, car.w, car.h, { rot: dead ? crashT * 8 : car.tilt });
      if (dead) {
        var k = Math.min(1, crashT / 0.4);
        ctx.globalAlpha = 1 - k * 0.7;
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(car.x, car.y - car.h * 0.3, car.w * (0.5 + k), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      GG.text(ctx, Math.round(speed / H * 100) + ' km/h', w - 14, 26, 20, '#fff', 'right', true);
      if (t < 2.5 && !dead) GG.text(ctx, '手指左右拖曳開車', w / 2, h * 0.4, 26, '#fff', 'center', true);
    },
    down: function (p) { this.d = { x: p.x, tx: car.tx }; },
    move: function (p) { if (this.d) car.tx = this.d.tx + (p.x - this.d.x) * 1.3; },
    up: function () { this.d = null; }
  });
})();
