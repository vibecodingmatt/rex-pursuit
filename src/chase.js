import * as T from 'three';
import {installAtmosphericFog,createSky,createEnvironmentMap,createCanopy,SUN_DIRECTION} from './chase/atmosphere.js';
import {createPost} from './chase/post.js';
import {TIERS,ORDER,detectTier,storedQuality,storeQuality,createGovernor} from './chase/graphics.js';
import {createJungle} from './chase/environment.js';
import {createJeep} from './chase/jeep.js';
import {createRex} from './chase/creature.js';
import {createEffects} from './chase/effects.js';
import {ChaseAudio} from './chase/audio.js';
import {Encounter,RULES} from './chase/combat.js';
import {openingPose,createOpeningScenery} from './chase/opening.js';
import {createTargets} from './chase/targets.js';
import {createDebris} from './chase/debris.js';
import {AMBUSH} from './chase/ambush.js';
import {DEFEAT,defeatPose,defeatVision} from './chase/defeat.js';
import {createPointerControls} from './chase/pointer-controls.js';
import {createSwallow} from './chase/swallow.js';
import {VICTORY,victoryPose} from './chase/victory.js';
import {createVisitorCenter} from './chase/visitor-center.js';
import {setupSharing} from './chase/share.js';
import {createBirds} from './chase/birds.js';
import {createWeather,storedConditions} from './chase/weather.js';
const $=s=>document.querySelector(s),canvas=$('#scene');
installAtmosphericFog();
const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.info.autoReset=false;
const post=createPost(renderer),governor=createGovernor(),detected=detectTier(renderer);let quality=storedQuality(),autoTier=detected.tier;
const JUNGLE={fog:0x74825f,density:.0138,zenith:0x7ea8c6};let weather=null;
const scene=new T.Scene();scene.background=new T.Color(JUNGLE.fog);scene.fog=new T.FogExp2(JUNGLE.fog,JUNGLE.density);
const camera=new T.PerspectiveCamera(56,innerWidth/innerHeight,.045,240);
scene.environment=createEnvironmentMap(renderer);scene.environmentIntensity=.38;
// Key sun high over the left verge, cool sky rim from behind the animal, soft
// fill from the Jeep side, warm earth bounce from below.
const hemi=new T.HemisphereLight(0xa9bf9a,0x463a26,.6);scene.add(hemi);
const sun=new T.DirectionalLight(0xffd9a6,4.1);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.normalBias=.04;sun.shadow.bias=-.00025;
const rim=new T.DirectionalLight(0xc4d4e4,.6);rim.position.set(-6,10,34);scene.add(rim);
const fill=new T.DirectionalLight(0xdce3d4,.62);fill.position.set(7,6,-12);scene.add(fill);
const sky=createSky(scene),canopy=createCanopy(scene,sun);
// Location lighting sets every value the storm blends from, then records it.
function baseLights(){sun.intensity=4.1;sun.color.setHex(0xffd9a6);fill.intensity=.62;scene.environmentIntensity=.38;hemi.color.setHex(0xa9bf9a);hemi.groundColor.setHex(0x463a26);rim.position.set(-6,10,34);}
function jungleLighting(){
 baseLights();scene.background.setHex(JUNGLE.fog);scene.fog.color.setHex(JUNGLE.fog);scene.fog.density=JUNGLE.density;
 sun.target.position.set(0,0,13);sun.position.copy(sun.target.position).addScaledVector(SUN_DIRECTION,55);
 Object.assign(sun.shadow.camera,{left:-28,right:28,top:31,bottom:-31,near:4,far:125});sun.shadow.camera.updateProjectionMatrix();
 sky.palette(scene.fog.color,JUNGLE.zenith);sky.uniforms.sunDir.value.copy(SUN_DIRECTION);canopy.enabled=true;rim.intensity=.6;hemi.intensity=.62;
 weather?.captureBase({sun,hemi,rim,fill,post});
}
function tierName(){return quality==='auto'?autoTier:quality;}
function applyQuality(){
 const t=TIERS[tierName()];renderer.setPixelRatio(Math.min(devicePixelRatio,t.pixelRatio));governor.setRange(t.scale);governor.reset();
 if(sun.shadow.mapSize.x!==t.shadow){sun.shadow.mapSize.set(t.shadow,t.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;}
 post.configure({scale:governor.scale,msaa:t.msaa,bloomLevels:t.bloomLevels,volumetric:t.volumetric});jungle?.setQuality?.(t);effects?.setQuality?.(t);weather?.setQuality(t);
 document.body.dataset.quality=tierName();document.body.dataset.post=post.supported?'on':'off';document.querySelectorAll('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quality===quality)));
 const gpu=(detected.gpu.match(/(rtx|gtx|rx|arc|radeon|apple md|adreno|mali|intel|iris|uhd)[^,(]*/i)?.[0]||'').replace(/s+/g,' ').trim().toUpperCase();
 document.querySelectorAll('.quality-readout').forEach(e=>e.textContent=`Rendering ${t.label.toUpperCase()}${quality==='auto'?' (auto)':''}${gpu?' · '+gpu:''} · ${t.volumetric?'volumetric light':'light shafts'} · ${t.msaa}× MSAA`);
 document.querySelectorAll('.quality-readout-inline').forEach(e=>e.textContent=`${t.label.toUpperCase()} QUALITY`);
 resize();
}
function setQuality(next){if(next!=='auto'&&!TIERS[next])return;quality=next;storeQuality(next);autoTier=detected.tier;applyQuality();}
jungleLighting();
const jungleRoot=new T.Group();scene.add(jungleRoot);
const jungle=createJungle(jungleRoot,{canopy}),jeep=createJeep(scene),effects=createEffects(scene,jungle.dustMap),audio=new ChaseAudio(),state=new Encounter();
const visitorCenter=createVisitorCenter(scene);
const swallow=createSwallow(renderer);
const opening=createOpeningScenery(scene,jungle.dustMap);let targets;
const ambushScenery=createOpeningScenery(scene,jungle.dustMap,{offsetZ:-6,anchorAt:1.28});
ambushScenery.root.scale.x=-1;
const debris=createDebris(scene,camera,$('#target-layer'));
const birds=createBirds(scene);
const raycaster=new T.Raycaster(),pointer=new T.Vector2(),aimTarget=new T.Vector3(0,3.7,16);let rex,mode='loading',view='first',firing=false,breathClock=0,stomp=0,stompVel=0,stompOffset=0,time=0,last=performance.now(),shake=0,gunKick=0,hitTime=0,damageFlash=0,endTime=0,frameCount=0,freeze=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
weather=createWeather(scene,{renderer,sky,makeEnvironment:createEnvironmentMap,reducedMotion});weather.captureBase({sun,hemi,rim,fill,post});
weather.onThunder=(delay,near)=>audio.thunder(delay,near);
function setConditions(kind){weather.set(kind,{instant:mode==='paused'});weather.apply({sun,hemi,rim,fill,post});document.querySelectorAll('[data-conditions]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.conditions===weather.kind)));document.body.dataset.conditions=weather.kind;}
document.querySelectorAll('[data-conditions]').forEach(b=>b.onclick=()=>setConditions(b.dataset.conditions));setConditions(storedConditions());
// ?fps shows frame rate, frame time, tier and render scale for performance checks.
const fpsMeter=new URLSearchParams(location.search).has('fps')?Object.assign(document.body.appendChild(document.createElement('div')),{id:'fps-meter'}):null;let fpsFrames=0,fpsSince=performance.now();
if(fpsMeter)fpsMeter.style.cssText='position:fixed;left:8px;top:8px;z-index:9999;padding:3px 7px;font:600 11px/1.3 ui-monospace,monospace;color:#e8f0d8;background:#000a;pointer-events:none;white-space:pre';
const hud={boss:$('#boss-fill'),trail:$('#boss-trail'),percent:$('#boss-percent'),phase:$('#boss-phase'),jeep:$('#jeep-value'),jeepFill:$('#jeep-fill'),ammo:$('#ammo-value'),heat:$('#heat-fill'),weapon:$('#weapon-state'),distance:$('#distance'),grenade:$('#grenade-state'),warning:$('#warning'),warningTitle:$('#warning-title'),warningTip:$('#warning-tip'),reticle:$('#reticle'),hit:$('#hit-marker'),hitLabel:$('#hit-label'),flash:$('#damage-flash')};
const arcade={clock:$('#mission-clock'),time:$('#time-left'),pressure:$('#pressure-level'),card:$('#challenge-card'),name:$('#challenge-name'),seconds:$('#challenge-seconds'),instruction:$('#challenge-instruction'),fill:$('#challenge-fill'),progress:$('#challenge-progress')};
const touchHud={fire:$('#touch-fire'),fireStatus:$('#touch-fire small'),reload:$('#touch-reload'),reloadStatus:$('#touch-reload small'),grenade:$('#touch-grenade'),grenadeStatus:$('#touch-grenade small'),contact:$('#touch-contact')};let controls;
function resize(){controls?.reset();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();swallow.resize(innerWidth,innerHeight);moveReticle();}addEventListener('resize',resize);applyQuality();
document.querySelectorAll('[data-quality]').forEach(b=>b.onclick=()=>setQuality(b.dataset.quality));
function setMode(next){mode=next;document.body.dataset.state=next;if(next!=='playing')controls?.reset();}
function setView(next){if(state.result==='lost'&&next!=='first'||state.result==='won'&&next!=='third')return;view=next;document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===view));}
function moveReticle(){const x=(pointer.x*.5+.5)*innerWidth,y=(-pointer.y*.5+.5)*innerHeight;hud.reticle.style.left=`${x}px`;hud.reticle.style.top=`${y}px`;}
controls=createPointerControls({canvas,fireButton:touchHud.fire,isPlaying:()=>mode==='playing'&&!state.result,
 onAim:point=>{pointer.set(point.x/innerWidth*2-1,1-point.y/innerHeight*2);moveReticle();},onFire:held=>firing=held,onGrenade:grenade,
 onContact:point=>{touchHud.contact.hidden=!point;if(!point)return;touchHud.contact.style.left=`${point.x}px`;touchHud.contact.style.top=`${point.y}px`;const dx=point.aim.x-point.x,dy=point.aim.y-point.y;touchHud.contact.style.setProperty('--reach',`${Math.max(0,Math.hypot(dx,dy)-22)}px`);touchHud.contact.style.setProperty('--angle',`${Math.atan2(dx,-dy)}rad`);}});
touchHud.reload.onclick=()=>mode==='playing'&&state.startReload();touchHud.grenade.onclick=grenade;
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setView(b.dataset.camera));$('#grenade').onclick=grenade;
addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||(e.code==='Space'&&e.target.closest('button,a')))return;if(['Space','KeyR','KeyV','Escape','KeyP','KeyM'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='KeyV')setView(view==='first'?'third':'first');if(e.code==='KeyM')toggleSound();if((e.code==='Escape'||e.code==='KeyP')&&['playing','paused'].includes(mode))pause();if(mode!=='playing')return;if(e.code==='KeyR')state.startReload();if(e.code==='Space')grenade();});
function toggleSound(){const muted=audio.mute();$('#sound').textContent=muted?'SOUND OFF':'SOUND ON';$('#sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');}$('#sound').onclick=toggleSound;
function pause(){firing=false;const paused=mode==='playing';setMode(paused?'paused':'playing');$('#pause-screen').hidden=!paused;audio.pause(paused);hud.warning.style.opacity=0;}
$('#pause').onclick=()=>['playing','paused'].includes(mode)&&pause();$('#resume').onclick=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
addEventListener('blur',()=>{controls.reset();if(mode==='playing')pause();});
$('#credits-open').onclick=()=>$('#credits').showModal();$('#credits-close').onclick=()=>$('#credits').close();
async function start(){
 if(!rex)return;controls.reset();$('#start').disabled=true;$('#start-label').textContent='STARTING THE ENGINE';
 try{await audio.init();}catch(e){console.warn('Audio initialization failed',e.message);}
 audio.stopCalls();state.reset();
 state.introDuration=Math.max(RULES.intro,RULES.roarAt+(audio.buffers.get(audio.roles.opening)?.duration||3.64)/.95+1.5);
 rex.reset();effects.reset();birds.reset();jeep.reset();jungle.reset();opening.reset();ambushScenery.reset();targets?.reset();debris.reset();swallow.reset();visitorCenter.reset();sharing.reset();
 jungleRoot.visible=true;rex.actor.visible=true;jungleLighting();canopy.reset();
 $('#arrival-caption').style.opacity=0;
 time=0;endTime=0;shake=0;stomp=stompVel=stompOffset=0;damageFlash=0;firing=false;pointer.set(0,.08);moveReticle();
 $('#fatal-blood').style.opacity=$('#fatal-black').style.opacity=0;jeep.root.visible=true;updateVision();
 camera.position.set(.06,2.4,-.45);cameraLook.set(-10,3.2,16);camera.lookAt(cameraLook);
 $('#start-screen').hidden=true;$('#end-screen').hidden=true;$('#pause-screen').hidden=true;setMode('playing');updateHud();
}
$('#start').onclick=start;$('#restart').onclick=start;
const sharing=setupSharing({button:$('#share-game'),copyButton:$('#copy-game-link'),status:$('#share-status'),fallback:$('#share-fallback'),input:$('#share-link'),getState:()=>state});
// World point under the reticle: Rex proxy, else the ground, else far down range.
const groundPlane=new T.Plane(new T.Vector3(0,1,0),0);
function aimPoint(out){if(rex?.aimHit(raycaster.ray,out))return out;if(raycaster.ray.intersectPlane(groundPlane,out)&&out.distanceTo(raycaster.ray.origin)<90)return out;return raycaster.ray.at(80,out);}
function getHit(){scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);raycaster.far=170;return rex.actor.visible?raycaster.intersectObjects(rex.meshes,false)[0]:undefined;}
function weaponHit(hit,explosive){const rest=rex.damage.add(hit,explosive),head=rest?rest.z>4.75:false;state.hit(head,explosive);rex.hit();effects.burst(hit.point,true,explosive);showHit(explosive?'EXPLOSIVE HIT':'HIT');}
function showHit(label,color='#eee8c9'){
 hitTime=.18;hud.hit.style.left=hud.hitLabel.style.left=hud.reticle.style.left;hud.hit.style.top=hud.reticle.style.top;hud.hitLabel.style.top=`${(-pointer.y*.5+.5)*innerHeight+28}px`;hud.hitLabel.textContent=label;hud.hit.style.color=color;
}
function targetHit(index,explosive=false){
 if(index<0||!state.hitTarget(index,explosive))return;
 showHit('TARGET HIT','#ffe2a0');
}
function debrisHit(hit,explosive=false){if(!state.hitDebris(hit.id,explosive))return;effects.burst(hit.point,false,explosive);showHit(state.debris.status==='cleared'?'DEBRIS CLEARED':'DEBRIS HIT','#ffb38e');}
function shoot(){
 if(mode!=='playing'||!state.fire())return false;
 const hit=getHit(),threat=debris.hit(raycaster.ray,hit?.distance),target=threat?-1:targets?.hit(raycaster.ray,state)??-1,origin=jeep.muzzle.getWorldPosition(new T.Vector3());
 const end=threat?threat.point:hit?hit.point:target>=0?targets.targets[target].world:aimPoint(new T.Vector3());
 effects.trace(origin,end);jeep.shoot();audio.gun();gunKick=.035;
 if(threat)debrisHit(threat);else if(hit)weaponHit(hit,false);else if(target>=0){state.hit(false);effects.burst(end,true);}
 else if(end.y<.05)effects.burst(end,false);
 targetHit(target);return !!threat||!!hit||target>=0;
}
function grenade(){
 if(mode!=='playing'||!state.launch())return false;
 const hit=getHit(),threat=debris.hit(raycaster.ray,hit?.distance),target=threat?-1:targets?.hit(raycaster.ray,state)??-1,origin=jeep.muzzle.getWorldPosition(new T.Vector3()),point=threat?threat.point:hit?hit.point:target>=0?targets.targets[target].world:raycaster.ray.at(40,new T.Vector3());
 effects.trace(origin,point);if(threat)debrisHit(threat,true);else if(hit)weaponHit(hit,true);else{effects.burst(point,false,true);if(target>=0)state.hit(false,true);}
 targetHit(target,true);audio.impact(true);shake=.2;return !!threat||!!hit||target>=0;
}
function updateHud(){
 const health=state.health/RULES.health;hud.boss.style.transform=hud.trail.style.transform=`scaleX(${health})`;hud.percent.textContent=`${Math.ceil(health*100)}%`;
 hud.phase.textContent=({intro:'JUNGLE BREAKOUT',pursuit:'IN PURSUIT',warning:'ATTACK INCOMING',challenge:'BREAK THE ATTACK',charge:'CLOSING FAST',bite:'BRACE FOR IMPACT',ram:'SIDE IMPACT',recover:'REGAINING GROUND',stunned:'ATTACK REPELLED',execution:'OVERRUN'})[state.phase]||'IN PURSUIT';
 if(state.phase==='flank')hud.phase.textContent=state.phaseTime<AMBUSH.vanish?'BREAKING OFF':state.phaseTime<AMBUSH.crashAt?'CONTACT LOST':'TOO CLOSE';
 $('#boss-status').textContent=state.tier===2?'RELENTLESS':health<.3?'ENRAGED':health<.65?'WOUNDED':'APEX PREDATOR';
 hud.jeep.textContent=state.jeep;hud.jeepFill.style.transform=`scaleX(${state.jeep/100})`;hud.jeepFill.style.background=state.jeep<30?'#e67950':'#e8be75';
 hud.ammo.textContent=String(state.ammo).padStart(3,'0');hud.heat.style.transform=`scaleX(${state.reload?1-state.reload/RULES.reload:state.heat})`;hud.heat.style.background=state.overheated?'#e9794b':'#d4b171';
 hud.weapon.textContent=state.phase==='intro'?'HOLD FIRE':state.phase==='execution'?'OVERRUN':state.reload?`RELOADING ${state.reload.toFixed(1)}s`:state.overheated?'COOLING':state.ammo===0?'PRESS R':'READY';
 if(state.ammo===0&&!state.reload&&matchMedia('(pointer:coarse)').matches)hud.weapon.textContent='TAP RELOAD';
 touchHud.fireStatus.textContent=state.weaponsLocked?'WAIT':state.reload?'RELOADING':state.overheated?'COOLING':'HOLD';
 touchHud.fire.classList.toggle('waiting',!!state.reload||state.overheated||state.weaponsLocked);
 touchHud.reloadStatus.textContent=state.reload?`${state.reload.toFixed(1)}s`:state.ammo===RULES.magazine?'FULL':'READY';
 touchHud.reload.setAttribute('aria-disabled',String(!!state.reload||state.ammo===RULES.magazine||!!state.result));
 touchHud.grenadeStatus.textContent=state.grenade?`${Math.ceil(state.grenade)}s`:'READY';touchHud.grenade.setAttribute('aria-disabled',String(state.grenade>0||state.weaponsLocked||!!state.result));
 if(state.phase==='flank'&&state.weaponsLocked&&!state.reload)hud.weapon.textContent='WATCH THE TREES';
 hud.distance.textContent=`${Math.max(0,Math.round(state.distance-7))} m · ${state.phase==='charge'?'CLOSING FAST':'IN PURSUIT'}`;hud.grenade.textContent=state.grenade?`${Math.ceil(state.grenade)}s`:'READY';
 const o=state.objective,challenge=state.phase==='challenge'&&o?.status==='active'&&!state.result;
 document.body.dataset.cinematic=state.result==='lost'?'defeat':state.result==='won'?'victory':state.phase==='intro'?'intro':state.phase==='flank'?'flank':challenge?'challenge':'';
 arcade.clock.hidden=state.phase==='intro';const remaining=Math.ceil(state.remaining);arcade.time.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;arcade.clock.classList.toggle('urgent',remaining<=20);arcade.pressure.textContent=`PRESSURE ${['I','II','III'][state.tier]}`;
 arcade.card.hidden=!challenge;
 if(state.phase==='flank'){arcade.pressure.textContent=state.phaseTime<AMBUSH.vanish?'BREAKING OFF':'CONTACT LOST';hud.distance.textContent=state.phaseTime<AMBUSH.crashAt?'SEARCHING THE TREELINE':'RIGHT BEHIND US';if(state.phaseTime>=AMBUSH.crashAt)arcade.pressure.textContent='CONTACT REGAINED';}
 if(challenge){arcade.name.textContent=['BREAK THE LUNGE','STOP THE RUSH','BREAK THE FRENZY'][o.tier];arcade.seconds.textContent=`${o.remaining.toFixed(1)}s`;arcade.instruction.textContent=`Shoot ${o.order.length} numbered targets in order · ${o.hitsRequired} hit${o.hitsRequired===1?'':'s'} each`;arcade.fill.style.transform=`scaleX(${o.remaining/o.duration})`;arcade.progress.textContent=`TARGET ${o.current+1} / ${o.order.length}`;arcade.card.classList.toggle('critical',o.remaining<1.3);}
 const incoming=state.debris?.status==='active'&&!state.result;$('#challenge-hazard').classList.toggle('incoming',incoming);$('#challenge-hazard').textContent=incoming?`DEBRIS IN ${(state.debris.duration-state.debris.age).toFixed(1)}s`:'MISS IT → TAKE A HIT';
 let title='',tip='';
 if(state.phase==='flank'){
  const t=state.phaseTime;
  title=t<2.35?'SHE’S BREAKING OFF':t<5.6?'DID WE LOSE HER?':t<AMBUSH.crashAt?'':'SHE’S RIGHT BEHIND US!';
  tip=t>=2.35&&t<5.6?'RELOAD · WATCH THE TREES':t>=AMBUSH.fireAt?'OPEN FIRE!':'';
 }
 if(state.phase==='intro'){const t=state.phaseTime,launch=state.introDuration-3.2;title=t<1.25?'SOMETHING IN THE TREES':t<RULES.roarAt?'HOLD ON':t<launch?'DON’T. MOVE.':'GO! GO! GO!';tip=t<launch?'':'90 SECONDS TO STOP HER';}
 if(state.phase==='warning'){title='TARGETS INCOMING';tip='SHOOT THE NUMBERED WEAK POINTS · GET READY';}
 if(state.phase==='charge'){title=state.attackCommitted?'TOO SLOW':'BREAK THE CHARGE';tip=state.attackCommitted?'SHE’S COMMITTED · BRACE FOR IMPACT':`AIM FOR THE HEAD · ${Math.max(0,10-state.stagger)} HITS TO STAGGER`;}
 if(state.phase==='bite'||state.phase==='ram'){title=state.phase==='ram'?'SIDE IMPACT':'BRACE FOR IMPACT';}
 if(state.phase==='stunned'){title='ATTACK REPELLED';tip='RELOAD WHILE SHE FALLS BACK';}
 if(incoming&&['pursuit','recover','stunned'].includes(state.phase)){title='INCOMING DEBRIS';tip=`SHOOT THE RED TARGET · ${state.debris.hitsRequired-state.debris.hits} HITS · HE CLEARS IT`;}
 if(state.phase==='execution'){title='TIME’S UP';tip='SHE’S GOT US';}
 if(state.result==='won'){title=tip='';hud.phase.textContent='PREDATOR DOWN';$('#boss-status').textContent='DEFEATED';hud.distance.textContent='THREAT NEUTRALIZED';}
 if(state.result==='lost'){title=tip='';arcade.card.hidden=true;}
 hud.warningTitle.textContent=title;hud.warningTip.textContent=tip;hud.warning.style.opacity=title&&mode==='playing'?1:0;hud.warning.classList.toggle('danger',['charge','bite','ram','execution'].includes(state.phase));
}
function handleEvents(){for(const event of state.drainEvents()){
 if(event==='flank')audio.stopCalls();
 if(event==='contact-lost')audio.stopCalls();
 if(event==='ambush-rustle')audio.woodBreak(.35);
 if(event==='ambush-crash'){effects.bodyImpact(new T.Vector3(4,.04,9),1.5);audio.woodBreak();audio.groundImpact(.95);audio.roar();shake=.85;birds.scatter(new T.Vector3(9,13,16),{spread:10,count:14});}
 if(event==='jungle-crash'){effects.bodyImpact(new T.Vector3(-5.5,.04,16),1.3);audio.impact();audio.groundImpact(.85);shake=.35;}
 if(event==='opening-roar'){audio.roar(true);birds.scatter(new T.Vector3(-4,15,38),{spread:22});}
 if(event==='jeep-launch')shake=.12;
 if(event==='warning'&&!audio.voice)audio.roar();
 if(event==='challenge')audio.cue();
 if(event==='charge')audio.growl();
 if(['bite','ram','execution'].includes(event))audio.bite();
 if(event==='target-cleared')audio.cue();
 if(event==='objective-cleared')audio.cue(true);
 if(event==='branch-break'){debris.breakBranch(state.debris);audio.woodBreak(.75);shake=Math.max(shake,.16);}
 if(event==='debris-incoming')audio.debrisWarning();
 if(event==='debris-cleared'){debris.shatter();audio.cue(true);}
 if(event==='debris-impact'){debris.shatter();audio.groundImpact(.45);}
 if(event==='impact'){shake=state.lossReason==='timeout'?1:.8;damageFlash=.85;audio.impact();}
 if(event==='stunned'){shake=.13;audio.pain(true);}
 if(event==='reload')audio.reload();
 if(event==='won'){
  audio.stopCalls();audio.pain(true);controls.reset();endTime=0;damageFlash=0;state.reload=0;
  state.victory={time:0,arrival:false,exterior:view==='third',camera:camera.position.toArray(),look:cameraLook.toArray(),fov:camera.fov};
  setView('third');targets.reset();debris.reset();
 }
 if(event==='lost'){
  audio.stopCalls();audio.growl();controls.reset();endTime=0;damageFlash=0;shake=.16;
  state.defeat={time:0,x:rex.actor.position.x,z:rex.actor.position.z,heading:rex.actor.rotation.y,speed:state.phase==='execution'?Math.max(1,10-state.phaseTime*6):10,cues:new Set()};
  if(state.objective)state.objective.status='cancelled';if(state.debris)state.debris.status='cancelled';targets.reset();debris.reset();
  setView('first');camera.position.set(.06,2.4,-.45);cameraLook.set(0,3.4,12);camera.lookAt(cameraLook);camera.fov=62;camera.updateProjectionMatrix();
 }
}}
function handleMotionEvents(playing){for(const e of rex.drainMotionEvents()){
 if(e.type==='footstep'){effects.footstep(e.position,e.speed);if(playing&&!(state.result==='lost'&&endTime>DEFEAT.contact)){const concealed=state.phase==='flank'&&state.phaseTime>=AMBUSH.vanish&&state.phaseTime<AMBUSH.returnAt;audio.footstep(.22*Math.min(1,18/state.distance)*(concealed?.13:1));
   // Each footfall carries through the ground: a small jolt that grows as she closes.
   // No stomp while aiming at targets or debris: the framing must hold still.
   const aiming=['warning','challenge'].includes(state.phase)||state.debris?.status==='active';
   if(!concealed&&!aiming&&!(state.result==='lost'&&endTime>DEFEAT.openAt-.4)){const d=Math.hypot(e.position.x,e.position.z);stomp=Math.max(stomp,.045*T.MathUtils.clamp(1-(d-7)/13,0,1));}}}
 if(e.type==='body-impact'){effects.bodyImpact(e.position,e.strength);if(playing){audio.groundImpact(e.strength);shake=Math.max(shake,e.strength*.38);}}
 if(e.type==='body-slide')effects.bodySlide(e.position,e.strength);
}}
function finish(){
 setMode('ended');audio.stopCalls();$('#end-screen').hidden=false;const won=state.result==='won',timeout=state.lossReason==='timeout';
 $('#end-eyebrow').textContent=won?'VISITOR CENTER REACHED':timeout?'ESCAPE WINDOW CLOSED':'JEEP LOST';$('#end-title').textContent=won?'You made it.':timeout?'Time ran out.':'Too close.';
 $('#end-copy').textContent=won?'The Jeep is safe at the Visitor Center. Take a breath. You earned it.':timeout?'She caught the Jeep. Take her down before the 90-second clock reaches zero.':'Break her attacks with the numbered targets. Shoot incoming debris—or save a grenade to clear it.';
 $('#end-stats').textContent=`${Math.floor(state.fightTime)}s · ${state.objectivesCleared} attacks repelled · ${state.debrisCleared} debris cleared`;hud.warning.style.opacity=0;arcade.card.hidden=true;audio.update(0,0,false,false);sharing.reset();$('#restart').focus({preventScroll:true});
}
const cameraTarget=new T.Vector3(),cameraPos=new T.Vector3(),cameraLook=new T.Vector3(0,3.16,18);
function updateCamera(dt){
 if(state.result==='won'&&state.victory){
  const v=state.victory,p=victoryPose(v.time,state.distance),portrait=innerHeight>innerWidth;
  if(p.arrival){
   const crane=reducedMotion?p.crane*.65:p.crane;
   cameraPos.set(p.jeepX+T.MathUtils.lerp(6,portrait?7:16,crane),T.MathUtils.lerp(3.4,portrait?5.5:6.4,crane),p.jeepZ+T.MathUtils.lerp(portrait?25:12,portrait?54:32,p.crane));
   cameraTarget.set(p.jeepX,1.8,p.jeepZ-3).lerp(new T.Vector3(0,8.2,-72),.3+p.crane*.6);
   camera.fov=portrait?64:54;
  }else{
   cameraPos.fromArray(v.camera).lerp(new T.Vector3(portrait?-3.4:-5.2,4.5,-8),p.pullback);
   cameraTarget.fromArray(v.look).lerp(new T.Vector3(0,2.5,10),p.pullback);camera.fov=T.MathUtils.lerp(v.fov,portrait?68:58,p.pullback);
  }
  camera.position.copy(cameraPos);cameraLook.copy(cameraTarget);camera.lookAt(cameraLook);camera.updateProjectionMatrix();camera.updateMatrixWorld();return;
 }
 const menu=mode==='menu'||mode==='loading',third=view==='third'||menu,intro=mode==='playing'&&state.phase==='intro',challenge=state.phase==='challenge'&&!state.result;let fov=56;
 const fatal=state.result==='lost'&&state.defeat?defeatPose(state.defeat.time,state.defeat):null;
 if(menu){cameraPos.set(-4+Math.sin(time*.11)*.7,3+Math.sin(time*.17)*.22,-1.3+Math.sin(time*.07)*.5);cameraTarget.set(2.2,2.65+Math.sin(time*.13)*.12,17);fov=48;}
 else if(third){cameraPos.set(-3.6,4.6,-8.4);cameraTarget.set(0,2.6,10);fov=58;}
 else{cameraPos.set(.06,2.40,-.45);cameraTarget.set(0,3.16,18);}
 if(intro){const p=openingPose(state.phaseTime,state.introDuration),look=T.MathUtils.smoothstep(state.phaseTime,.8,3.3);cameraPos.set(.06,2.45,-.45);cameraTarget.set(T.MathUtils.lerp(-10,0,look),T.MathUtils.lerp(3.1,3.9,look),16+2*p.launch);fov=T.MathUtils.lerp(64,54,look);}
 else if(challenge){cameraPos.set(...(third?[-2.4,3.55,-5.8]:[.06,2.52,-.40]));cameraTarget.set(0,3.35,13);fov=third?54:52;}
 if(!menu&&state.phase==='flank'){
  const t=state.phaseTime,returning=T.MathUtils.smoothstep(t,6.2,7.15);
  cameraTarget.set(T.MathUtils.lerp(2.8*Math.sin(Math.min(1,t/3)*Math.PI/2),0,returning),T.MathUtils.lerp(3.2,3.65,returning),T.MathUtils.lerp(18,8,returning));
  fov=T.MathUtils.lerp(third?58:56,third?66:65,returning);
  if(innerWidth<600){cameraTarget.y=T.MathUtils.lerp(3.3,4.1,returning);if(third)cameraPos.x=-1.5;else if(rex)cameraTarget.x=T.MathUtils.lerp(cameraTarget.x,rex.headPosition().x,returning*.85);}
 }
 if(challenge&&(innerWidth<600||(matchMedia('(pointer:coarse)').matches&&innerHeight>innerWidth)))cameraTarget.y=4.5+Math.max(0,800-innerHeight)*.0065+(innerHeight<740?.25:0);
 else if(challenge&&innerHeight<570)cameraTarget.y=4.9;
 if(innerWidth<600){fov=intro?70:state.phase==='flank'?72:third?68:64;if(menu){cameraPos.set(3.2,3.3,5);cameraTarget.set(.4,3.3,14);fov=61;}}
 if(fatal){
  const t=state.defeat.time,mouth=rex.mouthPosition(),focus=T.MathUtils.smoothstep(t,DEFEAT.lungeAt+.05,DEFEAT.contact-.04),axis=new T.Vector3(0,1,0),offset=new T.Vector3(fatal.jeepX,0,fatal.jeepZ);
  // Rotate the player's seat with the actual Jeep, so the scenery makes one
  // full revolution while the cage remains anchored around the player.
  cameraPos.set(.06,2.4-Math.sin(Math.PI*T.MathUtils.smoothstep(t,DEFEAT.ram,DEFEAT.spinEnd))*.18,-.45).applyAxisAngle(axis,fatal.jeepYaw).add(offset);
  cameraTarget.set(0,2.95,16).applyAxisAngle(axis,fatal.jeepYaw).add(offset);
  if(t<DEFEAT.ram)cameraTarget.lerp(mouth.center,T.MathUtils.smoothstep(t,0,1.0));
  if(t>=DEFEAT.spinEnd){const gazeY=T.MathUtils.lerp(mouth.center.y,3.25,fatal.look*(1-focus));cameraTarget.lerp(new T.Vector3(mouth.center.x,gazeY,Math.max(fatal.jeepZ+2,mouth.center.z+1.4)),T.MathUtils.smoothstep(t,DEFEAT.spinEnd,5.4));cameraPos.x=T.MathUtils.lerp(cameraPos.x,mouth.center.x,focus);cameraPos.y=T.MathUtils.lerp(cameraPos.y,mouth.center.y,focus);}
  fov=T.MathUtils.lerp(innerWidth<600?80:72,innerWidth<600?67:54,T.MathUtils.smoothstep(t,DEFEAT.openAt,DEFEAT.contact));
 }
 const intensity=reducedMotion?.2:1,speed=fatal?fatal.speed/10:state.phase==='intro'?openingPose(state.phaseTime,state.introDuration).launch:1;
 if(mode==='playing'){cameraPos.y-=stompOffset*intensity;cameraPos.x+=Math.sin(time*17)*.011*intensity*speed;cameraPos.y+=(Math.sin(time*18)*.014+Math.sin(time*27)*.01)*intensity*speed;cameraPos.x+=(Math.random()-.5)*shake*.32*intensity;cameraPos.y+=(Math.random()-.5)*shake*.2*intensity;cameraTarget.y+=gunKick*6*intensity;}
 if(fatal){camera.position.copy(cameraPos);cameraLook.copy(cameraTarget);}else{camera.position.lerp(cameraPos,1-Math.exp(-dt*7));cameraLook.lerp(cameraTarget,1-Math.exp(-dt*8));}camera.lookAt(cameraLook);camera.fov=T.MathUtils.damp(camera.fov,fov,7,dt);camera.rotation.z+=(Math.sin(time*13)*.0015*speed+Math.sin(time*44)*shake*.024+(fatal?.jeepRoll||0))*intensity;camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
camera.position.set(-5.4,3,-1.3);camera.lookAt(-2.2,2.65,17);
function updateVision(){
 const amount=state.result==='lost'&&state.defeat?defeatVision(state.defeat.time):0,shortEdge=Math.min(innerWidth,innerHeight);
 const radius=+(amount*Math.min(12,Math.max(6,shortEdge*.012))*(reducedMotion?.65:1)).toFixed(3);
 // Blur only the world canvas. Small overscan keeps the filter's transparent
 // edge outside the viewport; both properties follow the paused game clock.
 const filter=radius?`blur(${radius}px)`:'',transform=radius?`scale(${+(1+6*radius/shortEdge).toFixed(5)})`:'';
 if(canvas.style.filter!==filter)canvas.style.filter=filter;
 if(canvas.style.transform!==transform)canvas.style.transform=transform;
}
function renderFrame(now=performance.now()){
 updateVision();renderer.info.reset();sky.update(camera,now/1000);
 if(!swallow.coversFrame){
  if(post.supported)post.render(scene,camera,{time:now/1000,sun,canopy:canopy.caster.visible&&jungleRoot.visible?canopy:null});
  else renderer.render(scene,camera);
 }
 swallow.render();
}
function frame(now){
 // A frame's timestamp can precede the clock sampled during long start-up work;
 // a negative step would make every damped camera/FOV blend diverge.
 requestAnimationFrame(frame);const raw=Math.max(0,now-last),dt=Math.min(.045,raw/1000);last=Math.max(last,now);frameCount++;
 if(!document.hidden&&governor.sample(raw,mode!=='loading'))post.configure({scale:governor.scale});
 if(quality==='auto'&&governor.strained&&ORDER.indexOf(autoTier)>0){autoTier=ORDER[ORDER.indexOf(autoTier)-1];applyQuality();}
 if(mode==='paused'||mode==='ended'||freeze){renderFrame(now);return;}
 time+=dt;const playing=mode==='playing',menu=mode==='menu'||mode==='loading';
 if(playing&&!state.result)state.tick(dt);if(playing)handleEvents();
 let speed=playing?state.phase==='intro'?openingPose(state.phaseTime,state.introDuration).speed:state.phase==='execution'?Math.max(1,10-state.phaseTime*6):10:menu?2.2:5;
 if(playing&&state.result){
  endTime+=dt;
  if(state.result==='lost'&&state.defeat){
   const d=state.defeat;d.time=endTime;const pose=defeatPose(endTime,d);speed=pose.speed;
   for(const [cue,at]of [['ram',DEFEAT.ram],['stopped',DEFEAT.spinEnd],['bite',DEFEAT.biteSound],['contact',DEFEAT.contact],['sealed',DEFEAT.contact+.14],['swallow',DEFEAT.slideAt],['digest',DEFEAT.bellyAt-.85],['splash',DEFEAT.acidAt],['silence',DEFEAT.black]])if(endTime>=at&&!d.cues.has(cue)){d.cues.add(cue);if(cue==='ram'){audio.vehicleCrash();effects.bodyImpact(new T.Vector3(.9,.04,.5),1.15);shake=1;}if(cue==='stopped'){audio.stopCalls();audio.growl();}if(cue==='bite')audio.bite();if(cue==='contact'){audio.impact();audio.groundImpact(.95);shake=.75;}if(cue==='sealed')audio.stopCalls();if(cue==='swallow'){audio.stopCalls();audio.swallow(DEFEAT.acidAt-DEFEAT.slideAt+.1);}if(cue==='digest')audio.digest();if(cue==='splash')audio.acidSplash();if(cue==='silence')audio.stopCalls();}
   if(endTime>=DEFEAT.ram&&endTime<DEFEAT.spinEnd&&Math.floor(endTime*14)!==d.skidTick){d.skidTick=Math.floor(endTime*14);for(const side of [-1,1]){const wheel=new T.Vector3(side,.04,1.16).applyAxisAngle(new T.Vector3(0,1,0),pose.jeepYaw).add(new T.Vector3(pose.jeepX,0,pose.jeepZ));effects.bodySlide(wheel,.55*speed/10);}}
   $('#fatal-blood').style.opacity=pose.blood;$('#fatal-black').style.opacity=pose.black;
  }else if(state.victory){
   const v=state.victory;v.time=endTime;const pose=victoryPose(endTime,state.distance);speed=pose.speed;
   if(pose.arrival&&!v.arrival){v.arrival=true;baseLights();visitorCenter.root.visible=true;jungleRoot.visible=false;opening.reset();ambushScenery.reset();effects.reset();birds.reset();audio.stopCalls();scene.background.setHex(0xbac8c4);scene.fog.color.setHex(0xbac8c4);scene.fog.density=.004;sun.position.set(-30,50,-35);sun.target.position.set(0,4,-80);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:.5,far:150});sun.shadow.camera.updateProjectionMatrix();
    // Open sky over the Visitor Center: no canopy, a brighter dome and softer rim.
    canopy.enabled=false;sky.palette(scene.fog.color,0x8fb8d8);sky.uniforms.sunDir.value.subVectors(sun.position,sun.target.position).normalize();rim.intensity=.45;hemi.intensity=1.45;weather.captureBase({sun,hemi,rim,fill,post});}
   $('#fatal-black').style.opacity=pose.black;$('#arrival-caption').style.opacity=pose.caption;
  }
  if(state.result==='won'?endTime>=VICTORY.duration&&rex.death.complete:endTime>=DEFEAT.duration)finish();
 }
 jungle.update(dt,speed,time);canopy.update(dt,speed);opening.update(dt,state.phaseTime,speed,playing&&state.phase==='intro');
 const ambushTime=state.ambush?state.time-state.ambush.startedAt+endTime:0,breakoutTime=ambushTime-(AMBUSH.crashAt-1.28);
 ambushScenery.update(dt,breakoutTime,speed,playing&&!!state.ambush&&breakoutTime>0&&breakoutTime<6);
 const vocal=audio.vocalPose(dt);
 if(rex){const actorState=menu?{phase:'pursuit',phaseTime:0,distance:20,result:null}:state;rex.update(dt,actorState,time,speed,vocal);if(state.victory?.arrival)rex.actor.visible=false;handleMotionEvents(playing);
  // Humid-air breath and saliva stream from the jaws while she roars.
  const roaring=rex.vocal?.roar||0;breathClock-=dt;if(roaring>.3&&rex.actor.visible&&breathClock<=0&&!swallow.coversFrame){breathClock=.13;const m=rex.mouthPosition(),dir=m.center.clone().sub(rex.headPosition()).setY(0).normalize();dir.y=-.12;effects.breath(m.center,dir.normalize(),Math.min(1,roaring*1.2));}}
 jeep.pose(time,speed,state);updateCamera(dt);
 weather.update(dt,speed,camera,{ground:jungleRoot.visible,shelter:state.result==='lost'&&state.defeat&&endTime>DEFEAT.contact-.4?1:0});weather.apply({sun,hemi,rim,fill,post});audio.weather(weather.rainLevel);
 // Lens beads only where there is a real lens: third person, menu and exterior cinematics.
 post.final.lensRain.value=(view==='third'||menu||state.result==='won')&&jungleRoot.visible?weather.value:0;post.final.lensTime.value+=dt;visitorCenter.update(time);birds.update(dt,time,speed);
 if(state.result==='lost'&&state.defeat)swallow.update(state.defeat.time,camera,rex.mouthPosition(),reducedMotion);
 if(rex&&state.result!=='won')rex.gaze.update(dt,view==='third'&&!menu?new T.Vector3(.06,2.4,-.45):camera.position);
 raycaster.setFromCamera(pointer,camera);aimPoint(aimTarget);
 if(state.victory?.arrival)aimTarget.copy(jeep.root.position).add(new T.Vector3(0,2.4,18));
 const exterior=state.result==='won'?state.victory?.exterior||state.victory?.time>VICTORY.pullback+.25:menu||(view==='third'&&state.phase!=='intro');
 jeep.update(dt,time,speed,aimTarget,exterior,state);effects.update(dt,speed);targets?.update(state);debris.update(dt,state,speed);
 if(playing){if(firing)shoot();handleEvents();updateHud();}audio.update(speed,dt,mode==='playing'&&(!state.result||state.result==='won'&&endTime<VICTORY.fade||(state.result==='lost'&&endTime<DEFEAT.spinEnd)),!state.result&&!['intro','flank'].includes(state.phase));
 shake=Math.max(0,shake-dt*1.8);stompVel+=(stomp*40-stompOffset*260-stompVel*26)*dt;stompOffset=Math.max(0,stompOffset+stompVel*dt);stomp=Math.max(0,stomp-dt*6);gunKick=Math.max(0,gunKick-dt*.4);hitTime=Math.max(0,hitTime-dt);damageFlash=Math.max(0,damageFlash-dt*.65);
 hud.hit.style.opacity=hitTime>0?1:0;hud.hitLabel.style.opacity=hitTime>0?1:0;hud.flash.style.opacity=damageFlash;
 post.final.flash.value.setRGB(1,.78,.5).multiplyScalar(effects.flash*.28);weather.addFlash(post.final.flash.value);
 if(fpsMeter){fpsFrames++;if(now-fpsSince>500){fpsMeter.textContent=`${Math.round(fpsFrames*1000/(now-fpsSince))} fps · ${governor.frameMs.toFixed(1)} ms
${tierName()} · scale ${Math.round(governor.scale*100)}% · ${renderer.info.render.calls} calls`;fpsFrames=0;fpsSince=now;}}
 renderFrame(now);
}
requestAnimationFrame(frame);
const boot=(stage,fraction)=>{$('#boot-stage').textContent=stage;$('#boot-fill').style.transform=`scaleX(${fraction})`;$('#boot-percent').textContent=`${Math.round(fraction*100)}%`;};boot('Waking the predator',.12);
try{rex=await createRex(scene,p=>{const f=p.total?p.loaded/p.total:0;$('#loading-status').textContent=p.total?`Creature ${Math.round(f*100)}%`:'Preparing the creature…';boot('Waking the predator',.12+f*.66);});boot('Compiling light and shadow',.82);targets=createTargets(rex,camera,$('#target-layer'));await renderer.compileAsync(scene,camera);await swallow.prepare();boot('Ready',1);setMode('menu');$('#start').disabled=false;$('#start-label').textContent='START THE CHASE';$('#loading-status').textContent='Headphones recommended · First / third person';}
catch(e){console.error(e);$('#loading-status').textContent='The creature could not load. Refresh to try again.';$('#start-label').textContent='LOAD FAILED';}
// Exposed for local visual and interaction verification; no network or remote state.
window.rexChase={scene,camera,renderer,post,birds,sky,canopy,weather,setConditions,governor,sun,lights:{hemi,rim,fill},jungle,get quality(){return{setting:quality,tier:tierName(),detected:detected.tier,gpu:detected.gpu,scale:governor.scale,frameMs:governor.frameMs};},setQuality,jeep,effects,opening,ambushScenery,debris,swallow,visitorCenter,get targets(){return targets;},get rex(){return rex;},state,audio,start,setView,shoot,grenade,get mode(){return mode;},get view(){return view;},get frames(){return frameCount;},set freeze(v){freeze=v;},get freeze(){return freeze;},aimAt(world){pointer.copy(world.clone().project(camera));moveReticle();},snapshot(){return{mode,view,health:state.health,jeep:state.jeep,phase:state.phase,ammo:state.ammo,wounds:rex?.damage.count,damageStage:rex?.damage.stage,persistentImpacts:rex?.damage.totalImpacts,headshots:state.headshots,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,audioClips:audio.buffers.size,remaining:state.remaining,objectives:state.objectivesCleared,debrisCleared:state.debrisCleared,debrisMissed:state.debrisMissed};}};
