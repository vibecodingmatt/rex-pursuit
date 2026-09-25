import * as T from 'three';
import {WET} from './weather-state.js';
// Hide finish for the hero Rex. Composed into ImpactDamage's onBeforeCompile so
// wounds, soot and blood still land on top of it. Everything is keyed to the
// rest-space skin (vImpactRest), so stripes, scales and mud ride the rig.
//
// Rest-space landmarks: y is height above the feet (~0-5.6), +z runs toward the
// snout (lips near z 6.8, y 3.6-4.1), the tail extends toward -z.

function scaleTexture(){
 // Two tileable Voronoi fields: R = fine pebbled scales, G = broad dorsal
 // plates, B = soft mottling. Cells wrap, so the tile repeats without seams.
 const N=512,out=new Uint8Array(N*N*4);let seed=1931;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const field=(cells)=>{
  const pts=new Float32Array(cells*cells*3),size=N/cells;
  for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){const k=(j*cells+i)*3;pts[k]=(i+.15+rand()*.7)*size;pts[k+1]=(j+.15+rand()*.7)*size;pts[k+2]=rand();}
  const values=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   const ci=Math.floor(x/size),cj=Math.floor(y/size);let f1=1e9,f2=1e9,h=0;
   for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
    const ii=(ci+di+cells)%cells,jj=(cj+dj+cells)%cells,k=(jj*cells+ii)*3;
    let px=pts[k]+(ci+di<0?-N:ci+di>=cells?N:0),py=pts[k+1]+(cj+dj<0?-N:cj+dj>=cells?N:0);
    const d=Math.hypot(px-x,py-y);if(d<f1){f2=f1;f1=d;h=pts[k+2];}else if(d<f2)f2=d;
   }
   const edge=Math.min(1,(f2-f1)/(size*.42)),dome=Math.sqrt(edge)*(1-.35*Math.pow(f1/(size*.8),2));
   values[y*N+x]=Math.max(0,Math.min(1,dome*(.72+.28*h)));
  }
  return values;
 };
 const fine=field(22),broad=field(7);
 for(let i=0;i<N*N;i++){out[i*4]=fine[i]*255;out[i*4+1]=broad[i]*255;out[i*4+2]=(fine[(i*7)%(N*N)]*.5+broad[(i*3)%(N*N)]*.5)*255;out[i*4+3]=255;}
 const t=new T.DataTexture(out,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;
}

/** Per-vertex gape weight: skin shared between the jaw and the skull stretches into the
 * mouth-corner membrane when she opens wide. 4·w·(1-w) peaks at an even split. */
export function markGape(mesh){
 const bones=mesh.skeleton.bones,jaw=new Set(),root=bones.find(b=>b.name.startsWith('jaw_01_'));root?.traverse(o=>{if(o.isBone)jaw.add(bones.indexOf(o));});
 const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,out=new Float32Array(si.count);
 for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++)if(jaw.has(si.getComponent(i,k)))w+=sw.getComponent(i,k);out[i]=Math.min(1,4*w*(1-w));}
 g.setAttribute('rexGape',new T.BufferAttribute(out,1));
}
export function createRexSkin(){
 // uRexFallMud: soil picked up in the victory fall (x jaw and throat, y chest and
 // belly, z tail) and how wet it is (w); written by skid.js.
 // uRexCoat, uRexSoak: mud and water gathered over the chase; written by rex-coat.js.
 //  coat x: splatter level (grows with every footfall), y: the level the river rinsed
 //  away, z: how high the rinse reached (rest-space m; 0 = never), w: how dry the mud is.
 //  soak x: river soak 0..1, y: how high it reached, z: runoff phase (0..1, wraps),
 //  w: rain soak (builds toward the storm's wetness).
 const uniforms={tRexScales:{value:scaleTexture()},uRexDetail:{value:1},uRexDebug:{value:0},uRexJaw:{value:0},uRexFallMud:{value:new T.Vector4()},
  uRexCoat:{value:new T.Vector4(.35,0,0,0)},uRexSoak:{value:new T.Vector4(0,0,0,WET.value*.8)}};
 function extend(s){
  Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRexNormal;attribute float rexGape;varying float vRexGape;')
   .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvRexNormal=objectNormal;vRexGape=rexGape;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vRexNormal;varying float vRexGape;uniform sampler2D tRexScales;uniform float uRexDetail,uRexDebug,uRexJaw;uniform vec4 uRexFallMud,uRexCoat,uRexSoak;
   float rexScaleH,rexMud,rexWet,rexMouth,rexCavity,rexSoak,rexStreak,rexFallMud;
   // Oral cavity in rest space: between the jaws around the off-centre midline
   // (x~.17), on surfaces that face into the mouth rather than out of the head.
   float rexMouthMask(vec3 p,vec3 n){
    float dx=p.x-.17,region=(1.-smoothstep(.5,.66,abs(dx)))*smoothstep(3.38,3.5,p.y)*(1.-smoothstep(4.02,4.16,p.y))*smoothstep(4.9,5.3,p.z)*(1.-smoothstep(6.86,7.,p.z));
    float inward=smoothstep(.05,.35,-n.x*sign(dx));
    float palate=smoothstep(.2,.5,-n.y)*smoothstep(3.72,3.82,p.y),floor_=smoothstep(.2,.5,n.y)*(1.-smoothstep(3.74,3.84,p.y));
    return region*clamp(max(inward,max(palate,floor_)),0.,1.);
   }
   float rexHash(vec3 p){return fract(sin(dot(p,vec3(41.3,289.1,117.7)))*43758.5453);}
   float rexNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(rexHash(i),rexHash(i+vec3(1,0,0)),f.x),mix(rexHash(i+vec3(0,1,0)),rexHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rexHash(i+vec3(0,0,1)),rexHash(i+vec3(1,0,1)),f.x),mix(rexHash(i+vec3(0,1,1)),rexHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   // Sin-free value noise for the mud and water detail: phone GPUs lose precision in
   // fract(sin(x)*big) at these frequencies and draw lines (see the rendering reference).
   float rexHashS(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
   float rexNoiseS(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(rexHashS(i),rexHashS(i+vec3(1,0,0)),f.x),mix(rexHashS(i+vec3(0,1,0)),rexHashS(i+vec3(1,1,0)),f.x),f.y),mix(mix(rexHashS(i+vec3(0,0,1)),rexHashS(i+vec3(1,0,1)),f.x),mix(rexHashS(i+vec3(0,1,1)),rexHashS(i+vec3(1,1,1)),f.x),f.y),f.z);}
   vec3 rexTri(vec3 p,vec3 n,float k){
    vec3 w=pow(abs(n),vec3(4.));w/=w.x+w.y+w.z;
    return texture2D(tRexScales,p.zy*k).rgb*w.x+texture2D(tRexScales,p.xz*k).rgb*w.y+texture2D(tRexScales,p.xy*k).rgb*w.z;
   }
   vec3 rexBump(vec3 pos,vec3 n,float h,float strength,float face){
    vec3 sx=dFdx(pos),sy=dFdy(pos),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1)*face;
    vec2 d=vec2(dFdx(h),dFdy(h))*strength;vec3 g=sign(det)*(d.x*r1+d.y*r2);
    return normalize(abs(det)*n-g);
   }`)
  .replace('#include <color_fragment>',`#include <color_fragment>
   {
    vec3 p=vImpactRest,rn=normalize(vRexNormal);
    // Scale size varies: fine on the face and limbs, larger across the back.
    float head=smoothstep(4.6,5.8,p.z);
    vec3 sc=rexTri(p,rn,mix(2.4,3.4,head));vec3 plates=rexTri(p,rn,.72);
    rexScaleH=mix(plates.g,sc.r,.62);
    float big=rexNoise(p*.9),mid=rexNoise(p*3.1+7.),speck=rexNoise(p*14.+3.);
    float dorsal=smoothstep(.12,.85,rn.y),ventral=smoothstep(-.08,-.72,rn.y);
    vec3 c=diffuseColor.rgb;float lum=dot(c,vec3(.2126,.7152,.0722));
    // Earthen regrade of the painted orange-brown.
    c=mix(vec3(lum),c,.92)*vec3(1.16,1.04,.9);
    vec3 back=c*vec3(.8,.76,.68),belly=mix(c,vec3(lum)*vec3(1.6,1.38,1.08),.6);
    c=mix(c,back,dorsal*.52);c=mix(c,belly,ventral*.82);
    // Broken dorsal bands running across the back and down the tail.
    float band=smoothstep(.25,.9,sin(p.z*5.3+big*3.2+p.y*.6))*dorsal*smoothstep(.3,.7,mid);
    c*=1.-band*.26;
    c*=.9+.2*big;c*=1.-smoothstep(.72,.9,speck)*.14*(1.-ventral);
    // Muzzle and brow a touch darker; pale lower jaw.
    c*=1.-.1*head*dorsal;
    // River water on the hide (uRexSoak.xy): soaked up to the line the spray reached, a
    // line that sinks toward the feet as she dries; spray spots above it.
    float line=mix(.55,uRexSoak.y,uRexSoak.x);
    float fordWet=uRexSoak.x*(1.-smoothstep(line-.35,line+.15,p.y+(big-.5)*.6));
    fordWet=max(fordWet,uRexSoak.x*smoothstep(.78,.9,rexNoiseS(p*9.+1.))*(1.-smoothstep(line,line+1.8,p.y))*.85);
    // Mud: caked on the feet and shins, and splatter that builds up through the chase
    // (uRexCoat.x). Every footfall flings more, so it climbs the legs, the belly and the
    // underside of the tail. The river rinsed off everything below the line it reached
    // (uRexCoat.yz); what lands afterwards shows on the clean hide.
    float wash=uRexCoat.z>0.?1.-smoothstep(uRexCoat.z-.35,uRexCoat.z+.25,p.y+(mid-.5)*.5):0.;
    float cake=(1.-smoothstep(.45+.5*mid,1.55+.6*big,p.y))*mix(1.,.12+.88*smoothstep(uRexCoat.y,uRexCoat.y+.35,uRexCoat.x),wash);
    float coat=max(0.,uRexCoat.x-uRexCoat.y*wash),under=smoothstep(.35,-.55,rn.y);
    // The flung mud climbs as she runs: shins first, then thighs and belly, and furthest
    // up the undersides (belly, tail) that face the spray; it thins out with height.
    float top=.9+1.5*coat+under*1.1*coat,dens=coat*(1.-smoothstep(top-.7,top+.3,p.y+(big-.5)*.5));
    // Many small splats and a few big ones, each trailing a drip (noise stretched vertically).
    float n1=rexNoiseS(vec3(p.x*23.,p.y*9.,p.z*23.)),n2=rexNoiseS(vec3(p.x*11.,p.y*4.5,p.z*11.)+5.),n3=rexNoiseS(p*48.+9.);
    float spl=max(max(smoothstep(1.-dens*.5,1.-dens*.5+.05,n1),smoothstep(1.-dens*.36,1.-dens*.36+.04,n2)),smoothstep(1.-dens*.45,1.-dens*.45+.06,n3)*.7);
    rexMud=clamp(max(cake,spl),0.,1.);
    // Fresh mud is dark and wet; on a dry day it dries to a lighter crust unless water reaches it.
    float crust=uRexCoat.w*(1.-max(uRexSoak.w,fordWet))*smoothstep(.2,.9,mid+.3);
    c=mix(c,mix(vec3(.075,.055,.038),vec3(.15,.118,.082),crust)*(.75+.5*mid),rexMud*.88);
    // Scale cavities read as fine occlusion.
    c*=mix(.8,1.05,rexScaleH);
    rexWet=(1.-smoothstep(0.,.14,abs(p.y-3.84)-.1))*smoothstep(6.2,6.7,p.z);
    // Mouth interior: wet, dark flesh that deepens toward the throat, with
    // faint palatal ridges; no hide grade, scales or mud inside the jaws.
    rexMouth=max(rexMouthMask(p,rn),smoothstep(.12,.55,vRexGape)*smoothstep(5.05,5.35,p.z)*smoothstep(3.34,3.46,p.y)*(1.-smoothstep(4.1,4.22,p.y)));
    rexMouth*=mix(.3,1.,smoothstep(.04,.35,uRexJaw));
    float depth=smoothstep(5.3,6.6,p.z),ridge=.5+.5*sin(p.z*46.+p.x*9.);
    vec3 flesh=mix(vec3(.05,.01,.012),vec3(.23,.035,.04),depth)*(.8+.35*mid)*(1.-.12*ridge*smoothstep(3.8,3.95,p.y));
    // Cavity occlusion: the jaws shade the interior, most deeply toward the throat.
    rexCavity=rexMouth*mix(.82,.55,depth);
    c=mix(c,flesh,rexMouth);rexScaleH=mix(rexScaleH,.85,rexMouth);rexMud*=1.-rexMouth;
    // Victory fall: soil ground into everything that met the road — the lower jaw
    // and throat, the chest and belly (bottom profile ~1.8+.12(z-1)^2), the tail's
    // underside — streaked along the slide, ragged at the edge, spattered above it.
    rexFallMud=0.;
    if(uRexFallMud.x+uRexFallMud.y+uRexFallMud.z>.002){
     float down=smoothstep(.2,-.5,rn.y),bottom=1.8+.12*(p.z-1.)*(p.z-1.);
     float jaw=smoothstep(4.7,5.2,p.z)*(1.-smoothstep(3.62,3.9,p.y))*(.45+.55*down);
     float throat=smoothstep(3.2,3.7,p.z)*(1.-smoothstep(4.7,5.1,p.z))*(1.-smoothstep(3.15,3.55,p.y))*(.5+.5*down);
     float body=smoothstep(-.9,-.3,p.z)*(1.-smoothstep(3.3,3.8,p.z))*(1.-smoothstep(bottom+.2,bottom+.55,p.y))*(.3+.7*down);
     float tail=(1.-smoothstep(-.7,-.1,p.z))*smoothstep(-.05,-.45,rn.y);
     float along=rexNoise(vec3(p.x*6.,p.y*6.,p.z*.8)),rag=rexNoise(p*4.3+5.);
     float m=max(uRexFallMud.x*max(jaw,throat),max(uRexFallMud.y*body,uRexFallMud.z*tail));
     rexFallMud=smoothstep(.3,.62,m*(.65+.7*along)+(rag-.5)*.4);
     rexFallMud=max(rexFallMud,smoothstep(.83,.9,rexNoise(p*11.+2.))*smoothstep(.05,.3,m)*.8);
     rexFallMud*=1.-rexMouth;
     vec3 caked=mix(vec3(.2,.155,.105)*(.8+.35*mid),vec3(.068,.05,.035)*(.75+.5*mid),uRexFallMud.w);
     c=mix(c,caked,rexFallMud*.92);
    }
    // Rain and river: the hide soaks darkest along the back where water sheets off, with
    // runoff rivulets (noise stretched vertically) and water held in the scale cavities.
    // The rivulets run down the hide: two copies of the pattern slide downward half a
    // cycle apart and cross-fade, so the phase stays bounded.
    float f0=uRexSoak.z,f1=fract(uRexSoak.z+.5),wf=abs(2.*f0-1.);
    float s0=rexNoise(vec3(p.x*6.,p.y*.7+f0*1.5,p.z*6.)+vec3(0.,big,0.)),s1=rexNoise(vec3(p.x*6.,p.y*.7+f1*1.5+3.1,p.z*6.)+vec3(0.,big,0.));
    rexStreak=smoothstep(.5,.85,mix(s0,s1,wf));
    rexSoak=max(uRexSoak.w*mix(.6,1.,dorsal)*(1.-ventral*.35),fordWet)*(1.-rexMouth);
    c*=1.-rexSoak*(.3+.12*rexStreak+.08*(1.-rexScaleH));
    if(uRexDebug>.5)c=mix(vec3(.02),vec3(1.,0.,0.),rexMouth);
    diffuseColor.rgb=c;
   }`)
  .replace('#include <normal_fragment_begin>',`
   roughnessFactor=mix(roughnessFactor,.5,rexWet*.7);
   roughnessFactor=mix(roughnessFactor,.46,rexMouth);
   roughnessFactor=mix(roughnessFactor,mix(mix(.52,.9,smoothstep(.2,1.4,vImpactRest.y)),.95,uRexCoat.w*(1.-rexSoak)),rexMud);
   roughnessFactor=mix(roughnessFactor,mix(.97,.3,uRexFallMud.w),rexFallMud);
   roughnessFactor+=(1.-rexScaleH)*.07;
   roughnessFactor=mix(roughnessFactor,max(roughnessFactor,.62),(1.-rexWet)*(1.-rexMouth));
   roughnessFactor=mix(roughnessFactor,mix(.36,.2,rexStreak)+(1.-rexScaleH)*.08,rexSoak);
   #include <normal_fragment_begin>
   vec3 rexBaseNormal=normal;`)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   {
    float fade=(1.-smoothstep(6.,26.,length(vViewPosition)))*uRexDetail;
    normal=normalize(mix(normal,rexBaseNormal,rexMouth*.85));
    if(fade>0.)normal=rexBump(-vViewPosition,normal,rexScaleH,.0022*fade*(1.-rexMud*.5)*(1.-rexFallMud*.6),faceDirection);
    // Specular anti-aliasing: widen highlights where micro-normals vary per pixel.
    vec3 dn=fwidth(normal);roughnessFactor=max(roughnessFactor,min(.95,.46+length(dn)*1.6));
   }`)
  .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   {
    #if NUM_DIR_LIGHTS>0
     vec3 L=directionalLights[0].direction;float nl=dot(normal,L),sh=1.;
     #if defined(USE_SHADOWMAP)&&NUM_DIR_LIGHT_SHADOWS>0
      sh=getShadow(directionalShadowMap[0],directionalLightShadows[0].shadowMapSize,directionalLightShadows[0].shadowIntensity,directionalLightShadows[0].shadowBias,directionalLightShadows[0].shadowRadius,vDirectionalShadowCoord[0]);
     #endif
     // Warm light bleeding past the terminator (thick, fleshy hide).
     reflectedLight.directDiffuse+=directionalLights[0].color*material.diffuseColor*max(nl,0.)*(1.-sh)*.42*RECIPROCAL_PI*(1.-rexMouth);
     float wrap=max(0.,(nl+.5)/1.5)-max(0.,nl);
     reflectedLight.directDiffuse+=directionalLights[0].color*material.diffuseColor*vec3(.6,.28,.16)*wrap*mix(.2,1.,sh)*.5*(1.-rexMouth);
    #endif
    // The cavity is shielded from the sky: occlude its ambient and reflections.
    reflectedLight.directDiffuse*=1.-rexCavity;
    reflectedLight.indirectDiffuse*=mix(1.,.45,rexMouth);reflectedLight.indirectSpecular*=mix(1.,.25,rexMouth);reflectedLight.directSpecular*=mix(mix(.4,1.,max(rexWet,rexSoak)),.1,rexMouth);
    float facing=saturate(dot(normal,geometryViewDir)),fres=pow(1.-facing,5.);
    // Sky rim separates the silhouette from the foliage; a soft camera-side
    // fill keeps the face readable when she is backlit by the canopy gaps.
    reflectedLight.indirectSpecular+=vec3(.2,.24,.23)*fres*saturate(normal.y*.6+.4)*(1.-rexMud*.5)*(1.-rexMouth)*(.14+.32*rexSoak);
    reflectedLight.indirectDiffuse+=material.diffuseColor*vec3(.58,.62,.55)*facing*.55*(1.-.5*rexMouth);
   }`);
 }
 return{uniforms,extend,key:'rex-hide-v7'};
}

/** Wet, ivory teeth with darker roots; a clear specular cornea. */
export function finishRexDetails(meshes,gazeUniforms){
 for(const mesh of meshes){
  const name=mesh.name,mat=mesh.material;
  if(/^Teeth/.test(name)){
   mesh.material=mat.clone();const m=mesh.material;m.color.setRGB(.93,.86,.72);m.roughness=.36;m.envMapIntensity=.8;
   m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying float vToothY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvToothY=position.y;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vToothY;').replace('#include <color_fragment>',`#include <color_fragment>
     // Stained roots at the gum line, cleaner enamel toward the tips.
     float root=${name.includes('Up')?'smoothstep(3.9,4.12,vToothY)':'1.-smoothstep(3.56,3.74,vToothY)'};
     diffuseColor.rgb*=mix(vec3(1.),vec3(.52,.32,.24),root);`);};
   m.customProgramCacheKey=()=>`rex-teeth-${name}`;
  }
  if(name==='Rex_Cornea'){
   // Only the reflection: sky and sun glints over the iris, no milky film.
   mesh.material=new T.MeshStandardMaterial({color:0x000000,roughness:.05,metalness:0,transparent:true,blending:T.AdditiveBlending,depthWrite:false,envMapIntensity:2.2});
   mesh.material.onBeforeCompile=s=>{s.uniforms.rexBlink=gazeUniforms.blink;s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float rexBlink;').replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.rgb*=1.-rexBlink;');};
   mesh.material.customProgramCacheKey=()=> 'rex-cornea-v2';
  }
 }
}
