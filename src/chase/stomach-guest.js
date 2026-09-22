import * as T from 'three';
import {box,cylinder,tube,sphere,mergeStatic} from './vehicle-geometry.js';
import {DEFEAT} from './defeat.js';

function painted(draw){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;draw(canvas.getContext('2d'));
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
function cloth(profile){
 const vertices=[],uv=[],indices=[],segments=32;
 for(let j=0;j<profile.length;j++)for(let i=0;i<=segments;i++){
  const [y,w,d]=profile[j],a=i/segments*Math.PI*2,fold=1+.035*Math.sin(a*9+j*1.7);
  vertices.push(Math.sin(a)*w*fold,y+(j===0?.014*Math.sin(a*13):0),Math.cos(a)*d*fold);uv.push(i/segments,j/(profile.length-1));
 }
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function mesh(parent,geometry,material,position=[0,0,0]){const m=new T.Mesh(geometry,material);m.position.set(...position);parent.add(m);return m;}
function strand(parent,material,points,radius=.007){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,radius,6,false),material);}
function sleeve(parent,material,points){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,16,.082,16,false),p=g.attributes.position,uv=g.attributes.uv,center=new T.Vector3(),v=new T.Vector3();
 for(let i=0;i<=16;i++){const u=i/16;curve.getPointAt(u,center);for(let j=0;j<=16;j++){const n=i*17+j;v.fromBufferAttribute(p,n).sub(center).multiplyScalar(1-u*.23).add(center);p.setXYZ(n,v.x,v.y,v.z);uv.setXY(n,j/16*.65,u);}}
 g.computeVertexNormals();return mesh(parent,g,material);
}
function exposeSkull(geometry){
 const p=geometry.attributes.position,index=geometry.index.array,skin=[],bone=[],border=[],edgeMap=new Map();
 for(let i=0;i<index.length;i+=3){
  const tri=[index[i],index[i+1],index[i+2]],center=new T.Vector3();for(const n of tri)center.add(new T.Vector3().fromBufferAttribute(p,n));center.multiplyScalar(1/3);
  const x=(center.x+.073)/.088,y=(center.y-.100)/.103,edge=1+.10*Math.sin(center.x*110+center.y*91);
  const exposed=center.z<-.012&&center.y>.036&&x*x+y*y<edge;
  const wornEdge=center.z<-.008&&center.y>.027&&x*x+y*y<edge*1.23;
  (exposed?bone:wornEdge?border:skin).push(...tri);
  if(exposed)for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edgeMap.has(key))edgeMap.delete(key);else edgeMap.set(key,[a,b]);}
 }
 const skull=geometry.clone(),borderGeo=geometry.clone(),bonePositions=skull.attributes.position;borderGeo.setIndex(border);
 for(let i=0;i<bonePositions.count;i++){bonePositions.setXYZ(i,p.getX(i)*.968,p.getY(i)*.968,p.getZ(i)*.968);}
 skull.setIndex(bone);skull.computeVertexNormals();geometry.setIndex(skin);geometry.computeVertexNormals();
 const rim=[];
 for(const [a,b]of edgeMap.values())for(const [n,depth]of [[a,1],[b,1],[a,.968],[b,1],[b,.968],[a,.968]])rim.push(p.getX(n)*depth,p.getY(n)*depth,p.getZ(n)*depth);
 const margin=new T.BufferGeometry();margin.setAttribute('position',new T.Float32BufferAttribute(rim,3));margin.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(rim.length/3*2),2));margin.computeVertexNormals();
 return{skull,margin,border:borderGeo};
}

/** A late, diegetic sight gag inside the existing throat shot. All movement
 * follows defeat time, including the pooled bubbles and loose costume pieces. */
export function createStomachGuest(scene){
 const root=new T.Group();root.name='stomach-lawyer-reveal';root.visible=false;scene.add(root);
 let seed=19930611;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const stained=painted(c=>{
  c.fillStyle='#6a7b86';c.fillRect(0,0,512,512);
  for(let x=0;x<512;x+=12){c.fillStyle='#c7ceca';c.fillRect(x,0,3,512);c.fillStyle='#3d4e59';c.fillRect(x+5,0,1,512);}
  for(let i=0;i<100;i++){const x=rand()*512,y=rand()*512,r=5+rand()*40,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3?'#51573450':'#44352e65');g.addColorStop(1,'#25291800');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  for(let i=0;i<1800;i++){c.fillStyle=i%2?'#f3e5c212':'#17241618';c.fillRect(rand()*512,rand()*512,1,3);}
 });
 const tieMap=painted(c=>{
  c.fillStyle='#242626';c.fillRect(0,0,512,512);
  for(let y=12;y<512;y+=62)for(let x=12;x<512;x+=75){const px=x+(y%124?28:0);c.strokeStyle='#776b504e';c.lineWidth=4;c.strokeRect(px,y,20,27);c.fillStyle='#92826660';c.fillRect(px+7,y+8,6,10);}
 });
 const skinMap=painted(c=>{
  c.fillStyle='#b4ac87';c.fillRect(0,0,512,512);
  for(let i=0;i<75;i++){const x=rand()*512,y=rand()*512,r=16+rand()*48,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3?'#626a4850':'#5b39435a');g.addColorStop(1,'#48372300');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  for(let i=0;i<1700;i++){c.fillStyle='#3d3f2c30';c.fillRect(rand()*512,rand()*512,1,1);}
 });
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.67,...extra});
 const acidLevel=-5.48,poolUniforms={time:{value:0},reveal:{value:0}};
 const m={shirt:mat(0xd5d9d4,{map:stained,bumpMap:stained,bumpScale:.001,side:T.DoubleSide}),cuff:mat(0xaeb9b8),skin:mat(0xb8ae92,{map:skinMap,roughness:.65}),shade:mat(0x5d5947),bruise:mat(0x514349),hair:mat(0x37342b),shorts:mat(0x4c4d43),tie:mat(0xffffff,{map:tieMap,roughness:.76,side:T.DoubleSide}),leather:mat(0x302b20),sock:mat(0x484b3c),button:mat(0x969d97),metal:mat(0x817763,{metalness:.5,roughness:.45}),slime:mat(0x6b713b,{roughness:.23})};
 // Shallow hands remain visible through the film; deeper limbs fade into the
 // murk. Apply absorption in world space so the waterline follows the lean.
 for(const material of Object.values(m)){
  material.onBeforeCompile=shader=>{
   shader.uniforms.acidLevel={value:acidLevel};shader.uniforms.acidReveal=poolUniforms.reveal;
   shader.vertexShader='varying float acidY;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nacidY=(modelMatrix*vec4(transformed,1.)).y;');
   shader.fragmentShader='varying float acidY;uniform float acidLevel;uniform float acidReveal;\n'+shader.fragmentShader.replace('#include <tonemapping_fragment>',`
    float depth=max(0.,acidLevel-acidY),wet=smoothstep(0.,.025,depth);
    vec3 submerged=mix(gl_FragColor.rgb*vec3(.72,.84,.36),vec3(.014,.020,.006)*acidReveal,1.-exp(-depth*6.));
    gl_FragColor.rgb=mix(gl_FragColor.rgb,submerged,wet);
    #include <tonemapping_fragment>`);
  };
  material.customProgramCacheKey=()=> 'stomach-absorption-v1';
 }

 // Shoulder/back settle into the side wall, with the legs trailing into fluid.
 const guest=new T.Group();guest.name='gennaro';guest.position.set(1.66,-6.05,11.60);guest.scale.setScalar(1.40);guest.rotation.y=.62;root.add(guest);
 sphere(guest,m.shorts,.20,[0,.55,.015],[1.05,.62,.85]);
 const body=new T.Group();body.position.set(0,.57,0);body.rotation.set(.22,0,-.20);guest.add(body);
 mesh(body,cloth([[0,.18,.13],[.15,.19,.14],[.36,.23,.13],[.49,.21,.12],[.54,.12,.08]]),m.shirt);
 cylinder(body,m.skin,.062,.073,.14,[0,.56,0],[0,0,0]);
 for(const s of [-1,1]){
  const sag=s*.085;
  box(body,m.shirt,[.09,.125,.026],[s*.064,.49,-.107],[0,s*.1,s*.36]);
  sleeve(body,m.shirt,[[s*.198,.437,0],[s*.32,.15,-.10],[s*.40,-.10+sag,-.19],[s*.43,-.238+sag,-.22]]);
  tube(body,m.cuff,[s*.429,-.205+sag,-.211],[s*.432,-.280+sag,-.234],.066);
  sphere(body,m.button,.007,[s*.486,-.248+sag,-.24]);
  sphere(body,m.skin,.059,[s*.43,-.31+sag,-.25],[.8,1.15,.65]);
  for(let i=0;i<4;i++)strand(body,m.skin,[[s*.43+(i-1.5)*.019,-.33+sag,-.28],[s*.43+(i-1.5)*.019,-.39+sag,-.30],[s*.43+(i-1.5)*.018,-.41+sag,-.27]],.009);
  sphere(body,m.skin,.017,[s*.389,-.335+sag,-.242],[1,1.6,1]);
  // Frayed strips at the cuffs/hem catch the moving pool light.
  for(let i=0;i<2;i++)box(body,m.cuff,[.01,.045+rand()*.02,.007],[s*(.405+i*.034),-.263+sag,-.24],[.2,0,s*.2]);
  tube(guest,m.shorts,[s*.12,.59,0],[s*.19,.54,-.24],.112);
  tube(guest,m.skin,[s*.19,.54,-.24],[s*.23,.5,-.43],.083);
  sphere(guest,m.skin,.082,[s*.23,.5,-.43]);
  tube(guest,m.skin,[s*.23,.49,-.43],[s*.25,.18,-.49],.058);
  tube(guest,m.sock,[s*.25,.24,-.49],[s*.255,.055,-.55],.06);
  sphere(guest,m.leather,.11,[s*.255,.05,-.61],[.78,.5,1.55]);
  for(let i=0;i<3;i++)tube(guest,m.shade,[s*.255-.034,.106,-.58-i*.024],[s*.255+.034,.106,-.58-i*.024],.003);
 }
 for(let i=0;i<5;i++)sphere(body,m.button,.007,[0,.11+i*.07,-.146],[1,1,.3]);
 box(body,m.leather,[.34,.04,.26],[0,.018,0]);box(body,m.metal,[.045,.029,.012],[.01,.018,-.142]);
 const tie=new T.Group();tie.position.set(.005,.48,-.17);tie.rotation.z=-.08;body.add(tie);
 sphere(tie,m.tie,.037,[0,0,0],[.65,1,.5]);
 const tieShape=new T.Shape();tieShape.moveTo(-.018,-.025);tieShape.lineTo(-.046,-.47);tieShape.lineTo(.003,-.535);tieShape.lineTo(.050,-.47);tieShape.lineTo(.018,-.025);
 const tieGeo=new T.ShapeGeometry(tieShape),tieUv=tieGeo.attributes.uv,tiePos=tieGeo.attributes.position;
 for(let i=0;i<tieUv.count;i++)tieUv.setXY(i,(tiePos.getX(i)+.05)/.1,(tiePos.getY(i)+.54)/.54);
 mesh(tie,tieGeo,m.tie).rotation.y=Math.PI;

 const head=new T.Group();head.position.set(.008,.68,-.055);head.rotation.set(.20,-.10,-.17);body.add(head);
 const faceGeo=new T.SphereGeometry(.155,48,40),p=faceGeo.attributes.position;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i)*.90,y=p.getY(i)*1.20,z=p.getZ(i)*.85;
  x*=1+.07*Math.exp(-Math.pow((y+.10)/.035,2));
  if(z<0){
   const front=Math.pow(-z/Math.max(.001,Math.hypot(x,z)),4),nose=.067*Math.exp(-Math.pow(x/.025,2)-Math.pow((y+.03)/.06,2)),bridge=.012*Math.exp(-Math.pow(x/.021,2)-Math.pow((y-.026)/.075,2));
   const cheek=.017*Math.exp(-Math.pow((Math.abs(x)-.078)/.028,2)-Math.pow((y+.045)/.035,2)),hollow=.024*Math.exp(-Math.pow((Math.abs(x)-.074)/.035,2)-Math.pow((y+.085)/.03,2)),socket=.015*Math.exp(-Math.pow((Math.abs(x)-.052)/.028,2)-Math.pow((y-.026)/.023,2));
   const chin=.017*Math.exp(-Math.pow(x/.060,2)-Math.pow((y+.13)/.031,2)),furrow=.002*Math.sin(y*235)*Math.exp(-Math.pow((y-.104)/.039,2));
   z-=(nose+bridge+cheek+chin-hollow-socket+furrow)*front;
  }
  p.setXYZ(i,x,y,z);
 }
 faceGeo.computeVertexNormals();const exposed=exposeSkull(faceGeo);mesh(head,faceGeo,m.skin,[0,.075,0]);
 const boneMap=painted(c=>{c.fillStyle='#e4d7b6';c.fillRect(0,0,512,512);for(let i=0;i<900;i++){c.fillStyle=i%3?'#887b6030':'#e4dec32a';c.fillRect(rand()*512,rand()*512,1+rand()*4,1+rand()*4);}});
 mesh(head,exposed.skull,mat(0xffffff,{map:boneMap,bumpMap:boneMap,bumpScale:.0008,roughness:.73}),[0,.075,0]);
 const woundEdge=mat(0x51302a,{side:T.DoubleSide,roughness:.68});
 mesh(head,exposed.margin,woundEdge,[0,.075,0]);mesh(head,exposed.border,woundEdge,[0,.075,0]);
 // Short cranial sutures follow the inset bone, so the pale patch reads as
 // exposed skull rather than a different skin tone or a flat decal.
 const skullPoint=(x,y)=>{
  let closest=Infinity,point;
  for(let i=0;i<p.count;i++){if(p.getZ(i)>=0)continue;const d=(p.getX(i)-x)**2+(p.getY(i)-y)**2;if(d<closest){closest=d;point=[p.getX(i)*.968,p.getY(i)*.968+.075,p.getZ(i)*.968-.001];}}
  return point;
 };
 const suture=mat(0x82765d,{roughness:.87});
 strand(head,suture,[[-.020,.161],[-.027,.149],[-.022,.139],[-.034,.129],[-.030,.119],[-.042,.108],[-.048,.093]].map(([x,y])=>skullPoint(x,y)),.0013);
 strand(head,suture,[[-.034,.129],[-.048,.134],[-.056,.128],[-.069,.131],[-.079,.125]].map(([x,y])=>skullPoint(x,y)),.0011);
 for(const s of [-1,1]){
  sphere(head,m.skin,.042,[s*.137,.065,.006],[.35,1,.7]);
  sphere(head,m.bruise,.027,[s*.052,.097,-.123],[1,.38,.10]);
  sphere(head,m.skin,.030,[s*.052,.105,-.127],[1,.43,.38]);
  strand(head,m.shade,[[s*.025,.104,-.130],[s*.050,.098,-.139],[s*.079,.102,-.124]],.0025);
  if(s>0)strand(head,m.hair,[[s*.020,.140,-.141],[s*.045,.155,-.128],[s*.083,.139,-.106]],.007);
  sphere(head,m.shade,.007,[s*.014,.006,-.193],[.8,.5,.5]);
 }
 // A close scalp surface around the temples/back, with a receding front.
 const hairGeo=new T.PlaneGeometry(1,1,36,10),hp=hairGeo.attributes.position,huv=hairGeo.attributes.uv;
 for(let i=0;i<hp.count;i++){const a=(huv.getX(i)-.5)*4.15,top=.52+Math.pow(Math.abs(a)/2.075,3)*.56,theta=T.MathUtils.lerp(top,1.84,huv.getY(i));hp.setXYZ(i,.141*Math.sin(theta)*Math.sin(a),.075+.188*Math.cos(theta),.134*Math.sin(theta)*Math.cos(a));}
 hairGeo.computeVertexNormals();mesh(head,hairGeo,new T.MeshStandardMaterial({color:0x302e24,roughness:.9,side:T.DoubleSide}));
 // Filtered wisps lie on the scalp; tiny geometric strands alias at phone size.
 const crownMap=painted(c=>{
  for(let i=0;i<60;i++){const x=70+rand()*350;c.strokeStyle=`rgba(40,35,28,${.4+rand()*.4})`;c.lineWidth=2+rand()*4;c.beginPath();c.moveTo(x,500);c.bezierCurveTo(x+45,360,x+35,120,x+75,0);c.stroke();}
  c.globalCompositeOperation='destination-in';const fade=c.createRadialGradient(256,250,100,256,250,285);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');c.fillStyle=fade;c.fillRect(0,0,512,512);
 });
 const crownGeo=new T.PlaneGeometry(1,1,12,16),cp=crownGeo.attributes.position,cu=crownGeo.attributes.uv;
 for(let i=0;i<cp.count;i++){const x=(cu.getX(i)-.5)*.12,z=(cu.getY(i)-.5)*.16,y=.075+.188*Math.sqrt(Math.max(0,1-(x/.141)**2-(z/.134)**2));cp.setXYZ(i,x,y+.001,z);}
 crownGeo.computeVertexNormals();mesh(head,crownGeo,new T.MeshStandardMaterial({map:crownMap,transparent:true,depthWrite:false,side:T.DoubleSide,roughness:.94}));
 strand(head,m.shade,[[-.036,-.042,-.128],[0,-.039,-.147],[.037,-.042,-.128]],.003);
 strand(head,m.skin,[[-.034,-.046,-.125],[0,-.05,-.143],[.034,-.046,-.125]],.005);
 // A thin wet trail crosses the intact cheek beneath the exposed temple.
 strand(head,m.slime,[[.088,.136,-.107],[.10,.045,-.107],[.075,-.055,-.09],[.044,-.10,-.07]],.005);
 for(const group of [guest,body,head,tie])mergeStatic(group);

 const chamberMap=painted(c=>{c.fillStyle='#4f3027';c.fillRect(0,0,512,512);for(let i=0;i<100;i++){c.strokeStyle=i%3?'#6c493d50':'#20181180';c.lineWidth=3+rand()*12;c.beginPath();const x=rand()*512;c.moveTo(x,0);c.bezierCurveTo(x+80,180,x-80,340,x,512);c.stroke();}});
 // Close only the far end; a full sphere would cut across the throat walls.
 const chamberGeo=new T.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI/2);chamberGeo.rotateX(Math.PI/2);
 const chamber=mesh(root,chamberGeo,mat(0x796146,{map:chamberMap,bumpMap:chamberMap,bumpScale:.08,side:T.BackSide,roughness:.38}),[-.088,-6.084,13]);chamber.scale.set(2.6,2.35,2.3);
 const poolMat=new T.ShaderMaterial({uniforms:poolUniforms,side:T.DoubleSide,transparent:true,depthWrite:false,vertexShader:`
  uniform float time;varying vec2 coord;varying float ripple;
  void main(){coord=uv;vec3 p=position;ripple=sin(p.x*8.+time*1.6)*cos(p.y*6.-time*.8);p.z+=ripple*.018;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
 `,fragmentShader:`
  uniform float time;uniform float reveal;varying vec2 coord;varying float ripple;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  void main(){vec2 p=(coord-.5)*2.;float r=length(p);vec2 drift=p*11.+vec2(sin(p.y*4.+time*.2),cos(p.x*3.-time*.16))*.6;
   float film=noise(drift)*.65+noise(drift*2.7)*.35,glint=pow(max(0.,ripple),24.)*smoothstep(.5,.75,film);vec3 color=mix(vec3(.009,.017,.006),vec3(.053,.061,.020),film);
   color+=vec3(.16,.15,.06)*glint*.28;color*=reveal*(1.-smoothstep(.5,1.05,r)*.72);gl_FragColor=vec4(color,.60+film*.12);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const pool=mesh(root,new T.CircleGeometry(2.75,64),poolMat,[0,acidLevel,11.8]);pool.rotation.x=-Math.PI/2;
 const bubbles=new T.InstancedMesh(new T.SphereGeometry(1,24,16),mat(0x8b8948,{roughness:.17,metalness:.12}),28);bubbles.frustumCulled=false;root.add(bubbles);
 const rings=new T.InstancedMesh(new T.TorusGeometry(1,.045,8,64),new T.MeshBasicMaterial({color:0x878d57,transparent:true,opacity:.12,depthWrite:false}),12);rings.frustumCulled=false;root.add(rings);
 const bubbleData=Array.from({length:28},()=>({x:(rand()-.5)*3.5,z:10.2+rand()*3.1,phase:rand(),radius:.025+rand()*.055})),dummy=new T.Object3D();
 const key=new T.PointLight(0xc5d0bc,0,7,2);key.position.set(.75,-3.65,9.9);root.add(key);
 const acidLight=new T.PointLight(0x899d58,0,5,2);acidLight.position.set(.15,-5.15,10.85);root.add(acidLight);
 const ambient=new T.AmbientLight(0x86866b,0);root.add(ambient);
 let reveal=0;
 function reset(){root.visible=false;reveal=0;key.intensity=acidLight.intensity=ambient.intensity=0;poolUniforms.reveal.value=0;}
 function update(t,progress,reducedMotion){
  // Light rises once as the camera clears the bend. No flashing or sudden cut.
  reveal=T.MathUtils.smoothstep(progress,.60,.91)*(1-T.MathUtils.smoothstep(t,DEFEAT.acidAt,DEFEAT.black));
  root.visible=reveal>0;if(!root.visible)return;
  const clock=t-DEFEAT.slideAt,motion=reducedMotion?.25:1,swell=Math.sin(clock*2.1)*.016*motion;
  key.intensity=8*reveal;acidLight.intensity=1.1*reveal;ambient.intensity=.12*reveal;
  poolUniforms.time.value=clock;poolUniforms.reveal.value=reveal;
  guest.position.y=-6.05+swell*.3;body.rotation.z=-.20+Math.sin(clock*1.7)*.004*motion;
  head.rotation.z=-.17+Math.sin(clock*1.6-.5)*.028*motion;
  tie.rotation.x=.18+Math.sin(clock*1.9)*.07*motion;
  for(let i=0;i<bubbleData.length;i++){
   const b=bubbleData[i],u=(clock*(reducedMotion?.14:.32)+b.phase)%1,size=b.radius*Math.sin(Math.PI*u);
   dummy.position.set(b.x,-5.52+u*.10,b.z);dummy.rotation.set(0,0,0);dummy.scale.set(size,size*.6,size);dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);
   if(i<12){dummy.position.y=-5.472;dummy.rotation.x=Math.PI/2;dummy.scale.setScalar(b.radius*(1+u*4));dummy.scale.z*=1-u;dummy.updateMatrix();rings.setMatrixAt(i,dummy.matrix);}
  }
  bubbles.instanceMatrix.needsUpdate=true;rings.instanceMatrix.needsUpdate=true;
 }
 reset();return{root,guest,head,tie,pool,update,reset,get reveal(){return reveal;}};
}
