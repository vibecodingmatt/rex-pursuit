import * as T from 'three';
import {DEFEAT} from './defeat.js';

// A short, self-contained interior shot. Composite through an expanding soft
// aperture in the visible mouth, then travel down a curved, contracting lumen.
// Nothing is allocated or rendered per frame during normal gameplay.
export function createSwallow(renderer){
 const scene=new T.Scene();scene.background=new T.Color(0x010000);
 const camera=new T.PerspectiveCamera(68,1,.025,35),screen=new T.Scene(),screenCamera=new T.Camera();
 const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,type:renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType});
 const uniforms={elapsed:{value:0},light:{value:1},eye:{value:new T.Vector3()}};
 const geometry=new T.PlaneGeometry(1,1,96,128),positions=geometry.attributes.position,uv=geometry.attributes.uv;
 // Extend behind the interior camera so the transition never exposes a cut
 // tube rim or the black background outside its entrance.
 for(let i=0;i<positions.count;i++)positions.setXYZ(i,uv.getX(i)*Math.PI*2,-3+uv.getY(i)*16,0);
 const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms,vertexShader:`
  uniform float elapsed;varying vec3 surface;varying vec3 surfaceNormal;varying vec2 tissueUv;
  float ease(float a,float b,float x){return smoothstep(a,b,x);}
  vec3 wall(float a,float z){
   float entrance=exp(-z*z*1.8),open=ease(0.,.48,elapsed);
   float radius=mix(.96,2.6,ease(7.6,11.,z));
   radius*=1.-entrance*(.56-.63*open);
   float wave=exp(-pow((z-(elapsed*.95+1.1))/.65,2.));
   radius*=1.-.19*wave;
   float folds=.065*cos(a*9.+z*.47)+.029*cos(a*15.-z*.76)+.026*sin(z*9.+sin(a*3.));
   radius*=1.+folds*(1.-.45*entrance*open);
   float x=.12*sin(z*.42),y=-.036*z*z;
   return vec3(x+cos(a)*radius,y+sin(a)*radius*(.88+.08*sin(z*.7)),z);
  }
  void main(){
   float a=position.x,z=position.y;surface=wall(a,z);tissueUv=vec2(a,z);
   vec3 around=wall(a+.003,z)-wall(a-.003,z),along=wall(a,z+.006)-wall(a,z-.006);
   surfaceNormal=normalize(cross(around,along));
   gl_Position=projectionMatrix*modelViewMatrix*vec4(surface,1.);
  }`,fragmentShader:`
  uniform float elapsed;uniform float light;uniform vec3 eye;
  varying vec3 surface;varying vec3 surfaceNormal;varying vec2 tissueUv;
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
   return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  void main(){
   vec2 uv=tissueUv;vec3 p=vec3(cos(uv.x),sin(uv.x),uv.y);
   float broad=noise(p*vec3(5.,5.,2.2)),fine=noise(p*vec3(47.,47.,36.));
   float pleat=.5+.5*sin(uv.x*25.+noise(p*3.)*3.2+uv.y*.35);
   vec3 pigment=mix(vec3(.15,.027,.026),vec3(.42,.155,.115),broad*.65+pleat*.12+fine*.13);
   vec3 n=normalize(-surfaceNormal),v=normalize(eye-surface),l=normalize(eye+vec3(-.24,.32,-.25)-surface);
   if(dot(n,v)<0.)n=-n;
   float diffuse=max(0.,dot(n,l)),spec=pow(max(0.,dot(n,normalize(l+v))),42.);
   float distance=length(eye-surface),falloff=1./(1.+distance*distance*.19);
   float creases=.77+.23*pleat;
   vec3 color=(pigment*(.13+diffuse*1.4)*creases+vec3(.68,.43,.32)*spec*.32)*falloff*light;
   color*=exp(-max(0.,surface.z-eye.z-1.)*.27);
   gl_FragColor=vec4(color,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const tube=new T.Mesh(geometry,material);tube.frustumCulled=false;scene.add(tube);
 const blend={image:{value:target.texture},center:{value:new T.Vector2(.5,.55)},radii:{value:new T.Vector2()},alpha:{value:0},full:{value:0}};
 const composite=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,dithering:true,uniforms:blend,
  vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
   #include <common>
   #include <dithering_pars_fragment>
   uniform sampler2D image;uniform vec2 center;uniform vec2 radii;uniform float alpha;uniform float full;varying vec2 coord;
   void main(){vec2 p=(coord-center)/radii;float a=atan(p.y,p.x),edge=length(p);
    edge+=.018*sin(a*5.)+.012*sin(a*9.+.8);
    float mask=1.-smoothstep(.66,1.,edge);
    vec2 sampleUv=mix(p*.44+.5,coord,full);
    gl_FragColor=vec4(texture2D(image,clamp(sampleUv,0.,1.)).rgb,alpha*mix(mask,1.,full));
    #include <colorspace_fragment>
    #include <dithering_fragment>
   }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),composite);quad.frustumCulled=false;screen.add(quad);
 let active=false,progress=0,apertureOrigin=null;
 const centerAt=z=>new T.Vector3(.12*Math.sin(z*.42),-.036*z*z,z);
 function resize(width,height){const scale=Math.min(1,1280/width,900/height);target.setSize(Math.round(width*scale),Math.round(height*scale));camera.aspect=width/height;camera.updateProjectionMatrix();}
 return{get active(){return active;},get coversFrame(){return active&&blend.full.value===1;},get progress(){return progress;},camera,resize,
  reset(){active=false;progress=0;apertureOrigin=null;blend.alpha.value=0;},
  update(t,worldCamera,mouth,reducedMotion=false){
   active=t>=DEFEAT.swallowAt&&t<DEFEAT.black;if(!active)return;
   const elapsed=t-DEFEAT.swallowAt,entry=T.MathUtils.smoothstep(elapsed,0,.36);
   progress=T.MathUtils.smoothstep(t,DEFEAT.swallowAt,DEFEAT.bellyAt);
   const z=T.MathUtils.lerp(-1.1,9.4,progress);camera.position.copy(centerAt(z));
   camera.lookAt(centerAt(z+2));camera.rotation.z+=reducedMotion?0:Math.sin(progress*Math.PI)*.09;
   camera.fov=68+Math.sin(progress*Math.PI)*6;camera.updateProjectionMatrix();
   uniforms.elapsed.value=elapsed;uniforms.eye.value.copy(camera.position);
   uniforms.light.value=1.8*(1-T.MathUtils.smoothstep(t,DEFEAT.contact+.25,DEFEAT.black)*.97);
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
