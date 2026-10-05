/* 公路賽車：整條路做成一片重複圖，用 CSS 捲動 */
(function () {
  var W, H, lanes = 3, roadW, roadX, laneW, car, traffic, items, side, speed, speed0, accel, dist, coinN, spawnT, t, d0, lives, inv;
  var CARS = ['car1', 'car2', 'car3', 'car4', 'car5', 'car6'];
  var SIDE = ['tree_large', 'tree_small', 'tree_large', 'tires_red', 'rock1'];
  var P = 88; // 路面圖的重複高度（路肩紅白各 44）

  function layout() {
    W = GG.W; H = GG.H;
    roadW = Math.min(W * 0.72, lanes * 150);
    roadX = (W - roadW) / 2;
    laneW = roadW / lanes;
    var tile = GG.sprite(W, P, function (g) {
      for (var x = 0; x < W; x += P) g.drawImage(GG.img.grass, x, 0, P, P);
      g.fillStyle = '#5b6573'; g.fillRect(roadX, 0, roadW, P);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(roadX, 0, roadW, P / 2);
      var cw = Math.max(10, laneW * 0.12);
      [roadX - cw, roadX + roadW].forEach(function (x) {
        g.fillStyle = '#e8463c'; g.fillRect(x, 0, cw, P / 2);
        g.fillStyle = '#ffffff'; g.fillRect(x, P / 2, cw, P / 2);
      });
      g.fillStyle = GG.INK; g.fillRect(roadX - cw - 3, 0, 3, P); g.fillRect(roadX + roadW + cw, 0, 3, P);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (var l = 1; l < lanes; l++) { GG.rr(g, roadX + laneW * l - 3, 10, 6, 46, 3); g.fill(); }
    });
    GG.scrollLayer('road').set(tile, 0, 0, W, H, W, P, 'repeat-y');
  }
  function laneX(i) { return roadX + laneW * (i + 0.5); }
  function carW() { return laneW * 0.52; }
  function spawn() {
    var lane = GG.randInt(0, lanes - 1);
    var blocked = traffic.filter(function (o) { return o.y < H * 0.3; }).map(function (o) { return o.lane; });
    if (blocked.length >= lanes - 1 && blocked.indexOf(lane) < 0) return;
    if (Math.random() < 0.75) {
      var k = GG.pick(CARS), cw = carW();
      traffic.push({ img: k, lane: lane, x: laneX(lane), y: -cw * 2, w: cw, h: cw * GG.ratio(k), v: GG.rand(0.35, 0.6) });
    } else {
      var ob = GG.pick(['cone_down', 'barrel_blue', 'barrel_red']), ow = laneW * 0.32;
      traffic.push({ img: ob, lane: lane, x: laneX(lane), y: -ow, w: ow, h: ow * GG.ratio(ob), v: 0 });
    }
    if (Math.random() < 0.6) {
      var cl = GG.randInt(0, lanes - 1);
      if (cl !== lane) for (var i = 0; i < 3; i++) items.push({ x: laneX(cl), y: -laneW * (1 + i * 0.7), got: 0 });
    }
  }
  function addSide(y) {
    var left = Math.random() < 0.5, k = GG.pick(SIDE), s = Math.min(roadX * 0.8, laneW * (k.indexOf('tree') === 0 ? 1.1 : 0.6));
    if (s < 20) return;
    side.push({ k: k, x: left ? GG.rand(s / 2, roadX - s / 2 - 14) : GG.rand(roadX + roadW + 14 + s / 2, W - s / 2), y: y, s: s });
  }

  GG.define({
    countdown: true,
    assets: {
      player: 'race/player', car1: 'race/car1', car2: 'race/car2', car3: 'race/car3', car4: 'race/car4', car5: 'race/car5', car6: 'race/car6',
      cone_down: 'race/cone_down', barrel_blue: 'race/barrel_blue', barrel_red: 'race/barrel_red',
      tree_large: 'race/tree_large', tree_small: 'race/tree_small', tires_red: 'race/tires_red', rock1: 'race/rock1', grass: 'race/grass'
    },
    start: function (d) {
      d0 = d; lanes = d === 2 ? 4 : 3;
      layout();
      speed0 = H * [0.42, 0.55, 0.7][d];
      accel = H * [0.005, 0.008, 0.012][d];
      speed = speed0; dist = 0; coinN = 0; spawnT = 1; t = 0; lives = 3; inv = 0;
      var cw = carW();
      car = { x: W / 2, tx: W / 2, y: H - cw * 2.6, w: cw, h: cw * GG.ratio('player'), tilt: 0 };
      traffic = []; items = []; side = [];
      for (var y = 0; y < H; y += 120) addSide(y);
      GG.setScore(0);
    },
    resize: function () {
      if (!car) return;
      layout();
      var cw = carW();
      car.w = cw; car.h = cw * GG.ratio('player'); car.y = H - cw * 2.6; car.x = car.tx = W / 2;
      traffic = []; items = []; side = [];
    },
    update: function (dt) {
      t += dt;
      speed = Math.min(speed0 * 1.8, speed + accel * dt);
      var dy = speed * dt;
      dist += dy;
      if (inv > 0) inv -= dt;
      if (GG.keys.ArrowLeft) car.tx -= roadW * 1.4 * dt;
      if (GG.keys.ArrowRight) car.tx += roadW * 1.4 * dt;
      car.tx = GG.clamp(car.tx, roadX + car.w / 2 + 4, roadX + roadW - car.w / 2 - 4);
      var nx = GG.lerp(car.x, car.tx, Math.min(1, dt * 12));
      car.tilt = GG.clamp((nx - car.x) / (dt * W) * 0.6, -0.35, 0.35);
      car.x = nx;
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = GG.rand(0.55, 1.0) * (H * 0.7 / speed) * [1.5, 1.1, 0.85][d0]; }
      var hw = car.w * 0.36, hh = car.h * 0.4;
      for (var i = traffic.length - 1; i >= 0; i--) {
        var o = traffic[i];
        o.y += dy * (1 - o.v);
        if (o.y > H + o.h) { traffic.splice(i, 1); continue; }
        if (inv <= 0 && Math.abs(o.x - car.x) < hw + o.w * 0.36 && Math.abs(o.y - car.y) < hh + o.h * 0.38) {
          lives--; inv = 1.8; GG.sfx('hurt'); GG.shake(12, 0.35);
          GG.burst(o.x, o.y, { n: 14, colors: ['#ffb347', '#fff3a0', '#aaa'], size: 12, speed: 320 });
          traffic.splice(i, 1);
          speed = Math.max(speed0, speed * 0.8);
          if (lives <= 0) {
            var m = Math.floor(dist / 20), th = [[150, 400, 800], [250, 600, 1100], [300, 700, 1300]][d0];
            GG.over({ score: m + coinN * 10, stars: GG.starsFor(m, th[0], th[1], th[2]), text: '開了 ' + m + ' 公尺，吃到 ' + coinN + ' 枚金幣', delay: 900 });
            return;
          }
        }
      }
      for (i = items.length - 1; i >= 0; i--) {
        var c = items[i];
        c.y += dy;
        if (c.got) { c.got += dt; if (c.got > 0.35) items.splice(i, 1); continue; }
        if (c.y > H + 40) { items.splice(i, 1); continue; }
        if (Math.abs(c.x - car.x) < car.w * 0.75 && Math.abs(c.y - car.y) < car.h * 0.6) { c.got = 0.01; coinN++; GG.sfx('coin'); }
      }
      for (i = side.length - 1; i >= 0; i--) { side[i].y += dy; if (side[i].y > H + 120) side.splice(i, 1); }
      if (Math.random() < dy / 110) addSide(-100);
      GG.scrollLayer('road').scroll(0, -dist);
      GG.setScore(Math.floor(dist / 20) + coinN * 10);
    },
    draw: function (ctx, w) {
      side.forEach(function (s) { GG.spr(ctx, s.k, s.x, s.y, s.s, s.s * GG.ratio(s.k)); });
      items.forEach(function (c) { GG.spr(ctx, '_coin', c.x, c.y, laneW * 0.34, laneW * 0.34, c.got ? { alpha: 1 - c.got / 0.35 } : null); });
      traffic.forEach(function (o) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(o.x - o.w / 2 + 6, o.y - o.h / 2 + 10, o.w * 0.9, o.h * 0.92);
        GG.spr(ctx, o.img, o.x, o.y, o.w, o.h);
      });
      if (inv <= 0 || Math.floor(inv * 10) % 2 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(car.x - car.w / 2 + 7, car.y - car.h / 2 + 12, car.w * 0.9, car.h * 0.92);
        GG.spr(ctx, 'player', car.x, car.y, car.w, car.h, { rot: car.tilt });
      }
      GG.lives(ctx, lives, 3, 12, 30, 30);
      GG.text(ctx, Math.round(speed / H * 100) + ' km/h', w - 14, 30, 20, '#fff', 'right', true);
    },
    down: function (p) { this.d = { x: p.x, tx: car.tx }; },
    move: function (p) { if (this.d) car.tx = this.d.tx + (p.x - this.d.x) * 1.3; },
    up: function () { this.d = null; }
  });
})();
