// One encounter clock owns the fall, camera pullback, arrival and final fade.
export const VICTORY=Object.freeze({pullback:2.8,cutOut:6.3,arrival:7.2,reveal:8.3,parked:16.2,fade:18,black:19.6,duration:20});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(t,a,b)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
export function victoryPose(t,distance=18){
 const arrival=t>=VICTORY.arrival,u=clamp((t-VICTORY.arrival)/(VICTORY.parked-VICTORY.arrival));
 const travel=2*u-u*u,jeepZ=-53*travel,jeepX=3*Math.sin(Math.PI*travel)**2;
 const dx=3*Math.PI*Math.sin(2*Math.PI*travel),jeepYaw=Math.atan2(-dx,53);
 const speed=arrival?106*(1-u)/(VICTORY.parked-VICTORY.arrival):10-5*smooth(t,distance<14?1.6:.8,distance<14?2.8:2);
 return {arrival,travel,jeepX:arrival?jeepX:0,jeepZ:arrival?jeepZ:0,jeepYaw:arrival?jeepYaw:0,speed,
  // watch: the camera tracks and pushes in on her fall; lean: the gunner rises
  // and leans out past the gun to see it.
  watch:smooth(t,.12,.9)*(1-smooth(t,4.6,6.1)),lean:smooth(t,.1,.8)*(1-smooth(t,VICTORY.pullback,4.6)),
  pullback:smooth(t,VICTORY.pullback,6.1),crane:smooth(t,VICTORY.arrival+1,VICTORY.parked+1),
  black:arrival?Math.max(1-smooth(t,VICTORY.arrival,VICTORY.reveal),smooth(t,VICTORY.fade,VICTORY.black)):smooth(t,VICTORY.cutOut,7),
  caption:smooth(t,10,11)*(1-smooth(t,VICTORY.fade-.5,VICTORY.fade)),complete:t>=VICTORY.duration};
}
