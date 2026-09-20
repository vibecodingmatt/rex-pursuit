import * as T from 'three';

const X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1);
const smooth=T.MathUtils.smoothstep;
const pulse=(t,a,b,c,d)=>smooth(t,a,b)*(1-smooth(t,c,d));

/** Damped joint responses, staggered along the body, above the captured fall pose. */
export class FallFollowThrough {
 constructor(bones){
  this.channels=[];
  const add=(prefix,axis,kind,index,delay,frequency,damping,weight=1)=>{
   const bone=bones.find(b=>b.name.startsWith(prefix));
   if(bone)this.channels.push({bone,axis,kind,index,delay,frequency,damping,weight,angle:0,velocity:0});
  };
  for(let i=0;i<3;i++){
   add(`back_0${i+2}_`,X,'spine-pitch',i,i*.035,3.4,.78,.8+i*.12);
   add(`back_0${i+2}_`,Z,'spine-bend',i,i*.045,3,.74,.8+i*.12);
  }
  ['neck_01_','neck_03_','neck_05_','head_'].forEach((name,i)=>{
   add(name,X,'neck-pitch',i,.065+i*.075,2.8-i*.22,.64,i===3?.7:1);
   add(name,Z,'neck-bend',i,.06+i*.075,2.6-i*.18,.67,i===3?.6:.8);
  });
  for(let i=0;i<11;i++){
   const name=`tail_${String(i+1).padStart(2,'0')}_`;
   add(name,Z,'tail-sweep',i,.05+i*.064,2.65-i*.08,.68,.74+i*.035);
   add(name,X,'tail-drag',i,.09+i*.06,2.8-i*.08,.72,.75+i*.025);
  }
  for(const [i,side]of ['L','R'].entries()){
   add(`leg_02_${side}_`,X,'hip',i,.08+i*.16,2.4,.62);
   add(`leg_03_${side}_`,X,'knee',i,.15+i*.13,2.7,.65);
   add(`foot_02_01_${side}_`,X,'ankle',i,.22+i*.1,3.2,.70);
   add(`arm_01_${side}_`,X,'arm',i,.10+i*.14,3.1,.62);
   add(`arm_02_${side}_`,X,'wrist',i,.18+i*.13,3.5,.66);
  }
  add('jaw_01_',X,'jaw',0,.16,3.3,.66);
 }

 reset(){for(const c of this.channels){c.angle=0;c.velocity=0;}this.energy=0;}

 target(c,time){
  const t=time-c.delay;
  const collapse=pulse(t,.04,.48,.72,1.20);
  const impact=pulse(t,.78,.94,1.10,1.52);
  const rebound=pulse(t,1.38,1.75,1.98,2.50);
  const slide=pulse(t,2.24,2.57,2.83,3.38);
  let angle=0;
  switch(c.kind){
   case 'spine-pitch':angle=-.075*collapse+.065*impact-.045*rebound;break;
   case 'spine-bend':angle=.09*collapse-.075*impact+.045*slide;break;
   case 'neck-pitch':angle=.11*collapse-.125*impact+.075*rebound-.035*slide;break;
   case 'neck-bend':angle=.13*collapse-.11*impact+.065*rebound;break;
   case 'tail-sweep':angle=-.075*collapse+.09*impact-.055*rebound+.03*slide;break;
   case 'tail-drag':angle=.03*collapse-.04*impact+.025*rebound;break;
   case 'hip':angle=(c.index?-.27:.20)*collapse+(c.index?.20:-.16)*impact-.13*rebound+.07*slide;break;
   case 'knee':angle=(c.index?.20:-.25)*collapse+.22*impact-.16*rebound;break;
   case 'ankle':angle=.22*impact-.15*rebound+.08*slide;break;
   case 'arm':angle=-.28*collapse+.32*impact-.20*rebound+.08*slide;break;
   case 'wrist':angle=.20*collapse-.24*impact+.15*rebound;break;
   case 'jaw':angle=-.08*collapse+.085*impact-.07*rebound;break;
  }
  return angle*c.weight;
 }

 update(dt,time){
  // Substeps keep the damped springs stable when the render frame rate drops.
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  for(let i=0;i<steps;i++){
   const t=time-dt+(i+1)*h;
   for(const c of this.channels){
    const omega=c.frequency*Math.PI*2;
    c.velocity+=(omega*omega*(this.target(c,t)-c.angle)-2*c.damping*omega*c.velocity)*h;
    c.angle+=c.velocity*h;
   }
  }
  const settle=1-smooth(time,3.8,4.65),q=new T.Quaternion();
  this.energy=0;
  for(const c of this.channels){c.bone.quaternion.multiply(q.setFromAxisAngle(c.axis,c.angle*settle));this.energy+=Math.abs(c.velocity)*settle;}
 }
}
