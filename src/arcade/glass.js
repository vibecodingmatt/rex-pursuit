import * as T from 'three';

// A13: the conservatory roof shatters. Thin, irregular shards that glint (mirror-smooth, lit by the
// stage's environment), tumble as they fall, break once more on the floor and settle; a pane-sized
// burst wherever something comes through the roof. burst() queues a 'shatter' cue that main.js plays.
const N=180,GRAVITY=13;

function shardGeometry(){
 // A long, thin triangle with one bent corner, so tumbling shards flash at different angles.
 const g=new T.BufferGeometry(),p=[0,.5,0,-.18,-.4,.02,.22,-.32,-.03,.22,-.32,-.03,-.18,-.4,.02,.05,-.55,.06];
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;
}

export class Glass {
 constructor(scene){
  this.mesh=new T.InstancedMesh(shardGeometry(),new T.MeshStandardMaterial({color:0xe6f6ff,emissive:0x3a5868,roughness:.03,metalness:.7,envMapIntensity:3.2,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}),N);
  this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.name='Roof glass';this.mesh.userData.noReflect=true;scene.add(this.mesh);
  this.s=Array.from({length:N},()=>({on:false,p:new T.Vector3(),v:new T.Vector3(),r:new T.Euler(),w:new T.Vector3(),size:1,life:0,bounced:false}));
  this.next=0;this.dummy=new T.Object3D();this.cues=[];this.floor=()=>0;
 }
 /** A pane breaks at `at` (on the roof): shards rain down and out, heavier toward `dir`. */
 burst(at,{count=70,dir=null,speed=3}={}){
  for(let i=0;i<count;i++){const s=this.s[this.next];this.next=(this.next+1)%N;
   s.on=true;s.bounced=false;s.life=0;s.size=.18+Math.random()**2*.6;
   s.p.set(at.x+(Math.random()-.5)*2.4,at.y+(Math.random()-.5)*.4,at.z+(Math.random()-.5)*2.4);
   s.v.set((Math.random()-.5)*speed,-Math.random()*speed*.6,(Math.random()-.5)*speed);if(dir)s.v.addScaledVector(dir,1+Math.random()*2);
   s.r.set(Math.random()*6,Math.random()*6,Math.random()*6);s.w.set((Math.random()-.5)*14,(Math.random()-.5)*14,(Math.random()-.5)*14);}
  this.cues.push({type:'shatter',at:at.clone()});
 }
 drain(){return this.cues.splice(0);}
 reset(){for(const s of this.s)s.on=false;this.mesh.count=0;this.cues=[];}
 update(dt){
  if(dt<=0)return;let n=0;const d=this.dummy;
  for(const s of this.s){if(!s.on)continue;s.life+=dt;
   const floor=this.floor(s.p.x,s.p.z);
   if(s.p.y>floor+.02){s.v.y-=GRAVITY*dt;s.p.addScaledVector(s.v,dt);s.r.x+=s.w.x*dt;s.r.y+=s.w.y*dt;s.r.z+=s.w.z*dt;}
   // On the floor: the first strike shatters it into a skittering smaller piece; then it lies flat.
   if(s.p.y<=floor+.02){s.p.y=floor+.02;if(!s.bounced){s.bounced=true;s.size*=.6;s.v.set(s.v.x*.35,Math.abs(s.v.y)*.18,s.v.z*.35);s.w.multiplyScalar(.4);}else{s.v.set(0,0,0);s.r.x=Math.PI/2;s.r.z*=.98;}}
   const fade=1-T.MathUtils.smoothstep(s.life,5,7);if(fade<=0){s.on=false;continue;}
   d.position.copy(s.p);d.rotation.copy(s.r);d.scale.setScalar(s.size*fade);d.updateMatrix();this.mesh.setMatrixAt(n++,d.matrix);}
  this.mesh.count=n;if(n)this.mesh.instanceMatrix.needsUpdate=true;
 }
}
