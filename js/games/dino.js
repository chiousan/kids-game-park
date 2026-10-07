/* 恐龍世界（3D）：選一隻恐龍 → 在叢林小島吃東西、喝水、躲開壞恐龍，從寶寶長大成首領。
 * 四關＝四個成長階段（寶寶、少年、成年、首領），每升一級出現新挑戰和新獎勵。
 * 畫面用 three.js（WebGL），恐龍是程式雕出來的（js/dino/sculpt.js），動作每一格即時擺骨頭（js/dino/anim.js）。
 * 只用 ES5 寫法，舊 iPad 也能跑。 */
(function () {
  var LIBS = ['js/lib/three.min.js', 'js/dino/sculpt.js', 'js/dino/anim.js'];
  function load(i) {
    if (i >= LIBS.length) { main(); return; }
    var s = document.createElement('script');
    s.src = LIBS[i];
    s.onload = function () { load(i + 1); };
    document.body.appendChild(s);
  }
  load(0);

  function main() {
    var V3 = THREE.Vector3, PI = Math.PI;
    var W = 800, H = 600, d0 = 0;

    // ---------- 小工具 ----------
    function hexc(c) { return new THREE.Color(c).convertSRGBToLinear(); }
    function lam(c) { return new THREE.MeshLambertMaterial({ color: hexc(c) }); }
    function angDiff(a, b) { var d = (b - a) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; }
    function smooth(t) { t = GG.clamp(t, 0, 1); return t * t * (3 - 2 * t); }
    function noise(x, z) { return Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.27 + Math.sin(x * 0.13) * 1.7); }
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
    var M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), EU = new THREE.Euler(), S3 = new V3(), T3 = new V3(), TMP = new V3();
    function setInst(im, i, x, y, z, sx, sy, sz, ry, rx) {
      EU.set(rx || 0, ry || 0, 0, 'YXZ'); QT.setFromEuler(EU); T3.set(x, y, z); S3.set(sx, sy, sz);
      M4.compose(T3, QT, S3); im.setMatrixAt(i, M4);
    }

    // ---------- 小島地形：中間草地、四個水池、外圍沙灘和海 ----------
    var ISLAND = 52, NEST = { x: -3, z: -4 }, SAFE_R = 5.5;
    var PONDS = [{ x: 16, z: -14, r: 6 }, { x: -20, z: 12, r: 5.5 }, { x: 7, z: 24, r: 5 }, { x: -14, z: -24, r: 4.5 }];
    var VOLC = { x: 34, z: 34, r: 10 };
    function groundH(x, z) {
      var h = 0.35 * Math.sin(x * 0.09) * Math.cos(z * 0.08) + 0.25 * Math.sin((x + z) * 0.05) + noise(x, z) * 0.1;
      var r = Math.sqrt(x * x + z * z);
      if (r > 50) h -= (r - 50) * 0.4;
      for (var i = 0; i < PONDS.length; i++) {
        var p = PONDS[i], d = dist2(x, z, p.x, p.z);
        if (d < p.r + 2.5) h = GG.lerp(-0.9, h, smooth((d - p.r * 0.55) / (p.r * 0.45 + 2.5)));
      }
      var dn = dist2(x, z, NEST.x, NEST.z);
      if (dn < 6) h = GG.lerp(0, h, smooth((dn - 3) / 3));
      return h;
    }
    function nearPond(x, z) {
      var best = null, bd = 1e9;
      for (var i = 0; i < PONDS.length; i++) { var d = dist2(x, z, PONDS[i].x, PONDS[i].z) - PONDS[i].r; if (d < bd) { bd = d; best = PONDS[i]; } }
      return { p: best, d: bd };
    }

    // ---------- 階段（關卡） ----------
    var STAGES = [{ name: '寶寶', scale: 0.42 }, { name: '少年', scale: 0.6 }, { name: '成年', scale: 0.8 }, { name: '首領', scale: 1.0 }];
    function stageMsg(s, meat) {
      return ['', '新挑戰：迅猛龍出沒！　新獎勵：' + (meat ? '金色大肉' : '金色果子'),
        '新挑戰：暴龍、刺刺草叢　新獎勵：找恐龍蛋', '天黑了！小心火山石（地上紅圈快閃開）　新獎勵：首領之星'][s];
    }

    // ---------- three.js 基本設定 ----------
    var noGL = false, renderer, glc, scene, cam, sun, hemi, rim, skyMat, fogCol = hexc('#bfe6ff');
    var obstacles = [], bushes = [], meats = [], golds = [], eggs = [], stars = [], thorns = [], rocksFall = [], waves = [];
    var berryInst, meatInst, shaftInst, knobInst, thornInst, thornBaseInst, fishList = [];
    var TM = null, treeList = [], nestGroup, volcGroup, fireflies, clouds, moon, sunCol = hexc('#fff0d8'), moonCol = hexc('#a9b8ff');
    var night = 0, nightT = 0;

    function makeRenderer() {
      glc = document.createElement('canvas');
      glc.style.position = 'absolute'; glc.style.left = '0'; glc.style.top = '0'; glc.style.pointerEvents = 'none';
      var cv = document.getElementById('cv');
      cv.parentNode.insertBefore(glc, cv);
      try { renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true }); }
      catch (e) { renderer = null; noGL = true; return; }
      // 切換 App 回來時畫面被系統收回：重新整理就能重建
      glc.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); setTimeout(function () { location.reload(); }, 300); });
      renderer.outputEncoding = THREE.sRGBEncoding;
      cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    }
    function lights(sc) {
      var hm = new THREE.HemisphereLight(0xdcefff, 0x5a6a3a, 0.62); sc.add(hm);
      var sn = new THREE.DirectionalLight(0xfff0d8, 0.85); sn.position.set(30, 50, 20); sc.add(sn);
      var rm = new THREE.DirectionalLight(0x9fe9ff, 0.35); rm.position.set(-30, 20, -30); sc.add(rm);
      return [hm, sn, rm];
    }

    function buildWorld() {
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(fogCol.clone(), 32, 110);
      scene.background = fogCol.clone();
      var L = lights(scene); hemi = L[0]; sun = L[1]; rim = L[2];
      // 天空：上深藍、地平線淺藍
      var sg = new THREE.SphereGeometry(300, 24, 12), sc = [], P = sg.attributes.position, top = hexc('#4aa6f0'), hor = hexc('#cdeeff'), c = new THREE.Color();
      for (var i = 0; i < P.count; i++) { c.copy(hor).lerp(top, smooth(P.getY(i) / 160)); sc.push(c.r, c.g, c.b); }
      sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
      skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
      scene.add(new THREE.Mesh(sg, skyMat));
      // 海
      var sea = new THREE.Mesh(new THREE.CircleGeometry(320, 48), lam('#3fa7d6')); sea.rotation.x = -PI / 2; sea.position.y = -0.6; scene.add(sea);
      // 地面
      var g = new THREE.PlaneGeometry(150, 150, 96, 96); g.rotateX(-PI / 2);
      var GP = g.attributes.position, cols = [], cc = new THREE.Color();
      var gA = hexc('#6cb04a'), gB = hexc('#4f9a3a'), gC = hexc('#93c95c'), sand = hexc('#e2cf98'), wet = hexc('#8a7a52');
      for (i = 0; i < GP.count; i++) {
        var x = GP.getX(i), z = GP.getZ(i), h = groundH(x, z); GP.setY(i, h);
        var n = noise(x * 0.7, z * 0.7);
        cc.copy(gA).lerp(n > 0 ? gC : gB, Math.abs(n) * 0.8);
        var np = nearPond(x, z).d;
        if (np < 1.4) cc.lerp(sand, smooth((1.4 - np) / 1.4));
        if (h < -0.35) cc.lerp(wet, 0.6);
        var r = Math.sqrt(x * x + z * z); if (r > 48) cc.lerp(sand, smooth((r - 48) / 3));
        cols.push(cc.r, cc.g, cc.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
      // 水池（喝水的地方）＋ 跳起來的小魚
      PONDS.forEach(function (p) {
        var w = new THREE.Mesh(new THREE.CircleGeometry(p.r + 0.4, 40), new THREE.MeshLambertMaterial({ color: hexc('#5cc3ef'), transparent: true, opacity: 0.88 }));
        w.rotation.x = -PI / 2; w.position.set(p.x, -0.32, p.z); scene.add(w);
        var ring = new THREE.Mesh(new THREE.RingGeometry(p.r + 0.2, p.r + 0.55, 40), new THREE.MeshBasicMaterial({ color: hexc('#e9f8ff'), transparent: true, opacity: 0.5 }));
        ring.rotation.x = -PI / 2; ring.position.set(p.x, -0.3, p.z); scene.add(ring);
        var fish = new THREE.Group(), fb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lam('#ff9a3c'));
        fb.scale.set(0.7, 0.8, 1.4); fish.add(fb);
        var ft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 6), lam('#ff7a2c')); ft.rotation.x = -PI / 2; ft.position.z = -0.38; fish.add(ft);
        fish.visible = false; scene.add(fish);
        fishList.push({ g: fish, p: p, t: 2 + Math.random() * 4 });
      });
      // 鳥巢（安全區：壞恐龍不會進來，在這裡會慢慢回血）
      nestGroup = new THREE.Group();
      var tw = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.55, 8, 28), lam('#9a6a3c')); tw.rotation.x = -PI / 2; tw.position.y = 0.3; nestGroup.add(tw);
      var hay = new THREE.Mesh(new THREE.CircleGeometry(2.2, 28), lam('#c9a25a')); hay.rotation.x = -PI / 2; hay.position.y = 0.12; nestGroup.add(hay);
      for (i = 0; i < 3; i++) {
        var egg = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), lam(['#f6efd8', '#e8f4ff', '#fdebd6'][i]));
        egg.scale.set(1, 1.3, 1); egg.position.set(Math.cos(i * 2.1) * 0.8, 0.5, Math.sin(i * 2.1) * 0.8); nestGroup.add(egg);
      }
      var glow = new THREE.Mesh(new THREE.RingGeometry(SAFE_R - 0.3, SAFE_R, 48), new THREE.MeshBasicMaterial({ color: hexc('#fff3a0'), transparent: true, opacity: 0.35 }));
      glow.rotation.x = -PI / 2; glow.position.y = 0.06; nestGroup.add(glow);
      nestGroup.position.set(NEST.x, 0, NEST.z); scene.add(nestGroup);
      // 火山（遠方地標，最後一關會噴石頭）
      volcGroup = new THREE.Group();
      var vc = new THREE.Mesh(new THREE.CylinderGeometry(3, VOLC.r + 4, 16, 20, 1, true), lam('#7a5e4c')); vc.position.y = 7; volcGroup.add(vc);
      var lava = new THREE.Mesh(new THREE.CircleGeometry(3, 20), new THREE.MeshBasicMaterial({ color: hexc('#ff6a2a') })); lava.rotation.x = -PI / 2; lava.position.y = 14.6; volcGroup.add(lava);
      volcGroup.position.set(VOLC.x, -0.8, VOLC.z); scene.add(volcGroup);
      obstacles.push({ x: VOLC.x, z: VOLC.z, r: VOLC.r + 2 });

      // 樹、石頭、草叢、花：用 InstancedMesh 一次畫很多棵
      var R = rng(7), trees = [];
      function freeSpot(x, z, minD) {
        if (Math.sqrt(x * x + z * z) > ISLAND - 2) return false;
        if (dist2(x, z, NEST.x, NEST.z) < 9) return false;
        if (dist2(x, z, VOLC.x, VOLC.z) < VOLC.r + 4) return false;
        if (nearPond(x, z).d < 3) return false;
        for (var k = 0; k < obstacles.length; k++) if (dist2(x, z, obstacles[k].x, obstacles[k].z) < minD + obstacles[k].r) return false;
        return true;
      }
      var tries = 0;
      while (trees.length < 85 && tries++ < 4000) {
        var a = R() * PI * 2, rr = 7 + Math.sqrt(R()) * 44, tx = Math.cos(a) * rr, tz = Math.sin(a) * rr;
        if (!freeSpot(tx, tz, 2.6)) continue;
        var t = { x: tx, z: tz, s: 0.8 + R() * 0.6, pine: R() < 0.3, y: groundH(tx, tz) };
        trees.push(t); obstacles.push({ x: tx, z: tz, r: 0.55 * t.s, canopy: 1.6 * t.s });
      }
      var trunkG = new THREE.CylinderGeometry(0.2, 0.34, 1, 7); trunkG.translate(0, 0.5, 0);
      var trunk = new THREE.InstancedMesh(trunkG, lam('#8a5a36'), trees.length); trunk.frustumCulled = false;
      var round = trees.filter(function (t) { return !t.pine; }), pines = trees.filter(function (t) { return t.pine; });
      var blob = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), round.length * 3); blob.frustumCulled = false;
      var coneG = new THREE.ConeGeometry(1, 1.6, 8); coneG.translate(0, 0.8, 0);
      var cone = new THREE.InstancedMesh(coneG, new THREE.MeshLambertMaterial({ color: 0xffffff }), pines.length * 3); cone.frustumCulled = false;
      var shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }), trees.length); shadow.frustumCulled = false;
      var greens = ['#4f9e3a', '#5fb14a', '#3f8a35', '#6fbf52'].map(hexc), pineG = ['#2f7a45', '#3a8a50', '#286a3c'].map(hexc);
      var bi = 0, ci = 0;
      TM = { trunk: trunk, blob: blob, cone: cone }; treeList = trees;
      trees.forEach(function (t, i) {
        t.i = i; t.vis = 1;
        setInst(shadow, i, t.x, t.y + 0.04, t.z, 2.2 * t.s, 1, 2.2 * t.s, 0);
        if (!t.pine) {
          t.bi = bi; t.ry = [];
          for (var k = 0; k < 3; k++) { t.ry.push(R() * 6); blob.setColorAt(bi++, greens[Math.floor(R() * greens.length)]); }
        } else {
          t.ci = ci;
          for (var q = 0; q < 3; q++) cone.setColorAt(ci++, pineG[q % 3]);
        }
        placeTree(t);
      });
      [trunk, blob, cone, shadow].forEach(function (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); });
      // 石頭
      var rocks = [];
      tries = 0;
      while (rocks.length < 26 && tries++ < 3000) {
        var ra = R() * PI * 2, rd = 8 + R() * 42, rx = Math.cos(ra) * rd, rz = Math.sin(ra) * rd;
        if (!freeSpot(rx, rz, 2)) continue;
        var rs2 = 0.5 + R() * 0.9; rocks.push({ x: rx, z: rz, s: rs2 }); obstacles.push({ x: rx, z: rz, r: rs2 * 0.85 });
      }
      var rockI = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam('#9a9a92'), rocks.length); rockI.frustumCulled = false;
      rocks.forEach(function (r, i) { setInst(rockI, i, r.x, groundH(r.x, r.z) + r.s * 0.25, r.z, r.s, r.s * 0.7, r.s * 1.1, R() * 6, R() * 0.4); });
      rockI.instanceMatrix.needsUpdate = true; scene.add(rockI);
      // 草叢小點綴
      var tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), 220); tuft.frustumCulled = false;
      for (i = 0; i < 220; i++) {
        var ta = R() * PI * 2, td = 3 + R() * 46, gx = Math.cos(ta) * td, gz = Math.sin(ta) * td;
        setInst(tuft, i, gx, groundH(gx, gz) + 0.2, gz, 1, 1, 1, 0, (R() - 0.5) * 0.5);
        tuft.setColorAt(i, i % 9 === 0 ? hexc(['#ffd84a', '#ff8ab0', '#ffffff'][i % 3]) : greens[i % 4]);
      }
      tuft.instanceMatrix.needsUpdate = true; tuft.instanceColor.needsUpdate = true; scene.add(tuft);
      // 果子樹叢（草食恐龍的食物）：每叢 7 顆紅果子，吃掉會慢慢長回來
      tries = 0;
      while (bushes.length < 26 && tries++ < 3000) {
        var ba = R() * PI * 2, bd = 6 + R() * 43, bx = Math.cos(ba) * bd, bz = Math.sin(ba) * bd;
        if (!freeSpot(bx, bz, 1.6)) continue;
        bushes.push({ x: bx, z: bz, y: groundH(bx, bz), n: 7, grow: 0 });
      }
      var bushI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam('#3f8f3a'), bushes.length * 2); bushI.frustumCulled = false;
      berryInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshLambertMaterial({ color: hexc('#ff3b4a'), emissive: hexc('#401010') }), bushes.length * 7); berryInst.frustumCulled = false;
      bushes.forEach(function (b, i) {
        setInst(bushI, i * 2, b.x, b.y + 0.55, b.z, 1.1, 0.8, 1.1, R() * 6);
        setInst(bushI, i * 2 + 1, b.x + 0.5, b.y + 0.4, b.z - 0.3, 0.7, 0.6, 0.7, R() * 6);
        b.spots = [];
        for (var k = 0; k < 7; k++) { var aa = k / 7 * PI * 2 + R(), yy = 0.35 + R() * 0.55; b.spots.push([Math.cos(aa) * 0.95, yy, Math.sin(aa) * 0.95]); }
      });
      bushI.instanceMatrix.needsUpdate = true; scene.add(bushI); scene.add(berryInst);
      // 肉（肉食恐龍的食物）：骨頭＋肉
      meatInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), 24); meatInst.frustumCulled = false;
      shaftInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6).rotateX(PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }), 24); shaftInst.frustumCulled = false;
      knobInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), 48); knobInst.frustumCulled = false;
      [meatInst, shaftInst, knobInst].forEach(function (m) { scene.add(m); });
      for (i = 0; i < 24; i++) meats.push({ x: 0, z: 0, on: false, t: 0, gold: false });
      // 刺刺草叢（第 3 關的新障礙，碰到會痛）
      thornBaseInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam('#3a1748'), 10); thornBaseInst.frustumCulled = false;
      var thG = new THREE.ConeGeometry(0.13, 1.05, 6); thG.translate(0, 0.52, 0);
      thornInst = new THREE.InstancedMesh(thG, new THREE.MeshLambertMaterial({ color: hexc('#f6efd8'), emissive: hexc('#000000') }), 100); thornInst.frustumCulled = false;
      scene.add(thornBaseInst); scene.add(thornInst);
      for (i = 0; i < 10; i++) {
        tries = 0;
        do { var ka = R() * PI * 2, kd = 10 + R() * 38, kx = Math.cos(ka) * kd, kz = Math.sin(ka) * kd; } while (!freeSpot(kx, kz, 2.2) && tries++ < 200);
        thorns.push({ x: kx, z: kz, y: groundH(kx, kz) });
      }
      showThorns(false);
      // 雲
      clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: hexc('#9aa6b8') }), 30); clouds.frustumCulled = false;
      clouds.userData.list = [];
      for (i = 0; i < 10; i++) clouds.userData.list.push({ x: (R() - 0.5) * 160, z: (R() - 0.5) * 160, y: 26 + R() * 10, s: 3 + R() * 3 });
      scene.add(clouds);
      // 螢火蟲（晚上才出現）
      var fp = new THREE.BufferGeometry(), fa = [];
      for (i = 0; i < 70; i++) fa.push((R() - 0.5) * 40, 0.5 + R() * 3, (R() - 0.5) * 40);
      fp.setAttribute('position', new THREE.Float32BufferAttribute(fa, 3));
      var fcv = document.createElement('canvas'); fcv.width = fcv.height = 64;
      var fg = fcv.getContext('2d'), frg = fg.createRadialGradient(32, 32, 0, 32, 32, 32);
      frg.addColorStop(0, 'rgba(255,255,255,1)'); frg.addColorStop(0.3, 'rgba(255,250,170,0.9)'); frg.addColorStop(1, 'rgba(255,240,120,0)');
      fg.fillStyle = frg; fg.fillRect(0, 0, 64, 64);
      fireflies = new THREE.Points(fp, new THREE.PointsMaterial({ color: hexc('#fff27a'), map: new THREE.CanvasTexture(fcv), size: 0.55, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      // 月亮（晚上才出現）
      moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: hexc('#fff6c8'), fog: false, transparent: true, opacity: 0 }));
      moon.position.set(-90, 75, -130); scene.add(moon);
      scene.add(fireflies);
    }
    // 一棵樹的 InstancedMesh 位置（vis 0~1：擋住鏡頭時縮小讓開）
    function placeTree(t) {
      var v = Math.max(0.001, t.vis), th = t.pine ? 1.6 * t.s : 2.4 * t.s;
      setInst(TM.trunk, t.i, t.x, t.y, t.z, t.s * v, th * v, t.s * v, 0);
      if (!t.pine) {
        for (var k = 0; k < 3; k++) {
          var ox = [0, 0.7, -0.6][k] * t.s, oz = [0, 0.3, -0.4][k] * t.s, oy = [0.6, 0.1, 0.2][k] * t.s, rs = [1.4, 1.05, 1.1][k] * t.s * v;
          setInst(TM.blob, t.bi + k, t.x + ox * v, t.y + (th + oy) * v, t.z + oz * v, rs, rs * 0.9, rs, t.ry[k]);
        }
      } else {
        for (var q = 0; q < 3; q++) {
          var cs = (1.5 - q * 0.35) * t.s * v;
          setInst(TM.cone, t.ci + q, t.x, t.y + (th * 0.6 + q * 1.0 * t.s) * v, t.z, cs, cs, cs, 0);
        }
      }
    }
    function showThorns(on) {
      thorns.forEach(function (t, i) {
        var s = on ? 1 : 0;
        setInst(thornBaseInst, i, t.x, t.y + 0.4, t.z, 0.9 * s, 0.6 * s, 0.9 * s, 0);
        for (var k = 0; k < 10; k++) {
          var a = k / 10 * PI * 2, up = k % 2 ? 0.35 : 0.85;
          setInst(thornInst, i * 10 + k, t.x + Math.sin(a) * 0.5 * s, t.y + 0.5, t.z + Math.cos(a) * 0.5 * s, s, s, s, a, up);
        }
      });
      thornBaseInst.instanceMatrix.needsUpdate = true; thornInst.instanceMatrix.needsUpdate = true;
    }
    function drawBerries() {
      var k = 0;
      bushes.forEach(function (b) {
        for (var i = 0; i < 7; i++) {
          var on = P && P.herb && i < b.n, sp = b.spots[i];
          setInst(berryInst, k++, b.x + sp[0], b.y + sp[1], b.z + sp[2], on ? 1 : 0, on ? 1 : 0, on ? 1 : 0, 0);
        }
      });
      berryInst.instanceMatrix.needsUpdate = true;
    }
    var GOLD = hexc('#ffc93a'), MEATC = hexc('#a0522d'), BONE = hexc('#f4ecd8');
    function drawMeats(t) {
      meats.forEach(function (m, i) {
        var on = m.on && P && !P.herb, s = on ? 1 : 0, y = groundH(m.x, m.z) + 0.3 + (m.gold ? 0.3 + Math.sin(t * 3 + i) * 0.15 : 0);
        var ry = m.gold ? t * 1.5 : m.ry || 0, cx = Math.sin(ry), cz = Math.cos(ry);
        setInst(meatInst, i, m.x + cx * 0.12, y, m.z + cz * 0.12, s, s * 0.85, s * 1.3, ry);
        setInst(shaftInst, i, m.x - cx * 0.3, y, m.z - cz * 0.3, s, s, s, ry);
        setInst(knobInst, i * 2, m.x - cx * 0.62 + cz * 0.08, y, m.z - cz * 0.62 - cx * 0.08, s, s, s, 0);
        setInst(knobInst, i * 2 + 1, m.x - cx * 0.62 - cz * 0.08, y, m.z - cz * 0.62 + cx * 0.08, s, s, s, 0);
        meatInst.setColorAt(i, m.gold ? GOLD : MEATC); shaftInst.setColorAt(i, m.gold ? GOLD : BONE);
        knobInst.setColorAt(i * 2, m.gold ? GOLD : BONE); knobInst.setColorAt(i * 2 + 1, m.gold ? GOLD : BONE);
      });
      [meatInst, shaftInst, knobInst].forEach(function (m) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
    }
    function randomSpot(minFromPlayer) {
      for (var k = 0; k < 200; k++) {
        var a = Math.random() * PI * 2, r = 6 + Math.sqrt(Math.random()) * 42, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (nearPond(x, z).d < 2 || dist2(x, z, VOLC.x, VOLC.z) < VOLC.r + 4) continue;
        var ok = true;
        for (var i = 0; i < obstacles.length; i++) if (dist2(x, z, obstacles[i].x, obstacles[i].z) < obstacles[i].r + 1.2) { ok = false; break; }
        if (!ok) continue;
        if (P && minFromPlayer && dist2(x, z, P.x, P.z) < minFromPlayer) continue;
        return { x: x, z: z };
      }
      return { x: 10, z: 10 };
    }
    function placeMeat(m, gold) { var s = randomSpot(8); m.x = s.x; m.z = s.z; m.on = true; m.gold = !!gold; m.ry = Math.random() * 6; }

    // 金色果子（草食）、恐龍蛋、首領之星：會轉、會閃的獎勵
    function goldFruit() {
      var g = new THREE.Group(), f = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshPhongMaterial({ color: GOLD, emissive: hexc('#6a4a00'), shininess: 60 }));
      g.add(f);
      var lf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lam('#4caf50')); lf.scale.set(1, 0.3, 1.8); lf.position.set(0.12, 0.42, 0); lf.rotation.z = 0.5; g.add(lf);
      return g;
    }
    function eggMesh() {
      var g = new THREE.Group(), e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshPhongMaterial({ color: hexc('#f7f0dc'), shininess: 40 }));
      e.scale.set(1, 1.3, 1); g.add(e);
      for (var i = 0; i < 5; i++) {
        var sp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam('#7ab8e8'));
        var a = i * 1.3, y = -0.2 + (i % 3) * 0.2; sp.position.set(Math.cos(a) * 0.37, y * 1.3, Math.sin(a) * 0.37); g.add(sp);
      }
      return g;
    }
    function starMesh() {
      var sh = new THREE.Shape();
      for (var i = 0; i < 10; i++) { var r = i % 2 ? 0.28 : 0.62, a = i / 10 * PI * 2 - PI / 2; if (i) sh.lineTo(Math.cos(a) * r, -Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
      var g = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
      g.translate(0, 0, -0.09);
      return new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: GOLD, emissive: hexc('#7a5200'), shininess: 80 }));
    }
    function addPickup(list, mesh, kind) {
      var s = randomSpot(10);
      mesh.position.set(s.x, groundH(s.x, s.z) + 1, s.z); scene.add(mesh);
      list.push({ m: mesh, x: s.x, z: s.z, kind: kind, t: Math.random() * 6 });
    }

    // ---------- 恐龍（玩家與電腦） ----------
    function makeDino(kind, scale) {
      var d = DINO.build(DINO.SPECIES[kind]); DINO.merge(d); DINO.outline(d.group, 0.055);
      var holder = new THREE.Group(); holder.add(d.group);
      var len = 0, sp = d.spec.spine; len = sp[sp.length - 1][0] - sp[0][0];
      var sh = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
      var mw = 0; sp.forEach(function (r) { if (r[2] > mw) mw = r[2]; });
      sh.scale.set(mw * 1.5, 1, len * 0.4); sh.position.y = 0.04; holder.add(sh);
      holder.scale.setScalar(scale);
      var ols = [], mats = [];
      d.group.traverse(function (o) {
        if (o.userData.isOutline) ols.push(o);
        else if (o.isMesh && mats.indexOf(o.material) < 0) mats.push(o.material);
      });
      scene.add(holder);
      return { kind: kind, d: d, rig: new DINO.Rig(d), holder: holder, meta: d.spec.meta, scale: scale, len: len, ols: ols, mats: mats, olOn: true, ghost: false };
    }
    // 半透明（擋在鏡頭前、但正在威脅玩家的恐龍）：看得到牠，也看得到後面的玩家
    function setGhost(n, on) {
      if (n.ghost === on) return;
      n.ghost = on;
      n.mats.forEach(function (m) { m.transparent = on; m.opacity = on ? 0.4 : 1; m.depthWrite = !on; m.needsUpdate = true; });
    }
    function bodyR(o) { return Math.max(0.35, o.len * 0.2 * o.scale); }
    function headPos(o, out) { o.d.bones.head.getWorldPosition(out); return out; }

    var P = null, npcs = [], camYaw = 0, camPos = new V3(), camLook = new V3(), phase = 'select', score = 0, tHint = 0, moved = false;
    var effects = [];

    function spawnNpc(kind, scale) {
      var s = randomSpot(16), n = makeDino(kind, scale || 1);
      n.x = s.x; n.z = s.z; n.yaw = Math.random() * PI * 2; n.state = 'wander'; n.t = 0; n.tx = n.x; n.tz = n.z;
      n.herb = n.meta.diet === 'herb';
      n.maxHp = (24 + n.meta.hp * 10) * n.scale; n.hp = n.maxHp; n.cd = 0; n.faintT = 0; n.angry = 0; n.flee = 0; n.hpShow = 0; n.biteT = -1;
      n.speed = n.meta.speed * (0.8 + 0.2 * n.scale);
      npcs.push(n);
      return n;
    }
    function removeAllNpcs() { npcs.forEach(function (n) { scene.remove(n.holder); }); npcs = []; }

    function startPlay(kind) {
      phase = 'play';
      if (P) scene.remove(P.holder);
      removeAllNpcs();
      golds.concat(eggs, stars).forEach(function (g) { scene.remove(g.m); });
      golds = []; eggs = []; stars = [];
      rocksFall.forEach(function (r) { scene.remove(r.ring); scene.remove(r.rock); scene.remove(r.shd); r.trail.forEach(function (tm) { scene.remove(tm); }); }); rocksFall = [];
      P = makeDino(kind, STAGES[0].scale);
      // 從鳥巢走出來，鏡頭在鳥巢上方往前看
      P.x = NEST.x; P.z = NEST.z + SAFE_R + 1; P.yaw = 0; P.jy = 0; P.vy = 0; P.air = false; P.jumpT = 0;
      P.herb = P.meta.diet === 'herb';
      P.stage = 0; P.growth = 0; P.lives = 3; P.inv = 0; P.faintT = 0; P.atkCd = 0; P.eatCd = 0; P.eatT = 0; P.hitT = -1;
      P.maxHp = 60 + P.meta.hp * 12; P.hp = P.maxHp; P.food = 80; P.water = 80; P.scaleT = 1; P.scaleFrom = P.scale;
      camYaw = P.yaw; score = 0; GG.setScore(0); night = 0; nightT = 0; tHint = 0; moved = false;
      bushes.forEach(function (b) { b.n = 7; b.grow = 0; });
      meats.forEach(function (m, i) { if (i < 16) placeMeat(m, false); else m.on = false; });
      showThorns(false);
      drawBerries(); drawMeats(0);
      treeList.forEach(function (t) { t.vis = 1; placeTree(t); });
      TM.trunk.instanceMatrix.needsUpdate = true; TM.blob.instanceMatrix.needsUpdate = true; TM.cone.instanceMatrix.needsUpdate = true;
      spawnStage(0);
      camPos.set(P.x - Math.sin(camYaw) * 6, 4, P.z - Math.cos(camYaw) * 6);
      setPad();
    }
    function spawnStage(s) {
      if (s === 0) ['Stegosaurus', 'Parasaurolophus', 'Triceratops', 'Apatosaurus', 'Parasaurolophus', 'Stegosaurus'].forEach(function (k) { spawnNpc(k, 0.9 + Math.random() * 0.15); });
      if (s === 1) {
        spawnNpc('Raptor', 0.75); spawnNpc('Raptor', 0.75);
        for (var i = 0; i < 3; i++) {
          if (P.herb) addPickup(golds, goldFruit(), 'gold');
          else { var m = meats[16 + i]; placeMeat(m, true); }
        }
      }
      if (s === 2) {
        spawnNpc('TRex', 0.95); spawnNpc('Raptor', 0.85);
        showThorns(true);
        for (var e = 0; e < 6; e++) addPickup(eggs, eggMesh(), 'egg');
      }
      if (s === 3) {
        spawnNpc('TRex', 1.0); nightT = 1;
        for (var k = 0; k < 5; k++) addPickup(stars, starMesh(), 'star');
      }
    }

    // ---------- 按鈕 ----------
    var ATK_LABEL = { bite: '咬', tail: '甩尾', horn: '衝撞', call: '大叫' };
    function setPad() {
      if (phase !== 'play') { GG.setPad([]); return; }
      var m = Math.min(W, H), R = GG.clamp(m * 0.11, 56, 88), br = GG.clamp(m * 0.085, 44, 70);
      var bx = W - br - 22, by = H - br - 24;
      GG.setPad([
        GG.stick({ id: 'stick', cx: R * 1.5 + 18, cy: H - R * 1.5 - 18, R: R, dead: 0.12, color: '#ffffff' }),
        { id: 'atk', round: true, x: bx - br, y: by - br, w: br * 2, h: br * 2, color: '#ff5c5c', label: ATK_LABEL[P.meta.attack], fs: br * 0.5, onDown: doAttack },
        { id: 'jump', round: true, x: bx - br * 3.3, y: by - br * 0.75, w: br * 1.6, h: br * 1.6, color: '#4f9dff', label: '跳', fs: br * 0.5, onDown: doJump },
        { id: 'eat', round: true, x: bx - br * 0.85, y: by - br * 3.2, w: br * 1.7, h: br * 1.7, color: '#43c76a', label: '吃', fs: br * 0.5, onDown: doEat }
      ]);
    }

    // ---------- 動作 ----------
    function doJump() {
      if (!P || P.faintT > 0 || P.air || P.jumpT > 0) return;
      P.rig.squat(); P.jumpT = DINO.Rig.SQUAT;
    }
    function doAttack() {
      if (!P || P.faintT > 0 || P.atkCd > 0) return;
      P.rig.attack(); P.atkCd = 0.6; P.hitT = 0.16;
      GG.sfx(P.meta.attack === 'call' ? 'boom' : 'shoot');
      if (P.meta.attack === 'call') addWave(P.x, P.z);
    }
    function eatTarget() {
      if (!P) return null;
      var reach = 1.0 + P.scale * 2.2, hx = P.x + Math.sin(P.yaw) * P.len * 0.3 * P.scale, hz = P.z + Math.cos(P.yaw) * P.len * 0.3 * P.scale;
      var best = null, bd = 1e9, i, d;
      if (P.herb) {
        for (i = 0; i < bushes.length; i++) { d = dist2(hx, hz, bushes[i].x, bushes[i].z) - 1; if (bushes[i].n > 0 && d < reach && d < bd) { bd = d; best = { type: 'berry', ref: bushes[i] }; } }
        for (i = 0; i < golds.length; i++) { d = dist2(hx, hz, golds[i].x, golds[i].z); if (d < reach + 0.4 && d < bd) { bd = d; best = { type: 'gold', ref: golds[i] }; } }
      } else {
        for (i = 0; i < meats.length; i++) { d = dist2(hx, hz, meats[i].x, meats[i].z); if (meats[i].on && d < reach + 0.3 && d < bd) { bd = d; best = { type: meats[i].gold ? 'goldmeat' : 'meat', ref: meats[i] }; } }
      }
      var np = nearPond(hx, hz);
      if (np.d < reach && (!best || np.d < bd || P.water < P.food)) {
        best = !P.herb && P.food <= P.water ? { type: 'fish', ref: np.p } : { type: 'water', ref: np.p };
      }
      return best;
    }
    function gain(g, text, color) {
      P.growth += g; score += g; GG.setScore(Math.round(score));
      if (text) floatAt(P.x, P.z, text, color || '#ffe14d');
    }
    function doEat() {
      if (!P || P.faintT > 0 || P.eatCd > 0) return;
      var t = eatTarget();
      if (!t) { floatAt(P.x, P.z, P.herb ? '附近沒有果子' : '附近沒有肉', '#ffffff'); return; }
      P.eatCd = 0.55; P.eatT = 0.6; GG.sfx(t.type === 'water' ? 'splash' : 'pop');
      if (t.type === 'berry') { t.ref.n--; P.food = Math.min(100, P.food + 14); gain(3, '+3 成長'); drawBerries(); }
      else if (t.type === 'gold') { P.food = Math.min(100, P.food + 40); gain(22, '金色果子 +22！'); removePickup(golds, t.ref); GG.sfx('power'); }
      else if (t.type === 'meat') { t.ref.on = false; t.ref.t = 18; P.food = Math.min(100, P.food + 32); gain(7, '+7 成長'); }
      else if (t.type === 'goldmeat') { t.ref.on = false; t.ref.t = 25; P.food = Math.min(100, P.food + 45); gain(22, '金色大肉 +22！'); GG.sfx('power'); }
      else if (t.type === 'fish') { P.food = Math.min(100, P.food + 20); P.water = Math.min(100, P.water + 10); gain(4, '抓到魚！+4'); leapFish(t.ref); }
      else { P.water = Math.min(100, P.water + 24); gain(1, '咕嚕咕嚕 +1', '#9fe3ff'); }
    }
    function removePickup(list, it) { scene.remove(it.m); list.splice(list.indexOf(it), 1); }
    function leapFish(p) { fishList.forEach(function (f) { if (f.p === p) f.t = 0; }); }
    function addWave(x, z) {
      for (var i = 0; i < 3; i++) {
        var m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: hexc('#ffffff'), transparent: true, opacity: 0.8 }));
        m.rotation.x = -PI / 2; m.position.set(x, groundH(x, z) + 1.2, z); scene.add(m);
        effects.push({ m: m, t: -i * 0.15, life: 0.9 });
      }
    }

    // ---------- 受傷、暈倒 ----------
    function hurtPlayer(dmg, fromX, fromZ) {
      if (P.inv > 0 || P.faintT > 0) return;
      dmg *= [0.6, 1, 1.3][d0] * (1.3 - 0.25 * P.stage);
      P.hp -= dmg; P.inv = 0.9; P.rig.hit(); GG.sfx('hurt'); GG.shake(8, 0.25);
      var dx = P.x - fromX, dz = P.z - fromZ, l = Math.sqrt(dx * dx + dz * dz) || 1;
      P.kx = dx / l * 5; P.kz = dz / l * 5;
      if (P.hp > 0) floatAt(P.x, P.z, '-' + Math.round(dmg), '#ff6b6b');
      if (P.hp <= 0) {
        P.hp = 0; P.faintT = 2.6; P.rig.setFaint(true); P.lives--; GG.sfx('lose');
        floatAt(P.x, P.z, '暈倒了！', '#ffffff');
      }
    }
    function hurtNpc(n, dmg) {
      n.hp -= dmg; n.rig.hit(); n.hpShow = 3; GG.sfx('hit');
      var dx = n.x - P.x, dz = n.z - P.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
      n.kx = dx / l * 4; n.kz = dz / l * 4;
      if (n.hp <= 0) {
        n.hp = 0; n.faintT = 7; n.rig.setFaint(true); n.state = 'faint';
        if (!n.herb) gain(10, '打敗' + n.meta.zh + '！+10', '#ffe14d');
        else floatAt(n.x, n.z, n.meta.zh + '暈倒了', '#ffffff');
      } else if (n.herb) {
        if (n.meta.atk >= 3) { n.angry = 3; n.state = 'chase'; } else { n.flee = 4; n.state = 'flee'; }
      }
    }

    // ---------- 碰撞：樹、石頭、水池深處、小島邊緣、其他恐龍 ----------
    function collide(o, r) {
      for (var i = 0; i < obstacles.length; i++) {
        var b = obstacles[i], dx = o.x - b.x, dz = o.z - b.z, d = Math.sqrt(dx * dx + dz * dz), m = r + b.r;
        if (d < m && d > 0.0001) { o.x = b.x + dx / d * m; o.z = b.z + dz / d * m; }
      }
      for (i = 0; i < PONDS.length; i++) {
        var p = PONDS[i], px = o.x - p.x, pz = o.z - p.z, pd = Math.sqrt(px * px + pz * pz), pm = p.r - 1.6 + r * 0.3;
        if (pd < pm && pd > 0.0001) { o.x = p.x + px / pd * pm; o.z = p.z + pz / pd * pm; }
      }
      var rr = Math.sqrt(o.x * o.x + o.z * o.z);
      if (rr > ISLAND) { o.x *= ISLAND / rr; o.z *= ISLAND / rr; }
    }

    // ---------- 每一格：玩家 ----------
    function updatePlayer(dt) {
      var p = P, st = GG.button('stick'), ax = 0, ay = 0, m = 0;
      if (st && st.down && st.mag > 0.12) { ax = st.ax * st.mag; ay = st.ay * st.mag; }
      var K = GG.keys || {};
      if (K.ArrowLeft || K.a) ax -= 1; if (K.ArrowRight || K.d) ax += 1; if (K.ArrowUp || K.w) ay -= 1; if (K.ArrowDown || K.s) ay += 1;
      m = Math.min(1, Math.sqrt(ax * ax + ay * ay));
      if (p.faintT > 0) {
        m = 0; p.faintT -= dt;
        if (p.faintT <= 0) {
          if (p.lives <= 0) { endGame(false); return; }
          // 回到恐龍巢休息
          p.rig.setFaint(false); p.x = NEST.x; p.z = NEST.z + 2.5; p.hp = p.maxHp * 0.7; p.food = Math.max(p.food, 55); p.water = Math.max(p.water, 55); p.inv = 2;
          floatAt(p.x, p.z, '回到恐龍巢休息', '#ffffff');
        }
      }
      if (m > 0.05) {
        moved = true;
        var fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
        var dx = fx * (-ay) + rx * ax, dz = fz * (-ay) + rz * ax, l = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= l; dz /= l;
        p.yaw += angDiff(p.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 9);
        var spd = p.meta.speed * (0.65 + 0.45 * p.scale) * m * (m > 0.85 ? 1.3 : 1) * (p.eatT > 0 ? 0.3 : 1);
        p.x += dx * spd * dt; p.z += dz * spd * dt;
        // 鏡頭慢慢轉到恐龍後面
        camYaw += angDiff(camYaw, p.yaw) * Math.min(1, dt * 1.4 * m);
      }
      if (p.kx) { p.x += p.kx * dt; p.z += p.kz * dt; p.kx *= Math.pow(0.02, dt); p.kz *= Math.pow(0.02, dt); if (Math.abs(p.kx) < 0.05) p.kx = p.kz = 0; }
      collide(p, bodyR(p));
      // 跳
      if (p.jumpT > 0) { p.jumpT -= dt; if (p.jumpT <= 0) { p.vy = 7 * (0.75 + 0.25 * p.scale); p.air = true; GG.sfx('jump'); } }
      if (p.air) { p.vy -= 20 * dt; p.jy += p.vy * dt; if (p.jy <= 0) { p.jy = 0; p.vy = 0; p.air = false; GG.sfx('bounce'); } }
      p.y = groundH(p.x, p.z) + p.jy;
      // 攻擊命中判定（動作開始一點點後才算）
      if (p.hitT >= 0) {
        p.hitT -= dt;
        if (p.hitT < 0) {
          var reach = 1.2 + p.len * 0.45 * p.scale, dmg = (6 + p.meta.atk * 4) * (0.7 + 0.6 * p.scale);
          npcs.forEach(function (n) {
            if (n.state === 'faint') return;
            var dx2 = n.x - p.x, dz2 = n.z - p.z, d = Math.sqrt(dx2 * dx2 + dz2 * dz2) - bodyR(n);
            if (p.meta.attack === 'call') {
              if (d < 12 && !n.herb) { n.flee = 5; n.state = 'flee'; floatAt(n.x, n.z, '嚇跑了！', '#ffffff'); }
              if (d < 3) hurtNpc(n, dmg * 0.5);
              return;
            }
            var fwd = (Math.sin(p.yaw) * dx2 + Math.cos(p.yaw) * dz2) / (d + bodyR(n) || 1);
            if (p.meta.attack === 'tail') fwd = -fwd; // 甩尾巴打後面和兩側
            if (d < reach && fwd > -0.2) hurtNpc(n, dmg);
          });
        }
      }
      p.atkCd -= dt; p.eatCd -= dt; p.inv -= dt;
      if (d0 === 0 && m < 0.1 && p.faintT <= 0 && (p.food < 95 || p.water < 95) && eatTarget()) { p.autoT = (p.autoT || 0) + dt; if (p.autoT > 0.5 && p.eatCd <= 0) { doEat(); p.autoT = 0.2; } }
      else p.autoT = 0;
      if (p.eatT > 0) p.eatT -= dt;
      // 肚子餓、口渴（越長大消耗越快）
      var rate = [0.32, 0.5, 0.75][d0] * (1 + 0.22 * p.stage);
      p.food = Math.max(0, p.food - rate * dt); p.water = Math.max(0, p.water - rate * 1.25 * dt);
      if ((p.food <= 0 || p.water <= 0) && p.faintT <= 0) { p.hp -= 3 * dt; if (p.hp <= 0) hurtPlayer(1, p.x, p.z); }
      var inNest = dist2(p.x, p.z, NEST.x, NEST.z) < SAFE_R;
      if (inNest && p.faintT <= 0) p.hp = Math.min(p.maxHp, p.hp + 6 * dt);
      else if (p.food > 50 && p.water > 50) p.hp = Math.min(p.maxHp, p.hp + 1.2 * dt);
      // 吃飽喝足就慢慢長大
      if (p.food > 40 && p.water > 40 && p.faintT <= 0) { p.growth += 0.35 * dt; score += 0.35 * dt; }
      // 刺刺草叢
      if (p.stage >= 2 && p.faintT <= 0) thorns.forEach(function (t) { if (dist2(p.x, p.z, t.x, t.z) < 1.1 + bodyR(p) * 0.6 && !p.air) hurtPlayer(8, t.x, t.z); });
      // 撿獎勵（走過去就撿到）
      eggs.slice().forEach(function (e) { if (dist2(p.x, p.z, e.x, e.z) < 1.2 + bodyR(p)) { removePickup(eggs, e); gain(12, '找到恐龍蛋！+12'); GG.sfx('coin'); } });
      stars.slice().forEach(function (e) { if (dist2(p.x, p.z, e.x, e.z) < 1.4 + bodyR(p)) { removePickup(stars, e); gain(15, '首領之星 +15！'); GG.sfx('power'); } });
      // 升級
      if (p.growth >= 100) {
        if (p.stage < 3) stageUp(false);
        else { endGame(true); return; }
      }
      // 長大的過程（1.2 秒慢慢變大）
      if (p.scaleT < 1) { p.scaleT = Math.min(1, p.scaleT + dt / 1.2); p.scale = GG.lerp(p.scaleFrom, STAGES[p.stage].scale, GG.back(p.scaleT)); p.holder.scale.setScalar(p.scale); }
      p.rig.setMove(m * (p.eatT > 0 ? 0.3 : 1)); p.rig.setEat(p.eatT > 0);
      p.rig.update(dt, p.air, p.vy);
      p.holder.position.set(p.x, groundH(p.x, p.z) + p.jy, p.z);
      p.holder.rotation.y = p.yaw;
      if (p.inv > 0 && p.faintT <= 0) p.holder.visible = Math.floor(p.inv * 12) % 2 === 0 || p.inv > 0.6; else p.holder.visible = true;
    }
    function stageUp(silent) {
      var p = P;
      p.stage++; p.growth = 0; p.scaleFrom = p.scale; p.scaleT = 0;
      p.maxHp = (60 + p.meta.hp * 12) * (1 + 0.3 * p.stage); p.hp = p.maxHp;
      spawnStage(p.stage);
      if (!silent) GG.banner('第 ' + (p.stage + 1) + ' 關：長成' + STAGES[p.stage].name + '了！', stageMsg(p.stage, !p.herb));
    }
    function endGame(win) {
      if (win) GG.over({ win: true, icon: 'assets/icons/dino.png', score: Math.round(score), stars: P.lives >= 3 ? 3 : P.lives === 2 ? 2 : 1, title: '你是恐龍首領了！', text: P.meta.zh + '從寶寶長大成首領！', delay: 900 });
      else GG.over({ icon: 'assets/icons/dino.png', score: Math.round(score), stars: GG.starsFor(P.stage, 1, 2, 3), text: P.meta.zh + '長到「' + STAGES[P.stage].name + '」', delay: 600 });
    }

    // ---------- 每一格：電腦恐龍 ----------
    function updateNpc(n, dt) {
      var p = P, dx = p.x - n.x, dz = p.z - n.z, dp = Math.sqrt(dx * dx + dz * dz), m = 0, ty = n.yaw;
      var pSize = p.d.hipY * p.scale, nSize = n.d.hipY * n.scale, inNest = dist2(p.x, p.z, NEST.x, NEST.z) < SAFE_R + 1;
      n.cd -= dt; n.hpShow -= dt;
      if (n.state === 'faint') {
        n.faintT -= dt;
        if (n.faintT <= 0) { n.rig.setFaint(false); n.hp = n.maxHp; n.state = 'flee'; n.flee = 5; }
      } else if (!n.herb && n.flee <= 0 && p.faintT <= 0 && !inNest && dp < (n.kind === 'TRex' ? 15 : 12) && pSize < nSize * 1.25 && (n.kind !== 'Raptor' || p.stage >= 1)) {
        n.state = 'chase';
      } else if (!n.herb && n.flee <= 0 && dp < 9 && pSize >= nSize * 1.25) {
        n.state = 'flee'; n.flee = 3; // 玩家長得比牠大了：牠會逃走
      } else if (n.state === 'chase' && (n.herb ? n.angry <= 0 : true)) n.state = 'wander';
      n.angry -= dt;
      if (n.state === 'flee') { n.flee -= dt; if (n.flee <= 0) n.state = 'wander'; }

      if (n.state === 'chase') {
        ty = Math.atan2(dx, dz); m = n.herb ? 0.8 : 0.9;
        var reach = bodyR(n) + bodyR(p) + n.len * 0.25 * n.scale;
        if (dp < reach) {
          m = 0;
          if (n.cd <= 0) { n.rig.attack(); n.cd = 1.4; n.biteT = 0.2; }
        }
        if (inNest && !n.herb) { n.state = 'wander'; n.tx = n.x - dx; n.tz = n.z - dz; }
      } else if (n.state === 'flee') {
        ty = Math.atan2(-dx, -dz); m = 1;
      } else if (n.state === 'graze') {
        n.t -= dt; n.rig.setEat(true);
        if (n.t <= 0) { n.state = 'wander'; n.rig.setEat(false); var s = randomSpot(0); n.tx = s.x; n.tz = s.z; }
      } else if (n.state === 'wander') {
        var tdx = n.tx - n.x, tdz = n.tz - n.z, td = Math.sqrt(tdx * tdx + tdz * tdz);
        if (td < 1.5) { n.state = 'graze'; n.t = 2 + Math.random() * 4; }
        else { ty = Math.atan2(tdx, tdz); m = 0.4; }
      }
      if (n.state !== 'graze') n.rig.setEat(false);
      if (n.biteT >= 0) {
        n.biteT -= dt;
        if (n.biteT < 0 && dp < bodyR(n) + bodyR(p) + n.len * 0.3 * n.scale + 0.6) hurtPlayer(4 + n.meta.atk * 3 * n.scale, n.x, n.z);
      }
      if (n.state !== 'faint' && m > 0) {
        n.yaw += angDiff(n.yaw, ty) * Math.min(1, dt * 3);
        var sp = n.speed * m * (n.state === 'chase' && n.kind === 'TRex' ? 0.85 : 1) * [0.8, 1, 1.15][d0];
        n.x += Math.sin(n.yaw) * sp * dt; n.z += Math.cos(n.yaw) * sp * dt;
      }
      if (n.kx) { n.x += n.kx * dt; n.z += n.kz * dt; n.kx *= Math.pow(0.02, dt); n.kz *= Math.pow(0.02, dt); if (Math.abs(n.kx) < 0.05) n.kx = n.kz = 0; }
      collide(n, bodyR(n));
      // 肉食恐龍不進鳥巢
      if (!n.herb) { var nd = dist2(n.x, n.z, NEST.x, NEST.z), nr = SAFE_R + bodyR(n); if (nd < nr) { n.x = NEST.x + (n.x - NEST.x) / nd * nr; n.z = NEST.z + (n.z - NEST.z) / nd * nr; } }
      // 和玩家互相推開（大的推小的）
      var sep = bodyR(n) + bodyR(p), dd = dist2(n.x, n.z, p.x, p.z);
      if (dd < sep && dd > 0.001 && n.state !== 'faint') {
        var push = (sep - dd), wP = nSize / (nSize + pSize);
        p.x += (p.x - n.x) / dd * push * wP; p.z += (p.z - n.z) / dd * push * wP;
        n.x -= (p.x - n.x) / dd * push * (1 - wP); n.z -= (p.z - n.z) / dd * push * (1 - wP);
      }
      n.rig.setMove(m); n.rig.update(dt, false, 0);
      n.holder.position.set(n.x, groundH(n.x, n.z), n.z); n.holder.rotation.y = n.yaw;
      // 遠的恐龍不畫描邊、太遠不畫
      var far = dist2(n.x, n.z, cam.position.x, cam.position.z);
      n.far = far >= 100;
      var cdx = camPos.x - p.x, cdz = camPos.z - p.z, cl = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
      var nx = n.x - p.x, nz = n.z - p.z, along = (nx * cdx + nz * cdz) / cl, off = Math.abs(nx * cdz - nz * cdx) / cl;
      var reachR = bodyR(n) + n.len * 0.35 * n.scale;
      var block = dist2(n.x, n.z, camPos.x, camPos.z) < cl * 0.6 + reachR || (along > 0.5 && along < cl + reachR && off < reachR + 0.4);
      var threat = (n.state === 'chase' && (!n.herb || n.angry > 0)) || dist2(n.x, n.z, p.x, p.z) < bodyR(n) + bodyR(p) + 1.5;
      n.holder.visible = !n.far && !(block && !threat);
      setGhost(n, block && threat && !n.far);
      var ol = far < 38 && !n.ghost;
      if (ol !== n.olOn) { n.olOn = ol; n.ols.forEach(function (o) { o.visible = ol; }); }
    }

    // ---------- 每一格：世界 ----------
    function updateWorld(dt, t) {
      bushes.forEach(function (b) { if (b.n < 7) { b.grow += dt; if (b.grow > 14) { b.grow = 0; b.n++; drawBerries(); } } });
      meats.forEach(function (m, i) { if (!m.on && m.t > 0) { m.t -= dt; if (m.t <= 0) placeMeat(m, i >= 16 && P.stage >= 1); } });
      if (!P.herb) drawMeats(t);
      golds.concat(eggs, stars).forEach(function (g) {
        g.t += dt; g.m.rotation.y = g.t * 1.6;
        g.m.position.y = groundH(g.x, g.z) + (g.kind === 'egg' ? 0.55 : 1.1) + Math.sin(g.t * 2.5) * (g.kind === 'egg' ? 0.03 : 0.18);
      });
      if (P.herb && P.stage >= 1 && golds.length < 2 && Math.random() < dt * 0.05) addPickup(golds, goldFruit(), 'gold');
      var nearThorn = false;
      if (P.stage >= 2) thorns.forEach(function (th) { if (dist2(P.x, P.z, th.x, th.z) < 5) nearThorn = true; });
      var tk = nearThorn ? (Math.sin(t * 10) + 1) / 2 : 0;
      thornInst.material.emissive.setRGB(0.7 * tk, 0.05 * tk, 0.05 * tk); thornBaseInst.material.emissive = thornBaseInst.material.emissive || new THREE.Color();
      if (thornBaseInst.material.emissive) thornBaseInst.material.emissive.setRGB(0.45 * tk, 0, 0);
      fishList.forEach(function (f) {
        f.t -= dt;
        if (f.t <= 0 && f.t > -0.8) {
          var k = -f.t / 0.8; f.g.visible = true;
          f.g.position.set(f.p.x + (k - 0.5) * 2.4, -0.3 + Math.sin(k * PI) * 1.6, f.p.z);
          f.g.rotation.set(0, PI / 2, (k - 0.5) * 2);
        } else if (f.t <= -0.8) { f.g.visible = false; f.t = 3 + Math.random() * 5; }
      });
      var cl = clouds.userData.list, ci = 0;
      cl.forEach(function (c) {
        c.x += dt * 0.8; if (c.x > 90) c.x = -90;
        for (var k = 0; k < 3; k++) setInst(clouds, ci++, c.x + (k - 1) * c.s * 0.9, c.y + (k === 1 ? c.s * 0.3 : 0), c.z, c.s * (k === 1 ? 1.2 : 0.9), c.s * 0.6, c.s, 0);
      });
      clouds.instanceMatrix.needsUpdate = true;
      // 第 4 關：天黑、螢火蟲、火山石
      night = GG.clamp(night + (nightT - night) * dt * 0.6, 0, 1);
      hemi.intensity = 0.62 - night * 0.4; sun.intensity = 0.85 - night * 0.55; rim.intensity = 0.35 + night * 0.4;
      sun.color.copy(sunCol).lerp(moonCol, night); moon.material.opacity = night;
      var fc = fogCol.clone().lerp(hexc('#3a3570'), night);
      scene.fog.color.copy(fc); scene.background.copy(fc);
      skyMat.color.setRGB(1 - night * 0.7, 1 - night * 0.65, 1 - night * 0.4);
      fireflies.material.opacity = night * 0.9; fireflies.position.set(P.x, groundH(P.x, P.z), P.z);
      if (P.stage >= 3) {
        if (rocksFall.length < 2 && Math.random() < dt * 0.45 && P.faintT <= 0) {
          var a = camYaw + (Math.random() - 0.5) * 2.44, r = 2 + Math.random() * 4, x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r, clear = true;
          var sp0 = toScreen(new V3(x, groundH(x, z), z));
          if (!sp0.front || padHit(sp0.x, sp0.y, 80) || sp0.y < 110) clear = false;
          for (var oi = 0; oi < obstacles.length; oi++) if (dist2(x, z, obstacles[oi].x, obstacles[oi].z) < obstacles[oi].r + 2) clear = false;
          if (clear && nearPond(x, z).d > 0.5) {
            var ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 32), new THREE.MeshBasicMaterial({ color: hexc('#ff3b2f'), transparent: true, opacity: 0.9, depthWrite: false }));
            ring.rotation.x = -PI / 2; ring.position.set(x, groundH(x, z) + 0.08, z); scene.add(ring);
            var shd = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
            shd.rotation.x = -PI / 2; shd.position.set(x, groundH(x, z) + 0.07, z); scene.add(shd);
            var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), new THREE.MeshLambertMaterial({ color: hexc('#5a3a2a'), emissive: hexc('#ff4a10') }));
            rock.position.set(x, groundH(x, z) + 11, z); scene.add(rock);
            var trail = [];
            for (var ti = 0; ti < 5; ti++) {
              var tm = new THREE.Mesh(new THREE.SphereGeometry(0.55 - ti * 0.08, 10, 8), new THREE.MeshBasicMaterial({ color: hexc(ti < 2 ? '#ffd23f' : '#ff7a2a'), transparent: true, opacity: 0.75 - ti * 0.13, depthWrite: false }));
              scene.add(tm); trail.push(tm);
            }
            rocksFall.push({ x: x, z: z, t: 0, ring: ring, rock: rock, shd: shd, trail: trail });
          }
        }
      }
      for (var i = rocksFall.length - 1; i >= 0; i--) {
        var rf = rocksFall[i]; rf.t += dt;
        rf.ring.scale.setScalar(1 + Math.sin(rf.t * 12) * 0.08);
        var fallK = GG.clamp((rf.t - 0.4) / 1.3, 0, 1), gy = groundH(rf.x, rf.z);
        rf.rock.position.y = gy + 11 * (1 - fallK * fallK) + 0.4; rf.rock.rotation.x += dt * 5;
        rf.trail.forEach(function (tm, k) { tm.position.set(rf.x, rf.rock.position.y + (k + 1) * 0.55 * (0.4 + fallK), rf.z); tm.visible = fallK > 0.02; });
        rf.shd.scale.setScalar(0.25 + fallK * 0.85); rf.shd.material.opacity = 0.15 + fallK * 0.4;
        if (fallK >= 1) {
          if (dist2(P.x, P.z, rf.x, rf.z) < 1.7 + bodyR(P) * 0.5 && !P.air) hurtPlayer(14, rf.x, rf.z);
          GG.sfx('boom'); scene.remove(rf.ring); scene.remove(rf.rock); scene.remove(rf.shd);
          rf.trail.forEach(function (tm) { scene.remove(tm); });
          rocksFall.splice(i, 1);
        }
      }
      for (i = effects.length - 1; i >= 0; i--) {
        var e = effects[i]; e.t += dt;
        var k2 = GG.clamp(e.t / e.life, 0, 1);
        e.m.visible = e.t > 0; e.m.scale.setScalar(1 + k2 * 9); e.m.material.opacity = 0.8 * (1 - k2);
        if (e.t >= e.life) { scene.remove(e.m); effects.splice(i, 1); }
      }
    }
    function updateCam(dt) {
      var s = P.scale, size = P.d.hipY * s;
      var dist = 3.4 + size * 4.4, hgt = 1.4 + size * 2.2, side = dist * 0.42; // 往側邊偏約 23°：看得到頭和身體側面
      camLook.set(P.x, P.y + size * 1.1, P.z);
      var ox = -Math.sin(camYaw) * dist - Math.cos(camYaw) * side, oz = -Math.cos(camYaw) * dist + Math.sin(camYaw) * side;
      var cx = P.x + ox, cz = P.z + oz;
      // 樹擋在鏡頭和恐龍之間（或鏡頭鑽進樹裡）：那棵樹縮小讓開，離開後再長回來
      var ol = Math.sqrt(ox * ox + oz * oz), ux = ox / ol, uz = oz / ol, moved = false;
      treeList.forEach(function (t) {
        var bx = t.x - P.x, bz = t.z - P.z, along = bx * ux + bz * uz, off = Math.abs(bx * uz - bz * ux), cr = 1.9 * t.s;
        var block = (along > 0.2 && along < ol + cr && off < cr) || dist2(t.x, t.z, camPos.x, camPos.z) < cr + 3;
        // 投影到畫面上很大（樹冠半徑超過畫面高度的 22%，約佔畫面 15%）的近樹也縮小
        if (!block) {
          var cd = dist2(t.x, t.z, camPos.x, camPos.z);
          if (cd < 14) {
            var rpx = (1.7 * t.s) / Math.max(0.5, cd) * (H / (2 * Math.tan(cam.fov * PI / 360)));
            if (rpx > H * 0.22) { var sp = toScreen(new V3(t.x, t.y + 2.6 * t.s, t.z)); if (sp.front && sp.x > -rpx && sp.x < W + rpx) block = true; }
          }
        }
        var target = block ? 0 : 1;
        if (t.vis === target) return;
        t.vis += (target - t.vis) * Math.min(1, dt * 9);
        if (Math.abs(t.vis - target) < 0.02) t.vis = target;
        placeTree(t); moved = true;
      });
      if (moved) { TM.trunk.instanceMatrix.needsUpdate = true; TM.blob.instanceMatrix.needsUpdate = true; TM.cone.instanceMatrix.needsUpdate = true; }
      TMP.set(cx, Math.max(groundH(cx, cz) + 0.8, camLook.y + hgt), cz);
      camPos.lerp(TMP, Math.min(1, dt * 5));
      cam.position.copy(camPos); cam.lookAt(camLook);
    }

    // ---------- 選恐龍畫面 ----------
    var sel = { scene: null, cam: null, kind: 'TRex', cache: {}, t: 0, rects: [], start: null, ring: null, thumbs: {} };
    function buildSelect() {
      var s = sel.scene = new THREE.Scene();
      var bc = document.createElement('canvas'); bc.width = bc.height = 256;
      var g = bc.getContext('2d'), gr = g.createRadialGradient(128, 110, 10, 128, 128, 180);
      gr.addColorStop(0, '#3b7ce6'); gr.addColorStop(0.55, '#1b4aa8'); gr.addColorStop(1, '#0c2160');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      var tex = new THREE.CanvasTexture(bc); tex.encoding = THREE.sRGBEncoding; s.background = tex;
      lights(s);
      var ped = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.3, 48), lam('#16357e')); ped.position.y = -0.15; s.add(ped);
      sel.ring = new THREE.Group();
      [[1.9, 2.15, '#6ff4ff', 0.9], [2.4, 2.5, '#bff9ff', 0.6], [1.2, 1.3, '#6ff4ff', 0.5]].forEach(function (r) {
        var m = new THREE.Mesh(new THREE.RingGeometry(r[0], r[1], 64), new THREE.MeshBasicMaterial({ color: hexc(r[2]), transparent: true, opacity: r[3] }));
        m.rotation.x = -PI / 2; m.position.y = 0.02; sel.ring.add(m);
      });
      s.add(sel.ring);
      sel.cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    }
    function selDino(kind) {
      if (!sel.cache[kind]) {
        var d = DINO.build(DINO.SPECIES[kind]); DINO.merge(d); DINO.outline(d.group, 0.055);
        var g = new THREE.Group(); g.add(d.group);
        d.group.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(d.group), size = box.getSize(new V3()), c = box.getCenter(new V3());
        var k = 3.2 / Math.max(size.y * 1.15, size.z * 0.62);
        g.scale.setScalar(k); g.userData.cz = -c.z * k; g.userData.h = size.y * k; g.userData.len = size.z * k;
        sel.cache[kind] = { g: g, rig: new DINO.Rig(d) };
      }
      return sel.cache[kind];
    }
    function selLayout() {
      var land = W > H * 1.05, rects = [], i, cw, ch;
      var top = 76;
      if (land) {
        cw = GG.clamp(W * 0.25, 200, 300); ch = Math.min(70, (H - top - 30) / 6 - 8);
        for (i = 0; i < 6; i++) rects.push({ x: 18, y: top + i * (ch + 8), w: cw, h: ch, k: DINO.ORDER[i] });
        sel.stats = { x: W - cw - 18, y: top, w: cw, h: Math.min(340, H - top - 120) };
        sel.start = { x: W / 2 - 130, y: H - 96, w: 260, h: 74 };
        sel.view = { cx: W / 2, cy: (top + H - 110) / 2, h: H - top - 120, w: W - 2 * (cw + 18) - 40 };
      } else {
        cw = (W - 18 * 2 - 10 * 2) / 3; ch = 62;
        for (i = 0; i < 6; i++) rects.push({ x: 18 + (i % 3) * (cw + 10), y: top + Math.floor(i / 3) * (ch + 10), w: cw, h: ch, k: DINO.ORDER[i] });
        var sy = H - 96 - 275;
        sel.stats = { x: 18, y: sy, w: W - 36, h: 265 };
        sel.start = { x: W / 2 - 130, y: H - 92, w: 260, h: 72 };
        sel.view = { cx: W / 2, cy: (top + ch * 2 + 20 + sy) / 2, h: sy - top - ch * 2 - 30, w: W - 60 };
      }
      sel.rects = rects;
    }
    function renderSelect(dt) {
      sel.t += dt;
      var e = selDino(sel.kind);
      if (e.g.parent !== sel.scene) { Object.keys(sel.cache).forEach(function (k) { sel.scene.remove(sel.cache[k].g); }); sel.scene.add(e.g); }
      e.g.rotation.y = 0.9 + Math.sin(sel.t * 0.5) * 0.5;
      e.g.position.set(0, 0, 0);
      e.rig.setMove(0); e.rig.update(dt, false, 0);
      sel.ring.rotation.y = sel.t * 0.4; sel.ring.children[1].scale.setScalar(1 + Math.sin(sel.t * 2) * 0.03);
      // 鏡頭：恐龍放在畫面中間空著的區域
      var v = sel.view, c = sel.cam;
      c.aspect = W / H;
      var tanH = 2 * Math.tan(c.fov * PI / 360), len = e.g.userData.len || 4;
      var dist = Math.max(3.6 / tanH * (H / Math.max(120, v.h)), len * 1.12 / (tanH * c.aspect) * (W / Math.max(160, v.w)));
      c.position.set(0, 2.2 + dist * 0.18, dist); c.lookAt(0, 1.45, 0);
      c.setViewOffset(W, H, W / 2 - v.cx, H / 2 - v.cy, W, H);
      renderer.render(sel.scene, c);
    }
    function drawBar5(ctx, x, y, w, n, color) {
      var sw = (w - 4 * 4) / 5;
      for (var i = 0; i < 5; i++) {
        ctx.fillStyle = i < n ? color : 'rgba(255,255,255,0.18)';
        GG.rr(ctx, x + i * (sw + 4), y, sw, 14, 4); ctx.fill();
      }
    }
    function drawSelectUI(ctx) {
      GG.text(ctx, '選擇你的恐龍', W / 2, 40, Math.min(40, W * 0.06), '#7ff0ff', 'center', true);
      sel.rects.forEach(function (r) {
        var on = r.k === sel.kind, mt = DINO.SPECIES[r.k].meta;
        ctx.fillStyle = on ? 'rgba(255,214,60,0.92)' : 'rgba(20,50,120,0.75)';
        GG.rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = on ? '#fff6c0' : 'rgba(110,240,255,0.8)'; ctx.stroke();
        var th = sel.thumbs[r.k];
        if (th) ctx.drawImage(th, r.x + 4, r.y + 2, (r.h - 4) * 4 / 3, r.h - 4);
        GG.text(ctx, mt.zh, r.x + r.w * (th ? 0.56 : 0.42), r.y + r.h / 2, Math.min(28, r.h * 0.42), on ? GG.INK : '#ffffff', 'center', !on);
        icon(ctx, mt.diet === 'herb' ? 'leaf' : 'meat', r.x + r.w - r.h * 0.45, r.y + r.h / 2, r.h * 0.5);
      });
      var s = sel.stats, mt = DINO.SPECIES[sel.kind].meta, x = s.x + 16, y = s.y + 16, fs = 22;
      ctx.fillStyle = 'rgba(12,32,90,0.72)'; GG.rr(ctx, s.x, s.y, s.w, s.h, 16); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(110,240,255,0.8)'; ctx.stroke();
      GG.text(ctx, mt.zh, x, y + 14, 30, '#ffe14d', 'left', true);
      var bw = s.w - 32 - 70, by = y + 52;
      [['體力', mt.hp, '#ff6b7d'], ['力氣', mt.atk, '#ffb23d'], ['速度', mt.spd, '#6fe3ff']].forEach(function (r, i) {
        GG.text(ctx, r[0], x, by + i * 34 + 7, fs, '#ffffff', 'left', true);
        drawBar5(ctx, x + 66, by + i * 34, bw, r[1], r[2]);
      });
      var dy = by + 3 * 34 + 10;
      icon(ctx, mt.diet === 'herb' ? 'leaf' : 'meat', x + 14, dy + 12, 28);
      GG.text(ctx, mt.diet === 'herb' ? '草食：吃果子' : '肉食：吃肉、抓魚', x + 36, dy + 12, 20, mt.diet === 'herb' ? '#9dff8a' : '#ffb08a', 'left', true);
      wrapText(ctx, mt.tip, x, dy + 44, s.w - 32, 18, '#d8f6ff');
      // 開始鈕
      var b = sel.start, pulse = 1 + Math.sin(sel.t * 4) * 0.03;
      ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; GG.rr(ctx, -b.w / 2, -b.h / 2 + 6, b.w, b.h, 22); ctx.fill();
      var gr = ctx.createLinearGradient(0, -b.h / 2, 0, b.h / 2); gr.addColorStop(0, '#ffcf4a'); gr.addColorStop(1, '#ff8a1f');
      ctx.fillStyle = gr; GG.rr(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 22); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = GG.INK; ctx.stroke();
      GG.text(ctx, '開始冒險！', 0, 0, 34, '#ffffff', 'center', true);
      ctx.restore();
    }
    function wrapText(ctx, s, x, y, w, size, color) {
      ctx.font = '900 ' + size + 'px ' + GG.FONT;
      var line = '', ly = y;
      for (var i = 0; i < s.length; i++) {
        var t = line + s[i];
        if (ctx.measureText(t).width > w && line) { GG.text(ctx, line, x, ly, size, color, 'left', true); line = s[i]; ly += size * 1.4; }
        else line = t;
      }
      if (line) GG.text(ctx, line, x, ly, size, color, 'left', true);
    }

    // ---------- 成長條（上方中央）：寶寶→少年→成年→首領，四個由小到大的恐龍剪影 ----------
    function silhouette(ctx, x, y, s, fill) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s / 40, s / 40);
      ctx.fillStyle = fill; ctx.strokeStyle = GG.INK; ctx.lineWidth = 3.2; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-19, 3); ctx.quadraticCurveTo(-6, -15, 9, -6);
      ctx.quadraticCurveTo(13, -16, 19, -18); ctx.quadraticCurveTo(27, -20, 27, -14); ctx.quadraticCurveTo(23, -10, 16, -9);
      ctx.quadraticCurveTo(15, 1, 11, 6);
      ctx.lineTo(11, 14); ctx.lineTo(6, 14); ctx.lineTo(5, 7);
      ctx.lineTo(-6, 7); ctx.lineTo(-6, 14); ctx.lineTo(-11, 14); ctx.lineTo(-12, 6);
      ctx.quadraticCurveTo(-25, 6, -35, -1); ctx.quadraticCurveTo(-26, -1, -19, 3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = GG.INK; ctx.beginPath(); ctx.arc(21, -15, 1.8, 0, PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawGrowth(ctx, p, t) {
      var gw = GG.clamp(W * 0.4, 250, 440), x0 = W / 2 - gw / 2, y0 = 34;
      ctx.fillStyle = 'rgba(20,16,50,0.65)'; GG.rr(ctx, x0 - 28, 6, gw + 64, 70, 22); ctx.fill();
      var k = (p.stage + GG.clamp(p.growth / 100, 0, 1)) / 4;
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; GG.rr(ctx, x0, y0 - 7, gw, 14, 7); ctx.fill();
      var gr = ctx.createLinearGradient(x0, 0, x0 + gw, 0); gr.addColorStop(0, '#ffe66b'); gr.addColorStop(1, '#ffb21f');
      ctx.fillStyle = gr; GG.rr(ctx, x0, y0 - 7, Math.max(14, gw * k), 14, 7); ctx.fill();
      for (var i = 0; i < 4; i++) {
        var sx = x0 + gw * i / 4, cur = i === p.stage, done = i < p.stage, sz = 20 + i * 6 + (cur ? 6 + Math.sin(t * 5) * 2 : 0);
        silhouette(ctx, sx + 4, y0 - 4, sz, cur ? '#ffd23f' : done ? '#ffffff' : 'rgba(170,170,200,0.75)');
      }
      icon(ctx, 'star', x0 + gw + 6, y0, 30);
      GG.text(ctx, '第 ' + (p.stage + 1) + ' 關：' + STAGES[p.stage].name + (p.stage < 3 ? ' → ' + STAGES[p.stage + 1].name : ' → 長大就贏了！'), W / 2, y0 + 26, 18, '#ffe14d', 'center', true);
    }
    // 選恐龍卡片用的小圖：每隻恐龍先畫一張 3D 小圖存起來
    function makeThumbs() {
      var TW = 240, TH = 180, rt = new THREE.WebGLRenderTarget(TW, TH);
      rt.texture.encoding = THREE.sRGBEncoding;
      var tsc = new THREE.Scene(); lights(tsc);
      var tc = new THREE.PerspectiveCamera(30, TW / TH, 0.1, 100), px = new Uint8Array(TW * TH * 4);
      DINO.ORDER.forEach(function (k) {
        var e = selDino(k);
        tsc.add(e.g); e.g.rotation.y = 1.15; e.rig.update(0.016, false, 0);
        var len = e.g.userData.len || 4, d = Math.max(3.6, len) * 1.15 / (2 * Math.tan(15 * PI / 180));
        tc.position.set(0, 1.8 + d * 0.12, d); tc.lookAt(0, 1.45, 0);
        renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(tsc, tc);
        renderer.readRenderTargetPixels(rt, 0, 0, TW, TH, px);
        var c = document.createElement('canvas'); c.width = TW; c.height = TH;
        var g = c.getContext('2d'), id = g.createImageData(TW, TH), row = TW * 4;
        for (var y = 0; y < TH; y++) id.data.set(px.subarray((TH - 1 - y) * row, (TH - y) * row), y * row);
        g.putImageData(id, 0, 0); sel.thumbs[k] = c;
        tsc.remove(e.g);
      });
      renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
      rt.dispose();
    }

    // ---------- 小圖示（向量畫，不用 emoji） ----------
    function icon(ctx, name, x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
      var h = s / 2;
      ctx.lineWidth = Math.max(2, s * 0.09); ctx.strokeStyle = GG.INK;
      if (name === 'heart') {
        ctx.fillStyle = '#ff5c6c'; ctx.beginPath(); ctx.moveTo(0, h * 0.8);
        ctx.bezierCurveTo(-h * 1.2, -h * 0.1, -h * 0.6, -h * 1.05, 0, -h * 0.35);
        ctx.bezierCurveTo(h * 0.6, -h * 1.05, h * 1.2, -h * 0.1, 0, h * 0.8); ctx.fill(); ctx.stroke();
      } else if (name === 'leaf') {
        ctx.rotate(-0.6); ctx.fillStyle = '#5fd35a'; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(0, 0, h * 0.95, h * 0.55, 0, 0, PI * 2) : ctx.arc(0, 0, h * 0.7, 0, PI * 2);
        ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-h * 0.9, 0); ctx.lineTo(h * 0.8, 0); ctx.stroke();
      } else if (name === 'meat') {
        ctx.rotate(-0.7); ctx.fillStyle = '#f4ecd8';
        ctx.beginPath(); ctx.arc(-h * 0.85, -h * 0.18, h * 0.22, 0, PI * 2); ctx.arc(-h * 0.85, h * 0.18, h * 0.22, 0, PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillRect(-h * 0.85, -h * 0.12, h * 0.6, h * 0.24); ctx.strokeRect(-h * 0.85, -h * 0.12, h * 0.6, h * 0.24);
        ctx.fillStyle = '#c0643a'; ctx.beginPath(); ctx.ellipse ? ctx.ellipse(h * 0.2, 0, h * 0.62, h * 0.5, 0, 0, PI * 2) : ctx.arc(h * 0.2, 0, h * 0.55, 0, PI * 2); ctx.fill(); ctx.stroke();
      } else if (name === 'drop') {
        ctx.fillStyle = '#4fb6ff'; ctx.beginPath(); ctx.moveTo(0, -h * 0.95);
        ctx.bezierCurveTo(h * 0.5, -h * 0.25, h * 0.75, h * 0.15, h * 0.7, h * 0.35);
        ctx.arc(0, h * 0.35, h * 0.7, 0, PI); ctx.bezierCurveTo(-h * 0.75, h * 0.15, -h * 0.5, -h * 0.25, 0, -h * 0.95); ctx.fill(); ctx.stroke();
      } else if (name === 'star') {
        ctx.fillStyle = '#ffd23f'; ctx.beginPath();
        for (var i = 0; i < 10; i++) { var r = i % 2 ? h * 0.42 : h, a = i / 10 * PI * 2 - PI / 2; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // ---------- 畫面上的字與提示（3D 位置投影到螢幕） ----------
    var floats = [];
    function floatAt(x, z, text, color) {
      var y = groundH(x, z) + (P ? P.d.hipY * P.scale * 2.2 : 2);
      floats.push({ p: new V3(x, y, z), text: text, color: color, t: 0 });
    }
    function toScreen(v) {
      TMP.copy(v).project(cam);
      return { x: (TMP.x + 1) / 2 * W, y: (1 - TMP.y) / 2 * H, front: TMP.z < 1 };
    }
    function drawStarsAt(ctx, o, t) {
      var wp = headPos(o, new V3()); wp.y += 0.9 * o.d.hipY * o.scale;
      var sp = toScreen(wp); if (!sp.front) return;
      for (var i = 0; i < 3; i++) {
        var a = t * 4 + i * PI * 2 / 3;
        icon(ctx, 'star', sp.x + Math.cos(a) * 36, sp.y + Math.sin(a) * 12, 28);
      }
      var zz = (t * 0.8) % 1;
      ctx.globalAlpha = 1 - zz; GG.text(ctx, 'Zzz', sp.x + 40 + zz * 16, sp.y - 28 - zz * 22, 22, '#ffffff', 'center', true); ctx.globalAlpha = 1;
    }
    // 畫面上這個點是不是在搖桿或按鍵上（m＝外擴的距離）
    function padHit(x, y, m) {
      var ids = ['stick', 'atk', 'jump', 'eat'];
      for (var i = 0; i < ids.length; i++) {
        var b = GG.button(ids[i]); if (!b) continue;
        if (b.stick) { if (dist2(x, y, b.cx, b.cy) < b.R * 1.4 + m) return true; }
        else if (x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m) return true;
      }
      return false;
    }
    function bar(ctx, x, y, w, v, color, ic) {
      icon(ctx, ic, x + 13, y + 9, 24);
      ctx.fillStyle = 'rgba(20,16,50,0.55)'; GG.rr(ctx, x + 30, y, w, 18, 9); ctx.fill();
      var low = v < 0.3;
      ctx.fillStyle = low && Math.floor(Date.now() / 250) % 2 ? '#ffffff' : color;
      if (v > 0.01) { GG.rr(ctx, x + 32, y + 2, (w - 4) * GG.clamp(v, 0, 1), 14, 7); ctx.fill(); }
    }
    function drawHud(ctx) {
      var p = P, t = sel.t, bw = GG.clamp(W * 0.16, 110, 180), x = 14, y = 14;
      ctx.fillStyle = 'rgba(20,16,50,0.65)'; GG.rr(ctx, x - 8, y - 8, bw + 52, 3 * 26 + 10, 18); ctx.fill();
      bar(ctx, x, y, bw, p.hp / p.maxHp, '#ff5c6c', 'heart');
      bar(ctx, x, y + 26, bw, p.food / 100, p.herb ? '#5fd35a' : '#e8854a', p.herb ? 'leaf' : 'meat');
      bar(ctx, x, y + 52, bw, p.water / 100, '#4fb6ff', 'drop');
      drawGrowth(ctx, p, t);
      GG.lives(ctx, p.lives, 3, W - 3 * 38 - 30, 30, 30);
      // 肚子餓／口渴：畫箭頭指向最近的食物或水
      var need = p.faintT > 0 ? null : p.water < 35 ? 'water' : p.food < 35 ? 'food' : null;
      if (need) {
        var tx, tz, bd = 1e9;
        if (need === 'water') PONDS.forEach(function (q) { var d = dist2(p.x, p.z, q.x, q.z); if (d < bd) { bd = d; tx = q.x; tz = q.z; } });
        else if (p.herb) bushes.forEach(function (b) { var d = dist2(p.x, p.z, b.x, b.z); if (b.n > 0 && d < bd) { bd = d; tx = b.x; tz = b.z; } });
        else meats.forEach(function (m) { var d = dist2(p.x, p.z, m.x, m.z); if (m.on && d < bd) { bd = d; tx = m.x; tz = m.z; } });
        if (tx !== undefined) {
          var a = Math.atan2(tx - p.x, tz - p.z) - camYaw, cx = W / 2, cy = H * 0.42, rr = Math.min(W, H) * 0.3;
          var ax = cx - Math.sin(a) * rr, ay = cy - Math.cos(a) * rr;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(-a);
          ctx.fillStyle = need === 'water' ? '#4fb6ff' : '#ffb23d'; ctx.strokeStyle = GG.INK; ctx.lineWidth = 4;
          var bob = Math.sin(t * 6) * 6;
          ctx.beginPath(); ctx.moveTo(0, -30 - bob); ctx.lineTo(22, 4 - bob); ctx.lineTo(8, 4 - bob); ctx.lineTo(8, 26 - bob); ctx.lineTo(-8, 26 - bob); ctx.lineTo(-8, 4 - bob); ctx.lineTo(-22, 4 - bob); ctx.closePath();
          ctx.fill(); ctx.stroke(); ctx.restore();
          var msg = need === 'water' ? '口渴了！去水池喝水' : '肚子餓了！去找吃的', my = 124;
          ctx.font = '900 26px ' + GG.FONT;
          var mw = ctx.measureText(msg).width + 76;
          ctx.fillStyle = 'rgba(20,16,50,0.65)'; GG.rr(ctx, W / 2 - mw / 2, my - 24, mw, 48, 24); ctx.fill();
          icon(ctx, need === 'water' ? 'drop' : p.herb ? 'leaf' : 'meat', W / 2 - mw / 2 + 30, my, 30);
          GG.text(ctx, msg, W / 2 + 18, my, 26, '#ffffff', 'center', true);
        }
      }
      // 吃／喝鈕：附近有東西就發亮，字也跟著換
      var et = eatTarget(), eb = GG.button('eat');
      if (eb) {
        eb.label = !et ? '吃' : et.type === 'water' ? '喝' : et.type === 'fish' ? '抓魚' : '吃';
        eb.color = et ? '#43c76a' : '#7f9a88';
        if (!eb.base) eb.base = { cx: eb.x + eb.w / 2, cy: eb.y + eb.h / 2, r: eb.w / 2 };
        var ab = GG.button('atk'), er = et && ab ? ab.w / 2 : eb.base.r;
        eb.x = eb.base.cx - er; eb.y = eb.base.cy - er; eb.w = eb.h = er * 2; eb.fs = er * 0.5;
      }
      // 掠食者在追你：牠頭上出現紅色「!」，畫面邊緣閃紅光
      var danger = false;
      npcs.forEach(function (n) {
        if (n.state !== 'chase' || n.far) return;
        if (!n.herb || n.angry > 0) danger = true;
        var sp = toScreen(headPos(n, new V3()).add(TMP.set(0, 1.2 * n.scale, 0)));
        if (sp.front) {
          var bb = Math.sin(t * 10) * 4;
          ctx.fillStyle = '#ff3b3b'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(sp.x, sp.y - 6 + bb, 20, 0, PI * 2); ctx.fill(); ctx.stroke();
          GG.text(ctx, '!', sp.x, sp.y - 6 + bb, 30, '#ffffff', 'center', false);
        }
      });
      if (danger) {
        var al = 0.25 + Math.sin(t * 8) * 0.12, gw = Math.min(W, H) * 0.12;
        var gl = ctx.createLinearGradient(0, 0, gw, 0); gl.addColorStop(0, 'rgba(255,40,40,' + al + ')'); gl.addColorStop(1, 'rgba(255,40,40,0)');
        ctx.fillStyle = gl; ctx.fillRect(0, 0, gw, H);
        var gr2 = ctx.createLinearGradient(W, 0, W - gw, 0); gr2.addColorStop(0, 'rgba(255,40,40,' + al + ')'); gr2.addColorStop(1, 'rgba(255,40,40,0)');
        ctx.fillStyle = gr2; ctx.fillRect(W - gw, 0, gw, H);
      }
      // 頭上的暈眩星星、血條
      if (p.faintT > 0) drawStarsAt(ctx, p, t);
      npcs.forEach(function (n) {
        if (n.far) return;
        if (n.state === 'faint') drawStarsAt(ctx, n, t);
        else if (n.hpShow > 0) {
          var sp = toScreen(headPos(n, new V3()).add(TMP.set(0, 0.8 * n.scale, 0)));
          if (sp.front) { ctx.fillStyle = 'rgba(20,16,50,0.6)'; GG.rr(ctx, sp.x - 32, sp.y - 30, 64, 10, 5); ctx.fill(); ctx.fillStyle = '#ff5c6c'; GG.rr(ctx, sp.x - 31, sp.y - 29, 62 * n.hp / n.maxHp, 8, 4); ctx.fill(); }
        }
      });
      for (var i = floats.length - 1; i >= 0; i--) {
        var f = floats[i], s = toScreen(f.p);
        if (f.t > 1.4) { floats.splice(i, 1); continue; }
        if (!s.front) continue;
        ctx.globalAlpha = Math.min(1, (1.4 - f.t) * 2);
        GG.text(ctx, f.text, s.x, Math.max(150, s.y - f.t * 50), 26, f.color, 'center', true);
        ctx.globalAlpha = 1;
      }
      // 開局教學
      if (!moved && tHint < 8) {
        var st = GG.button('stick');
        if (st) { GG.hand(ctx, st.cx + Math.sin(t * 3) * st.R * 0.5, st.cy - st.R * 0.3, 70, true); GG.text(ctx, '用搖桿走路', st.cx, st.cy - st.R - 40, 24, '#fff', 'center', true); }
      }
    }
    function drawEatGlow(ctx) {
      var eb = GG.button('eat');
      if (!eb || !eatTarget()) return;
      var r = eb.w / 2 + 6 + Math.sin(sel.t * 6) * 4;
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,240,120,0.9)';
      ctx.beginPath(); ctx.arc(eb.x + eb.w / 2, eb.y + eb.h / 2, r, 0, PI * 2); ctx.stroke();
    }

    // ---------- 測試用 ----------
    GG.testLevel = function (n) {
      if (phase === 'select') startPlay(sel.kind);
      while (P.stage < n - 1) stageUp(true);
      night = nightT;
    };
    GG.testDino = { pick: function (k) { sel.kind = k; }, play: function (k) { startPlay(k || sel.kind); }, P: function () { return P; }, npcs: function () { return npcs; },
      feed: function () { P.food = 20; P.water = 20; }, moveTo: function (x, z) { P.x = x; P.z = z; },
      bushes: function () { return bushes; },
      // 把某種電腦恐龍放到玩家前方 d 公尺（截圖用）
      put: function (kind, d, side) {
        var n = npcs.filter(function (q) { return q.kind === kind; })[0]; if (!n) return false;
        n.x = P.x + Math.sin(camYaw) * d + Math.cos(camYaw) * (side || 0); n.z = P.z + Math.cos(camYaw) * d - Math.sin(camYaw) * (side || 0);
        n.yaw = Math.atan2(P.x - n.x, P.z - n.z); return true;
      },
      faint: function () { P.inv = 0; P.hp = 0.1; hurtPlayer(5, P.x + 1, P.z); },
      camYaw: function (v) { camYaw = v; P.yaw = v; } };

    var lastT = 0;
    GG.define({
      noHint: true,
      init: function () { makeRenderer(); if (noGL) return; buildWorld(); buildSelect(); makeThumbs(); },
      start: function (d) {
        d0 = d; phase = 'select'; sel.t = 0;
        if (noGL) return;
        if (P) { scene.remove(P.holder); P = null; }
        removeAllNpcs();
        selLayout(); setPad();
        lastT = performance.now();
      },
      resize: function (w, h) {
        W = w; H = h;
        if (noGL) return;
        if (renderer) { renderer.setPixelRatio(Math.min(GG.dpr, 1.5)); renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); }
        selLayout(); if (phase === 'play') setPad();
      },
      update: function (dt) {
        if (noGL) return true;
        sel.t += dt;
        if (phase !== 'play' || !P) return true;
        tHint += dt;
        updatePlayer(dt);
        if (GG.state() !== 'play') return true;
        for (var i = 0; i < npcs.length; i++) updateNpc(npcs[i], dt);
        updateWorld(dt, sel.t);
        floats.forEach(function (f) { f.t += dt; });
        updateCam(dt);
        return true;
      },
      draw: function (ctx) {
        if (noGL) { GG.bg(ctx, W, H, '#2e8b57', '#1b5e3a'); GG.text(ctx, '這台裝置不能顯示 3D 畫面', W / 2, H * 0.42, 30, '#ffffff', 'center', true); GG.text(ctx, '請換一台較新的平板再玩恐龍世界', W / 2, H * 0.52, 22, '#d8ffd8', 'center', true); return; }
        if (!renderer) return;
        if (phase === 'select') {
          var now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
          renderSelect(dt);
          drawSelectUI(ctx);
          return;
        }
        if (!P) return;
        renderer.render(scene, cam);
        drawHud(ctx);
      },
      drawTop: function (ctx) { if (phase === 'play' && P) drawEatGlow(ctx); },
      down: function (p) {
        if (noGL) return;
        if (phase === 'select') {
          for (var i = 0; i < sel.rects.length; i++) {
            var r = sel.rects[i];
            if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { if (sel.kind !== r.k) { sel.kind = r.k; GG.sfx('click'); } return; }
          }
          var b = sel.start;
          if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { GG.sfx('go'); startPlay(sel.kind); }
          return;
        }
        // 在畫面空白處左右拖曳：轉鏡頭
        this._drag = { x: p.x, yaw: camYaw };
      },
      move: function (p) { if (this._drag && phase === 'play') camYaw = this._drag.yaw - (p.x - this._drag.x) * 0.008; },
      up: function () { this._drag = null; },
      key: function (k) {
        if (phase !== 'play') return;
        if (k === ' ') doJump();
        else if (k === 'j' || k === 'J') doAttack();
        else if (k === 'k' || k === 'K' || k === 'e') doEat();
      }
    });
  }
})();
