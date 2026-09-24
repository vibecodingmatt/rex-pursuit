import * as T from 'three';
import {WET} from './weather-state.js';
// Combat and creature effects. Everything is pooled and bounded; road-relative
// pools advance with the ground so dust and debris are left behind correctly.
function spriteTexture(draw,size=128){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
let seed=4242;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const fireMap=spriteTexture((x,s)=>{
 for(let i=0;i<34;i++){const px=s/2+(rnd()-.5)*s*.42,py=s/2+(rnd()-.5)*s*.42,r=s*(.12+rnd()*.24),g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(255,${200+rnd()*55|0},${120+rnd()*80|0},${.2+rnd()*.2})`);g.addColorStop(.5,'rgba(255,140,40,.1)');g.addColorStop(1,'rgba(255,90,20,0)');x.fillStyle=g;x.fillRect(0,0,s,s);}
});
const smokeMap=spriteTexture((x,s)=>{
 for(let i=0;i<40;i++){const px=s/2+(rnd()-.5)*s*.5,py=s/2+(rnd()-.5)*s*.5,r=s*(.14+rnd()*.22),g=x.createRadialGradient(px,py,0,px,py,r),v=150+rnd()*60|0;g.addColorStop(0,`rgba(${v},${v},${v},${.14+rnd()*.1})`);g.addColorStop(1,`rgba(${v},${v},${v},0)`);x.fillStyle=g;x.fillRect(0,0,s,s);}
 const fade=x.createRadialGradient(s/2,s/2,s*.25,s/2,s/2,s/2);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=fade;x.fillRect(0,0,s,s);
});

export function createEffects(scene,dustMap){
 // ---- Soft particles: blood, dirt, wood, sparks (HDR colours bloom) --------
 const count=420,position=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),life=new Float32Array(count),maxLife=new Float32Array(count),drag=new Float32Array(count),groundRelative=new Uint8Array(count),velocity=Array.from({length:count},()=>new T.Vector3());position.fill(-1000);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(position,3));geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setAttribute('size',new T.BufferAttribute(sizes,1));
 const pointUniforms={pixel:{value:Math.min(2,devicePixelRatio)},viewport:{value:innerHeight}};
 const points=new T.Points(geo,new T.ShaderMaterial({uniforms:pointUniforms,transparent:true,depthWrite:false,
  vertexShader:'attribute float size;attribute vec3 color;varying vec3 vColor;uniform float pixel,viewport;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;vColor=color;gl_PointSize=max(1.5,size*viewport*.9/-mv.z);}',
  fragmentShader:'varying vec3 vColor;void main(){vec2 c=gl_PointCoord-.5;float a=1.-smoothstep(.18,.5,length(c));if(a<.02)discard;gl_FragColor=vec4(vColor,a);}'}));
 points.frustumCulled=false;points.renderOrder=5;scene.add(points);let cursor=0,particleScale=1;
 function emit(p,v,col,size,lifetime,{ground=false,dragK=0}={}){const n=cursor++%count;groundRelative[n]=ground?1:0;position.set([p.x,p.y,p.z],n*3);velocity[n].copy(v);colors.set(col,n*3);sizes[n]=size;life[n]=maxLife[n]=lifetime;drag[n]=dragK;return n;}

 // ---- Tracers: a bright slug (~5 m) travels down range at a readable speed and
 // leaves a faint hot trail back to the muzzle that fades out. Width has an
 // on-screen minimum so rounds stay visible end-on from the gunner's seat.
 const tracerGeo=new T.PlaneGeometry(1,1,1,16);
 const tracers=[];for(let i=0;i<24;i++){
  const u={a:{value:new T.Vector3()},b:{value:new T.Vector3()},head:{value:0},tail:{value:0},seg:{value:.3},trail:{value:1},slug:{value:1},gain:{value:1}};
  const m=new T.Mesh(tracerGeo,new T.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendEquation:T.AddEquation,fog:false,
   vertexShader:`uniform vec3 a,b;uniform float head,tail;varying vec2 vUv;varying float vT;
    void main(){float t=mix(tail,head,position.y+.5);vec3 p=mix(a,b,t);vec3 dir=normalize(b-a),toCam=cameraPosition-p;float d=length(toCam);vec3 side=normalize(cross(dir,toCam/d));
     float width=max(.13,d*.014);p+=side*position.x*width;vUv=vec2(position.x*2.,position.y+.5);vT=t;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
   fragmentShader:`uniform float head,seg,trail,slug,gain;varying vec2 vUv;varying float vT;void main(){
     float x=vUv.x;float core=exp(-x*x*9.),halo=exp(-x*x*2.2)*.7;
     float s=smoothstep(head-seg,head-seg*.25,vT)*slug;
     // Short dim tail behind the slug only; no continuous line back to the muzzle.
     float tailGlow=smoothstep(head-seg*3.,head-seg,vT)*(1.-step(head,vT))*.22*trail;
     float k=(s+tailGlow)*gain;
     vec3 col=vec3(18.,10.5,4.)*core+vec3(3.6,1.7,.5)*halo;
     gl_FragColor=vec4(col*k,1.);}`}));
  m.frustumCulled=false;m.visible=false;m.renderOrder=6;scene.add(m);tracers.push({mesh:m,u,age:0,flight:.1,life:0,hold:0});
 }let traceId=0,roundCount=0;

 // ---- Sprite pools: impact puffs, explosion fire and smoke, breath mist -----
 const makePool=(n,map,blending,color)=>Array.from({length:n},()=>{const s=new T.Sprite(new T.SpriteMaterial({map,color,transparent:true,opacity:0,depthWrite:false,blending}));s.visible=false;s.renderOrder=4;scene.add(s);return{sprite:s,life:0,max:1,velocity:new T.Vector3(),size:1,growth:1,opacity:1,spin:0,ground:false,hdr:1,base:new T.Color(color)};});
 const puffs=makePool(18,smokeMap,T.NormalBlending,0xa9916a),fire=makePool(24,fireMap,T.AdditiveBlending,0xffffff),smoke=makePool(22,smokeMap,T.NormalBlending,0x3c3a34),mist=makePool(26,smokeMap,T.NormalBlending,0xd8d4c8);
 let puffId=0,fireId=0,smokeId=0,mistId=0;
 function launch(pool,idx,p,{life:l,size,growth,opacity,velocity:v,color,spin=0,ground=false,hdr=1}){
  const d=pool[idx%pool.length];d.sprite.position.copy(p);d.life=d.max=l;d.size=size;d.growth=growth;d.opacity=opacity;d.velocity.copy(v||new T.Vector3());d.spin=spin;d.ground=ground;d.hdr=hdr;
  if(color!==undefined)d.base.set(color);d.sprite.material.color.copy(d.base).multiplyScalar(hdr);d.sprite.material.rotation=rnd()*6.28;d.sprite.scale.setScalar(size);d.sprite.material.opacity=opacity;d.sprite.visible=true;return d;
 }
 const burstLight=new T.PointLight(0xff9a39,0,24,2);scene.add(burstLight);let lightTime=0;
 let screenFlash=0;

 // Road-relative footfall dust has its own bounded pool, so gun impacts cannot steal footsteps.
 const dust=Array.from({length:96},()=>{const sprite=new T.Sprite(new T.SpriteMaterial({map:dustMap,color:0x8a775b,transparent:true,opacity:0,depthWrite:false}));sprite.visible=false;scene.add(sprite);return{sprite,life:0,max:1,velocity:new T.Vector3(),size:1,growth:1,opacity:.7};});
 let dustId=0;const stats={footsteps:0,bodyImpacts:0,explosions:0,breaths:0};
 function groundDust(p,amount,strength,impact=false){
  for(let i=0;i<amount;i++){
   const d=dust[dustId++%dust.length],angle=rnd()*Math.PI*2,radius=rnd()*(impact?1.1:.3)*strength;
   d.sprite.position.copy(p).add(new T.Vector3(Math.cos(angle)*radius,.10,Math.sin(angle)*radius));
   d.life=d.max=(impact?1.6:.75)+rnd()*(impact?1:.45);d.size=(impact?.7:.3)*strength;d.growth=(impact?3.8:1.4)*strength;
   d.opacity=impact?.75:.72;d.velocity.set(Math.cos(angle)*strength*(impact?1.1:.45),(.18+rnd()*.35)*strength,Math.sin(angle)*strength*(impact?1.1:.45));
   d.sprite.scale.set(d.size,d.size*.65,1);d.sprite.material.opacity=d.opacity;d.sprite.material.rotation=rnd()*Math.PI;d.sprite.visible=true;
  }
 }
 function grit(p,strength,amount=10){for(let i=0;i<amount*particleScale;i++){emit(new T.Vector3(p.x+(rnd()-.5)*.5,.09,p.z+(rnd()-.5)*.5),new T.Vector3((rnd()-.5)*strength*1.8,(.6+rnd())*strength*1.4,(rnd()-.5)*strength*1.8),[.16,.11,.065],.03+rnd()*.03,.45+rnd()*.3,{ground:true});}}
 const tmp=new T.Vector3();
 return{stats,dust,
  setQuality(t){particleScale=t.particles;},
  get flash(){return screenFlash;},
  // Wet ground does not raise dust: the storm's splash hook takes over (see mud.js).
  splash:null,
  footstep(p,speed){stats.footsteps++;const strength=T.MathUtils.clamp(speed/10,.65,1.35),dry=1-WET.value;groundDust(p,Math.round(5*dry),strength);grit(p,strength,8*dry);},
  bodyImpact(p,strength){stats.bodyImpacts++;const dry=1-WET.value;groundDust(p,Math.ceil(18*strength*dry),.7+strength*.55,true);grit(p,2*strength,18*dry);this.splash?.(p,strength);},
  bodySlide(p,strength){groundDust(p,Math.round(3*(1-WET.value)),.5+strength*.6,true);this.splash?.(p,strength*.5);},
  reset(){life.fill(0);position.fill(-1000);groundRelative.fill(0);geo.attributes.position.needsUpdate=true;for(const d of dust){d.life=0;d.sprite.visible=false;}for(const pool of [puffs,fire,smoke,mist])for(const p of pool){p.life=0;p.sprite.visible=false;}for(const t of tracers){t.life=0;t.mesh.visible=false;}lightTime=0;burstLight.intensity=0;screenFlash=0;stats.footsteps=stats.bodyImpacts=stats.explosions=stats.breaths=0;},
  trace(a,b){
   const t=tracers[traceId++%tracers.length];t.u.a.value.copy(a);t.u.b.value.copy(b);const bright=roundCount++%3===0;const d=a.distanceTo(b);t.flight=Math.min(.2,Math.max(.07,d/160));t.hold=.05;t.u.gain.value=bright?1:.5;t.age=0;t.life=t.flight+t.hold;t.mesh.visible=true;t.u.head.value=0;t.u.tail.value=0;t.u.seg.value=Math.min(.6,(bright?6:3.5)/Math.max(d,1));t.u.trail.value=1;t.u.slug.value=1;
   // Muzzle haze drifts off with the air as the Jeep drives on.
   if(rnd()<.3)launch(puffs,puffId++,a.clone().add(new T.Vector3((rnd()-.5)*.1,.05,.25)),{life:.3+rnd()*.2,size:.12,growth:.5,opacity:.07,velocity:new T.Vector3((rnd()-.5)*.4,.35,1.2),color:0xc9c3b3,ground:true});
  },
  burst(p,hit=true,explosive=false){
   if(explosive){
    stats.explosions++;
    for(let i=0;i<7;i++)launch(fire,fireId++,p.clone().add(new T.Vector3((rnd()-.5)*.8,(rnd()-.2)*.6,(rnd()-.5)*.8)),{life:.35+rnd()*.4,size:.5+rnd()*.5,growth:2.6+rnd()*2.2,opacity:1,velocity:new T.Vector3((rnd()-.5)*3.5,1.5+rnd()*2.5,(rnd()-.5)*3.5),color:0xff9c4a,hdr:2.5+rnd()*2.5,spin:(rnd()-.5)*2});
    launch(fire,fireId++,p,{life:.12,size:1.6,growth:5,opacity:1,color:0xffe0b0,hdr:6});
    for(let i=0;i<14;i++)launch(smoke,smokeId++,p.clone().add(new T.Vector3((rnd()-.5)*1.2,(rnd()-.3)*.8,(rnd()-.5)*1.2)),{life:2.2+rnd()*1.8,size:1+rnd()*.8,growth:5+rnd()*3,opacity:.5+rnd()*.25,velocity:new T.Vector3((rnd()-.5)*1.4,1.2+rnd()*1.6,(rnd()-.5)*1.4),color:rnd()<.5?0x3a372f:0x57534a,spin:(rnd()-.5)*.8,ground:true});
    for(let i=0;i<60*particleScale;i++){const v=new T.Vector3(rnd()-.5,rnd()*.9+.1,rnd()-.5).normalize().multiplyScalar(6+rnd()*9);emit(p,v,[6+rnd()*4,2.2+rnd()*1.6,.4],.03+rnd()*.03,.5+rnd()*.9,{dragK:1.2});}
    for(let i=0;i<24*particleScale;i++){const v=new T.Vector3(rnd()-.5,rnd()*.8,rnd()-.5).normalize().multiplyScalar(3+rnd()*5);emit(p,v,hit?[.09,.012,.008]:[.12,.085,.05],.06+rnd()*.06,.7+rnd()*.6,{ground:!hit});}
    burstLight.position.copy(p);lightTime=.32;screenFlash=1;
   }else if(hit){
    // Ballistic hit on hide: dark blood mist, droplets and a fleck of spray.
    launch(fire,fireId++,p,{life:.07,size:.32,growth:.5,opacity:1,color:0xffd29a,hdr:5});
    launch(mist,mistId++,p,{life:.5+rnd()*.25,size:.25,growth:1.3,opacity:.55,velocity:new T.Vector3((rnd()-.5)*.8,.3,(rnd()-.5)*.8),color:0x4a0906});
    for(let i=0;i<14*particleScale;i++){const v=new T.Vector3(rnd()-.5,rnd()*.7+.1,rnd()-.5).normalize().multiplyScalar(1.5+rnd()*3.5);emit(p,v,[.11+rnd()*.06,.012,.008],.022+rnd()*.03,.45+rnd()*.35);}
    for(let i=0;i<3;i++)emit(p,new T.Vector3((rnd()-.5)*4,rnd()*3,(rnd()-.5)*4),[3.2,1.7,.6],.018,.08+rnd()*.06);
   }else{
    // Dirt, bark or leaf strike: brown chips, a dusty puff.
    launch(fire,fireId++,p,{life:.06,size:.28,growth:.4,opacity:1,color:0xffd29a,hdr:4});
    launch(puffs,puffId++,p,{life:.7+rnd()*.3,size:.3,growth:1.6,opacity:.45,velocity:new T.Vector3((rnd()-.5)*.5,.5,(rnd()-.5)*.5),color:0x9c8661,ground:p.y<.4});
    for(let i=0;i<9*particleScale;i++){const v=new T.Vector3(rnd()-.5,rnd()*.9+.2,rnd()-.5).normalize().multiplyScalar(1.5+rnd()*3);emit(p,v,[.18+rnd()*.08,.13+rnd()*.05,.07],.025+rnd()*.03,.45+rnd()*.35,{ground:p.y<.4});}
   }
  },
  casing(){},
  /** Roar exhalation: warm breath condensing in the humid air, with saliva. */
  breath(origin,direction,strength=1){
   stats.breaths++;
   launch(mist,mistId++,origin.clone().addScaledVector(direction,1.7).add(new T.Vector3((rnd()-.5)*.8,(rnd()-.3)*.4,0)),{life:.7+rnd()*.4,size:.4,growth:2.6*strength,opacity:.04*strength,velocity:direction.clone().multiplyScalar(3+rnd()*2).add(new T.Vector3((rnd()-.5)*.6,.3+rnd()*.4,(rnd()-.5)*.6)),color:0xdcd8cc,ground:true});
   if(rnd()<.6*strength)for(let i=0;i<2;i++)emit(origin,direction.clone().multiplyScalar(4+rnd()*3).add(new T.Vector3((rnd()-.5)*1.5,rnd()*1.2,(rnd()-.5)*1.5)),[.55,.5,.44],.014+rnd()*.012,.5+rnd()*.3);
  },
  update(dt,roadSpeed=0){
   pointUniforms.viewport.value=innerHeight;
   for(let i=0;i<count;i++){if(life[i]<=0)continue;life[i]-=dt;const n=i*3;if(life[i]<=0){position[n+1]=-1000;continue;}
    const v=velocity[i];v.y-=dt*9.3;if(drag[i])v.multiplyScalar(Math.exp(-drag[i]*dt));position[n]+=v.x*dt;position[n+1]+=v.y*dt;position[n+2]+=(v.z+(groundRelative[i]?roadSpeed:0))*dt;
    if(position[n+1]<.02){if(groundRelative[i]){life[i]=0;position[n+1]=-1000;}else{position[n+1]=.02;v.set(0,0,0);groundRelative[i]=1;}}
    sizes[i]*=1-dt*.15;}
   geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.attributes.size.needsUpdate=true;
   for(const d of dust){if(d.life<=0)continue;d.life=Math.max(0,d.life-dt);d.sprite.visible=d.life>0;const age=1-d.life/d.max;d.sprite.position.addScaledVector(d.velocity,dt);d.sprite.position.z+=roadSpeed*dt;const size=d.size+d.growth*Math.sqrt(age);d.sprite.scale.set(size,size*.65,1);d.sprite.material.opacity=d.opacity*Math.sin(Math.PI*Math.min(1,age/.16)*.5)*(1-age)**1.25;}
   for(const t of tracers){if(t.life<=0)continue;t.age+=dt;t.life-=dt;t.mesh.visible=t.life>0;const u=t.age/t.flight;t.u.head.value=Math.min(1,u);
    // The tail trails the head by ~45% of the path, then the whole streak dims out during the hold.
    // Trail fades from the muzzle forward; the slug lingers briefly at impact.
    const after=Math.max(0,t.age-t.flight)/t.hold;t.u.tail.value=Math.min(.95,after*.95);t.u.trail.value=Math.max(0,1-t.age/t.life);t.u.slug.value=u<1?1:Math.max(0,1-after*1.6);}
   for(const pool of [puffs,fire,smoke,mist])for(const d of pool){
    if(d.life<=0)continue;d.life=Math.max(0,d.life-dt);d.sprite.visible=d.life>0;if(!d.sprite.visible)continue;const age=1-d.life/d.max;
    d.velocity.multiplyScalar(Math.exp(-dt*(pool===fire?2.2:1.1)));d.sprite.position.addScaledVector(d.velocity,dt);if(d.ground)d.sprite.position.z+=roadSpeed*dt;
    d.sprite.scale.setScalar(d.size+d.growth*Math.pow(age,.55));d.sprite.material.rotation+=d.spin*dt;
    if(pool===fire){d.sprite.material.color.copy(d.base).multiplyScalar(d.hdr*Math.pow(1-age,1.6));d.sprite.material.opacity=(1-age)*d.opacity;}
    else d.sprite.material.opacity=d.opacity*Math.min(1,age/.08)*Math.pow(1-age,1.4);
   }
   lightTime=Math.max(0,lightTime-dt);burstLight.intensity=lightTime*lightTime*1400;screenFlash=Math.max(0,screenFlash-dt*5);
  }};
}
