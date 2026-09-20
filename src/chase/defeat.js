// One clock drives the collision, vehicle, camera, weapon and final bite.
export const DEFEAT={ram:1.65,spinEnd:4.65,walkAt:5,lookAt:8.55,openAt:8.90,lungeAt:9.22,biteSound:9.10,contact:9.56,black:10.50,duration:11.05};
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=(x,a,b)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
const mix=(a,b,u)=>a+(b-a)*u;
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
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
  const follow=ease(t,DEFEAT.ram,DEFEAT.spinEnd);x=mix(6.2,6.5,follow);z=mix(4.4,12,follow);
  heading=angle(Math.PI+1.05,Math.PI+.88,follow);
 }else{
  // Approach with a relaxed jaw, stop to look, then push off into one gulp.
  const walk=ease(t,DEFEAT.walkAt,DEFEAT.lookAt);x=mix(6.5,-1.45,walk);z=mix(12,9.9,walk);
  heading=angle(Math.PI+.88,Math.PI,ease(t,DEFEAT.walkAt,DEFEAT.lookAt-.1));
 }
 const look=ease(t,DEFEAT.lookAt-.45,DEFEAT.lookAt),lunge=ease(t,DEFEAT.lungeAt,9.55);
 const rear=ease(t,DEFEAT.openAt+.10,DEFEAT.lungeAt)*(1-ease(t,DEFEAT.lungeAt,9.46)),close=ease(t,9.45,9.69);
 if(t>=DEFEAT.walkAt)z+=.12*rear-2.7*lunge;
 return{x,z,heading,look,rear,lunge,lean:.70*look+.35*lunge,
  jaw:1.10*ease(t,DEFEAT.openAt,DEFEAT.openAt+.22)*(1-close)+.025*close,
  ram:Math.sin(Math.PI*ease(t,1.0,2.05)),
  speed:(start.speed??10)*(1-ease(t,DEFEAT.ram,DEFEAT.spinEnd)),
  jeepX,jeepZ,jeepYaw:Math.PI*2*spin,
  jeepRoll:-.12*kick+Math.sin(after*12)*.035*Math.exp(-after*1.7)*ease(t,DEFEAT.ram,DEFEAT.ram+.1),jeepPitch:.07*kick,
  blood:ease(t,DEFEAT.contact-.045,DEFEAT.contact+.035),black:ease(t,DEFEAT.contact+.28,DEFEAT.black),
 };
}
