import * as T from 'three';
import {WET} from './weather-state.js';
// Physics debris: one instanced draw of small faceted chunks (pebbles, clods, hide
// flecks, leaves, splinters, blast rubble) under gravity with air drag, bounce, spin
// and ground friction. Positions are in the Jeep's frame, where the road and the air
// both move at +roadSpeed along z: drag pulls a chunk toward the air's velocity,
// friction toward the road's, and a resting chunk rides the road away.
const KINDS={
 pebble:{size:[.03,.065],shape:[1,.75,.9],bounce:.35,drag:.05,colors:[[.15,.13,.1],[.2,.17,.13],[.1,.09,.075]],wetDark:.35},
 clod:{size:[.035,.08],shape:[1,.7,1],bounce:.08,drag:.08,colors:[[.11,.075,.045],[.08,.055,.035]],wetDark:.45},
 fleck:{size:[.02,.045],shape:[1,.22,.8],bounce:.2,drag:.7,colors:[[.085,.08,.055],[.06,.055,.04],[.16,.025,.018]],wetDark:0},
 leaf:{size:[.045,.075],shape:[1,.05,.55],bounce:0,drag:3.2,flutter:1,colors:[[.07,.13,.03],[.12,.14,.035],[.2,.12,.045]],wetDark:.2},
 splinter:{size:[.02,.035],shape:[.7,.7,5],bounce:.25,drag:.1,colors:[[.2,.13,.07],[.26,.18,.1]],wetDark:.2}
};
let seed=911;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
function rockGeometry(){
 // Icosahedron with each shared corner pushed in or out by a hash of its position:
 // faces stay closed and the flat normals read as fractured stone.
 const g=new T.IcosahedronGeometry(1,0),a=g.attributes.position,v=new T.Vector3();
 for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);const h=Math.sin(v.x*12.9898+v.y*78.233+v.z*37.719)*43758.5453,k=.72+.5*(h-Math.floor(h));a.setXYZ(i,v.x*k,v.y*k,v.z*k);}
 g.computeVertexNormals();return g;
}
export function createChunks(scene,count=192){
 const material=new T.MeshStandardMaterial({roughness:.9,metalness:0}),mesh=new T.InstancedMesh(rockGeometry(),material,count);
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);
 const zero=new T.Matrix4().makeScale(0,0,0),color=new T.Color(),m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),e=new T.Euler(),up=new T.Vector3(0,1,0);
 for(let i=0;i<count;i++){mesh.setMatrixAt(i,zero);mesh.setColorAt(i,color.setRGB(0,0,0));}
 const bits=Array.from({length:count},()=>({life:0,max:1,p:new T.Vector3(),v:new T.Vector3(),q:new T.Quaternion(),axis:new T.Vector3(1,0,0),spin:0,s:new T.Vector3(),radius:.02,bounce:.3,drag:0,flutter:0,rest:false}));
 let next=0,live=0,dirty=false;
 return{mesh,
  get live(){return live;},
  spawn(kind,p,v,scale=1){
   const k=KINDS[kind],i=next++%count,b=bits[i],size=(k.size[0]+rnd()*(k.size[1]-k.size[0]))*scale;
   b.life=b.max=2.4+rnd()*1.6;b.p.copy(p);b.v.copy(v);b.q.setFromEuler(e.set(rnd()*6.3,rnd()*6.3,rnd()*6.3));b.axis.set(rnd()-.5,rnd()-.5,rnd()-.5).normalize();
   b.spin=(4+rnd()*14)*(kind==='leaf'?.4:1);b.s.set(...k.shape).multiplyScalar(size);b.radius=size*Math.min(...k.shape)*.8;b.bounce=k.bounce;b.drag=k.drag;b.flutter=k.flutter||0;b.rest=false;
   const c=k.colors[Math.floor(rnd()*k.colors.length)],dark=1-k.wetDark*WET.value,j=.85+rnd()*.3;mesh.setColorAt(i,color.setRGB(c[0]*dark*j,c[1]*dark*j,c[2]*dark*j));mesh.instanceColor.needsUpdate=true;dirty=true;
  },
  update(dt,roadSpeed){
   // Wet chunks glisten like the wet road.
   material.roughness=.9-.45*WET.value;live=0;if(!dirty)return;dirty=false;
   for(let i=0;i<count;i++){
    const b=bits[i];if(b.life<=0)continue;b.life-=dt;
    if(b.life<=0||b.p.z>90||b.p.z<-40){b.life=0;mesh.setMatrixAt(i,zero);dirty=true;continue;}
    live++;dirty=true;
    if(b.rest)b.p.z+=roadSpeed*dt;
    else{
     const air=Math.exp(-b.drag*dt);b.v.x*=air;b.v.y*=air;b.v.z=roadSpeed+(b.v.z-roadSpeed)*air;b.v.y-=9.3*dt;
     if(b.flutter){b.v.x+=Math.sin(b.life*8.3+b.spin)*dt*3;b.v.z+=Math.cos(b.life*6.1+b.spin)*dt*2;}
     b.p.addScaledVector(b.v,dt);b.q.premultiply(q.setFromAxisAngle(b.axis,b.spin*dt));
     if(b.p.y<b.radius){
      b.p.y=b.radius;
      if(b.v.y<-.9&&b.bounce>0){b.v.y=-b.v.y*b.bounce;b.v.x*=.5;b.v.z=roadSpeed+(b.v.z-roadSpeed)*.5;b.spin*=.5;b.axis.set(rnd()-.5,rnd()-.5,rnd()-.5).normalize();}
      else{b.rest=true;b.v.set(0,0,roadSpeed);if(b.s.y<b.s.x*.3)b.q.setFromAxisAngle(up,rnd()*6.3);}
     }
    }
    // Shrink out over the last fifth of life; by then a resting chunk is well down the road.
    const f=Math.min(1,b.life/(b.max*.2));mesh.setMatrixAt(i,m.compose(b.p,b.q,s.copy(b.s).multiplyScalar(f)));
   }
   mesh.instanceMatrix.needsUpdate=true;
  },
  reset(){for(let i=0;i<count;i++){bits[i].life=0;mesh.setMatrixAt(i,zero);}mesh.instanceMatrix.needsUpdate=true;live=0;dirty=false;}
 };
}
