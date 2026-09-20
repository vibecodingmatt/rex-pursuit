import * as T from 'three';
export function createEffects(scene,dustMap){
 const count=260,position=new Float32Array(count*3),colors=new Float32Array(count*3),life=new Float32Array(count),groundRelative=new Uint8Array(count),velocity=Array.from({length:count},()=>new T.Vector3());position.fill(-1000);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(position,3));geo.setAttribute('color',new T.BufferAttribute(colors,3));const points=new T.Points(geo,new T.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.95}));points.frustumCulled=false;scene.add(points);let cursor=0;
 const tracers=[];for(let i=0;i<12;i++){const g=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);const line=new T.Line(g,new T.LineBasicMaterial({color:0xffd783,transparent:true,opacity:.7,depthWrite:false}));line.visible=false;scene.add(line);tracers.push({line,life:0});}let traceId=0;
 const puffs=[];for(let i=0;i<10;i++){const m=new T.SpriteMaterial({map:dustMap,color:0xab8f64,transparent:true,opacity:0,depthWrite:false});const s=new T.Sprite(m);s.visible=false;scene.add(s);puffs.push({sprite:s,life:0,max:1,explosive:false});}let puffId=0;
 const burstLight=new T.PointLight(0xff9a39,0,18,2);scene.add(burstLight);let lightTime=0;
 // Road-relative puffs have their own bounded pool, so gun impacts cannot steal footsteps.
 const dust=Array.from({length:96},()=>{const sprite=new T.Sprite(new T.SpriteMaterial({map:dustMap,color:0xc8ae83,transparent:true,opacity:0,depthWrite:false}));sprite.visible=false;scene.add(sprite);return{sprite,life:0,max:1,velocity:new T.Vector3(),size:1,growth:1,opacity:.7};});
 let dustId=0;const stats={footsteps:0,bodyImpacts:0};
 function groundDust(p,amount,strength,impact=false){
  for(let i=0;i<amount;i++){
   const d=dust[dustId++%dust.length],angle=Math.random()*Math.PI*2,radius=Math.random()*(impact?1.1:.3)*strength;
   d.sprite.position.copy(p).add(new T.Vector3(Math.cos(angle)*radius,.10,Math.sin(angle)*radius));
   d.life=d.max=(impact?1.6:.75)+Math.random()*(impact?1:.45);d.size=(impact?.7:.3)*strength;d.growth=(impact?3.8:1.4)*strength;
   d.opacity=impact?.8:.82;d.velocity.set(Math.cos(angle)*strength*(impact?1.1:.45),(.18+Math.random()*.35)*strength,Math.sin(angle)*strength*(impact?1.1:.45));
   d.sprite.scale.set(d.size,d.size*.65,1);d.sprite.material.opacity=d.opacity;d.sprite.material.rotation=Math.random()*Math.PI;d.sprite.visible=true;
  }
 }
 function grit(p,strength){for(let i=0;i<8;i++){const n=cursor++%count;groundRelative[n]=1;position[n*3]=p.x+(Math.random()-.5)*.5;position[n*3+1]=.09;position[n*3+2]=p.z+(Math.random()-.5)*.5;velocity[n].set((Math.random()-.5)*strength*1.8,(.6+Math.random())*strength,(Math.random()-.5)*strength*1.8);life[n]=.35+Math.random()*.25;colors[n*3]=.38;colors[n*3+1]=.27;colors[n*3+2]=.14;}geo.attributes.color.needsUpdate=true;}
 return{stats,dust,footstep(p,speed){stats.footsteps++;const strength=T.MathUtils.clamp(speed/10,.65,1.35);groundDust(p,5,strength);grit(p,strength);},bodyImpact(p,strength){stats.bodyImpacts++;groundDust(p,Math.ceil(18*strength),.7+strength*.55,true);grit(p,2*strength);},bodySlide(p,strength){groundDust(p,3,.5+strength*.6,true);},
 reset(){life.fill(0);position.fill(-1000);groundRelative.fill(0);geo.attributes.position.needsUpdate=true;for(const d of dust){d.life=0;d.sprite.visible=false;}for(const p of puffs){p.life=0;p.sprite.visible=false;}for(const t of tracers){t.life=0;t.line.visible=false;}lightTime=0;burstLight.intensity=0;stats.footsteps=stats.bodyImpacts=0;},
 trace(a,b){const t=tracers[traceId++%tracers.length];t.line.geometry.attributes.position.setXYZ(0,a.x,a.y,a.z);t.line.geometry.attributes.position.setXYZ(1,b.x,b.y,b.z);t.line.geometry.attributes.position.needsUpdate=true;t.line.geometry.computeBoundingSphere();t.life=.045;t.line.visible=true;},burst(p,hit=true,explosive=false){
   const amount=explosive?60:hit?12:5;for(let i=0;i<amount;i++){const n=cursor++%count;groundRelative[n]=0;position[n*3]=p.x;position[n*3+1]=p.y;position[n*3+2]=p.z;const speed=explosive?8:2;velocity[n].set((Math.random()-.5)*speed,Math.random()*speed*.7,(Math.random()-.5)*speed);life[n]=.2+Math.random()*(explosive?1:.4);colors[n*3]=explosive?1:hit?.32:.5;colors[n*3+1]=explosive?.35:hit?.035:.38;colors[n*3+2]=explosive?.04:hit?.012:.23;}
   const puff=puffs[puffId++%puffs.length];puff.sprite.position.copy(p);puff.sprite.visible=true;puff.life=puff.max=explosive?1.5:.4;puff.explosive=explosive;puff.sprite.material.color.setHex(explosive?0x514d42:0xa9916a);if(explosive){burstLight.position.copy(p);burstLight.intensity=40;lightTime=.2;}colors.needsUpdate=true;geo.attributes.color.needsUpdate=true;
 },casing(p){const n=cursor++%count;groundRelative[n]=0;position[n*3]=p.x;position[n*3+1]=p.y;position[n*3+2]=p.z;velocity[n].set(2+Math.random(),1.3,-.2);life[n]=.8;colors[n*3]=.8;colors[n*3+1]=.6;colors[n*3+2]=.18;geo.attributes.color.needsUpdate=true;},update(dt,roadSpeed=0){
  for(let i=0;i<count;i++){if(life[i]<=0)continue;life[i]-=dt;const n=i*3;if(life[i]<=0){position[n+1]=-1000;continue;}velocity[i].y-=dt*7;position[n]+=velocity[i].x*dt;position[n+1]+=velocity[i].y*dt;position[n+2]+=(velocity[i].z+(groundRelative[i]?roadSpeed:0))*dt;if(groundRelative[i]&&position[n+1]<.025){life[i]=0;position[n+1]=-1000;}}geo.attributes.position.needsUpdate=true;
  for(const d of dust){if(d.life<=0)continue;d.life=Math.max(0,d.life-dt);d.sprite.visible=d.life>0;const age=1-d.life/d.max;d.sprite.position.addScaledVector(d.velocity,dt);d.sprite.position.z+=roadSpeed*dt;const size=d.size+d.growth*Math.sqrt(age);d.sprite.scale.set(size,size*.65,1);d.sprite.material.opacity=d.opacity*Math.sin(Math.PI*Math.min(1,age/.16)*.5)*(1-age)**1.25;}
  for(const t of tracers){t.life-=dt;t.line.visible=t.life>0;}for(const p of puffs){if(p.life<=0)continue;p.life-=dt;p.sprite.visible=p.life>0;const age=1-p.life/p.max;p.sprite.scale.setScalar((p.explosive?3:.5)+age*(p.explosive?6:1));p.sprite.material.opacity=p.life/p.max*(p.explosive?.7:.3);p.sprite.position.y+=dt*.5;}
  lightTime=Math.max(0,lightTime-dt);burstLight.intensity=lightTime*200;
 }};
}
