import * as T from 'three';

export function debrisPosition(d,out=new T.Vector3()){
 const u=T.MathUtils.clamp(d.age/d.duration,0,1);
 return out.set(T.MathUtils.lerp(d.fromX??d.side*2.5,d.side*.18,u)+d.side*.25*Math.sin(Math.PI*u),T.MathUtils.lerp(d.height,2.85,u)+.30*Math.sin(Math.PI*u),T.MathUtils.lerp(d.fromZ,2.4,u));
}
function woodTexture(endGrain=false){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.fillStyle=endGrain?'#a78353':'#554634';x.fillRect(0,0,256,256);
 if(endGrain){for(let r=5;r<175;r+=5){x.strokeStyle=`rgba(68,42,22,${.13+(r%7)*.025})`;x.lineWidth=1+r%3;x.beginPath();x.ellipse(119,133,r,r*.93,.15,0,Math.PI*2);x.stroke();}for(let i=0;i<8;i++){const a=i*2.399;x.strokeStyle='#49322270';x.beginPath();x.moveTo(119+Math.cos(a)*60,133+Math.sin(a)*60);x.lineTo(119+Math.cos(a)*180,133+Math.sin(a)*180);x.stroke();}}
 else{for(let i=0;i<150;i++){const px=(i*61)%256,y=(i*89)%256;x.strokeStyle=i%3?'#231d1660':'#a08b6645';x.lineWidth=1+i%4;x.beginPath();x.moveTo(px,y-45);x.bezierCurveTo(px+6,y-10,px-6,y+30,px+3,y+65);x.stroke();}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
/** One readable incoming branch, plus a bounded pool of wooden splinters. */
export function createDebris(scene,camera,container){
 const bark=new T.MeshStandardMaterial({map:woodTexture(),roughness:.97}),cut=new T.MeshStandardMaterial({map:woodTexture(true),roughness:.91});
 const foliageMap=new T.TextureLoader().load('./textures/jungle-branch.png');foliageMap.colorSpace=T.SRGBColorSpace;
 const foliage=new T.MeshStandardMaterial({map:foliageMap,alphaTest:.45,side:T.DoubleSide,color:0x7c9259,roughness:1});
 const source=new T.Group(),limb=new T.Group();source.add(limb);scene.add(source);source.visible=false;
 const tree=new T.Mesh(new T.CylinderGeometry(.15,.30,7,10),bark);tree.position.set(5.55,3.5,0);tree.castShadow=true;source.add(tree);
 const curve=new T.CatmullRomCurve3([new T.Vector3(5.55,5.8,0),new T.Vector3(4.6,4.7,.1),new T.Vector3(3.15,3.95,0),new T.Vector3(1.30,3.8,0)]);
 const bough=new T.Mesh(new T.TubeGeometry(curve,14,.19,9,false),bark);bough.castShadow=true;limb.add(bough);
 const stump=new T.Mesh(new T.CircleGeometry(.19,9),cut);stump.position.set(1.3,3.8,0);stump.rotation.y=-Math.PI/2;limb.add(stump);
 for(let i=0;i<8;i++){const leaves=new T.Mesh(new T.PlaneGeometry(2.0,2.1),foliage);leaves.position.set(2.7+(i%3)*1.4,4.6+Math.floor(i/3)*.95,Math.sin(i*2.4)*.7);leaves.rotation.set(.25,i*1.9,.25);limb.add(leaves);}
 const root=new T.Group();scene.add(root);root.visible=false;
 const trunk=new T.Mesh(new T.CylinderGeometry(.16,.22,1.55,14),[bark,cut,cut]);trunk.castShadow=true;root.add(trunk);
 for(const side of [-1,1]){const fork=new T.Mesh(new T.CylinderGeometry(.025,.09,.82,8),[bark,cut,cut]);fork.position.set(side*.23,.05+side*.2,.01);fork.rotation.z=-side*.65;fork.castShadow=true;root.add(fork);}
 for(let i=0;i<5;i++){const splinter=new T.Mesh(new T.ConeGeometry(.035,.42,4),cut);splinter.position.set(Math.sin(i*2.4)*.14,.83,Math.cos(i*2.4)*.14);splinter.rotation.z=(i-2)*.12;root.add(splinter);}
 const twigLeaves=new T.Mesh(new T.PlaneGeometry(.85,.8),foliage);twigLeaves.position.set(.24,-.3,.03);root.add(twigLeaves);
 const fragments=new T.InstancedMesh(new T.BoxGeometry(.035,.23,.065),cut,24);fragments.frustumCulled=false;scene.add(fragments);
 const chips=Array.from({length:24},()=>({life:0,p:new T.Vector3(),v:new T.Vector3(),r:new T.Euler()})),dummy=new T.Object3D();
 const el=document.createElement('div');el.className='debris-target';el.innerHTML='<i></i><strong>!</strong><small></small>';el.hidden=true;container.append(el);
 let active=null,radius=.4,visible=false,sourceCoast=0;const screen={x:0,y:0,radius:0};
 function reset(){active=null;sourceCoast=0;source.visible=false;root.visible=false;el.hidden=true;visible=false;for(const c of chips)c.life=0;updateFragments(0,0);}
 function updateFragments(dt,speed){
  chips.forEach((c,i)=>{c.life=Math.max(0,c.life-dt);if(c.life){c.v.y-=dt*8;c.p.addScaledVector(c.v,dt);c.p.z+=speed*dt*.6;c.r.x+=dt*7;c.r.z+=dt*5;if(c.p.y<.02)c.life=0;}dummy.position.copy(c.p);dummy.rotation.copy(c.r);dummy.scale.setScalar(c.life?Math.min(1,c.life*4):0);dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);});fragments.instanceMatrix.needsUpdate=true;
 }
 function update(dt,state,speed=10){
  updateFragments(dt,speed);const d=state.debris;
  if(state.result)sourceCoast+=dt*speed;else sourceCoast=0;
  source.visible=!!d&&d.sourceAge<8&&state.phase!=='intro';
  if(source.visible){
   source.position.set(0,d.height-3.8,d.branchZ+sourceCoast);source.scale.x=d.side;
   const age=d.brokenAt===null?0:Math.max(0,state.time-d.brokenAt),bend=age?Math.exp(-age*1.3)*Math.sin(age*7)*.06:Math.max(0,1-(state.distance-6.55-d.branchZ)/1.2)*.014;
   limb.rotation.z=bend;limb.rotation.y=age?Math.exp(-age)*Math.sin(age*5)*.06:0;
  }
  active=d?.status==='active'&&!state.result&&state.phase!=='intro'?d:null;visible=false;root.visible=!!active||d?.status==='attached'&&!state.result;el.hidden=true;
  if(d?.status==='attached'&&!state.result){root.position.set(d.fromX,d.height,d.branchZ);root.rotation.set(0,0,d.spin);return;}
  if(!active)return;
  const flight=T.MathUtils.clamp(d.age/d.duration,0,1);
  debrisPosition(d,root.position);root.rotation.set(flight*6.6,flight*3.9,d.spin+flight*7.8);
  const p=root.position.clone().project(camera),depth=-root.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
  if(depth<=0||p.z>1||Math.abs(p.x)>.96||Math.abs(p.y)>.92)return;
  const ppm=innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*depth),coarse=matchMedia('(pointer:coarse)').matches;
  const pixels=T.MathUtils.clamp(.35*ppm,coarse?27:23,36);radius=pixels/ppm;Object.assign(screen,{x:(p.x*.5+.5)*innerWidth,y:(.5-p.y*.5)*innerHeight,radius:pixels});
  visible=true;el.hidden=false;el.style.left=`${screen.x}px`;el.style.top=`${screen.y}px`;el.style.width=el.style.height=`${pixels*2}px`;el.style.setProperty('--time',`${100*(1-d.age/d.duration)}%`);
  const card=document.querySelector('#challenge-card'),box=card&&!card.hidden?card.getBoundingClientRect():null;
  el.classList.toggle('label-below',!!box&&screen.x+60>box.left&&screen.x-60<box.right&&screen.y-pixels-30<box.bottom&&screen.y-pixels-10>box.top);
  el.querySelector('strong').textContent=d.hitsRequired-d.hits;el.querySelector('small').textContent=`DEBRIS · ${(d.duration-d.age).toFixed(1)}s`;el.classList.toggle('urgent',d.duration-d.age<1);
 }
 function hit(ray,meshDistance=Infinity){
  if(active?.status!=='active'||!visible)return null;const along=root.position.clone().sub(ray.origin).dot(ray.direction);
  return along>0&&along<meshDistance+radius&&ray.distanceSqToPoint(root.position)<=radius*radius?{id:active.id,distance:along,point:root.position.clone()}:null;
 }
 function shatter(){
  for(const c of chips){c.life=.5+Math.random()*.6;c.p.copy(root.position);c.v.set((Math.random()-.5)*5,1+Math.random()*3,(Math.random()-.5)*4);c.r.set(Math.random()*6,Math.random()*6,Math.random()*6);}root.visible=false;el.hidden=true;visible=false;
 }
 function breakBranch(d){
  debrisPosition(d,root.position);
  for(const c of chips){c.life=.65+Math.random()*.55;c.p.set(d.fromX,d.height,d.fromZ);c.v.set((Math.random()-.5)*7,1+Math.random()*3,-1-Math.random()*4);c.r.set(Math.random()*6,Math.random()*6,Math.random()*6);}
 }
 reset();return{root,source,el,screen,update,hit,shatter,breakBranch,reset,get visible(){return visible;}};
}
