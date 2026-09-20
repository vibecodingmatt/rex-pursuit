import * as T from 'three';

const TAU = Math.PI * 2;
const UP = new T.Vector3(0, 1, 0);
const LOCAL_RIGHT = new T.Vector3(1, 0, 0);
const smooth = T.MathUtils.smoothstep;
const clamp = T.MathUtils.clamp;

function swingArc(a, b, velocity, rootVelocity, duration, t, out) {
 // A long stride needs a deliberate recovery, but carrying road velocity
 // through a whole cubic swing throws the foot too far behind the hip.
 // Match contact velocity only through short, smooth toe-off/landing windows.
 const blend=t*t*t*(t*(t*6-15)+10),window=Math.min(.23,.13/duration);
 const takeoff=t<window?t*(1-t/window)**3:0;
 const landing=t>1-window?(t-1)*(1-(1-t)/window)**3:0;
 // Keep pelvis translation linear during a charge. Easing that translation
 // with the foot recovery lets the accelerating body outrun its own leg.
 out.copy(a).lerp(b,blend).addScaledVector(rootVelocity,duration*(t-blend));
 return out.addScaledVector(velocity.clone().sub(rootVelocity),(takeoff+landing)*duration);
}

/** Ground contacts live in scene space, where the road moves toward +Z. */
export class RunGait {
 constructor(actor, find) {
  this.actor = actor;
  actor.updateMatrixWorld(true);
  const actorQ = actor.getWorldQuaternion(new T.Quaternion());
  this.legs = ['L', 'R'].map((side, index) => {
   const hip = find(`leg_02_${side}_`);
   const knee = find(`leg_03_${side}_`);
   const ankle = find(`foot_02_01_${side}_`);
   const toe = find(`foot_02_04_${side}_end`);
   const h = hip.getWorldPosition(new T.Vector3());
   const k = knee.getWorldPosition(new T.Vector3());
   const a = ankle.getWorldPosition(new T.Vector3());
   const contact = toe.getWorldPosition(new T.Vector3());
   const ankleQ = ankle.getWorldQuaternion(new T.Quaternion());
   const footOffset = contact.clone().sub(a).applyQuaternion(ankleQ.clone().invert());
   const ankleLocal = actor.worldToLocal(a.clone());
   const toeLocal = actor.worldToLocal(contact.clone());
   const hipLocal = actor.worldToLocal(h.clone());
   const curls = [1, 2, 3].flatMap(digit => [2, 3].map(joint => find(`foot_${String(digit).padStart(2, '0')}_${String(joint).padStart(2, '0')}_${side}_`))).filter(Boolean);
   return {
    side, index, hip, knee, ankle, toe, curls,
    upperLength: h.distanceTo(k), lowerLength: k.distanceTo(a),
    restQ: actorQ.clone().invert().multiply(ankleQ), footOffset,
    contactX: toeLocal.x, groundY: toeLocal.y,
    // Center the hock's travel beneath the hip, not behind the pelvis.
    centerZ: hipLocal.z - .10 + toeLocal.z - ankleLocal.z,
    anchor: new T.Vector3(), swingFrom: new T.Vector3(), contact: new T.Vector3(),
    landing: new T.Vector3(), plantedQ: new T.Quaternion(),
    initialized: false, stance: false, phase: 0, extensionError: 0,
   };
  });
  this.reset();
 }

 reset() {
  this.phase = .06;
  this.speed = 10;
  this.frequency = .97;
  this.lastPosition = null;
  this.rootVelocity = new T.Vector3();
  this.groundVelocity = new T.Vector3(0, 0, 10);
  this.footfalls = [];
  this.approaching = false;
  for (const leg of this.legs) leg.initialized = false;
 }

 advance(dt, position, roadSpeed = 10, strength = 1, approach = false) {
  if(approach&&!this.approaching){
   // Both feet have settled during the pause after the spin. Begin a fresh
   // walking step, rather than resuming whichever recoil swing was interrupted.
   this.phase=0;this.speed=0;this.rootVelocity.set(0,0,0);
   for(const leg of this.legs)leg.initialized=false;
  }
  this.approaching=approach;
  const velocity = new T.Vector3();
  if(!this.lastPosition)this.speed=Math.max(0,roadSpeed);
  if (this.lastPosition && dt > 0) {
   velocity.copy(position).sub(this.lastPosition).divideScalar(dt);
   // Restart/camera-review teleports must not become a giant stride.
   if (velocity.length() > 24) {
    velocity.set(0, 0, 0);
    for (const leg of this.legs) leg.initialized = false;
   }
  }
  this.lastPosition = position.clone();
  this.rootVelocity.lerp(velocity, 1 - Math.exp(-dt * 12));
  this.groundVelocity.set(0, 0, Math.max(0, roadSpeed));
  const speed = clamp(Math.hypot(roadSpeed-this.rootVelocity.z,this.rootVelocity.x),0,17);
  this.speed = T.MathUtils.damp(this.speed, speed, 7, dt);
  this.frequency = ((approach?.42:.34) + this.speed * .063)*smooth(this.speed,.02,.45);
  this.runBlend = smooth(this.speed,3.4,6.5);
  // Keep a little reach in reserve for the pelvis accelerating over a planted foot.
  const reach=2.90+.23*smooth(this.speed,2.2,10)-.18*smooth(this.speed,10,15.3);
  // The final approach accelerates from rest. Transfer weight a little sooner
  // so the pelvis cannot outrun a long, low-speed plant and lock the knee.
  this.stanceFraction = clamp(reach*this.frequency/Math.max(.01,this.speed),.25,approach?.55:.68);
  this.travel = this.frequency>0?this.speed*this.stanceFraction/this.frequency:0;
  this.strideLength = this.frequency>0?this.speed/this.frequency:0;
  this.phase = (this.phase + dt * this.frequency * strength) % 1;
  this.strength = strength*smooth(this.speed,.05,1.5);
  const step = (this.phase * 2) % 1;
  return {
   phase: this.phase, cycle: this.phase * TAU, step: step * TAU,
   // Compress under load, extend into push-off, then settle into the next footfall.
   height: (-T.MathUtils.lerp(.075,.17,this.runBlend) - T.MathUtils.lerp(.020,.045,this.runBlend)*Math.cos(TAU*(step-.39)))*this.strength,
   sway: -Math.cos(TAU * (this.phase - .14)) * .055 * this.strength,
   roll: Math.sin(TAU * (this.phase - .04)) * .014 * this.strength,
   pitch: Math.sin(TAU * (step - .10)) * T.MathUtils.lerp(.006,.011,this.runBlend) * this.strength,
  };
 }

 solve(dt, heading, turningEntry=false, recoil=0) {
  const actor = this.actor;
  const headingQ = new T.Quaternion().setFromAxisAngle(UP, heading);
  const footAxis = LOCAL_RIGHT.clone().applyQuaternion(headingQ);
  // After the ram the torso still faces the Jeep while the body recoils.
  // Plant toward the actual motion relative to the road during that recovery,
  // instead of reaching forward and lifting a foot to rescue an impossible IK target.
  const travelAxis=new T.Vector3(0,0,1).applyQuaternion(headingQ);
  if(recoil>0)travelAxis.lerp(this.rootVelocity.clone().sub(this.groundVelocity).normalize(),recoil).normalize();
  for (const leg of this.legs) {
   const phase = (this.phase + leg.index * .5) % 1;
   // Braking changes the walk/run duty cycle. Keep each entrance step's
   // contact window until its next cycle, so a swing cannot become a plant
   // halfway through simply because the body slowed down.
   if(!turningEntry||!leg.initialized||phase<leg.phase)leg.duty=this.stanceFraction;
   const duty=leg.duty,stance = phase < duty;
   const wasStance = leg.stance;
   const baseQ = headingQ.clone().multiply(leg.restQ);
   const front = actor.localToWorld(new T.Vector3(leg.contactX, 0, leg.centerZ)).addScaledVector(travelAxis,this.travel/2);
   front.y = leg.groundY;
   let pitch, curl = 0,turnBlend=1;

   if (stance) {
    const u = phase / duty;
    if (!leg.initialized || !wasStance) {
     // Account for the partial frame after touchdown, then lock this contact to the road.
     leg.anchor.copy(front).addScaledVector(this.groundVelocity.clone().sub(this.rootVelocity), phase / Math.max(.01,this.frequency));
     leg.anchor.y = leg.groundY;
     leg.plantedQ.copy(baseQ);
    } else {
     leg.anchor.addScaledVector(this.groundVelocity, dt);
    }
    leg.contact.copy(leg.anchor);
    pitch = -.025 * (1 - smooth(u, 0, .20)) + .11 * smooth(u, .65, 1);
    if (leg.initialized && !wasStance) {
     const position = leg.anchor.clone().add(new T.Vector3(0, 0, -.35).applyQuaternion(headingQ));
     position.y = .035;
     this.footfalls.push({type:'footstep', position, side:leg.side, speed:this.speed});
    }
   } else {
    const swingDuration = (1 - duty) / Math.max(.01,this.frequency);
    const u = (phase - duty) / (1 - duty);
    turnBlend=smooth(u,0,.45);
    if (!leg.initialized) {
     leg.plantedQ.copy(baseQ);
     leg.swingFrom.copy(actor.localToWorld(new T.Vector3(leg.contactX, 0, leg.centerZ))).addScaledVector(travelAxis,-this.travel/2);
     leg.swingFrom.y = leg.groundY;
     leg.swingFrom.addScaledVector(this.rootVelocity, -u * swingDuration);
    } else if (wasStance) {
     // Reconstruct the exact toe-off instant. Advancing a full frame here
     // counted the start of the swing twice and snapped the hip at takeoff.
     leg.swingFrom.copy(leg.anchor).addScaledVector(this.groundVelocity, Math.max(0, dt - u * swingDuration));
    }
    // Predict the next plant while retaining ground-matched takeoff/landing velocities.
    leg.landing.copy(front).addScaledVector(this.rootVelocity, (1 - u) * swingDuration);
    leg.landing.y = leg.groundY;
    swingArc(leg.swingFrom, leg.landing, this.groundVelocity, this.rootVelocity, swingDuration, u, leg.contact);
    const lift = T.MathUtils.lerp(.17,.33,this.runBlend);
    leg.contact.y += Math.sin(Math.PI * u) ** 2 * lift * this.strength;
    leg.contact.x += (leg.side === 'L' ? -1 : 1) * Math.sin(Math.PI * u) * .065;
    // Hock folds on recovery; toes uncurl before the foot reaches the road.
    pitch = T.MathUtils.lerp(.11, -.025, smooth(u, .12, 1));
    curl = Math.sin(Math.PI * u) ** 2 * .055;
   }

   // Finish the entrance with both feet under the pelvis. Without this low-
   // speed settle, the last sideways contact survives the turn into the road.
   const settle=1-smooth(this.speed,.25,1.4);
   if(settle>0){
    const home=actor.localToWorld(new T.Vector3(leg.contactX,0,leg.centerZ));home.y=leg.groundY;
    leg.contact.lerp(home,settle);leg.anchor.copy(leg.contact);leg.plantedQ.slerp(baseQ,settle);
    pitch*=1-settle;curl*=1-settle;
   }
   // During the entrance turn, the lifted foot follows the new heading over
   // its recovery arc instead of snapping away from its planted orientation.
   const footQ=stance?leg.plantedQ.clone():turningEntry?leg.plantedQ.clone().slerp(baseQ,turnBlend):baseQ.clone();
   footQ.premultiply(new T.Quaternion().setFromAxisAngle(footAxis, pitch * this.strength));
   const offset = leg.footOffset.clone().applyQuaternion(footQ);
   const target = leg.contact.clone().sub(offset);
   if (!stance) {
    // Keep a little knee flexion on the forward reach. During a fast charge,
    // the same low swing arc would otherwise straighten and lock the leg.
    const hip = leg.hip.getWorldPosition(new T.Vector3());
    const horizontal = (target.x - hip.x) ** 2 + (target.z - hip.z) ** 2;
    // A loaded foot may be nearly extended during a hard turn. Build the
    // swing's flexion reserve after toe-off instead of lifting it in one frame.
    const swing=(phase-duty)/(1-duty);
    const reserve=turningEntry?.025+.075*smooth(swing,0,.18)*(1-recoil*smooth(swing,.78,1)):.10;
    const reach = leg.upperLength + leg.lowerLength - reserve;
    const lowest = hip.y - Math.sqrt(Math.max(.05, reach * reach - horizontal));
    if (target.y < lowest) {
     target.y = lowest;
     leg.contact.y = lowest + offset.y;
    }
   }
   this.solveLeg(leg, target, footQ, headingQ);
   // Curl only in the air; the stance toes remain a fixed support point.
   for (const bone of leg.curls) bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(LOCAL_RIGHT, curl));
   leg.initialized = true;
   leg.stance = stance;
   leg.phase = phase;
  }
 }

 drainFootfalls() { return this.footfalls.splice(0); }

 solveLeg(leg, target, footQ, headingQ) {
  const { hip, knee, ankle, upperLength: a, lowerLength: b } = leg;
  const h = hip.getWorldPosition(new T.Vector3());
  const k = knee.getWorldPosition(new T.Vector3());
  const direction = target.clone().sub(h);
  const distance = clamp(direction.length(), .45, a + b - .025);
  leg.extensionError = Math.max(0, direction.length() - distance);
  direction.normalize();
  const pole = new T.Vector3(leg.side === 'L' ? .10 : -.10, 0, 1).applyQuaternion(headingQ);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  const kneeTarget = h.clone().addScaledVector(direction, along).addScaledVector(pole, height);
  this.rotateWorld(hip, k.clone().sub(h), kneeTarget.clone().sub(h));
  const actualKnee = knee.getWorldPosition(new T.Vector3());
  const actualAnkle = ankle.getWorldPosition(new T.Vector3());
  const reachable = h.clone().addScaledVector(direction, distance);
  this.rotateWorld(knee, actualAnkle.sub(actualKnee), reachable.sub(actualKnee));
  ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(footQ));
  ankle.updateWorldMatrix(false, true);
 }

 rotateWorld(bone, from, to) {
  const delta = new T.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  const world = bone.getWorldQuaternion(new T.Quaternion()).premultiply(delta);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
  bone.updateWorldMatrix(false, true);
 }
}
