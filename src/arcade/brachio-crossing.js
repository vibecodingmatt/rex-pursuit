import * as T from 'three';
import {routeX,routeHeading,terrainY} from './world.js';
import {BRACHIO} from './rules.js';
import {LEVEL} from './water.js';

// A9, the 1994 moment: a brachiosaur wades across the river at a gravel ford and the launch
// passes under her belly, between her fore and hind legs. Her place is a function of the
// boat's travel, so seeking and Overdrive keep her in step: she walks in from the left bank,
// halts straddling the channel as the boat arrives, lowers her head to look at it and calls,
// then walks on to the right bank once it has passed. Her legs part the current, every
// footfall splashes, and water runs off her belly onto the boat as it goes under.
//
// Sizes, from the sculpt's hit volumes (scale 1): belly about 2.7 m up, feet at x +-1.1,
// forefeet at z 2.05, hind feet at z -1.35. At SCALE the gap between her fore and hind legs
// is about 4.2 m (the hull is 3.4 m) and her belly clears the gunner's eye by about a metre
// over the ford's half-metre of water.

const SCALE=1.7,GAP=.39,STRIDE=3.8,DUTY=.62,WALK=.11;
/** Feet in her model space (x side, z along her body), the leg's radius, hind, and the hip or shoulder height. */
const FEET=[[1.1,2.05,.42,0,3.4],[-1.1,2.05,.42,0,3.4],[1.12,-1.35,.5,1,4.35],[-1.12,-1.35,.5,1,4.35]];
// A lateral-sequence walk: hind +x, fore +x a quarter cycle later, then the -x pair half a cycle on.
const OFFSET=[.25,.75,0,.5];
// A smooth ramp: 0 below 0, x - w/2 above w, a parabola between.
const ramp=(x,w=16)=>x<=0?0:x>=w?x-w/2:x*x/(2*w);
/** One leg at gait phase f (cycles) into out (the shader's uLeg): planted for DUTY of the cycle, the
 * foot moving back exactly as fast as she walks, then a swing that folds the foot back, lifts it and
 * sets it down ahead. Returns the foot's offset along her body (model m) and whether it is up. */
function gait(f,walking,len,hind,out){
 f-=Math.floor(f);const S=DUTY*STRIDE*walking;let off,lift=0,flex=0,k=0;
 if(f<DUTY)off=S*(.5-f/DUTY);else{const s=(f-DUTY)/(1-DUTY);k=Math.sin(Math.PI*s);off=S*(s*s*(3-2*s)-.5);lift=.14*k*walking;flex=(hind?.5:.65)*k**.8*walking;}
 const a=Math.asin(T.MathUtils.clamp(off/len,-.8,.8));out.set(a,flex,lift,flex*(1-.6*k)-a);return [off,k>.15];
}

export class BrachioCrossing{
 constructor(brachio,world){
  this.b=brachio;this.world=world;this.on=false;this.phase=0;this.lateral=null;this.called=false;this.drip=0;
  this.feet=FEET.map(()=>({p:new T.Vector3(),last:null,down:true}));this.tmp=new T.Vector3();this.onCall=null;this.onStep=null;
 }
 /** Her offset across the channel (m, + toward screen-left) when the boat is d metres short of her. */
 static lateralAt(d){return WALK*(ramp(d-30)-ramp(-25-d));}
 hide(){if(this.on){this.on=false;this.b.mesh.visible=false;this.b.uniforms.uWalk.value.set(0,0,0,0);for(const l of this.b.uniforms.uLeg.value)l.set(0,0,0,0);}}
 update(game,dt){
  const b=this.b,id=game.stage.id,d=BRACHIO.z-game.travel;
  if(id!=='river'||d>290||d<-40||!b.ready){this.hide();return;}
  if(!this.on){this.on=true;this.called=false;this.lateral=null;b.show(0,BRACHIO.z,0);}
  // Across the channel at the ford, facing the way she walks (toward screen-right).
  const h=routeHeading(BRACHIO.z,id),px=Math.cos(h),pz=-Math.sin(h),fx=-px,fz=-pz;
  const lat=BrachioCrossing.lateralAt(d),moved=this.lateral===null?0:Math.abs(lat-this.lateral);this.lateral=lat;
  const speed=dt>0?moved/dt:0,walking=T.MathUtils.clamp(speed/.8,0,1);this.phase+=moved/(STRIDE*SCALE);
  const cx=routeX(BRACHIO.z,id)+px*lat,cz=BRACHIO.z+pz*lat,bed=terrainY(px*lat,BRACHIO.z,id,{river:true});
  // The body rides highest over each planted hind foot and rolls onto the side that bears the weight.
  const sway=2*Math.PI*(this.phase-.31),m=b.mesh;m.scale.setScalar(SCALE);m.rotation.set(0,Math.atan2(fx,fz),-.018*Math.cos(sway)*walking);
  m.position.set(cx-fx*GAP*SCALE,bed-.06+Math.cos(sway*2)*.03*SCALE*walking,cz-fz*GAP*SCALE);
  b.uniforms.uWalk.value.set(0,0,0,1);this.walking=walking;
  FEET.forEach(([,,,hind,len],i)=>{this.feet[i].gait=gait(this.phase+OFFSET[i],walking,len,hind,b.uniforms.uLeg.value[i]);});
  b.animate(dt);
  // The tail swings against the hips.
  b.uniforms.uTailRot.value.forEach((r,j)=>{r.y+=.035*(j+1)*Math.sin(sway)*walking;});
  // As the boat closes she lowers her neck and turns her head toward it; she calls 55 m out.
  const look=T.MathUtils.smoothstep(70-d,0,55)*(1-T.MathUtils.smoothstep(-d,5,25)),R=b.uniforms.uNeckRot.value;
  // Most of the lowering comes from the base of the neck; the head tips down a little more.
  [.36,.14,.08,.03,.08].forEach((k,j)=>{R[j].x-=look*k;R[j].y-=look*[.2,.14,.1,.06,.04][j];});
  if(!this.called&&d<55){this.called=true;b.call();}
  m.updateMatrixWorld(true);this.legs(dt,walking,d);
 }
 /** Legs in the water: collars and trails in the current, a splash where a foot comes down. */
 legs(dt,walking,d){
  const w=this.world,m=this.b.mesh;
  FEET.forEach(([x,z,r],i)=>{const f=this.feet[i],[off,swing]=f.gait;m.localToWorld(f.p.set(x,0,z+off));f.p.y=LEVEL;
   const up=walking>.05&&swing;
   if(f.last&&dt>0){const vx=(f.p.x-f.last.x)/dt,vz=(f.p.z-f.last.z)/dt;if(!up)w.river?.mover(f.p.x,f.p.z,r*SCALE*.85,vx,vz,1);
    if(f.down&&up){w.spray?.burst(f.p,.55);}
    if(!f.down&&!up){w.spray?.burst(f.p,1.1);w.river?.ring(f.p.x,f.p.z,1.3);this.onStep?.(f.p.clone());}}
   f.down=!up;(f.last??=new T.Vector3()).copy(f.p);});
  // Passing under: water streams off her belly and drips onto the boat.
  if(Math.abs(d)<16&&dt>0&&w.spray){this.drip+=dt*55;while(this.drip>=1){this.drip--;const p=m.localToWorld(this.tmp.set((Math.random()-.5)*2.2,2.75,-.9+Math.random()*3.2));
   w.spray.drop(p.x,p.y,p.z,(Math.random()-.5)*.3,-.5-Math.random(),(Math.random()-.5)*.3,.014+Math.random()*.018,2.2,.15,.55);}}
 }
}
