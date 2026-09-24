import * as T from 'three';

const X = new T.Vector3(1, 0, 0), Y = new T.Vector3(0, 1, 0);

// Step-cycle keys. A position from 0 to 1 is the fraction of stance (0 is
// touchdown, 1 toe-off); from 1 to 2 it is 1 plus the fraction of swing.
// Values are [walk, run] angles in radians.
const CYCLE = {
 // Metatarsus pitch over the planted toes: it leans back as the foot lands,
 // then rolls forward over the balls of the toes into push-off.
 roll: [[0, -.06, -.07], [.5, .04, .03], [1, .24, .30], [1.35, .12, .14], [1.72, 0, 0]],
 // Tip-down pitch of each phalanx. The ball of the foot lifts first and the
 // toes peel off from the base outward, leaving the claw tip for last. In the
 // air they curl, then straighten across the rest of the swing to arrive flat
 // at touchdown. While tipped down the claw stays lowest, so they cannot touch
 // the road early.
 proximal: [[0, 0, 0], [.55, 0, 0], [1, .18, .24], [1.25, .21, .25]],
 middle: [[0, 0, 0], [.7, 0, 0], [1, .06, .09], [1.3, .32, .36]],
 distal: [[0, 0, 0], [.8, 0, 0], [1, .02, .03], [1.3, .54, .60]],
 // The outer and inner toes gather under the lifted foot and fan out again
 // just before contact. Planted toes never spread, so they cannot skid.
 spread: [[0, 0, 0], [.85, 0, 0], [1.12, -.04, -.05], [1.4, -.13, -.15], [1.75, -.02, -.02], [1.92, .05, .05]],
 hallux: [[0, 0, 0], [.85, 0, 0], [1.35, .32, .32], [1.8, .04, .04]],
};
// Recoil steps after the ram travel sideways or backward while the torso still
// faces the Jeep, and swing far and fast. There the foot keeps the small rigid
// tilt that already suited those steps: a forward roll would carry the ankle
// away from the hip, and curled toes would make the knee fold faster still.
const TILT = [[0, -.025, -.025], [.2, 0, 0], [.65, 0, 0], [1, .11, .11], [1.12, .11, .11]];
const RECOIL = {roll: TILT, proximal: TILT, middle: TILT, distal: TILT};

const xs = [], ys = [];
function tangent(k, n) {
 const a = (k + n - 1) % n, b = (k + 1) % n;
 const ha = xs[k] - (a < k ? xs[a] : xs[a] - 1), hb = (b > k ? xs[b] : xs[b] + 1) - xs[k];
 const da = (ys[k] - ys[a]) / ha, db = (ys[b] - ys[k]) / hb;
 return da * db <= 0 ? 0 : 3 * (ha + hb) / ((2 * hb + ha) / da + (hb + 2 * ha) / db);
}

/** Periodic monotone cubic through the keys, so held poses stay exactly held. */
function sample(keys, duty, run, phase) {
 const n = keys.length;
 for (let i = 0; i < n; i++) {
  const [at, walk, sprint] = keys[i];
  xs[i] = at < 1 ? at * duty : duty + (at - 1) * (1 - duty);
  ys[i] = walk + (sprint - walk) * run;
 }
 let i = 0;
 while (i < n - 1 && xs[i + 1] <= phase) i++;
 const j = (i + 1) % n, h = (j ? xs[j] : 1) - xs[i], t = (phase - xs[i]) / h, t2 = t * t, t3 = t2 * t;
 return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * tangent(i, n) + (3 * t2 - 2 * t3) * ys[j] + (t3 - t2) * h * tangent(j, n);
}

/**
 * Foot roll and toe articulation on the rig's own toe bones. Angles are relative
 * to the planted foot, so the middle claw tip remains the gait's contact point:
 * `reach()` supplies the ankle-to-claw vector for the leg IK and `apply()` poses
 * the toes after the ankle has been solved.
 */
export class FootMotion {
 constructor(actor, find, side) {
  actor.updateMatrixWorld(true);
  const actorQ = actor.getWorldQuaternion(new T.Quaternion());
  const left = X.clone().applyQuaternion(actorQ), up = Y.clone().applyQuaternion(actorQ);
  const bone = name => find(`${name}_${side}_`), head = b => b.getWorldPosition(new T.Vector3());
  const ankle = bone('foot_02_01'), toAnkle = ankle.getWorldQuaternion(new T.Quaternion()).invert();
  // The metatarsus rolls about the line through the balls of the toes, so all
  // three stay on the ground while the planted foot rolls.
  const across = head(bone('foot_01_02')).sub(head(bone('foot_03_02')));
  if (across.dot(left) < 0) across.negate();
  this.hinge = across.applyQuaternion(toAnkle).normalize();
  this.up = up.applyQuaternion(toAnkle).normalize();
  this.ball = head(bone('foot_02_02')).sub(head(ankle)).applyQuaternion(toAnkle);
  const joint = (b, next) => {
   const toBone = b.getWorldQuaternion(new T.Quaternion()).invert();
   // Hinge across the phalanx (its local Y runs along the bone). A positive
   // angle tips the toe down, the same sense as the gait's foot roll.
   const hinge = left.clone().applyQuaternion(toBone);hinge.y = 0;hinge.normalize();
   return {bone: b, rest: b.quaternion.clone(), hinge, relative: toAnkle.clone().multiply(toBone.clone().invert()), segment: next && head(next).sub(head(b)).applyQuaternion(toBone)};
  };
  const sideSign = side === 'L' ? 1 : -1;
  // The middle toe comes first: its claw tip is the gait's contact point.
  this.digits = ['02', '01', '03'].map(digit => {
   const bones = ['02', '03', '04'].map(j => bone(`foot_${digit}_${j}`));
   const tip = find(`foot_${digit}_04_${side}_end`);
   return {
    metatarsal: digit === '02' ? new T.Quaternion() : bone(`foot_${digit}_01`).quaternion.clone(),
    spread: digit === '02' ? 0 : (digit === '01' ? 1 : -1) * sideSign,
    joints: bones.map((b, i) => joint(b, bones[i + 1] || tip)),
   };
  });
  this.hallux = ['01', '02', '03'].map(j => bone(`foot_04_${j}`)).filter(Boolean).map(b => joint(b));
  this.angles = {roll: 0, toes: [0, 0, 0], spread: 0, hallux: 0};
  this.rollQ = new T.Quaternion();
  this.q = new T.Quaternion();this.r = new T.Quaternion();this.v = new T.Vector3();
 }

 /** Evaluate the step cycle. `weight` fades the whole motion; `recoil` blends toward the recoil tilt. */
 update(phase, duty, run, weight, recoil = 0) {
  const a = this.angles;
  const pitch = keys => {
   const full = sample(CYCLE[keys], duty, run, phase);
   return (recoil > 0 ? full + (sample(RECOIL[keys], duty, run, phase) - full) * recoil : full) * weight;
  };
  a.roll = pitch('roll');
  a.toes[0] = pitch('proximal');
  a.toes[1] = pitch('middle');
  a.toes[2] = pitch('distal');
  a.spread = sample(CYCLE.spread, duty, run, phase) * weight;
  a.hallux = sample(CYCLE.hallux, duty, run, phase) * weight;
  this.rollQ.setFromAxisAngle(this.hinge, a.roll);
  return this;
 }

 /** Ankle-to-claw-tip vector in the ankle's rest frame for the current angles. */
 reach(out) {
  out.copy(this.ball).applyQuaternion(this.rollQ);
  for (const [i, j] of this.digits[0].joints.entries()) {
   out.add(this.v.copy(j.segment).applyQuaternion(this.q.setFromAxisAngle(j.hinge, this.angles.toes[i])).applyQuaternion(j.relative));
  }
  return out;
 }

 /** Pose the toe bones beneath an ankle already oriented by `rollQ`. */
 apply() {
  const {roll, toes, spread, hallux} = this.angles;
  for (const digit of this.digits) {
   const [first, second, third] = digit.joints;
   // Undo the metatarsus roll at the ball (keeping planted toes flat), then spread.
   this.q.setFromAxisAngle(this.hinge, -roll).multiply(this.r.setFromAxisAngle(this.up, spread * digit.spread));
   first.bone.quaternion.copy(digit.metatarsal).invert().multiply(this.q).multiply(digit.metatarsal).multiply(first.rest).multiply(this.r.setFromAxisAngle(first.hinge, toes[0]));
   second.bone.quaternion.setFromAxisAngle(first.hinge, -toes[0]).multiply(second.rest).multiply(this.r.setFromAxisAngle(second.hinge, toes[1]));
   third.bone.quaternion.setFromAxisAngle(second.hinge, -toes[1]).multiply(third.rest).multiply(this.r.setFromAxisAngle(third.hinge, toes[2]));
  }
  this.hallux.forEach((j, i) => j.bone.quaternion.copy(j.rest).multiply(this.q.setFromAxisAngle(j.hinge, hallux * (i ? 1 : .4))));
 }
}
