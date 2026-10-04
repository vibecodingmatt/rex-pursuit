import * as T from 'three';
// A5 Light and air: each stage's key and fill, its grade, haze and horizon. Owns the
// sun's shadow fit, the world-anchored canopy dapple, the practical lamps and the rim
// light on creatures. world.js applies a look in setStage and calls update every frame.

const clamp=T.MathUtils.clamp,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Key direction from azimuth (degrees right of the direction of travel, +z) and elevation.
// The camera looks along +z, so screen-right is world -x.
const toward=(az,el)=>{const a=T.MathUtils.degToRad(az),e=T.MathUtils.degToRad(el);return new T.Vector3(-Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)).normalize();};

// Ridge layers run far to near: [base, amplitude, frequency, seed] in tan(elevation), with a colour and
// how far each has dissolved into the haze. Peaks stand on a layer: [azimuth, height, width, layer].
const LOOKS={
 // Misty dawn at the gates: a low gold sun ahead-left through ground mist, cool shadows.
 gates:{key:[-24,13,0xffc489,3.7],fill:[0xa9bccc,0x3d3b29,1.35],env:[0x88a6c2,0xf1d2a8,0x3a3a28,1,.5],
  fog:[0xc0c2ae,.0098,.075,.58,0xffc283,.85],sky:[0x7d9cba,0xf0d3a8,15,0,0],air:[.013,0xffd09a,.8],
  grade:[1.2,.13,1.02,.012,[.93,1,1.08],[1.08,1,.88],.2,.09],rim:[0xffc887,1.25],lamps:[0xffc47c,0],
  ridges:[[.035,.075,2.3,1.7,0x8e9fa8,.62],[.022,.05,3.4,4.2,0x6f8478,.44],[.012,.03,5.8,7.9,0x4c6047,.26]],peaks:[[38,.16,.32,0,0,0]],clouds:[.03,.07,.55,2.2,0xf3dcc0]},
 // Humid haze on the river: a high white sun through wet air, soft and low in contrast.
 river:{key:[42,33,0xfff0d0,3.1],fill:[0xc4d6c9,0x3a432e,1.75],env:[0xa4bcc0,0xdbe2cc,0x39402c,.7,.55],
  fog:[0xaabca7,.0076,.05,.62,0xfff3cf,.4],sky:[0x9db7ba,0xdbe3cf,10,.1,0],air:[.014,0xfff1d4,.55],
  grade:[1.1,.09,.98,.016,[.96,1.02,1.01],[1.04,1.02,.95],.16,.08],rim:[0xfff0d0,.75],lamps:[0xffc47c,0],
  ridges:[[.03,.06,2.6,9.1,0x9db0a8,.68],[.016,.04,4.2,3.3,0x7c917e,.5]],peaks:[[-55,.13,.28,0,0,0]],clouds:[.025,.09,.7,5.5,0xe8eee0]},
 // Ember light in the canyon: a red sun low through ash, warm dust, the cave lit by lava.
 fault:{key:[8,13,0xff7a3c,3.2],fill:[0x9a6a52,0x3a2419,1.85],env:[0x3f2c29,0xa55e3c,0x2a1a12,1,.45],
  fog:[0x6a4236,.0106,.06,.6,0xff7a3c,.8],sky:[0x1c1517,0x83492f,6,.85,0],air:[.015,0xffa063,.9],
  grade:[1.14,.16,1.06,.008,[1.03,.95,.95],[1.1,.95,.82],.22,.1],rim:[0xff8b4c,1.35],lamps:[0xff6327,95],
  ridges:[[.04,.09,2.1,6.6,0x4a3430,.55],[.024,.06,3.6,2.4,0x352624,.36],[.012,.035,6.2,8.8,0x241a19,.2]],peaks:[[-34,.11,.3,0,1,1],[40,.07,.22,1,0,0]],clouds:[.05,.08,.6,1.1,0x6f4a3e]},
 // Innovation Valley: a clear tropical afternoon, the sun behind-right, crisp and saturated.
 hybrid:{key:[128,40,0xfff1da,3.4],fill:[0xb4cfe2,0x3a4037,1.6],env:[0x6894c4,0xcfe0e4,0x384034,.8,.55],
  fog:[0xa3bfcb,.0078,.06,.6,0xfff4dc,.5],sky:[0x5b8fc4,0xcbdde2,22,0,0],air:[.006,0xfff4dc,.4],
  grade:[1.15,.15,1.08,.004,[.95,1,1.06],[1.04,1.01,.95],.18,.07],rim:[0xfff1da,.65],lamps:[0xb9e3f0,30],
  ridges:[[.045,.1,2.2,3.9,0x7f9cab,.5],[.028,.07,3.3,7.1,0x587a6b,.32],[.014,.04,5.4,1.3,0x3d5c43,.18]],peaks:[[-30,.22,.28,0,0,0]],clouds:[.06,.1,.5,8.4,0xf4f6f2]},
 // Cold blue dusk on the lagoon: the last warm sliver of sun on the horizon, blue skylight everywhere else.
 lagoon:{key:[3,5,0xff9160,1.9],fill:[0x6a86b8,0x1d2530,1.7],env:[0x2b3d66,0xd9906c,0x1a2028,1,.5],
  fog:[0x58698a,.0082,.05,.62,0xffa676,.45],sky:[0x1f3058,0xd98c66,12,0,0],air:[.005,0xffa278,.55],
  grade:[1.26,.15,1.0,.014,[.9,.98,1.12],[1.1,.98,.86],.24,.1],rim:[0xffa070,1.2],lamps:[0xffc47c,60],
  ridges:[[.03,.07,2.4,5.2,0x3c4a6c,.55],[.018,.05,3.8,9.6,0x29344d,.36],[.008,.028,6.4,2.8,0x1b2233,.2]],peaks:[[30,.15,.3,0,0,0]],clouds:[.02,.06,.65,3.7,0xd8a088]},
 // The conservatory at night in a storm: cold light through the glass, warm lamps, lightning.
 manor:{key:[160,52,0x8ea8d6,1.1],fill:[0x2c3c52,0x0f1318,1.15],env:[0x18222e,0x2c3a48,0x101418,0,.32],
  fog:[0x1e2c36,.017,.02,.8,0x6f86a8,.4],sky:[0x10161c,0x243440,0,1,.85],air:[.004,0x9fb4d8,.4],
  grade:[1.3,.18,.86,.01,[.9,1,1.1],[1.06,1,.9],.26,.1],rim:[0x9ab8e8,1],lamps:[0xffbf78,85],storm:true},
 // The moonlit finale: the moon ahead casts the shadows, sodium lamps pool on the concrete.
 visitor:{key:[12,19,0xa8bfea,1.7],fill:[0x2e4566,0x11151c,1.3],env:[0x0c1628,0x2a3c58,0x0e1218,.8,.42],
  fog:[0x1f2d42,.0105,.05,.62,0x9cb6e2,.25],sky:[0x0b1428,0x2b3d5a,0,0,1],air:[.005,0xa4bce6,.55],
  grade:[1.34,.16,.9,.012,[.88,.97,1.12],[1.02,1,1.04],.26,.1],rim:[0xb2caff,1.2],lamps:[0xffad5e,70],
  ridges:[[.035,.08,2.2,4.4,0x1d2a40,.5],[.02,.05,3.6,8.2,0x141e30,.32],[.01,.03,6,1.9,0x0d141f,.18]],peaks:[[-40,.17,.3,0,0,0]],clouds:[.03,.06,.45,6.1,0x3a4a66]}
};
export const STAGE_LOOKS=LOOKS;

// ---- Fog: exp2 haze that thins with height and glows toward the stage's key --------
// One plain object per uniform is shared by reference with every built-in material
// (cloneUniforms copies plain objects by reference), so a stage change reaches all of them.
export const FOG={sun:{x:0,y:1,z:0},glow:{x:0,y:0,z:0},shape:{x:.06,y:.6,z:0}};
export function installArcadeFog(){
 const c=T.ShaderChunk;if(c.fog_fragment.includes('ATMOSPHERIC'))return;
 c.fog_pars_vertex='#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorld;\n#endif';
 c.fog_vertex='#ifdef USE_FOG\n vFogDepth=-mvPosition.z; vFogWorld=transpose(mat3(viewMatrix))*(mvPosition.xyz-viewMatrix[3].xyz);\n#endif';
 c.fog_pars_fragment=`#ifdef USE_FOG
 uniform vec3 fogColor,fogSun,fogGlow,fogShape; varying float vFogDepth; varying vec3 vFogWorld;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear; uniform float fogFar;
 #endif
#endif`;
 c.fog_fragment=`#ifdef USE_FOG
 // ATMOSPHERIC (arcade): materials without the shared uniforms see shape 0 and glow 0, plain haze.
 #ifdef FOG_EXP2
  float fogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
 #else
  float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
 #endif
 vec3 fogRay=vFogWorld-cameraPosition;float fogLength=max(length(fogRay),1e-4);
 fogFactor*=mix(fogShape.y,1.,exp(-max(vFogWorld.y-fogShape.z,0.)*fogShape.x));
 vec3 fogTint=fogColor+fogGlow*pow(max(dot(fogRay/fogLength,fogSun),0.),6.);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogTint,fogFactor);
#endif`;
 for(const u of [T.UniformsLib.fog,...Object.values(T.ShaderLib).map(s=>s.uniforms)])if(u&&'fogColor' in u)Object.assign(u,{fogSun:{value:FOG.sun},fogGlow:{value:FOG.glow},fogShape:{value:FOG.shape}});
}

// ---- Rim light: a Fresnel edge on the side facing the key, for creatures only ------
export const RIM={color:{value:new T.Color()},dir:{value:new T.Vector3(0,1,0)}};
export function addRim(material){
 if(!material||material.userData.rim||!('roughness' in material||'shininess' in material||material.isMeshLambertMaterial))return;material.userData.rim=true;
 const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(s,r)=>{before.call(material,s,r);s.uniforms.uRimColor=RIM.color;s.uniforms.uRimDir=RIM.dir;
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uRimColor,uRimDir;')
   .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   {float rimEdge=pow(1.-saturate(dot(normal,geometryViewDir)),3.);reflectedLight.directSpecular+=uRimColor*rimEdge*saturate(dot(normal,uRimDir)*.75+.25)*(.3+.7*material.diffuseColor);}`);};
 material.customProgramCacheKey=()=>key()+'|arcade-rim';material.needsUpdate=true;
}

// ---- Image-based light per stage ---------------------------------------------------
function environment(renderer,look,key){
 const [zenith,horizon,ground,forest]=look.env,scene=new T.Scene();
 const material=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{zenith:{value:new T.Color(zenith)},horizon:{value:new T.Color(horizon)},ground:{value:new T.Color(ground)},sunDir:{value:key.clone()},sunColor:{value:new T.Color(look.key[2]).multiplyScalar(look.key[3]*.18)},forest:{value:forest}},
  vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 vDir;uniform vec3 zenith,horizon,ground,sunDir,sunColor;uniform float forest;
  float n(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec3 d=normalize(vDir);float h=d.y,mu=max(dot(d,sunDir),0.);
   vec3 c=mix(horizon,zenith,pow(smoothstep(-.02,.75,h),.55))+sunColor*(pow(mu,6.)*.7+pow(mu,64.)*3.);
   // Surrounding trees: a dark, broken band at the horizon (jungle stages only).
   float band=smoothstep(.42,.1,h+.06*(n(floor(vec2(atan(d.z,d.x)*9.,0.)))-.5));c=mix(c,vec3(.03,.045,.022),band*.9*forest);
   gl_FragColor=vec4(mix(c,ground,smoothstep(0.,-.14,h)),1.);}`});
 scene.add(new T.Mesh(new T.SphereGeometry(50,48,24),material));
 const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromScene(scene,0,.1,100);pmrem.dispose();material.dispose();return target.texture;
}

// ---- The horizon: layered ridges, volcanic peaks and cloud banks -------------------
// A camera-centred ring just inside the far plane, drawn last in the opaque pass with
// blending: depth testing then shades only the sky the scene leaves uncovered.
const RIDGE_NOISE=`
 float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vn(p);p=p*2.07+vec2(5.3,1.7);a*=.5;}return v;}
 // Ridged noise for crests: sharp tops, soft valleys.
 float ridged(vec2 p){float v=0.,a=.55;for(int i=0;i<5;i++){float r=1.-abs(vn(p)*2.-1.);v+=a*r*r;p=p*2.11+vec2(3.1,7.7);a*=.48;}return v;}`;
function horizonMaterial(){
 return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:true,fog:false,toneMapped:false,transparent:false,blending:T.CustomBlending,blendSrc:T.SrcAlphaFactor,blendDst:T.OneMinusSrcAlphaFactor,
  uniforms:{uSun:{value:new T.Vector3(0,1,0)},uSunColor:{value:new T.Color()},uHaze:{value:new T.Color()},uGlow:{value:new T.Color()},uLayer:{value:[0,1,2].map(()=>new T.Vector4())},uLayerColor:{value:[0,1,2].map(()=>new T.Color())},uLayerHaze:{value:[0,0,0]},
   uPeak:{value:[0,1].map(()=>new T.Vector4(0,0,1,-1))},uPeakFx:{value:[0,1].map(()=>new T.Vector2())},uCloud:{value:new T.Vector4()},uCloudColor:{value:new T.Color()},uTime:{value:0},uNight:{value:0},uTop:{value:0}},
  vertexShader:'varying vec3 vDir;void main(){vec4 w=modelMatrix*vec4(position,1.);vDir=w.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`varying vec3 vDir;uniform vec3 uSun,uSunColor,uHaze,uGlow,uLayerColor[3],uCloudColor;uniform vec4 uLayer[3],uPeak[2],uCloud;uniform vec2 uPeakFx[2];uniform float uLayerHaze[3],uTime,uNight,uTop;${RIDGE_NOISE}
  void main(){
   vec3 d=normalize(vDir);float flat_=max(length(d.xz),1e-3),t=d.y/flat_;
   // Nothing stands above the tallest crest or plume, and the ground hides what is below the horizon.
   if(t>uTop||t<-.03)discard;vec2 ring=d.xz/flat_;float az=atan(d.x,d.z);
   vec2 sunH=normalize(uSun.xz+vec2(1e-4));float lit=max(dot(ring,sunH),0.);
   float aa=fwidth(t)*1.2+1e-4;vec4 acc=vec4(0.);
   // Cloud bank behind the ridges: piled tops, lit on the sun side, dissolving into the haze below.
   if(uCloud.z>0.){
    float top=uCloud.x+uCloud.y*fbm(ring*3.2+uCloud.w+vec2(uTime*.002,0.)),lump=fbm(ring*9.+vec2(t*30.,uCloud.w));
    float c=smoothstep(top+aa,top-.012,t+.012*lump)*smoothstep(-.01,.03,t)*uCloud.z;
    vec3 col=mix(uHaze,uCloudColor,smoothstep(0.,.06,t))*(.82+.3*lump)+uSunColor*pow(lit,4.)*.35*(1.-uNight);
    acc=mix(acc,vec4(col,1.),c);
   }
   for(int i=0;i<3;i++){
    vec4 L=uLayer[i];if(L.y<=0.)continue;
    float r=L.x+L.y*ridged(ring*L.z+L.w);
    // A stratovolcano: concave flanks cut by gullies, a truncated summit and a crater notch.
    for(int k=0;k<2;k++){vec4 P=uPeak[k];if(int(P.w)!=i)continue;float x=abs(atan(sin(az-P.x),cos(az-P.x)))/P.z;if(x>=1.)continue;
     float cone=min(pow(1.-x,1.9),.86)/.86-.05*smoothstep(.07,0.,x)-.06*x*vn(vec2(az*95.,2.))*(1.-x);r=max(r,L.x+P.y*cone);}
    float inside=smoothstep(r+aa,r-aa,t);
    if(inside>0.){
     // Aerial perspective: each layer sinks into the sky's horizon colour, most at its foot,
     // and glows where it stands against the key.
     float haze=mix(uLayerHaze[i],1.,(1.-smoothstep(0.,max(r,.01)*.9,t))*.55);
     vec3 col=mix(uLayerColor[i],uHaze+uGlow*pow(max(dot(d,uSun),0.),6.),haze)+uSunColor*pow(lit,6.)*smoothstep(r-.025,r,t)*.25*(1.-uLayerHaze[i]);
     acc=mix(acc,vec4(col,1.),inside);
    }
   }
   // Volcanic peaks: ash plumes drifting off the summit, and ember glow at the crater.
   for(int k=0;k<2;k++){vec4 P=uPeak[k];vec2 fx=uPeakFx[k];if(P.w<0.||fx.x+fx.y<=0.)continue;
    float summit=uLayer[int(P.w)].x+P.y*.95,da=atan(sin(az-P.x),cos(az-P.x)),s=t-summit+.003;
    // The column rises, then bends downwind and spreads.
    if(s>0.&&fx.x>0.){float drift=da-s*s*2.6,w=(.012+s*.32)*P.z*3.,shape=smoothstep(w,w*.25,abs(drift))*smoothstep(0.,.01,s)*(1.-smoothstep(.1,.24,s));
     float puff=fbm(vec2(drift*45./P.z,s*22.-uTime*.05));float a=shape*smoothstep(.32,.6,puff)*fx.x;
     vec3 col=mix(uHaze*.5,uHaze*.85+uSunColor*.12,puff)+vec3(1.,.36,.12)*fx.y*exp(-s*40.)*.7;acc=mix(acc,vec4(col,1.),a*.8);}
    if(fx.y>0.)acc.rgb+=vec3(1.,.32,.08)*fx.y*exp(-abs(s)*120.)*smoothstep(.04*P.z*3.,0.,abs(da))*1.4;
   }
   gl_FragColor=acc;
  }`});
}

export class StageLight {
 constructor(world,{routeX,routeY}){
  this.world=world;this.routeX=routeX;this.routeY=routeY;this.key=new T.Vector3(0,1,0);this.id='';this.envs={};this.flash=0;this.nextFlash=0;
  this.horizon=new T.Mesh(new T.CylinderGeometry(255,255,190,160,1,true),horizonMaterial());this.horizon.renderOrder=50;this.horizon.frustumCulled=false;this.horizon.name='Stage horizon';world.scene.add(this.horizon);
  this.axes={x:new T.Vector3(),y:new T.Vector3()};this.anchor=new T.Vector3();this.temp=new T.Vector3();
 }
 load(renderer){for(const id of Object.keys(LOOKS))this.envs[id]=environment(renderer,LOOKS[id],toward(...LOOKS[id].key.slice(0,2)));}
 get look(){return LOOKS[this.id]||LOOKS.gates;}
 setStage(id){
  const w=this.world,look=LOOKS[id]||LOOKS.gates;this.id=id;this.key.copy(toward(look.key[0],look.key[1]));
  const [kc,ki]=[look.key[2],look.key[3]],[fogColor,density,falloff,floor,glow,glowAmt]=look.fog;
  w.sun.color.set(kc);w.sun.intensity=ki;this.keyIntensity=ki;
  w.hemi.color.set(look.fill[0]);w.hemi.groundColor.set(look.fill[1]);w.hemi.intensity=this.fillIntensity=look.fill[2];
  w.scene.environment=this.envs[id];w.scene.environmentIntensity=this.envIntensity=look.env[4];
  w.scene.background=new T.Color(look.sky[1]);w.scene.fog=new T.FogExp2(fogColor,density);this.fogColor=new T.Color(fogColor);
  Object.assign(FOG.sun,{x:this.key.x,y:this.key.y,z:this.key.z});const g=new T.Color(glow).multiplyScalar(glowAmt);Object.assign(FOG.glow,{x:g.r,y:g.g,z:g.b});Object.assign(FOG.shape,{x:falloff,y:floor,z:0});
  const sky=w.sky.uniforms;sky.zenith.value.set(look.sky[0]);sky.horizon.value.set(look.sky[1]);sky.sunDisk.value=look.sky[2];sky.storm.value=look.sky[3];sky.night.value=look.sky[4];sky.sunDir.value.copy(this.key);sky.sunColor.value.set(kc);
  if(look.sky[4]>.5)sky.moonDir.value.copy(this.key);
  const f=w.post.final,[exposure,contrast,saturation,lift,shadow,highlight,vignette,bloom]=look.grade;
  f.exposure.value=exposure;f.contrast.value=contrast;f.saturation.value=saturation;f.lift.value=lift;f.shadowTint.value.setRGB(...shadow);f.highlightTint.value.setRGB(...highlight);f.vignette.value=vignette;f.bloomStrength.value=bloom;
  const [airDensity,airColor,airStrength]=look.air;w.post.volume.density.value=airDensity;w.post.volume.sunColor.value.set(airColor);f.volStrength.value=this.airStrength=airStrength;w.post.volume.heightFalloff.value=.07;w.post.volume.maxDistance.value=90;
  RIM.color.value.set(look.rim[0]).multiplyScalar(look.rim[1]);
  if(w.water){const u=w.water.material.uniforms;u.sunDirection.value.copy(this.key);u.sunColor.value.set(kc);}
  // Lamp glass glows hotter at night so the bloom carries it.
  w.materials.lamp.color.set(look.lamps[0]).multiplyScalar(look.sky[4]>.5||look.storm?3.2:id==='lagoon'?2.2:1);
  this.setHorizon(look);this.fitShadow(id==='manor');
 }
 setHorizon(look){
  const u=this.horizon.material.uniforms,ridges=look.ridges||[];this.horizon.visible=ridges.length>0;
  u.uSun.value.copy(this.key);u.uSunColor.value.set(look.key[2]).multiplyScalar(Math.min(1.4,look.key[3]*.35));u.uHaze.value.set(look.fog[0]);u.uGlow.value.set(look.fog[4]).multiplyScalar(look.fog[5]);u.uNight.value=look.sky[4];
  for(let i=0;i<3;i++){const r=ridges[i];if(r){u.uLayer.value[i].set(r[0],r[1],r[2],r[3]);u.uLayerColor.value[i].set(r[4]);u.uLayerHaze.value[i]=r[5];}else u.uLayer.value[i].set(0,0,0,0);}
  for(let k=0;k<2;k++){const p=look.peaks?.[k];if(p){u.uPeak.value[k].set(-T.MathUtils.degToRad(p[0]),p[1],p[2],p[3]);u.uPeakFx.value[k].set(p[4],p[5]);}else{u.uPeak.value[k].set(0,0,1,-1);u.uPeakFx.value[k].set(0,0);}}
  // Azimuth in the shader is atan(x, z): world -x is screen-right, hence the sign above.
  const c=look.clouds;if(c){u.uCloud.value.set(c[0],c[1],c[2],c[3]);u.uCloudColor.value.set(c[4]);}else u.uCloud.value.set(0,0,0,0);
  // Ridged noise peaks at 1.03; plumes rise .24 above a summit.
  u.uTop.value=Math.max(0,...ridges.map(r=>r[0]+r[1]*1.03),...(look.peaks||[]).map(p=>ridges[p[3]][0]+p[1]+(p[4]?.25:0)),c?c[0]+c[1]:0)+.01;
 }
 // Fit the sun's orthographic shadow box to the ground the camera sees, in the light's
 // own axes. It then follows the camera in whole shadow-map texels, so edges hold still.
 fitShadow(interior){
  const sun=this.world.sun,L=this.key,x=this.axes.x.set(0,1,0).cross(L);if(x.lengthSq()<1e-4)x.set(1,0,0);x.normalize();const y=this.axes.y.copy(L).cross(x).normalize();
  const W=interior?15:42,back=interior?6:10,ahead=interior?70:96,top=interior?13:28;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
  for(const cx of [-W,W])for(const cz of [-back,ahead])for(const cy of [-3,top]){const p=this.temp.set(cx,cy,cz),px=p.dot(x),py=p.dot(y),pz=p.dot(L);x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);z0=Math.min(z0,pz);z1=Math.max(z1,pz);}
  // Casters stand up the light ray from the ground they shade: a canopy or crown at height h
  // sits h/L.y further along it, which at a dawn sun is about a hundred metres. Capped there:
  // a deeper box takes in every chunk's trees for shade that would land past the view.
  this.distance=z1+Math.min(110,(top+8)/Math.max(L.y,.1))+5;const cam=sun.shadow.camera;Object.assign(cam,{left:x0,right:x1,bottom:y0,top:y1,near:.5,far:this.distance-z0+8});cam.updateProjectionMatrix();
  const size=sun.shadow.mapSize.x;this.texel=[(x1-x0)/size,(y1-y0)/size];
 }
 update(game,{z,camera,time,dt=0}){
  const w=this.world,id=this.id,look=this.look,sun=w.sun,L=this.key,routeX=this.routeX,routeY=this.routeY;
  // Shadow box anchored at the camera's ground point, snapped to texels.
  const a=this.anchor.set(camera.position.x,routeY(z,id),z),{x,y}=this.axes,ax=a.dot(x),ay=a.dot(y);
  a.addScaledVector(x,Math.round(ax/this.texel[0])*this.texel[0]-ax).addScaledVector(y,Math.round(ay/this.texel[1])*this.texel[1]-ay);
  sun.target.position.copy(a);sun.position.copy(a).addScaledVector(L,this.distance);sun.target.updateMatrixWorld();
  // The cave under the fault: no sky reaches it, so the fill and the image light fall away and lava lights it.
  const cave=id==='fault'?1-smooth(250,292,z):0,flash=this.lightning(game,dt);
  w.hemi.intensity=this.fillIntensity*(1-cave*.42)+flash*5;sun.intensity=this.keyIntensity*(1-cave*.5)+flash*7;w.scene.environmentIntensity=this.envIntensity*(1-cave*.6)+flash*.6;
  w.post.final.volStrength.value=this.airStrength*(1-cave*.6);
  if(w.scene.fog){w.scene.fog.color.copy(this.fogColor).multiplyScalar(1-cave*.55);}
  RIM.dir.value.copy(L).transformDirection(camera.matrixWorldInverse);
  this.horizon.position.copy(camera.position);this.horizon.material.uniforms.uTime.value=time%1000;
  this.practicals(z,id,look);
  return{cave,flash};
 }
 // Storm lightning in the conservatory: an uneven double flicker every 6-11 s.
 lightning(game,dt){
  if(!this.look.storm){this.flash=0;return 0;}
  const t=game?.stageTime??0;if(t<this.nextFlash-12)this.nextFlash=t+2;
  if(t>=this.nextFlash){this.flashAt=t;this.nextFlash=t+6+((Math.sin(t*12.9898)*43758.5453)%1+1)%1*5;}
  const s=t-(this.flashAt??-9);this.flash=s<0||s>.5?0:Math.max(0,1-s/.09)+Math.max(0,1-Math.abs(s-.22)/.07)*.7;return this.flash;
 }
 // Practical lamps light the ground where the fixtures stand. Each point light owns every
 // Nth fixture: it stays put as the vehicle passes, then fades up at the next one ahead.
 practicals(z,id,look){
  const lights=this.world.practicalLights,n=lights.length,[color,power]=look.lamps;
  const spec=id==='fault'?{every:13,off:9.2,y:1.1}:id==='manor'?{every:8,off:8.55,y:3.4}:id==='lagoon'?{every:8,off:29.55,y:3.4}:['hybrid','visitor'].includes(id)?{every:8,off:11.55,y:3.4}:{every:8,off:6.4,y:3.3};
  const first=Math.ceil((z-4)/spec.every);
  for(let k=0;k<n;k++){const index=first+k,slot=((index%n)+n)%n,l=lights[slot],zz=index*spec.every,side=index%2?1:-1;
   l.position.set(this.routeX(zz,id)+side*spec.off,this.routeY(zz,id)+spec.y,zz);l.color.set(color);
   const fade=smooth(z+4+n*spec.every,z+n*spec.every-spec.every*.6,zz)*smooth(z-6,z-1,zz),lava=id==='fault'?1-smooth(262,290,zz):1;
   l.intensity=power*fade*lava*(1+this.flash*.2);l.distance=id==='fault'?22:19;}
 }
}

// The canopy dapple, pinned to the world: a strip that follows the route's curve at canopy
// height, its mask addressed by world z (wrapped every 90 m, a whole number of mask tiles).
export class RouteCanopy {
 constructor(canopy,{routeX,routeY,rows=64}){
  this.canopy=canopy;this.routeX=routeX;this.routeY=routeY;this.rows=rows;this.scale=canopy.scale;
  const geometry=new T.PlaneGeometry(1,1,1,rows);canopy.caster.geometry.dispose();canopy.caster.geometry=geometry;canopy.caster.position.set(0,0,0);canopy.caster.rotation.set(0,0,0);canopy.caster.frustumCulled=false;
  // What post's scattering pass reads; its straight mapping matches the strip near the camera.
  this.view={texture:canopy.texture,noise:canopy.noise,offset:new T.Vector2(),scroll:0,height:canopy.height,scale:canopy.scale};
  this.open={texture:canopy.texture,noise:canopy.noise,offset:new T.Vector2(),scroll:0,height:-1e4,scale:canopy.scale};
 }
 update(z,id,key,{height=19,enabled=true}={}){
  const c=this.canopy,geo=c.caster.geometry,pos=geo.attributes.position,uv=geo.attributes.uv,sx=key.x/key.y*height,sz=key.z/key.y*height,wrap=Math.floor(z/this.scale)*this.scale,half=this.scale/2;
  c.enabled=enabled;if(!enabled)return this.open;
  // Rows cover the ground from just behind the camera to 110 m ahead, lifted along the key.
  const start=z-14+sz,length=128;
  for(let j=0;j<=this.rows;j++){const zz=start+length*(this.rows-j)/this.rows,ground=zz-sz,cx=this.routeX(ground,id)+sx,h=this.routeY(ground,id)+height;
   for(let i=0;i<2;i++){const k=j*2+i;pos.setXYZ(k,cx+(i?half:-half),h,zz);uv.setXY(k,i,(zz-wrap)/this.scale);}}
  pos.needsUpdate=uv.needsUpdate=true;
  const mid=z+30;this.view.offset.set(this.routeX(mid,id)+sx,wrap);this.view.height=this.routeY(mid,id)+height;
  return this.view;
 }
}
