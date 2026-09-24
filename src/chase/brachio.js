import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// A brachiosaur at the forest edge, now and then, side-on to the track with her neck
// arched out over it to browse the canopy the road opens up. She stands in the ground
// frame, so the Jeep and the Rex pass beneath her head; from the gun she recedes down
// the road corridor in profile, the one gap in the canopy where a sauropod reads, and
// fades into the haze. As she comes level she lifts her head and calls (a real
// recording, placed at her head). Deeper in the forest, or face-on, she would be lost
// among the trunks or read as a pillar.

const TAU=Math.PI*2;
let seed=31337;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+rnd()*(b-a);
const NECK_BASE=new T.Vector3(0,7.4,4.2);

function tubeAlong(points,radius,{radial=12,rings=24,sway}={}){
 const curve=new T.CatmullRomCurve3(points),g=new T.TubeGeometry(curve,rings,1,radial,false),p=g.attributes.position,n=g.attributes.normal,w=new Float32Array(p.count);
 // TubeGeometry has a fixed radius; rescale each ring about its centre for the taper.
 for(let r=0;r<=rings;r++){const v=r/rings,c=curve.getPointAt(v),rad=radius(v);for(let k=0;k<=radial;k++){const i=r*(radial+1)+k;p.setXYZ(i,c.x+n.getX(i)*rad,c.y+n.getY(i)*rad,c.z+n.getZ(i)*rad);w[i]=sway?sway(v):0;}}
 g.deleteAttribute('uv');g.setAttribute('sway',new T.BufferAttribute(w,1));return g;
}
function ellipsoid(at,r,sway=0,rotX=0){const g=new T.SphereGeometry(1,20,14);g.scale(...r);g.rotateX(rotX);g.translate(...at);g.deleteAttribute('uv');g.setAttribute('sway',new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(sway),1));return g;}
function column(from,to,r0,r1){const a=new T.Vector3(...from),b=new T.Vector3(...to),g=new T.CylinderGeometry(r1,r0,a.distanceTo(b),12,3);g.translate(0,a.distanceTo(b)/2,0);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...from);g.deleteAttribute('uv');g.setAttribute('sway',new T.BufferAttribute(new Float32Array(g.attributes.position.count),1));return g;}

function geometry(){
 const parts=[
  ellipsoid([0,6.1,-.2],[2.2,2.5,5.2],0,-.14),
  // Long neck from high shoulders; `sway` grows toward the head so it bends as a curve.
  tubeAlong([NECK_BASE.clone(),new T.Vector3(0,9.6,6.1),new T.Vector3(0,12.2,7.6),new T.Vector3(0,13.9,8.7)],v=>1.25-v*.9,{sway:v=>v}),
  ellipsoid([0,14.1,9.35],[.42,.5,1.05],1,.35),ellipsoid([0,14.55,9.1],[.32,.3,.5],1),
  tubeAlong([new T.Vector3(0,6.2,-4.6),new T.Vector3(0,5.2,-8.5),new T.Vector3(.4,3.6,-12.5),new T.Vector3(1.1,2.2,-16.5)],v=>1.25*(1-v)+.08),
 ];
 for(const s of [-1,1]){parts.push(column([s*1.45,0,3.3],[s*1.5,6.8,3.1],.62,.78));parts.push(column([s*1.55,0,-3.3],[s*1.6,5.4,-3],.72,.95));}
 const g=mergeGeometries(parts.map(x=>x.index?x.toNonIndexed():x));
 // Grey-brown hide, darker on the back, with broad mottling.
 const p=g.attributes.position,nn=g.attributes.normal,c=new Float32Array(p.count*3),back=new T.Color(.055,.058,.05),belly=new T.Color(.14,.13,.11),col=new T.Color();
 for(let i=0;i<p.count;i++){const m=.85+.15*Math.sin(p.getX(i)*1.3+p.getZ(i)*.9)*Math.sin(p.getY(i)*1.7-p.getZ(i)*.6);col.copy(belly).lerp(back,T.MathUtils.smoothstep(nn.getY(i),-.3,.4)).multiplyScalar(m);c.set([col.r,col.g,col.b],i*3);}
 g.setAttribute('color',new T.BufferAttribute(c,3));return g;
}

export function createBrachio(scene,{jungle}){
 const sway={value:new T.Vector2()};
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.92});
 material.onBeforeCompile=s=>{s.uniforms.uSway=sway;
  // The neck turns about its base in proportion to `sway`: yaw (x) and pitch (y), set on the CPU.
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float sway;uniform vec2 uSway;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    if(sway>0.){vec3 q=transformed-vec3(${NECK_BASE.x.toFixed(2)},${NECK_BASE.y.toFixed(2)},${NECK_BASE.z.toFixed(2)});float a=uSway.y*sway,b=uSway.x*sway;
     q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);q.xz=vec2(cos(b)*q.x+sin(b)*q.z,-sin(b)*q.x+cos(b)*q.z);
     transformed=vec3(${NECK_BASE.x.toFixed(2)},${NECK_BASE.y.toFixed(2)},${NECK_BASE.z.toFixed(2)})+q;}`);};
 material.customProgramCacheKey=()=> 'rex-brachio-v1';
 const mesh=new T.Mesh(geometry(),material);mesh.receiveShadow=true;mesh.visible=false;mesh.name='Brachiosaur';mesh.frustumCulled=false;scene.add(mesh);
 const head=new T.Vector3();
 let on=false,travel=0,next=0,clock=0,lift=0,called=false,api;
 function place(x,z,yaw){on=true;called=false;lift=0;mesh.position.set(x,jungle.groundAt(x,z),z);mesh.rotation.y=yaw;mesh.scale.setScalar(range(.9,1.05));}
 api={
  mesh,onCall:null,
  get active(){return on;},
  /** Place her by the road (x, z in the Jeep frame); used by the scheduler and by captures. */
  show(x=-12,z=20,yaw){const side=Math.sign(x)||1;place(x,z,yaw??-side*Math.PI/2+range(-.35,.35));},
  reset({menu=false}={}){on=false;mesh.visible=false;travel=0;next=range(320,480);
   // The menu's slow drift gives a long look: she browses over the road beyond the Rex.
   if(menu)api.show(-11,34,Math.PI/2-.2);},
  update(dt,{speed=0,visible=true}={}){
   clock+=dt;
   if(!on){travel+=speed*dt;if(speed>4&&travel>=next){travel=0;next=range(900,1400);const side=rnd()<.5?-1:1;api.show(side*range(11,14),-80);}}
   mesh.visible=on&&visible;if(!on)return;
   mesh.position.z+=speed*dt;mesh.position.y=jungle.groundAt(mesh.position.x,mesh.position.z);
   // Browsing: slow sways of the neck; she raises her head to call as she comes level.
   if(!called&&mesh.position.z>12&&mesh.position.z<60){called=true;lift=1;api.onCall?.(api.headPosition());}
   lift=Math.max(0,lift-dt*.3);
   sway.value.set(Math.sin(clock*.35)*.14+Math.sin(clock*.11)*.08,Math.sin(clock*.23+1)*.05-.06*(1-lift)+lift*.12*Math.sin(Math.min(1,(1-lift)*3)*Math.PI*.5+.5));
   if(mesh.position.z>170)on=false;
  },
  headPosition(){mesh.updateMatrixWorld();return head.set(0,14.1,9.4).applyMatrix4(mesh.matrixWorld);}
 };
 api.reset({menu:true});return api;
}
