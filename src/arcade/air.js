import * as T from 'three';
import {createInsects} from '../chase/insects.js';
import {createBirds} from '../chase/birds.js';
import {NIGHT,WIND_GUST} from '../chase/weather-state.js';
// A5 The air is alive: motes and embers in the light, falling leaves, Pursuit's insects
// and startled flocks, plus the wind gusts and push-aside that bend the planting.
// Everything here is world-anchored: the vehicle moves through it, it does not ride along.

const TAU=Math.PI*2,clamp=T.MathUtils.clamp;
let seed=4021;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};

// Per stage: motes [count share, colour, strength, rise m/s], leaves (forest litter falling), flocks, insects, night.
const AIR={
 gates:{motes:[1,0xffe2b0,1,.03],leaves:.65,birds:true,insects:true},
 river:{motes:[.8,0xfff4dc,.75,.02],leaves:.25,birds:true,insects:true},
 fault:{motes:[.9,0xff8a3c,1.6,.9],embers:true,leaves:0,birds:false,insects:false},
 hybrid:{motes:[.45,0xfff4dc,.5,.02],leaves:.2,birds:true,insects:true},
 lagoon:{motes:[.5,0xffb48a,.6,.02],leaves:0,birds:true,insects:true},
 manor:{motes:[.5,0xb4c8ee,.5,.01],leaves:0,birds:false,insects:true,night:1},
 visitor:{motes:[.55,0xb4c8ee,.55,.01],leaves:.2,birds:false,insects:true,night:1}
};

// Shared with the planting shader (world.js patches the foliage kit): up to eight pushers
// (x, z, radius, strength) and one rolling gust front (strength, wind x, wind z, phase).
export const PUSH={value:Array.from({length:8},()=>new T.Vector4())};
export const GUST={value:new T.Vector4(0,.8,.6,0)};
export const PLANT_PUSH=`
    {
     // Arcade: the vehicle and running animals shoulder plants aside, and gust fronts roll
     // across the field. Small plants give way; trees and lying litter do not.
     #ifdef USE_INSTANCING
      mat3 toLocal=mat3(modelMatrix*instanceMatrix);
     #else
      mat3 toLocal=mat3(modelMatrix);
     #endif
     float give=smoothstep(9.,1.5,H)*(1.-still)*(1.-smoothstep(45.,60.,abs(anchor.z-cameraPosition.z)));
     if(give>0.){
      float s2=max(dot(toLocal[0],toLocal[0]),1e-4);vec3 shove=vec3(0.);
      for(int i=0;i<8;i++){vec4 p=uPush[i];if(p.z<=0.)continue;vec2 dv=anchor.xz-p.xy;float dd=length(dv);shove.xz+=dv/max(dd,.2)*(1.-smoothstep(p.z*.35,p.z,dd))*p.w;}
      shove.xz+=uGust.yz*uGust.x*pow(max(0.,sin(dot(anchor.xz,uGust.yz)*.045-uGust.w)),5.);
      shove*=bend*give*H*sqrt(s2)*.45;shove.y-=length(shove.xz)*.3*h;
      transformed+=transpose(toLocal)*shove/s2;
     }
    }`;

function motesMaterial(){
 return new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,
  uniforms:{uShift:{value:new T.Vector3()},uBox:{value:new T.Vector3(30,12,60)},uTime:{value:0},uColor:{value:new T.Color()},uStrength:{value:1},uRise:{value:0},uPixel:{value:1},uSun:{value:new T.Vector3(0,1,0)},
   tCanopy:{value:null},uCanopy:{value:new T.Vector4(0,0,-1e4,90)},uEmber:{value:0},uAsh:{value:0}},
  vertexShader:`attribute vec4 seed;uniform vec3 uShift,uBox,uSun;uniform float uTime,uRise,uPixel,uEmber,uAsh;uniform vec4 uCanopy;uniform sampler2D tCanopy;varying float vLight;varying float vHot;varying float vAsh;
   void main(){
    // World-fixed points wrapped through a box around the camera: the CPU passes the camera
    // position modulo the box, so every input stays small.
    // Ash (the fault canyon): the cooler half of the points fall, fluttering, instead of rising.
    float t=uTime,ash=uAsh*step(seed.w,.5);vec3 drift=vec3(sin(t*.21+seed.w*20.)*.6+ash*sin(t*1.7+seed.z*40.)*.35,t*mix(uRise*(.6+seed.w*.8)+.03,-.55-seed.y*.5,ash),sin(t*.3+seed.x*9.)*.4+ash*cos(t*1.3+seed.y*31.)*.3);
    vec3 p=mod(seed.xyz*uBox+drift-uShift,uBox)-vec3(uBox.x*.5,0.,uBox.z*.18);
    vec4 world=modelMatrix*vec4(p,1.);
    float lit=1.;
    if(world.y<uCanopy.z){vec2 q=world.xz+uSun.xz*(uCanopy.z-world.y)/max(uSun.y,.2)-uCanopy.xy;lit=texture2D(tCanopy,vec2(q.x/uCanopy.w+.5,q.y/uCanopy.w)).r;}
    vec4 mv=viewMatrix*world;gl_Position=projectionMatrix*mv;
    float d=-mv.z;vec3 view=normalize(world.xyz-cameraPosition);
    float forward=mix(.45,1.8,pow(max(dot(view,uSun),0.),4.));
    vHot=uEmber*step(.55,seed.w);vAsh=ash;
    vLight=mix(lit*forward,1.,vHot)*smoothstep(1.2,4.,d)*(1.-smoothstep(30.,52.,d))*(.35+.65*seed.w)*(.7+.3*sin(t*(2.+seed.y*5.)+seed.z*30.));
    gl_PointSize=uPixel*(1.3+seed.w*2.2+vHot*1.5+ash*1.6)*18./max(d,1.);
   }`,
  fragmentShader:`uniform vec3 uColor;uniform float uStrength;varying float vLight;varying float vHot;varying float vAsh;void main(){vec2 c=gl_PointCoord-.5;float a=exp(-dot(c,c)*18.);gl_FragColor=vec4(mix(mix(uColor,vec3(.42,.36,.33),vAsh),vec3(1.,.42,.1)*2.4,vHot)*a*vLight*.85*uStrength,1.);}`});
}

export class CircuitAir {
 constructor(world,{routeX,routeY,routeHeading}){
  this.world=world;this.routeX=routeX;this.routeY=routeY;this.routeHeading=routeHeading;this.scene=world.scene;this.id='';this.look=AIR.gates;this.time=0;this.last=null;this.nextFlock=60;this.phase='';
  // Motes and embers.
  const count=900,seeds=new Float32Array(count*4);for(let i=0;i<seeds.length;i++)seeds[i]=rnd();
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('seed',new T.BufferAttribute(seeds,4));
  this.motes=new T.Points(geometry,motesMaterial());this.motes.frustumCulled=false;this.motes.name='Light motes';this.moteCount=count;this.scene.add(this.motes);
  // Falling leaves: real lit cards that turn over as they fall.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;{const x=canvas.getContext('2d');x.translate(32,32);x.rotate(.6);const g=x.createLinearGradient(-20,0,20,0);g.addColorStop(0,'#6d4a22');g.addColorStop(.6,'#8f7a34');g.addColorStop(1,'#a8913f');x.fillStyle=g;x.beginPath();x.ellipse(0,0,24,10,0,0,7);x.fill();x.strokeStyle='#4a3218';x.lineWidth=1.5;x.beginPath();x.moveTo(-24,0);x.lineTo(24,0);x.stroke();}
  const leafMap=new T.CanvasTexture(canvas);leafMap.colorSpace=T.SRGBColorSpace;
  this.leaves=new T.InstancedMesh(new T.PlaneGeometry(.15,.15),new T.MeshStandardMaterial({map:leafMap,alphaTest:.4,side:T.DoubleSide,roughness:.8}),70);this.leaves.frustumCulled=false;this.leaves.name='Falling leaves';this.leaves.count=0;this.scene.add(this.leaves);
  this.leafState=Array.from({length:70},()=>({p:new T.Vector3(),spin:new T.Vector3(rnd()*3,rnd()*3,rnd()*3),phase:rnd()*TAU,fall:.45+rnd()*.6,on:false}));this.obj=new T.Object3D();
  // Pursuit's insects and flocks live in the Jeep's frame; here a frame rides the route.
  this.insectFrame=new T.Group();this.insectFrame.name='Insect frame';this.scene.add(this.insectFrame);
  this.insects=createInsects(this.scene,{night:null});this.insectFrame.add(this.insects.butterflies,this.insects.dragonflies);
  this.flockFrame=new T.Group();this.flockFrame.name='Flock frame';this.scene.add(this.flockFrame);
  this.birds=createBirds(this.scene,{count:26});this.flockFrame.add(this.birds.mesh);
  for(const o of [this.motes,this.leaves,this.insectFrame])o.userData.noReflect=true;
  this.gust={t:0,level:0};
 }
 setStage(id){
  this.id=id;this.look=AIR[id]||AIR.gates;NIGHT.value=this.look.night||0;
  const u=this.motes.material.uniforms,[share,color,strength,rise]=this.look.motes;u.uColor.value.set(color);u.uStrength.value=strength;u.uRise.value=rise;u.uEmber.value=this.look.embers?1:0;
  this.motes.geometry.setDrawRange(0,Math.floor(this.moteCount*share));
  for(const l of this.leafState)l.on=false;this.leaves.count=Math.floor(70*this.look.leaves);
  // Without Pursuit's flashlight to gather them, night moths thin out instead of swarming.
  this.birds.reset();this.nextFlock=50+rnd()*60;this.flockAt=-9;this.insects.setQuality({fauna:this.look.night?.35:1});this.insects.reset();
 }
 startle(z,{x=null,count=22}={}){
  // A flock bursts from the canopy ahead and flies on, away from the vehicle.
  // A flock still in the air is not restarted; its birds would jump back to the trees.
  if(!this.look.birds||Math.abs(this.time-this.flockAt)<3)return;this.flockAt=this.time;const id=this.id;this.flockFrame.position.set(this.routeX(z,id),this.routeY(z,id),0);
  const side=x??(rnd()<.5?-1:1)*(9+rnd()*8);this.birds.scatter(new T.Vector3(side,12+rnd()*6,z),{spread:7,count});
 }
 update(game,{z,camera,dt,time,key,canopy,pushers=[]}){
  const id=this.id,look=this.look,u=this.motes.material.uniforms;this.time=time;
  // Motes: the box follows the camera; its contents stay put in the world.
  const box=u.uBox.value;this.motes.position.copy(camera.position).setY(this.routeY(z,id));
  u.uShift.value.set(((camera.position.x%box.x)+box.x)%box.x,0,((z%box.z)+box.z)%box.z);u.uTime.value=time%600;u.uSun.value.copy(key);u.uPixel.value=Math.min(2,devicePixelRatio);
  u.uAsh.value=id==='fault'?T.MathUtils.smoothstep(z,280,320):0;
  u.tCanopy.value=canopy.texture;u.uCanopy.value.set(canopy.offset.x,canopy.offset.y,canopy.height,canopy.scale);
  // Leaves drop from the canopy height ahead and settle out on the ground.
  for(let i=0;i<this.leaves.count;i++){const l=this.leafState[i];
   if(!l.on||l.p.y<this.routeY(l.p.z,id)+.05||l.p.z<z-4){const zz=z+rnd()*48-(l.on?0:4);l.p.set(this.routeX(zz,id)+(rnd()-.5)*26,this.routeY(zz,id)+(l.on?9+rnd()*7:rnd()*14),zz);l.on=true;}
   l.p.y-=l.fall*dt;l.p.x+=(Math.sin(time*1.3+l.phase)*.6+GUST.value.y*this.gust.level*2)*dt;l.p.z+=(Math.cos(time*1.1+l.phase)*.3+GUST.value.z*this.gust.level*2)*dt;
   this.obj.position.copy(l.p);this.obj.rotation.set(time*l.spin.x+l.phase,time*l.spin.y,time*l.spin.z);this.obj.updateMatrix();this.leaves.setMatrixAt(i,this.obj.matrix);}
  if(this.leaves.count)this.leaves.instanceMatrix.needsUpdate=true;
  // Insects ride a frame on the route, facing the way the vehicle travels.
  const speed=game?.speed??0,heading=this.routeHeading(z,id);
  this.insectFrame.position.set(camera.position.x,this.routeY(z,id),z);this.insectFrame.rotation.y=Math.PI+heading;
  this.insects.update(dt,{speed,visible:look.insects});
  // Flocks: now and then as the vehicle passes under the trees, and when a boss arrives or a barrel goes up.
  if(game){if(game.phase!==this.phase){if(game.phase==='boss')this.startle(z+38,{count:26});this.phase=game.phase;}
   for(const e of game.events||[])if(e.type==='blast')this.startle(z+30);
   if(game.phase==='ride'&&z>this.nextFlock){this.startle(z+46+rnd()*20);this.nextFlock=z+140+rnd()*120;}}
  this.birds.update(dt,time,0);
  // Gusts: a slow envelope swells and dies; each swell rolls a front across the planting.
  const g=this.gust;g.t+=dt;const env=Math.max(0,Math.sin(g.t*.21)*.6+Math.sin(g.t*.53+1.3)*.4);g.level=env*env;
  WIND_GUST.value=1+g.level*.9;const wind=GUST.value;wind.x=g.level*.5;wind.w=(g.t*1.3)%(TAU*40);
  // Pushers: the vehicle and its wake first, then the animals.
  const P=PUSH.value;P[0].set(camera.position.x,z,4.8,.9);P[1].set(this.routeX(z-5,id),z-5,4.4,.6);
  for(let i=2;i<P.length;i++){const p=pushers[i-2];if(p)P[i].set(p.x,p.z,p.r,p.s??1);else P[i].set(0,0,0,0);}
 }
}
