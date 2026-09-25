// One clock drives the collision, vehicle, camera, weapon and final bite.
// The interior is brisk: a short hold in the mouth, 1.8 s down the esophagus, a
// long look at the stomach, then face first into the acid.
export const DEFEAT={ram:1.65,spinEnd:4.65,walkAt:5,lookAt:8.55,openAt:8.90,lungeAt:9.22,biteSound:9.10,contact:9.56,swallowAt:9.46,headLiftAt:9.98,slideAt:10.40,headLiftEnd:10.55,bellyAt:12.20,plungeAt:13.45,acidAt:14.30,black:14.85,duration:15.35};
// Interior geometry shared by the scene and its tests: the esophagus runs from
// the mouth (z -1.1) to the cardia (ESOPHAGUS), curving down with the neck;
// the acid lies at ACID in the stomach beyond.
export const INTERIOR={start:-1.1,esophagus:7.4,acid:-5.3,chamberZ:11.2};
export const lumenCenter=z=>({x:.1*Math.sin(z*.45),y:-.045*z*z,z});
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=(x,a,b)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
const mix=(a,b,u)=>a+(b-a)*u;
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
// Lose focus on impact, then steadily recover through the spin and approach.
// The last trace of softness resolves just 100 ms before the final lunge.
export function defeatVision(t){
 const peakAt=DEFEAT.ram+.28,resolveAt=DEFEAT.openAt-.28;
 const dazed=ease(t,DEFEAT.ram,peakAt);
 const recovery=1-.85*clamp((t-peakAt)/(resolveAt-peakAt));
 return dazed*recovery*(1-ease(t,resolveAt,DEFEAT.lungeAt-.10));
}
// Entry, a still beat, head lift, then gravity takes over. The rig, interior
// camera and audio cues all use this timeline rather than independent delays.
export function swallowPose(t){
 const lift=ease(t,DEFEAT.headLiftAt,DEFEAT.headLiftEnd),progress=ease(t,DEFEAT.slideAt,DEFEAT.bellyAt);
 return{lift,progress,tilt:lift*(1-ease(progress,.04,.42)),opening:.18+.82*ease(t,DEFEAT.headLiftAt,DEFEAT.slideAt+.18),flow:Math.max(0,t-DEFEAT.slideAt),contraction:ease(t,DEFEAT.slideAt-.08,DEFEAT.slideAt+.28)};
}
// Overlap the throat's slowing exit with a gravity-led drop into the pool.
// Travel reaches the surface at 1, then loses speed smoothly under the fluid.
export function stomachPlunge(t){
 const duration=DEFEAT.acidAt-DEFEAT.plungeAt,u=clamp((t-DEFEAT.plungeAt)/duration);
 const submerged=Math.max(0,t-DEFEAT.acidAt),drag=.20;
 return{travel:u*u+2*drag/duration*(1-Math.exp(-submerged/drag)),look:ease(t,DEFEAT.acidAt-.55,DEFEAT.acidAt-.08),immersion:ease(t,DEFEAT.acidAt,DEFEAT.acidAt+.16),
  // Out of the cardia: she drops into the chamber and slides down its wall.
  drop:ease(t,DEFEAT.bellyAt-.15,DEFEAT.plungeAt+.1)};
}
/** Interior camera position (height and depth) from the defeat clock. */
export function interiorPath(t){
 const p=swallowPose(t),plunge=stomachPlunge(t),z=INTERIOR.start+(INTERIOR.esophagus-INTERIOR.start)*p.progress,c=lumenCenter(z);
 // Beyond the cardia: a slow slide down the chamber wall toward the pool, then
 // the fall into it (plunge.travel reaches 1 at the surface, then sinks on).
 const exit=c.y,ledge=exit-1.25*plunge.drop,surface=INTERIOR.acid;
 return{x:c.x+.62*plunge.drop,y:ledge+(surface-ledge)*plunge.travel,z:z+1.1*plunge.drop+1.3*plunge.travel};
}
export function defeatPose(t,start){
 const spin=ease(t,DEFEAT.ram,DEFEAT.spinEnd),after=Math.max(0,t-DEFEAT.ram);
 const jeepX=-1.45*spin,jeepZ=1.1*spin;
 const kick=Math.sin(Math.min(1,after/.28)*Math.PI)*Math.exp(-after*1.4);
 let x,z,heading;
 if(t<DEFEAT.ram){
  const rush=ease(t,0,DEFEAT.ram);x=mix(start.x,6.2,rush);z=mix(start.z,4.4,rush);
  const running=angle(start.heading,Math.PI-.28,ease(t,0,.5));
  heading=angle(running,Math.PI+1.05,ease(t,.85,DEFEAT.ram));
 }else if(t<DEFEAT.walkAt){
  // Follow through beside the spinning Jeep, then turn to face it.
  const follow=ease(t,DEFEAT.ram,DEFEAT.spinEnd);x=mix(6.2,1,follow);z=mix(4.4,16.5,follow);
  heading=angle(Math.PI+1.05,Math.PI+Math.atan2(1,1.8),follow);
 }else{
  // Approach with a relaxed jaw, stop to look, then push off into one gulp.
  // Follow a curved path, facing its tangent. Translating sideways while
  // facing the Jeep dragged the planted legs across the pelvis.
  const u=ease(t,DEFEAT.walkAt,DEFEAT.lookAt),v=1-u;
  x=v*v*v+3*v*u*u*-1.45+u*u*u*-1.45;
  z=v*v*v*16.5+3*v*v*u*14.7+3*v*u*u*12.1+u*u*u*9.9;
  const dx=3*v*v*-1+6*v*u*-1.45,dz=3*v*v*-1.8+6*v*u*-2.6+3*u*u*-2.2;
  heading=Math.PI+Math.atan2(-dx,-dz);
 }
 const look=ease(t,DEFEAT.lookAt-.45,DEFEAT.lookAt),lunge=ease(t,DEFEAT.lungeAt,9.55),swallow=swallowPose(t);
 const rear=ease(t,DEFEAT.openAt+.10,DEFEAT.lungeAt)*(1-ease(t,DEFEAT.lungeAt,9.46)),close=ease(t,9.45,9.69);
 if(t>=DEFEAT.walkAt)z+=.12*rear-2.7*lunge;
 return{x,z,heading,look,rear,lunge,headLift:swallow.lift,lean:.70*look+.35*lunge,
  jaw:1.10*ease(t,DEFEAT.openAt,DEFEAT.openAt+.22)*(1-close)+.025*close,
  ram:Math.sin(Math.PI*ease(t,1.0,2.05)),
  speed:(start.speed??10)*(1-ease(t,DEFEAT.ram,DEFEAT.spinEnd)),
  jeepX,jeepZ,jeepYaw:Math.PI*2*spin,
  jeepRoll:-.12*kick+Math.sin(after*12)*.035*Math.exp(-after*1.7)*ease(t,DEFEAT.ram,DEFEAT.ram+.1),jeepPitch:.07*kick,
  blood:.42*ease(t,DEFEAT.contact-.045,DEFEAT.contact+.035)*(1-ease(t,DEFEAT.contact+.08,DEFEAT.contact+.42)),
  swallow:swallow.progress,black:ease(t,DEFEAT.acidAt,DEFEAT.black),
 };
}
