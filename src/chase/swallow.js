import * as T from 'three';
import {DEFEAT,INTERIOR,swallowPose,stomachPlunge,interiorPath,lumenCenter} from './defeat.js';
import {createStomach} from './stomach.js';
import {TISSUE} from './tissue.js';
import {createStomachGuest} from './stomach-guest.js';
import {NIGHT,WET} from './weather-state.js';

// The player's last seconds, as an endoscope would see them. Composited through
// a soft aperture in the real mouth, then down a collapsed esophagus that only
// distends around the player: longitudinal mucosal folds meet in a dark star
// ahead, peristaltic squeezes press the wet walls onto the lens, daylight glows
// red through the tissue (dimmer at night), vessels pulse with her heartbeat and
// ropes of mucus stretch across the lumen and snap. Out through the cardia into
// the stomach (stomach.js), then face first into the acid. Nothing is allocated
// or rendered during normal play.

// The lumen wall, shared by the tube and the mucus strands so strands stay
// anchored to it. a: angle around, s: depth along the centreline.
const WALL=`
 uniform float camS,opening,squeeze,beat;
 vec3 lumenCenter(float s){return vec3(.1*sin(s*.45),-.045*s*s,s);}
 float lumenRadius(float a,float s){
  float d=s-camS;
  // Distended around the player (and just ahead), collapsed beyond it.
  float open=exp(-pow(max(0.,d-.3)/1.25,2.))*(1.-.42*squeeze*exp(-d*d*2.2));
  float twist=s*.2+.5*sin(s*.6);
  float ridge=pow(abs(cos(a*4.+twist)),3.),fine=.5+.5*cos(a*13.-s*.8+sin(s*1.7)*2.);
  float collapsed=mix(.4,.035,ridge)*(.9+.1*fine);
  float distended=.8*(1.-.06*ridge-.018*fine);
  float r=mix(collapsed,distended,open);
  // Oral cavity and the pharyngeal opening at s=0, relaxing as the head lifts.
  r=mix(r,1.12,smoothstep(.15,-.7,s));
  r*=1.-exp(-s*s*1.8)*(.5-.56*opening);
  // Heartbeat: the walls tremble with each beat of the heart beside them.
  r*=1.+.018*beat*sin(s*1.9-a);
  // The cardia flares into the stomach.
  return mix(r,3.4,smoothstep(7.,8.4,s));
 }
 vec3 lumenWall(float a,float s){vec3 c=lumenCenter(s);float r=lumenRadius(a,s);return c+vec3(cos(a)*r,sin(a)*r*.9,0.);}`;
const NOISE=`
 float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm3(vec3 p){return n3(p)*.5+n3(p*2.03+3.1)*.3+n3(p*4.11+7.7)*.2;}
 // Branching vessels: ridges of noise, sharpened into lines.
 float vessels(vec3 p){float a=1.-abs(n3(p)*2.-1.),b=1.-abs(n3(p*2.3+5.)*2.-1.);return pow(a,14.)*.9+pow(b,22.)*.6;}`;
export function createSwallow(renderer){
 const scene=new T.Scene();scene.background=new T.Color(0x010000);
 const camera=new T.PerspectiveCamera(70,1,.02,40),screen=new T.Scene(),screenCamera=new T.Camera();
 const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,type:renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType});
 const uniforms={camS:{value:INTERIOR.start},opening:{value:.18},squeeze:{value:0},beat:{value:0},time:{value:0},light:{value:1},eye:{value:new T.Vector3()},outside:{value:new T.Color(1,.3,.2)}};

 // ---- Esophagus -------------------------------------------------------------
 const geometry=new T.PlaneGeometry(1,1,144,260),positions=geometry.attributes.position,uv=geometry.attributes.uv;
 // Extends behind the interior camera so the entry never shows a cut rim.
 for(let i=0;i<positions.count;i++)positions.setXYZ(i,uv.getX(i)*Math.PI*2,-3+uv.getY(i)*11.6,0);
 const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms,vertexShader:`
  ${WALL}
  varying vec3 surface,surfaceNormal;varying vec2 tissue;varying float radiusV;
  void main(){
   float a=position.x,s=position.y;surface=lumenWall(a,s);tissue=vec2(a,s);radiusV=lumenRadius(a,s);
   vec3 around=lumenWall(a+.004,s)-lumenWall(a-.004,s),along=lumenWall(a,s+.008)-lumenWall(a,s-.008);
   surfaceNormal=normalize(cross(around,along));
   gl_Position=projectionMatrix*modelViewMatrix*vec4(surface,1.);
  }`,fragmentShader:`
  uniform float light,time,beat,camS,squeeze;uniform vec3 eye,outside;
  varying vec3 surface,surfaceNormal;varying vec2 tissue;varying float radiusV;
  ${NOISE}
  ${TISSUE}
  void main(){
   float a=tissue.x,s=tissue.y;vec3 p=vec3(cos(a)*1.3,sin(a)*1.3,s*1.6);
   float big=fbm3(p*1.3),mid=n3(p*6.),fine=n3(p*vec3(38.,38.,24.));
   // Mucosa: pink on the fold crests, blood-dark in the creases between them.
   float twist=s*.2+.5*sin(s*.6),ridge=pow(abs(cos(a*4.+twist)),3.);
   vec3 crest=vec3(.4,.075,.06),valley=vec3(.08,.006,.01);
   vec3 albedo=mix(valley,crest,.35+.45*ridge+.2*big)*(.85+.3*mid);
   // Oral cavity: darker, glistening tongue-root and palate tones.
   albedo=mix(albedo,vec3(.36,.08,.08)*(.8+.4*mid),smoothstep(.2,-.8,s));
   // Vessel network under the translucent lining, pulsing with the heart.
   float v=vessels(p*vec3(3.,3.,1.6))+vessels(p*vec3(7.,7.,3.4)+2.)*.5;
   albedo=mix(albedo,vec3(.2,.012,.03)*(1.+.5*beat),clamp(v,0.,1.)*.8);
   // Mucus: a milky film in streaks along the lumen, beaded with bubbles.
   float slime=smoothstep(.52,.72,fbm3(vec3(a*3.,s*.7,1.)+vec3(0.,time*.05,0.)))+smoothstep(.72,.9,n3(vec3(a*9.,s*2.,4.)));
   vec2 cell=vec2(a*6.,s*9.);vec2 id=floor(cell),f=fract(cell)-.5;float r=.12+.22*h3(vec3(id,1.)),bub=h3(vec3(id,2.))>.86?smoothstep(r,r-.06,length(f-(vec2(h3(vec3(id,3.)),h3(vec3(id,4.)))-.5)*.4)):0.;
   float mucus=clamp(slime*.7+bub,0.,1.);
   albedo=mix(albedo,vec3(.5,.42,.32),mucus*.22);
   // Relief: fine mucosal pebbling and the bubble domes.
   float height=fine*.6+mid*.4+bub*1.5-v*.4;
   vec3 n=bumpNormal(surface,normalize(-surfaceNormal),height,.035);
   // Daylight through the wall: brightest in the thin creases and near the
   // mouth, blocked by the vessels, gone by the chest.
   float thin=smoothstep(.1,.45,radiusV)*(1.-ridge*.6),depth=exp(-max(0.,s)*.32);
   vec3 glow=outside*thin*depth*(1.-clamp(v*1.4,0.,.85))*(.55+.45*big)*.55;
   vec3 color=wetLight(albedo,n,surface,eye,.35+.65*mucus,mucus,glow);
   // Darkness swallows the lumen ahead.
   float ahead=max(0.,s-camS-.6);color*=exp(-ahead*.42)*(.35+.65*smoothstep(.02,.25,radiusV));
   gl_FragColor=vec4(color*light,1.);
  }`});
 const tube=new T.Mesh(geometry,material);tube.frustumCulled=false;scene.add(tube);

 // ---- Mucus strands: ropes across the lumen that stretch and snap -----------
 const STRANDS=18,strandGeo=new T.InstancedBufferGeometry();
 {const base=new T.CylinderGeometry(1,1,1,8,28,true);strandGeo.index=base.index;strandGeo.setAttribute('position',base.attributes.position);strandGeo.setAttribute('uv',base.attributes.uv);}
 const strandData=new T.InstancedBufferAttribute(new Float32Array(STRANDS*4),4);strandGeo.setAttribute('strand',strandData);strandGeo.instanceCount=STRANDS;
 {let seed=77;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<STRANDS;i++){const s=-.8+i/(STRANDS-1)*7.6+(rnd()-.5)*.2,a=rnd()*6.283;strandData.setXYZW(i,s,a,a+2.1+rnd()*2.1,.014+rnd()*.03);}}
 const strandMat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`
  ${WALL}
  uniform float time;attribute vec4 strand;varying vec3 surface,vNormal;varying float fade;
  vec3 A,B;float pass,stretch,broken,hang;
  // Centreline of the strand at u: stretched across the lumen, or snapped into
  // two halves hanging from their anchors.
  vec3 strandAt(float u){
   if(broken<.5)return mix(A,B,u)+vec3(0.,-.22-.25*stretch,.55*stretch)*4.*u*(1.-u);
   float side=step(.5,u),w=side>.5?(1.-u)*2.:u*2.;vec3 anchor=side>.5?B:A,mid=mix(A,B,.5);
   float len=length(B-A)*.5*mix(1.,.5,hang),sway=sin(time*3.1+strand.x*7.)*.12*(1.-hang*.5);
   vec3 dir=normalize(mix(mid-anchor,vec3(sway,-1.,.2),.35+.5*hang));
   return anchor+dir*len*w+vec3(0.,-.5*w*w*len*hang,0.);
  }
  void main(){
   float s=strand.x,u=position.y+.5,ring=atan(position.z,position.x);
   A=lumenWall(strand.y,s);B=lumenWall(strand.z,s);
   pass=camS-s;stretch=smoothstep(-.7,0.,pass);broken=step(.06,pass);hang=smoothstep(.06,.9,pass);
   vec3 p=strandAt(u),t=normalize(strandAt(min(1.,u+.02))-strandAt(max(0.,u-.02))+vec3(0.,1e-5,0.));
   vec3 side=normalize(cross(t,abs(t.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.))),up=cross(t,side);
   float thick=strand.w*(broken<.5?1.-.7*stretch*sin(3.1416*u):mix(1.,.5,abs(u-.5)*2.)+smoothstep(.9,1.,abs(u-.5)*2.)*.8);
   vec3 radial=side*cos(ring)+up*sin(ring);p+=radial*thick;vNormal=radial;
   surface=p;fade=smoothstep(-2.8,-1.2,pass)*(1.-smoothstep(1.5,2.5,pass));
   gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
  }`,fragmentShader:`
  uniform vec3 eye;uniform float light;varying vec3 surface,vNormal;varying float fade;
  void main(){
   vec3 v=normalize(eye-surface),n=normalize(vNormal);if(dot(n,v)<0.)n=-n;vec3 l=normalize(eye+vec3(-.25,.35,-.3)-surface);
   float d=length(eye-surface),fall=1./(1.+d*d*.16),spec=pow(max(0.,dot(n,normalize(l+v))),90.)*2.;
   float edge=1.-abs(dot(n,v));
   vec3 c=vec3(.4,.32,.16)*(.06+.35*max(0.,dot(n,l)))*fall+vec3(1.,.92,.75)*spec*fall*.55;
   gl_FragColor=vec4(c*light,(.18+.5*edge)*fade);
  }`});
 const strands=new T.Mesh(strandGeo,strandMat);strands.frustumCulled=false;scene.add(strands);

 // ---- Stomach, acid and its occupant ----------------------------------------
 const stomach=createStomach(scene,uniforms);
 const guest=createStomachGuest(scene,stomach);

 // ---- Composite: aperture, lens film (mucus, blood), acid, corrosion -------
 const blend={image:{value:target.texture},center:{value:new T.Vector2(.5,.55)},radii:{value:new T.Vector2()},alpha:{value:0},full:{value:0},immersion:{value:0},
  smear:{value:0},blood:{value:0},burn:{value:0},time:{value:0},aspect:{value:1}};
 const composite=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,dithering:true,uniforms:blend,
  vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
   #include <common>
   #include <dithering_pars_fragment>
   uniform sampler2D image;uniform vec2 center,radii;uniform float alpha,full,immersion,smear,blood,burn,time,aspect;varying vec2 coord;
   float h2(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
   float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
   float f2(vec2 p){return n2(p)*.55+n2(p*2.1+4.)*.3+n2(p*4.3+9.)*.15;}
   // Film thickness on the lens: slime smeared by the walls, sliding down.
   float film(vec2 q){vec2 w=vec2(q.x*aspect,q.y);float drip=n2(vec2(w.x*3.,w.y*1.2+time*.12))*.6+n2(w*1.6+vec2(3.,time*.05))*.4;return smoothstep(.5-smear*.2,1.05-smear*.2,drip)*smear;}
   void main(){
    vec2 p=(coord-center)/radii;float a=atan(p.y,p.x),edge=length(p);
    edge+=.018*sin(a*5.)+.012*sin(a*9.+.8);
    float mask=1.-smoothstep(.66,1.,edge);
    vec2 sampleUv=mix(p*.44+.5,coord,full);
    // Lens film refracts what is behind it and catches the light at its edges.
    float e=.012,fc=film(coord),fx=film(coord+vec2(e,0.))-film(coord-vec2(e,0.)),fy=film(coord+vec2(0.,e))-film(coord-vec2(0.,e));
    sampleUv+=vec2(fx,fy)*.06*full;
    // In the acid everything wavers.
    sampleUv+=immersion*vec2(sin(coord.y*23.+time*5.),cos(coord.x*19.-time*4.))*.006;
    vec2 ca=(coord-.5)*.004*(1.+smear+immersion*2.);
    vec3 color=vec3(texture2D(image,clamp(sampleUv+ca,0.,1.)).r,texture2D(image,clamp(sampleUv,0.,1.)).g,texture2D(image,clamp(sampleUv-ca,0.,1.)).b);
    color=mix(color,color*vec3(1.04,1.,.88)+vec3(.02,.016,.012),fc*.4);
    color+=vec3(1.,.95,.86)*pow(clamp(length(vec2(fx,fy))*5.,0.,1.),3.)*.1*full;
    // The player's blood runs down from the top of the lens after the bite.
    vec2 bq=vec2(coord.x*aspect*11.,0.);float lane=n2(bq),reach=blood*(.08+.3*n2(bq*2.7+7.)),run=smoothstep(.72,.9,lane)*smoothstep(1.-reach,1.-reach*.6,coord.y);
    run=max(run,smoothstep(.97,1.,coord.y)*blood*.6);
    color=mix(color,color*vec3(.3,.02,.02)+vec3(.035,0.,0.),run*.8*full);
    // Acid: murky, particle-laden, then the lens itself blisters and burns
    // inward from the rim.
    float murk=1.-exp(-immersion*5.);
    vec3 acid=vec3(.09,.105,.022)+vec3(.05,.06,.01)*f2(coord*vec2(aspect,1.)*18.+time*.8);
    color=mix(color,color*vec3(.55,.75,.2)*.6+acid*.6,murk);
    float speck=smoothstep(.94,.99,n2(coord*vec2(aspect,1.)*90.+vec2(0.,time*2.)))*immersion;color+=vec3(.25,.28,.08)*speck*.4;
    vec2 cq=(coord-.5)*vec2(aspect,1.);float rim=length(cq)+(f2(cq*7.+3.)-.5)*.35,front=1.25-burn*1.4;
    float scorched=smoothstep(front-.04,front+.06,rim),blister=smoothstep(.45,.5,n2(cq*42.))*smoothstep(front-.22,front-.02,rim)*(1.-scorched);
    color=mix(color,vec3(.32,.13,.03)*(.6+.8*n2(cq*20.)),blister*.7*burn);
    color=mix(color,vec3(.03,.012,.004),scorched);
    color*=1.-.35*smoothstep(.35,.9,length(cq))*full;
    gl_FragColor=vec4(color,alpha*mix(mask,1.,full));
    #include <colorspace_fragment>
    #include <dithering_fragment>
   }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),composite);quad.frustumCulled=false;screen.add(quad);

 let active=false,progress=0,apertureOrigin=null;const look=new T.Vector3(),center=new T.Vector3(),glow=new T.Color();
 const at=z=>{const c=lumenCenter(z);return center.set(c.x,c.y,c.z);};
 function resize(width,height){const scale=Math.min(1,1280/width,900/height);target.setSize(Math.round(width*scale),Math.round(height*scale));camera.aspect=width/height;camera.updateProjectionMatrix();blend.aspect.value=width/height;}
 return{get active(){return active;},get coversFrame(){return active&&blend.full.value===1;},get progress(){return progress;},get immersion(){return blend.immersion.value;},camera,resize,guest,stomach,debug:{uniforms,blend,target},
  async prepare(){guest.root.visible=stomach.root.visible=true;try{await renderer.compileAsync(scene,camera);}finally{guest.reset();stomach.reset();}},
  reset(){active=false;progress=0;apertureOrigin=null;blend.alpha.value=blend.immersion.value=blend.smear.value=blend.blood.value=blend.burn.value=0;guest.reset();stomach.reset();},
  update(t,worldCamera,mouth,reducedMotion=false){
   active=t>=DEFEAT.swallowAt&&t<DEFEAT.black;if(!active){guest.reset();stomach.reset();return;}
   const elapsed=t-DEFEAT.swallowAt,entry=T.MathUtils.smoothstep(elapsed,0,.36),pose=swallowPose(t),plunge=stomachPlunge(t),motion=reducedMotion?.3:1;
   progress=pose.progress;
   const path=interiorPath(t);camera.position.set(path.x,path.y,path.z);
   const camS=INTERIOR.start+(INTERIOR.esophagus-INTERIOR.start)*progress;
   // Peristalsis: the walls clamp around her three times on the way down.
   const slide=Math.max(0,t-DEFEAT.slideAt),squeeze=progress>0&&progress<1?Math.pow(Math.max(0,Math.sin(slide*5.2-.4)),6):0;
   const heart=Math.pow(Math.max(0,Math.sin(t*4.6)),10)+.5*Math.pow(Math.max(0,Math.sin(t*4.6-.5)),10);
   uniforms.camS.value=camS;uniforms.squeeze.value=squeeze*motion;uniforms.beat.value=heart*motion;uniforms.time.value=t;uniforms.opening.value=pose.opening;
   // Remain at the mouth while it closes and tip with her head, then look down
   // the lumen; out of the cardia, find the chamber's occupant; then the acid.
   at(camS+2);look.copy(center);look.y+=pose.tilt*(reducedMotion?.16:.58);
   const reveal=T.MathUtils.smoothstep(progress,.86,1)*(1-plunge.look);
   look.lerp(guest.focus,T.MathUtils.smoothstep(t,DEFEAT.bellyAt-.25,DEFEAT.bellyAt+.45)*(1-plunge.look));
   look.lerp(camera.position.clone().add(new T.Vector3(.1,reducedMotion?-1.35:-1.6,.55)),plunge.look);
   camera.lookAt(look);
   camera.rotation.z+=(Math.sin(progress*Math.PI)*.09-pose.tilt*.035+squeeze*.05*Math.sin(t*7.))*motion*(1-plunge.look);
   camera.fov=70+Math.sin(progress*Math.PI)*6-squeeze*4*motion;camera.updateProjectionMatrix();
   uniforms.eye.value.copy(camera.position);
   // Daylight through the neck: warm red by day, a dull ember in the storm, near
   // nothing at night.
   const day=(1-NIGHT.value)*(1-.45*WET.value);glow.setRGB(1,.22,.13).multiplyScalar(.12+.88*day);uniforms.outside.value.copy(glow);
   uniforms.light.value=(1.15+.45*T.MathUtils.smoothstep(t,DEFEAT.bellyAt-.3,DEFEAT.bellyAt+.4))*(1-T.MathUtils.smoothstep(t,DEFEAT.acidAt,DEFEAT.black)*.97);
   stomach.update(t,camera,reveal,reducedMotion);guest.update(t,camera,reducedMotion);
   // Lens: saliva at the bite, then slime each time the walls press in; blood
   // from the bite runs down from the top; acid eats it from the rim.
   blend.smear.value=Math.min(.7,Math.max(blend.smear.value*.985,.25*entry*(1-progress),squeeze*.7));blend.time.value=t;
   blend.blood.value=T.MathUtils.smoothstep(t,DEFEAT.contact,DEFEAT.contact+2.4)*.9;
   blend.immersion.value=plunge.immersion;blend.burn.value=T.MathUtils.smoothstep(t,DEFEAT.acidAt+.05,DEFEAT.black+.1);
   // Capture the back of the gape before the lips pass behind the camera;
   // projecting those same lips afterwards flips the opening under the tongue.
   if(!apertureOrigin){const projected=mouth.upper.clone().project(worldCamera);apertureOrigin=new T.Vector2(T.MathUtils.clamp(projected.x*.5+.5,.4,.6),T.MathUtils.clamp(projected.y*.5+.5,.68,.76));}
   blend.center.value.copy(apertureOrigin).lerp(new T.Vector2(.5,.5),entry);
   blend.radii.value.set(T.MathUtils.lerp(.065,1.1,entry),T.MathUtils.lerp(.095,1.45,entry));
   blend.alpha.value=T.MathUtils.smoothstep(elapsed,0,.12);blend.full.value=T.MathUtils.smoothstep(elapsed,.25,.40);
  },
  render(){if(!active)return;const old=renderer.getRenderTarget(),clear=renderer.autoClear;
   renderer.setRenderTarget(target);renderer.autoClear=true;renderer.render(scene,camera);
   renderer.setRenderTarget(old);renderer.autoClear=false;renderer.render(screen,screenCamera);renderer.autoClear=clear;
  },
 };
}
