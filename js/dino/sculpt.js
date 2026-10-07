/* 程式雕塑恐龍：沿著背脊曲線「放樣」出一整片平滑皮膚，四肢是粗管子，骨板／角／刺是附在骨頭上的零件。
 * 依參考圖的真實比例設定（單位：公尺，頭朝 +z、上方 +y）。
 * 只用 ES5 寫法，舊 iPad 也能跑。 */
(function () {
  var DINO = window.DINO = {};
  var V3 = THREE.Vector3;

  // ---- 小工具 ----
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cr(p0, p1, p2, p3, t) { // Catmull-Rom
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  // 依 z 取背脊表格的內插值（表格每列：[z, y, rx, rt, rb]）
  function sampler(tab) {
    return function (z) {
      var n = tab.length, i = 0;
      while (i < n - 2 && z > tab[i + 1][0]) i++;
      var a = tab[Math.max(0, i - 1)], b = tab[i], c = tab[i + 1], d = tab[Math.min(n - 1, i + 2)];
      var t = Math.max(0, Math.min(1, (z - b[0]) / (c[0] - b[0] || 1))), out = [z];
      for (var k = 1; k < b.length; k++) out.push(cr(a[k], b[k], c[k], d[k], t));
      return out;
    };
  }
  function hex(c) { return new THREE.Color(c).convertSRGBToLinear(); }

  // ---- 網格累積器：所有部位放進同一個 SkinnedMesh（一次繪製） ----
  function Builder() { this.P = []; this.C = []; this.SI = []; this.SW = []; this.I = []; this.OW = []; this.blend = []; }
  Builder.prototype.v = function (p, col, skin, ow) {
    this.P.push(p.x, p.y, p.z); this.C.push(col.r, col.g, col.b); this.OW.push(ow === undefined ? 1 : ow);
    var s = [0, 0, 0, 0], w = [0, 0, 0, 0];
    skin.forEach(function (e, k) { if (k < 4) { s[k] = e[0]; w[k] = e[1]; } });
    var sum = w[0] + w[1] + w[2] + w[3] || 1;
    this.SI.push(s[0], s[1], s[2], s[3]); this.SW.push(w[0] / sum, w[1] / sum, w[2] / sum, w[3] / sum);
    return this.P.length / 3 - 1;
  };
  Builder.prototype.tri = function (a, b, c) { this.I.push(a, b, c); };
  // 兩圈頂點之間縫成管子
  Builder.prototype.stitch = function (r0, r1) {
    var n = r0.length;
    for (var i = 0; i < n; i++) { var j = (i + 1) % n; this.tri(r0[i], r1[j], r1[i]); this.tri(r0[i], r0[j], r1[j]); }
  };
  Builder.prototype.cap = function (ring, center, flip) {
    var n = ring.length;
    for (var i = 0; i < n; i++) { var j = (i + 1) % n; if (flip) this.tri(center, ring[i], ring[j]); else this.tri(center, ring[j], ring[i]); }
  };
  Builder.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setAttribute('ow', new THREE.Float32BufferAttribute(this.OW, 1)); // 描邊粗細倍率（大腿根部淡出，才不會像接上去的管子）
    g.setIndex(this.I);
    g.computeVertexNormals();
    // 四肢根部：法線往身體表面的法線混過去，光影連續，接縫就看不出來
    var N = g.attributes.normal;
    this.blend.forEach(function (e) {
      var n = new THREE.Vector3(N.getX(e.i), N.getY(e.i), N.getZ(e.i)).lerp(e.n, e.w).normalize();
      N.setXYZ(e.i, n.x, n.y, n.z);
    });
    return g;
  };

  // ---- 建立一隻恐龍 ----
  DINO.build = function (spec) {
    var S = sampler(spec.spine), z0 = spec.spine[0][0], z1 = spec.spine[spec.spine.length - 1][0];
    var col = {}; Object.keys(spec.colors).forEach(function (k) { col[k] = hex(spec.colors[k]); });
    // 背脊上的骨頭（依 z 排序）
    var bones = [], byName = {};
    function addBone(name, pos, parentName) {
      var b = new THREE.Bone(); b.name = name;
      b.userData.world = pos.clone();
      var par = parentName ? byName[parentName] : null;
      b.position.copy(par ? pos.clone().sub(par.userData.world) : pos);
      if (par) par.add(b);
      bones.push(b); byName[name] = b;
      return bones.length - 1;
    }
    function axisAt(z) { var s = S(z); return new V3(0, s[1], z); }
    addBone('root', new V3(0, 0, 0), null);
    var hipZ = spec.bones.hips;
    addBone('hips', axisAt(hipZ), 'root');
    var chain = [{ name: 'hips', z: hipZ }];
    var prev = 'hips';
    spec.bones.front.forEach(function (e) { addBone(e[0], axisAt(e[1]), prev); chain.push({ name: e[0], z: e[1] }); prev = e[0]; });
    prev = 'hips';
    spec.bones.tail.forEach(function (e) { addBone(e[0], axisAt(e[1]), prev); chain.push({ name: e[0], z: e[1] }); prev = e[0]; });
    chain.sort(function (a, b) { return a.z - b.z; });
    function spineSkin(z) {
      if (z <= chain[0].z) return [[bones.indexOf(byName[chain[0].name]), 1]];
      for (var i = 0; i < chain.length - 1; i++) {
        if (z <= chain[i + 1].z) {
          var t = (z - chain[i].z) / (chain[i + 1].z - chain[i].z);
          return [[bones.indexOf(byName[chain[i].name]), 1 - t], [bones.indexOf(byName[chain[i + 1].name]), t]];
        }
      }
      return [[bones.indexOf(byName[chain[chain.length - 1].name]), 1]];
    }

    var B = new Builder(), SEG = spec.ring || 22, rings = [];
    // 背脊放樣：每圈的截面上半徑 rt、下半徑 rb（肚子），左右 rx
    var steps = spec.steps || 70;
    for (var i = 0; i <= steps; i++) {
      var z = lerp(z0, z1, i / steps), s = S(z), s2 = S(z + 0.02);
      var dy = (s2[1] - s[1]) / 0.02, up = new V3(0, 1, -dy).normalize();
      var ring = [], skin = spineSkin(z), center = new V3(0, s[1], z);
      for (var k = 0; k < SEG; k++) {
        var a = k / SEG * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        var ry = sa >= 0 ? s[3] : s[4];
        var p = center.clone().add(new V3(s[2] * ca, 0, 0)).add(up.clone().multiplyScalar(ry * sa));
        // 顏色：背深、腹淺、側面中間色；可加條紋
        var c = col.body.clone();
        if (sa < 0) c.lerp(col.belly, Math.min(1, -sa * 0.9) * 0.75);
        else c.multiplyScalar(1 - sa * 0.15);
        if (spec.stripes && sa > 0.2 && Math.sin(z * spec.stripes) > 0.4) c.multiplyScalar(0.8);
        if (spec.tint) c = spec.tint(c, z, sa, col) || c;
        ring.push(B.v(p, c, skin, Math.max(0.25, Math.min(1, Math.min(z - z0, z1 - z) / 0.25))));
      }
      rings.push({ idx: ring, z: z });
    }
    for (i = 0; i < rings.length - 1; i++) B.stitch(rings[i].idx, rings[i + 1].idx);
    var tipT = S(z0), tipH = S(z1);
    var tT = new V3(0, (S(z0 + 0.02)[1] - tipT[1]) / 0.02, 1).normalize(), tH = new V3(0, (tipH[1] - S(z1 - 0.02)[1]) / 0.02, 1).normalize();
    B.cap(rings[0].idx, B.v(new V3(0, tipT[1], z0).addScaledVector(tT, -0.02), col.body, spineSkin(z0)), true);
    B.cap(rings[rings.length - 1].idx, B.v(new V3(0, tipH[1], z1).addScaledVector(tH, 0.008), col.body, spineSkin(z1)), false);

    // 四肢：沿著關節點用平滑曲線放樣（半徑也平滑內插），切線連續所以膝蓋不會折出縫；腳底微微外擴、平底
    var footList = [];
    function crV(p0, p1, p2, p3, f) { return new V3(cr(p0.x, p1.x, p2.x, p3.x, f), cr(p0.y, p1.y, p2.y, p3.y, f), cr(p0.z, p1.z, p2.z, p3.z, f)); }
    (spec.legs || []).forEach(function (leg) {
      [-1, 1].forEach(function (side) {
        var sfx = side < 0 ? 'R' : 'L', names = leg.joints.map(function (j) { return leg.name + j + sfx; });
        var pts = leg.pts.map(function (q) { return new V3(q[0] * side, q[1], q[2]); });
        names.forEach(function (nm, j) { addBone(nm, pts[j], j === 0 ? leg.parent : names[j - 1]); });
        var segN = 10, samp = [], n = pts.length;
        for (var j = 0; j < n - 1; j++) {
          for (var t = (j === 0 ? 0 : 1); t <= segN; t++) {
            var f = t / segN, i0 = Math.max(0, j - 1), i3 = Math.min(n - 1, j + 2);
            var r = Math.max(leg.r[j + 1] * 0.8, cr(leg.r[i0], leg.r[j], leg.r[j + 1], leg.r[i3], f));
            var skin = [[bones.indexOf(byName[names[j]]), 1 - f * 0.5], [bones.indexOf(byName[names[j + 1]]), f * 0.5]];
            if (j === n - 2 && f > 0.4) skin = [[bones.indexOf(byName[names[j + 1]]), 1]];
            samp.push({ c: crV(pts[i0], pts[j], pts[j + 1], pts[i3], f), r: r, skin: skin, last: j === n - 2 ? f : 0 });
          }
        }
        var lr = [], prevAx = new V3(1, 0, 0);
        samp.forEach(function (sp, q) {
          var tq = q / (samp.length - 1), ow = Math.max(0, Math.min(1, (tq - 0.08) / 0.3)) * Math.max(0.45, Math.min(1, sp.r / 0.12));
          var a0 = samp[Math.max(0, q - 1)].c, a1 = samp[Math.min(samp.length - 1, q + 1)].c;
          var dir = a1.clone().sub(a0).normalize();
          var bx = new V3().crossVectors(dir, prevAx).normalize(), ax = new V3().crossVectors(bx, dir).normalize(); prevAx = ax;
          // 腳踝以下：外擴成大象腳，最後一圈貼地
          var flare = 1 + (leg.flat ? 0.22 * Math.pow(sp.last, 3) : 0), c = sp.c.clone();
          var ring = [];
          for (var k = 0; k < 16; k++) {
            var ang = k / 16 * Math.PI * 2;
            var p = c.clone().add(ax.clone().multiplyScalar(Math.cos(ang) * sp.r * flare * (leg.wide || 1))).add(bx.clone().multiplyScalar(Math.sin(ang) * sp.r * flare));
            if (sp.last > 0.999 && !leg.arm) p.y = 0.0;
            var cc = col.body.clone().multiplyScalar(0.94 + Math.min(1, c.y / (pts[0].y || 1)) * 0.06);
            var vi = B.v(p, cc, sp.skin, ow);
            if (tq < 0.4) {
              var sb = S(Math.max(z0, Math.min(z1, p.z))), ryb = p.y >= sb[1] ? sb[3] : sb[4];
              var bn = new V3(p.x / (sb[2] * sb[2]), (p.y - sb[1]) / (ryb * ryb), 0).normalize();
              B.blend.push({ i: vi, n: bn, w: 1 - Math.max(0, Math.min(1, (tq - 0.04) / 0.34)) });
            }
            ring.push(vi);
          }
          lr.push(ring);
        });
        for (j = 0; j < lr.length - 1; j++) B.stitch(lr[j], lr[j + 1]);
        var topDir = pts[1].clone().sub(pts[0]).normalize();
        B.cap(lr[0], B.v(pts[0].clone().addScaledVector(topDir, -leg.r[0] * 0.75), col.body, [[bones.indexOf(byName[names[0]]), 1]], 0), true);
        var last = pts[n - 1], endDir = last.clone().sub(pts[n - 2]).normalize();
        // 手臂：末端圓頭；腳：平底貼地
        var capC = leg.arm ? last.clone().add(endDir.clone().multiplyScalar(leg.r[n - 1] * 0.7)) : new V3(last.x, 0.0, last.z);
        B.cap(lr[lr.length - 1], B.v(capC, col.body, [[bones.indexOf(byName[names[n - 1]]), 1]]), false);
        footList.push({ bone: names[n - 1], pos: last.clone(), dir: endDir, side: side, r: leg.r[n - 1] * (leg.arm || leg.digit ? 1 : 1.22), toes: leg.toes || 3, leg: leg });
      });
    });

    var geo = B.geometry();
    var mat = spec.gloss ? new THREE.MeshPhongMaterial({ vertexColors: true, skinning: true, shininess: spec.gloss, specular: new THREE.Color(0x2c2c24) }) : new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true });
    var mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(bones[0]);
    var skeleton = new THREE.Skeleton(bones);
    mesh.bind(skeleton);
    var group = new THREE.Group();
    group.add(mesh);

    // 附加零件（骨板、尾刺、角、眼睛…）：掛在最近的骨頭上，跟著動
    var parts = [];
    function attach(obj, worldPos, boneName) {
      var b = byName[boneName];
      obj.position.copy(worldPos.clone().sub(b.userData.world));
      b.add(obj); parts.push(obj);
    }
    function nearestSpineBone(z) {
      var best = chain[0], d = 1e9;
      chain.forEach(function (c) { var dd = Math.abs(c.z - z); if (dd < d) { d = dd; best = c; } });
      return best.name;
    }
    (spec.extras || []).forEach(function (ex) { ex(attach, S, col, nearestSpineBone, byName); });
    // 下顎：獨立的骨頭（張嘴、咬、吼都轉它），上下兩排牙、嘴裡深紅、粉紅舌頭
    if (spec.jaw) {
      var J = spec.jaw, hinge = new V3(0, J.y, J.z);
      addBone('jaw', hinge, 'head');
      var jb = byName.jaw; // 只當掛點用，不參與蒙皮（骨架在這之前就建好了）
      var JS = sampler(J.rows), jl = J.rows[J.rows.length - 1][0];
      var JB = new Builder(), jr = [];
      for (var q = 0; q <= 24; q++) {
        var dz = jl * q / 24, s = JS(dz), s2 = JS(Math.min(jl, dz + 0.01)), sl = (s2[1] - s[1]) / 0.01, up = new V3(0, 1, -sl).normalize(), ring = [];
        for (var k = 0; k < 18; k++) {
          var a = k / 18 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), ry = sa >= 0 ? s[3] : s[4];
          var c = col.body.clone(); if (sa < 0) c.lerp(col.belly, Math.min(1, -sa) * 0.7);
          ring.push(JB.v(new V3(s[2] * ca, s[1], dz).add(up.clone().multiplyScalar(ry * sa)), c, [[0, 1]]));
        }
        jr.push(ring);
      }
      for (q = 0; q < jr.length - 1; q++) JB.stitch(jr[q], jr[q + 1]);
      var je = JS(jl), js = JS(0);
      JB.cap(jr[0], JB.v(new V3(0, js[1], -0.02), col.body, [[0, 1]]), true);
      JB.cap(jr[jr.length - 1], JB.v(new V3(0, je[1], jl + 0.01), col.body, [[0, 1]]), false);
      var jg = JB.geometry(); jg.deleteAttribute('ow');
      var jawMesh = new THREE.Mesh(jg, spec.gloss ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: spec.gloss, specular: new THREE.Color(0x2c2c24) }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
      jb.add(jawMesh);
      jb.rotation.x = J.open || 0;
      // 嘴裡（深紅）與舌頭
      var inner = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshLambertMaterial({ color: col.mouthIn || hex('#5a1a1e') }));
      inner.scale.set(J.inner[0], J.inner[1], J.inner[2]); inner.position.set(0, J.inner[3], J.inner[4]); inner.userData.noOutline = true;
      jb.add(inner);
      if (col.tongue) {
        var tg = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), new THREE.MeshLambertMaterial({ color: col.tongue }));
        tg.scale.set(J.inner[0] * 0.7, J.inner[1] * 0.35, J.inner[2] * 0.85); tg.position.set(0, J.inner[3] + J.inner[1] * 0.25, J.inner[4]); tg.userData.noOutline = true;
        jb.add(tg);
      }
      // 牙齒：上排掛頭骨、往下；下排掛下顎、往上
      var toothCol = col.teeth || hex('#f4f0e6');
      if (J.teeth) {
        var T = J.teeth;
        [-1, 1].forEach(function (side) {
          for (var t = 0; t < T.n; t++) {
            var z = lerp(T.z0, T.z1, t / (T.n - 1)), s = S(z), h = T.h * (1 - 0.35 * t / (T.n - 1)) * (t % 2 ? 0.8 : 1);
            var up1 = DINO.cone(T.r, h, toothCol, 6); up1.rotation.x = Math.PI; up1.userData.noOutline = true;
            attach(up1, new V3(side * s[2] * T.x, s[1] - s[4] * T.y, z), 'head');
            var dz = z - J.z - T.lowShift; if (dz < 0.02 || dz > jl - 0.03) continue;
            var js2 = JS(dz), lo = DINO.cone(T.r * 0.9, h * 0.8, toothCol, 6); lo.userData.noOutline = true;
            lo.position.set(side * js2[2] * T.x, js2[1] + js2[3] * 0.5, dz); jb.add(lo);
          }
        });
      }
    }
    // 腳掌／手：依類型加上趾甲、腳趾＋爪、手爪
    var clawCol = col.claw || hex('#f2eee4');
    footList.forEach(function (f) {
      var L = f.leg;
      if (L.arm) {
        // 手爪：往前下方彎的白爪
        for (var t = 0; t < f.toes; t++) {
          var sp = (t - (f.toes - 1) / 2) * 0.35, cl = DINO.cone(L.claw[1], L.claw[0], clawCol, 8);
          cl.rotation.order = 'YXZ'; cl.rotation.y = sp; cl.rotation.x = Math.PI / 2 + (L.claw[2] || 0.6);
          if (L.claw[1] < 0.05) cl.userData.noOutline = true;
          attach(cl, f.pos.clone().add(f.dir.clone().multiplyScalar(f.r * 0.6)).add(new V3(Math.sin(sp) * f.r * 1.3, 0, 0)), f.bone);
        }
        return;
      }
      if (L.digit) {
        // 獸腳類：腳趾往前伸、尖端白爪；迅猛龍內側趾多一根翹起的鐮刀爪
        var D = L.digit;
        for (var t2 = 0; t2 < f.toes; t2++) {
          var a2 = (t2 - (f.toes - 1) / 2) * D.spread, dir = new V3(Math.sin(a2), 0, Math.cos(a2));
          var toe = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshPhongMaterial({ color: col.body.clone().multiplyScalar(0.93), shininess: spec.gloss || 10, specular: new THREE.Color(0x2c2c24) }));
          toe.scale.set(f.r * 0.42, f.r * 0.4, D.len * 0.55); toe.rotation.y = a2;
          var tp = new V3(f.pos.x, f.r * 0.38, f.pos.z).add(dir.clone().multiplyScalar(D.len * 0.45));
          attach(toe, tp, f.bone);
          var cl2 = DINO.cone(f.r * 0.22, D.claw, clawCol, 8);
          cl2.rotation.order = 'YXZ'; cl2.rotation.y = a2; cl2.rotation.x = Math.PI / 2 + 0.45;
          attach(cl2, new V3(f.pos.x, f.r * 0.3, f.pos.z).add(dir.clone().multiplyScalar(D.len * 0.95)), f.bone);
        }
        if (D.sickle) {
          var sk = DINO.cone(f.r * 0.3, D.sickle, clawCol, 8);
          sk.rotation.order = 'YXZ'; sk.rotation.y = -f.side * 0.25; sk.rotation.x = Math.PI / 2 - 0.85;
          attach(sk, new V3(f.pos.x - f.side * f.r * 0.45, f.r * 0.75, f.pos.z + f.r * 0.5), f.bone);
        }
        return;
      }
      for (var t = 0; t < f.toes; t++) {
        var a = (t - (f.toes - 1) / 2) * (f.toes > 3 ? 0.42 : 0.6);
        var nail = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.3, 12, 8), new THREE.MeshLambertMaterial({ color: col.toe || col.spike || col.belly }));
        nail.scale.set(1, 0.75, 0.9);
        attach(nail, new V3(f.pos.x + Math.sin(a) * f.r * 0.92, f.r * 0.2, f.pos.z + Math.cos(a) * f.r * 0.92), f.bone);
      }
    });
    var eyes = parts.filter(function (o) { return o.userData.isEye; });
    var hipY = (spec.legs[0].pts[0][1]) || 1;
    return { group: group, mesh: mesh, bones: byName, parts: parts, spine: S, eyes: eyes, spec: spec, hipY: hipY };
  };

  // ---- 外觀用的零件 ----
  DINO.plateMesh = function (w, h, thick, c1, c2) {
    // 圓頭五角形骨板（像原作／復原圖），底寬、頂部圓
    var sh = new THREE.Shape();
    sh.moveTo(-w * 0.5, 0);
    sh.quadraticCurveTo(-w * 0.66, h * 0.42, -w * 0.18, h * 0.82);
    sh.quadraticCurveTo(-w * 0.04, h * 0.98, w * 0.06, h);
    sh.quadraticCurveTo(w * 0.2, h * 0.72, w * 0.55, h * 0.36);
    sh.quadraticCurveTo(w * 0.62, h * 0.14, w * 0.5, 0);
    sh.lineTo(-w * 0.5, 0);
    var g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.6, bevelSize: thick * 0.6, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -thick / 2);
    g.rotateY(Math.PI / 2);
    // 顏色：底部深、頂端淺
    var pos = g.attributes.position, colr = [];
    for (var i = 0; i < pos.count; i++) { var t = Math.max(0, Math.min(1, pos.getY(i) / h)); var c = c1.clone().lerp(c2, t); colr.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  };
  DINO.leafPlate = function (w, h, thick, c1, c2, gloss) {
    var sh = new THREE.Shape();
    sh.moveTo(-w * 0.5, 0);
    sh.bezierCurveTo(-w * 0.58, h * 0.34, -w * 0.22, h * 0.74, w * 0.14, h);
    sh.bezierCurveTo(w * 0.28, h * 0.68, w * 0.56, h * 0.34, w * 0.5, 0);
    sh.lineTo(-w * 0.5, 0);
    var g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.7, bevelSize: thick * 0.55, bevelSegments: 3, curveSegments: 14 });
    g.translate(0, 0, -thick / 2);
    g.rotateY(Math.PI / 2);
    var pos = g.attributes.position, colr = [];
    for (var i = 0; i < pos.count; i++) { var t = Math.max(0, Math.min(1, pos.getY(i) / h)); var c = c1.clone().lerp(c2, t * t); colr.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.computeVertexNormals();
    var m = gloss ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: gloss, specular: new THREE.Color(0x2a2222) }) : new THREE.MeshLambertMaterial({ vertexColors: true });
    return new THREE.Mesh(g, m);
  };
  DINO.cone = function (r, h, c, seg) {
    var g = new THREE.ConeGeometry(r, h, seg || 10, 3);
    g.translate(0, h / 2, 0);
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: c }));
  };
  DINO.eye = function (r, side, iris) {
    // 黑眼珠＋白色反光；有 iris 時是彩色虹膜＋黑瞳孔（肉食龍的黃眼）
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: iris ? hex(iris) : hex('#141218') })));
    if (iris) {
      var pu = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 10, 8), new THREE.MeshBasicMaterial({ color: hex('#141218') }));
      pu.scale.set(0.55, 1, 1); pu.position.set((side || 1) * r * 0.5, 0, r * 0.12); g.add(pu);
    }
    var hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 8, 6), new THREE.MeshBasicMaterial({ color: hex('#ffffff') }));
    hl.position.set((side || 1) * r * 0.45, r * 0.4, r * 0.55); g.add(hl);
    g.traverse(function (o) { o.userData.noOutline = true; });
    g.userData.isEye = true;
    return g;
  };
  // 沿曲線放樣、半徑漸變的管子（冠、角）；顏色由根部 c1 漸變到尖端 c2
  DINO.tube = function (pts, radii, c1, c2, gloss) {
    var P = pts.map(function (q) { return new V3(q[0], q[1], q[2]); }), n = P.length, samp = [];
    for (var j = 0; j < n - 1; j++) {
      for (var t = (j === 0 ? 0 : 1); t <= 8; t++) {
        var f = t / 8, i0 = Math.max(0, j - 1), i3 = Math.min(n - 1, j + 2);
        samp.push({ c: new V3(cr(P[i0].x, P[j].x, P[j + 1].x, P[i3].x, f), cr(P[i0].y, P[j].y, P[j + 1].y, P[i3].y, f), cr(P[i0].z, P[j].z, P[j + 1].z, P[i3].z, f)), r: lerp(radii[j], radii[j + 1], f), u: (j + f) / (n - 1) });
      }
    }
    var B = new Builder(), rings = [], prevAx = new V3(1, 0, 0);
    if (Math.abs(samp[1].c.clone().sub(samp[0].c).normalize().x) > 0.9) prevAx = new V3(0, 1, 0);
    samp.forEach(function (sp, q) {
      var d = samp[Math.min(samp.length - 1, q + 1)].c.clone().sub(samp[Math.max(0, q - 1)].c).normalize();
      var bx = new V3().crossVectors(d, prevAx).normalize(), ax = new V3().crossVectors(bx, d).normalize(); prevAx = ax;
      var ring = [], cc = c1.clone().lerp(c2, sp.u);
      for (var k = 0; k < 12; k++) {
        var a = k / 12 * Math.PI * 2;
        ring.push(B.v(sp.c.clone().add(ax.clone().multiplyScalar(Math.cos(a) * sp.r)).add(bx.clone().multiplyScalar(Math.sin(a) * sp.r)), cc, [[0, 1]]));
      }
      rings.push(ring);
    });
    for (var q = 0; q < rings.length - 1; q++) B.stitch(rings[q], rings[q + 1]);
    var e = samp[samp.length - 1], ed = e.c.clone().sub(samp[samp.length - 2].c).normalize();
    B.cap(rings[0], B.v(samp[0].c.clone(), c1, [[0, 1]]), true);
    B.cap(rings[rings.length - 1], B.v(e.c.clone().add(ed.multiplyScalar(e.r * 0.8 + 0.004)), c2, [[0, 1]]), false);
    var g = B.geometry(); g.deleteAttribute('ow');
    return new THREE.Mesh(g, gloss ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: gloss, specular: new THREE.Color(0x2c2c24) }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
  };
  // 三角龍的頸盾：扇形、邊緣一圈小圓瘤，兩側往前微彎像盾牌
  DINO.frill = function (w, h, thick, c1, c2, knobCol, gloss) {
    var sh = new THREE.Shape(), N = 96, pts = [];
    for (var i = 0; i <= N; i++) {
      var a = -1.75 + 3.5 * i / N, sc = 1 + 0.035 * Math.cos(i / N * Math.PI * 18); // 平滑的波浪邊（9 個圓弧）
      pts.push(new THREE.Vector2(Math.sin(a) * w * 0.5 * sc, (Math.cos(a) * 0.85 + 0.15) * h * sc - h * 0.12));
    }
    sh.moveTo(-w * 0.2, -h * 0.12); pts.forEach(function (p) { sh.lineTo(p.x, p.y); }); sh.lineTo(w * 0.2, -h * 0.12); sh.lineTo(-w * 0.2, -h * 0.12);
    var g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.6, bevelSize: thick * 0.5, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -thick / 2);
    var pos = g.attributes.position, colr = [];
    for (var k = 0; k < pos.count; k++) {
      var x = pos.getX(k), y = pos.getY(k), rr = Math.min(1, Math.sqrt(Math.pow(x / (w * 0.5), 2) + Math.pow(y / h, 2)));
      pos.setZ(k, pos.getZ(k) + 0.28 * w * Math.pow(x / (w * 0.5), 2)); // 兩側往前彎
      var c = c1.clone().lerp(c2, Math.pow(rr, 2.6)); colr.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.computeVertexNormals();
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(g, gloss ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: gloss, specular: new THREE.Color(0x2c2c24) }) : new THREE.MeshLambertMaterial({ vertexColors: true })));
    for (var j = 0; j <= N; j += 1) {
      if (Math.abs(Math.cos(j / N * Math.PI * 18) - 1) > 0.05) continue; // 只放在每個圓弧的頂點
      var p = pts[j], kb = new THREE.Mesh(new THREE.SphereGeometry(thick * 1.1, 10, 8), new THREE.MeshLambertMaterial({ color: knobCol }));
      kb.position.set(p.x * 1.01, p.y * 1.01, 0.28 * w * Math.pow(p.x / (w * 0.5), 2)); grp.add(kb);
    }
    return grp;
  };
  // 常用：一對眼睛、一對嘴線（貼在頭的側面）
  DINO.addEyes = function (attach, S, z, r, up, out, iris, bone) {
    var s = S(z);
    [-1, 1].forEach(function (side) { attach(DINO.eye(r, side, iris), new V3(side * s[2] * out, s[1] + s[3] * up, z), bone || 'head'); });
  };
  DINO.addMouth = function (attach, S, za, zb, drop, color, bone) {
    [-1, 1].forEach(function (side) {
      var pts = [];
      for (var k = 0; k <= 8; k++) { var z = lerp(za, zb, k / 8), q = S(z); pts.push(new V3(side * q[2] * 0.94, q[1] - q[4] * drop, z)); }
      var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 6, false), new THREE.MeshBasicMaterial({ color: color }));
      tube.userData.noOutline = true;
      var b = new THREE.Group(); b.add(tube); attach(b, new V3(0, 0, 0), bone || 'head');
    });
  };

  // ---- 物種資料：劍龍（依維基百科復原圖與骨架比例：臀部最高、頭低、前腳短、肚子深、兩排交錯骨板、尾巴 4 根刺） ----
  // ---- 描邊（反轉外殼）：沿平滑法線往外推、只畫背面；ow 屬性讓腿根、尾尖的描邊變細 ----
  function smoothNormals(g) {
    if (g.attributes.sn) return;
    var P = g.attributes.position, N = g.attributes.normal, map = {}, out = new Float32Array(P.count * 3), key, i, e;
    for (i = 0; i < P.count; i++) {
      key = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4);
      e = map[key] || (map[key] = [0, 0, 0, []]);
      e[0] += N.getX(i); e[1] += N.getY(i); e[2] += N.getZ(i); e[3].push(i);
    }
    Object.keys(map).forEach(function (k) {
      var e = map[k], l = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]) || 1;
      e[3].forEach(function (i) { out[i * 3] = e[0] / l; out[i * 3 + 1] = e[1] / l; out[i * 3 + 2] = e[2] / l; });
    });
    g.setAttribute('sn', new THREE.BufferAttribute(out, 3));
  }
  var OL_MATS = {};
  function outlineMat(w, skinned, hasOw) {
    var key = w.toFixed(4) + (skinned ? 's' : '') + (hasOw ? 'o' : '');
    if (OL_MATS[key]) return OL_MATS[key];
    var m = new THREE.MeshBasicMaterial({ color: hex('#15131c'), side: THREE.BackSide, skinning: skinned });
    m.onBeforeCompile = function (s) {
      s.vertexShader = 'attribute vec3 sn;\n' + (hasOw ? 'attribute float ow;\n' : '') + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += sn * ' + w.toFixed(4) + (hasOw ? ' * ow' : '') + ';');
    };
    m.customProgramCacheKey = function () { return key; };
    return (OL_MATS[key] = m);
  }
  // ---- 合併零件：同一根骨頭上的骨板、角、趾甲…合成一個網格（顏色寫進頂點），一隻恐龍從幾十次繪製降到十幾次 ----
  DINO.merge = function (d) {
    d.group.updateMatrixWorld(true);
    var mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: d.spec.gloss || 12, specular: new THREE.Color(0x2c2c24) });
    var buckets = [], inv = new THREE.Matrix4();
    Object.keys(d.bones).forEach(function (k) {
      var bone = d.bones[k], ol = [], noOl = [];
      bone.children.slice().forEach(function (ch) {
        if (ch.isBone || ch.userData.isEye) return;
        ch.traverse(function (o) { if (o.isMesh && !o.isSkinnedMesh) (o.userData.noOutline ? noOl : ol).push(o); });
        bone.remove(ch);
      });
      if (ol.length || noOl.length) buckets.push({ bone: bone, lists: [ol, noOl] });
    });
    buckets.forEach(function (bk) {
      inv.copy(bk.bone.matrixWorld).invert();
      bk.lists.forEach(function (list, li) {
        if (!list.length) return;
        var parts = [], n = 0;
        list.forEach(function (o) {
          var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
          if (!g.attributes.normal) g.computeVertexNormals();
          g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
          var cnt = g.attributes.position.count, c = g.attributes.color, base = o.material.color || new THREE.Color(1, 1, 1);
          var col = new Float32Array(cnt * 3);
          for (var i = 0; i < cnt; i++) {
            col[i * 3] = c ? c.getX(i) : base.r; col[i * 3 + 1] = c ? c.getY(i) : base.g; col[i * 3 + 2] = c ? c.getZ(i) : base.b;
          }
          parts.push({ p: g.attributes.position.array, nm: g.attributes.normal.array, c: col }); n += cnt;
        });
        var P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), off = 0;
        parts.forEach(function (q) { P.set(q.p, off); N.set(q.nm, off); C.set(q.c, off); off += q.p.length; });
        var mg = new THREE.BufferGeometry();
        mg.setAttribute('position', new THREE.BufferAttribute(P, 3));
        mg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        mg.setAttribute('color', new THREE.BufferAttribute(C, 3));
        var m = new THREE.Mesh(mg, mat);
        if (li === 1) m.userData.noOutline = true;
        bk.bone.add(m);
      });
    });
    d.parts = [];
    return d;
  };
  DINO.outline = function (obj, w) {
    var list = [];
    obj.traverse(function (o) { if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline) list.push(o); });
    list.forEach(function (o) {
      smoothNormals(o.geometry);
      var m = outlineMat(w, !!o.isSkinnedMesh, !!o.geometry.attributes.ow), ol;
      if (o.isSkinnedMesh) { ol = new THREE.SkinnedMesh(o.geometry, m); ol.bind(o.skeleton, o.bindMatrix); }
      else ol = new THREE.Mesh(o.geometry, m);
      ol.userData.isOutline = true;
      ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
      o.parent.add(ol);
      o.userData.outline = ol;
    });
  };

  DINO.SPECIES = {};
  DINO.SPECIES.Stegosaurus = {
    // 原作風：圓滾滾的橄欖綠身體、粗脖子、少而大的尖葉骨板、長長朝後的米色尾刺
    colors: { body: '#7f8444', belly: '#979a5a', plate: '#743a32', plateTip: '#9a5a4c', spike: '#e3c4a0', toe: '#8e9450', mouth: '#b8333a' },
    gloss: 16,
    //      z      y     rx    rt    rb
    spine: [[-3.45, 1.2, 0.035, 0.035, 0.035],
      [-3.32, 1.22, 0.085, 0.085, 0.085],
      [-2.8, 1.34, 0.16, 0.16, 0.16],
      [-2.1, 1.56, 0.31, 0.29, 0.33],
      [-1.45, 1.75, 0.62, 0.52, 0.68],
      [-0.8, 1.88, 0.95, 0.68, 1.06],
      [-0.15, 1.82, 1.02, 0.7, 1.14],
      [0.45, 1.58, 0.84, 0.56, 0.94],
      [0.95, 1.28, 0.52, 0.4, 0.52],
      [1.3, 1.08, 0.34, 0.31, 0.34],
      [1.6, 0.97, 0.255, 0.245, 0.25],
      [1.82, 0.94, 0.245, 0.255, 0.225],
      [2.02, 0.885, 0.195, 0.195, 0.165],
      [2.17, 0.845, 0.145, 0.135, 0.122],
      [2.26, 0.825, 0.102, 0.092, 0.086],
      [2.31, 0.818, 0.062, 0.056, 0.052],
      [2.335, 0.814, 0.022, 0.02, 0.018]],
    bones: { hips: -0.7, front: [['back', 0.0], ['chest', 0.6], ['neck1', 1.15], ['neck2', 1.5], ['head', 1.85]], tail: [['tail1', -1.35], ['tail2', -2.0], ['tail3', -2.6], ['tail4', -3.1]] },
    legs: [
      { name: 'hind', parent: 'hips', joints: ['Hip', 'Thigh', 'Knee', 'Ankle', 'Foot'], r: [0.58, 0.48, 0.28, 0.23, 0.26], flat: 1, toes: 3,
        pts: [[0.22, 1.5, -0.8], [0.48, 1.12, -0.66], [0.62, 0.66, -0.55], [0.66, 0.2, -0.64], [0.66, 0.0, -0.62]] },
      { name: 'front', parent: 'chest', joints: ['Shoulder', 'Upper', 'Elbow', 'Wrist', 'Foot'], r: [0.38, 0.3, 0.2, 0.17, 0.2], flat: 1, toes: 4,
        pts: [[0.34, 1.2, 0.74], [0.52, 0.86, 0.7], [0.58, 0.48, 0.68], [0.58, 0.15, 0.76], [0.58, 0.0, 0.78]] }
    ],
    extras: [
      // 9 片大骨板：左右交錯，臀部上方最高，脖子、尾巴漸小
      function (attach, S, col, near) {
        for (var i = 0; i < 9; i++) {
          var z = 1.05 - i * 0.42, s = S(z);
          var peak = Math.exp(-Math.pow((z + 0.45) / 1.35, 2)), h = 0.28 + peak * 1.1, w = 0.16 + peak * 0.36;
          var side = i % 2 ? 1 : -1;
          var p = DINO.leafPlate(w, h, 0.06, col.plate, col.plateTip, 14);
          p.rotation.z = side * 0.24; p.rotation.x = -0.08 + (z < -1.2 ? -0.22 : 0);
          attach(p, new THREE.Vector3(side * 0.13, s[1] + s[3] * 0.85, z), near(z));
        }
      },
      // 尾巴 4 根長刺：幾乎朝正後方，微微往上、往外張
      function (attach, S, col) {
        [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(function (e) {
          var z = -2.82 - e[1] * 0.28, s = S(z), c = DINO.cone(0.09, 1.1, col.spike, 12);
          var d = new THREE.Vector3(e[0] * (0.34 - e[1] * 0.1), 0.42 - e[1] * 0.12, -1).normalize();
          c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
          attach(c, new THREE.Vector3(e[0] * s[2] * 0.6, s[1] + s[3] * 0.4, z), 'tail4');
        });
      },
      // 眼睛＋嘴線（原作嘴角帶一點紅）
      function (attach, S, col) {
        var s = S(1.93);
        [-1, 1].forEach(function (side) {
          var e = DINO.eye(0.05, side); e.traverse(function (o) { o.userData.noOutline = true; });
          attach(e, new THREE.Vector3(side * s[2] * 0.8, s[1] + s[3] * 0.32, 1.93), 'head');
          var pts = [];
          for (var k = 0; k <= 8; k++) {
            var z = 2.0 + k * 0.035, q = S(z);
            pts.push(new THREE.Vector3(side * q[2] * 0.94, q[1] - q[4] * 0.3, z));
          }
          var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 6, false), new THREE.MeshBasicMaterial({ color: col.mouth }));
          tube.userData.noOutline = true;
          var b = new THREE.Group(); b.add(tube);
          attach(b, new THREE.Vector3(0, 0, 0), 'head');
        });
      }
    ]
  };
  // ======== 其他 5 隻（原作風：圓潤、粗黑描邊、柔和光澤；特徵依原作截圖＋維基百科復原圖） ========
  // 暴龍：大方頭、深下顎＋白牙、短短兩指小手、粗壯大腿、腳趾著地三趾白爪、尾巴水平
  DINO.SPECIES.TRex = {
    colors: { body: '#83473a', belly: '#b47c62', claw: '#f2eee4', teeth: '#f4f0e6', tongue: '#d4606a', mouthIn: '#5a1a22' },
    gloss: 18,
    spine: [[-2.72, 2.12, 0.03, 0.03, 0.03], [-2.6, 2.06, 0.08, 0.08, 0.08], [-2.1, 1.98, 0.22, 0.22, 0.24], [-1.5, 2.18, 0.42, 0.42, 0.46],
      [-0.95, 2.35, 0.56, 0.46, 0.62], [-0.35, 2.42, 0.66, 0.5, 0.8], [0.25, 2.5, 0.64, 0.5, 0.84], [0.7, 2.68, 0.52, 0.44, 0.64],
      [1.0, 2.98, 0.44, 0.4, 0.48], [1.25, 3.24, 0.43, 0.4, 0.42], [1.45, 3.45, 0.45, 0.41, 0.24], [1.75, 3.45, 0.41, 0.37, 0.2],
      [2.05, 3.37, 0.36, 0.31, 0.17], [2.28, 3.3, 0.31, 0.24, 0.14], [2.4, 3.26, 0.24, 0.17, 0.11], [2.47, 3.24, 0.14, 0.1, 0.07], [2.5, 3.235, 0.05, 0.035, 0.025]],
    bones: { hips: -0.6, front: [['back', 0.0], ['chest', 0.45], ['neck1', 0.9], ['neck2', 1.2], ['head', 1.5]], tail: [['tail1', -1.25], ['tail2', -1.75], ['tail3', -2.2], ['tail4', -2.5]] },
    jaw: { z: 1.45, y: 3.2, open: 0.26,
      rows: [[0, 0, 0.4, 0.06, 0.32], [0.3, -0.03, 0.37, 0.05, 0.27], [0.6, -0.06, 0.32, 0.05, 0.2], [0.82, -0.08, 0.26, 0.045, 0.14], [0.95, -0.09, 0.17, 0.035, 0.08], [1.0, -0.09, 0.05, 0.02, 0.025]],
      inner: [0.26, 0.1, 0.38, 0.04, 0.45], teeth: { n: 7, z0: 1.7, z1: 2.4, r: 0.032, h: 0.1, x: 0.8, y: 0.55, lowShift: 0 } },
    legs: [
      { name: 'hind', parent: 'hips', joints: ['Hip', 'Thigh', 'Knee', 'Ankle', 'Foot'], r: [0.56, 0.52, 0.34, 0.24, 0.22], toes: 3, digit: { len: 0.5, spread: 0.42, claw: 0.15 },
        pts: [[0.36, 2.2, -0.6], [0.58, 1.68, -0.42], [0.62, 1.12, -0.22], [0.6, 0.45, -0.45], [0.58, 0.08, -0.3]] },
      { name: 'arm', parent: 'chest', arm: true, joints: ['Shoulder', 'Elbow', 'Hand'], r: [0.09, 0.065, 0.05], toes: 2, claw: [0.09, 0.025, 0.8],
        pts: [[0.42, 2.3, 0.5], [0.56, 2.05, 0.62], [0.52, 1.95, 0.84]] }
    ],
    extras: [
      function (attach, S, col) {
        DINO.addEyes(attach, S, 1.6, 0.055, 0.5, 0.82, '#e8d04a');
        var s = S(1.62);
        [-1, 1].forEach(function (side) { // 眉骨
          var br = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshPhongMaterial({ color: col.body, shininess: 18, specular: new THREE.Color(0x2c2c24) }));
          br.scale.set(0.09, 0.05, 0.15); attach(br, new THREE.Vector3(side * s[2] * 0.72, s[1] + s[3] * 0.82, 1.62), 'head');
        });
      }
    ]
  };

  // 迅猛龍：瘦長、S 形脖子、長嘴細牙、長手臂大白爪、兩趾＋翹起的鐮刀爪、硬挺長尾往上
  DINO.SPECIES.Raptor = {
    colors: { body: '#6e5034', belly: '#a88a68', claw: '#f2eee4', teeth: '#f4f0e6', tongue: '#c8606a', mouthIn: '#4a1a1e', fuzz: '#4e3824' },
    gloss: 20, steps: 130,
    spine: [[-1.95, 2.0, 0.02, 0.02, 0.02], [-1.85, 1.95, 0.045, 0.045, 0.045], [-1.45, 1.68, 0.09, 0.09, 0.1], [-1.0, 1.5, 0.15, 0.15, 0.17],
      [-0.55, 1.42, 0.24, 0.24, 0.27], [-0.1, 1.42, 0.28, 0.26, 0.36], [0.3, 1.5, 0.25, 0.24, 0.33], [0.55, 1.66, 0.16, 0.16, 0.18],
      [0.68, 1.9, 0.13, 0.13, 0.14], [0.75, 2.12, 0.125, 0.125, 0.12], [0.86, 2.28, 0.15, 0.14, 0.1], [1.0, 2.28, 0.135, 0.12, 0.085],
      [1.12, 2.24, 0.1, 0.095, 0.065], [1.2, 2.21, 0.068, 0.065, 0.048], [1.245, 2.2, 0.032, 0.03, 0.024], [1.26, 2.195, 0.01, 0.01, 0.01]],
    bones: { hips: -0.45, front: [['back', -0.05], ['chest', 0.3], ['neck1', 0.55], ['neck2', 0.7], ['head', 0.86]], tail: [['tail1', -0.9], ['tail2', -1.3], ['tail3', -1.6], ['tail4', -1.85]] },
    jaw: { z: 0.86, y: 2.2, open: 0.25,
      rows: [[0, 0, 0.14, 0.03, 0.11], [0.15, -0.02, 0.12, 0.026, 0.09], [0.27, -0.035, 0.085, 0.022, 0.06], [0.35, -0.045, 0.05, 0.018, 0.035], [0.38, -0.047, 0.015, 0.012, 0.012]],
      inner: [0.08, 0.04, 0.16, 0.012, 0.2], teeth: { n: 6, z0: 0.96, z1: 1.2, r: 0.017, h: 0.056, x: 0.82, y: 0.55, lowShift: 0 } },
    legs: [
      { name: 'hind', parent: 'hips', joints: ['Hip', 'Thigh', 'Knee', 'Ankle', 'Foot'], r: [0.26, 0.22, 0.12, 0.08, 0.08], toes: 2, digit: { len: 0.24, spread: 0.28, claw: 0.07, sickle: 0.17 },
        pts: [[0.2, 1.32, -0.45], [0.3, 1.05, -0.3], [0.34, 0.75, -0.1], [0.32, 0.32, -0.4], [0.31, 0.05, -0.26]] },
      { name: 'arm', parent: 'chest', arm: true, joints: ['Shoulder', 'Elbow', 'Hand'], r: [0.075, 0.055, 0.045], toes: 3, claw: [0.2, 0.024, 1.3],
        pts: [[0.2, 1.42, 0.32], [0.28, 1.08, 0.24], [0.27, 0.8, 0.42]] }
    ],
    extras: [
      function (attach, S, col, near) {
        DINO.addEyes(attach, S, 0.92, 0.034, 0.5, 0.8, '#e0c040');
        // 背上一排短短的深色絨毛刺（原作輪廓上的鋸齒）
        for (var i = 0; i < 16; i++) {
          var z = 0.8 - i * 0.12, s = S(z), h = 0.05 + 0.03 * Math.sin(i / 15 * Math.PI);
          var c = DINO.cone(0.025, h, col.fuzz, 5); c.rotation.x = -0.5; c.userData.noOutline = true;
          attach(c, new THREE.Vector3(0, s[1] + s[3] * 0.92, z), near(z));
        }
      }
    ]
  };

  // 副櫛龍：灰綠、四腳站、臀部高、尾巴厚、鴨嘴、從額頭往後彎的長管冠
  DINO.SPECIES.Parasaurolophus = {
    colors: { body: '#8fa596', belly: '#b8c8b8', toe: '#a3b8a8', mouth: '#b8333a', crest: '#9cb2a2', crestTip: '#b4c6b6' },
    gloss: 16,
    spine: [[-3.15, 1.28, 0.03, 0.03, 0.03], [-3.0, 1.32, 0.08, 0.08, 0.08], [-2.25, 1.56, 0.2, 0.24, 0.24], [-1.5, 1.85, 0.4, 0.46, 0.46],
      [-0.8, 2.0, 0.6, 0.52, 0.72], [-0.1, 1.9, 0.66, 0.48, 0.84], [0.5, 1.62, 0.56, 0.42, 0.9], [0.9, 1.56, 0.38, 0.32, 0.58],
      [1.2, 1.72, 0.25, 0.25, 0.27], [1.42, 1.92, 0.21, 0.21, 0.21], [1.6, 2.03, 0.21, 0.22, 0.2], [1.8, 2.0, 0.2, 0.21, 0.19],
      [1.98, 1.9, 0.18, 0.17, 0.16], [2.12, 1.83, 0.17, 0.15, 0.15], [2.22, 1.8, 0.165, 0.13, 0.13], [2.29, 1.79, 0.14, 0.1, 0.1], [2.33, 1.785, 0.09, 0.06, 0.06], [2.35, 1.78, 0.03, 0.02, 0.02]],
    bones: { hips: -0.75, front: [['back', -0.1], ['chest', 0.5], ['neck1', 0.95], ['neck2', 1.3], ['head', 1.6]], tail: [['tail1', -1.45], ['tail2', -2.05], ['tail3', -2.6], ['tail4', -2.95]] },
    legs: [
      { name: 'hind', parent: 'hips', joints: ['Hip', 'Thigh', 'Knee', 'Ankle', 'Foot'], r: [0.5, 0.44, 0.26, 0.2, 0.21], flat: 1, toes: 3,
        pts: [[0.26, 1.7, -0.85], [0.44, 1.22, -0.7], [0.52, 0.75, -0.55], [0.52, 0.25, -0.68], [0.52, 0.0, -0.62]] },
      { name: 'front', parent: 'chest', joints: ['Shoulder', 'Upper', 'Elbow', 'Wrist', 'Foot'], r: [0.2, 0.15, 0.11, 0.09, 0.11], flat: 1, toes: 3,
        pts: [[0.3, 1.25, 0.55], [0.38, 0.98, 0.56], [0.42, 0.64, 0.6], [0.42, 0.2, 0.66], [0.42, 0.0, 0.68]] }
    ],
    extras: [
      function (attach, S, col) {
        var s = S(1.7);
        var crest = DINO.tube([[0, 0, 0], [0, 0.2, -0.12], [0, 0.36, -0.32], [0, 0.44, -0.56], [0, 0.4, -0.74], [0, 0.3, -0.82]], [0.11, 0.1, 0.09, 0.085, 0.075, 0.068], col.crest, col.crestTip, 16);
        attach(crest, new THREE.Vector3(0, s[1] + s[3] * 0.72, 1.7), 'head');
        DINO.addEyes(attach, S, 1.74, 0.048, 0.4, 0.8);
        DINO.addMouth(attach, S, 1.94, 2.32, 0.4, col.mouth);
      }
    ]
  };

  // 三角龍：桶狀身體、短尾、大頸盾（邊緣小圓瘤）、兩根長眉角＋短鼻角、鸚鵡嘴、前腳外張
  DINO.SPECIES.Triceratops = {
    colors: { body: '#9a7550', belly: '#c4a682', toe: '#cdbc9c', frill: '#7e2c26', frillRim: '#b85a36', knob: '#f0d2a0', horn: '#d8c8a4', hornTip: '#fff8e6', beak: '#4a4448', mouth: '#4a2420' },
    gloss: 16,
    // 身體縮短、頭放大（頭＋頸盾約佔全長三分之一），臀部最高
    spine: [[-2.52, 1.0, 0.03, 0.03, 0.03], [-2.4, 1.03, 0.08, 0.08, 0.08], [-1.85, 1.2, 0.22, 0.22, 0.24], [-1.2, 1.48, 0.48, 0.44, 0.54],
      [-0.65, 1.62, 0.84, 0.56, 0.96], [-0.05, 1.56, 0.92, 0.55, 1.02], [0.45, 1.4, 0.8, 0.48, 0.85], [0.85, 1.24, 0.54, 0.42, 0.54],
      [1.15, 1.2, 0.52, 0.48, 0.5], [1.5, 1.12, 0.46, 0.45, 0.44], [1.9, 1.0, 0.36, 0.35, 0.33], [2.25, 0.86, 0.26, 0.25, 0.23],
      [2.45, 0.76, 0.16, 0.15, 0.15], [2.53, 0.72, 0.05, 0.045, 0.045]],
    tint: function (c, z, sa, col) { if (z > 2.2) return c.clone().lerp(col.beak, Math.min(1, (z - 2.2) / 0.1)); },
    bones: { hips: -0.6, front: [['back', 0.0], ['chest', 0.45], ['neck1', 0.85], ['head', 1.2]], tail: [['tail1', -1.2], ['tail2', -1.7], ['tail3', -2.1]] },
    legs: [
      { name: 'hind', parent: 'hips', joints: ['Hip', 'Thigh', 'Knee', 'Ankle', 'Foot'], r: [0.55, 0.48, 0.3, 0.25, 0.27], flat: 1, toes: 3,
        pts: [[0.32, 1.3, -0.68], [0.58, 0.92, -0.56], [0.66, 0.55, -0.45], [0.66, 0.18, -0.55], [0.66, 0.0, -0.52]] },
      { name: 'front', parent: 'chest', joints: ['Shoulder', 'Upper', 'Elbow', 'Wrist', 'Foot'], r: [0.38, 0.3, 0.22, 0.19, 0.21], flat: 1, toes: 4,
        pts: [[0.4, 1.0, 0.62], [0.66, 0.72, 0.62], [0.76, 0.45, 0.63], [0.72, 0.15, 0.67], [0.72, 0.0, 0.69]] }
    ],
    extras: [
      function (attach, S, col) {
        var s = S(1.15), fr = DINO.frill(1.85, 1.2, 0.06, col.frill, col.frillRim, col.knob, 14);
        fr.rotation.x = -0.72; attach(fr, new THREE.Vector3(0, s[1] + 0.12, 1.02), 'head');
        var sb = S(1.52);
        [-1, 1].forEach(function (side) {
          var h = DINO.tube([[0, 0, 0], [side * 0.03, 0.28, 0.14], [side * 0.07, 0.58, 0.52], [side * 0.09, 0.74, 1.05]], [0.12, 0.1, 0.064, 0.012], col.horn, col.hornTip, 20);
          attach(h, new THREE.Vector3(side * 0.22, sb[1] + sb[3] * 0.7, 1.52), 'head');
        });
        var sn = S(2.16), nh = DINO.tube([[0, 0, 0], [0, 0.14, 0.05], [0, 0.26, 0.14]], [0.085, 0.058, 0.01], col.horn, col.hornTip, 20);
        attach(nh, new THREE.Vector3(0, sn[1] + sn[3] * 0.8, 2.16), 'head');
        DINO.addEyes(attach, S, 1.68, 0.062, 0.4, 0.9);
        DINO.addMouth(attach, S, 1.85, 2.45, 0.4, col.mouth);
      }
    ]
  };

  // 雷龍（迷惑龍）：超大圓肚子、柱子腿、往上斜伸的粗長脖子、小頭、長尾巴（為了遊戲縮短一點）
  DINO.SPECIES.Apatosaurus = {
    colors: { body: '#9a7f62', belly: '#cbb595', toe: '#b39b7c', mouth: '#5a2a24' },
    gloss: 14, stripes: 9, steps: 110,
    spine: [[-4.75, 0.85, 0.022, 0.022, 0.022], [-4.55, 0.9, 0.045, 0.045, 0.045], [-3.6, 1.2, 0.12, 0.12, 0.13], [-2.6, 1.65, 0.28, 0.28, 0.32],
      [-1.8, 2.02, 0.52, 0.5, 0.6], [-1.0, 2.27, 0.9, 0.62, 1.06], [-0.2, 2.2, 1.02, 0.62, 1.2], [0.6, 2.06, 0.9, 0.55, 1.06],
      [1.2, 2.06, 0.64, 0.5, 0.68], [1.7, 2.36, 0.48, 0.44, 0.48], [2.2, 2.85, 0.38, 0.35, 0.37], [2.65, 3.33, 0.29, 0.28, 0.28],
      [3.0, 3.68, 0.23, 0.23, 0.22], [3.22, 3.84, 0.2, 0.21, 0.18], [3.45, 3.83, 0.175, 0.17, 0.14], [3.65, 3.76, 0.13, 0.12, 0.1],
      [3.78, 3.71, 0.085, 0.075, 0.065], [3.83, 3.69, 0.03, 0.03, 0.03]],
    bones: { hips: -1.0, front: [['back', -0.2], ['chest', 0.7], ['neck1', 1.4], ['neck2', 2.0], ['neck3', 2.6], ['head', 3.2]], tail: [['tail1', -1.9], ['tail2', -2.8], ['tail3', -3.6], ['tail4', -4.3]] },
    legs: [
      { name: 'hind', parent: 'hips', joints: ['Hip', 'Thigh', 'Knee', 'Ankle', 'Foot'], r: [0.6, 0.55, 0.38, 0.32, 0.34], flat: 1, toes: 3,
        pts: [[0.28, 2.05, -1.0], [0.58, 1.5, -0.9], [0.7, 0.95, -0.8], [0.7, 0.3, -0.86], [0.7, 0.0, -0.84]] },
      { name: 'front', parent: 'chest', joints: ['Shoulder', 'Upper', 'Elbow', 'Wrist', 'Foot'], r: [0.42, 0.38, 0.3, 0.28, 0.3], flat: 1, toes: 3,
        pts: [[0.36, 1.85, 0.85], [0.58, 1.35, 0.88], [0.66, 0.85, 0.9], [0.66, 0.25, 0.95], [0.66, 0.0, 0.96]] }
    ],
    extras: [
      function (attach, S, col) {
        DINO.addEyes(attach, S, 3.42, 0.045, 0.45, 0.8);
        DINO.addMouth(attach, S, 3.52, 3.8, 0.35, col.mouth);
      }
    ]
  };

  // ---- 遊戲用的物種資料：名字、食性、能力（體力／力氣／速度 1~5）、攻擊方式、跑速（公尺／秒） ----
  var META = {
    Stegosaurus: { zh: '劍龍', diet: 'herb', hp: 5, atk: 3, spd: 2, attack: 'tail', speed: 3.4, tip: '尾巴有尖刺，甩尾巴保護自己' },
    TRex: { zh: '暴龍', diet: 'meat', hp: 4, atk: 5, spd: 3, attack: 'bite', speed: 4.2, tip: '咬合力最強的恐龍之王' },
    Raptor: { zh: '迅猛龍', diet: 'meat', hp: 2, atk: 3, spd: 5, attack: 'bite', speed: 5.6, tip: '跑得最快，腳上有鐮刀爪' },
    Parasaurolophus: { zh: '副櫛龍', diet: 'herb', hp: 3, atk: 2, spd: 4, attack: 'call', speed: 4.8, tip: '頭冠可以發出很大的叫聲嚇跑壞蛋' },
    Triceratops: { zh: '三角龍', diet: 'herb', hp: 5, atk: 4, spd: 2, attack: 'horn', speed: 3.6, tip: '用三根角往前衝撞' },
    Apatosaurus: { zh: '雷龍', diet: 'herb', hp: 5, atk: 3, spd: 1, attack: 'tail', speed: 3.0, tip: '最大最重，長尾巴像鞭子' }
  };
  Object.keys(META).forEach(function (k) { if (DINO.SPECIES[k]) DINO.SPECIES[k].meta = META[k]; });
  DINO.ORDER = ['TRex', 'Raptor', 'Parasaurolophus', 'Stegosaurus', 'Triceratops', 'Apatosaurus'];
})();
