import * as T from 'three';
import {installAtmosphericFog,createSky,createEnvironmentMap,SUN_DIRECTION} from '../chase/atmosphere.js';
import {createPost} from '../chase/post.js';
import {TIERS,detectTier,storedQuality,storeQuality,createGovernor} from '../chase/graphics.js';
import {createJeep} from '../chase/jeep.js';
import {box} from '../chase/vehicle-geometry.js';
import {createRex} from '../chase/creature.js';
import {createCritters} from '../chase/critters.js';
import {createEffects} from '../chase/effects.js';
import {dustTexture} from '../chase/foliage.js';
import {createWeather} from '../chase/weather.js';
import {createNight} from '../chase/night.js';
import {createPointerControls} from '../chase/pointer-controls.js';
import {ChaseAudio} from '../chase/audio.js';
import {BREACH,BreachRound} from './rules.js';
import {createCompound} from './world.js';
import {createBreachDirector} from './director.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
installAtmosphericFog();
const renderer=new T.WebGLRenderer({canvas:$('scene'),antialias:false,powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.info.autoReset=false;
const scene=new T.Scene();scene.background=new T.Color(0x334945);scene.fog=new T.FogExp2(0x334945,.011);scene.environment=createEnvironmentMap(renderer);scene.environmentIntensity=.5;
const camera=new T.PerspectiveCamera(56,innerWidth/innerHeight,.045,180),post=createPost(renderer),governor=createGovernor(),detected=detectTier(renderer);
let quality=storedQuality(),tier=quality==='auto'?detected.tier:quality;
const hemi=new T.HemisphereLight(0xc0d8c7,0x474139,.8);scene.add(hemi);
const sun=new T.DirectionalLight(0xe2e7d3,3.8);sun.position.copy(SUN_DIRECTION).multiplyScalar(45).add(new T.Vector3(0,0,15));sun.target.position.set(0,0,15);sun.castShadow=true;sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;Object.assign(sun.shadow.camera,{left:-23,right:23,top:27,bottom:-27,near:1,far:110});scene.add(sun,sun.target);
const rim=new T.DirectionalLight(0xa5ceda,.9);rim.position.set(-6,13,34);scene.add(rim);const fill=new T.DirectionalLight(0xd3dbbb,.8);fill.position.set(5,8,-10);scene.add(fill);
// Shift the complete gun station (pedestal, gunner and weapon) forward to
// leave space for an attacker on the rear deck, with the muzzle in front of it.
const sky=createSky(scene),jeep=createJeep(scene,{gunOffset:-1.31}),effects=createEffects(scene,dustTexture()),audio=new ChaseAudio(),round=new BreachRound();
// A broad work lamp above the gun lights close faces without the narrow
// flashlight's inverse-square hotspot at the end of the barrel.
const workLamp=new T.SpotLight(0xffdfb0,42,13,.67,1,2);workLamp.position.set(0,3.6,-.35);workLamp.target.position.set(0,1.9,6);scene.add(workLamp,workLamp.target);
// A lowered tailgate provides a physical landing deck for the close attacker.
const deck=new T.MeshStandardMaterial({color:0x354333,roughness:.75,metalness:.3});box(jeep.root,deck,[2.02,.12,1.5],[0,1.01,2.5]);
const weather=createWeather(scene,{renderer,sky,makeEnvironment:createEnvironmentMap,reducedMotion:reduced});weather.captureBase({sun,hemi,rim,fill,post});weather.set('night-storm',{instant:true,persist:false});
const night=createNight(scene,{jeep,weather,renderer}),critters=createCritters(scene,{jungle:{chunks:[],groundAt:()=>0}});critters.reset({empty:true});
let world=null,rex=null,mode='loading',view='first',firing=false,time=0,last=performance.now(),radioTime=0,shake=0,damageFlash=0,hitTime=0,endAge=0,rexVisualDistance=43,freeze=false,ready=false,preview=null;
const aim=new T.Vector2(),raycaster=new T.Raycaster(),aimTarget=new T.Vector3(0,2,15),muzzle=new T.Vector3(),point=new T.Vector3(),hitPoint=new T.Vector3(),projected=new T.Vector3(),groundPlane=new T.Plane(new T.Vector3(0,1,0),0),cameraFrom=new T.Vector3(),cameraAt=new T.Vector3();
const vehicleState={phase:'pursuit',phaseTime:0,distance:20,reload:0,ammo:80,result:null,time:0};
let best=0;try{best=Math.max(0,Number(localStorage.getItem('rex-breach-best-v1'))||0);}catch{}$('best').textContent=best?`PERSONAL BEST  ${best.toLocaleString()} PTS`:'A TWO-MINUTE HOLDOUT · ONE WAY OUT';
function radio(text,seconds=4){$('radio-copy').textContent=text;radioTime=seconds;$('radio').style.opacity=1;}
const director=createBreachDirector(critters,round,{
 onLand(p){effects.bodyImpact(p,.4);audio.vehicleCrash();shake=Math.max(shake,.3);},
 onCue(type,a){if(mode!=='playing')return;
  if(type==='wave'){audio.cue(false);radio(a===1?'Movement at the fence. Keep them off the Jeep.':a===2?'More contacts. Use the grid when they enter the yard.':'They are coming in fast. Keep your escape route clear.');}
  if(type==='spawn')audio.call('raptor',a.c.p);
  if(type==='windup')audio.debrisWarning();
  if(type==='leap')audio.call('raptor',a.c.p);
  if(type==='bite'){audio.impact();shake=.5;}
  if(type==='killed')audio.death('raptor',a.c.p);
 }});
critters.onLand=(p,s)=>effects.bodyImpact(p,s*.3);
weather.onThunder=(delay,near)=>audio.thunder(delay,near);
function setMode(value){mode=value;document.body.dataset.state=value;if(value!=='playing')controls.reset();}
function moveReticle(){const x=(aim.x*.5+.5)*innerWidth,y=(.5-aim.y*.5)*innerHeight;for(const id of ['reticle','hit-marker']){$(id).style.left=`${x}px`;$(id).style.top=`${y}px`;}}
const controls=createPointerControls({canvas:$('scene'),fireButton:$('fire'),isPlaying:()=>mode==='playing'&&round.phase==='hold'&&!round.result,onAim:p=>{aim.set(p.x/innerWidth*2-1,1-p.y/innerHeight*2);moveReticle();},onFire:value=>firing=value,onGrenade:grenade,onContact:()=>{}});
function resize(){controls.reset();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<.8?78:56;camera.updateProjectionMatrix();moveReticle();}
addEventListener('resize',resize);
function applyQuality(){tier=quality==='auto'?detected.tier:quality;const t=TIERS[tier];renderer.setPixelRatio(Math.min(devicePixelRatio,t.pixelRatio));governor.setRange(t.scale);governor.reset();sun.shadow.mapSize.set(t.shadow,t.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;
 post.configure({scale:governor.scale,msaa:t.msaa,bloomLevels:t.bloomLevels,volumetric:null,ao:t.ao});critters.setQuality(t);effects.setQuality(t);weather.setQuality(t);night.setQuality(t);world?.setQuality(t);resize();
}
$('quality').value=quality;$('quality').onchange=()=>{quality=$('quality').value;storeQuality(quality);applyQuality();};applyQuality();
function pause(){if(!['playing','paused'].includes(mode))return;const paused=mode==='playing';setMode(paused?'paused':'playing');$('pause-screen').hidden=!paused;audio.pause(paused);}
$('pause').onclick=$('resume').onclick=pause;
$('sound').onclick=()=>{$('sound').textContent=audio.mute()?'SOUND OFF':'SOUND ON';};
$('reload').onclick=()=>{if(mode==='playing')round.startReload();};$('grenade').onclick=grenade;
function changeView(){view=view==='first'?'third':'first';$('view').textContent=view==='first'?'3RD':'1ST';}function light(){night.toggleFlashlight();$('light').setAttribute('aria-pressed',night.flashlightOn);}
$('view').onclick=changeView;$('light').onclick=light;
addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||e.repeat)return;if(['Space','KeyR','KeyV','KeyF','Escape','KeyP','KeyM'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'||e.code==='KeyP')pause();if(e.code==='KeyM')$('sound').click();if(mode!=='playing')return;
 if(e.code==='KeyR')round.startReload();if(e.code==='Space')grenade();if(e.code==='KeyV')changeView();if(e.code==='KeyF')light();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});addEventListener('blur',()=>{controls.reset();if(mode==='playing')pause();});
async function start(){if(!ready||mode==='starting')return;setMode('starting');$('start').disabled=true;
 try{await audio.init();await audio.pause(false);}catch(e){console.warn('Breach audio unavailable:',e.message);}
 round.reset();director.reset();world.reset();rex.reset();weather.reset();effects.reset();jeep.reset();night.reset();aim.set(0,0);time=0;endAge=0;rexVisualDistance=43;shake=damageFlash=hitTime=0;view='first';preview=null;$('view').textContent='3RD';$('light').setAttribute('aria-pressed','true');
 $('end-screen').hidden=$('pause-screen').hidden=$('start-screen').hidden=true;$('transition').style.opacity=0;$('start').disabled=false;setMode('playing');radio('Service exit offline. Hold your position while we restore power.',6);audio.cue(false);moveReticle();
}
$('start').onclick=$('restart').onclick=start;
function nearest(){raycaster.setFromCamera(aim,camera);const ray=raycaster.ray;let target=null,distance=90;
 const switchHit=raycaster.intersectObjects(world.switches,false)[0];if(switchHit){target={type:'switch',point:switchHit.point,distance:switchHit.distance};distance=target.distance;}
 const animal=director.hit(ray,distance);if(animal){target={type:'raptor',...animal};distance=animal.distance;}
 if(rex.actor.visible&&round.time>=BREACH.breach&&rex.aimHit(ray,hitPoint)){const d=ray.origin.distanceTo(hitPoint);if(d<distance){target={type:'rex',distance:d,point:hitPoint.clone()};distance=d;}}
 if(!target){const p=ray.intersectPlane(groundPlane,point);if(p&&ray.origin.distanceTo(p)<90)target={type:'ground',point:p.clone(),distance:ray.origin.distanceTo(p)};}
 return target;
}
function triggerTrap(){if(!round.discharge())return false;const caught=director.discharge();if(round.time>=BREACH.breach&&round.rexDistance<25)round.hitRex(BREACH.staggerHits);
 radio(caught?`Grid discharged. ${caught} contact${caught===1?'':'s'} down. Capacitors cycling.`:'Grid discharged. Capacitors need eighteen seconds to recharge.',3.5);return true;}
function shoot(){if(mode!=='playing'||!round.shoot())return false;const target=nearest();jeep.shoot();audio.gun();jeep.muzzle.getWorldPosition(muzzle);const end=target?.point||raycaster.ray.at(85,point);effects.trace(muzzle,end);shake=Math.max(shake,.025);
 if(target){if(target.type==='switch'){if(triggerTrap())hitTime=.12;else audio.hit('ground',target.distance,target.point);effects.burst(target.point,false);}
  else if(target.type==='raptor'){round.hits++;director.strike(target,raycaster.ray.direction);effects.burst(target.point,true);audio.hit('hide',target.distance,target.point);hitTime=.13;}
  else if(target.type==='rex'){round.hitRex(target.point.y>3.5?2:1);rex.hit();effects.burst(target.point,true);audio.hit('hide',target.distance,target.point);hitTime=.13;}
  else effects.burst(target.point,false);
 }return true;
}
function grenade(){if(mode!=='playing'||!round.launchGrenade())return;const target=nearest();const at=target?.point?.clone()||raycaster.ray.at(16,new T.Vector3());at.y=Math.max(.15,at.y);director.blast(at,5.5);
 if(round.time>=BREACH.breach&&rex.actor.visible&&rex.actor.position.distanceTo(at)<12)round.hitRex(10);
 if(target?.type==='switch')triggerTrap();effects.burst(at,true,true);audio.impact(true);shake=.35;hitTime=.2;
}
function events(){for(const e of round.drain()){
 if(e.type==='reload')audio.reload();
 if(e.type==='trap'){world.discharge();audio.woodBreak(.45);audio.groundImpact(.3,new T.Vector3(0,1,12));}
 if(e.type==='reveal'){audio.stopCalls();audio.roar(true);weather.strikeNow(camera);radio('Power surge. Something large is inside Paddock Seven.',4);}
 if(e.type==='breach'){audio.woodBreak(1.5);audio.vehicleCrash();effects.bodyImpact(new T.Vector3(0,.1,34),2.5);shake=.65;weather.strikeNow(camera);radio('Outer fence is down! Keep firing. The service exit is opening.',5);
  for(let i=0;i<18;i++)effects.debris('splinter',new T.Vector3((Math.random()-.5)*8,2+Math.random()*4,34),new T.Vector3((Math.random()-.5)*6,Math.random()*4,-4-Math.random()*5),1.2);
 }
 if(e.type==='gate'){audio.cue(true);radio('Exit motors responding. Hold the Rex back!',3.5);}
 if(e.type==='stagger'){rex.hit();audio.pain(true);radio('She is falling back. Keep her off the Jeep.',2);}
 if(e.type==='damage'){damageFlash=.8;shake=Math.max(shake,.35);}
 if(e.type==='escape'){controls.reset();audio.stopCalls();audio.cue(true);radio('Gate clear. GO! GO! GO!',4);}
 if(e.type==='lost'){setMode('ending');audio.stopCalls();audio.impact();radio(e.source==='rex'?'The Rex reached the Jeep.':'The raptors overran the vehicle.',2);endAge=0;}
 if(e.type==='won')finish();
 }}
function finish(){setMode('ended');audio.stopCalls();audio.update(0,0,false,false);$('end-screen').hidden=false;$('warning').hidden=$('target').hidden=true;
 const won=round.result==='won',newBest=round.score>best;best=Math.max(best,round.score);let saved=true;try{localStorage.setItem('rex-breach-best-v1',String(best));}catch{saved=false;}
 $('end-eyebrow').textContent=won?'SERVICE EXIT REACHED':'COMPOUND OVERRUN';$('end-title').textContent=won?'Gate cleared.':'They got through.';
 $('end-copy').textContent=won?'The Jeep is clear. Paddock Seven belongs to the dinosaurs again.':round.time>=BREACH.breach?'Sustained hits and grenades repel the Rex. Save a grid discharge for her charge.':'Watch for the crouch before a leap. Shoot the attacker off the deck before its first strike.';
 $('end-stats').textContent=`${round.score.toLocaleString()} points · ${round.kills} raptors repelled · ${round.trapKills} grid kills · ${round.staggers} Rex staggers`;
 $('end-best').textContent=saved?`${newBest?'NEW BEST · ':''}PERSONAL BEST ${best.toLocaleString()}`:'Storage unavailable. Your score is shown for this visit.';$('restart').focus({preventScroll:true});
}
function updateCamera(dt){
 const escape=round.phase==='escape',u=escape?T.MathUtils.smoothstep(round.escapeTime,0,1.5):0;
 if(view==='third'||escape){cameraFrom.set(4.7,3.75,-6.5);cameraAt.set(0,2,12);if(escape){cameraFrom.lerp(new T.Vector3(2.9,3.6,-6.5),u);cameraAt.lerp(new T.Vector3(0,1.8,2),u);}}
 else{cameraFrom.set(.06,2.48,-.45);cameraAt.set(0,2.35,18);}
 if(mode==='menu'||mode==='loading'){cameraFrom.set(4.8,3.7,-5.5);cameraAt.set(-.7,2.9,21);}
 const j=reduced?0:shake;cameraFrom.x+=Math.sin(time*67)*j*.12;cameraFrom.y+=Math.sin(time*79)*j*.1;
 camera.position.copy(cameraFrom);camera.lookAt(cameraAt);camera.updateMatrixWorld();
}
function hud(){const t=round.time,w=round.wave;const stage=t<7?'SERVICE EXIT OFFLINE':w===1?'WAVE 01 / FENCE CONTACTS':w===2?'WAVE 02 / PACK ATTACK':w===3?'WAVE 03 / HOLD THE LINE':w===4?'APEX BREACH / KEEP FIRING':'REGROUP / RELOAD';
 $('stage').textContent=stage;$('objective-title').textContent=round.phase==='escape'?'Gate clear. Move!':w===4?'Repel the Rex.':'Hold the compound.';
 const seconds=Math.ceil(round.remaining);$('clock').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 $('gate-progress').style.transform=`scaleX(${Math.min(1,t/BREACH.duration)})`;$('objective-detail').textContent=t>=BREACH.gateAt?`EXIT OPENING · ${Math.round(round.gate*100)}%`:`EXIT REBOOT · ${Math.round(Math.min(1,t/BREACH.gateAt)*100)}%`;
 $('integrity').innerHTML=`${Math.ceil(round.jeep)}<small>%</small>`;$('integrity-bar').style.transform=`scaleX(${round.jeep/100})`;$('ammo').innerHTML=`${String(round.ammo).padStart(3,'0')}<small>/ 080</small>`;$('heat').style.transform=`scaleX(${round.heat})`;
 $('weapon-status').textContent=round.reload>0?`RELOADING ${round.reload.toFixed(1)}s`:round.heat>=.98?'COOLING':'READY';$('score').textContent=`${round.score.toLocaleString()} PTS · ${round.kills} REPELLED`;
 $('grenade-state').textContent=round.grenade>0?`${Math.ceil(round.grenade)}s`:'READY';$('grid-label').textContent=round.trap>0?`GRID RECHARGING · ${Math.ceil(round.trap)}s`:'GRID READY';$('grid-tip').textContent=round.trap>0?'Wait for the blue switch lights.':'Shoot either blue switch to electrify the yard.';
 $('rex-meter').hidden=t<BREACH.breach||round.phase==='escape';$('stagger-progress').style.transform=`scaleX(${round.rexCharge/BREACH.staggerHits})`;
 const threat=director.warning,show=mode==='playing'&&round.phase==='hold';$('warning').hidden=!show||!threat;$('target').hidden=!show||!threat;
 if(threat&&show){const c=threat.c,board=threat.phase==='board';$('warning-title').textContent=board?'RAPTOR ON THE JEEP':threat.phase==='leap'?'INCOMING!':'RAPTOR PREPARING TO LEAP';$('warning-copy').textContent=board?'Shoot it off before it strikes.':'Keep firing at the marked attacker.';$('target-label').textContent=board?'SHOOT IT OFF':'LEAP';
  projected.copy(c.p).y+=c.kind.centre*c.scale;projected.project(camera);const x=(projected.x*.5+.5)*innerWidth,y=(.5-projected.y*.5)*innerHeight;
  $('target').hidden=projected.z>1||x<0||x>innerWidth||y<0||y>innerHeight;$('target').style.left=`${x}px`;$('target').style.top=`${y}px`;
 }
 $('damage-flash').style.opacity=damageFlash;$('hit-marker').style.opacity=Math.min(1,hitTime*10);$('radio').style.opacity=radioTime>0?1:0;
}
function step(dt){
 const playing=mode==='playing',sim=playing?dt:0;time=(time+(mode==='paused'||mode==='ended'?0:dt))%600;
 if(playing){round.tick(dt);const speed=round.phase==='escape'?10*T.MathUtils.smoothstep(round.escapeTime,0,1):0;if(speed)world.root.position.z+=speed*dt;director.update(dt,{speed});if(round.phase==='escape')round.rexDistance+=speed*dt;}
 else if(mode==='menu'&&preview){preview.c.phase=(time*.35)%1;preview.c.peck=.03*Math.sin(time);critters.updateDirected(0);}
 if(mode==='ending'){endAge+=dt;$('transition').style.opacity=Math.min(.65,endAge*.4);if(endAge>1.6)finish();}
 shake=Math.max(0,shake-sim*2.5);damageFlash=Math.max(0,damageFlash-sim*2.5);hitTime=Math.max(0,hitTime-sim);radioTime=Math.max(0,radioTime-(mode==='paused'?0:dt));
 updateCamera(dt);
 if(rex){rex.actor.visible=mode==='menu'||round.time>=BREACH.reveal;const visible=rex.actor.visible;
  rexVisualDistance+=(round.rexDistance-rexVisualDistance)*(1-Math.exp(-sim*9));
  if(visible&&mode!=='paused'&&mode!=='ended'){rex.update(sim,{phase:'pursuit',phaseTime:0,distance:mode==='menu'?43:rexVisualDistance,time},time,round.phase==='escape'?10:0,audio.vocalPose(sim));}
  for(const e of rex.drainMotionEvents()){if(e.type==='footfall'&&visible){effects.footstep(e.position,e.speed);if(playing)audio.footstep(.15,e.position);}}
 }
 const speed=playing&&round.phase==='escape'?10:0;Object.assign(vehicleState,{reload:round.reload,ammo:round.ammo,time});
 raycaster.setFromCamera(aim,camera);const aimingHit=ready?nearest():null;if(aimingHit)aimTarget.copy(aimingHit.point);else raycaster.ray.at(30,aimTarget);jeep.update(sim,time,speed,aimTarget,view==='third'||round.phase==='escape',vehicleState);
 weather.update(mode==='paused'||mode==='ended'?0:dt,speed,camera);weather.apply({sun,hemi,rim,fill,post});world?.update(mode==='paused'||mode==='ended'?0:dt,round,reduced);night.update(sim,{time,speed,camera,rex:rex?.actor.visible?rex:null});
 // The chase flashlight is tuned for a distant Rex. Lower its output when a
 // raptor is within arm's reach so the close hide/eyes retain their detail.
 const close=director.warning;if(close)night.flashlight.intensity*=T.MathUtils.clamp(((close.c.p.distanceTo(camera.position)-2)/8)**2,.035,1);
 // Ambient fill preserves readable silhouettes even during the scripted outage.
 hemi.intensity=Math.max(hemi.intensity,.3);fill.intensity=Math.max(fill.intensity,.55);scene.environmentIntensity=Math.max(scene.environmentIntensity,.17);night.tail.intensity*=.18;
 effects.update(sim,speed);audio.listen(camera,rex?.actor.visible?rex.headPosition():null);audio.weather(playing?weather.value:0);audio.update(speed,sim,playing,false);
 if(playing){if(firing)shoot();events();}hud();
}
function render(now){requestAnimationFrame(render);const dt=Math.min(.04,(now-last)/1000);last=now;if(!freeze)step(dt);
 sky.update(camera,time);post.settings.motionBlur=0;renderer.info.reset();if(post.supported)post.render(scene,camera,{time,sun,overlay:effects.soft.render});else renderer.render(scene,camera);
 if(governor.sample(dt*1000,mode==='playing'))post.configure({scale:governor.scale});
}
requestAnimationFrame(render);
async function load(){try{
 const [branch,loadedRex]=await Promise.all([new T.TextureLoader().loadAsync('./textures/jungle-branch.png'),createRex(scene),critters.ready()]);branch.colorSpace=T.SRGBColorSpace;
 rex=loadedRex;world=createCompound(scene,branch);world.setQuality(TIERS[tier]);preview=director.spawn(0);preview.c.p.set(2.3,0,12);preview.c.yaw=Math.PI+.25;preview.c.stride=0;critters.updateDirected(0);ready=true;
 $('loading-status').textContent='Mouse: hold to fire. Touch: drag to aim, hold FIRE.';$('start').textContent='HOLD THE COMPOUND ↗';$('start').disabled=false;setMode('menu');
 }catch(error){$('loading-status').textContent=`Could not load the encounter: ${error.message}. Reload to try again.`;console.error(error);}}
load();
window.breach={round,director,critters,renderer,scene,camera,jeep,weather,get world(){return world;},get rex(){return rex;},get mode(){return mode;},get ready(){return ready;},get view(){return view;},get quality(){return tier;},get freeze(){return freeze;},set freeze(v){freeze=v;},start,pause,step,shoot,grenade,triggerTrap,aimAt(p){aim.copy(p.clone().project(camera));moveReticle();},snapshot(){return{mode,time:round.time,phase:round.phase,result:round.result,jeep:round.jeep,kills:round.kills,score:round.score,rexDistance:round.rexDistance,live:director.live.length,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}};
