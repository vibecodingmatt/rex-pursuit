import * as T from 'three';
import {mergeStatic,tube} from './vehicle-geometry.js';
import {createVisitorMaterials,seededRandom} from './visitor-materials.js';
import {createVisitorPlants} from './visitor-plants.js';
import {createVisitorPond} from './visitor-water.js';

// Scene dimensions in metres, proportioned from the original exterior drawings.
// These are visual reconstruction dimensions, not surveyed production measurements.
const ARCHITECTURE_SCALE=.82,BUILDING_Z=-67.606;
export const VISITOR_CENTER={width:72*ARCHITECTURE_SCALE,height:26.4*ARCHITECTURE_SCALE,positionZ:BUILDING_Z,entranceZ:BUILDING_Z,stepsFrontZ:-56.7};

export function createVisitorCenter(scene){
 const root=new T.Group();root.name='Visitor center arrival';root.visible=false;scene.add(root);
 const building=new T.Group();building.name='Concave visitor center facade';building.position.z=BUILDING_Z;root.add(building);
 const m=createVisitorMaterials(),random=seededRandom(19393);
 const rillNormals=m.waterNormals.clone();rillNormals.repeat.set(3,1);rillNormals.needsUpdate=true;
 const rillWater=new T.MeshPhysicalMaterial({color:0x497f74,normalMap:rillNormals,normalScale:new T.Vector2(.25,.25),roughness:.18,metalness:.18,clearcoat:.9,clearcoatRoughness:.15});
 function mesh(parent,geometry,material,position=[0,0,0]){const item=new T.Mesh(geometry,material);item.position.set(...position);item.castShadow=item.receiveShadow=true;parent.add(item);return item;}
 const box=(p,mat,size,pos)=>mesh(p,new T.BoxGeometry(...size),mat,pos);
 const cylinder=(p,mat,r1,r2,h,pos,segments=48)=>mesh(p,new T.CylinderGeometry(r1,r2,h,segments),mat,pos);
 function prism(p,mat,points,depth,z){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return mesh(p,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat,[0,0,z]);}
 const facadeZ=x=>.0065*x*x;
 function roof(cx,cz,y0,r0,y1,r1,repeats,trim=false){
  const positions=[],uv=[],indices=[],sides=144,rings=14;
  for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){
   const u=j/rings,a=i/sides*Math.PI*2,r=T.MathUtils.lerp(r0,r1,u),x=cx+Math.sin(a)*r;
   let z=cz+Math.cos(a)*r;if(trim)z=Math.min(z,facadeZ(x)+.7);
   const y=T.MathUtils.lerp(y0,y1,u)-Math.sin(u*Math.PI)*.35+(j===0?.09*Math.sin(a*179)+.045*Math.sin(a*71):0);
   positions.push(x,y,z);uv.push(i/sides*repeats,u*2.8);
   if(j<rings&&i<sides){const n=j*(sides+1)+i;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();mesh(building,geo,m.thatch);
 }
 function clerestory(cx,cz,r,y,h,count){
  cylinder(building,m.glass,r-.12,r-.12,h,[cx,y+h/2,cz]);
  cylinder(building,m.coping,r+.1,r+.1,.18,[cx,y,cz]);
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2;box(building,m.stone,[.21,h,.21],[cx+Math.sin(a)*r,y+h/2,cz+Math.cos(a)*r]);}
 }
 box(building,m.stone,[60,9.2,26],[0,7.1,-15]);
 for(const s of [-1,1]){
  cylinder(building,m.stone,8.6,8.6,5.8,[s*23,11,-16]);
  clerestory(s*23,-16,8.6,13.9,1.6,22);roof(s*23,-16,15.5,10.1,21.3,.16,10);
 }
 roof(0,-13,11.75,28.5,17.2,11.7,24,true);
 clerestory(0,-13,11.7,17.2,1.5,28);roof(0,-13,18.7,12.7,23.4,2.7,12);
 clerestory(0,-13,2.7,23.4,.95,10);roof(0,-13,24.35,3.55,26.4,.08,5);
 // Glass bays follow the concave elevation; posts, mullions and roof rail stay legible from the drive.
 for(const s of [-1,1])for(let i=0;i<8;i++){
  const x=s*(6.2+i*3.3),bay=new T.Group();bay.position.set(x,0,facadeZ(x));bay.rotation.y=-Math.atan(.013*x);building.add(bay);
  box(bay,m.recess,[3.3,8.6,.55],[0,6.9,-.42]);box(bay,m.glass,[2.72,6.55,.12],[0,6.4,-.05]);
  box(bay,m.turquoise,[.065,6.5,.12],[0,6.4,.04]);
  for(const y of [3.12,8.95,9.67])box(bay,m.turquoise,[2.76,.067,.14],[0,y,.05]);
  box(bay,m.stone,[3.33,1.3,1.3],[0,10.5,-.35]);box(bay,m.coping,[3.4,.22,1.6],[0,11.3,-.25]);
  for(const side of [-1,1]){cylinder(bay,m.stone,.27,.38,8.6,[side*1.62,6.9,.27],16);box(bay,m.coping,[.73,.23,.68],[side*1.62,11.15,.27]);}
  box(bay,m.rail,[3.3,.075,.075],[0,12.08,.21]);
  for(let k=0;k<6;k++)box(bay,m.rail,[.045,.72,.045],[-1.6+k*.64,11.73,.21]);
 }
 for(const s of [-1,1]){
  const wing=new T.Group();wing.position.set(s*31,0,6);wing.rotation.y=s*-.34;building.add(wing);
  prism(wing,m.stone,[[-5,0],[5,0],[3.55,4.8],[3,11.5],[-3,11.5],[-3.6,4.8]],5,-2);
  for(const y of [3.3,6.65,10.2])box(wing,m.seam,[6.6,.055,.04],[0,y,3.023]);
  box(wing,m.coping,[6.8,.27,5.7],[0,11.62,.5]);box(wing,m.recess,[2.1,6.9,.08],[0,3.5,3.07]);
  for(let i=0;i<4;i++)box(wing,m.coping,[3.5-i*.28,.3,.4],[0,7.65-i*.3,3.22-i*.04]);
 }
 const portal=new T.Group();portal.name='Fossil relief entrance';building.add(portal);
 box(portal,m.recess,[6.8,10.9,1.1],[0,7.85,-.15]);
 for(const s of [-1,1])prism(portal,m.stone,[[s*3.25,2.5],[s*5.2,2.5],[s*4.45,14.05],[s*3.4,14.05]],2.8,-.35);
 box(portal,m.coping,[10.05,.7,3.6],[0,14.2,1.15]);
 box(portal,m.wood,[4.55,5.9,.2],[0,5.6,.3]);
 for(const s of [-1,1]){box(portal,m.glass,[2.12,5.65,.06],[s*1.13,5.63,.44]);box(portal,m.wood,[.16,5.9,.16],[s*2.27,5.6,.55]);}
 box(portal,m.wood,[.11,5.9,.17],[0,5.6,.55]);
 const egg=mesh(portal,new T.TorusGeometry(.54,.045,8,48),m.wood,[0,5.4,.6]);egg.scale.y=1.38;
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2,dx=Math.sin(a),dy=Math.cos(a),r=Math.min(2.24/(Math.abs(dx)||.001),2.88/(Math.abs(dy)||.001));tube(portal,m.wood,[dx*.57,5.4+dy*.76,.59],[dx*r,5.4+dy*r,.59],.055);}
 for(let i=0;i<6;i++)box(portal,m.coping,[5.8-i*.22,.25,1.4-i*.12],[0,10.24-i*.285,1.1-i*.09]);
 const fossilMap=new T.TextureLoader().load('./textures/visitor-fossil-relief-v1.png');fossilMap.colorSpace=T.SRGBColorSpace;fossilMap.anisotropy=8;
 const fossil=new T.MeshStandardMaterial({map:fossilMap,bumpMap:fossilMap,bumpScale:.17,roughness:.93,color:0xc6c5b8});
 function relief(w,h,pos,rect){const g=new T.PlaneGeometry(w,h),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,T.MathUtils.lerp(rect[0],rect[2],uv.getX(i)),T.MathUtils.lerp(rect[1],rect[3],uv.getY(i)));mesh(portal,g,fossil,pos);}
 relief(6.55,3.05,[0,12.2,1.57],[0,.73,1,1]);
 relief(1.31,8.25,[-2.62,6.55,1.57],[0,0,.2,.73]);relief(1.31,8.25,[2.62,6.55,1.57],[.8,0,1,.73]);
 // Shallow ceremonial steps, flanking stepped rills and ramps, rather than a scaled-down porch.
 for(let i=0;i<15;i++)box(building,m.coping,[7,.17,10.6-i*.62],[0,.085+i*.17,8-i*.31]);
 for(const s of [-1,1]){
  for(let i=0;i<4;i++){
   const y=.63*(i+1),z=10.6-i*2.35;
   box(building,m.stone,[4.2,y,2.45],[s*5.8,y/2,z]);box(building,rillWater,[3.5,.035,2.2],[s*5.8,y+.023,z]);
   for(const edge of [-1,1])box(building,m.coping,[.32,y+.38,2.5],[s*5.8+edge*2.06,(y+.38)/2,z]);
  }
  box(building,m.stone,[13,.8,9],[s*15.1,.4,6.6]);box(building,m.soil,[12.45,.055,8.4],[s*15.1,.83,6.6]);
  const ramp=box(building,m.coping,[4.3,.23,15],[s*24.2,1.32,7]);ramp.rotation.x=.17;
  for(const x of [22.15,26.25]){tube(building,m.rail,[s*x,1,14.5],[s*x,3.5,-.5],.06);for(let i=0;i<7;i++){const z=14.5-i*2.5,y=1+i*2.5/6;tube(building,m.rail,[s*x,y-1,z],[s*x,y,z],.045);}}
 }
 // Bake every static architectural transform before batching by material.
 building.updateMatrixWorld(true);const inv=building.matrixWorld.clone().invert(),parts=[];
 building.traverse(part=>{if(part.isMesh)parts.push(part);});
 for(const part of parts){part.geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,part.matrixWorld));part.position.set(0,0,0);part.rotation.set(0,0,0);part.scale.set(1,1,1);building.add(part);}
 for(const child of [...building.children])if(child.isGroup)building.remove(child);
 mergeStatic(building);building.scale.setScalar(ARCHITECTURE_SCALE);
 const ground=mesh(root,new T.PlaneGeometry(250,240),m.grass,[0,-.07,-65]);ground.rotation.x=-Math.PI/2;
 const road=mesh(root,new T.PlaneGeometry(10.5,78),m.gravel,[0,-.035,-20]);road.rotation.x=-Math.PI/2;
 const court=mesh(root,new T.PlaneGeometry(74,9),m.gravel,[0,-.027,-53]);court.rotation.x=-Math.PI/2;
 box(root,m.coping,[75,.13,.35],[0,.02,-57.5]);for(const s of [-1,1])box(root,m.coping,[31,.13,.35],[s*22.5,.02,-48.5]);
 const plants=createVisitorPlants(root,m,ARCHITECTURE_SCALE,BUILDING_Z),pond=createVisitorPond(root,m);
 const fallenLeaf=new T.Shape();fallenLeaf.moveTo(0,-.17);fallenLeaf.quadraticCurveTo(.12,-.015,.01,.18);fallenLeaf.quadraticCurveTo(-.105,.025,0,-.17);
 const litter=new T.InstancedMesh(new T.ShapeGeometry(fallenLeaf,5),m.thatchEdge,380),dummy=new T.Object3D(),leafColor=new T.Color();
 for(let i=0;i<380;i++){dummy.position.set((i%2?1:-1)*(5.5+random()*5),.009,-46+random()*60);dummy.rotation.set(-Math.PI/2,random()*.2,random()*6);dummy.scale.setScalar(.6+random());dummy.updateMatrix();litter.setMatrixAt(i,dummy.matrix);leafColor.setHSL(.12+random()*.09,.24,.42+random()*.2);litter.setColorAt(i,leafColor);}root.add(litter);
 return {root,building,pond,plants,dimensions:VISITOR_CENTER,update(time){if(root.visible){plants.update(time);pond.update(time);rillNormals.offset.y=time*.015%1;}},reset(){root.visible=false;plants.update(0);pond.update(0);rillNormals.offset.y=0;}};
}
