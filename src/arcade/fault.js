// The falling world (fault stage, A10): the lava tube's vault, flowing lava with glowing cracks,
// stalactites, and the park's rope suspension bridge that tears apart plank by plank under the Jeep.
// world.js calls cave() and bridge() while it builds a chunk and update() every frame; main.js
// drains the sound cues. Everything is a function of route z and the rules' clock, so seeking and
// Overdrive stay in step.
import * as T from 'three';
import {FLAME_VS,FLAME_FS} from './gate.js';

const TAU=Math.PI*2,clamp=T.MathUtils.clamp,hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// The bridge spans the gorge chunks world.js flags (start 288 to 640); towers carry the main cables.
export const BRIDGE={start:288,end:640,towers:[288,352,416,480,544,608,640],break:19,width:9.6};
// The vault's cross-section at angle a (0 and PI meet the floor) and route z, relative to the route.
export function vaultAt(a,z){const r=1+.07*Math.sin(z*.31+a*7)+.05*Math.sin(z*.13-a*11+1)+.025*Math.sin(z*.71+a*19)+.04*Math.sin(z*.05+a*3);return [Math.cos(a)*14*r,Math.sin(a)*10*r+3+Math.sin(z*.08+a*4)*.4];}
// Main cable height above the deck: from the tower saddles down to handrail height mid-span.
export function cableY(z){const t=BRIDGE.towers;let k=0;while(k<t.length-2&&z>=t[k+1])k++;const u=clamp((z-t[k])/(t[k+1]-t[k]),0,1);return 1.3+6.6*(2*u-1)**2;}
// Lava channels: one each side of the tube floor, meandering; centre offset and half-width.
const channel=(z,side)=>[side*(8.9+Math.sin(z*.06+side)*1.3+Math.sin(z*.17)*.45),1.35+Math.sin(z*.09+side*2)*.45+Math.sin(z*.31)*.25];

// Flowing crust: animated Voronoi plates whose cracks glow, hotter mid-channel. Every pattern
// repeats along z within 256 m and the flow offset wraps there, so inputs stay bounded.
const LAVA_PARS=`
uniform float uLavaFlow,uLavaPhase,uLavaGlow;varying vec3 vLava;
float lh(vec2 c){return fract(sin(dot(c,vec2(127.1,311.7)))*43758.5453);}
vec2 lh2(vec2 c){return fract(sin(vec2(dot(c,vec2(127.1,311.7)),dot(c,vec2(269.5,183.3))))*43758.5453);}
float lnoise(vec2 p,vec2 per){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lh(mod(i,per)),lh(mod(i+vec2(1.,0.),per)),f.x),mix(lh(mod(i+vec2(0.,1.),per)),lh(mod(i+1.,per)),f.x),f.y);}
vec2 lvor(vec2 p,vec2 per){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),o=lh2(mod(i+g,per));o=.5+.4*sin(uLavaPhase+6.2831*o);vec2 r=g+o-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return vec2(sqrt(d1),sqrt(d2));}
`;
function lavaMaterial(u,{glow=1,flow=1}={}){
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.9,metalness:0,emissive:0xffffff});m.userData.shared=true;
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u,{uLavaGlow:{value:glow}});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 lava;varying vec3 vLava;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLava=lava;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+LAVA_PARS).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   vec2 lp=vec2(vLava.x,vLava.y+uLavaFlow*${flow.toFixed(2)})*.625;vec2 lv=lvor(lp,vec2(64.,160.));
   float ln=lnoise(lp*2.,vec2(64.,320.)),ln2=lnoise(lp*8.,vec2(64.,1280.)),heat=vLava.z;
   float crack=1.-smoothstep(0.,.07+.12*ln+.1*heat,lv.y-lv.x);
   float lavaGlow=crack*(.22+1.1*heat)*(.7+.6*ln)+heat*heat*heat*(.05+.2*ln2)*(1.-smoothstep(.2,.7,lv.x));
   diffuseColor.rgb=mix(vec3(.05,.04,.035),vec3(.13,.09,.07),ln2)*(1.-crack*.92);roughnessFactor=mix(.95,.5,crack);`)
  .replace('#include <emissivemap_fragment>',`vec3 hot=mix(vec3(1.,.12,.015),vec3(1.,.5,.12),clamp(lavaGlow*1.3,0.,1.));hot=mix(hot,vec3(1.,.82,.45),smoothstep(.9,1.5,lavaGlow));totalEmissiveRadiance=hot*lavaGlow*uLavaGlow;`);};
 m.customProgramCacheKey=()=>'arcade-lava-'+flow;return m;}

// A plank 9.6 m long whose texture runs along its length in metres; instances shift the grain.
function plankGeometry(){const g=new T.BoxGeometry(BRIDGE.width,.09,.28),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(Math.abs(n.getY(i))>.5)uv.setXY(i,x/2.4,z/2.4+.37);else if(Math.abs(n.getZ(i))>.5)uv.setXY(i,x/2.4,y/2.4+.1);else uv.setXY(i,z/2.4,y/2.4);}return g;}
// A stalactite: a lumpy cone hanging from its root at the origin, tip at y=-1.
function dripGeometry(up=false){const g=new T.ConeGeometry(1,1,7,5,false);g.rotateX(up?0:Math.PI);g.translate(0,up?.5:-.5,0);const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),k=1+.22*Math.sin(a*3+y*9)+.12*Math.sin(a*5-y*17);p.setXYZ(i,x*k,y,z*k);}g.computeVertexNormals();return g;}

// The eruption: a billowing ash column on the horizon, lit from below by the vent, with lightning
// in the ash. It is a camera-anchored billboard just beyond the horizon ring, so the ridges hide its foot.
const PLUME_VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const PLUME_FS=`uniform float uTime,uFade,uFlash;uniform vec3 uHaze;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
 float y=vUv.y,t=uTime;vec2 q=vec2((vUv.x-.5)*2.,y);
 // Billows boil up a leaning column, then flatten under a lumpy shelf into an umbrella that drifts downwind.
 float b0=n(vec2(q.x*5.,t*.03)),um=smoothstep(.5,.64,y+(b0-.5)*.1),lean=y*y*.16;
 float w=mix(.075,.16,smoothstep(0.,.5,y))+um*mix(.5,.66,smoothstep(.64,.9,y)),x=q.x-lean-um*um*.14;
 vec2 p=vec2(x/w*(.9+um*1.7),y*3.4-t*.045*(1.-um*.75));float b=fbm(p*1.5+vec2(0.,fbm(p*.7+t*.02)*1.5));
 float edge=1.-smoothstep(.5,1.,abs(x)/w+(.5-b)*.6);
 float a=edge*smoothstep(0.,.05,y)*(1.-smoothstep(.84,.98,y+(.5-b)*.2))*smoothstep(.2,.55,b+.25);
 // Lit from inside by the vent: a hot core at the foot fading up the column; dark ash above, its crown catching the sky.
 float vent=exp(-y*6.)*(1.-smoothstep(0.,.6,abs(x)/max(w,.01)));
 vec3 ash=mix(vec3(.05,.045,.042),vec3(.2,.16,.14),b)*(.85+.35*smoothstep(.3,.9,y));
 vec3 col=ash+vec3(1.7,.45,.08)*vent*(1.4+b)+vec3(.8,.22,.05)*exp(-y*3.2)*.45*b+vec3(.22,.11,.06)*um*smoothstep(.55,.9,b)*smoothstep(.7,.9,y);
 // Lightning inside the ash.
 col+=vec3(.75,.8,1.)*uFlash*smoothstep(.55,.95,b)*smoothstep(.2,.45,y)*(1.-smoothstep(.75,.92,y))*1.6;
 col=mix(col,uHaze*.6,(.14+.3*(1.-smoothstep(0.,.35,y)))*(1.-vent));a=min(1.,a*1.5);
 gl_FragColor=vec4(col*a*uFade,a*uFade);
}`;
// A volcanic bomb: a lumpy basalt ball whose crust cracks glow (the lava shader, mostly crust).
function bombGeometry(){const g=new T.IcosahedronGeometry(1,3),p=g.attributes.position,lava=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.16*Math.sin(x*4.1+y*2.3)+.1*Math.sin(y*6.7-z*3.9)+.06*Math.sin(z*11+x*7);p.setXYZ(i,x*k,y*k*.88,z*k);lava.push(x*2.6+20,y*2.6+z*1.7+40,.42);}
 g.setAttribute('lava',new T.Float32BufferAttribute(lava,3));g.computeVertexNormals();return g;}
export class Fault {
 constructor(scene,{rock,diffuse,normal,routeX,routeY,routeHeading,terrain}){
  Object.assign(this,{scene,routeX,routeY,routeHeading,terrain});this.cues=[];this.dummy=new T.Object3D();this.v=[new T.Vector3(),new T.Vector3(),new T.Vector3()];this.up=new T.Vector3(0,1,0);this.q=new T.Quaternion();this.off=[[0,0],[0,0]];this.snapWait=0;
  this.u={uLavaFlow:{value:0},uLavaPhase:{value:0}};this.flameTime={value:0};this.lava=lavaMaterial(this.u);
  this.vault=rock.clone();this.vault.color.set(0x5e5247);this.vault.side=T.DoubleSide;this.vault.userData.shared=true;
  this.drip=rock.clone();this.drip.color.set(0x52463c);this.drip.roughness=.62;this.drip.userData.shared=true;
  this.geometry={drip:dripGeometry(),mite:dripGeometry(true),plank:plankGeometry(),board:new T.BoxGeometry(.38,.06,1),log:new T.CylinderGeometry(1,1,1,9),rope:new T.CylinderGeometry(1,1,1,5,1,true)};
  const tex=t=>{const c=t.clone();c.wrapS=c.wrapT=T.RepeatWrapping;c.needsUpdate=true;return c;};
  this.plank=new T.MeshStandardMaterial({map:tex(diffuse),normalMap:tex(normal),color:0xb9a48c,roughness:.92});this.plank.userData.shared=true;
  // Each plank shifts the grain by its own position, so no two read the same.
  this.plank.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_INSTANCING\n vMapUv.x+=fract(instanceMatrix[3].z*.37+instanceMatrix[3].x*.11)*4.;vNormalMapUv=vMapUv;\n#endif');};this.plank.customProgramCacheKey=()=>'arcade-plank';
  this.log=new T.MeshStandardMaterial({map:tex(diffuse),normalMap:tex(normal),color:0x8a7560,roughness:.95});this.log.userData.shared=true;
  this.rope=new T.MeshStandardMaterial({color:0x7a6548,roughness:1});this.rope.userData.shared=true;
  this.plume=new T.Mesh(new T.PlaneGeometry(1,1).translate(0,.5,0),new T.ShaderMaterial({uniforms:{uTime:{value:0},uFade:{value:0},uFlash:{value:0},uHaze:{value:new T.Color()}},vertexShader:PLUME_VS,fragmentShader:PLUME_FS,transparent:true,depthWrite:false,blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor}));
  // Flaming boulders thrown off the canyon rim; they bounce down the slopes with real physics.
  this.bombs=[];const bombMat=lavaMaterial(this.u,{glow:2.2,flow:0}),bombGeo=bombGeometry(),flameGeo=new T.PlaneGeometry(1,1).translate(0,.5,0);this.bombWait=1.2;
  for(let i=0;i<6;i++){const mesh=new T.Mesh(bombGeo,bombMat);mesh.castShadow=true;mesh.visible=false;mesh.userData.noReflect=true;scene.add(mesh);
   const flame=new T.Mesh(flameGeo,new T.ShaderMaterial({uniforms:{uTime:this.flameTime,uSeed:{value:i*1.91},uPower:{value:.95}},vertexShader:FLAME_VS,fragmentShader:FLAME_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));flame.frustumCulled=false;flame.renderOrder=60;flame.visible=false;flame.userData.noReflect=true;scene.add(flame);
   this.bombs.push({mesh,flame,p:new T.Vector3(),v:new T.Vector3(),spin:new T.Vector3(),r:1,live:false,bounces:0,trail:0});}
  this.plume.frustumCulled=false;this.plume.renderOrder=-1;this.plume.visible=false;this.plume.userData.noReflect=true;scene.add(this.plume);this.flash=0;this.nextFlash=2;
 }
 // Bombs launch from the rim ahead, arc into the canyon and bounce on the terrain or the deck.
 throwBombs(game,camera,dt,time,effects){
  const z=camera.position.z,on=game&&game.phase!=='clear'&&z>300&&!this.reduced,id='fault';
  if(on&&(this.bombWait-=dt)<=0){const b=this.bombs.find(b=>!b.live);this.bombWait=1.5+Math.random()*1.9;
   if(b){const side=Math.random()<.5?-1:1,bz=z+70+Math.random()*60;b.r=.7+Math.random()*.8;b.p.set(this.routeX(bz,id)+side*(24+Math.random()*16),this.routeY(bz,id)+30+Math.random()*14,bz);
    b.v.set(-side*(7+Math.random()*7),3+Math.random()*5,-(3+Math.random()*7));b.spin.set(Math.random()*6-3,Math.random()*4-2,Math.random()*6-3);b.live=true;b.bounces=0;b.trail=0;b.mesh.scale.setScalar(b.r);}}
  const [g]=this.v;
  for(const b of this.bombs){if(!b.live){b.mesh.visible=b.flame.visible=false;continue;}
   b.v.y-=17*dt;b.p.addScaledVector(b.v,dt);b.mesh.rotation.x+=b.spin.x*dt;b.mesh.rotation.y+=b.spin.y*dt;b.mesh.rotation.z+=b.spin.z*dt;
   const off=b.p.x-this.routeX(b.p.z,id),deck=b.p.z>=BRIDGE.start&&b.p.z<BRIDGE.end&&Math.abs(off)<BRIDGE.width/2+.5&&!(game?.bridgeBroken&&Math.abs(b.p.z-game.bridgeOrigin)<18);
   let ground=deck?this.routeY(b.p.z,id):this.terrain(off,b.p.z);if(deck&&b.p.y<ground-1.5)ground=this.terrain(off,b.p.z);
   if(b.p.y-b.r<ground&&b.v.y<0){b.p.y=ground+b.r;const hard=Math.min(1,-b.v.y/18);b.v.y=-b.v.y*.42;b.v.x*=.72;b.v.z*=.72;b.spin.multiplyScalar(.8).add(g.set(b.v.z*.5,0,-b.v.x*.5));b.bounces++;
    // Each landing throws dust and sparks; close ones are heard.
    if(effects){effects.groundDust(g.set(b.p.x,ground+.2,b.p.z),this.v[1].set(0,1.2,0),{life:1.8,size:b.r*1.6,growth:3,opacity:.45,color:0x5a4438});for(let k=0;k<5;k++)effects.speck(g.set(b.p.x,ground+.3,b.p.z),this.v[1].set(Math.random()*6-3,3+Math.random()*4,Math.random()*6-3),0xff7a2a,.09,1.1);}
    const d=b.p.distanceTo(camera.position);if(d<75)this.cue({type:'bounce',weight:hard*(1-d/75)*b.r,at:b.p.clone()});}
   if(b.bounces>4||b.p.z<z-12||b.p.y<this.routeY(b.p.z,id)-34){b.live=false;continue;}
   b.mesh.visible=b.flame.visible=true;b.mesh.position.copy(b.p);const sp=b.v.length()||1;b.flame.position.copy(b.p).addScaledVector(b.v,-b.r*.5/sp);b.flame.position.y+=b.r*.15;b.flame.scale.set(b.r*2.6,b.r*(2.3+Math.min(1.4,sp*.06)),1);
   // A trail of embers and dark smoke.
   if(effects&&(b.trail-=dt)<=0){b.trail=.045;effects.haze(g.copy(b.p),this.v[1].set(0,.8,0),{life:1.7,size:b.r*1.2,growth:3.2,opacity:.5,color:0x241d1a,drag:1.2,rise:.5});effects.speck(g.copy(b.p),this.v[1].copy(b.v).multiplyScalar(.2).add(this.v[2].set(Math.random()-.5,1+Math.random(),Math.random()-.5)),0xff8a30,.07,.8);}}
 }
 drain(){const c=this.cues;this.cues=[];return c;}
 cue(c){this.cues.push(c);}
 // ---- The lava tube ---------------------------------------------------------------
 cave(g,start,mid,id,hAt){
  const {routeX:rx,routeY:ry}=this,A=40,J=16,points=[],uvs=[],faces=[];
  for(let j=0;j<=J;j++)for(let i=0;i<=A;i++){const z=start+j*32/J,a=i/A*Math.PI,[x,y]=vaultAt(a,z);points.push(rx(z,id)+x,ry(z,id)+y,z-mid);uvs.push(a*4,z*.18);if(i<A&&j<J){const k=j*(A+1)+i;faces.push(k,k+1,k+A+1,k+1,k+A+2,k+A+1);}}
  const vault=new T.BufferGeometry();vault.setAttribute('position',new T.Float32BufferAttribute(points,3));vault.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));vault.setIndex(faces);vault.computeVertexNormals();
  const ceiling=new T.Mesh(vault,this.vault);ceiling.castShadow=ceiling.receiveShadow=true;g.add(ceiling);
  // Lava: a ribbon down each side; the crust coordinates are metres across and z within 256 m.
  const lp=[],la=[],lf=[],W=6,zw=start%256;
  for(const [s,side]of [[0,-1],[1,1]])for(let j=0;j<=32;j++){const z=start+j,[c,w]=channel(z,side);for(let i=0;i<=W;i++){const u=i/W*2-1,off=c+u*w;lp.push(rx(z,id)+off,hAt(off,z)+.06-(1-u*u)*.05,z-mid);la.push(u*w+side*20,zw+j,Math.max(0,1-u*u)**.6);if(j<32&&i<W){const k=s*33*(W+1)+j*(W+1)+i;lf.push(k,k+W+1,k+1,k+1,k+W+1,k+W+2);}}}
  const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lp,3));lg.setAttribute('lava',new T.Float32BufferAttribute(la,3));lg.setIndex(lf);lg.computeVertexNormals();
  const flow=new T.Mesh(lg,this.lava);flow.receiveShadow=true;flow.userData.noReflect=true;g.add(flow);
  // Stalactites hang from the vault (clear of the sight line), stalagmites rise by the walls.
  const drips=[],mites=[];
  for(let k=0;k<22;k++){const s=start*7+k*13,z=start+hash(s)*32,a=Math.PI/2+(hash(s+1)-.5)*2.5,[x,y]=vaultAt(a,z),centre=1-Math.abs(a-Math.PI/2)/1.25,len=(.7+hash(s+2)**2*3.6)*(1-centre*.45);drips.push([rx(z,id)+x,ry(z,id)+y+.35,z-mid,.16+len*.11,len,hash(s+3)*TAU]);}
  for(let k=0;k<7;k++){const s=start*5+k*29,z=start+hash(s)*32,side=k%2?1:-1,off=side*(11.2+hash(s+1)*2),h=.5+hash(s+2)*2.2;mites.push([rx(z,id)+off,hAt(off,z)-.2,z-mid,.25+h*.16,h,hash(s+3)*TAU]);}
  for(const [items,geo]of [[drips,this.geometry.drip],[mites,this.geometry.mite]]){const mesh=new T.InstancedMesh(geo,this.drip,items.length);items.forEach(([x,y,z,r,l,yaw],i)=>{this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,yaw,0);this.dummy.scale.set(r,l,r);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();g.add(mesh);}
 }
 // ---- The rope suspension bridge ----------------------------------------------------
 bridge(g,start,mid,id){
  const {routeX:rx,routeY:ry,routeHeading:rh}=this,half=BRIDGE.width/2,planks=[],boards=[],logs=[],ropes=[];
  const at=(off,y,z)=>[rx(z,id)+off*Math.cos(rh(z,id)),ry(z,id)+y,z-mid];
  // Cross planks with gaps; about one in eight is snapped short at one end.
  for(let z=start+.18;z<start+32;z+=.36){const i=Math.round(z/.36),n=hash(i*7.3);let len=1,shift=0;if(n<.13){len=.5+hash(i*3.1)*.25;shift=(hash(i*5.7)<.5?-1:1)*(1-len)*half;}
   const [x,y,lz]=at(shift,-.045+(hash(i*1.9)-.5)*.025,z);planks.push({x,y,z:lz,wz:z,sx:len,ry:rh(z,id)+(hash(i*2.3)-.5)*.045,rz:(hash(i*4.1)-.5)*.025,seed:hash(i*8.9),side:hash(i*6.1)<.5?-1:1,tint:.7+hash(i*9.7)*.42,gone:false});}
  // Running boards along the wheel tracks, so the Jeep has something solid to drive on.
  for(const off of [-1.05,1.05])for(let z=start+.6;z<start+32;z+=1.04){const [x,y,lz]=at(off+(hash(z*3)-.5)*.04,.03,z);boards.push([x,y,lz,1,1,1,0,rh(z,id),0,.75+hash(z*5)*.3]);}
  // Cross-beams under the deck where the hangers tie on, and a stringer under each edge.
  const beams=[];for(let z=Math.ceil(start/2.88)*2.88;z<start+32;z+=2.88)beams.push(z);
  for(const z of beams){const [x,y,lz]=at(0,-.24,z);logs.push([x,y,lz,.13,BRIDGE.width+1.3,.13,0,rh(z,id),Math.PI/2]);}
  // Towers: a log gantry over the road with A-frame legs down into the gorge.
  for(const tz of BRIDGE.towers)if(tz>=start&&tz<start+32){for(const side of [-1,1]){for(const lean of [-1,1]){const [x,y,lz]=at(side*(half+.9),-4,tz+lean*.9);logs.push([x,y,lz,.26,24.5,.26,-lean*.09,0,0]);}
    const [bx,by,bz]=at(side*(half+.9),3.2,tz);logs.push([bx,by,bz,.16,3.4,.16,Math.PI/2,0,0]);}
   const [x,y,lz]=at(0,8.6,tz);logs.push([x,y,lz,.3,BRIDGE.width+3.4,.3,0,rh(tz,id),Math.PI/2]);const [x2,y2,z2]=at(0,7.7,tz);logs.push([x2,y2,z2,.18,BRIDGE.width+2.4,.18,0,rh(tz,id),Math.PI/2]);}
  // Ropes: main cables and handrails as short segments, hangers from cable to deck edge.
  const seg=(off,ya,za,yb,zb,r,side)=>{const a=at(off,ya,za),b=at(off,yb,zb);ropes.push({a,b,wa:za,wb:zb,r,side});};
  for(const side of [-1,1]){for(let z=start;z<start+32;z+=1){seg(side*(half+.75),cableY(z)+.05,z,cableY(z+1)+.05,z+1,.055,side);const sag=k=>1.08-.07*Math.sin(((k-start)%2.88)/2.88*Math.PI);seg(side*(half+.2),sag(z),z,sag(z+1),z+1,.035,side);}
   for(const z of beams)ropes.push({a:at(side*(half+.75),cableY(z),z),b:at(side*(half+.5),-.24,z),wa:z,wb:z,r:.025,side});}
  const build=(geo,mat,n)=>{const mesh=new T.InstancedMesh(geo,mat,n);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.noReflect=true;g.add(mesh);return mesh;};
  const plankMesh=build(this.geometry.plank,this.plank,planks.length),ropeMesh=build(this.geometry.rope,this.rope,ropes.length),logMesh=build(this.geometry.log,this.log,logs.length),boardMesh=build(this.geometry.board,this.plank,boards.length);
  const c=new T.Color();planks.forEach((p,i)=>plankMesh.setColorAt(i,c.setScalar(p.tint)));
  for(const [mesh,items]of [[logMesh,logs],[boardMesh,boards]]){items.forEach(([x,y,z,sx,sy,sz,ax,ay,az,tint],i)=>{this.dummy.position.set(x,y,z);this.dummy.rotation.set(ax,ay,az,'YXZ');this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);if(tint)mesh.setColorAt(i,c.setScalar(tint));});mesh.computeBoundingSphere();}
  g.userData.bridge={planks,ropes,plankMesh,ropeMesh,boards,boardMesh,dirty:true};this.pose(g.userData.bridge,null,0,Infinity);
 }
 // Where a rope point has fallen to: the cut cables drop and whip outward, still tied beyond the gap.
 ropeFall(out,wz,side,origin,st){out[0]=out[1]=0;if(origin==null)return out;const ad=Math.abs(wz-origin);if(ad>=24)return out;const ft=st-(BRIDGE.break+.04+ad/38);if(ft<=0)return out;const k=1-(ad/24)**2;out[1]=-Math.min(26,4.9*ft*ft*.8)*k;out[0]=side*Math.min(3.5,ft*2.4)*k;return out;}
 pose(b,origin,st,camZ,effects){
  const d=this.dummy,[pa,pb,mid]=this.v;let snaps=0;
  b.planks.forEach((p,i)=>{let x=p.x,y=p.y,rx=0,rz=p.rz,s=1;const dz=p.wz-camZ;
   // The deck gives a little under the Jeep's weight.
   if(Math.abs(dz)<5)y-=.08*(1-(dz/5)**2);
   if(origin!=null){const gz=p.wz-origin,ad=Math.abs(gz);
    if(ad<18){const ft=st-(BRIDGE.break+.1+ad/38+p.seed*.08);
     if(ft>0){if(!p.gone){p.gone=true;if(Math.abs(dz)<45){snaps++;if(effects)for(let k=0;k<2;k++)effects.speck(mid.set(x+(p.seed-.5)*6,y,p.wz),pa.set((p.seed-.5)*3,1.5+k,(hash(i+k)-.5)*2),0x6b5640,.07,1.4);}}
      // Each plank tears off one rope first, swings on the other, then falls free tumbling.
      const h=Math.min(1,ft/.22),f=Math.max(0,ft-.22);rz+=p.side*h*.85+f*(p.seed-.5)*3.2;rx=f*(p.seed*2-1)*2.6;y-=h*.55+4.9*f*f;x+=p.side*(h*.5+f*1.3);if(y<p.y-30)s=0;}
     else p.gone=false;}
    // The torn edge beyond the gap droops where its hangers went.
    else if(gz>=18&&gz<24&&st>BRIDGE.break+.55){const k=1-(gz-18)/6;y-=k*k*1.5;rx=-k*.55;}}
   else p.gone=false;
   d.position.set(x,y,p.z);d.rotation.set(rx,p.ry,rz);d.scale.set(p.sx*s,s,s);d.updateMatrix();b.plankMesh.setMatrixAt(i,d.matrix);});
  b.ropes.forEach((r,i)=>{const fa=this.ropeFall(this.off[0],r.wa,r.side,origin,st),fb=this.ropeFall(this.off[1],r.wb,r.side,origin,st);
   pa.set(r.a[0]+fa[0],r.a[1]+fa[1],r.a[2]);pb.set(r.b[0]+fb[0],r.b[1]+fb[1],r.b[2]);mid.addVectors(pa,pb).multiplyScalar(.5);pb.sub(pa);const len=pb.length()||1e-3;
   d.position.copy(mid);d.quaternion.copy(this.q.setFromUnitVectors(this.up,pb.divideScalar(len)));d.scale.set(r.r,len,r.r);d.updateMatrix();b.ropeMesh.setMatrixAt(i,d.matrix);d.rotation.set(0,0,0);});
  for(const m of [b.plankMesh,b.ropeMesh]){m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();}
  return snaps;
 }
 update(game,chunks,{camera,time,dt=0,effects}){
  this.u.uLavaFlow.value=(time*.55)%256;
  // The eruption stands down the canyon, a little left of the road; it shows once the tube opens out.
  const pu=this.plume.material.uniforms,z=camera.position.z,dist=262,az=Math.atan2(this.routeX(z+dist,'fault')-camera.position.x,dist)+.09;this.plume.visible=true;pu.uFade.value=clamp((z-262)/40,0,1);pu.uTime.value=time%600;
  this.plume.position.set(camera.position.x+Math.sin(az)*dist,camera.position.y-10,z+Math.cos(az)*dist);this.plume.rotation.set(0,az+Math.PI,0);this.plume.scale.set(430,150,1);
  this.nextFlash-=dt;if(this.nextFlash<=0){this.flash=1;this.nextFlash=1.2+Math.random()*3.5;}this.flash=Math.max(0,this.flash-dt*(this.flash>.5?3:7));pu.uFlash.value=this.flash>.5||Math.sin(time*60)>0?this.flash:this.flash*.3;
  if(this.haze)pu.uHaze.value.copy(this.haze);
  this.throwBombs(game,camera,dt,time,effects);this.u.uLavaPhase.value=(time*.35)%TAU;this.flameTime.value=time%600;
  const origin=game?.bridgeBroken?game.bridgeOrigin:null,st=game?.stageTime??0,camZ=camera.position.z;let snaps=0;
  for(const chunk of chunks){const b=chunk.userData.bridge;if(!b)continue;const cz=chunk.position.z,live=Math.abs(camZ-cz)<22||(origin!=null&&Math.abs(origin-cz)<42);
   if(!live&&!b.dirty)continue;b.dirty=live;snaps+=this.pose(b,origin,st,live?camZ:Infinity,effects);}
  // The tear crackles as it runs; one cue per burst keeps the samples from stacking.
  this.snapWait-=dt;if(snaps&&this.snapWait<=0){this.snapWait=.11;this.cue({type:'snap',weight:Math.min(1,.35+snaps*.12)});}
 }
}
