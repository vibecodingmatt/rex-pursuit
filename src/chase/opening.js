import * as T from 'three';
const smooth=T.MathUtils.smoothstep;

export function openingPose(t,duration=9.4){
 // Enter already running behind the foliage, then brake smoothly into the
 // turn. Accelerating from rest across 15 metres made the first plant lock.
 const u=T.MathUtils.clamp((t-1.9)/1.2,0,1),launch=smooth(t,duration-3.2,duration-.15);
 const x=t<1.9?-22.5+9*t:-5.4+10.8*(u-u*u*u+.5*u*u*u*u);
 return{x,z:18+3*launch,heading:Math.PI/2+Math.PI/2*smooth(t,1.9,3.25),speed:10*launch,launch,enter:1+x/22.5,visible:t>.1};
}

/** Small destructible trees and flying foliage at the right-hand roadside. */
export function createOpeningScenery(scene,dustMap,{offsetZ=0,anchorAt=null}={}){
 const root=new T.Group();root.visible=false;scene.add(root);
 const bark=new T.MeshStandardMaterial({color:0x4b4932,roughness:1}),leaf=new T.MeshStandardMaterial({color:0x546e34,roughness:.92,side:T.DoubleSide});
 const branchMap=new T.TextureLoader().load('./textures/jungle-branch.png');branchMap.colorSpace=T.SRGBColorSpace;
 const crownMat=new T.MeshStandardMaterial({map:branchMap,alphaTest:.45,side:T.DoubleSide,color:0x7d9853,roughness:1});
 const trees=[];
 for(let i=0;i<3;i++){
  const pivot=new T.Group();pivot.position.set(-5.7-i*1.05,0,15.0+i*2);root.add(pivot);
  const trunk=new T.Mesh(new T.CylinderGeometry(.075,.18,6+i,9),bark);trunk.position.y=(6+i)/2;trunk.castShadow=true;pivot.add(trunk);
  for(let j=0;j<5;j++){const mesh=new T.Mesh(new T.PlaneGeometry(3.5,3.5),crownMat);mesh.position.set(Math.sin(j*2)*.7,4+j*.55,Math.cos(j*2)*.7);mesh.rotation.set(.4,j*1.7,.2);pivot.add(mesh);}
  trees.push(pivot);
 }
 const shards=new T.InstancedMesh(new T.PlaneGeometry(.19,.37),leaf,64);shards.frustumCulled=false;root.add(shards);
 const chips=new T.InstancedMesh(new T.CylinderGeometry(.018,.035,.33,5),bark,18);chips.frustumCulled=false;root.add(chips);
 const puffs=Array.from({length:8},()=>{const s=new T.Sprite(new T.SpriteMaterial({map:dustMap,color:0xb49a6b,transparent:true,opacity:0,depthWrite:false}));root.add(s);return s;});
 const obj=new T.Object3D();let drift=0;
 function reset(){root.visible=false;drift=0;trees.forEach(t=>t.rotation.set(0,0,0));}
 function update(dt,t,speed,active){
  if(!active){root.visible=false;return;}root.visible=true;drift+=speed*dt;root.position.z=offsetZ+(anchorAt===null?drift:speed*(t-anchorAt));
  trees.forEach((tree,i)=>{const bend=smooth(t,1.18+i*.09,2.25+i*.12);tree.rotation.z=-bend*(1.05+i*.18);tree.rotation.x=bend*.27;});
  const age=Math.max(0,t-1.28);
  for(const [mesh,count]of [[shards,64],[chips,18]]){for(let i=0;i<count;i++){const a=i*2.3999,s=1+(i%7)*.43;obj.position.set(-6+age*(2+(i%9)*.53),1+(i%5)*.65+age*s-age*age*2.1,16+Math.sin(a)*age*(2+i%3));obj.rotation.set(a+age*3,i+age*4,a);obj.scale.setScalar(t<1.28||obj.position.y<-.1||age>4?0:1);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);}mesh.instanceMatrix.needsUpdate=true;}
  for(let i=0;i<puffs.length;i++){const s=puffs[i],u=Math.max(0,t-1.2-i*.06);s.position.set(-5+u*(.8+i*.09),.5+u*.37,15+(i-4)*.65);s.scale.setScalar(1+u*2.1);s.material.opacity=t>1.2+i*.06?.55*(1-smooth(u,1,4)):0;}
 }
 return{root,trees,reset,update};
}
