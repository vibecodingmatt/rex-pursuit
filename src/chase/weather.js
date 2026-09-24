import * as T from 'three';
import {WET,RAIN,RAIN_TIME,WIND_GUST,NIGHT as DARK} from './weather-state.js';
// Tropical storm. Rain is one instanced draw of camera-relative streaks whose
// length and slant come from each drop's velocity relative to the Jeep (fall
// plus the road rushing past), so a faster chase leans the rain harder. Road
// splashes, puddle ripples, soaked materials, lightning and the overcast grade
// all read one smoothed storm value; Clear leaves every base value untouched.

const KEY='rex-pursuit-conditions';
export const CONDITIONS=['clear','storm','night','night-storm'];
export function storedConditions(){try{const v=localStorage.getItem(KEY);return CONDITIONS.includes(v)?v:'clear';}catch{return 'clear';}}
export function storeConditions(v){try{localStorage.setItem(KEY,v);}catch{}}

const STORM={fog:new T.Color(0x4e5851),zenith:new T.Color(0x3a444c),hemiSky:new T.Color(0x9fb0b8),hemiGround:new T.Color(0x2a2620),sun:new T.Color(0xc9d2dc),density:1.5,sun_:.06,hemi:1.95,rim:.55,fill:1.2,env:1.25,exposure:1.2,saturation:.84,contrast:.27,vol:.12,bloom:.1};
// Night is absolute rather than relative: moonlight is a faint cool key along the
// sun direction plus a moon rim from behind the Rex. Storm clouds dim both.
const NIGHT={fog:new T.Color(0x0b1317),fogStorm:new T.Color(0x0e1518),zenith:new T.Color(0x060c18),zenithStorm:new T.Color(0x0b1015),hemiSky:new T.Color(0x6a7fa3),hemiGround:new T.Color(0x16140f),moon:new T.Color(0xa7bde3),
 sun:.17,hemi:.13,rim:1.1,fill:.03,env:.22,density:1.18,exposure:1.3,saturation:.8,contrast:.26,vol:.05,bloom:.2,shadowTint:new T.Color(.7,.9,1.3)};
const RAIN_BOX=new T.Vector3(26,17,34),RAIN_MAX=14000,SPLASH_MAX=320;

function rainMesh(){
 const g=new T.InstancedBufferGeometry();
 g.setAttribute('corner',new T.Float32BufferAttribute([-1,0,1,0,-1,1,1,1],2));g.setIndex([0,2,1,1,2,3]);
 const seeds=new Float32Array(RAIN_MAX*4);let s=4242;const r=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};for(let i=0;i<seeds.length;i++)seeds[i]=r();
 g.setAttribute('seed',new T.InstancedBufferAttribute(seeds,4));g.instanceCount=RAIN_MAX;
 const uniforms={boxMin:{value:new T.Vector3()},boxSize:{value:RAIN_BOX.clone()},offset:{value:new T.Vector3()},vel:{value:new T.Vector3(0,9,10)},
  streak:{value:.034},width:{value:.0075},minPx:{value:1},viewport:{value:new T.Vector2(1,1)},density:{value:0},tint:{value:new T.Color()},opacity:{value:.42},
  beamPos:{value:new T.Vector3()},beamDir:{value:new T.Vector3(0,0,1)},beamCos:{value:.95},beamTint:{value:new T.Color(0,0,0)}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:false,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec2 corner;attribute vec4 seed;uniform vec3 boxMin,boxSize,offset,vel,beamPos,beamDir;uniform vec2 viewport;uniform float streak,width,minPx,density,beamCos;
   varying vec2 vUv;varying float vAlpha,vBeam;
   void main(){
    float f=.8+.4*seed.w;
    vec3 p=boxMin+mod(seed.xyz*boxSize+vec3(offset.x,offset.y*f,offset.z)-boxMin,boxSize);
    vec3 v=vec3(vel.x,-vel.y*f,vel.z);
    vec4 h=projectionMatrix*viewMatrix*vec4(p,1.),t=projectionMatrix*viewMatrix*vec4(p-v*streak,1.);
    vUv=corner;
    if(h.w<.3||t.w<.3||fract(seed.w*91.7+seed.x*13.1)>density){gl_Position=vec4(2.,2.,2.,1.);vAlpha=0.;return;}
    vec2 d=(h.xy/h.w-t.xy/t.w)*viewport;float len=length(d);vec2 dir=len>1e-3?d/len:vec2(0.,1.);
    // Drops right at the lens would smear into long straight scratches across
    // the sky (worst on tall phone screens): cap the on-screen streak length.
    float cap=min(1.,viewport.y*.09/max(len,1e-3));t=mix(h,t,cap);
    // World width in pixels, clamped to a visible minimum; thinner drops fade instead.
    float px=width*projectionMatrix[1][1]*viewport.y*.5/h.w,drawn=max(px,minPx);
    vec4 c=mix(h,t,corner.y);
    c.xy+=vec2(-dir.y,dir.x)*corner.x*drawn/viewport*c.w;
    gl_Position=c;
    vec3 q=(p-boxMin)/boxSize;vec3 e=min(q,1.-q);
    vAlpha=smoothstep(.9,2.6,h.w)*mix(.35,1.,cap)*smoothstep(0.,.07,min(min(e.x,e.y),e.z))*mix(.4,1.,min(1.,px/minPx));
    // Drops inside the flashlight cone catch the beam, brightest near the lens.
    vec3 bl=p-beamPos;float bd=max(length(bl),.01);
    vBeam=smoothstep(beamCos,mix(beamCos,1.,.45),dot(bl/bd,beamDir))/(1.+bd*bd*.012);
   }`,
  fragmentShader:`uniform vec3 tint,beamTint;uniform float opacity;varying vec2 vUv;varying float vAlpha,vBeam;
   void main(){float a=(1.-vUv.x*vUv.x)*mix(1.,.25,vUv.y)*vAlpha*opacity;if(a<.003)discard;gl_FragColor=vec4(tint+beamTint*vBeam,min(1.,a*(1.+vBeam*length(beamTint))));}`});
 const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=5;mesh.name='Rain';mesh.visible=false;
 return{mesh,uniforms};
}

function splashMesh(){
 const g=new T.InstancedBufferGeometry();
 g.setAttribute('corner',new T.Float32BufferAttribute([-1,-1,1,-1,-1,1,1,1],2));g.setIndex([0,2,1,1,2,3]);
 const seeds=new Float32Array(SPLASH_MAX*4);let s=777;const r=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};for(let i=0;i<seeds.length;i++)seeds[i]=r();
 g.setAttribute('seed',new T.InstancedBufferAttribute(seeds,4));g.instanceCount=SPLASH_MAX;
 const uniforms={...T.UniformsUtils.clone(T.UniformsLib.fog),time:{value:0},travel:{value:10},camPos:{value:new T.Vector3()},density:{value:0},tint:{value:new T.Color()},opacity:{value:.5}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:true,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec2 corner;attribute vec4 seed;uniform float time,travel,density;uniform vec3 camPos;
   varying vec2 vUv;varying float vAge,vOn;
   #include <fog_pars_vertex>
   void main(){
    float period=.42+.32*seed.w,tt=time/period+seed.z,cyc=floor(tt);vAge=fract(tt);
    vec2 r=fract(sin(vec2(cyc*12.9898+seed.x*78.233,cyc*39.346+seed.y*11.135))*43758.5453);
    vOn=step(fract(r.x*7.13+r.y*3.71),density);
    // Each ring is born on the road and rides away with it for its short life.
    vec3 p=vec3(camPos.x+(r.x*2.-1.)*9.5,.018,camPos.z-1.5+r.y*27.+vAge*period*travel);
    float size=.14+.2*seed.y;vUv=corner;
    vec4 mvPosition=viewMatrix*vec4(p+vec3(corner.x,0.,corner.y)*size,1.);
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform vec3 tint;uniform float opacity;varying vec2 vUv;varying float vAge,vOn;
   #include <fog_pars_fragment>
   void main(){
    float r=length(vUv),fade=pow(1.-vAge,1.5);
    float ring=smoothstep(.1,0.,abs(r-vAge))+.55*smoothstep(.08,0.,abs(r-vAge*.55))*step(.18,vAge);
    float crown=smoothstep(.22,0.,r)*smoothstep(.16,0.,vAge)*1.6;
    float a=(ring*fade+crown)*vOn*opacity;if(a<.004)discard;
    gl_FragColor=vec4(tint,a);
    #include <fog_fragment>
   }`});
 const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.name='Rain splashes';mesh.visible=false;
 return{mesh,uniforms};
}

// A forked channel built by midpoint displacement in a camera-facing plane.
function boltGeometry(rand){
 const P=[],I=[];
 function channel(x0,y0,x1,y1,width,depth){
  let pts=[[x0,y0],[x1,y1]];
  for(let level=0;level<6;level++){const next=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);next.push([(a[0]+b[0])/2+(rand()-.5)*len*.42,(a[1]+b[1])/2+(rand()-.5)*len*.12],b);}pts=next;}
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*width/2,ny=dx/l*width/2,k=P.length/3;
   P.push(a[0]+nx,a[1]+ny,0,a[0]-nx,a[1]-ny,0,b[0]+nx,b[1]+ny,0,b[0]-nx,b[1]-ny,0);I.push(k,k+1,k+2,k+1,k+3,k+2);
   if(depth<2&&i%9===4&&rand()<.55){const side=rand()<.5?-1:1,len=(12+rand()*26)/(depth+1);channel(b[0],b[1],b[0]+side*len*.8,b[1]-len,width*.45,depth+1);}
  }
 }
 channel(0,0,(rand()-.5)*30,-120,1.5,0);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex(I);return g;
}

export function createWeather(scene,{renderer,sky,makeEnvironment,reducedMotion=false}){
 const rain=rainMesh(),splash=splashMesh();scene.add(rain.mesh,splash.mesh);
 const boltMaterial=new T.MeshBasicMaterial({color:0xffffff,transparent:true,blending:T.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false,side:T.DoubleSide});
 const bolt=new T.Mesh(new T.BufferGeometry(),boltMaterial);bolt.visible=false;bolt.frustumCulled=false;bolt.name='Lightning';scene.add(bolt);
 let seed=31337;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const stored=storedConditions();
 let target=stored.includes('storm')?1:0,value=target,nightTarget=stored.startsWith('night')?1:0,night=nightTarget,wind=0,gust=0,gustTarget=0,gustTimer=0,flash=0,nextStrike=3.5,strike=null,splashQuality=1;
 const envs={clear:scene.environment};
 const offset=new T.Vector3(),forward=new T.Vector3(),flashDir=new T.Vector3(0,1,0),viewport=new T.Vector2(),c=new T.Color(),moonPos=new T.Vector3();
 const base={};
 const envFor=kind=>envs[kind]||=makeEnvironment(renderer,{storm:kind.includes('storm')?1:0,night:kind.startsWith('night')?1:0});
 const api={
  bolt,rain:rain.mesh,splashes:splash.mesh,rainUniforms:rain.uniforms,
  onThunder:null,
  get kind(){return (nightTarget>.5?'night':'')+(nightTarget>.5&&target>.5?'-':'')+(target>.5?'storm':nightTarget>.5?'':'clear');},get rainLevel(){return RAIN.value;},get value(){return value;},get night(){return night;},get flash(){return flash;},get strike(){return strike;},
  /** Record the lighting a location sets, so the storm always blends from it. */
  captureBase({sun,hemi,rim,fill,post}){
   Object.assign(base,{sun:sun.intensity,sunColor:sun.color.clone(),hemi:hemi.intensity,hemiSky:hemi.color.clone(),hemiGround:hemi.groundColor.clone(),rim:rim.intensity,rimColor:rim.color.clone(),rimPos:rim.position.clone(),fill:fill.intensity,
    fog:scene.fog.color.clone(),density:scene.fog.density,env:scene.environmentIntensity,zenith:sky.uniforms.zenith.value.clone()});
   // The grade is never set by a location, so its base is recorded only once.
   if(!('exposure' in base))Object.assign(base,{exposure:post.final.exposure.value,saturation:post.final.saturation.value,contrast:post.final.contrast.value,vol:post.final.volStrength.value,bloom:post.final.bloomStrength.value,volColor:post.volume.sunColor.value.clone(),shadowTint:post.final.shadowTint.value.clone()});
  },
  set(kind,{instant=false}={}){if(!CONDITIONS.includes(kind))return;target=kind.includes('storm')?1:0;nightTarget=kind.startsWith('night')?1:0;storeConditions(api.kind);envFor(api.kind);if(instant){value=target;night=nightTarget;}},
  setQuality(t){splashQuality=Math.min(1,t.particles);rain.mesh.geometry.instanceCount=Math.floor(RAIN_MAX*Math.min(1,t.particles));splash.mesh.geometry.instanceCount=Math.floor(SPLASH_MAX*Math.min(1,t.particles));},
  reset(){flash=0;strike=null;bolt.visible=false;nextStrike=3.5;},
  /** Advance rain, wind and lightning. `shelter` 0..1 fades rain (inside the jaws). */
  update(dt,speed,camera,{ground=true,shelter=0}={}){
   value+=(target-value)*Math.min(1,dt*1.6);if(Math.abs(target-value)<.002)value=target;
   night+=(nightTarget-night)*Math.min(1,dt*1.6);if(Math.abs(nightTarget-night)<.002)night=nightTarget;DARK.value=night;
   const w=value,on=w>.001;
   gustTimer-=dt;if(gustTimer<=0){gustTimer=1.5+rand()*4;gustTarget=rand()*rand();}gust+=(gustTarget-gust)*Math.min(1,dt*.8);
   wind=w*(.6+gust*1.2);
   WIND_GUST.value=1+w*(1.3+gust*1.6);sky.uniforms.drift.value+=dt*w*5;WET.value=w;RAIN.value=w*(1-shelter);RAIN_TIME.value+=dt;
   rain.mesh.visible=on&&shelter<.99;splash.mesh.visible=on&&ground&&shelter<.99;
   if(on){
    const fall=8.6;rain.uniforms.vel.value.set(-1.6*wind,fall,speed+.9*wind);
    offset.x=(offset.x+rain.uniforms.vel.value.x*dt)%RAIN_BOX.x;offset.y=(offset.y-fall*dt)%(RAIN_BOX.y*600);offset.z=(offset.z+rain.uniforms.vel.value.z*dt)%RAIN_BOX.z;
    rain.uniforms.offset.value.copy(offset);
    camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<1e-4)forward.set(0,0,1);forward.normalize();
    rain.uniforms.boxMin.value.copy(camera.position).addScaledVector(forward,RAIN_BOX.z*.5-4.5).sub(RAIN_BOX.clone().multiplyScalar(.5));rain.uniforms.boxMin.value.y=camera.position.y-RAIN_BOX.y*.42;
    renderer.getDrawingBufferSize(viewport);rain.uniforms.viewport.value.copy(viewport);rain.uniforms.minPx.value=Math.max(1,renderer.getPixelRatio()*.85);
    rain.uniforms.density.value=Math.min(1,w*1.15)*(1-shelter);
    splash.uniforms.time.value+=dt;splash.uniforms.travel.value=speed;splash.uniforms.camPos.value.copy(camera.position);splash.uniforms.density.value=w*(.55+.45*splashQuality)*(1-shelter);
   }
   // Lightning: a few ragged return strokes, most of them from ahead of the gunner.
   if(strike){strike.t+=dt;if(strike.t>1.6){strike=null;bolt.visible=false;}}
   if(w>.6&&!strike){nextStrike-=dt;if(nextStrike<=0){api.strikeNow(camera);nextStrike=6+rand()*11;}}
   flash=0;
   if(strike){
    for(const [at,amp]of strike.pulses){const t=strike.t-at;if(t>=0)flash+=amp*Math.exp(-t*(reducedMotion?4:16))*(reducedMotion?1:1+.25*Math.sin(t*90));}
    flash=Math.max(0,flash)*strike.near*w;
    bolt.visible=strike.visible&&flash>.02;boltMaterial.color.setRGB(3.4,3.8,5.4).multiplyScalar(Math.min(2.4,flash*2.4));
   }
  },
  strikeNow(camera){
   // Most strokes fall along the road corridor, where the canopy opens to the sky.
   const a=rand()<.65?(rand()-.5)*.7:(rand()-.5)*1.7+(rand()<.35?Math.PI:0),distance=500+rand()*2500,near=reducedMotion?.35:Math.min(1,.45+(3000-distance)/3000*.75);
   const pulses=reducedMotion?[[0,.7]]:[[0,1],[.07+rand()*.06,.55+rand()*.3],[.2+rand()*.12,.35+rand()*.5]];
   const dir=new T.Vector3(Math.sin(a),0,Math.cos(a));
   strike={t:0,pulses,near,distance,dir,visible:Math.abs(a)<.6&&rand()<.85};
   if(strike.visible){
    bolt.geometry.dispose();bolt.geometry=boltGeometry(rand);
    bolt.position.copy(camera.position).addScaledVector(dir,165);bolt.position.y=camera.position.y+98+rand()*20;
    bolt.lookAt(camera.position.x,bolt.position.y,camera.position.z);bolt.scale.setScalar(.9+rand()*.35);
   }
   flashDir.copy(dir).setY(.55).normalize();sky.uniforms.flashDir.value.copy(flashDir);
   api.onThunder?.(distance/343,near);
   return strike;
  },
  /** Write storm lighting and grade over the captured base. */
  apply({sun,hemi,rim,fill,post}){
   if(!('sun' in base))return;
   const w=value,f=flash;
   scene.fog.color.copy(base.fog).lerp(STORM.fog,w);scene.background.copy(scene.fog.color);scene.fog.density=base.density*(1+(STORM.density-1)*w);
   sky.uniforms.horizon.value.copy(scene.fog.color);sky.uniforms.zenith.value.copy(base.zenith).lerp(STORM.zenith,w);
   sky.uniforms.storm.value=w;sky.uniforms.flash.value=f;
   sun.intensity=base.sun*(1+(STORM.sun_-1)*w);sun.color.copy(base.sunColor).lerp(STORM.sun,w);
   hemi.intensity=base.hemi*(1+(STORM.hemi-1)*w)+f*.18;hemi.color.copy(base.hemiSky).lerp(STORM.hemiSky,w);hemi.groundColor.copy(base.hemiGround).lerp(STORM.hemiGround,w);
   rim.intensity=base.rim*(1+(STORM.rim-1)*w)+f*4.2;
   if(strike&&f>.01)rim.position.copy(strike.dir).multiplyScalar(60).setY(70);else rim.position.copy(base.rimPos);
   fill.intensity=base.fill*(1+(STORM.fill-1)*w);
   scene.environmentIntensity=base.env*(1+(STORM.env-1)*w);
   const u=post.final;u.exposure.value=base.exposure*(1+(STORM.exposure-1)*w);u.saturation.value=base.saturation+(STORM.saturation-base.saturation)*w;
   u.contrast.value=base.contrast+(STORM.contrast-base.contrast)*w;u.volStrength.value=base.vol*(1+(STORM.vol-1)*w);u.bloomStrength.value=base.bloom+(STORM.bloom-base.bloom)*w;
   post.volume.sunColor.value.copy(base.volColor);rim.color.copy(base.rimColor);u.shadowTint.value.copy(base.shadowTint);
   // Night blends over the result, so Night + Storm is a moonless, rain-dark deck.
   const n=night;sky.uniforms.night.value=n;
   if(n>0){
    scene.fog.color.lerp(c.copy(NIGHT.fog).lerp(NIGHT.fogStorm,w),n);scene.background.copy(scene.fog.color);scene.fog.density*=1+(NIGHT.density-1)*n;
    sky.uniforms.horizon.value.copy(scene.fog.color);sky.uniforms.zenith.value.lerp(c.copy(NIGHT.zenith).lerp(NIGHT.zenithStorm,w),n);
    sun.intensity+=(NIGHT.sun*(1-.7*w)-sun.intensity)*n;sun.color.lerp(NIGHT.moon,n);
    hemi.intensity+=(NIGHT.hemi*(1+.25*w)+f*.9-hemi.intensity)*n;hemi.color.lerp(NIGHT.hemiSky,n);hemi.groundColor.lerp(NIGHT.hemiGround,n);
    rim.intensity+=(NIGHT.rim*(1-.75*w)+f*6-rim.intensity)*n;rim.color.lerp(NIGHT.moon,n);
    if(!(strike&&f>.01))rim.position.lerp(moonPos.copy(sky.uniforms.moonDir.value).multiplyScalar(60),n);
    fill.intensity+=(NIGHT.fill-fill.intensity)*n;scene.environmentIntensity+=(NIGHT.env-scene.environmentIntensity)*n;
    u.exposure.value+=(NIGHT.exposure-u.exposure.value)*n;u.saturation.value+=(NIGHT.saturation-u.saturation.value)*n;u.contrast.value+=(NIGHT.contrast-u.contrast.value)*n;
    u.volStrength.value+=(NIGHT.vol*(1-.8*w)-u.volStrength.value)*n;u.bloomStrength.value+=(NIGHT.bloom-u.bloomStrength.value)*n;post.volume.sunColor.value.lerp(NIGHT.moon,n);u.shadowTint.value.lerp(NIGHT.shadowTint,n);
   }
   scene.environment=envs[(n>.5?'night':'')+(n>.5&&w>.5?'-':'')+(w>.5?'storm':n>.5?'':'clear')]||envs.clear;
   // Rain catches the overcast sky and every lightning flash.
   c.copy(scene.fog.color).multiplyScalar(2.3).addScalar(.06*(1-n*.6)+f*.55);rain.uniforms.tint.value.copy(c);splash.uniforms.tint.value.copy(c).multiplyScalar(.9);
  },
  /** Adds the lightning's brief whole-frame lift to the post flash colour. */
  addFlash(color){if(flash>0)color.add(c.setRGB(.55,.62,.8).multiplyScalar(flash*.012));}
 };
 envFor(api.kind);
 return api;
}
