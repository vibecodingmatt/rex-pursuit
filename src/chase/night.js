import * as T from 'three';
// Night rig. Every light here really lights the scene: a shadow-casting
// flashlight clamped under the gun's muzzle (it follows the aim because it
// rides the barrel), one headlight spot for the lamp pair, a red tail glow on
// the road behind, and a longer-reaching muzzle flash. The rig only joins the
// scene while it is night, so daytime shaders never pay for these lights;
// toggling them happens with the conditions picker (menu or pause), where a
// shader recompile is acceptable. The flashlight switch mid-chase only changes
// intensity and skips the shadow pass, so it never recompiles.

const FLASHLIGHT_CD=620,HEADLIGHT_CD=150,TAIL=2.6,FIREFLY_MAX=260;

function fireflies(){
 const seeds=new Float32Array(FIREFLY_MAX*4);let s=2718;const r=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};for(let i=0;i<seeds.length;i++)seeds[i]=r();
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(FIREFLY_MAX*3),3));g.setAttribute('seed',new T.BufferAttribute(seeds,4));
 const uniforms={time:{value:0},scroll:{value:0},pixel:{value:1},strength:{value:0}};
 const points=new T.Points(g,new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,toneMapped:false,
  // Verge-hugging drifters: slow looping flight, each on its own blink rhythm
  // (a quick rise, a held glow, a slow fade, then a dark gap).
  vertexShader:`attribute vec4 seed;uniform float time,scroll,pixel;varying float vGlow;
   void main(){
    float side=seed.x<.5?-1.:1.,x=side*(2.6+pow(fract(seed.x*2.),.7)*13.);
    float t=time*(.25+seed.w*.3)+seed.y*40.;
    vec3 p=vec3(x+sin(t)*.7+sin(t*.37)*.9,.35+seed.y*3.6+sin(t*.8+seed.z*9.)*.35,mod(seed.z*62.+scroll+cos(t*.6)*.8,62.)-10.);
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    float cycle=fract(time/(2.2+seed.w*2.6)+seed.x*7.),blink=smoothstep(0.,.06,cycle)*(1.-smoothstep(.2,.42,cycle));
    float d=-mv.z;vGlow=blink*smoothstep(1.,3.,d)*(1.-smoothstep(26.,44.,d));
    gl_PointSize=pixel*(3.+seed.w*2.)*14./max(d,1.)+pixel*1.5;
   }`,
  fragmentShader:`uniform float strength;varying float vGlow;void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c),a=exp(-r*40.)*1.4+exp(-r*9.)*.25;gl_FragColor=vec4(vec3(.5,1.,.12)*a*vGlow*strength*1.1,1.);}`}));
 points.frustumCulled=false;points.name='Fireflies';points.renderOrder=6;
 return{points,uniforms,geometry:g};
}

export function createNight(scene,{jeep,weather,renderer}){
 const root=new T.Group();root.name='Night rig';root.visible=false;
 // Flashlight clamped under the barrel near the muzzle, clear of the barrel's own shadow.
 const barrel=jeep.weapon.barrel,mount=new T.Group();mount.position.set(0,-.1,1.86);barrel.add(mount);
 const bodyMat=new T.MeshStandardMaterial({color:0x151816,metalness:.6,roughness:.45});
 const lensMat=new T.MeshBasicMaterial({color:0x000000,toneMapped:false});
 const tube=new T.Mesh(new T.CylinderGeometry(.03,.03,.2,14),bodyMat);tube.rotation.x=Math.PI/2;
 const head=new T.Mesh(new T.CylinderGeometry(.04,.034,.05,14),bodyMat);head.rotation.x=Math.PI/2;head.position.z=.11;
 const lens=new T.Mesh(new T.CircleGeometry(.035,16),lensMat);lens.position.z=.1365;
 const clamp=new T.Mesh(new T.BoxGeometry(.025,.07,.05),bodyMat);clamp.position.set(0,.05,-.02);
 mount.add(tube,head,lens,clamp);mount.visible=false;
 const flashlight=new T.SpotLight(0xfff0d8,0,80,.3,.5,2);flashlight.position.set(0,0,.14);flashlight.target.position.set(0,0,40);mount.add(flashlight,flashlight.target);
 flashlight.castShadow=true;flashlight.shadow.mapSize.set(1024,1024);flashlight.shadow.bias=-.0006;flashlight.shadow.normalBias=.03;flashlight.shadow.camera.near=.25;flashlight.shadow.camera.far=70;
 // Headlights: the lamp pair reads through the lenses; one spot between them lights the road.
 const headlight=new T.SpotLight(0xffe6bd,0,48,.52,.75,2);headlight.position.set(0,1.12,-2.12);headlight.target.position.set(0,0,-24);jeep.body.add(headlight,headlight.target);
 const tail=new T.PointLight(0xff2a12,0,9,2);tail.position.set(0,1.1,2.12);jeep.body.add(tail);
 const lights=[flashlight,headlight,tail];for(const l of lights)l.visible=false;
 const flies=fireflies();root.add(flies.points);scene.add(root);
 const muzzle=jeep.weapon.light,lamps=jeep.lamps,lampBase={head:lamps.head.emissiveIntensity,tail:lamps.tail.emissiveIntensity};
 const beamPos=new T.Vector3(),beamDir=new T.Vector3(),toEye=new T.Vector3(),toCam=new T.Vector3(),forward=new T.Vector3();
 let on=false,beam=1,beamLevel=1,scroll=0,shadowCaster=true;
 const api={
  flashlight,headlight,tail,fireflies:flies.points,
  get active(){return on;},get flashlightOn(){return beam>.5;},get beam(){return beamLevel;},
  toggleFlashlight(next=beam<.5){beam=next?1:0;return next;},
  reset(){beam=1;scroll=0;},
  setQuality(t){
   flies.geometry.setDrawRange(0,Math.floor(FIREFLY_MAX*Math.min(1,t.particles)));
   // Low keeps the beam but skips its shadow pass.
   const size=t.shadow>=2048?1024:0;shadowCaster=size>0;
   if(flashlight.castShadow!==shadowCaster)flashlight.castShadow=shadowCaster;
   if(size&&flashlight.shadow.mapSize.x!==size){flashlight.shadow.mapSize.set(size,size);flashlight.shadow.map?.dispose();flashlight.shadow.map=null;}
  },
  /** Drive the rig from the weather's night value; dt 0 just syncs (paused picker). */
  update(dt,{time=0,speed=0,camera,rex=null,ground=true}={}){
   const n=weather.night,w=weather.value,active=n>.001;
   if(active!==on){on=active;root.visible=mount.visible=active;for(const l of lights)l.visible=active;}
   beamLevel+=(beam-beamLevel)*Math.min(1,dt*28);if(dt===0)beamLevel=beam;
   const lit=beamLevel*n,detached=jeep.weapon.detached;
   flashlight.intensity=FLASHLIGHT_CD*lit;flashlight.shadow.autoUpdate=shadowCaster&&lit>.01;
   lensMat.color.setRGB(9,8.4,7.2).multiplyScalar(lit);
   headlight.intensity=HEADLIGHT_CD*n;tail.intensity=TAIL*n;
   lamps.head.emissiveIntensity=lampBase.head+n*7;lamps.tail.emissiveIntensity=lampBase.tail+n*3.5;
   muzzle.userData.boost=1+n*3.5;muzzle.distance=9+n*23;
   scroll+=speed*dt;flies.uniforms.time.value=time;flies.uniforms.scroll.value=scroll;flies.uniforms.pixel.value=renderer.getPixelRatio();
   flies.uniforms.strength.value=n*(1-.85*w);flies.points.visible=active&&ground&&flies.uniforms.strength.value>.01;
   // Rain streaks glitter where they cross the beam.
   const ru=weather.rainUniforms;
   if(lit>.01&&!detached){flashlight.getWorldPosition(beamPos);flashlight.target.getWorldPosition(beamDir).sub(beamPos).normalize();ru.beamPos.value.copy(beamPos);ru.beamDir.value.copy(beamDir);ru.beamCos.value=Math.cos(flashlight.angle);ru.beamTint.value.setRGB(1.5,1.45,1.3).multiplyScalar(lit);}
   else ru.beamTint.value.setRGB(0,0,0);
   // Eye shine: her tapetum throws the beam straight back, so it shows only
   // inside the cone, when she faces the gun and the viewer is near the lamp.
   const shine=rex?.gaze?.uniforms.eyeShine;
   if(shine){
    let s=0;
    if(lit>.01&&rex.actor.visible&&camera){
     const eye=rex.headPosition();flashlight.getWorldPosition(beamPos);flashlight.target.getWorldPosition(beamDir).sub(beamPos).normalize();
     toEye.subVectors(eye,beamPos);const d=toEye.length();toEye.divideScalar(d);
     const cone=T.MathUtils.smoothstep(toEye.dot(beamDir),Math.cos(flashlight.angle*1.05),Math.cos(flashlight.angle*.45));
     forward.subVectors(rex.mouthPosition().center,eye).normalize();const facing=T.MathUtils.smoothstep(-forward.dot(toEye),.1,.75);
     toCam.subVectors(camera.position,eye).normalize();const retro=T.MathUtils.smoothstep(toCam.dot(toEye.negate()),.9,.995);
     s=lit*cone*facing*retro/(1+d*.03);
    }
    shine.value=s;
   }
  }
 };
 return api;
}
