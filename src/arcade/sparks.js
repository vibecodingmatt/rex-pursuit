import * as T from 'three';

// A8: the live ends of cut fence wire. Each end crackles in irregular bursts: a blue-white
// flash, then a spray of sparks that fall, skip once off the ground and cool from white
// through orange to nothing. Emitters are world points the chunks own (userData.sparks).
const MAX=240;
const VS=`uniform float uScale;attribute float aSize;attribute vec3 aColor;varying vec3 vColor;
void main(){vColor=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize>0.?max(1.5,uScale*aSize/-mv.z):0.;}`;
const FS=`varying vec3 vColor;void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c)*4.;if(d>1.)discard;gl_FragColor=vec4(vColor*(1.-d)*(1.-d),1.);}`;
const HOT=new T.Color(3.2,3.1,3.6),WARM=new T.Color(2.6,.95,.22),FLASH=new T.Color(2.4,2.9,4.4),c=new T.Color();

export class Sparks {
 constructor(scene){
  this.pool=Array.from({length:MAX},()=>({life:0,age:0,pos:new T.Vector3(),vel:new T.Vector3(),size:0,flash:false,floor:0}));
  this.position=new Float32Array(MAX*3);this.size=new Float32Array(MAX);this.color=new Float32Array(MAX*3);
  const g=new T.BufferGeometry();
  for(const [name,array,n]of [['position',this.position,3],['aSize',this.size,1],['aColor',this.color,3]])g.setAttribute(name,new T.BufferAttribute(array,n).setUsage(T.DynamicDrawUsage));
  this.scale={value:600};
  this.points=new T.Points(g,new T.ShaderMaterial({uniforms:{uScale:this.scale},vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  this.points.frustumCulled=false;this.points.userData.noReflect=true;this.points.renderOrder=62;scene.add(this.points);
  this.timers=new WeakMap();this.cues=[];this.next=0;
 }
 take(){for(let i=0;i<MAX;i++){const p=this.pool[(this.next+i)%MAX];if(p.age>=p.life){this.next=(this.next+i+1)%MAX;return p;}}return null;}
 burst(at,camera){
  const r=Math.random,f=this.take();if(f)Object.assign(f,{age:0,life:.08,size:.7+r()*.35,flash:true,floor:-1e9}).pos.copy(at),f.vel.set(0,0,0);
  for(let i=0,n=7+Math.floor(r()*13);i<n;i++){const p=this.take();if(!p)break;
   Object.assign(p,{age:0,life:.25+r()*.5,size:.05+r()*.04,flash:false,floor:at.y-.03});p.pos.copy(at);p.vel.set((r()-.5)*4.5,.8+r()*3.6,(r()-.5)*4.5);}
  const d=at.distanceTo(camera.position);if(d<28)this.cues.push({type:'spark',at,near:1-d/28});
 }
 /** Steps every live end within range (`emitters`, world points) and the sparks already flying. */
 update(dt,emitters,camera,height){
  this.scale.value=height/(2*Math.tan(camera.fov*Math.PI/360));
  if(dt>0)for(const e of emitters){let t=this.timers.get(e)??Math.random()*.9;t-=dt;if(t<=0){this.burst(e,camera);t=.16+Math.random()**2*1.4;}this.timers.set(e,t);}
  for(let i=0;i<MAX;i++){const p=this.pool[i];let size=0;
   if(p.age<p.life){p.age+=dt;const u=Math.min(1,p.age/p.life);
    if(!p.flash){p.vel.y-=9.8*dt;p.pos.addScaledVector(p.vel,dt);if(p.pos.y<p.floor){p.pos.y=p.floor;p.vel.y*=-.3;p.vel.x*=.45;p.vel.z*=.45;}}
    c.copy(p.flash?FLASH:HOT).lerp(p.flash?FLASH:WARM,p.flash?0:Math.min(1,u*1.6)).multiplyScalar(p.flash?1-u:(1-u)*(1-u*.5));
    size=p.age<p.life?p.size:0;this.color.set([c.r,c.g,c.b],i*3);}
   this.size[i]=size;this.position.set([p.pos.x,p.pos.y,p.pos.z],i*3);}
  const g=this.points.geometry;for(const k of ['position','aSize','aColor'])g.attributes[k].needsUpdate=true;
 }
 drain(){return this.cues.splice(0);}
 reset(){for(const p of this.pool)p.age=p.life=0;this.cues=[];}
}
