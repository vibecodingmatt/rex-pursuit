import * as T from 'three';
// Sky, image-based lighting, height fog and the canopy that dapples sunlight.
// The canopy mask drives three things consistently: shadows (as a hidden
// shadow-casting plane), the ray-marched shafts in post, and nothing else — so
// every shaft lines up with a patch of light on the ground and the animal.

// Key light from above, behind and to the right of the Jeep, so the Rex is lit
// three-quarter on the face as she chases; a sun behind her made her a silhouette.
export const SUN_DIRECTION=new T.Vector3(-.5,.78,-.38).normalize();
// At night the moon hangs low over the road behind the Rex, so it rims her
// silhouette and sits in view from the gun. The sun light stays on
// SUN_DIRECTION as a faint sky key, keeping the canopy dapple aligned.
export const MOON_DIRECTION=new T.Vector3(-.08,.27,.96).normalize();

/** Height-attenuated exp2 fog with a warm in-scatter lobe toward the sun. Must run before materials compile. */
export function installAtmosphericFog(sun=SUN_DIRECTION){
 const c=T.ShaderChunk,dir=`vec3(${sun.x.toFixed(4)},${sun.y.toFixed(4)},${sun.z.toFixed(4)})`;
 if(c.fog_fragment.includes('ATMOSPHERIC'))return;
 c.fog_pars_vertex='#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogWorld;\n#endif';
 c.fog_vertex='#ifdef USE_FOG\n vFogDepth=-mvPosition.z; vFogWorld=transpose(mat3(viewMatrix))*(mvPosition.xyz-viewMatrix[3].xyz);\n#endif';
 c.fog_pars_fragment=`#ifdef USE_FOG
 uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogWorld;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear; uniform float fogFar;
 #endif
#endif`;
 c.fog_fragment=`#ifdef USE_FOG
 // ATMOSPHERIC
 #ifdef FOG_EXP2
  vec3 fogRay=vFogWorld-cameraPosition;float fogLength=max(length(fogRay),1e-4);
  float fogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  fogFactor*=mix(.62,1.,exp(-max(vFogWorld.y,0.)*.05));
  float fogSun=pow(max(dot(fogRay/fogLength,${dir}),0.),5.);
  vec3 fogTint=fogColor*(1.+fogSun*vec3(.55,.42,.22));
 #else
  float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);vec3 fogTint=fogColor;
 #endif
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogTint,fogFactor);
#endif`;
}

const NOISE=`
 float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p=p*2.03+vec2(17.1,9.3);a*=.5;}return v;}
 // Periodic fbm: the lattice repeats every per units (doubling per octave), so
 // the CPU can wrap the cloud scroll and keep coordinates small. Large
 // coordinates quantize on reduced-precision mobile GPUs into flat blocks.
 float vnoiseP(vec2 p,float per){vec2 i=floor(p),f=fract(p),a=mod(i,per),b=mod(i+1.,per);f=f*f*(3.-2.*f);return mix(mix(h21(a),h21(vec2(b.x,a.y)),f.x),mix(h21(vec2(a.x,b.y)),h21(b),f.x),f.y);}
 float fbmP(vec2 p,float per){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoiseP(p,per);p=p*2.+vec2(17.1,9.3);per*=2.;a*=.5;}return v;}
`;
function skyMaterial({forest=false}={}){
 return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,toneMapped:false,
  uniforms:{sunDir:{value:SUN_DIRECTION.clone()},zenith:{value:new T.Color(0x6f9fc4)},horizon:{value:new T.Color(0xc4c9a8)},ground:{value:new T.Color(0x2c3120)},sunColor:{value:new T.Color(1,.86,.62)},time:{value:0},sunDisk:{value:forest?0:26},storm:{value:0},flash:{value:0},flashDir:{value:new T.Vector3(0,1,0)},drift:{value:0},cloudOffset:{value:new T.Vector2()},night:{value:0},moonDir:{value:MOON_DIRECTION.clone()},moonColor:{value:new T.Color(.78,.86,1)}},
  vertexShader:'varying vec3 vDir;void main(){vec4 w=modelMatrix*vec4(position,1.);vDir=w.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`varying vec3 vDir;uniform vec3 sunDir,zenith,horizon,ground,sunColor,flashDir,moonDir,moonColor;uniform vec2 cloudOffset;uniform float time,sunDisk,storm,flash,drift,night;${NOISE}
  void main(){
   vec3 d=normalize(vDir);float h=d.y,mu=dot(d,sunDir),mm=dot(d,moonDir),day=1.-night;
   vec3 sky=mix(horizon,zenith,pow(smoothstep(-.02,.75,h),.55));
   sky+=sunColor*(pow(max(mu,0.),6.)*.55+pow(max(mu,0.),48.)*1.6)*(1.-storm*.92)*day;
   // Night: a wide, faint moon glow scattered through the humid air.
   sky+=moonColor*(pow(max(mm,0.),8.)*.07+pow(max(mm,0.),90.)*.22)*(1.-storm*.8)*night;
   float cloud=0.;
   if(h>0.&&night>0.){
    // Stars: one candidate per cell of a direction lattice, twinkling slowly.
    // Sin-free hashes: sin() of large arguments loses precision on mobile GPUs
    // and draws straight lines across the sky.
    vec3 sp=d*260.;vec3 cell=floor(sp);
    vec3 q=fract(cell*vec3(.1031,.1030,.0973));q+=dot(q,q.yxz+33.33);float sh=fract((q.x+q.y)*q.z);
    vec3 off=fract((q.xxy+q.yxx)*q.zyx)-.5;
    float sd=length(fract(sp)-.5-off*.6),star=smoothstep(.16,0.,sd)*step(.955,sh)*(sh-.955)*22.;
    star*=.65+.35*sin(time*(1.3+sh*3.)+sh*80.);
    sky+=vec3(.85,.9,1.)*star*smoothstep(.04,.35,h)*night*(1.-storm);
   }
   if(h>0.){
    vec2 p=d.xz/(h+.09)*1.25+cloudOffset;
    // Storm: the deck closes over and its heavy base goes dark and ragged.
    float cover=mix(.46,.1,storm)+.1*night*(1.-storm),c=smoothstep(cover,cover+.36-.12*storm,fbmP(p,32.))*smoothstep(.0,.22,h);
    vec3 lit=mix(horizon*1.08,vec3(1.35,1.3,1.2),.55)+sunColor*pow(max(mu,0.),5.)*2.2*(1.-storm);
    lit=mix(lit,mix(vec3(.13,.15,.16),vec3(.34,.37,.38),fbmP(p*2.+3.1,64.)),storm);
    // Night clouds are dark wool with a silver edge toward the moon.
    vec3 nightLit=mix(horizon*1.1,zenith*1.6,.5)+moonColor*(.025+.2*pow(max(mm,0.),6.))*(1.-storm*.85);
    lit=mix(lit,nightLit*mix(1.,.55,fbmP(p*2.+3.1,64.)*storm),night);
    cloud=c*mix(.8,.97,storm);
    sky=mix(sky,lit*(.82+.3*fbmP(p*3.,96.)),cloud);
   }
   sky+=sunColor*sunDisk*smoothstep(.99955,.9998,mu)*(1.-storm)*day;
   // Moon: a lit disk with darker maria, dimmed wherever the deck crosses it.
   if(night>0.&&mm>.998){
    vec3 mr=normalize(cross(moonDir,vec3(0,1,0))),mv=cross(mr,moonDir);vec2 mp=vec2(dot(d,mr),dot(d,mv))/.0275;
    float disk=smoothstep(1.,.93,length(mp)),maria=smoothstep(.45,.75,fbm(mp*1.7+4.));
    sky=mix(sky,moonColor*mix(2.6,1.7,maria)*(1.-.3*dot(mp,mp)),disk*night*(1.-cloud*.7)*(1.-storm*.9));
   }
   // Lightning lights the cloud deck from within, brightest toward the stroke.
   sky+=vec3(.7,.76,1.)*flash*(.3+2.4*pow(max(dot(d,flashDir),0.),5.))*smoothstep(-.05,.15,h);
   ${forest?`
   // Surrounding trees for image-based lighting: dark, broken, green-brown band.
   float band=smoothstep(.42,.12,h+.07*(vnoise(vec2(atan(d.z,d.x)*9.,0.))-.5));
   sky=mix(sky,vec3(.028,.043,.02)*(.8+.4*vnoise(d.xz*13.)),band*.94);`:''}
   sky=mix(sky,ground,smoothstep(0.,-.12,h));
   gl_FragColor=vec4(sky,1.);
  }`});
}
export function createSky(scene){
 const material=skyMaterial(),mesh=new T.Mesh(new T.SphereGeometry(190,48,24),material);
 mesh.name='Procedural sky';mesh.renderOrder=-10;mesh.frustumCulled=false;scene.add(mesh);
 return{mesh,uniforms:material.uniforms,update(camera,time){mesh.position.copy(camera.position);const u=material.uniforms,t=time+u.drift.value;
  // Wrapped on the CPU (the cloud noise repeats every 32 units) so shader inputs stay small.
  u.cloudOffset.value.set((t*.0035)%32,(t*.0019)%32);u.time.value=time%600;},
  palette(fog,zenith){material.uniforms.horizon.value.copy(fog);material.uniforms.zenith.value.set(zenith);}};
}
/** Natural image-based lighting: sky above, a forest band at the horizon, earth below. */
export function createEnvironmentMap(renderer,{storm=0,night=0}={}){
 const scene=new T.Scene(),material=skyMaterial({forest:true});material.uniforms.horizon.value.set(storm?0x5e6860:0xaab394);material.uniforms.storm.value=storm;if(storm)material.uniforms.zenith.value.set(0x46525a);
 if(night){material.uniforms.night.value=1;material.uniforms.horizon.value.set(storm?0x161d22:0x1b2633);material.uniforms.zenith.value.set(storm?0x10161c:0x0c1628);}
 scene.add(new T.Mesh(new T.SphereGeometry(50,64,32),material));
 const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromScene(scene,0,.1,100);
 pmrem.dispose();material.dispose();return target.texture;
}

function canvas(size,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);return c;}
/** Tileable leaf-gap mask (R: sunlight transmittance, G: occlusion) and a mist noise tile. */
export function createCanopy(scene,sun,{width=72,height=17}={}){
 let seed=9127;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const N=512;
 // Value-noise field in a tileable lattice, evaluated on the CPU once.
 const lattice=(n)=>{const g=new Float32Array(n*n);for(let i=0;i<g.length;i++)g[i]=rand();return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),at=(a,b)=>g[((b%n+n)%n)*n+((a%n+n)%n)];return (at(xi,yi)*(1-sx)+at(xi+1,yi)*sx)*(1-sy)+(at(xi,yi+1)*(1-sx)+at(xi+1,yi+1)*sx)*sy;};};
 const octaves=[lattice(6),lattice(12),lattice(24),lattice(48),lattice(96)],weights=[.42,.34,.3,.22,.12];
 const mask=canvas(N,(c)=>{
  const img=c.createImageData(N,N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   const u=x/N,v=y/N;let f=0,sum=0;octaves.forEach((o,k)=>{const s=[6,12,24,48,96][k];f+=weights[k]*o(u*s,v*s);sum+=weights[k];});f/=sum;
   // The road corridor (centre column of the tile in x) is more open to the sky.
   const road=Math.exp(-((((u-.5)*width)/5.5)**2)),verge=Math.exp(-((((u-.5)*width)/14)**2));
   const open=f+road*.16+verge*.06;
   const t=Math.min(1,Math.max(0,(open-.545)/.07));const s=t*t*(3-2*t);
   const i=(y*N+x)*4;img.data[i]=s*255;img.data[i+1]=(1-s)*255;img.data[i+2]=0;img.data[i+3]=255;
  }
  c.putImageData(img,0,0);
 });
 const texture=new T.CanvasTexture(mask);texture.colorSpace=T.NoColorSpace;texture.wrapS=T.ClampToEdgeWrapping;texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;
 const noiseOct=[lattice(8),lattice(16),lattice(32)];
 const noise=new T.CanvasTexture(canvas(128,(c)=>{const img=c.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const u=x/128,v=y/128,f=noiseOct[0](u*8,v*8)*.55+noiseOct[1](u*16,v*16)*.3+noiseOct[2](u*32,v*32)*.15,i=(y*128+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=f*255;img.data[i+3]=255;}c.putImageData(img,0,0);}));
 noise.colorSpace=T.NoColorSpace;noise.wrapS=noise.wrapT=T.RepeatWrapping;
 // Shadow-only caster. three filters shadow casters by the *main* camera's
 // layers, so it stays on layer 0 and is hidden by writing no colour/depth.
 const geometry=new T.PlaneGeometry(width,150,1,1);geometry.rotateX(-Math.PI/2);
 const pos=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/width+.5,(pos.getZ(i)+12)/width);
 // The caster scrolls the shared mask through its uv transform; the post and
 // mote shaders sample it raw with their own scroll uniform.
 const alpha=texture;
 const caster=new T.Mesh(geometry,new T.MeshBasicMaterial({alphaMap:alpha,alphaTest:.5,side:T.DoubleSide,colorWrite:false,depthWrite:false}));
 // Shift the caster so the open road corridor in the mask lands on the road after projection along the sun.
 const offset=new T.Vector2(SUN_DIRECTION.x/SUN_DIRECTION.y*height,SUN_DIRECTION.z/SUN_DIRECTION.y*height);
 caster.position.set(offset.x,height,12+offset.y);caster.castShadow=true;caster.receiveShadow=false;caster.renderOrder=-20;caster.name='Canopy shadow caster';scene.add(caster);
 const api={texture,noise,caster,height,offset,scale:width,scroll:0,
  reset(){api.scroll=0;texture.offset.y=0;},
  update(dt,speed){api.scroll+=speed*dt;texture.offset.y=-(api.scroll%width)/width;},
  set enabled(v){caster.visible=v;}};
 return api;
}
