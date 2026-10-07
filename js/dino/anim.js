/* 恐龍動作：每一格用程式重新擺骨頭（不用預先做好的動畫檔）。
 * 走路：對角的腳一起動（四腳）或左右交替（兩腳），腳往前擺時膝蓋彎起來；身體跟著上下、左右晃
 * 跳：先蹲（壓扁）→ 起跳拉長 → 空中縮腳 → 落地壓扁再彈回
 * 被打：身體往後仰＋閃紅光＋左右晃動慢慢停下
 * 吃／喝：低頭、嘴巴一開一合；暈倒：側躺、閉眼
 * 只用 ES5 寫法，舊 iPad 也能跑。 */
(function () {
  var DINO = window.DINO;
  var PI2 = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function toward(v, t, k) { return v + (t - v) * Math.min(1, k); }

  DINO.Rig = function (d) {
    var spec = d.spec, B = d.bones, self = this;
    this.d = d; this.spec = spec;
    this.meta = spec.meta || {};
    this.biped = !spec.legs.some(function (L) { return L.name === 'front'; });
    // 骨頭的原始位置（每一格先還原，再把各種動作疊上去）
    this.rest = {};
    Object.keys(B).forEach(function (k) { self.rest[k] = B[k].position.clone(); });
    this.legs = [];
    spec.legs.forEach(function (L) {
      ['L', 'R'].forEach(function (sfx) {
        var n = L.joints.length, j = function (i) { return B[L.name + L.joints[i] + sfx]; };
        var leg = { arm: !!L.arm, front: L.name === 'front', left: sfx === 'L',
          root: j(0), knee: n >= 5 ? j(2) : j(1), ankle: n >= 5 ? j(3) : j(2) };
        // 步伐相位：四腳是對角線一組（左後＋右前），兩腳左右交替；手臂和同側腳相反
        if (self.biped) leg.off = leg.arm ? (leg.left ? 0.5 : 0) : (leg.left ? 0 : 0.5);
        else leg.off = leg.front ? (leg.left ? 0.5 : 0) : (leg.left ? 0 : 0.5);
        self.legs.push(leg);
      });
    });
    this.tail = spec.bones.tail.map(function (e) { return B[e[0]]; });
    this.neck = spec.bones.front.filter(function (e) { return /^neck/.test(e[0]); }).map(function (e) { return B[e[0]]; });
    this.hipY = d.hipY;
    this.halfW = 0;
    spec.spine.forEach(function (r) { if (r[2] > self.halfW) self.halfW = r[2]; });
    // 大隻的步伐比較慢
    this.freqK = 1 / Math.sqrt(Math.max(0.6, this.hipY / 1.4));
    this.jawRest = spec.jaw ? spec.jaw.open || 0 : 0;
    this.t = Math.random() * 10; this.phase = 0; this.mv = 0; this.mvT = 0;
    this.sq = -1; this.landT = 9; this.wasAir = false; this.sy = 1;
    this.atkT = 9; this.hitT = 9; this.eat = 0; this.eatOn = false; this.faint = 0; this.faintOn = false;
    this.blinkT = 2 + Math.random() * 3; this.flashT = 0;
    this.mat = d.mesh.material;
    this.emi = this.mat.emissive ? this.mat.emissive.clone() : null;
  };
  var R = DINO.Rig.prototype;
  DINO.Rig.SQUAT = 0.11; // 起跳前蹲下的時間（秒）
  R.setMove = function (m) { this.mvT = clamp(m, 0, 1); };
  R.squat = function () { this.sq = 0; };
  R.attack = function () { this.atkT = 0; };
  R.hit = function () { this.hitT = 0; this.flashT = 0.18; };
  R.setEat = function (on) { this.eatOn = on; };
  R.setFaint = function (on) { this.faintOn = on; };
  R.busy = function () { return this.atkT < 0.45; };

  R.update = function (dt, air, vy) {
    var B = this.d.bones, rest = this.rest, k, i;
    this.t += dt;
    var t = this.t;
    this.mv = toward(this.mv, this.faintOn ? 0 : this.mvT, dt * 7);
    var mv = this.mv;
    // 1) 全部還原
    for (k in B) { B[k].rotation.set(0, 0, 0); B[k].position.copy(rest[k]); }
    if (B.jaw) B.jaw.rotation.x = this.jawRest;
    var hips = B.hips, back = B.back || hips, head = B.head;

    // 2) 走路／跑步：一步的時間約 0.5~0.6 秒，跑起來更快
    var freq = (1.25 + mv * 1.1) * this.freqK;
    if (mv > 0.02 && !air) this.phase = (this.phase + dt * freq) % 1;
    var A = 0.5 * mv, lift = 0.95 * mv, ph = this.phase;
    for (i = 0; i < this.legs.length; i++) {
      var L = this.legs[i], f = PI2 * (ph + L.off), up = Math.max(0, -Math.sin(f));
      if (L.arm) {
        L.root.rotation.x = 0.28 * mv * Math.sin(f) - 0.15;
        L.knee.rotation.x = -0.35 - 0.2 * up;
        continue;
      }
      L.root.rotation.x = -A * Math.cos(f);
      var bend = 0.12 * mv + lift * up;
      if (L.front) { L.knee.rotation.x = -bend; L.ankle.rotation.x = bend * 0.6; }
      else { L.knee.rotation.x = bend; L.ankle.rotation.x = -bend * 0.7; }
    }
    // 身體一步一沉、左右微晃；尾巴、頭跟著反向擺，看起來有律動感
    hips.position.y += -this.hipY * 0.035 * mv * Math.cos(PI2 * ph * 2) + Math.sin(t * 2.2) * this.hipY * 0.006;
    hips.rotation.z = 0.05 * mv * Math.sin(PI2 * ph);
    if (this.biped) hips.rotation.y = 0.06 * mv * Math.sin(PI2 * ph);
    for (i = 0; i < this.tail.length; i++) {
      this.tail[i].rotation.y = Math.sin(t * (1.5 + mv * 2) - i * 0.7) * (0.07 + 0.1 * mv) - hips.rotation.y * 0.8;
      this.tail[i].rotation.x = Math.sin(PI2 * ph * 2 - i * 0.6) * 0.03 * mv;
    }
    if (this.neck.length) {
      this.neck[0].rotation.y = Math.sin(t * 0.6) * 0.14 * (1 - mv);
      this.neck[0].rotation.x = Math.cos(PI2 * ph * 2) * 0.04 * mv;
    }

    // 3) 跳：先蹲（壓扁）→ 起跳拉長 → 空中縮腳 → 落地壓扁再彈回
    var sy = 1;
    if (this.sq >= 0) {
      this.sq += dt;
      var c = clamp(this.sq / DINO.Rig.SQUAT, 0, 1);
      if (air) { this.sq = -1; c = 0; }
      hips.position.y -= this.hipY * 0.13 * c;
      for (i = 0; i < this.legs.length; i++) {
        var Lq = this.legs[i]; if (Lq.arm) continue;
        if (Lq.front) { Lq.root.rotation.x += 0.25 * c; Lq.knee.rotation.x -= 0.6 * c; Lq.ankle.rotation.x += 0.35 * c; }
        else { Lq.root.rotation.x -= 0.4 * c; Lq.knee.rotation.x += 0.8 * c; Lq.ankle.rotation.x -= 0.45 * c; }
      }
      sy = 1 - 0.18 * c;
    }
    if (air) {
      for (i = 0; i < this.legs.length; i++) {
        var La = this.legs[i]; if (La.arm) continue;
        if (La.front) { La.root.rotation.x = 0.35; La.knee.rotation.x = -0.7; }
        else { La.root.rotation.x = -0.3; La.knee.rotation.x = 0.6; La.ankle.rotation.x = -0.3; }
      }
      sy = (vy || 0) > 0 ? 1 + Math.min(0.12, (vy || 0) * 0.02) : 1;
      for (i = 0; i < this.tail.length; i++) this.tail[i].rotation.x = (vy || 0) > 0 ? -0.06 : 0.08;
    }
    if (this.wasAir && !air) this.landT = 0;
    this.wasAir = air;
    if (this.landT < 0.5) {
      this.landT += dt;
      sy = 1 - 0.2 * Math.exp(-this.landT * 9) * Math.cos(this.landT * 20);
    }
    this.sy = sy;
    this.d.group.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));

    // 4) 攻擊：咬（張大嘴再咬下）、甩尾、低頭衝撞、抬頭大叫
    if (this.atkT < 0.45) {
      this.atkT += dt;
      var q = clamp(this.atkT / 0.45, 0, 1), env = Math.sin(Math.PI * q), kind = this.meta.attack;
      if (kind === 'bite') {
        back.rotation.x += 0.18 * env; hips.position.z += this.hipY * 0.12 * env;
        if (B.jaw) B.jaw.rotation.x = q < 0.55 ? this.jawRest + 0.55 * Math.sin(Math.PI * q / 0.55) : q < 0.75 ? 0 : this.jawRest * (q - 0.75) / 0.25;
      } else if (kind === 'tail') {
        for (i = 0; i < this.tail.length; i++) this.tail[i].rotation.y += 0.55 * Math.sin(PI2 * q) * (0.6 + i * 0.2) * env;
        hips.rotation.y -= 0.2 * Math.sin(PI2 * q) * env;
      } else if (kind === 'horn') {
        back.rotation.x += 0.22 * env; if (this.neck[0]) this.neck[0].rotation.x += 0.25 * env;
        hips.position.z += this.hipY * 0.25 * env;
      } else {
        back.rotation.x -= 0.12 * env; if (this.neck[0]) this.neck[0].rotation.x -= 0.45 * env;
        if (head) head.rotation.x -= 0.25 * env;
      }
    }

    // 5) 吃東西／喝水：低頭，嘴巴一開一合
    this.eat = toward(this.eat, this.eatOn ? 1 : 0, dt * 6);
    var e = this.eat;
    if (e > 0.01) {
      back.rotation.x += 0.16 * e;
      var nk = this.neck.length || 1;
      for (i = 0; i < this.neck.length; i++) this.neck[i].rotation.x += 0.9 / nk * e;
      if (head) head.rotation.x += 0.25 * e + Math.sin(t * 11) * 0.06 * e;
      if (B.jaw) B.jaw.rotation.x = this.jawRest * (1 - e) + (0.05 + 0.16 * Math.max(0, Math.sin(t * 11))) * e;
    }

    // 6) 被打到：往後仰、閃紅光、左右晃動慢慢停下
    if (this.hitT < 0.6) {
      this.hitT += dt;
      var h = this.hitT;
      back.rotation.x -= 0.32 * Math.exp(-h * 6);
      hips.rotation.z += 0.16 * Math.exp(-h * 7) * Math.sin(h * 28);
      hips.position.z -= this.hipY * 0.08 * Math.exp(-h * 8);
    }
    if (this.emi) {
      this.flashT = Math.max(0, this.flashT - dt);
      // 閃紅光兩下：亮 0.06 秒、暗 0.06 秒、亮 0.06 秒
      var on = this.flashT > 0.12 || (this.flashT > 0 && this.flashT <= 0.06);
      if (on) this.mat.emissive.setRGB(0.4, 0.04, 0.04); else this.mat.emissive.copy(this.emi);
    }

    // 7) 暈倒：卡通式趴下——肚子貼地、腳折起來、下巴靠在地上、閉眼（遊戲會在頭上畫轉圈圈的星星）
    this.faint = toward(this.faint, this.faintOn ? 1 : 0, dt * 3);
    var fa = this.faint;
    this.d.group.rotation.z = -0.18 * fa;
    if (fa > 0.01) {
      hips.position.y -= this.hipY * 0.55 * fa;
      for (i = 0; i < this.legs.length; i++) {
        var Lf = this.legs[i], sp = Lf.left ? 1 : -1;
        if (Lf.arm) { Lf.root.rotation.x -= 0.6 * fa; continue; }
        if (Lf.front) { Lf.root.rotation.x -= 0.9 * fa; Lf.knee.rotation.x += 0.2 * fa; }
        else { Lf.root.rotation.x -= 0.6 * fa; Lf.knee.rotation.x += 1.3 * fa; Lf.ankle.rotation.x -= 0.8 * fa; }
        Lf.root.rotation.z += 0.25 * sp * fa;
      }
      for (i = 0; i < this.neck.length; i++) this.neck[i].rotation.x += 0.3 * fa;
      if (head) head.rotation.x += 0.15 * fa;
      for (i = 0; i < this.tail.length; i++) this.tail[i].rotation.x += 0.1 * fa;
      if (B.jaw) B.jaw.rotation.x *= 1 - fa; // 暈倒時把嘴閉上，不露牙
    }

    // 8) 眨眼（暈倒時閉眼）
    this.blinkT -= dt;
    if (this.blinkT < -0.13) this.blinkT = 2.2 + Math.random() * 3;
    var ey = this.blinkT < 0 ? 0.12 : 1;
    ey = Math.min(ey, 1 - 0.88 * fa);
    for (i = 0; i < this.d.eyes.length; i++) this.d.eyes[i].scale.y = ey;
  };
})();
