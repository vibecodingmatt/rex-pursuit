import * as T from 'three';
import {BOW,halfBeam} from './boat.js';
import {LEVEL} from './water.js';

// A9: thrown water, in world space. Every drop is a billboard stretched along its own motion,
// lit by the stage's key and fill and glowing when the sun is behind it. Drops fly under
// gravity and air drag and vanish where they fall back into the river. Emitters:
// - the launch's bow: two sheets peel off the stem and fly out and up, and a slapped wave
//   throws a burst over the bow;
// - a crown and a central column where something breaks the surface (`burst`);
// - a sheet off anything ploughing through the water (`sheet`: wading legs).

const CAP=2400,G=9.8;
const vertexShader=`
attribute vec3 iPos;attribute vec3 iVel;attribute vec2 iData;
uniform float uStretch;uniform vec3 uSunDir;uniform vec3 uCamVel;
varying vec2 vUv;varying float vAlpha;varying float vGlow;
#include <common>
#include <fog_pars_vertex>
void main(){
 // Stretch along the drop's motion relative to the eye (the boat carries the camera).
 vec4 mvPosition=viewMatrix*vec4(iPos,1.);vec3 vv=(viewMatrix*vec4(iVel-uCamVel,0.)).xyz;
 vec2 dir=vv.xy;float sp=length(dir);dir=sp>1e-3?dir/sp:vec2(0.,1.);
 float len=iData.x+sp*uStretch;mvPosition.xy+=dir*position.y*len+vec2(dir.y,-dir.x)*position.x*iData.x;
 vUv=position.xy*2.;vAlpha=iData.y;vGlow=pow(max(dot(normalize(iPos-cameraPosition),uSunDir),0.),5.);
 gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
const fragmentShader=`
uniform vec3 uSun;uniform vec3 uFill;
varying vec2 vUv;varying float vAlpha;varying float vGlow;
#include <common>
#include <fog_pars_fragment>
void main(){
 // A clump of drops: a dense core in a soft halo of finer spray.
 float r=dot(vUv,vUv);if(r>1.)discard;
 vec3 col=vec3(.9,.95,.95)*(uFill*1.4+uSun*.9)+uSun*vGlow*1.8;
 gl_FragColor=vec4(col,(smoothstep(1.,.15,r)*.55+smoothstep(.35,0.,r)*.45)*vAlpha);
 #include <fog_fragment>
}`;

export class Spray{
 constructor(scene){
  const g=new T.InstancedBufferGeometry();g.copy(new T.PlaneGeometry(1,1));
  this.pos=new Float32Array(CAP*3);this.vel=new Float32Array(CAP*3);this.data=new Float32Array(CAP*2);
  this.age=new Float32Array(CAP);this.life=new Float32Array(CAP);this.drag=new Float32Array(CAP);this.base=new Float32Array(CAP);
  const attr=(a,n)=>{const b=new T.InstancedBufferAttribute(a,n);b.setUsage(T.DynamicDrawUsage);return b;};
  g.setAttribute('iPos',this.aPos=attr(this.pos,3));g.setAttribute('iVel',this.aVel=attr(this.vel,3));g.setAttribute('iData',this.aData=attr(this.data,2));g.instanceCount=0;
  this.uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{uStretch:{value:.05},uCamVel:{value:new T.Vector3()},uSunDir:{value:new T.Vector3(0,1,0)},uSun:{value:new T.Color(1,1,1)},uFill:{value:new T.Color(.3,.3,.3)}}]);
  // UniformsUtils.merge clones; the arcade's shared fog objects must stay shared (light.js).
  for(const k of ['fogSun','fogGlow','fogShape'])if(T.UniformsLib.fog[k])this.uniforms[k]=T.UniformsLib.fog[k];
  this.mesh=new T.Mesh(g,new T.ShaderMaterial({uniforms:this.uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,fog:true,side:T.DoubleSide}));
  this.mesh.frustumCulled=false;this.mesh.renderOrder=2;this.mesh.userData.noReflect=true;scene.add(this.mesh);
  this.n=0;this.scale=1;this.carry=0;this.slapWas=0;this.v=new T.Vector3();this.p=new T.Vector3();this.q=new T.Quaternion();
 }
 /** One drop: world position, velocity, width (m), life (s), drag (1/s), opacity. */
 drop(px,py,pz,vx,vy,vz,size,life,drag=.5,alpha=.8){
  if(this.n>=CAP)return;const i=this.n++,k=i*3;
  this.pos[k]=px;this.pos[k+1]=py;this.pos[k+2]=pz;this.vel[k]=vx;this.vel[k+1]=vy;this.vel[k+2]=vz;
  this.data[i*2]=size;this.age[i]=0;this.life[i]=life;this.drag[i]=drag;this.base[i]=alpha;
 }
 /** Something breaks the surface at p: a crown thrown out and up and a column in the middle. */
 burst(p,strength=1){
  const n=Math.round(90*strength*this.scale),TAU=Math.PI*2;
  for(let i=0;i<n;i++){const a=i/n*TAU+Math.random()*.3,out=(1.4+Math.random()*2.6)*Math.sqrt(strength),up=(2.2+Math.random()*3.4)*Math.sqrt(strength),r=.25+Math.random()*.5*strength;
   this.drop(p.x+Math.cos(a)*r,LEVEL+.05,p.z+Math.sin(a)*r,Math.cos(a)*out,up,Math.sin(a)*out,.07+Math.random()*.1*strength,1.4,.6,.9);}
  for(let i=0,m=Math.round(30*strength*this.scale);i<m;i++){const a=Math.random()*TAU,s=Math.random()*.6;
   this.drop(p.x+Math.cos(a)*s*.4,LEVEL+.1,p.z+Math.sin(a)*s*.4,Math.cos(a)*s,(4+Math.random()*4.5)*Math.sqrt(strength),Math.sin(a)*s,.1+Math.random()*.12,1.6,.35,.85);}
 }
 /**
  * A continuous sheet off a point ploughing through the water: `rate` drops a second, thrown
  * along `out` (a world direction, its length the speed) and up, on top of the mover's velocity.
  */
 sheet(p,vx,vz,out,up,rate,dt,size=.09){
  this.carry+=rate*dt*this.scale;
  while(this.carry>=1){this.carry--;const j=.6+Math.random()*.8;
   this.drop(p.x+(Math.random()-.5)*.3,LEVEL+.04,p.z+(Math.random()-.5)*.3,vx*.85+out.x*j+(Math.random()-.5)*.8,up*(.55+Math.random()*.7),vz*.85+out.z*j+(Math.random()-.5)*.8,size*(.7+Math.random()*.8),1.1,.7,.9);}
 }
 /**
  * The launch at `speed` m/s (boat root `root`, forward -Z): the bow wave leaves the hull as
  * two sheets of spray off the chines (seen beside the foredeck, since the stem itself is
  * below the gunner's line of sight), with mist trailing them (`effects.spume`); a slapped
  * wave (`slap` 0..1 from the rig) throws a burst up over the bow.
  */
 bow(dt,root,speed,slap=0,effects=null){
  if(!root.visible||speed<3||dt<=0)return;
  const run=Math.min(1.25,speed/24),q=root.getWorldQuaternion(this.q),fwd=this.v.set(0,0,-1).applyQuaternion(q),fx=fwd.x*speed,fz=fwd.z*speed;
  const n=Math.floor((this.bowCarry=(this.bowCarry||0)+dt*560*run*this.scale));this.bowCarry-=n;
  for(let i=0;i<n;i++){const side=i%2?1:-1,a=.8+Math.random()*3.6,z=BOW+a,x=side*(halfBeam(z)+.05);
   const p=root.localToWorld(this.p.set(x,.05,z)),o=this.v.set(side*(3.2+Math.random()*4.2),0,Math.random()*1.4).applyQuaternion(q);
   this.drop(p.x,LEVEL+.05,p.z,fx*.97+o.x*run,(2.8+Math.random()*3.4)*run,fz*.97+o.z*run,.06+Math.random()*.08,1.2,.42,.6);}
  if(effects&&(this.mist=(this.mist||0)+dt*14*run*this.scale)>=1){this.mist--;const side=Math.random()<.5?-1:1,z=BOW+1.5+Math.random()*3,p=root.localToWorld(this.p.set(side*(halfBeam(z)+.6+Math.random()*.8),.35,z));
   const o=this.v.set(side*(2+Math.random()*2),1.2,1.5).applyQuaternion(q);effects.spume(p.clone(),new T.Vector3(fx*.9+o.x,o.y,fz*.9+o.z),{size:.9,growth:2.4,opacity:.16,life:1.1,drag:1.2});}
  // A slap: the bow drops into a wave and throws a burst forward and up over the pulpit.
  if(slap>.55&&this.slapWas<=.55)for(let i=0,m=Math.round(70*this.scale);i<m;i++){const side=Math.random()<.5?-1:1,z=BOW+.2+Math.random()*1.4,x=side*(halfBeam(z)+.05);
   const p=root.localToWorld(this.p.set(x,.1,z)),o=this.v.set(side*(1.5+Math.random()*3),0,-(1+Math.random()*2.5)).applyQuaternion(q);
   this.drop(p.x,LEVEL+.1,p.z,fx+o.x,4.5+Math.random()*3.5,fz+o.z,.12+Math.random()*.16,1.3,1.6,.85);}
  this.slapWas=slap;
 }
 reset(){this.n=0;this.carry=0;this.bowCarry=0;}
 /** Step every drop; `light`: {dir, sun (Color), fill (Color)}; `camVel` the eye's velocity. */
 update(dt,light,camVel){
  if(camVel)this.uniforms.uCamVel.value.copy(camVel);
  if(light){this.uniforms.uSunDir.value.copy(light.dir);this.uniforms.uSun.value.copy(light.sun);this.uniforms.uFill.value.copy(light.fill);}
  const P=this.pos,V=this.vel;
  for(let i=0;i<this.n;){const k=i*3;this.age[i]+=dt;const d=Math.exp(-this.drag[i]*dt);
   V[k]*=d;V[k+1]=V[k+1]*d-G*dt;V[k+2]*=d;P[k]+=V[k]*dt;P[k+1]+=V[k+1]*dt;P[k+2]+=V[k+2]*dt;
   if(this.age[i]>=this.life[i]||(P[k+1]<LEVEL&&V[k+1]<0)){this.n--;if(i!==this.n){const j=this.n,m=j*3;
     P[k]=P[m];P[k+1]=P[m+1];P[k+2]=P[m+2];V[k]=V[m];V[k+1]=V[m+1];V[k+2]=V[m+2];this.data[i*2]=this.data[j*2];this.age[i]=this.age[j];this.life[i]=this.life[j];this.drag[i]=this.drag[j];this.base[i]=this.base[j];}continue;}
   const t=this.age[i]/this.life[i];this.data[i*2+1]=this.base[i]*(1-t*t)*Math.min(1,this.age[i]*25);i++;}
  this.mesh.geometry.instanceCount=this.n;
  for(const a of [this.aPos,this.aVel,this.aData]){a.clearUpdateRanges?.();a.addUpdateRange?.(0,this.n*a.itemSize);a.needsUpdate=true;}
 }
}
