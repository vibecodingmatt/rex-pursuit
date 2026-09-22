import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Authored silhouettes share the same break point and target center. Build once;
// swapping hazards never allocates new geometry or changes the combat rules.
const forms=[
 {name:'forked hardwood',seed:17,bark:0xb3a48a,leaf:0x81995f,height:8.1,lean:.3,width:.21,bend:.12,length:1.12,forks:[[-.55,.05,.1],[.6,-.4,-.15]],leaves:2,crown:1},
 {name:'leafy spreading bough',seed:43,bark:0x858b69,leaf:0xa2b87a,height:7.2,lean:-.55,width:.17,bend:-.18,length:.95,forks:[[-.72,-.3,.08],[.55,-.65,.25],[-.42,-.85,-.25]],leaves:4,crown:1.2},
 {name:'pale crooked limb',seed:71,bark:0xd0c5ac,leaf:0x82946b,height:9.2,lean:.8,width:.15,bend:.33,length:1.3,forks:[[-.5,-.45,.1]],leaves:1,crown:.8},
 {name:'weathered deadwood',seed:109,bark:0x938779,leaf:0x9e8958,height:7.6,lean:-.25,width:.23,bend:-.13,length:.9,forks:[[-.58,-.1,-.1],[.4,-.65,.2]],leaves:0,crown:.5},
 {name:'hanging jungle branch',seed:149,bark:0x9c9d71,leaf:0x658955,height:8.7,lean:.55,width:.18,bend:.2,length:1.18,forks:[[-.56,-.5,.16],[.6,-.65,-.13]],leaves:3,crown:1.05,vine:true},
 {name:'fine twig fan',seed:197,bark:0xbe9c79,leaf:0x9cad68,height:8,lean:-.7,width:.16,bend:-.2,length:1.05,forks:[[-.7,-.1,.15],[.67,-.2,-.2],[-.48,-.85,-.12],[.36,-1,.2]],leaves:2,crown:.85},
];

function woodTexture(endGrain=false){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.fillStyle=endGrain?'#b39163':'#766b58';x.fillRect(0,0,256,256);
 if(endGrain){for(let r=5;r<175;r+=5){x.strokeStyle=`rgba(68,42,22,${.13+(r%7)*.025})`;x.lineWidth=1+r%3;x.beginPath();x.ellipse(119,133,r,r*.93,.15,0,Math.PI*2);x.stroke();}for(let i=0;i<8;i++){const a=i*2.399;x.strokeStyle='#49322270';x.beginPath();x.moveTo(119+Math.cos(a)*60,133+Math.sin(a)*60);x.lineTo(119+Math.cos(a)*180,133+Math.sin(a)*180);x.stroke();}}
 else{for(let i=0;i<180;i++){const px=(i*61)%256,y=(i*89)%256;x.strokeStyle=i%3?'#231d1660':'#b4a58665';x.lineWidth=1+i%4;x.beginPath();x.moveTo(px,y-45);x.bezierCurveTo(px+6,y-10,px-6,y+30,px+3,y+65);x.stroke();}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

function tube(points,startRadius,endRadius,segments=10){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),sides=9;
 const g=new T.TubeGeometry(curve,segments,1,sides,false),pos=g.attributes.position,uv=g.attributes.uv,center=new T.Vector3(),v=new T.Vector3();
 for(let i=0;i<=segments;i++){
  const u=i/segments;curve.getPointAt(u,center);const radius=T.MathUtils.lerp(startRadius,endRadius,u);
  for(let j=0;j<=sides;j++){const n=i*(sides+1)+j;v.fromBufferAttribute(pos,n).sub(center).multiplyScalar(radius).add(center);pos.setXYZ(n,v.x,v.y,v.z);uv.setXY(n,j/sides,u);}
 }
 g.computeVertexNormals();return g;
}

// Each assembled part becomes at most three meshes: bark, broken wood, leaves.
function batch(materials){
 const pieces=materials.map(()=>[]);
 return {
  add(slot,geometry,position,rotation,scale){const m=new T.Object3D();if(position)m.position.fromArray(position);if(rotation)m.rotation.set(...rotation);if(scale)m.scale.fromArray(scale);m.updateMatrix();geometry.applyMatrix4(m.matrix);pieces[slot].push(geometry);},
  finish(){const group=new T.Group();pieces.forEach((list,i)=>{if(!list.length)return;const mesh=new T.Mesh(mergeGeometries(list),materials[i]);mesh.castShadow=i===0;group.add(mesh);list.forEach(g=>g.dispose());});return group;},
 };
}

export function createDebrisModels(){
 const barkMap=woodTexture(),cut=new T.MeshStandardMaterial({map:woodTexture(true),roughness:.94});
 const foliageMap=new T.TextureLoader().load('./textures/jungle-branch.png');foliageMap.colorSpace=T.SRGBColorSpace;
 const variants=forms.map((f,index)=>{
  let seed=f.seed;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const bark=new T.MeshStandardMaterial({map:barkMap,bumpMap:barkMap,bumpScale:.035,color:f.bark,roughness:1});
  const foliage=new T.MeshStandardMaterial({map:foliageMap,alphaTest:.45,side:T.DoubleSide,color:f.leaf,roughness:1});
  const materials=[bark,cut,foliage],treeParts=batch(materials),limbParts=batch(materials),branchParts=batch(materials);
  const leaf=(parts,p,size,angle)=>parts.add(2,new T.PlaneGeometry(size,size*(.7+rand()*.35)),p,[rand()*.7-.35,angle,rand()*.9-.45]);
  const trunkX=5.4+(index%3)*.25,trunkTop=trunkX+f.lean;
  treeParts.add(0,tube([[trunkX,0,0],[trunkX-f.lean*.3,2.7,.14],[trunkX+f.lean*.35,5.3,-.12],[trunkTop,f.height,.12]],.31+f.width*.25,.10,16));
  for(let i=0;i<3;i++){const a=i*2.1+index;treeParts.add(0,tube([[trunkX+Math.cos(a)*.65,0,Math.sin(a)*.65],[trunkX+Math.cos(a)*.2,.6,Math.sin(a)*.2],[trunkX,1.3,0]],.12,.055,5));}
  // Asymmetric upper forks make the roadside tree itself vary as well.
  for(let i=0;i<2+(index%2);i++){
   const side=i%2?1:-1,tip=[trunkTop+side*(.9+rand()),f.height-.2+rand(),(rand()-.5)*1.8];
   treeParts.add(0,tube([[trunkX+f.lean*.3,5.2,0],[trunkTop+side*.5,6.4,.1],tip],.12,.035,8));
   for(let j=0;j<3;j++)leaf(treeParts,[tip[0]+(rand()-.5)*1.3,tip[1]+(rand()-.5),tip[2]+(rand()-.5)],(1.7+rand()*.65)*f.crown,rand()*Math.PI);
  }
  limbParts.add(0,tube([[trunkX+f.lean*.3,5.7,0],[4.4,4.7+f.lean*.3,.18],[2.6,3.8+f.bend,.06],[1.3,3.8,0]],.24,f.width,14));
  for(let i=0;i<(f.leaves?4+f.leaves:2);i++)leaf(limbParts,[2.6+rand()*2.4,4.25+rand()*1.45,(rand()-.5)*1.3],(1.3+rand()*.7)*f.crown,rand()*Math.PI);
  const stump=new T.Mesh(new T.CircleGeometry(f.width,9),cut);stump.position.set(1.3,3.8,0);stump.rotation.y=-Math.PI/2;

  // Local +Y end joins the source bough, .75 m from the unchanged target center.
  branchParts.add(0,tube([[0,.75,0],[0,.45,0],[f.bend,-.18,.06],[f.bend*.6,-f.length,.02]],f.width,.045,12));
  branchParts.add(1,new T.CircleGeometry(f.width,9),[0,.75,0],[-Math.PI/2,0,0]);
  f.forks.forEach((tip,i)=>{
   const start=[f.bend*.65,.08-i*.14,.02],mid=[tip[0]*.55,start[1]-.08,tip[2]*.5];
   branchParts.add(0,tube([start,mid,tip],.065+(i===0?.025:0),.016,6));
   if(i<f.leaves)leaf(branchParts,tip,.52+rand()*.35,rand()*2.6);
  });
  if(f.leaves>f.forks.length)leaf(branchParts,[f.bend,-f.length,.02],.85,.6);
  for(let i=0;i<5;i++){const a=i*2.399+rand()*.3,r=f.width*(.55+rand()*.4),h=.10+rand()*.19;branchParts.add(1,new T.ConeGeometry(.022+rand()*.014,h,4),[Math.cos(a)*r,.73+h*.25,Math.sin(a)*r],[0,a,(rand()-.5)*.4]);}
  if(f.vine){
   limbParts.add(0,tube([[3.8,4.7,.1],[3.5,3.8,.3],[3.8,3.05,.2]],.023,.012,10));
   branchParts.add(0,tube([[.15,.15,.1],[.43,-.45,.3],[.24,-1.3,.17]],.023,.01,10));
  }
  const tree=treeParts.finish(),limb=limbParts.finish(),projectile=branchParts.finish();limb.add(stump);
  tree.name=projectile.name=f.name;tree.visible=limb.visible=projectile.visible=false;
  return {name:f.name,tree,limb,stump,projectile};
 });
 return {variants,cut};
}
