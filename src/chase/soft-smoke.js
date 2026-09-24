import * as T from 'three';
// Soft smoke: dust puffs, muzzle haze, blast smoke, blood and breath mist. Instanced
// billboards drawn by post.js into their own half-resolution buffer, where they can
// read the resolved scene depth and fade into the ground, the Rex and the Jeep
// instead of cutting flat sprite edges. Each puff is a noise-lumped sphere lit by the
// sun (wrapped, self-shadowed through dense cores) and fogged like the scene; the
// noise scrolls and turns with age so smoke rolls as it rises.
const VERTEX=`
 attribute vec4 iPos,iCol,iMisc;uniform vec3 sunDir;
 varying vec2 vUv,vQ;varying vec4 vCol;varying float vViewZ,vSeed,vAge,vLit,vWorldY,vSize;varying vec3 vSun;
 void main(){
  float c=cos(iMisc.x),s=sin(iMisc.x);vec2 q=vec2(c*position.x-s*position.y,s*position.x+c*position.y);
  vec4 mv=viewMatrix*vec4(iPos.xyz,1.);mv.xy+=q*iPos.w;
  vUv=position.xy*2.;vQ=q*2.;vViewZ=mv.z;vCol=iCol;vSeed=iMisc.y;vAge=iMisc.z;vLit=iMisc.w;vSize=iPos.w;
  vSun=normalize((viewMatrix*vec4(sunDir,0.)).xyz);
  vWorldY=iPos.y+(transpose(mat3(viewMatrix))*vec3(q*iPos.w,0.)).y;
  gl_Position=projectionMatrix*mv;
 }`;
const FRAGMENT=`
 #include <packing>
 uniform sampler2D tDepth;uniform float hasDepth,cameraNear,cameraFar,fogDensity;uniform vec2 resolution;uniform vec3 sunColor,ambient,fogColor;
 varying vec2 vUv,vQ;varying vec4 vCol;varying float vViewZ,vSeed,vAge,vLit,vWorldY,vSize;varying vec3 vSun;
 float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 float fbm(vec2 p){return noise(p)*.55+noise(p*2.03+7.1)*.3+noise(p*4.07+2.3)*.15;}
 void main(){
  float r=length(vUv);if(r>1.)discard;
  // Billow: the lumps grow outward and turn as the puff ages.
  float t=vAge*1.6,ca=cos(t*.7),sa=sin(t*.7);vec2 p=mat2(ca,-sa,sa,ca)*vUv*(1.35-vAge*.35)+vSeed*37.;
  float n=fbm(p+vec2(0.,-t)),n2=fbm(p*1.9+vec2(t*.5,3.));
  float body=smoothstep(1.,.2,r+(n-.5)*.8);
  float a=min(1.,body*vCol.a*(.6+.7*n2));if(a<.003)discard;
  vec3 N=normalize(vec3(vQ*.9+(vec2(n,n2)-.5)*.9,sqrt(max(0.,1.-r*r))+.25));
  float wrap=clamp(dot(N,vSun)*.6+.4,0.,1.),core=body*n;
  vec3 light=ambient+sunColor*wrap*(1.-core*.45);
  vec3 col=vCol.rgb*mix(vec3(1.),light,vLit);
  float dist=-vViewZ;col=mix(col,fogColor,1.-exp(-fogDensity*fogDensity*dist*dist));
  float fade=smoothstep(.25,1.4,dist);
  if(hasDepth>.5){float scene=perspectiveDepthToViewZ(texture2D(tDepth,gl_FragCoord.xy/resolution).x,cameraNear,cameraFar);fade*=clamp((vViewZ-scene)/(.3+vSize*.22),0.,1.);}
  else fade*=smoothstep(0.,.3*vSize,vWorldY);
  a*=fade;
  gl_FragColor=vec4(col*a,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
export function createSoftSmoke(capacity=96){
 const geo=new T.InstancedBufferGeometry(),quad=new T.PlaneGeometry(1,1);geo.index=quad.index;geo.setAttribute('position',quad.attributes.position);
 const attr=k=>{const a=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4);a.setUsage(T.DynamicDrawUsage);geo.setAttribute(k,a);return a;};
 const iPos=attr('iPos'),iCol=attr('iCol'),iMisc=attr('iMisc');geo.instanceCount=0;
 const uniforms={tDepth:{value:null},hasDepth:{value:0},resolution:{value:new T.Vector2(1,1)},cameraNear:{value:.1},cameraFar:{value:1000},sunDir:{value:new T.Vector3(0,1,0)},sunColor:{value:new T.Color(1,1,1)},ambient:{value:new T.Color(.3,.3,.3)},fogColor:{value:new T.Color()},fogDensity:{value:0}};
 const material=new T.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,
  blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,blendSrcAlpha:T.OneFactor,blendDstAlpha:T.OneMinusSrcAlphaFactor});
 const mesh=new T.Mesh(geo,material);mesh.frustumCulled=false;const scene=new T.Scene();scene.add(mesh);
 const pools=[],alive=[],eye=new T.Vector3(),tmp=new T.Color();
 return{scene,uniforms,
  /** Particles share the sprite-pool fields effects.js already uses; `lit` 0..1 blends in the sun. */
  pool(n,color,lit=1){const p=Array.from({length:n},()=>({soft:true,pos:new T.Vector3(),life:0,max:1,velocity:new T.Vector3(),size:1,growth:1,opacity:1,spin:0,rot:0,ground:false,hdr:1,rise:0,drag:1.1,seed:0,base:new T.Color(color),lit,alpha:0,now:1,dist:0}));pools.push(p);return p;},
  update(dt,roadSpeed){
   for(const pool of pools)for(const d of pool){
    if(d.life<=0)continue;d.life=Math.max(0,d.life-dt);if(d.life<=0)continue;const age=1-d.life/d.max;
    d.velocity.multiplyScalar(Math.exp(-dt*d.drag));d.velocity.y+=d.rise*dt;d.pos.addScaledVector(d.velocity,dt);if(d.ground)d.pos.z+=roadSpeed*dt;d.rot+=d.spin*dt;
    d.now=d.size+d.growth*Math.pow(age,.55);d.alpha=d.opacity*Math.min(1,age/.08)*Math.pow(1-age,1.4);
   }
  },
  /** Scene lighting and fog, read once per frame after the weather has set them. */
  light(sun,hemi,fog){
   uniforms.sunDir.value.subVectors(sun.position,sun.target.position).normalize();uniforms.sunColor.value.copy(sun.color).multiplyScalar(sun.intensity/Math.PI);
   uniforms.ambient.value.copy(hemi.color).multiplyScalar(.6).add(tmp.copy(hemi.groundColor).multiplyScalar(.4)).multiplyScalar(hemi.intensity*1.15);
   if(fog){uniforms.fogColor.value.copy(fog.color);uniforms.ambient.value.add(tmp.copy(fog.color).multiplyScalar(.25));uniforms.fogDensity.value=fog.density||0;}
  },
  /** Draw into the bound target. `depth` is the resolved scene depth, or null to fall back to a ground fade. */
  render(renderer,camera,depth,width,height){
   camera.getWorldPosition(eye);alive.length=0;
   for(const pool of pools)for(const d of pool)if(d.life>0&&d.alpha>.002){d.dist=d.pos.distanceToSquared(eye);alive.push(d);}
   if(!alive.length)return;
   alive.sort((a,b)=>b.dist-a.dist);const n=Math.min(capacity,alive.length);
   for(let i=0;i<n;i++){const d=alive[i];iPos.setXYZW(i,d.pos.x,d.pos.y,d.pos.z,d.now);iCol.setXYZW(i,d.base.r*d.hdr,d.base.g*d.hdr,d.base.b*d.hdr,d.alpha);iMisc.setXYZW(i,d.rot,d.seed,1-d.life/d.max,d.lit);}
   iPos.needsUpdate=iCol.needsUpdate=iMisc.needsUpdate=true;geo.instanceCount=n;
   uniforms.tDepth.value=depth;uniforms.hasDepth.value=depth?1:0;uniforms.resolution.value.set(width,height);uniforms.cameraNear.value=camera.near;uniforms.cameraFar.value=camera.far;
   // Straight to the canvas (no post) the scene's own depth buffer does the occlusion.
   material.depthTest=!depth;renderer.render(scene,camera);
  },
  reset(){for(const pool of pools)for(const d of pool)d.life=0;geo.instanceCount=0;}
 };
}
