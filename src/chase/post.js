import * as T from 'three';
// HDR frame pipeline: MSAA scene target -> ray-marched sun scattering ->
// dual-filter bloom -> filmic tone map, grade and lens finish. Direct
// renderer.render() calls elsewhere (verification masks, reflections) are
// unaffected; only the frame loop routes through this composer.

const triangle=new T.BufferGeometry();
triangle.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
triangle.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
const VERTEX='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
function pass(fragmentShader,uniforms,extra={}){
 const material=new T.ShaderMaterial({vertexShader:VERTEX,fragmentShader,uniforms,depthTest:false,depthWrite:false,toneMapped:false,...extra});
 const mesh=new T.Mesh(triangle,material);mesh.frustumCulled=false;return mesh;
}
const HASH=`
 float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
 float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
`;

export function createPost(renderer){
 const gl=renderer.getContext();
 const supported=renderer.capabilities.isWebGL2&&(renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float'));
 const hdr={type:T.HalfFloatType,format:T.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter,generateMipmaps:false};
 const depthTexture=new T.DepthTexture(1,1,T.FloatType);
 const sceneTarget=new T.WebGLRenderTarget(1,1,{...hdr,depthBuffer:true,depthTexture,samples:4});
 const volTarget=new T.WebGLRenderTarget(1,1,hdr),volBlur=new T.WebGLRenderTarget(1,1,hdr);
 let mips=[];
 const size=new T.Vector2(),drawing=new T.Vector2();
 const settings={scale:1,msaa:4,bloomLevels:6,volumetric:{steps:18,resolution:.5},grain:.035};

 // ---- Ray-marched sun scattering through the canopy -----------------------
 const volUniforms={
  tDepth:{value:depthTexture},tShadow:{value:null},tCanopy:{value:null},tNoise:{value:null},
  shadowMatrix:{value:new T.Matrix4()},hasShadow:{value:0},projInv:{value:new T.Matrix4()},camWorld:{value:new T.Matrix4()},camPos:{value:new T.Vector3()},
  sunDir:{value:new T.Vector3(0,1,0)},sunColor:{value:new T.Color(1,.85,.6)},canopyOffset:{value:new T.Vector2()},canopyHeight:{value:17},canopyScale:{value:34},canopyScroll:{value:0},
  density:{value:.0085},heightFalloff:{value:.085},maxDistance:{value:78},anisotropy:{value:.45},time:{value:0},frame:{value:0}
 };
 const volumetric=pass(`
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tDepth,tShadow,tCanopy,tNoise;uniform mat4 shadowMatrix,projInv,camWorld;uniform vec3 camPos,sunDir,sunColor;uniform vec2 canopyOffset;
  uniform float hasShadow,canopyHeight,canopyScale,canopyScroll,density,heightFalloff,maxDistance,anisotropy,time,frame;
  ${HASH}
  float canopy(vec3 p){
   if(p.y>=canopyHeight)return 1.;
   vec2 q=p.xz+sunDir.xz*(canopyHeight-p.y)/max(sunDir.y,.2);
   q-=canopyOffset;return texture2D(tCanopy,vec2(q.x/canopyScale+.5,(q.y-canopyScroll)/canopyScale)).r;
  }
  float sun(vec3 p){
   float open=canopy(p);
   if(hasShadow<.5)return open;
   vec4 s=shadowMatrix*vec4(p,1.);s.xyz/=s.w;
   vec3 e=min(s.xyz,1.-s.xyz);float inside=smoothstep(0.,.06,min(min(e.x,e.y),e.z));
   if(inside<=0.)return open;
   float lit=step(s.z-.0015,unpackRGBAToDepth(texture2D(tShadow,s.xy)));
   return mix(open,lit,inside);
  }
  void main(){
   float depth=texture2D(tDepth,vUv).x;
   vec4 view=projInv*vec4(vUv*2.-1.,depth*2.-1.,1.);view/=view.w;
   vec3 world=(camWorld*vec4(view.xyz,1.)).xyz,ray=world-camPos;
   float dist=length(ray);vec3 dir=ray/max(dist,1e-4);
   float end=min(dist,maxDistance),stepLength=end/float(STEPS);
   float jitter=ign(gl_FragCoord.xy+mod(frame,64.)*vec2(5.588,3.137));
   float c=dot(dir,sunDir),g=anisotropy;
   float hg=(1.-g*g)/(12.566*pow(1.+g*g-2.*g*c,1.5));
   float phase=mix(.0796,hg,.82)*4.;
   float lit=0.,transmit=1.;
   for(int i=0;i<STEPS;i++){
    float t=(float(i)+jitter)*stepLength;vec3 p=camPos+dir*t;
    float mist=texture2D(tNoise,p.xz*.021+vec2(time*.006,time*.011)).r*.65+texture2D(tNoise,p.zy*.043-vec2(time*.013,0.)).r*.35;
    float d=density*exp(-max(p.y,0.)*heightFalloff)*(.35+1.3*mist);
    lit+=transmit*d*sun(p)*stepLength;transmit*=exp(-d*stepLength*.35);
   }
   gl_FragColor=vec4(sunColor*phase*lit,1.);
  }`,volUniforms,{defines:{STEPS:18}});
 const blurUniforms={tInput:{value:null},texel:{value:new T.Vector2()}};
 const blur=pass(`varying vec2 vUv;uniform sampler2D tInput;uniform vec2 texel;
  void main(){vec2 o=texel*1.5;gl_FragColor=vec4((texture2D(tInput,vUv).rgb*2.+texture2D(tInput,vUv+vec2(o.x,o.y)).rgb+texture2D(tInput,vUv+vec2(-o.x,o.y)).rgb+texture2D(tInput,vUv+vec2(o.x,-o.y)).rgb+texture2D(tInput,vUv-o).rgb)/6.,1.);}`,blurUniforms);

 // ---- Bloom: 13-tap downsample with Karis average, 9-tap tent upsample ------
 const downUniforms={tInput:{value:null},texel:{value:new T.Vector2()},prefilter:{value:0},threshold:{value:1.15},knee:{value:.6}};
 const down=pass(`varying vec2 vUv;uniform sampler2D tInput;uniform vec2 texel;uniform float prefilter,threshold,knee;
  vec3 s(vec2 o){return texture2D(tInput,vUv+o*texel).rgb;}
  float w(vec3 c){return 1./(1.+max(c.r,max(c.g,c.b)));}
  void main(){
   vec3 a=s(vec2(-2,2)),b=s(vec2(0,2)),c=s(vec2(2,2)),d=s(vec2(-2,0)),e=s(vec2(0)),f=s(vec2(2,0)),g=s(vec2(-2,-2)),h=s(vec2(0,-2)),i=s(vec2(2,-2)),j=s(vec2(-1,1)),k=s(vec2(1,1)),l=s(vec2(-1,-1)),m=s(vec2(1,-1));
   vec3 color;
   if(prefilter>.5){
    vec3 g0=(j+k+l+m)*.25,g1=(a+b+d+e)*.25,g2=(b+c+e+f)*.25,g3=(d+e+g+h)*.25,g4=(e+f+h+i)*.25;
    float w0=w(g0)*.5,w1=w(g1)*.125,w2=w(g2)*.125,w3=w(g3)*.125,w4=w(g4)*.125;
    color=(g0*w0+g1*w1+g2*w2+g3*w3+g4*w4)/(w0+w1+w2+w3+w4);
    float br=max(color.r,max(color.g,color.b)),soft=clamp(br-threshold+knee,0.,2.*knee);soft=soft*soft/(4.*knee+1e-4);
    color*=max(soft,br-threshold)/max(br,1e-4);
   }else color=e*.125+(a+c+g+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125;
   gl_FragColor=vec4(min(color,vec3(64.)),1.);
  }`,downUniforms);
 const upUniforms={tInput:{value:null},texel:{value:new T.Vector2()},radius:{value:1}};
 const up=pass(`varying vec2 vUv;uniform sampler2D tInput;uniform vec2 texel;uniform float radius;
  vec3 s(vec2 o){return texture2D(tInput,vUv+o*texel*radius).rgb;}
  void main(){gl_FragColor=vec4((s(vec2(-1,1))+s(vec2(1,1))+s(vec2(-1,-1))+s(vec2(1,-1))+2.*(s(vec2(0,1))+s(vec2(0,-1))+s(vec2(-1,0))+s(vec2(1,0)))+4.*s(vec2(0)))/16.,1.);}`,
  upUniforms,{blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendEquation:T.AddEquation});

 // ---- Final: tone map, grade, lens finish -----------------------------------
 const finalUniforms={
  tScene:{value:null},tBloom:{value:null},tVol:{value:null},texel:{value:new T.Vector2()},resolution:{value:new T.Vector2()},
  bloomStrength:{value:.07},volStrength:{value:1},exposure:{value:1.14},time:{value:0},vignette:{value:.36},grain:{value:.035},aberration:{value:.0016},sharpen:{value:0},
  contrast:{value:.2},saturation:{value:1.1},shadowTint:{value:new T.Color(.92,1.01,1.04)},highlightTint:{value:new T.Color(1.05,1.0,.9)},lift:{value:.005},
  flash:{value:new T.Color(0,0,0)}
 };
 const final=pass(`varying vec2 vUv;
  uniform sampler2D tScene,tBloom,tVol;uniform vec2 texel,resolution;
  uniform float bloomStrength,volStrength,exposure,time,vignette,grain,aberration,sharpen,contrast,saturation,lift;uniform vec3 shadowTint,highlightTint,flash;
  ${HASH}
  vec3 rrt(vec3 v){vec3 a=v*(v+.0245786)-.000090537,b=v*(.983729*v+.4329510)+.238081;return a/b;}
  vec3 aces(vec3 c){
   const mat3 i=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
   const mat3 o=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
   return clamp(o*rrt(i*(c/.6)),0.,1.);
  }
  vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
  void main(){
   vec2 cc=vUv-.5;float r2=dot(cc,cc);
   vec2 off=cc*aberration*(.35+r2*2.);
   vec3 color=vec3(texture2D(tScene,vUv-off).r,texture2D(tScene,vUv).g,texture2D(tScene,vUv+off).b);
   if(sharpen>0.){
    vec3 n=texture2D(tScene,vUv+vec2(texel.x,0.)).rgb+texture2D(tScene,vUv-vec2(texel.x,0.)).rgb+texture2D(tScene,vUv+vec2(0.,texel.y)).rgb+texture2D(tScene,vUv-vec2(0.,texel.y)).rgb;
    color=max(color+(color*4.-n)*sharpen*.25,vec3(0.));
   }
   color+=texture2D(tBloom,vUv).rgb*bloomStrength+texture2D(tVol,vUv).rgb*volStrength+flash;
   color=aces(color*exposure);
   float luma=dot(color,vec3(.2126,.7152,.0722));
   color=mix(vec3(luma),color,saturation);
   color*=mix(shadowTint,highlightTint,smoothstep(.05,.75,luma));
   color=mix(color,color*color*(3.-2.*color),contrast);
   color=color*(1.-lift)+lift*vec3(.9,1.,1.03);
   float aspect=resolution.x/resolution.y;vec2 vc=cc*vec2(mix(1.,aspect,.55),1.);
   color*=mix(1.,smoothstep(.98,.18,length(vc)*1.18),vignette);
   color=srgb(clamp(color,0.,1.));
   float n=hash12(vUv*resolution+fract(time*7.31)*vec2(311.,173.))-.5;
   color+=n*grain*(1.-abs(luma*2.-1.)*.55);
   color+=(ign(gl_FragCoord.xy)-.5)/255.;
   gl_FragColor=vec4(color,1.);
  }`,finalUniforms);

 function makeMips(){
  for(const m of mips)m.dispose();mips=[];
  let w=Math.max(1,size.x>>1),h=Math.max(1,size.y>>1);
  for(let i=0;i<settings.bloomLevels;i++){mips.push(new T.WebGLRenderTarget(w,h,hdr));w=Math.max(1,w>>1);h=Math.max(1,h>>1);}
 }
 function resize(){
  renderer.getDrawingBufferSize(drawing);
  const w=Math.max(2,Math.round(drawing.x*settings.scale)),h=Math.max(2,Math.round(drawing.y*settings.scale));
  if(size.x===w&&size.y===h&&mips.length===settings.bloomLevels)return;
  size.set(w,h);sceneTarget.setSize(w,h);
  const vr=settings.volumetric?.resolution||.25;volTarget.setSize(Math.max(1,Math.round(w*vr)),Math.max(1,Math.round(h*vr)));volBlur.setSize(volTarget.width,volTarget.height);
  makeMips();
 }
 function configure(next){
  Object.assign(settings,next);
  if(sceneTarget.samples!==settings.msaa){sceneTarget.samples=settings.msaa;sceneTarget.dispose();}
  const steps=settings.volumetric?.steps||0;if(steps&&volumetric.material.defines.STEPS!==steps){volumetric.material.defines.STEPS=steps;volumetric.material.needsUpdate=true;}
  size.set(0,0);resize();
 }
 const black=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;
 let frame=0;
 function draw(mesh,target){renderer.setRenderTarget(target);renderer.render(mesh,camera);}
 return{
  get supported(){return supported;},settings,final:finalUniforms,volume:volUniforms,sceneTarget,
  configure,resize,
  render(scene,cam,{time=0,sun=null,canopy=null}={}){
   resize();frame++;
   const oldTarget=renderer.getRenderTarget(),oldAutoClear=renderer.autoClear;renderer.autoClear=true;
   renderer.setRenderTarget(sceneTarget);renderer.render(scene,cam);
   // Scattering
   let volTexture=black;
   if(settings.volumetric&&sun&&canopy){
    const u=volUniforms;u.projInv.value.copy(cam.projectionMatrixInverse);u.camWorld.value.copy(cam.matrixWorld);u.camPos.value.setFromMatrixPosition(cam.matrixWorld);
    u.hasShadow.value=sun.castShadow&&sun.shadow.map?1:0;if(u.hasShadow.value){u.tShadow.value=sun.shadow.map.texture;u.shadowMatrix.value.copy(sun.shadow.matrix);}
    u.sunDir.value.subVectors(sun.position,sun.target.position).normalize();u.tCanopy.value=canopy.texture;u.tNoise.value=canopy.noise;u.canopyScroll.value=canopy.scroll%canopy.scale;u.canopyOffset.value.copy(canopy.offset);u.canopyHeight.value=canopy.height;u.canopyScale.value=canopy.scale;
    u.time.value=time;u.frame.value=frame;
    draw(volumetric,volTarget);
    blurUniforms.tInput.value=volTarget.texture;blurUniforms.texel.value.set(1/volTarget.width,1/volTarget.height);draw(blur,volBlur);
    volTexture=volBlur.texture;
   }
   // Bloom
   let input=sceneTarget.texture,iw=size.x,ih=size.y;
   for(let i=0;i<mips.length;i++){downUniforms.tInput.value=input;downUniforms.texel.value.set(1/iw,1/ih);downUniforms.prefilter.value=i===0?1:0;draw(down,mips[i]);input=mips[i].texture;iw=mips[i].width;ih=mips[i].height;}
   renderer.autoClear=false;
   for(let i=mips.length-1;i>0;i--){upUniforms.tInput.value=mips[i].texture;upUniforms.texel.value.set(1/mips[i].width,1/mips[i].height);draw(up,mips[i-1]);}
   renderer.autoClear=true;
   const f=finalUniforms;f.tScene.value=sceneTarget.texture;f.tBloom.value=mips[0]?.texture||black;f.tVol.value=volTexture;f.texel.value.set(1/size.x,1/size.y);f.resolution.value.copy(drawing);f.time.value=time;f.sharpen.value=settings.scale<.97?.55*(1-settings.scale)/.4+.12:0;
   draw(final,oldTarget);
   renderer.autoClear=oldAutoClear;
  },
  dispose(){sceneTarget.dispose();volTarget.dispose();volBlur.dispose();mips.forEach(m=>m.dispose());}
 };
}
