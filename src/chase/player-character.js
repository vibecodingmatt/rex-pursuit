import * as T from 'three';
import {box,cylinder,tube,sphere,mergeStatic} from './vehicle-geometry.js';
import {RULES} from './combat.js';

const UP=new T.Vector3(0,1,0);
function texture(paint){const c=document.createElement('canvas');c.width=c.height=512;paint(c.getContext('2d'),512);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;}
function rings(profile,segments=40,fold=0){
 const positions=[],uv=[],indices=[];
 for(let j=0;j<profile.length;j++){const [y,w,d,z=0]=profile[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=1+fold*Math.sin(a*7+y*31)*Math.sin(j/(profile.length-1)*Math.PI);positions.push(Math.sin(a)*w*r,y,Math.cos(a)*d*r+z);uv.push(i/segments,j/(profile.length-1));}}
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function add(parent,geometry,material,position=[0,0,0]){const m=new T.Mesh(geometry,material);m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function stitch(parent,material,points,r=.002){return add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*4),r,6,false),material);}

/** Rear-facing field palaeontologist braced below the intact rear cage. */
export function createPlayerCharacter(body){
 let seed=1993;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const weave=texture((c,s)=>{c.fillStyle='#a0abb3';c.fillRect(0,0,s,s);for(let y=0;y<s;y+=3)for(let x=0;x<s;x+=3){const n=100+random()*95;c.fillStyle=`rgba(${n},${n+8},${n+15},.38)`;c.fillRect(x+(y%6?1:0),y,1,3);}for(let i=0;i<400;i++){c.fillStyle='#ece5d80c';c.fillRect(random()*s,random()*s,random()*30,1);}});
 const straw=texture((c,s)=>{c.fillStyle='#c9b78b';c.fillRect(0,0,s,s);for(let y=0;y<s;y+=8)for(let x=0;x<s;x+=12){const n=125+random()*90;c.fillStyle=`rgb(${n*1.08},${n},${n*.76})`;c.fillRect(x+(y%16?6:0),y,10,3);c.fillStyle='#eee0b84a';c.fillRect(x,y+4,10,1);}});
 const paisley=texture((c,s)=>{c.fillStyle='#8c302a';c.fillRect(0,0,s,s);c.strokeStyle='#d3b494';c.lineWidth=2;for(let y=24;y<s;y+=64)for(let x=24;x<s;x+=64){c.beginPath();c.moveTo(x,y-15);c.bezierCurveTo(x+30,y+16,x-13,y+31,x-12,y+10);c.bezierCurveTo(x-10,y-5,x+12,y+7,x+3,y+11);c.stroke();c.fillStyle='#ded4b1';c.fillRect(x+25,y+22,2,2);}});
 const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.9,...extra});
 const m={shirt:standard(0x668fa9,{map:weave,bumpMap:weave,bumpScale:.0018}),seam:standard(0x8ea4ae),pants:standard(0x9c9475,{map:weave,bumpMap:weave,bumpScale:.001}),skin:standard(0xbd8e74,{roughness:.79}),skinShade:standard(0x946953),hair:standard(0x4b3828),leather:standard(0x483626),sole:standard(0x242522),button:standard(0x9c977d),scarf:standard(0xffffff,{map:paisley,bumpMap:paisley,bumpScale:.0004,side:T.DoubleSide}),hat:standard(0xd1c29b,{map:straw,bumpMap:straw,bumpScale:.0015,side:T.DoubleSide}),hatEdge:standard(0xa49169),eye:standard(0x87908a,{roughness:.45}),white:standard(0xd0c9b4),pupil:standard(0x202522,{roughness:.3})};
 const root=new T.Group();root.name='field-palaeontologist-gunner';root.position.z=.53;body.add(root);
 const upper=new T.Group();upper.position.y=1.33;root.add(upper);
 add(upper,rings([[0,.167,.115],[.10,.178,.127],[.23,.195,.138],[.39,.23,.143,.01],[.50,.226,.124,.018],[.565,.15,.098],[.595,.072,.062]],40,.024),m.shirt);
 // Shirt front: separate placket, pocket flaps, collars and restrained stitched seams.
 box(upper,m.shirt,[.026,.405,.018],[0,.239,.142]);
 for(let i=0;i<5;i++)sphere(upper,m.button,.006,[0,.068+i*.074,.155],[1,1,.5]);
 for(const s of [-1,1]){
  box(upper,m.shirt,[.122,.135,.014],[s*.122,.354,.143],[0,s*.11,0]);
  box(upper,m.shirt,[.128,.040,.018],[s*.122,.415,.156],[0,s*.11,s*.04]);
  stitch(upper,m.seam,[[s*.062,.414,.169],[s*.182,.414,.156]],.0014);stitch(upper,m.seam,[[s*.06,.397,.155],[s*.06,.292,.155],[s*.18,.292,.146]],.0012);
  sphere(upper,m.button,.005,[s*.12,.408,.170],[1,1,.5]);
  const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute([[s*.035,.594,.059],[s*.095,.580,.068],[s*.142,.491,.139],[s*.073,.517,.151]].flat(),3));cg.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));cg.setIndex(s===1?[0,2,1,0,3,2]:[0,1,2,0,2,3]);cg.computeVertexNormals();add(upper,cg,m.shirt);
  stitch(upper,m.seam,[[s*.063,.562,.092],[s*.093,.491,.12],[s*.136,.51,.095]],.002);
  stitch(upper,m.seam,[[s*.10,.514,-.105],[s*.20,.455,-.112],[s*.22,.41,-.10]],.0015);
 }
 stitch(upper,m.seam,[[-.206,.456,-.114],[0,.485,-.127],[.206,.456,-.114]],.002);
 // Belt, keeper loops and a small leather field pouch.
 add(upper,rings([[.012,.176,.126],[.060,.176,.126]],40),m.leather);
 box(upper,m.button,[.054,.037,.010],[0,.035,.133]);box(upper,m.leather,[.035,.023,.012],[0,.035,.139]);
 for(const x of [-.135,.135])box(upper,m.pants,[.014,.065,.016],[x,.038,.112]);
 box(upper,m.leather,[.092,.135,.055],[.175,.02,.02],[0,0,-.08]);box(upper,m.leather,[.097,.042,.060],[.177,.068,.021]);sphere(upper,m.button,.006,[.178,.058,.055]);
 // A folded neckerchief with a knot and unequal hanging points.
 const scarfRing=add(upper,new T.TorusGeometry(.071,.017,10,48),m.scarf,[0,.604,-.006]);scarfRing.rotation.x=Math.PI/2;
 sphere(upper,m.scarf,.022,[.012,.571,.075],[1,.8,.85]);
 function scarfTail(x,y,z,w,h,angle){const g=new T.PlaneGeometry(w,h,4,8),p=g.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getY(i)+h/2)/h;p.setX(i,p.getX(i)*(.3+.7*u));p.setZ(i,Math.sin(u*6+p.getX(i)*30)*.006);}g.computeVertexNormals();const tail=add(upper,g,m.scarf,[x,y,z]);tail.rotation.z=angle;}
 scarfTail(-.012,.513,.14,.071,.145,-.17);scarfTail(.033,.534,.151,.045,.10,.26);
 const head=new T.Group();head.position.set(0,.627,-.027);head.scale.setScalar(.86);upper.add(head);
 cylinder(head,m.skin,.052,.066,.136,[0,-.025,0],[0,0,0],24);
 // One sculpted facial surface: cheek planes, eye sockets, brow, bridge, lips and chin.
 const faceGeo=new T.SphereGeometry(1,64,48),p=faceGeo.attributes.position,colors=[];
 const skinColor=new T.Color(0xbd8e74),beard=new T.Color(0x766c60),flush=new T.Color(0xb67860);
 for(let i=0;i<p.count;i++){
  let x=p.getX(i)*.119,y=p.getY(i)*.158,z=p.getZ(i)*.112;
  x*=y<-.045?T.MathUtils.lerp(.75,1,T.MathUtils.clamp((y+.158)/.113,0,1)):1;
  if(z>0){const front=Math.pow(z/Math.max(.001,Math.hypot(x,z)),3),gauss=(cx,cy,wx,wy)=>Math.exp(-Math.pow((x-cx)/wx,2)-Math.pow((y-cy)/wy,2));
   z+=front*(.043*gauss(0,-.015,.024,.055)+.018*gauss(0,-.051,.029,.017)+.014*gauss(0,-.111,.045,.031)+.009*gauss(0,-.082,.040,.009)+.012*gauss(Math.sign(x)*.066,-.018,.03,.033)-.017*gauss(Math.sign(x)*.047,.027,.025,.019)+.012*gauss(Math.sign(x)*.046,.058,.033,.014));
  }
  const c=skinColor.clone().lerp(beard,T.MathUtils.smoothstep(-y,.055,.14)*(z>0?.23:.06)).lerp(flush,Math.exp(-Math.pow((Math.abs(x)-.071)/.027,2)-Math.pow((y+.025)/.035,2))*.22);const grain=.97+random()*.06;c.multiplyScalar(grain);colors.push(c.r,c.g,c.b);p.setXYZ(i,x,y,z);
 }
 faceGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));faceGeo.computeVertexNormals();const faceMat=m.skin.clone();faceMat.color.setHex(0xffffff);faceMat.vertexColors=true;add(head,faceGeo,faceMat,[0,.107,0]);
 for(const s of [-1,1]){
  sphere(head,m.skin,.033,[s*.119,.098,0],[.40,1,.68]);sphere(head,m.skinShade,.021,[s*.129,.097,.003],[.19,.75,.63]);
  stitch(head,m.skin,[[s*.130,.073,.006],[s*.135,.10,.009],[s*.126,.123,.002]],.004);
  sphere(head,m.white,.014,[s*.047,.135,.099],[1,.44,.32]);sphere(head,m.eye,.006,[s*.047,.135,.104],[.8,.95,.35]);sphere(head,m.pupil,.003,[s*.047,.135,.106],[.8,1,.5]);
  stitch(head,m.skinShade,[[s*.031,.134,.100],[s*.045,.142,.103],[s*.062,.137,.094]],.0024);
  stitch(head,m.skin,[[s*.030,.132,.100],[s*.046,.129,.103],[s*.063,.134,.095]],.002);
  stitch(head,m.hair,[[s*.026,.164,.104],[s*.045,.168,.104],[s*.074,.161,.088]],.005);
  sphere(head,m.skinShade,.0045,[s*.013,.051,.151],[.8,.45,.6]);
 }
 // A continuous scalp surface with a receding hairline, temples, sideburns and nape.
 const hairPositions=[],hairUV=[],hairIndices=[],hairRows=18,hairSides=80;
 const hairEnd=a=>.92+.85*(1-Math.cos(a))/2-.14*Math.sin(a)**2+.24*Math.exp(-Math.pow((Math.acos(Math.cos(a))-1.06)/.17,2));
 const hairPoint=(a,u)=>{const t=u*hairEnd(a),r=1+.009*Math.sin(a*71+u*5);return[Math.sin(a)*Math.sin(t)*.121*r,.107+Math.cos(t)*.161,Math.cos(a)*Math.sin(t)*.115*r];};
 for(let j=0;j<=hairRows;j++)for(let i=0;i<=hairSides;i++){hairPositions.push(...hairPoint(i/hairSides*Math.PI*2,j/hairRows));hairUV.push(i/hairSides,j/hairRows);if(j<hairRows&&i<hairSides){const a=j*(hairSides+1)+i,b=a+hairSides+1;hairIndices.push(a,b,a+1,a+1,b,b+1);}}
 const hairGeo=new T.BufferGeometry();hairGeo.setAttribute('position',new T.Float32BufferAttribute(hairPositions,3));hairGeo.setAttribute('uv',new T.Float32BufferAttribute(hairUV,2));hairGeo.setIndex(hairIndices);hairGeo.computeVertexNormals();add(head,hairGeo,m.hair);
 stitch(head,m.skinShade,[[-.032,.025,.104],[0,.027,.117],[.032,.025,.104]],.0022);
 stitch(head,m.skin,[[-.026,.021,.107],[0,.020,.115],[.026,.021,.107]],.0027);
 // Woven field hat with a dipped front brim and a pinched, creased crown.
 const hat=new T.Group();hat.name='woven-field-hat';head.add(hat);
 const hp=[],huv=[],hi=[],n=80,hatProfile=[[.105,.265],[.145,.268],[.19,.266],[.243,.261]];
 for(let j=0;j<hatProfile.length;j++)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,[r,h]=hatProfile[j],u=j/3;hp.push(Math.sin(a)*r,h+u*u*(.018*Math.sin(a)**2-.028*Math.max(0,Math.cos(a))),Math.cos(a)*r*1.1);huv.push(.5+Math.sin(a)*r*1.8,.5+Math.cos(a)*r*1.8);if(j<3&&i<n){const k=j*(n+1)+i;hi.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1);}}
 const brimGeo=new T.BufferGeometry();brimGeo.setAttribute('position',new T.Float32BufferAttribute(hp,3));brimGeo.setAttribute('uv',new T.Float32BufferAttribute(huv,2));brimGeo.setIndex(hi);brimGeo.computeVertexNormals();add(hat,brimGeo,m.hat);
 const brimEdge=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;brimEdge.push([Math.sin(a)*.244,.261+.018*Math.sin(a)**2-.028*Math.max(0,Math.cos(a)),Math.cos(a)*.244*1.1]);}stitch(hat,m.hatEdge,brimEdge,.003);
 const crownGeo=rings([[.267,.135,.145],[.300,.132,.144],[.363,.123,.137],[.402,.108,.125],[.414,.06,.112],[.413,.002,.095]],64);
 const cp=crownGeo.attributes.position;for(let i=0;i<cp.count;i++){const y=cp.getY(i),x=cp.getX(i),z=cp.getZ(i);if(y>.32)cp.setX(i,x*(1-.08*Math.max(0,z/.14)*Math.sin((y-.32)/.10*Math.PI)));if(y>.395)cp.setY(i,y-.018*Math.exp(-Math.pow(x/.035,2)));}crownGeo.computeVertexNormals();add(hat,crownGeo,m.hat);
 add(hat,rings([[.274,.136,.147],[.299,.135,.146]],64),m.leather);
 for(const y of [.278,.287,.296]){const band=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;band.push([Math.sin(a)*.137,y,Math.cos(a)*.148]);}stitch(hat,m.hatEdge,band,.0013);}
 box(hat,m.leather,[.009,.029,.043],[.138,.287,-.025]);
 // Bent knees and soles meet the tub floor. Cloth knees and boot laces remain distinct.
 add(root,rings([[1.28,.158,.107,.025],[1.34,.17,.119,.014],[1.41,.169,.118,.008]],40,.012),m.pants);
 for(const s of [-1,1]){
  const hip=new T.Vector3(s*.105,1.41,.01),knee=new T.Vector3(s*.19,1.14,.20),ankle=new T.Vector3(s*.23,.972,.075);
  const limb=(a,b,r1,r2)=>{const g=rings([[-.5,r1,r1*.94],[-.30,r1*1.035,r1],[.12,r2*1.07,r2],[.5,r2,r2*.97]],28,.035),part=add(root,g,m.pants);part.position.copy(a).add(b).multiplyScalar(.5);part.scale.y=a.distanceTo(b);part.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());};
  limb(hip,knee,.097,.080);limb(knee,ankle,.079,.060);sphere(root,m.pants,.077,knee.toArray(),[1,.92,1]);
  box(root,m.leather,[.15,.12,.29],[s*.23,.959,.146]);box(root,m.sole,[.155,.025,.30],[s*.23,.901,.15]);
  sphere(root,m.leather,.09,[s*.23,.975,.230],[.83,.52,.94]);
  for(let k=0;k<4;k++)tube(root,m.hatEdge,[s*.23-.037,1.021,.10+k*.024],[s*.23+.037,1.021,.11+k*.024],.0025);
 }
 // Shirt shoulders bridge small IK reach adjustments without detached sleeve ends.
 const shoulderBridges=[-1,1].map(s=>({s,mesh:add(root,new T.SphereGeometry(1,20,14),m.shirt)}));
 for(const g of [root,upper,head,hat]){
  // Moving shoulder bridges must stay separate from static character surfaces.
  const moving=shoulderBridges.filter(b=>b.mesh.parent===g);moving.forEach(b=>g.remove(b.mesh));mergeStatic(g);moving.forEach(b=>g.add(b.mesh));
 }
 const v=new T.Vector3();
 function shoulder(s,target=new T.Vector3()){target.set(s*.218,.512,.05);return upper.localToWorld(target);}
 function pose(time,speed,yaw,state){
  const motion=Math.min(1,speed/5),p=state.reload>0&&!state.result?1-state.reload/RULES.reload:0,smooth=T.MathUtils.smoothstep;
  const reload=smooth(p,0,.12)*(1-smooth(p,.86,1)),can=smooth(p,.26,.38)*(1-smooth(p,.59,.72)),cover=Math.max(smooth(p,.025,.09)*(1-smooth(p,.25,.31)),smooth(p,.71,.77)*(1-smooth(p,.85,.93))),lean=.22*reload+.50*can;
  // The braced stance keeps the hat below the bar throughout this hip-led lean.
  upper.position.set(.10*can,1.33,.03*reload+.10*cover);
  upper.rotation.set(lean+Math.sin(time*7)*.006*motion,yaw*.40,-.10*can+Math.sin(time*5)*.005*motion);
  head.rotation.y=yaw*.42;head.rotation.x=-.055+Math.sin(time*.8)*.015;root.updateWorldMatrix(true,true);
 }
 function fitArms(armRig){for(const b of shoulderBridges){const a=armRig.arms.find(a=>a.s===b.s),start=root.worldToLocal(shoulder(b.s)),end=root.worldToLocal(armRig.root.localToWorld(a.shoulder.clone()));b.mesh.position.copy(start).add(end).multiplyScalar(.5);v.copy(end).sub(start);b.mesh.scale.set(.083,Math.max(.083,v.length()/2+.042),.083);if(v.lengthSq()>.000001)b.mesh.quaternion.setFromUnitVectors(UP,v.normalize());}}
 function reset(){upper.position.set(0,1.33,0);upper.rotation.set(0,0,0);head.rotation.set(0,0,0);}
 return {root,upper,head,hat,materials:m,shoulder,pose,fitArms,reset};
}
