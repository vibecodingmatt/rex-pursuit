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
 float bayer2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
 float bayer4(vec2 a){return bayer2(.5*a)*.25+bayer2(a);}
`;
/** Scene alpha as an occlusion mask while the frame renders: leaf cards write a low
 * value so their swaying, alpha-tested edges neither cast nor receive much AO. */
export const AO_MASK={value:0};

export function createPost(renderer){
 const gl=renderer.getContext();
 const supported=renderer.capabilities.isWebGL2&&(renderer.extensions.has('EXT_color_buffer_float')||renderer.extensions.has('EXT_color_buffer_half_float'));
 const hdr={type:T.HalfFloatType,format:T.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter,generateMipmaps:false};
 const depthTexture=new T.DepthTexture(1,1,T.FloatType);
 const sceneTarget=new T.WebGLRenderTarget(1,1,{...hdr,depthBuffer:true,depthTexture,samples:4});
 const volTarget=new T.WebGLRenderTarget(1,1,hdr),volBlur=new T.WebGLRenderTarget(1,1,hdr),smokeTarget=new T.WebGLRenderTarget(1,1,hdr);
 // With WEBGL_multisampled_render_to_texture the depth texture is the live attachment,
 // so only read it for soft particles when three resolves MSAA by blit.
 const depthReadable=()=>sceneTarget.samples>0&&!renderer.extensions.has('WEBGL_multisampled_render_to_texture');
 let mips=[];
 const size=new T.Vector2(),drawing=new T.Vector2();
 const settings={scale:1,msaa:4,bloomLevels:6,volumetric:{steps:18,resolution:.5},grain:.035,motionBlur:1,smokeResolution:.5,ao:{samples:8,steps:8},aoAmount:1};
 const halfFloat={type:T.HalfFloatType,format:T.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter,generateMipmaps:false};
 const aoPrepTarget=new T.WebGLRenderTarget(1,1,halfFloat),aoTarget=new T.WebGLRenderTarget(1,1,halfFloat),aoBlurTarget=new T.WebGLRenderTarget(1,1,halfFloat);

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

 // ---- Grounding: ambient occlusion and sun contact shadows at half resolution --
 // Linear depth and the leaf mask are gathered once; AO and a short march toward
 // the sun share them. The noise is a fixed 4x4 Bayer tile that the 4x4 bilateral
 // blur removes exactly, so nothing changes from frame to frame and nothing shimmers.
 const aoPrepUniforms={tDepth:{value:depthTexture},tScene:{value:null},near:{value:.1},far:{value:100}};
 const aoPrep=pass(`varying vec2 vUv;uniform sampler2D tDepth,tScene;uniform float near,far;
  void main(){float d=texture2D(tDepth,vUv).x;gl_FragColor=vec4(near*far/(far-(far-near)*d),clamp(texture2D(tScene,vUv).a,0.,1.),0.,1.);}`,aoPrepUniforms);
 const aoUniforms={tPrep:{value:aoPrepTarget.texture},texel:{value:new T.Vector2()},projScale:{value:new T.Vector2(1,1)},far:{value:100},sunView:{value:new T.Vector3(0,1,0)},
  camWorld:{value:new T.Matrix4()},tShadow:{value:null},shadowMatrix:{value:new T.Matrix4()},hasShadow:{value:0}};
 const aoPass=pass(`
  #include <packing>
  varying vec2 vUv;uniform sampler2D tPrep,tShadow;uniform vec2 texel,projScale;uniform float far,hasShadow;uniform vec3 sunView;uniform mat4 camWorld,shadowMatrix;
  ${HASH}
  vec3 viewPos(vec2 uv,float z){return vec3((uv*2.-1.)/projScale*z,-z);}
  vec2 prep(vec2 uv){return texture2D(tPrep,uv).xy;}
  void main(){
   vec2 c=prep(vUv);float z=c.x;
   if(z>far*.95){gl_FragColor=vec4(1.,1.,z,1.);return;}
   vec3 p=viewPos(vUv,z);
   // Normal from the flatter side of each neighbour pair, so silhouettes stay crisp.
   vec2 ex=vec2(texel.x,0.),ey=vec2(0.,texel.y);
   float zr=prep(vUv+ex).x,zl=prep(vUv-ex).x,zu=prep(vUv+ey).x,zd=prep(vUv-ey).x;
   vec3 dx=abs(zr-z)<abs(z-zl)?viewPos(vUv+ex,zr)-p:p-viewPos(vUv-ex,zl);
   vec3 dy=abs(zu-z)<abs(z-zd)?viewPos(vUv+ey,zu)-p:p-viewPos(vUv-ey,zd);
   vec3 n=normalize(cross(dx,dy));if(dot(n,p)>0.)n=-n;
   float noise=bayer4(gl_FragCoord.xy),noise2=bayer4(gl_FragCoord.xy+vec2(2.,1.));
   // AO: a golden-angle spiral inside a world radius that widens with distance,
   // so near contact is tight and far trunks and understory pool into shade.
   float R=mix(.8,2.6,smoothstep(5.,45.,z)),rPx=min(R*projScale.y/z*.5/texel.y,48.),occ=0.;
   if(rPx>1.){
    for(int i=0;i<SAMPLES;i++){
     float t=(float(i)+noise2)/float(SAMPLES),a=float(i)*2.39996+noise*6.2832;
     vec2 uv=vUv+vec2(cos(a),sin(a))*mix(1.5,rPx,t)*texel;
     vec2 s=prep(uv);vec3 v=viewPos(uv,s.x)-p;float vv=dot(v,v);
     occ+=max(0.,dot(v,n)*inversesqrt(vv+1e-4)-.08)*max(0.,1.-vv/(R*R))*s.y;
    }
    occ*=3.6/float(SAMPLES);
   }
   float ao=1.-clamp(occ,0.,1.)*c.y;
   // Contact shadow: march a short way toward the sun through the depth buffer.
   // Only where the sun actually reaches, per the shadow map, so it never doubles up.
   float contact=1.,facing=dot(n,sunView);
   if(facing>.03){
    float len=mix(.28,1.3,smoothstep(3.,32.,z)),hit=0.;vec3 o=p+n*(.01+.003*z);
    for(int i=0;i<STEPS;i++){
     float t=(float(i)+noise)/float(STEPS);vec3 q=o+sunView*len*t;
     vec2 uv=q.xy/(-q.z)*projScale*.5+.5;
     if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)break;
     vec2 s=prep(uv);float dz=-q.z-s.x;
     if(dz>.012+.0025*s.x&&dz<.3+.03*s.x)hit=max(hit,(1.-t*.65)*s.y);
    }
    float lit=1.;
    if(hit>0.&&hasShadow>.5){
     vec3 wn=normalize(mat3(camWorld)*n);vec4 sc=shadowMatrix*vec4((camWorld*vec4(p,1.)).xyz+wn*.08,1.);sc.xyz/=sc.w;
     vec3 e=min(sc.xyz,1.-sc.xyz);if(min(min(e.x,e.y),e.z)>0.)lit=step(sc.z-.002,unpackRGBAToDepth(texture2D(tShadow,sc.xy)));
    }
    contact=1.-hit*lit*smoothstep(.03,.25,facing)*c.y;
   }
   gl_FragColor=vec4(ao,contact,z,1.);
  }`,aoUniforms,{defines:{SAMPLES:8,STEPS:8}});
 const aoBlurUniforms={tInput:{value:aoTarget.texture},texel:{value:new T.Vector2()}};
 const aoBlur=pass(`varying vec2 vUv;uniform sampler2D tInput;uniform vec2 texel;
  void main(){
   vec4 c=texture2D(tInput,vUv);vec2 sum=vec2(0.);float ws=0.,tol=c.z*.04+.03;
   for(int y=-2;y<2;y++)for(int x=-2;x<2;x++){vec4 s=texture2D(tInput,vUv+vec2(float(x),float(y))*texel);float w=max(0.,1.-abs(s.z-c.z)/tol);sum+=s.xy*w;ws+=w;}
   gl_FragColor=vec4(sum/max(ws,1e-4),c.z,1.);
  }`,aoBlurUniforms);

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
  flash:{value:new T.Color(0,0,0)},lensRain:{value:0},lensTime:{value:0},
  tSmoke:{value:null},tDepth:{value:depthTexture},projInv:{value:new T.Matrix4()},camWorld:{value:new T.Matrix4()},prevViewProj:{value:new T.Matrix4()},motion:{value:0},
  tAO:{value:aoBlurTarget.texture},aoTexel:{value:new T.Vector2()},aoStrength:{value:0},contactStrength:{value:0},near:{value:.1},far:{value:100},fogDensity:{value:0}
 };
 const final=pass(`varying vec2 vUv;
  uniform sampler2D tScene,tBloom,tVol,tSmoke,tDepth,tAO;uniform vec2 texel,resolution,aoTexel;uniform mat4 projInv,camWorld,prevViewProj;uniform float motion,aoStrength,contactStrength,near,far,fogDensity;
  uniform float bloomStrength,volStrength,exposure,time,vignette,grain,aberration,sharpen,contrast,saturation,lift,lensRain,lensTime;uniform vec3 shadowTint,highlightTint,flash;
  ${HASH}
  // Raindrops striking an exterior camera's lens. Each cell hosts a stream of
  // impacts: a drop splats at a fresh spot with fine spatter, then thins and
  // evaporates while later drops land elsewhere; a few heavy beads run down the
  // glass, tapering above and leaving a wet trail. Outlines are lobed, stretched
  // and tilted at random, sometimes two beads fused, and heavier at the bottom as
  // water sits on vertical glass. Returns refraction offset, coverage and rim.
  vec4 lensDrops(vec2 uv,float t){
   vec2 id=floor(uv),f=fract(uv)-.5;
   float h=hash12(id*1.37+3.1),cyc=t*(.18+.2*h)+h*9.,life=fract(cyc);
   vec2 k=id+floor(cyc)*vec2(.137,.311);
   if(hash12(k*1.7+.3)>.55)return vec4(0.);
   float heavy=step(hash12(k+9.1),.16),slide=heavy*smoothstep(.12,1.,life);
   vec2 c=(vec2(hash12(k+.7),hash12(k+2.9))-.5)*.45;c.y=mix(c.y,.2-slide*.4,heavy);
   float r=(.06+.08*hash12(k+5.3))*(1.-.4*life*(1.-heavy))*(1.+.3*heavy);
   float appear=smoothstep(0.,.025,life),fade=1.-smoothstep(.2,1.,life)*(1.-.35*heavy);
   vec2 d=f-c;
   float ang=hash12(k+4.4)*6.2832,ca=cos(ang),sa=sin(ang);
   vec2 e=vec2(ca*d.x+sa*d.y,-sa*d.x+ca*d.y)*vec2(1.+.35*hash12(k+6.6),1.-.2*hash12(k+7.2));
   d=vec2(ca*e.x-sa*e.y,sa*e.x+ca*e.y);
   d.y*=d.y>0.?1.18+.6*slide:.84;
   d.x*=1.+heavy*max(0.,d.y/r)*.9;
   float th=atan(d.y,d.x),lobe=1.+.13*sin(th*2.+h*6.3)+.08*sin(th*3.+hash12(k+1.9)*6.3)+.05*sin(th*5.+h*11.);
   float dist=length(d)/(r*lobe);
   vec2 o=(vec2(hash12(k+8.1),hash12(k+3.3))-.5)*r*1.7;
   float dist2=step(hash12(k+2.2),.3)>.5?length(f-c-o)/(r*.6):9.;
   float dm=-log(exp(-7.*dist)+exp(-7.*dist2))/7.;
   float m=smoothstep(1.,.78,dm)*appear*fade;
   float trail=heavy*step(c.y,f.y)*step(f.y,.2)*smoothstep(r*.3,r*.05,abs(f.x-c.x-sin(f.y*31.+h*9.)*.012))*.45*appear*(1.-life*.5);
   float spat=0.;
   for(int i=0;i<5;i++){float fi=float(i);vec2 so=(vec2(hash12(k+fi*3.1),hash12(k+fi*7.7))-.5)*r*3.6;float rr=r*(.14+.16*hash12(k+fi+.5));spat=max(spat,smoothstep(rr,rr*.55,length(f-c-so)));}
   spat*=appear*(1.-smoothstep(0.,.3,life))*.7;
   vec2 off=d/(r*lobe);
   if(m>=max(spat,trail))return vec4(off,m,smoothstep(.5,.95,dm)*m);
   return spat>trail?vec4(0.,0.,spat,0.):vec4(off*.25,trail,0.);
  }
  vec3 rrt(vec3 v){vec3 a=v*(v+.0245786)-.000090537,b=v*(.983729*v+.4329510)+.238081;return a/b;}
  vec3 aces(vec3 c){
   const mat3 i=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
   const mat3 o=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
   return clamp(o*rrt(i*(c/.6)),0.,1.);
  }
  vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
  void main(){
   vec2 cc=vUv-.5;float r2=dot(cc,cc);
   vec2 off=cc*aberration*(.35+r2*2.),suv=vUv;float bead=0.,lensRim=0.,lensGlint=0.;
   if(lensRain>0.){
    vec2 a=vec2(resolution.x/resolution.y,1.);vec4 d1=lensDrops(vUv*a*6.,lensTime),d2=lensDrops(vUv*a*11.+vec2(3.1,1.7),lensTime*1.25);
    suv-=(d1.xy*d1.z+d2.xy*d2.z*.7)/a*.022*lensRain;bead=max(d1.z,d2.z*.7)*lensRain;lensRim=max(d1.w,d2.w*.7)*lensRain;
    lensGlint=max(smoothstep(.3,.05,length(d1.xy-vec2(-.38,.44)))*d1.z,smoothstep(.3,.05,length(d2.xy-vec2(-.38,.44)))*d2.z*.7)*lensRain;
   }
   // Camera motion blur: each pixel's world point from depth, reprojected with last
   // frame's camera, gives its screen velocity; average the frame along it. Pixels
   // near the lens (the gun, the gunner's arms) move with the camera and stay sharp.
   vec2 vel=vec2(0.);
   if(motion>0.){
    vec4 v=projInv*vec4(vUv*2.-1.,texture2D(tDepth,vUv).x*2.-1.,1.);v/=v.w;
    vec4 prev=prevViewProj*(camWorld*vec4(v.xyz,1.));vel=(vUv-(prev.xy/prev.w*.5+.5))*motion*smoothstep(1.4,3.5,length(v.xyz));
    float l=length(vel);if(l>.035)vel*=.035/l;
   }
   vec3 color;
   vec2 px=vel*resolution;
   if(dot(px,px)>1.){
    float j=ign(gl_FragCoord.xy+fract(time*7.)*vec2(41.,17.));color=vec3(0.);
    for(int i=0;i<8;i++)color+=texture2D(tScene,suv+vel*((float(i)+j)/8.-.5)).rgb;
    color*=.125;
   }else color=vec3(texture2D(tScene,suv-off).r,texture2D(tScene,suv).g,texture2D(tScene,suv+off).b);
   if(sharpen>0.){
    vec3 n=texture2D(tScene,vUv+vec2(texel.x,0.)).rgb+texture2D(tScene,vUv-vec2(texel.x,0.)).rgb+texture2D(tScene,vUv+vec2(0.,texel.y)).rgb+texture2D(tScene,vUv-vec2(0.,texel.y)).rgb;
    color=max(color+(color*4.-n)*sharpen*.25,vec3(0.));
   }
   // Grounding: depth-aware upsample of the half-resolution AO and contact shadow,
   // fading with the fog so distant haze is never dirtied.
   if(aoStrength>0.){
    float zf=near*far/(far-(far-near)*texture2D(tDepth,suv).x);
    vec2 g=suv/aoTexel-.5,b=floor(g),f=g-b,acc=vec2(0.);float ws=0.,tol=zf*.05+.03;
    for(int i=0;i<4;i++){
     vec2 o=vec2(mod(float(i),2.),floor(float(i)*.5));vec4 s=texture2D(tAO,(b+o+.5)*aoTexel);
     float w=mix(1.-f.x,f.x,o.x)*mix(1.-f.y,f.y,o.y)*max(1e-3,1.-abs(s.z-zf)/tol);acc+=s.xy*w;ws+=w;
    }
    acc/=max(ws,1e-6);float fogT=exp(-fogDensity*fogDensity*zf*zf);
    color*=mix(1.,acc.x,aoStrength*fogT)*mix(1.,acc.y,contactStrength*fogT);
   }
   // Soft smoke (premultiplied, half resolution) sits over the scene and under bloom.
   vec4 smk=texture2D(tSmoke,suv);color=color*(1.-smk.a)+smk.rgb;
   color+=texture2D(tBloom,suv).rgb*bloomStrength*(1.+bead*.8)+texture2D(tVol,vUv).rgb*volStrength+flash;
   // Water beads darken toward their rims (internal reflection) and catch a small glint.
   color=color*(1.-.35*lensRim)+vec3(.9,.95,1.)*lensGlint*.18;
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
  smokeTarget.setSize(Math.max(1,Math.round(w*settings.smokeResolution)),Math.max(1,Math.round(h*settings.smokeResolution)));
  const vr=settings.volumetric?.resolution||.25;volTarget.setSize(Math.max(1,Math.round(w*vr)),Math.max(1,Math.round(h*vr)));volBlur.setSize(volTarget.width,volTarget.height);
  const aw=Math.max(1,Math.round(w/2)),ah=Math.max(1,Math.round(h/2));for(const t of [aoPrepTarget,aoTarget,aoBlurTarget])t.setSize(aw,ah);
  makeMips();
 }
 function configure(next){
  Object.assign(settings,next);
  if(sceneTarget.samples!==settings.msaa){sceneTarget.samples=settings.msaa;sceneTarget.dispose();}
  const steps=settings.volumetric?.steps||0;if(steps&&volumetric.material.defines.STEPS!==steps){volumetric.material.defines.STEPS=steps;volumetric.material.needsUpdate=true;}
  const ao=settings.ao,d=aoPass.material.defines;if(ao&&(d.SAMPLES!==ao.samples||d.STEPS!==ao.steps)){d.SAMPLES=ao.samples;d.STEPS=ao.steps;aoPass.material.needsUpdate=true;}
  size.set(0,0);resize();
 }
 const black=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;
 const clear=new T.DataTexture(new Uint8Array([0,0,0,0]),1,1);clear.needsUpdate=true;
 let frame=0,lastTime=-1;const sunWorld=new T.Vector3(),viewProj=new T.Matrix4(),lastEye=new T.Vector3(),eye=new T.Vector3(),lastLook=new T.Vector3(),look=new T.Vector3(),clearColor=new T.Color();
 function draw(mesh,target){renderer.setRenderTarget(target);renderer.render(mesh,camera);}
 return{
  get supported(){return supported;},settings,final:finalUniforms,volume:volUniforms,sceneTarget,aoTargets:{prep:aoPrepTarget,ao:aoTarget,blur:aoBlurTarget},get depthReadable(){return depthReadable();},
  configure,resize,
  render(scene,cam,{time=0,sun=null,canopy=null,overlay=null}={}){
   resize();frame++;
   const oldTarget=renderer.getRenderTarget(),oldAutoClear=renderer.autoClear;renderer.autoClear=true;
   renderer.setRenderTarget(sceneTarget);AO_MASK.value=1;renderer.render(scene,cam);AO_MASK.value=0;
   // Soft particles into their own buffer, reading the depth just resolved.
   let smokeTexture=clear;
   if(overlay){
    const alpha=renderer.getClearAlpha();renderer.getClearColor(clearColor);renderer.setRenderTarget(smokeTarget);renderer.setClearColor(0,0);renderer.clear(true,false,false);
    renderer.autoClear=false;overlay(renderer,cam,depthReadable()?depthTexture:null,smokeTarget.width,smokeTarget.height);renderer.autoClear=true;renderer.setClearColor(clearColor,alpha);smokeTexture=smokeTarget.texture;
   }
   // Grounding (needs the resolved depth, so not where MSAA renders straight to texture)
   const f=finalUniforms,aoOn=!!settings.ao&&settings.aoAmount>0&&depthReadable();f.aoStrength.value=aoOn?settings.aoAmount:0;f.contactStrength.value=aoOn?.6*settings.aoAmount:0;
   if(aoOn){
    aoPrepUniforms.tScene.value=sceneTarget.texture;aoPrepUniforms.near.value=f.near.value=cam.near;aoPrepUniforms.far.value=f.far.value=cam.far;draw(aoPrep,aoPrepTarget);
    const u=aoUniforms,e=cam.projectionMatrix.elements;u.texel.value.set(1/aoTarget.width,1/aoTarget.height);u.projScale.value.set(e[0],e[5]);u.far.value=cam.far;u.camWorld.value.copy(cam.matrixWorld);
    if(sun)sunWorld.subVectors(sun.position,sun.target.position).normalize();else sunWorld.set(0,1,0);u.sunView.value.copy(sunWorld).transformDirection(cam.matrixWorldInverse);
    u.hasShadow.value=sun?.castShadow&&sun.shadow.map?1:0;if(u.hasShadow.value){u.tShadow.value=sun.shadow.map.texture;u.shadowMatrix.value.copy(sun.shadow.matrix);}
    draw(aoPass,aoTarget);aoBlurUniforms.texel.value.copy(u.texel.value);draw(aoBlur,aoBlurTarget);
    f.aoTexel.value.copy(u.texel.value);f.fogDensity.value=scene.fog?.density||0;
   }
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
   f.tSmoke.value=smokeTexture;
   // Shutter of 1/120 s whatever the frame rate; a camera cut (view switch, respawn, a
   // skipped frame) restarts the history instead of smearing across it.
   cam.getWorldPosition(eye);cam.getWorldDirection(look);const dt=lastTime<0?0:time-lastTime;
   const cut=!(dt>0&&dt<.1)||eye.distanceTo(lastEye)>1.5||look.dot(lastLook)<.9;
   viewProj.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);if(cut)f.prevViewProj.value.copy(viewProj);
   f.motion.value=cut||!settings.motionBlur?0:settings.motionBlur*Math.min(1.5,(1/120)/Math.max(dt,1e-3));f.projInv.value.copy(cam.projectionMatrixInverse);f.camWorld.value.copy(cam.matrixWorld);
   f.tScene.value=sceneTarget.texture;f.tBloom.value=mips[0]?.texture||black;f.tVol.value=volTexture;f.texel.value.set(1/size.x,1/size.y);f.resolution.value.copy(drawing);f.time.value=time;f.sharpen.value=settings.scale<.97?.55*(1-settings.scale)/.4+.12:0;
   draw(final,oldTarget);
   f.prevViewProj.value.copy(viewProj);lastEye.copy(eye);lastLook.copy(look);lastTime=time;
   renderer.autoClear=oldAutoClear;
  },
  dispose(){sceneTarget.dispose();aoPrepTarget.dispose();aoTarget.dispose();aoBlurTarget.dispose();smokeTarget.dispose();volTarget.dispose();volBlur.dispose();mips.forEach(m=>m.dispose());}
 };
}
