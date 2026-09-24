import * as T from 'three';
import {WET} from './weather-state.js';
// Wet footfalls. A planted foot drives water and mud outward in a crown: each
// droplet flies a ballistic arc (spawned at the foot's edge with the ground's
// own velocity) and is drawn as a motion-stretched streak, never a puff. The
// foot leaves a three-toed impression whose walls are lit from the depression's
// slope, with water pooling in the deepest part; prints ride away with the road.

const DROPS=1600,PRINTS=40,GRAVITY=9.8;

function dropletMesh(){
 const g=new T.InstancedBufferGeometry();
 g.setAttribute('corner',new T.Float32BufferAttribute([-1,0,1,0,-1,1,1,1],2));g.setIndex([0,2,1,1,2,3]);
 const a0=new T.InstancedBufferAttribute(new Float32Array(DROPS*4).fill(-1e4),4),a1=new T.InstancedBufferAttribute(new Float32Array(DROPS*4),4);
 a0.setUsage(T.DynamicDrawUsage);a1.setUsage(T.DynamicDrawUsage);g.setAttribute('a0',a0);g.setAttribute('a1',a1);g.instanceCount=DROPS;
 const uniforms={time:{value:0},viewport:{value:new T.Vector2(1,1)},minPx:{value:1},water:{value:new T.Color()},mud:{value:new T.Color(.075,.055,.04)}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:false,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec2 corner;attribute vec4 a0,a1;uniform float time,minPx;uniform vec2 viewport;
   varying vec2 vUv;varying float vAlpha,vMud;
   vec3 at(float t){return a0.xyz+a1.xyz*t+vec3(0.,-${(GRAVITY/2).toFixed(2)}*t*t,0.);}
   void main(){
    // Sheet fragments pinch off into drops within a quarter second and fall like them.
    float t=time-a0.w,sheet=step(.02,a1.w),size=abs(a1.w)*mix(1.,.35,sheet*smoothstep(.12,.3,t)),life=1.6;vUv=corner;vMud=step(a1.w,0.);
    vec3 p=at(t),q=at(max(0.,t-.028));
    vec4 h=projectionMatrix*viewMatrix*vec4(p,1.),e=projectionMatrix*viewMatrix*vec4(q,1.);
    if(t<0.||t>life||p.y<-.02||h.w<.3||e.w<.3){gl_Position=vec4(2.,2.,2.,1.);vAlpha=0.;return;}
    vec2 d=(h.xy/h.w-e.xy/e.w)*viewport;float len=length(d);vec2 dir=len>1e-3?d/len:vec2(0.,1.);
    float px=size*projectionMatrix[1][1]*viewport.y*.5/h.w,drawn=max(px,minPx);
    vec4 c=mix(h,e,corner.y);c.xy+=vec2(-dir.y,dir.x)*corner.x*drawn/viewport*c.w;
    // Stretch a still droplet a little so it never collapses to a dot.
    c.y+=corner.y*(len<drawn?drawn/viewport.y*c.w:0.);
    gl_Position=c;vAlpha=(1.-smoothstep(life*.55,life,t))*mix(.45,1.,min(1.,px/minPx))*mix(1.,mix(.42,.9,smoothstep(.12,.3,t)),sheet);
   }`,
  fragmentShader:`uniform vec3 water,mud;varying vec2 vUv;varying float vAlpha,vMud;
   void main(){float a=(1.-vUv.x*vUv.x)*mix(1.,.45,vUv.y)*vAlpha*mix(.75,.95,vMud);if(a<.01)discard;gl_FragColor=vec4(mix(water,mud,vMud),a);}`});
 const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=5;mesh.name='Footfall splashes';
 return{mesh,uniforms,a0,a1};
}

// The crown: a thin wall of muddy water that jumps up around the foot, flares
// outward and tears into fingers; at its apex the rim pinches off into drops
// (rimDrops) that fall back outside it, each landing as a ring on the puddle.
// It is what makes a heavy splash readable from the gunner's seat.
const CROWNS=10,CROWN_LIFE=.5;
function crownMesh(){
 const geometry=new T.CylinderGeometry(1,1,1,40,4,true);geometry.translate(0,.5,0);
 const data=new T.InstancedBufferAttribute(new Float32Array(CROWNS*2).fill(1),2);data.setUsage(T.DynamicDrawUsage);geometry.setAttribute('crown',data);
 const uniforms={...T.UniformsUtils.clone(T.UniformsLib.fog),water:{value:new T.Color()},mud:{value:new T.Color(.1,.078,.056)}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:true,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec2 crown;varying float vY,vAng,vAge,vSeed;
   #include <fog_pars_vertex>
   void main(){
    float a=crown.x,s=crown.y;vAge=a;vY=uv.y;vAng=uv.x;vSeed=s;
    // The wall rises to its apex and stays; it does not sink back into the ground.
    // After the apex its rim is consumed top-down as it pinches off into drops.
    float grow=1.-pow(1.-min(a*1.7,1.),2.),rise=(1.-pow(1.-min(a*2.2,1.),2.))*(1.-.18*smoothstep(.45,1.,a));
    float ang=uv.x*6.2832,n=.5+.5*sin(ang*7.+s*13.)*sin(ang*3.-s*5.);
    vec3 p=position;float r=(.4+.6*grow*s)*(1.+.45*p.y*grow);
    p.xz*=r;p.y*=(.3+.7*s)*rise*(.7+.6*n)*.72;
    vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform vec3 water,mud;varying float vY,vAng,vAge,vSeed;
   #include <fog_pars_fragment>
   float h1(float x){return fract(sin(x*91.3+vSeed*17.)*437.5);}
   float n1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h1(i),h1(i+1.),f);}
   void main(){
    // Torn rim: the sheet breaks into tapering fingers of varying height, with
    // thinner fluid streaks running up it; the foot of the wall stays sheer.
    float jag=.4+.6*n1(vAng*44.)*n1(vAng*13.+5.)-.95*smoothstep(.35,1.,vAge);
    float streak=.45+.55*n1(vAng*120.+vY*6.);
    float a=smoothstep(jag,jag-.25,vY)*streak*(.25+.75*smoothstep(0.,.18,vY))*(1.-smoothstep(.6,1.,vAge))*smoothstep(0.,.06,vAge)*.5;
    if(a<.01)discard;
    gl_FragColor=vec4(mix(mud,water*1.35,smoothstep(.05,.6,vY)),a);
    #include <fog_fragment>
   }`});
 const mesh=new T.InstancedMesh(geometry,material,CROWNS);mesh.frustumCulled=false;mesh.renderOrder=5;mesh.name='Splash crowns';
 return{mesh,data,uniforms};
}

// Where a falling drop lands: a small ring on the puddle, placed at the drop's
// analytic landing point and time, riding the road afterwards.
const RINGS=520,RING_LIFE=.5;
function ringMesh(){
 const g=new T.InstancedBufferGeometry();
 g.setAttribute('corner',new T.Float32BufferAttribute([-1,-1,1,-1,-1,1,1,1],2));g.setIndex([0,2,1,1,2,3]);
 const a0=new T.InstancedBufferAttribute(new Float32Array(RINGS*4).fill(-1e4),4),a1=new T.InstancedBufferAttribute(new Float32Array(RINGS*2),2);
 a0.setUsage(T.DynamicDrawUsage);a1.setUsage(T.DynamicDrawUsage);g.setAttribute('a0',a0);g.setAttribute('a1',a1);g.instanceCount=RINGS;
 const uniforms={...T.UniformsUtils.clone(T.UniformsLib.fog),time:{value:0},water:{value:new T.Color()}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:true,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec2 corner;attribute vec4 a0;attribute vec2 a1;uniform float time;varying vec2 vUv;varying float vAge;
   #include <fog_pars_vertex>
   void main(){
    float t=time-a0.w;vAge=t/${RING_LIFE.toFixed(2)};vUv=corner;
    if(vAge<0.||vAge>1.){gl_Position=vec4(2.,2.,2.,1.);return;}
    vec3 p=a0.xyz+vec3(corner.x,0.,corner.y)*a1.y+vec3(0.,0.,a1.x*t);
    vec4 mvPosition=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform vec3 water;varying vec2 vUv;varying float vAge;
   #include <fog_pars_fragment>
   void main(){
    float r=length(vUv),ring=smoothstep(.14,0.,abs(r-vAge))*pow(1.-vAge,1.5)+smoothstep(.3,0.,r)*smoothstep(.15,0.,vAge);
    float a=ring*.55;if(a<.01)discard;gl_FragColor=vec4(water,a);
    #include <fog_fragment>
   }`});
 const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.name='Drop landings';
 return{mesh,uniforms,a0,a1};
}

// Signed distance to a three-toed theropod print in a unit frame: +y toward the toes.
const PRINT_SDF=`
 float sdCapsule(vec2 p,vec2 a,vec2 b,float r){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r*mix(1.,.7,h);}
 float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
 float printSdf(vec2 p){
  // Broad fleshy toes and a wide heel pad, as in large theropod trackways.
  float heel=length((p-vec2(0.,-.3))/vec2(.34,.3))*.3-.3;
  float mid=sdCapsule(p,vec2(0.,-.05),vec2(0.,.66),.17);
  float inner=sdCapsule(p,vec2(-.08,-.05),vec2(-.42,.4),.15);
  float outer=sdCapsule(p,vec2(.08,-.05),vec2(.44,.36),.15);
  return smin(smin(heel,mid,.15),smin(inner,outer,.1),.14);
 }`;

function printMesh(){
 const geometry=new T.PlaneGeometry(1.5,1.6);geometry.rotateX(-Math.PI/2);
 const data=new T.InstancedBufferAttribute(new Float32Array(PRINTS*2),2);data.setUsage(T.DynamicDrawUsage);geometry.setAttribute('printData',data);
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.8,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 material.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 printData;varying vec2 vPrint;varying vec2 vPrintData;varying vec3 vPrintT,vPrintB;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvPrint=vec2(position.x,-position.z)/vec2(.75,.8);vPrintData=printData;vPrintT=normalize((modelViewMatrix*instanceMatrix*vec4(1.,0.,0.,0.)).xyz);vPrintB=normalize((modelViewMatrix*instanceMatrix*vec4(0.,0.,-1.,0.)).xyz);');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec2 vPrint;varying vec2 vPrintData;varying vec3 vPrintT,vPrintB;float printDepth,printRim,printWater,printAlpha;
   ${PRINT_SDF}
   // Height in metres across the print edge: a ~7 cm impression inside a low squeezed-up rim.
   float printH(float d){return -smoothstep(.03,-.07,d)*.07+smoothstep(.1,.03,abs(d-.06))*.018;}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
   {
    // x: fade (0..1), y: age in seconds. Left prints arrive mirrored by the instance matrix.
    float d=printSdf(vPrint);
    printDepth=smoothstep(.03,-.07,d);printRim=smoothstep(.1,.03,abs(d-.06));
    printWater=smoothstep(-.02,-.1,d);
    float ring=smoothstep(.05,0.,abs(d-vPrintData.y*1.1))*smoothstep(.9,0.,vPrintData.y)*step(0.,d);
    vec3 mud=vec3(.052,.036,.024),rim=vec3(.1,.075,.052);
    diffuseColor.rgb=mix(rim,mud,printDepth);
    printAlpha=max(printDepth*.92,printRim*.55)*vPrintData.x;
    printAlpha=max(printAlpha,ring*.35*vPrintData.x);
    diffuseColor.a=printAlpha;if(printAlpha<.01)discard;
   }`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(.62,.4,printDepth),.05,printWater);')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   {
    // Heightfield normal N - Hx*T - Hy*B: the walls tilt toward the centre and
    // catch the light; pooled water lies flat.
    float d0=printSdf(vPrint);vec2 e=vec2(.015,0.);
    vec2 g=vec2(printSdf(vPrint+e.xy)-printSdf(vPrint-e.xy),printSdf(vPrint+e.yx)-printSdf(vPrint-e.yx))/(2.*e.x);
    vec2 slope=(printH(d0+.005)-printH(d0-.005))/.01*g/vec2(.75,.8);
    normal=normalize(normal-(vPrintT*slope.x+vPrintB*slope.y)*(1.-printWater));
   }`);
 };
 material.customProgramCacheKey=()=> 'rex-footprint-v3';
 const mesh=new T.InstancedMesh(geometry,material,PRINTS);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.renderOrder=1;mesh.name='Mud footprints';
 return{mesh,data};
}

export function createMud(scene){
 const drops=dropletMesh(),prints=printMesh(),crowns=crownMesh(),rings=ringMesh();scene.add(drops.mesh,prints.mesh,crowns.mesh,rings.mesh);let ringId=0;
 // Register a drop by launch point/velocity/start; schedule its landing ring analytically.
 function launch(k,x,y,z,vx,vy,vz,t0,size,ring,groundSpeed){
  drops.a0.setXYZW(k,x,y,z,t0);drops.a1.setXYZW(k,vx,vy,vz,size);
  if(!ring)return;const tl=(vy+Math.sqrt(vy*vy+2*GRAVITY*Math.max(0,y)))/GRAVITY,j=ringId++%RINGS;
  rings.a0.setXYZW(j,x+vx*tl,.025,z+vz*tl,t0+tl);rings.a1.setXY(j,groundSpeed,Math.min(.3,.08+Math.abs(size)*9));
 }
 const crownState=Array.from({length:CROWNS},()=>({age:1,p:new T.Vector3(),yaw:0,strength:1}));let crownId=0;
 function crown(p,strength){const c=crownState[crownId++%CROWNS];c.age=0;c.p.set(p.x,.02,p.z);c.yaw=Math.random()*Math.PI*2;c.strength=strength;}
 let seed=2718;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 let time=0,cursor=0,scale=1,visible=true;
 const list=[],dir=new T.Vector3(0,0,-1),m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),v=new T.Vector3(),up=new T.Vector3(0,1,0);
 let last=null;
 function spray(p,strength,{count=50,mud=.3,spread=1,ground=10}={}){
  const n=Math.floor(count*scale);
  for(let i=0;i<n;i++){
   const k=cursor++%DROPS,a=rnd()*Math.PI*2,roll=rnd(),isMud=roll<mud,isSheet=!isMud&&roll<mud+.2,r=(.3+rnd()*.35)*spread;
   // The first crown rises steeply as broken sheets; the rest of the water flies
   // off the foot's edge at low-to-steep angles; mud clods are slower and heavier.
   const elev=isSheet?.95+rnd()*.4:(isMud?.35:.3)+rnd()*(isMud?.5:.85),speed=(isSheet?1.4+rnd()*1.6:isMud?1.4+rnd()*1.8:1.8+rnd()*3.6)*strength;
   const size=isSheet?.024+rnd()*.022:isMud?.012+rnd()*.012:.006+rnd()*.007;
   launch(k,p.x+Math.cos(a)*r,.04,p.z+Math.sin(a)*r,Math.cos(a)*Math.cos(elev)*speed,Math.sin(elev)*speed,Math.sin(a)*Math.cos(elev)*speed+ground,time+rnd()*(isSheet?.02:.06),isMud?-size:size,isMud||rnd()<.45,ground);
  }
  drops.a0.needsUpdate=drops.a1.needsUpdate=rings.a0.needsUpdate=rings.a1.needsUpdate=true;
 }
 // At the crown's apex its torn rim pinches off into drops that fly outward and fall back to the puddle.
 function rimDrops(p,strength,ground){
  const n=Math.floor(30*scale*Math.min(1.5,strength)),grow=.945,rim=(.4+.6*grow*strength)*(1+.45*grow),top=(.3+.7*strength)*.72,delay=CROWN_LIFE*.42;
  for(let i=0;i<n;i++){
   const k=cursor++%DROPS,a=rnd()*Math.PI*2,h=top*(.55+rnd()*.5),out=.9+rnd()*1.6;
   launch(k,p.x+Math.cos(a)*rim,h,p.z+Math.sin(a)*rim,Math.cos(a)*out,-.2+rnd()*.9,Math.sin(a)*out+ground,time+delay+rnd()*.08,.006+rnd()*.008,true,ground);
  }
 }
 return{
  drops:drops.mesh,prints:prints.mesh,get printCount(){return list.length;},
  setQuality(t){scale=Math.min(1,t.particles);},
  /** A wet footfall: crown splash plus a print when the foot lands on the flat road/verge. */
  step(p,speed,side){
   const w=WET.value;if(w<.05)return;
   const strength=T.MathUtils.clamp(speed/10,.65,1.35);
   spray(p,strength,{count:110*w,mud:.18,ground:speed});crown(p,strength*w);rimDrops(p,strength*w,speed);drops.a0.needsUpdate=drops.a1.needsUpdate=rings.a0.needsUpdate=rings.a1.needsUpdate=true;
   if(Math.abs(p.x)>14)return;
   // Stride direction: from the previous print (advected with the road) to this one.
   if(last&&time-last.time<1.4){v.set(p.x-last.p.x,0,p.z-last.p.z);if(v.lengthSq()>.25)dir.lerp(v.normalize(),.6).normalize();}else dir.set(0,0,-1);
   last={p:p.clone(),time};
   let e=list.length>=PRINTS?list.shift():{p:new T.Vector3()};
   Object.assign(e,{side,age:0,yaw:Math.atan2(dir.x,dir.z)+(rnd()-.5)*.12,size:1.05+rnd()*.15,fade:w});e.p.set(p.x,.004,p.z);list.push(e);
  },
  /** Body slams and skids in the wet. */
  burst(p,strength){if(WET.value<.05)return;spray(p,.9+strength*.8,{count:90*strength*WET.value,mud:.4,spread:1.6+strength,ground:0});crown(p,Math.min(1.8,.8+strength)*WET.value);rimDrops(p,Math.min(1.8,.8+strength)*WET.value,0);drops.a0.needsUpdate=drops.a1.needsUpdate=rings.a0.needsUpdate=rings.a1.needsUpdate=true;},
  update(dt,speed,camera,renderer,show=true){
   time+=dt;visible=show;drops.uniforms.time.value=rings.uniforms.time.value=time;rings.mesh.visible=show;
   renderer.getDrawingBufferSize(drops.uniforms.viewport.value);drops.uniforms.minPx.value=Math.max(1,renderer.getPixelRatio()*.9);
   drops.mesh.visible=show;prints.mesh.visible=show&&list.length>0;
   if(last)last.p.z+=speed*dt;
   crowns.mesh.visible=show;
   crownState.forEach((c,i)=>{if(c.age<1){c.age=Math.min(1,c.age+dt/CROWN_LIFE);c.p.z+=speed*dt;}q.setFromAxisAngle(up,c.yaw);s.setScalar(1);m.compose(c.p,q,s);crowns.mesh.setMatrixAt(i,m);crowns.data.setXY(i,c.age,c.strength);});
   crowns.mesh.instanceMatrix.needsUpdate=true;crowns.data.needsUpdate=true;
   let n=0;
   for(let i=list.length-1;i>=0;i--){const e=list[i];e.p.z+=speed*dt;e.age+=dt;if(e.p.z>85)list.splice(i,1);}
   for(const e of list){
    // Mirror left prints; the toes point along the stride.
    q.setFromAxisAngle(up,e.yaw+Math.PI);s.set(e.side==='L'?-e.size:e.size,1,e.size);
    m.compose(e.p,q,s);prints.mesh.setMatrixAt(n,m);
    prints.data.setXY(n,e.fade*(1-T.MathUtils.smoothstep(e.p.z,60,85)),e.age);n++;
   }
   prints.mesh.count=n;prints.mesh.instanceMatrix.needsUpdate=true;prints.data.needsUpdate=true;
  },
  tint(color){drops.uniforms.water.value.copy(color);crowns.uniforms.water.value.copy(color);rings.uniforms.water.value.copy(color).multiplyScalar(.85);},
  reset(){list.length=0;last=null;for(const c of crownState)c.age=1;drops.a0.array.fill(-1e4);drops.a0.needsUpdate=true;rings.a0.array.fill(-1e4);rings.a0.needsUpdate=true;prints.mesh.count=0;}
 };
}
