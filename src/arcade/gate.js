import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A8: the north gate. Two timber towers on stone footings carry the JURASSIC PARK
// board between two crossbeams; a palisade runs off into the jungle on both sides.
// The doors are closed when the stage opens and swing away from the Jeep as it
// approaches; their angle is a function of the camera's distance, so seeking and
// Overdrive cannot desynchronise them. Four torches burn on the towers: shader
// flames, rising embers and one flickering light between them.
export const GATE_Z=48;
const TILE=3.4,DOOR_W=6.3,DOOR_H=9.4,HINGE=6.35,TOWER=7.7,OPEN=1.5;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/** A squared timber whose plank grain follows the world size of each face (vertical: grain upright). */
function timber(w,h,d,{at=[0,0,0],rot=[0,0,0],vertical=false,seed=0}={}){
 const g=new T.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){
  const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i));let a=ax>.5?p.getZ(i):p.getX(i),b=ay>.5?p.getZ(i):p.getY(i);
  if(vertical&&ay<.5)[a,b]=[b,a];
  uv.setXY(i,a/TILE+seed*.37,b/TILE+seed*.61);
 }
 g.rotateX(rot[0]);g.rotateY(rot[1]);g.rotateZ(rot[2]);g.translate(...at);return g;
}
function part(geometry,at=[0,0,0],rot=[0,0,0]){geometry.rotateX(rot[0]);geometry.rotateY(rot[1]);geometry.rotateZ(rot[2]);geometry.translate(...at);return geometry;}
function merged(list){const g=mergeGeometries(list);for(const x of list)x.dispose();return g;}

const FLAME_VS=`
varying vec2 vUv;
void main(){
 vUv=uv;
 // Cylindrical billboard: the flame turns to the camera but stays upright.
 vec3 centre=(modelMatrix*vec4(0.,0.,0.,1.)).xyz,right=normalize(vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]));
 vec3 world=centre+right*position.x*length(modelMatrix[0].xyz)+vec3(0.,position.y*length(modelMatrix[1].xyz),0.);
 gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
}`;
const FLAME_FS=`
uniform float uTime,uSeed,uPower;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
void main(){
 float t=uTime+uSeed*17.,y=vUv.y,x=(vUv.x-.5)*2.;
 float f=n(vec2(vUv.x*4.+uSeed,y*3.-t*3.6))*.62+n(vec2(vUv.x*9.-uSeed,y*7.-t*6.3))*.38;
 x+=(n(vec2(t*1.1,y*1.7+uSeed))-.5)*.75*y;
 float width=mix(.82,.04,pow(y,.8))*(.7+.55*f);
 float body=(1.-smoothstep(width*.45,width,abs(x)))*smoothstep(0.,.1,y)*(1.-smoothstep(.45+.4*f,1.,y));
 float core=(1.-smoothstep(0.,width*.55,abs(x)))*(1.-smoothstep(.08,.55,y))*smoothstep(0.,.06,y);
 vec3 col=mix(vec3(1.1,.2,.03),vec3(2.4,.95,.2),smoothstep(.1,.8,body))+core*vec3(2.6,1.9,.9);
 gl_FragColor=vec4(col*body*uPower,1.);
}`;
const EMBER_VS=`
uniform float uTime,uScale;attribute vec3 aOrigin;attribute vec4 aSeed;varying float vLife;
void main(){
 float life=1.4+aSeed.w*1.6,t=fract(uTime/life+aSeed.x);vLife=t;
 vec3 p=aOrigin;
 p.y+=t*(2.4+aSeed.y*2.6);
 p.x+=sin(aSeed.z*6.283+t*5.)*.32*t+t*t*1.4*(aSeed.y-.35);
 p.z+=cos(aSeed.z*6.283+t*4.)*.32*t+t*t*.9;
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=max(1.,uScale*(.05+.04*aSeed.y)*(1.-t*.55)/-mv.z);
}`;
const EMBER_FS=`
varying float vLife;
void main(){vec2 c=gl_PointCoord-.5;float d=dot(c,c);if(d>.25)discard;
 float a=(1.-d*4.)*(1.-vLife)*smoothstep(0.,.06,vLife);
 gl_FragColor=vec4(mix(vec3(3.,1.5,.45),vec3(1.3,.25,.04),vLife)*a,1.);}`;

export class Gate {
 /** `stone` is the world's shared stone material; `sign` the stage's painted board. */
 constructor(scene,{stone,sign,diffuse,normal,routeX,routeY,routeHeading,groundAt}){
  this.routeX=routeX;this.routeY=routeY;this.groundAt=groundAt;this.time={value:0};this.open=0;this.cues=[];this.slammed=false;
  const root=this.root=new T.Group(),z=GATE_Z;root.position.set(routeX(z,'gates'),routeY(z,'gates'),z);root.rotation.y=routeHeading(z,'gates');root.visible=false;scene.add(root);
  for(const t of [diffuse,normal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;}diffuse.colorSpace=T.SRGBColorSpace;
  this.wood=new T.MeshStandardMaterial({map:diffuse,normalMap:normal,normalScale:new T.Vector2(1.4,1.4),color:0xd9c6ae,roughness:.9});
  this.iron=new T.MeshStandardMaterial({color:0x2c2a27,metalness:.75,roughness:.55});
  const wood=[],iron=[],footings=[];
  // Towers: a timber core, corner posts, bands and a cap, on a stone footing.
  for(const side of [-1,1]){const x=side*TOWER;
   footings.push(part(new T.BoxGeometry(3.3,1.7,3.3),[x,.55,0]));
   wood.push(timber(2.5,12.6,2.5,{at:[x,7.9,0],vertical:true,seed:side}));
   for(const [cx,cz]of [[-1,-1],[1,-1],[-1,1],[1,1]])wood.push(timber(.55,13.4,.55,{at:[x+cx*1.22,8.1,cz*1.22],vertical:true,seed:cx+cz*3}));
   for(const y of [4.6,9.2])wood.push(timber(2.8,.38,2.8,{at:[x,y,0],seed:y}));
   wood.push(timber(3.4,.6,3.4,{at:[x,14.55,0],seed:2}));
   // Torch brackets on the road face, braziers on the caps.
   iron.push(timber(.14,.14,1.1,{at:[x,8.55,-1.75]}),timber(.12,.9,.12,{at:[x,8.15,-1.3],rot:[.75,0,0]}));
   iron.push(part(new T.CylinderGeometry(.42,.24,.5,12,1,true),[x,8.85,-2.3]),part(new T.CylinderGeometry(.62,.36,.55,12,1,true),[x,15.1,0]));
   for(const y of [2.2,6.8,11.4])iron.push(timber(2.62,.3,.08,{at:[x,y,-1.29]}));
  }
  // Crossbeams carry the board between them.
  wood.push(timber(18.6,1.25,1.6,{at:[0,13.55,0],seed:5}),timber(16.8,.9,1.2,{at:[0,10.35,-.05],seed:7}),timber(10.4,2.5,.3,{at:[0,11.9,.1],seed:9}));
  for(const side of [-1,1])wood.push(timber(.4,3.6,.4,{at:[side*5.4,11.9,-.25],vertical:true}));
  // Palisade wings into the jungle: squared posts on the real ground, a ragged top and two rails.
  const ground=(x)=>{const w=new T.Vector3(x,0,0).applyAxisAngle(new T.Vector3(0,1,0),root.rotation.y).add(root.position);return groundAt(w.x,w.z,'gates')-root.position.y;};
  for(const side of [-1,1]){
   for(let x=TOWER+1.95,i=0;x<30;x+=.56,i++){const h=7.4+Math.sin(i*2.7)*.35+Math.sin(i*.9)*.25,y0=ground(side*x)-.4;wood.push(timber(.52,h,.52,{at:[side*x,y0+h/2,0],vertical:true,seed:i}),timber(.37,.37,.37,{at:[side*x,y0+h,0],rot:[0,0,Math.PI/4],seed:i}));}
   for(const y of [1.9,5.6])wood.push(timber(21,.34,.26,{at:[side*(TOWER+12),ground(side*(TOWER+12))+y,-.4],seed:y*side}));
  }
  const mesh=(geometry,material)=>{const m=new T.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
  this.meshes=[mesh(merged(wood),this.wood),mesh(merged(iron),this.iron),mesh(merged(footings),stone)];
  const board=new T.Mesh(new T.PlaneGeometry(9.6,2.3),new T.MeshStandardMaterial({map:sign,roughness:.8}));board.position.set(0,11.9,-.07);board.rotation.y=Math.PI;root.add(board);this.board=board;
  // The doors: upright planks, three rails and a Z-brace on the road face, iron straps
  // and pins at the hinge, and a sharpened top. Each hangs from its tower.
  this.doors=[-1,1].map(side=>{
   const planks=[],metal=[],c=-side*DOOR_W/2;
   planks.push(timber(DOOR_W,DOOR_H,.36,{at:[c,.25+DOOR_H/2,0],vertical:true,seed:side*3}));
   for(const y of [1.5,5,8.5])planks.push(timber(DOOR_W-.3,.5,.18,{at:[c,y,-.27],seed:y}));
   for(const [y0,y1]of [[1.5,5],[5,8.5]]){const dx=DOOR_W-1.1,dy=y1-y0,len=Math.hypot(dx,dy);planks.push(timber(len,.42,.16,{at:[c,(y0+y1)/2,-.27],rot:[0,0,side*Math.atan2(dy,dx)],seed:y0}));}
   for(let x=.25;x<DOOR_W;x+=.46)planks.push(timber(.34,.34,.3,{at:[-side*x,.25+DOOR_H+.02,0],rot:[0,0,Math.PI/4],seed:x}));
   for(const y of [1.5,5,8.5]){metal.push(timber(1.9,.2,.06,{at:[-side*1.05,y,-.39]}));metal.push(part(new T.CylinderGeometry(.11,.11,.7,8),[0,y,-.05]));for(const k of [.35,.95,1.6])metal.push(part(new T.CylinderGeometry(.045,.045,.04,6),[-side*k,y,-.43],[Math.PI/2,0,0]));}
   const hinge=new T.Group();hinge.position.set(side*HINGE,0,0);root.add(hinge);
   for(const [g,mat]of [[merged(planks),this.wood],[merged(metal),this.iron]]){const m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=true;hinge.add(m);}
   return {side,hinge};
  });
  // Flames: two torches on the road face, two braziers on the caps.
  this.flames=[];
  const torches=[[-TOWER,9.05,-2.3,1.0],[TOWER,9.05,-2.3,1.0],[-TOWER,15.3,0,1.5],[TOWER,15.3,0,1.5]];
  const plane=new T.PlaneGeometry(1,1).translate(0,.5,0);
  torches.forEach(([x,y,zz,s],i)=>{
   // A wide, tall tongue and a narrow, quicker one with its own noise.
   for(const k of [0,1]){const mat=new T.ShaderMaterial({uniforms:{uTime:this.time,uSeed:{value:i*1.37+k*.71},uPower:{value:k?.8:1}},vertexShader:FLAME_VS,fragmentShader:FLAME_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
    const f=new T.Mesh(plane,mat);f.position.set(x+(k?.08:0),y,zz);f.scale.set(s*(k?.62:1),s*(k?1.25:1.85),1);f.userData.noReflect=true;f.frustumCulled=false;f.renderOrder=60;root.add(f);this.flames.push(f);}
  });
  const count=36*torches.length,origin=new Float32Array(count*3),seed=new Float32Array(count*4);
  for(let i=0;i<count;i++){const [x,y,zz,s]=torches[i%torches.length];origin.set([x+(Math.random()-.5)*.4*s,y+.3*s,zz+(Math.random()-.5)*.4*s],i*3);seed.set([Math.random(),Math.random(),Math.random(),Math.random()],i*4);}
  const eg=new T.BufferGeometry();eg.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));eg.setAttribute('aOrigin',new T.BufferAttribute(origin,3));eg.setAttribute('aSeed',new T.BufferAttribute(seed,4));
  this.emberScale={value:600};
  this.embers=new T.Points(eg,new T.ShaderMaterial({uniforms:{uTime:this.time,uScale:this.emberScale},vertexShader:EMBER_VS,fragmentShader:EMBER_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  this.embers.frustumCulled=false;this.embers.userData.noReflect=true;this.embers.renderOrder=61;root.add(this.embers);
  // One light between the four flames, low enough to wash the doors and the road. It lives
  // on the scene, not the hidden root: a light dropping out of the count recompiles every material.
  this.light=new T.PointLight(0xff8a3c,0,34,2);root.updateMatrixWorld(true);this.light.position.copy(root.localToWorld(new T.Vector3(0,9.6,-3.4)));scene.add(this.light);
 }
 /** Door angle (0 shut, 1 full) for a camera at z: a heavy swing over the intro's first
  *  two seconds (about 1.7 s at the intro's speed), clear 14 m out, with a small rebound off the stops. */
 static openAt(z){const u=Math.min(1,Math.max(0,(z-(GATE_Z-42))/28));return smooth(0,1,u)+.07*Math.sin(Math.PI*Math.min(1,Math.max(0,(u-.72)/.28)));}
 update(id,camera,time,{height=600}={}){
  const z=camera.position.z,on=id==='gates'&&z<GATE_Z+30;this.root.visible=on;this.time.value=time;
  if(!on){this.light.intensity=0;return;}
  this.open=Gate.openAt(z);
  for(const d of this.doors)d.hinge.rotation.y=d.side*this.open*OPEN;
  // The doors hit their stops (and bounce off them) once: a heavy timber thud.
  if(!this.slammed&&this.open>1.02){this.slammed=true;this.cues.push({type:'slam',at:this.root.localToWorld(new T.Vector3(0,3,4))});}
  if(z<GATE_Z-42)this.slammed=false;
  const flicker=.84+.09*Math.sin(time*13.1)+.07*Math.sin(time*23.7+1.3)+.05*Math.sin(time*5.3);
  this.light.intensity=70*flicker*(1-smooth(GATE_Z-2,GATE_Z+6,z));
  this.emberScale.value=height/(2*Math.tan(camera.fov*Math.PI/360));
 }
 drain(){return this.cues.splice(0);}
}
