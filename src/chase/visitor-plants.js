import * as T from 'three';
import {seededRandom} from './visitor-materials.js';

// Explicit pinnate leaflets and folded leaves keep close planting legible in
// silhouette. Far canopy cards are small branch clusters, never solid volumes.
class Leaves {
 constructor(){this.positions=[];this.colors=[];this.uvs=[];}
 triangle(a,b,c,color){for(const [i,p]of [a,b,c].entries()){this.positions.push(...p);this.colors.push(...color.map(v=>v*.46));this.uvs.push(i===1?1:0,i===2?1:0);}}
 leaf(base,tip,width,color,fold=.12,segments=6){
  const start=new T.Vector3(...base),end=new T.Vector3(...tip),direction=end.clone().sub(start),side=new T.Vector3(direction.z,0,-direction.x).normalize();
  if(side.lengthSq()<.01)side.set(1,0,0);
  const rows=[];
  for(let j=0;j<=segments;j++){
   const u=j/segments,center=start.clone().lerp(end,u);center.y+=Math.sin(u*Math.PI)*direction.length()*.1;
   const w=Math.pow(Math.sin(u*Math.PI),.72)*width,edgeY=fold*w;
   rows.push([center.clone().addScaledVector(side,-w).add(new T.Vector3(0,-edgeY,0)).toArray(),center.toArray(),center.clone().addScaledVector(side,w).add(new T.Vector3(0,-edgeY,0)).toArray()]);
  }
  for(let j=0;j<segments;j++)for(let k=0;k<2;k++){
   const shade=j%2?1:.91,c=color.map(v=>v*shade);this.triangle(rows[j][k],rows[j+1][k],rows[j][k+1],c);this.triangle(rows[j][k+1],rows[j+1][k],rows[j+1][k+1],c);
  }
 }
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.positions,3));g.setAttribute('color',new T.Float32BufferAttribute(this.colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uvs,2));g.computeVertexNormals();return g;}
}
function pinnate(palm=false){
 const b=new Leaves(),count=palm?12:7,leaflets=palm?25:19,length=palm?5.8:1.6,height=palm?.9:.75;
 for(let f=0;f<count;f++){
  const a=f*Math.PI*2/count+.12*Math.sin(f*3),dir=new T.Vector3(Math.sin(a),0,Math.cos(a)),side=new T.Vector3(Math.cos(a),0,-Math.sin(a));
  const point=u=>dir.clone().multiplyScalar(u*length).add(new T.Vector3(0,(palm?.2:.1)+Math.sin(u*Math.PI*.8)*height-(palm?u*u*1.6:0),0));
  for(let j=1;j<leaflets;j++){
   const u=j/leaflets,p=point(u),spread=Math.sin(u*Math.PI)**.65*(palm?1.18:.42);
   for(const s of [-1,1]){const tip=p.clone().addScaledVector(side,s*spread).addScaledVector(dir,palm?.55:.15);tip.y-=spread*(palm?.40:.22);b.leaf(p.toArray(),tip.toArray(),palm?.074:.038,[.12+f*.006,.24+f*.007,.074+f*.003],.3,2);}
   const next=point(Math.min(1,u+1/leaflets));b.leaf(p.toArray(),next.toArray(),palm?.024:.012,[.26,.31,.12],0,1);
  }
 }
 return b.geometry();
}
function broadLeaf(){
 const b=new Leaves();
 for(let i=0;i<8;i++){const a=i*2.399,r=.9+(i%3)*.15,h=.7+(i%4)*.23;b.leaf([0,.1,0],[Math.sin(a)*r,h,Math.cos(a)*r],.22+(i%3)*.04,[.10+i*.006,.23+i*.011,.065+i*.003],.5,9);}
 return b.geometry();
}
function grasses(){const b=new Leaves();for(let i=0;i<17;i++){const a=i*2.4,r=.2+i%4*.1;b.leaf([Math.sin(a)*r*.2,0,Math.cos(a)*r*.2],[Math.sin(a)*r,.45+i%5*.13,Math.cos(a)*r],.027,[.25,.32,.10],.1,3);}return b.geometry();}

export function createVisitorPlants(root,m,buildingScale=1,buildingZ=-70){
 const random=seededRandom(7221),placements={fern:[],broad:[],grass:[],palm:[]},trunks=[];
 const plant=(type,x,z,scale=1,y=0)=>placements[type].push({x,y,z,scale,angle:random()*Math.PI*2});
 // Beds flanking the stair and stepped water rills.
 for(const side of [-1,1])for(let i=0;i<70;i++){
  const x=side*(9+random()*12),z=-67+random()*8;
  plant(i%3?'broad':'fern',x*buildingScale,(z+70)*buildingScale+buildingZ,(.55+random()*.55)*buildingScale,.86*buildingScale);
 }
 // Irregular reeds and fern patches soften the earthen pond margin.
 const shore=new T.CatmullRomCurve3([[-7,-48],[-14,-53],[-31,-54],[-42,-46],[-44,-29],[-36,-13],[-23,-10],[-12,-19],[-7,-32]].map(([x,z])=>new T.Vector3(x,0,z)),true,'catmullrom',.35);
 for(let i=0;i<170;i++){
  const u=random(),p=shore.getPoint(u),out=p.clone().sub(new T.Vector3(-25,0,-33)).normalize();p.addScaledVector(out,.4+random()*1.3);
  plant(i%5===0?'fern':'grass',p.x,p.z,.5+random()*.6,.07);
 }
 for(let i=0;i<120;i++)plant(i%3?'broad':'fern',(i%2?1:-1)*(38+random()*39),-103+random()*46,1.6+random()*2.1);
 // Lower understory around the clearing: no plants in the driving lane.
 for(let i=0;i<300;i++){
  const side=i%2?1:-1,x=side*(22+random()*51),z=-116+random()*113;
  if(x<0&&x>-47&&z>-57&&z<-8)continue;
  plant(i%4===0?'grass':i%3?'fern':'broad',x,z,.65+random()*1.2);
 }
 // A tall, irregular palm frame. All crowns stay outside the camera sweep.
 for(const [x,z,h]of [[-35,-50,22],[34,-53,25],[-45,-30,23],[44,-33,21],[-26,-87,27],[26,-99,26],[-10,-112,28],[15,-114,31],[-48,-92,25],[46,-103,29],[-53,-67,23],[50,-75,25]]){
  const lean=(random()-.5)*2.4;plant('palm',x+lean,z,.9+random()*.35,h);trunks.push({x,z,h,lean});
 }
 const geometries={fern:pinnate(),palm:pinnate(true),broad:broadLeaf(),grass:grasses()},dummy=new T.Object3D();
 const wind={value:0};
 m.leaf.onBeforeCompile=shader=>{shader.uniforms.visitorWind=wind;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float visitorWind;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(visitorWind * .55 + position.y * 1.7 + position.z) * .018 * min(3., length(position.xz));');};m.leaf.customProgramCacheKey=()=> 'visitor-leaf-sway-v1';
 for(const [type,list]of Object.entries(placements)){
  const mesh=new T.InstancedMesh(geometries[type],m.leaf,list.length);mesh.name=`Visitor ${type} planting`;mesh.castShadow=type==='palm';mesh.receiveShadow=true;
  list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});root.add(mesh);
 }
 // Ring-scarred palm trunks with a slight bend, not straight poles.
 const trunkGeo=new T.CylinderGeometry(.19,.36,1,10,8),trunkInstances=new T.InstancedMesh(trunkGeo,m.bark,trunks.length);
 trunks.forEach((p,i)=>{dummy.position.set(p.x+p.lean*.5,p.h/2,p.z);dummy.rotation.set(0,0,-Math.atan2(p.lean,p.h));dummy.scale.set(1,p.h,1);dummy.updateMatrix();trunkInstances.setMatrixAt(i,dummy.matrix);});trunkInstances.castShadow=true;root.add(trunkInstances);
 // Real branching trunks behind the center support layered, fine canopy cards.
 const branchMap=new T.TextureLoader().load('./textures/jungle-branch.png');branchMap.colorSpace=T.SRGBColorSpace;branchMap.anisotropy=4;
 const canopyMat=new T.MeshStandardMaterial({map:branchMap,color:0x839c6b,alphaTest:.49,side:T.DoubleSide,roughness:.9});
 const canopy=new T.InstancedMesh(new T.PlaneGeometry(1,1),canopyMat,1320),branches=new T.InstancedMesh(new T.CylinderGeometry(.12,.35,1,7),m.bark,330);
 const color=new T.Color();let bi=0;
 for(let tree=0;tree<66;tree++){
  const x=tree<42?(tree-21)*3.4:(tree%2?1:-1)*(45+random()*15),z=tree<42?-116-random()*32:-120+random()*53,h=16+random()*15;
  for(let limb=0;limb<5;limb++){
   const a=limb*2.4,base=new T.Vector3(x,limb? h*.56:0,z),tip=new T.Vector3(x+Math.sin(a)*(limb?5:0),h*(limb?.87:1),z+Math.cos(a)*(limb?5:0)),d=tip.clone().sub(base);
   dummy.position.copy(base).add(tip).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());dummy.scale.set(limb?.5:1.15,d.length(),limb?.5:1.15);dummy.updateMatrix();branches.setMatrixAt(bi++,dummy.matrix);
  }
  for(let leaf=0;leaf<20;leaf++){
   const a=leaf*2.4,r=Math.sqrt(random())*7;dummy.position.set(x+Math.sin(a)*r,leaf<5?h*(.48+random()*.26):h-3+random()*6,z+Math.cos(a)*r);dummy.rotation.set((random()-.5)*1.8,random()*6.28,random()*6.28);dummy.scale.setScalar(3.2+random()*3.4);dummy.updateMatrix();canopy.setMatrixAt(tree*20+leaf,dummy.matrix);color.setHSL(.22+random()*.045,.22+random()*.13,.32+random()*.13);canopy.setColorAt(tree*20+leaf,color);
  }
 }
 branches.castShadow=true;canopy.receiveShadow=true;root.add(branches,canopy);
 return {update(time){wind.value=time;},counts:Object.fromEntries(Object.entries(placements).map(([k,v])=>[k,v.length]))};
}
