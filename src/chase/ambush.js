// A single authored detour, in Jeep-relative metres. The road keeps moving.
export const AMBUSH={duration:8.3,vanish:2.35,returnAt:5.1,crashAt:6.78,fireAt:6.85};
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const slope=x=>x>0&&x<1?6*x*(1-x):0;
export function ambushPose(t,startDistance=21,startX=0){
 let x,z,vx,vz;
 const deepZ=Math.max(23,startDistance+3);
 if(t<AMBUSH.vanish){
  const u=t/AMBUSH.vanish,s=ease(u),d=deepZ;
  x=startX+(23-startX)*s;z=startDistance+(d-startDistance)*s;
  vx=(23-startX)*slope(u)/AMBUSH.vanish;vz=(d-startDistance)*slope(u)/AMBUSH.vanish;
 }else if(t<AMBUSH.returnAt){
  // Keep her physically present behind the understory. There is no visibility
  // cut or cross-road teleport, even from the wider external camera.
  const duration=AMBUSH.returnAt-AMBUSH.vanish,u=(t-AMBUSH.vanish)/duration,s=ease(u);
  x=23-2*s;z=deepZ+(16-deepZ)*s;vx=-2*slope(u)/duration;vz=(16-deepZ)*slope(u)/duration;
 }else{
  const u=(t-AMBUSH.returnAt)/3,s=ease(u);
  x=21*(1-s);z=16-6.2*s;vx=-21*slope(u)/3;vz=-6.2*slope(u)/3;
 }
 return{x,z,heading:Math.atan2(vx,vz-10),visible:true,occluded:t>=AMBUSH.vanish&&t<AMBUSH.returnAt};
}
