/* 太空射擊：6 種武器 × 5 級
 * 雷電式規則：撿到「同一種」武器寶石升 1 級（最高 5 級）、撿到「不同種」就換武器但保留等級；被打中降 1 級。
 * 星空背景用 CSS 捲動層。
 */
(function () {
  var W, H, S, ship, shots, ebullets, enemies, items, booms, zaps, drones, score, lives, maxLives, kills, dd, inv, shield, boss, bossN, bossNext, t;
  var wave, spawnT, wpn, lvl, fireT, subT, beamW, beamTop, bombs, flash, used, dropIn, hint;
  var WEAPONS = {
    laser: { name: '雷射連射', color: '#4fa3ff' },
    spread: { name: '散彈', color: '#43d17a' },
    homing: { name: '追蹤飛彈', color: '#ff7b6b' },
    beam: { name: '貫穿光束', color: '#ffd23f' },
    lightning: { name: '閃電鏈', color: '#b07cff' },
    drone: { name: '護衛僚機', color: '#ffa94d' }
  };
  var WLIST = Object.keys(WEAPONS);
  var DRONE_POS = [[-1.15, 0.35], [1.15, 0.35], [-2, 0.8], [2, 0.8]];

  /* 波次：每打倒 12 架升一波，出現新的敵人種類 */
  var WAVE_MSG = ['', '新敵人：隕石　新道具：炸彈', '新敵人：會開火的飛船　新道具：防護罩', '新敵人：俯衝機　新道具：愛心',
    '新敵人：重裝甲機（要打很多下）', '敵人變多、子彈變多了！', '敵人更快了！'];
  function spawnEnemy() {
    var pool = ['basic', 'basic', 'basic'];
    if (wave >= 2) pool.push('rock');
    if (wave >= 3) pool.push('shooter');
    if (wave >= 4) pool.push('diver');
    if (wave >= 5) pool.push('heavy');
    if (wave >= 6) pool.push('shooter', 'diver');
    var kind = GG.pick(pool);
    var x = GG.rand(S, W - S), mul = 1 + Math.min(2, t / 90);
    var hp = { basic: 1, rock: 3, shooter: 2, diver: 1, heavy: 7 }[kind] * mul;
    var img = { basic: GG.pick(['enemy1', 'enemy4']), rock: GG.pick(['meteor1', 'meteor2']), shooter: 'enemy3', diver: 'enemy2', heavy: 'enemy1' }[kind];
    enemies.push({
      kind: kind, img: img, spin: GG.rand(-2, 2), rot: 0, hitT: 0,
      x: x, x0: x, y: -S, hp: hp, r: S * ({ rock: 0.5, heavy: 0.62 }[kind] || 0.42),
      vy: H * GG.rand(0.08, 0.12) * (1 + dd * 0.2) * (kind === 'diver' ? 1.9 : kind === 'heavy' ? 0.6 : 1) * (1 + Math.max(0, wave - 6) * 0.1),
      amp: kind === 'diver' ? 0 : GG.rand(0, W * 0.1), ph: Math.random() * 6, fire: GG.rand(1.5, 3)
    });
  }
  function boom(x, y, big) {
    booms.push({ x: x, y: y, t: 0, big: big });
    GG.burst(x, y, { n: big ? 18 : 7, colors: ['#ffb347', '#fff3a0', '#ff6b6b'], size: big ? 14 : 9, speed: big ? 380 : 220, gravity: 0 });
    GG.sfx(big ? 'boom' : 'pop');
  }
  function hurt() {
    if (inv > 0) return;
    if (shield) { shield = false; inv = 1; GG.sfx('hit'); GG.floatText(ship.x, ship.y - S, '防護罩擋住了！', '#9fe3ff', 24); return; }
    lives--; inv = 2.2; GG.sfx('hurt'); GG.shake(10, 0.3);
    boom(ship.x, ship.y, false);
    if (lvl > 1) { lvl--; setupDrones(); GG.floatText(ship.x, ship.y - S * 1.2, '武器降到 Lv' + lvl, '#ff8a8a', 26); }
    if (lives <= 0) {
      boom(ship.x, ship.y, true);
      GG.over({ score: score, stars: GG.starsFor(kills, 15, 35, 60), text: '打到第 ' + wave + ' 波，打倒 ' + kills + ' 架敵機', delay: 900 });
    }
  }

  /* ---------- 道具 ---------- */
  function dropItem(x, y, kind) {
    items.push({ x: x, y: y, kind: kind, ph: Math.random() * 6 });
  }
  function randomDrop() {
    var r = Math.random();
    if (r < 0.65) return Math.random() < 0.4 ? wpn : GG.pick(WLIST); // 常常掉目前的武器，方便升級
    // 炸彈、防護罩、愛心依波次陸續解鎖
    if (r < 0.8) return wave >= 2 ? 'bomb' : wpn;
    if (r < 0.92) return wave >= 3 ? 'shield' : wpn;
    return wave >= 4 ? 'life' : wpn;
  }
  function maybeDrop(x, y) {
    dropIn--;
    if (dropIn <= 0 || Math.random() < [0.15, 0.12, 0.1][dd]) { dropItem(x, y, randomDrop()); dropIn = [8, 10, 12][dd]; }
  }
  function pickUp(it) {
    var k = it.kind, msg, col = '#fff';
    if (WEAPONS[k]) {
      col = WEAPONS[k].color;
      if (k === wpn) {
        if (lvl < 5) { lvl++; msg = WEAPONS[k].name + ' 升到 Lv' + lvl + '！'; }
        else { score += 500; GG.setScore(score); msg = '滿級！+500'; }
      } else { wpn = k; msg = '換成' + WEAPONS[k].name + ' Lv' + lvl; }
      setupDrones();
    } else if (k === 'shield') { shield = true; msg = '防護罩！'; }
    else if (k === 'life') { lives = Math.min(maxLives + 1, lives + 1); msg = '+1 命'; }
    else if (k === 'bomb') { bombs = Math.min(3, bombs + 1); msg = '炸彈 +1'; updatePad(); }
    GG.sfx('power');
    GG.floatText(GG.clamp(it.x, 140, W - 140), it.y - 40, msg, col, 30);
    GG.burst(it.x, it.y, { n: 8, colors: [col, '#ffffff'], size: 10, speed: 200, gravity: 0 });
  }

  /* ---------- 武器 ---------- */
  function setupDrones() {
    var n = wpn === 'drone' ? [1, 2, 3, 4, 4][lvl - 1] : 0;
    while (drones.length < n) drones.push({ x: ship.x, y: ship.y + S, cool: Math.random() * 0.3 });
    drones.length = n;
  }
  function shot(x, y, ang, sp, img, w, h, dmg, extra) {
    var s = { x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, img: img, w: w, h: h, dmg: dmg, rot: ang + Math.PI / 2, life: 3 };
    if (extra) for (var k in extra) s[k] = extra[k];
    shots.push(s);
    return s;
  }
  var UP = -Math.PI / 2;
  function mainLaser(n, img) {
    for (var k = 0; k < n; k++) shot(ship.x + (k - (n - 1) / 2) * S * 0.2, ship.y - S * 0.5, UP, H * 1.4, img || 'lz_blue', S * 0.13, S * 0.42, 1);
  }
  function nearest(x, y, maxD, skip) {
    var best = null, bd = maxD;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.hp <= 0 || e.y < -S * 0.5 || (skip && skip.indexOf(e) >= 0)) continue;
      var d = GG.dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (boss && !boss.enter && (!skip || skip.indexOf(boss) < 0)) {
      var db = GG.dist(x, y, boss.x, boss.y) - boss.r * 0.5;
      if (db < bd) best = boss;
    }
    return best;
  }
  function zap(pts) {
    // 閃電：每一段切成幾個折點，隨機抖動
    var path = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], n = 5;
      for (var k = 1; k < n; k++) {
        var f = k / n, j = S * 0.25;
        path.push([GG.lerp(a[0], b[0], f) + GG.rand(-j, j), GG.lerp(a[1], b[1], f) + GG.rand(-j, j)]);
      }
      path.push(b);
    }
    zaps.push({ path: path, t: 0 });
  }
  function fire() {
    var L = lvl - 1;
    if (wpn === 'laser') {
      mainLaser(lvl);
      fireT = [0.17, 0.16, 0.15, 0.13, 0.11][L];
    } else if (wpn === 'spread') {
      var n = [3, 5, 6, 7, 9][L], arc = [0.3, 0.45, 0.55, 0.7, 0.85][L];
      for (var k = 0; k < n; k++) {
        var a = UP + (n > 1 ? (k / (n - 1) - 0.5) * 2 * arc : 0);
        shot(ship.x, ship.y - S * 0.45, a, H * 1.2, 'lz_green', S * 0.12, S * 0.4, 1);
      }
      fireT = [0.26, 0.24, 0.22, 0.2, 0.18][L];
    } else if (wpn === 'homing') {
      mainLaser(1);
      fireT = 0.2;
      subT -= 0.2;
      if (subT <= 0) {
        subT = [0.75, 0.65, 0.6, 0.55, 0.5][L];
        for (k = 0; k < lvl; k++) {
          var a2 = UP + (lvl > 1 ? (k / (lvl - 1) - 0.5) * 2.2 : 0);
          shot(ship.x, ship.y - S * 0.2, a2, H * 0.7, 'missile', S * 0.2, S * 0.53, 2, { homing: true, life: 3.2, tT: 0 });
        }
      }
    } else if (wpn === 'lightning') {
      fireT = [0.5, 0.45, 0.4, 0.36, 0.32][L];
      var first = nearest(ship.x, ship.y, H * 0.95);
      if (!first) { mainLaser(1, 'lz_blue'); return; }
      var hit = [first], pts = [[ship.x, ship.y - S * 0.4], [first.x, first.y]];
      for (k = 0; k < lvl; k++) {
        var cur = hit[hit.length - 1], nx = nearest(cur.x, cur.y, S * 4.5, hit);
        if (!nx) break;
        hit.push(nx); pts.push([nx.x, nx.y]);
      }
      hit.forEach(function (e) { damage(e, 2); });
      zap(pts);
      GG.sfx('hit');
      return;
    } else if (wpn === 'drone') {
      mainLaser(1);
      fireT = 0.18;
    } else if (wpn === 'beam') {
      return;
    }
    GG.sfx('shoot');
  }
  function damage(e, n) {
    e.hp -= n; e.hitT = 0.08;
  }

  /* ---------- 炸彈 ---------- */
  function bomb() {
    if (bombs <= 0 || lives <= 0) return;
    bombs--; updatePad();
    flash = 0.6; GG.sfx('boom'); GG.shake(16, 0.5);
    enemies.forEach(function (e) { if (e.y > -S) damage(e, 99); });
    ebullets.length = 0;
    if (boss && !boss.enter) damage(boss, boss.max * 0.2);
    used = true;
  }
  function updatePad() {
    var r = Math.round(GG.clamp(Math.min(W, H) * 0.075, 40, 58));
    GG.setPad([{ id: 'bomb', round: true, img: 'w_bomb', label: '×' + bombs, color: '#ff7b3d', colorDown: '#ffe14d', hidden: bombs <= 0,
      x: W - r * 2 - 18, y: H - r * 2 - 18, w: r * 2, h: r * 2, hit: 14, onDown: bomb }]);
  }

  // 測試用：直接切換武器與等級
  GG.testWeapon = function (k, l) { wpn = k; lvl = l; setupDrones(); used = true; };

  // 測試用：直接跳到第 n 關（截圖檢查用）
  GG.testLevel = function (n) { kills = (n - 1) * 12; wave = n; bossNext = kills + 30; };

  GG.define({
    noHint: true,
    countdown: true,
    assets: { ship: 'space/ship', enemy1: 'space/enemy1', enemy2: 'space/enemy2', enemy3: 'space/enemy3', enemy4: 'space/enemy4',
      boss: 'space/boss', elaser: 'space/elaser', pw_shield: 'space/pw_shield',
      pw_life: 'space/pw_life', shieldFx: 'space/shield', fire: 'space/fire', meteor1: 'space/meteor1', meteor2: 'space/meteor2',
      lz_blue: 'space/lz_blue', lz_green: 'space/lz_green', lz_red: 'space/lz_red', missile: 'space/missile', drone: 'space/drone',
      hit_blue: 'space/hit_blue', w_laser: 'space/w_laser', w_spread: 'space/w_spread', w_homing: 'space/w_homing', w_beam: 'space/w_beam',
      w_lightning: 'space/w_lightning', w_drone: 'space/w_drone', w_bomb: 'space/w_bomb' },
    start: function (d) {
      dd = d; W = GG.W; H = GG.H; S = Math.max(44, Math.min(W, H) * 0.08);
      ship = { x: W / 2, y: H - S * 2 };
      shots = []; ebullets = []; enemies = []; items = []; booms = []; zaps = []; drones = [];
      maxLives = [5, 4, 3][d];
      score = 0; lives = maxLives; kills = 0; fireT = 0; subT = 0; spawnT = 1.5; wave = 1; inv = 0; shield = false; boss = null; bossN = 0; bossNext = 30; t = 0;
      wpn = 'laser'; lvl = 1; bombs = [2, 1, 1][d]; flash = 0; used = false; dropIn = 5; hint = 0; beamW = 0; beamTop = 0;
      this.resize(W, H);
      // 開場先送一顆武器寶石，讓小朋友馬上看到升級
      dropItem(W * 0.5, H * 0.35, 'laser');
      GG.setScore(0);
    },
    resize: function (w, h) {
      GG.scrollLayer('stars').set('space/bg', 0, 0, w, h, 256, 256);
      if (!ship) return;
      W = w; H = h; ship.x = GG.clamp(ship.x, S / 2, W - S / 2); ship.y = GG.clamp(ship.y, S, H - S);
      updatePad();
    },
    update: function (dt) {
      t += dt; hint += dt;
      if (lives <= 0) return;
      GG.scrollLayer('stars').scroll(0, -t * 50);
      var kx = (GG.keys.ArrowRight ? 1 : 0) - (GG.keys.ArrowLeft ? 1 : 0), ky = (GG.keys.ArrowDown ? 1 : 0) - (GG.keys.ArrowUp ? 1 : 0);
      if (kx || ky) used = true;
      ship.x = GG.clamp(ship.x + kx * W * dt, S / 2, W - S / 2);
      ship.y = GG.clamp(ship.y + ky * W * dt, S, H - S * 0.6);
      if (inv > 0) inv -= dt;
      if (flash > 0) flash -= dt;
      var i, j, b, e;

      // 開火
      fireT -= dt;
      if (fireT <= 0) fire();
      // 僚機跟著主機飛、自己開火
      for (i = 0; i < drones.length; i++) {
        var dr = drones[i], p = DRONE_POS[i];
        dr.x = GG.lerp(dr.x, ship.x + p[0] * S, Math.min(1, dt * 10));
        dr.y = GG.lerp(dr.y, ship.y + p[1] * S, Math.min(1, dt * 10));
        dr.cool -= dt;
        if (dr.cool <= 0) {
          dr.cool = [0.42, 0.4, 0.36, 0.32, 0.24][lvl - 1];
          shot(dr.x, dr.y - S * 0.3, UP, H * 1.3, 'lz_red', S * 0.11, S * 0.34, 1);
          if (lvl === 5) { shot(dr.x - S * 0.15, dr.y - S * 0.3, UP - 0.12, H * 1.3, 'lz_red', S * 0.11, S * 0.34, 1); shot(dr.x + S * 0.15, dr.y - S * 0.3, UP + 0.12, H * 1.3, 'lz_red', S * 0.11, S * 0.34, 1); }
        }
      }
      // 貫穿光束：持續傷害一整條直線上的敵人
      if (wpn === 'beam') {
        beamW = S * [0.24, 0.32, 0.42, 0.52, 0.64][lvl - 1];
        var dps = [5, 7, 9, 12, 15][lvl - 1] * dt;
        beamTop = 0;
        for (i = 0; i < enemies.length; i++) {
          e = enemies[i];
          if (e.y < ship.y && e.y > -e.r && Math.abs(e.x - ship.x) < e.r * 0.8 + beamW / 2) damage(e, dps);
        }
        if (boss && !boss.enter && Math.abs(boss.x - ship.x) < boss.r * 0.8 + beamW / 2) { damage(boss, dps); beamTop = boss.y + boss.r * 0.4; }
      }

      // 子彈移動（追蹤飛彈會轉向最近的敵人）
      for (i = shots.length - 1; i >= 0; i--) {
        b = shots[i];
        b.life -= dt;
        if (b.homing) {
          b.tT -= dt;
          if (b.tT <= 0) { b.tgt = nearest(b.x, b.y, H); b.tT = 0.2; }
          var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy), ang = Math.atan2(b.vy, b.vx);
          if (b.tgt && b.tgt.hp > 0) {
            var want = Math.atan2(b.tgt.y - b.y, b.tgt.x - b.x), df = want - ang;
            while (df > Math.PI) df -= Math.PI * 2;
            while (df < -Math.PI) df += Math.PI * 2;
            ang += GG.clamp(df, -7 * dt, 7 * dt);
          }
          sp = Math.min(H * 1.3, sp + H * 1.2 * dt);
          b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.rot = ang + Math.PI / 2;
          if (Math.random() < 0.5) GG.burst(b.x - Math.cos(ang) * S * 0.25, b.y - Math.sin(ang) * S * 0.25, { n: 1, colors: ['#ffb347', '#fff3a0'], size: 7, speed: 30, gravity: 0, life: 0.25 });
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.life <= 0 || b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) { shots.splice(i, 1); continue; }
        var gone = false;
        for (j = 0; j < enemies.length; j++) {
          e = enemies[j];
          if (e.hp > 0 && Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) { damage(e, b.dmg); gone = true; break; }
        }
        if (!gone && boss && !boss.enter && GG.dist(b.x, b.y, boss.x, boss.y) < boss.r) { damage(boss, b.dmg); gone = true; }
        if (gone) {
          if (b.homing) boom(b.x, b.y, false);
          else GG.burst(b.x, b.y, { n: 2, colors: ['#ffffff', '#9fe3ff'], size: 6, speed: 120, gravity: 0, life: 0.2 });
          shots.splice(i, 1);
        }
      }

      // 敵人
      if (!boss) {
        spawnT -= dt;
        if (spawnT <= 0) { spawnEnemy(); spawnT = GG.rand(0.8, 1.5) / (1 + dd * 0.3 + (wave - 1) * 0.12); }
        if (kills >= bossNext) {
          bossN++;
          var hp = 40 + dd * 20 + (bossN - 1) * 25;
          boss = { x: W / 2, y: -S * 2, r: S * 1.1, hp: hp, max: hp, dir: 1, fire: 2, enter: true, hitT: 0 };
          bossNext += 35; GG.sfx('power'); GG.floatText(W / 2, H * 0.4, '魔王出現了！', '#ff6b6b', 44);
        }
      }
      for (i = enemies.length - 1; i >= 0; i--) {
        e = enemies[i];
        if (e.hp <= 0) {
          boom(e.x, e.y, false); maybeDrop(e.x, e.y);
          var pts = { basic: 10, diver: 15, rock: 20, shooter: 20, heavy: 50 }[e.kind];
          score += pts; kills++; GG.setScore(score);
          var nw = Math.min(7, 1 + Math.floor(kills / 12));
          if (nw > wave) { wave = nw; GG.banner('第 ' + wave + ' 波', WAVE_MSG[wave - 1]); }
          enemies.splice(i, 1);
          continue;
        }
        e.y += e.vy * dt; e.ph += dt * 1.6; e.rot += e.spin * dt;
        if (e.hitT > 0) e.hitT -= dt;
        if (e.kind === 'diver') { if (e.y < ship.y) e.x += GG.clamp(ship.x - e.x, -1, 1) * W * 0.18 * dt; e.rot = 0; }
        else if (e.kind !== 'rock') e.x = GG.clamp(e.x0 + Math.sin(e.ph) * e.amp, e.r, W - e.r);
        if (e.kind === 'shooter') {
          e.fire -= dt;
          if (e.fire <= 0 && e.y > 0 && e.y < H * 0.6) {
            e.fire = GG.rand(2, 3.5) / (1 + dd * 0.25);
            var a = Math.atan2(ship.y - e.y, ship.x - e.x), esp = H * (0.25 + dd * 0.06);
            for (var sk = wave >= 6 ? -1 : 0; sk <= (wave >= 6 ? 1 : 0); sk++) ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a + sk * 0.3) * esp, vy: Math.sin(a + sk * 0.3) * esp });
          }
        }
        if (e.y > H + S) { enemies.splice(i, 1); continue; }
        if (GG.dist(e.x, e.y, ship.x, ship.y) < e.r + S * 0.28) { boom(e.x, e.y, false); enemies.splice(i, 1); hurt(); }
      }
      if (boss) {
        if (boss.hitT > 0) boss.hitT -= dt;
        if (boss.enter) { boss.y += H * 0.15 * dt; if (boss.y >= H * 0.18) boss.enter = false; }
        else {
          boss.x += boss.dir * W * 0.15 * (1 + dd * 0.2) * dt;
          if (boss.x < boss.r || boss.x > W - boss.r) boss.dir *= -1;
          boss.fire -= dt;
          if (boss.fire <= 0) {
            boss.fire = 2.2 - dd * 0.4;
            var n = 3 + dd * 2;
            for (var k = 0; k < n; k++) {
              var ba = Math.PI / 2 + (k - (n - 1) / 2) * 0.28, bsp = H * 0.25;
              ebullets.push({ x: boss.x, y: boss.y + boss.r * 0.5, vx: Math.cos(ba) * bsp, vy: Math.sin(ba) * bsp });
            }
          }
        }
        if (boss.hp <= 0) {
          boom(boss.x, boss.y, true); boom(boss.x - boss.r * 0.5, boss.y, true); boom(boss.x + boss.r * 0.5, boss.y + 10, true);
          GG.shake(14, 0.5);
          score += 300; GG.setScore(score); GG.floatText(boss.x, boss.y, '+300', '#ffe14d', 40);
          dropItem(boss.x - 50, boss.y, wpn); dropItem(boss.x + 50, boss.y, GG.pick(WLIST)); dropItem(boss.x, boss.y + 40, 'life');
          boss = null; GG.sfx('win');
        } else if (GG.dist(boss.x, boss.y, ship.x, ship.y) < boss.r + S * 0.28) hurt();
      }
      for (i = ebullets.length - 1; i >= 0; i--) {
        b = ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) { ebullets.splice(i, 1); continue; }
        if (GG.dist(b.x, b.y, ship.x, ship.y) < S * 0.28) { ebullets.splice(i, 1); hurt(); }
      }
      // 道具：慢慢往下飄，靠近時被吸過來
      for (i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.ph += dt * 3;
        var dI = GG.dist(it.x, it.y, ship.x, ship.y);
        if (dI < S * 2.6) { it.x = GG.lerp(it.x, ship.x, Math.min(1, dt * 6)); it.y = GG.lerp(it.y, ship.y, Math.min(1, dt * 6)); }
        else { it.y += H * 0.12 * dt; it.x += Math.sin(it.ph) * S * 0.6 * dt; }
        if (it.y > H + 40) { items.splice(i, 1); continue; }
        if (dI < S * 0.8) { pickUp(it); items.splice(i, 1); }
      }
      for (i = booms.length - 1; i >= 0; i--) { booms[i].t += dt; if (booms[i].t > 0.4) booms.splice(i, 1); }
      for (i = zaps.length - 1; i >= 0; i--) { zaps[i].t += dt; if (zaps[i].t > 0.16) zaps.splice(i, 1); }
    },
    draw: function (ctx, w, h) {
      var i;
      // 光束
      if (wpn === 'beam' && lives > 0) {
        var fl = 1 + Math.sin(t * 40) * 0.08, bw = beamW * fl, top = beamTop, bot = ship.y - S * 0.45;
        ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffd23f';
        GG.rr(ctx, ship.x - bw * 0.75, top, bw * 1.5, bot - top, bw * 0.6); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff3a0';
        GG.rr(ctx, ship.x - bw / 2, top, bw, bot - top, bw / 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
        GG.rr(ctx, ship.x - bw * 0.2, top, bw * 0.4, bot - top, bw * 0.2); ctx.fill();
      }
      for (i = 0; i < shots.length; i++) {
        var b = shots[i];
        if (b.vx === 0 && b.img !== 'missile') GG.spr(ctx, b.img, b.x, b.y, b.w, b.h);
        else GG.spr(ctx, b.img, b.x, b.y, b.w, b.h, { rot: b.rot });
      }
      enemies.forEach(function (e) { GG.spr(ctx, e.img, e.x, e.y, e.r * 2.2, null, (e.kind === 'rock' || e.hitT > 0) ? { rot: e.rot, alpha: e.hitT > 0 ? 0.5 : 1 } : null); });
      if (boss) {
        GG.spr(ctx, 'boss', boss.x, boss.y, boss.r * 2.1, boss.r * 2.1, { rot: t * 1.5, alpha: boss.hitT > 0 ? 0.6 : 1 });
        var hb = Math.min(300, w * 0.6);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; GG.rr(ctx, (w - hb) / 2, 14, hb, 18, 9); ctx.fill();
        ctx.fillStyle = '#ff5252'; GG.rr(ctx, (w - hb) / 2, 14, Math.max(18, hb * Math.max(0, boss.hp) / boss.max), 18, 9); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; GG.rr(ctx, (w - hb) / 2, 14, hb, 18, 9); ctx.stroke();
      }
      // 閃電
      if (zaps.length) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        zaps.forEach(function (z) {
          var a = 1 - z.t / 0.16;
          [[S * 0.22, 'rgba(176,124,255,' + (0.6 * a) + ')'], [S * 0.07, 'rgba(255,255,255,' + a + ')']].forEach(function (st) {
            ctx.lineWidth = st[0]; ctx.strokeStyle = st[1];
            ctx.beginPath(); ctx.moveTo(z.path[0][0], z.path[0][1]);
            for (var k = 1; k < z.path.length; k++) ctx.lineTo(z.path[k][0], z.path[k][1]);
            ctx.stroke();
          });
        });
      }
      for (i = 0; i < ebullets.length; i++) GG.spr(ctx, 'elaser', ebullets[i].x, ebullets[i].y, 24, 24);
      items.forEach(function (it) {
        var img = WEAPONS[it.kind] || it.kind === 'bomb' ? 'w_' + it.kind : 'pw_' + it.kind, pulse = 1 + Math.sin(it.ph * 2) * 0.08;
        if (WEAPONS[it.kind]) {
          ctx.globalAlpha = 0.35; ctx.fillStyle = WEAPONS[it.kind].color;
          ctx.beginPath(); ctx.arc(it.x, it.y, S * 0.62 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        }
        GG.spr(ctx, img, it.x, it.y, S * 0.85 * pulse, null);
      });
      booms.forEach(function (bm) {
        var k = bm.t / 0.4, r = (bm.big ? S * 1.6 : S * 0.8) * GG.ease(k);
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff3a0';
        ctx.beginPath(); ctx.arc(bm.x, bm.y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      var blink = GG.state() === 'play' && inv > 0 && Math.floor(inv * 10) % 2; // 倒數時不閃，主角一直看得到
      if (lives > 0 && !blink) {
        drones.forEach(function (dr) { GG.spr(ctx, 'drone', dr.x, dr.y, S * 0.6, null); });
        GG.spr(ctx, 'fire', ship.x, ship.y + S * 0.62, S * 0.22, S * (0.45 + Math.sin(t * 40) * 0.08));
        GG.spr(ctx, 'ship', ship.x, ship.y, S * 1.25, null);
        if (shield) GG.spr(ctx, 'shieldFx', ship.x, ship.y, S * 1.7, S * 1.7, { alpha: 0.85 });
      }
      if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, flash * 1.6) + ')'; ctx.fillRect(0, 0, w, h); }
      // 左上：目前武器與等級
      var bs = Math.min(64, S * 1.05), hx = 12 + bs / 2, hy = (boss ? 46 : 14) + bs / 2;
      GG.pill(ctx, 6, hy - bs * 0.5 - 4, bs + 5 * 22 + 62, bs + 8);
      GG.spr(ctx, 'w_' + wpn, hx, hy, bs, bs);
      GG.text(ctx, WEAPONS[wpn].name, hx + bs * 0.62, hy - bs * 0.2, 20, '#fff', 'left', true);
      for (i = 0; i < 5; i++) {
        ctx.fillStyle = i < lvl ? WEAPONS[wpn].color : 'rgba(255,255,255,0.25)';
        GG.rr(ctx, hx + bs * 0.62 + i * 22, hy + bs * 0.12, 18, 14, 5); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
      }
      GG.text(ctx, 'Lv' + lvl, hx + bs * 0.62 + 5 * 22 + 8, hy + bs * 0.19, 18, lvl === 5 ? '#ffe14d' : '#fff', 'left', true);
      GG.lives(ctx, lives, Math.max(maxLives, lives), 12, h - 30, 30);
      GG.hudText(ctx, '第 ' + wave + ' 波', w - 18, boss ? 52 : 26, 20, '#fff', 'right');
      // 教學：手指拖曳太空船
      if (!used && hint < 5) {
        var k2 = Math.sin(hint * 2.4);
        GG.hand(ctx, ship.x + k2 * S * 1.6, Math.min(ship.y + S * 0.2, h - S * 1.4), S * 1.2, true);
        GG.text(ctx, '手指按住拖曳，移動太空船', w / 2, h * 0.62, 24, '#fff', 'center', true);
      }
    },
    down: function (p) { this.d = { x: p.x, y: p.y, sx: ship.x, sy: ship.y }; used = true; },
    move: function (p) {
      if (!this.d) return;
      ship.x = GG.clamp(this.d.sx + (p.x - this.d.x) * 1.25, S / 2, W - S / 2);
      ship.y = GG.clamp(this.d.sy + (p.y - this.d.y) * 1.25, S, H - S * 0.6);
    },
    up: function () { this.d = null; },
    key: function (k) { if (k === ' ' || k === 'b') bomb(); }
  });
})();
