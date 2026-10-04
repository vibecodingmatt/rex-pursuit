import {Circuit,STAGES,project,grade} from './rules.js';
import {RideRenderer} from './renderer.js';
import {RideAudio} from './audio.js';
import {readRecord,saveRecord} from './records.js';
import {ChaseAudio} from '../chase/audio.js';import {StageAmbience} from './ambience.js';import {CircuitQuality} from './quality.js';
// RideAudio keeps the score and UI cues; Pursuit's recorded library supplies the
// world: gunfire, impacts, engine, wind, and the Rex's voice placed at her head.
const $=id=>document.getElementById(id),canvas=$('ride'),renderer=new RideRenderer(canvas),audio=new RideAudio(),field=new ChaseAudio(),ambience=new StageAmbience(field);let fieldInit=null;
const test=new URLSearchParams(location.search).get('test')==='1';
let clearCard=0,game=null,mode='menu',route='extended',ready=false,fire=false,frozen=false,clock=0,accumulator=0,last=performance.now(),announcementTime=0,radioTime=0,saved=false;
const aim={x:.5,y:.5},keys=new Set();let pointerId=null;
canvas.tabIndex=0;
const fmt=n=>Math.round(n).toLocaleString('en-US');
const names={trike:'TRICERATOPS · STAMPEDE LEADER',rex:'TYRANNOSAURUS REX',indominus:'INDOMINUS REX',indoraptor:'INDORAPTOR',mosa:'MOSASAURUS',twins:'TWO KINGS. ONE EXIT.'};
function readBest(){return readRecord(()=>localStorage,route,$('difficulty').value);}
function updateBest(){$('best').textContent=`BEST ${readBest()?fmt(readBest()):'—'}`;}
function persist(){
 if(saved||test)return;saved=true;
 if(!saveRecord(()=>localStorage,game).saved)$('overlay-copy').textContent+=' Browser storage is unavailable; this score could not be saved.';
}
function showMode(value){mode=value;document.body.dataset.screen=value;$('menu').hidden=value!=='menu';$('hud').hidden=value==='menu';$('pause').hidden=value==='menu';$('overlay').hidden=!['paused','result','continue'].includes(value);}
function announce(top,title,bottom='',seconds=3,over=false){const el=$('announcement');el.classList.toggle('over',over);el.children[0].textContent=top;el.children[1].textContent=title;el.children[2].textContent=bottom;announcementTime=seconds;el.style.opacity='1';}
function radio(copy){$('radio').querySelector('span').textContent=copy;radioTime=7;$('radio').style.opacity='1';}
function stageChanged(){
 const stage=game.stage;ambience.setStage(stage.id);$('location').textContent=stage.location;$('stage-name').textContent=stage.name;
 $('route-dots').replaceChildren(...game.path.map((_,i)=>{const dot=document.createElement('i');dot.className=i<game.stageIndex?'done':i===game.stageIndex?'current':'';return dot;}));
 announce(`${String(game.stageIndex+1).padStart(2,'0')} / ${String(game.path.length).padStart(2,'0')} — ${stage.era}`,stage.name,'HOLD TO FIRE · SHOOT DEBRIS · KEEP MOVING');radio(stage.radio);
}
function unlockField(){fieldInit??=field.init().then(()=>{audio.worldSounds=false;if(field.muted!==audio.muted)field.mute();if(mode!=='playing')return field.pause(true);}).catch(e=>{console.warn('Recorded audio unavailable:',e.message);});if(field.context)field.pause(false).catch(()=>{});}
function start(){if(!ready)return;clearCard=0;audio.reset();field.stopCalls();void audio.unlock();unlockField();game=new Circuit({route,difficulty:$('difficulty').value});game.projector=(e,aspect)=>renderer.project(e,aspect);saved=false;fire=false;keys.clear();renderer.reset();clock=0;accumulator=0;showMode('playing');canvas.focus({preventScroll:true});processEvents();updateHud();}
function processEvents(){for(const event of game.drain()){
 renderer.event(event);audio.event(event);fieldEvent(event);
 if(event.type==='stage')stageChanged();
 if(event.type==='boss'){announce('APEX ENCOUNTER',names[event.kind],'KEEP FIRING AT THE AMBER WEAK POINT',2.4,true);radio(event.kind==='mosa'?'It is coming up! Break the attack before it reaches us.':'Amber marks stop the charge. Keep your aim on the head.');}
 // After a Rex, let her fall read before the card arrives.
 if(event.type==='clear'){if(game.clearHold>3.5)clearCard=2.1;else announce('SECTOR CLEAR','Still in one piece.','INTEGRITY +12 · SECTOR BONUS +1,500',3);}
 if(event.type==='bridge'){announce('HOLD ON','There goes the bridge.','SHOOT THE FALLING DEBRIS',2);radio('Brace! Clear the debris. We are jumping the gap!');}
 if(event.type==='focus')radio('Overdrive online. Five seconds. Make them count.');
 if(event.type==='beat'&&event.text)radio(event.text);
 if(event.type==='threat')radio(`Raptors on the ${event.side}! They are keeping pace. Watch for the turn!`);
 if(event.type==='loss')showContinue();
 if(event.type==='win')showResult(true);
}}
const BOSS_STAGES=['gates','river','hybrid','visitor'];
function fieldEvent(e){
 // Bodies and the vehicle react with or without sound; a blow knocks the camera away from its source.
 if(e.type==='shot'&&e.hit)renderer.actors?.hit(e.id,e.precise,e.x);
 // A broken boss attack freezes the action for 50 ms and lands a low thump.
 if(e.type==='stagger'){hitStop=.05;if(field.context)field.groundImpact(1);}
 if(e.type==='damage')renderer.vehicle?.hit(renderer.actors?.actors.get(e.id)?.position||null,Math.min(1.6,.4+e.amount/14));
 if(!field.context)return;
 // Each beat is announced by its animals, from their side of the track.
 if(e.type==='beat'){const cam=renderer.world.camera.position,at={x:cam.x+e.side*14,y:cam.y,z:cam.z+28},name={raptor:'raptor',dilo:'dilophosaurus',galli:'gallimimus',trike:'triceratops'}[e.kind];if(e.kind==='ptero')field.screech(at);else if(e.pattern==='stampede')field.herd(at);else if(name)field.call(name,at);}
 if(e.type==='shot'){field.gun();if(e.hit){const wound=renderer.lastWound,actor=renderer.actors?.actors.get(e.id),at=wound?.point||actor?.position;if(at)field.hit('flesh',at.distanceTo(renderer.world.camera.position),at);renderer.lastWound=null;}}
 if(e.type==='blast')field.impact(true);
 if(e.type==='leap'){const a=renderer.actors?.actors.get(e.id);if(a)field.call('raptor',a.position);}
}
// Her calls, bite, pain and footfalls come from the modeled Rex's own timing.
function bossCues(){
 // The gate's doors hit their stops: timber on timber.
 for(const cue of renderer.world.fault?.drain()||[]){if(!field.context||mode!=='playing')continue;if(cue.type==='snap')field.woodBreak(cue.weight*.7);if(cue.type==='bounce'){field.groundImpact(Math.min(1,cue.weight*.8),cue.at);renderer.shake=Math.max(renderer.shake,cue.weight*.3);}if(cue.type==='land'){field.groundImpact(1);field.woodBreak(.5);renderer.shake=Math.max(renderer.shake,.7);const c=renderer.world.camera.position;for(let i=0;i<5;i++)renderer.effects.groundDust(c.clone().set(c.x+(i-2)*1.4,c.y-2.4,c.z+2+i%2),c.clone().set((i-2)*.8,.6,1.5),{life:1.6,size:1.1,opacity:.38,color:0x8a6f5a});}}
 for(const cue of renderer.world.gate?.drain()||[])if(field.context&&mode==='playing'&&cue.type==='slam'){field.woodBreak(.45);field.groundImpact(.7,cue.at);renderer.shake=Math.max(renderer.shake,.25);}
 // The Triceratops' bellows, footfalls, pawing, horn lock and shoves (boss-trike.js).
 const trike=renderer.bossTrike,eye=renderer.world.camera.position;
 for(const cue of trike?.drain()||[]){if(!field.context||mode!=='playing')continue;const near=Math.max(0,1-cue.at.distanceTo(eye)/32);
  if(cue.type==='bellow')field.play(30,cue.loud?1:.7,cue.loud?.6:.68,{vocal:false,at:cue.at,wet:.35});
  if(cue.type==='snort')field.play(30,.4,1.05,{vocal:false,at:cue.at,wet:.2});
  if(cue.type==='step'){field.footstep(.75,cue.at);renderer.effects.footstep(cue.at,cue.speed);renderer.shake=Math.max(renderer.shake,.42*near);}
  if(cue.type==='paw')renderer.effects.groundDust(cue.at.clone().setY(cue.at.y+.2),cue.at.clone().set(0,1,0),{size:.9,growth:2.5,opacity:.4,life:1.2});
  if(cue.type==='lock'){field.impact();field.groundImpact(1,cue.at);renderer.effects.bodyImpact(cue.at,1);renderer.shake=Math.max(renderer.shake,1.2);radio('She has the bumper! Shoot her off!');}
  if(cue.type==='shove'){field.groundImpact(.45,cue.at);renderer.shake=Math.max(renderer.shake,.55);}
  if(cue.type==='pain'){field.play(30,.85,.78,{vocal:false,at:cue.at,wet:.3});radio('She is reeling! Keep it on her head!');}
  if(cue.type==='fall'){field.death('triceratops',cue.at);radio('She is down. Go, go!');}
 }
 // A cut wire's live end crackles.
 for(const cue of renderer.world.sparks?.drain()||[])if(mode==='playing')audio.hiss(.04+Math.random()*.07,.03+.1*cue.near,3600+Math.random()*2400);
 const boss=renderer.bossRex;if(!boss)return;const cam=renderer.world.camera.position;audio.modeledRex=boss.ready&&!!field.context;
 for(const cue of boss.drain()){
  if(!field.context||mode!=='playing')continue;
  if(cue.type==='roar'){boss.voiceSlot=cue.slot;field.roar(cue.opening);}
  if(cue.type==='bite'){boss.voiceSlot=cue.slot;field.bite();renderer.shake=Math.max(renderer.shake,1.1);}
  if(cue.type==='pain'){boss.voiceSlot=cue.slot;field.pain(true);radio('She is reeling! Keep it on her head!');}
  if(cue.type==='fall')radio('She is going down. Clear out!');
  if(cue.type==='step'||cue.type==='impact'){
   const near=Math.max(0,1-cue.at.distanceTo(cam)/32),heavy=cue.type==='impact';
   renderer.shake=Math.max(renderer.shake,(heavy?.9:.32)*near);
   if(cue.water){field.splash('step',cue.at,heavy?1:.75);renderer.effects.spume(cue.at.clone().setY(-.3),cue.at.clone().set(0,2.2,0),{size:.9,opacity:.2});renderer.world.spray.burst(cue.at,heavy?1.3:.7);renderer.world.river.ring(cue.at.x,cue.at.z,heavy?1.4:.8);}
   else if(heavy){field.groundImpact(cue.strength,cue.at);renderer.effects.bodyImpact(cue.at,cue.strength);}
   else{field.footstep(.55,cue.at);renderer.effects.footstep(cue.at,cue.speed);}
  }
 }
}
function updateHud(){
 if(!game)return;$('score').textContent=String(game.score).padStart(6,'0');$('health').textContent=Math.ceil(game.hp);
 $('health-bars').replaceChildren(...Array.from({length:10},(_,i)=>{const bar=document.createElement('i');if(i>=Math.ceil(game.hp/10))bar.className='empty';if(game.hp<30&&bar.className!=='empty')bar.style.background='#ef9c6f';return bar;}));
 $('multiplier').textContent=`×${Math.min(5,1+Math.floor(game.combo/5))}`;$('chain-text').textContent=game.combo?`${game.combo} CHAIN`:'MAKE IT COUNT';$('chain-fill').style.width=`${game.chainTime/4.5*100}%`;
 $('focus-fill').style.width=`${game.focusTime>0?game.focusTime/5*100:game.focus}%`;$('focus-value').textContent=game.focusTime>0?'ACTIVE':game.focus>=100?'READY ↗':`${Math.floor(game.focus)}%`;$('focus').classList.toggle('ready',game.focus>=100);$('focus').setAttribute('aria-label',game.focus>=100?'Activate Overdrive':`Overdrive charging ${Math.floor(game.focus)} percent`);
 $('credit-label').textContent=game.continues?`CONTINUED RUN · ${game.credits} CREDITS LEFT`:'ONE CREDIT RUN';
 const bosses=game.entities.filter(e=>e.boss&&!e.dead);$('boss-hud').hidden=!bosses.length;
 if(bosses.length){$('boss-name').textContent=names[game.stage.boss];$('boss-fill').style.width=`${100*bosses.reduce((sum,e)=>sum+e.hp,0)/bosses.reduce((sum,e)=>sum+e.maxHp,0)}%`;}
}
function overlay(title,copy,kicker){$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('overlay-kicker').textContent=kicker;$('resume').hidden=true;$('continue').hidden=true;$('restart').hidden=true;$('result-stats').replaceChildren();fire=false;keys.clear();audio.pause(true);}
function pause(){if(mode!=='playing')return;field.pause(true).catch(()=>{});showMode('paused');overlay('Ride paused.','Aim with mouse or arrow keys. Hold mouse or Space to fire. E activates Overdrive.','TAKE A BREATH');$('resume').hidden=false;$('resume').focus();}
function resume(){if(mode!=='paused')return;showMode('playing');void audio.unlock();unlockField();canvas.focus({preventScroll:true});}
function showContinue(){showMode('continue');overlay('Ride interrupted.',game.credits?`Your vehicle took one hit too many. ${game.credits} free continues remain. Your route and score will be preserved.`:'You gave the island a run for its money. Your score is ready.','CONTINUE?');
 if(game.credits){$('continue').hidden=false;$('continue').textContent=`CONTINUE · ${game.credits} CREDITS ↗`;$('continue').focus();}
 else showResult(false);
}
function showResult(won){showMode('result');overlay(won?'You made it out.':'The island wins.',won?`${game.route==='classic'?'The ’94 Circuit':'The Extended Cut'} complete. ${game.continues?'Continued-run record.':'One credit. A whole lot of dinosaurs.'}`:`Reached ${game.stage.name}. Ride again for a cleaner run.`,won?'EXPEDITION COMPLETE':'GAME OVER');
 const stats=[[fmt(game.score),'FINAL SCORE'],[grade(game),'RANK'],[`${Math.round(game.hits/Math.max(1,game.shots)*100)}%`,'ACCURACY'],[String(game.maxCombo),'BEST CHAIN'],[String(game.bosses),'BOSSES REPELLED'],[String(game.continues),'CONTINUES']];
 $('result-stats').replaceChildren(...stats.map(([v,l])=>{const el=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');b.textContent=v;small.textContent=l;el.append(b,small);return el;}));$('restart').hidden=false;$('restart').focus();persist();
}
function backToMenu(){audio.reset();audio.pause(true);field.stopCalls();field.pause(true).catch(()=>{});showMode('menu');game=null;fire=false;keys.clear();pointerId=null;renderer.reset();updateBest();$('start').focus();}
$('start').addEventListener('click',start);$('restart').addEventListener('click',start);$('pause').addEventListener('click',()=>mode==='playing'?pause():resume());$('resume').addEventListener('click',resume);$('to-menu').addEventListener('click',backToMenu);
$('continue').addEventListener('click',()=>{if(game?.continueRun()){showMode('playing');void audio.unlock();unlockField();canvas.focus({preventScroll:true});processEvents();updateHud();}});
$('focus').addEventListener('click',()=>{if(mode==='playing'){game.activateFocus();processEvents();canvas.focus({preventScroll:true});}});
$('sound').addEventListener('click',()=>{audio.mute(!audio.muted);if(field.muted!==audio.muted)field.mute();$('sound').textContent=audio.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(audio.muted));$('sound').setAttribute('aria-label',audio.muted?'Enable sound':'Mute sound');if(mode==='playing')void audio.unlock();});
let quality=null,hitStop=0,slow=0,slowDone=false;
// The leap over the broken bridge plays 0.6 s of slow motion at the top of the arc (presentation
// only: the rules still step in fixed 1/60 s ticks, just fewer of them per real second).
function slowScale(dt){if(!game||game.stage.id!=='fault'||!game.bridgeBroken){slowDone=false;slow=0;return 1;}
 if(!slowDone&&(game.travel-game.bridgeOrigin+30)/60>.3&&!renderer.reduced){slowDone=true;slow=.6;}
 if(slow<=0)return 1;slow=Math.max(0,slow-dt);return 1-.74*Math.min(1,(.6-slow)/.08,slow/.14);}function qualityLabel(){$('quality').textContent=`QUALITY ${quality?.label||'AUTO'}`;}$('quality').onclick=()=>{quality?.cycle();qualityLabel();};
function motionLabel(){$('motion').textContent=renderer.reduced?'MOTION LOW':'MOTION FULL';$('motion').setAttribute('aria-pressed',String(renderer.reduced));}motionLabel();
$('motion').addEventListener('click',()=>{renderer.reduced=!renderer.reduced;motionLabel();});
$('difficulty').addEventListener('change',updateBest);
document.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>{route=button.dataset.route;document.querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateBest();}));
$('about-open').addEventListener('click',()=>$('about').showModal());$('about-close').addEventListener('click',()=>$('about').close());
function pointer(e){aim.x=Math.max(.02,Math.min(.98,e.clientX/innerWidth));aim.y=Math.max(.19,Math.min(.85,(e.clientY-(e.pointerType==='touch'?42:0))/innerHeight));}
canvas.addEventListener('pointerdown',e=>{if(mode!=='playing'||(e.pointerType==='mouse'&&e.button!==0)||pointerId!==null)return;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);pointer(e);fire=true;void audio.unlock();e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(pointerId===null||e.pointerId===pointerId)pointer(e);});
function release(e){if(e.pointerId===pointerId){pointerId=null;fire=false;}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{
 if($('about').open)return;
 if(e.key==='Escape'&&!e.repeat){if(mode==='playing')pause();else if(mode==='paused')resume();return;}
 if(mode!=='playing'||e.target.closest('button,select,a,input'))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)){e.preventDefault();keys.add(e.key);}
 if(e.key.toLowerCase()==='e'&&!e.repeat){game.activateFocus();processEvents();}
});
addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>{fire=false;pointerId=null;keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('resize',()=>renderer.resize());
function step(dt){
 if(mode!=='playing')return;
 const speed=.65;aim.x=Math.max(.02,Math.min(.98,aim.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*speed));aim.y=Math.max(.19,Math.min(.85,aim.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*dt*speed));
 game.update(dt);if(fire||keys.has(' ')){renderer.sync(game,aim);game.shoot(aim.x,aim.y,innerWidth/innerHeight);}processEvents();renderer.update(dt);audio.update(game);
 if(field.context&&renderer.bossRex){renderer.bossRex.voice=field.vocalPose(dt);field.listen(renderer.world.camera,renderer.bossRex.headOf(renderer.bossRex.voiceSlot??0));field.update(Math.min(16,Math.abs(game.speed)),dt,true,BOSS_STAGES.includes(game.stage.id));}
 if(field.context)ambience.update(true);
 if(clearCard>0&&(clearCard-=dt)<=0)announce('SECTOR CLEAR','Still in one piece.','INTEGRITY +12 · SECTOR BONUS +1,500',2.6,true);
 announcementTime=Math.max(0,announcementTime-dt);radioTime=Math.max(0,radioTime-dt);$('announcement').style.opacity=String(Math.min(1,announcementTime*2));$('radio').style.opacity=String(Math.min(1,radioTime));
}
let hudTick=0;
function frame(now){const raw=now-last,dt=Math.min(.1,raw/1000);last=now;if(quality&&!frozen&&!document.hidden&&quality.sample(raw,mode==='playing'))qualityLabel();
 if(!frozen){if(mode==='menu'&&!document.hidden)clock+=dt;if(mode==='playing'){if(hitStop>0)hitStop-=dt;else{accumulator+=dt*slowScale(dt);while(accumulator>=1/60){step(1/60);accumulator-=1/60;}}hudTick+=dt;if(hudTick>.08){updateHud();hudTick=0;}}}
 renderer.render(game,aim,{menu:mode==='menu',time:game?.time??clock});bossCues();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
async function load(){
 try{await renderer.load(p=>$('load-status').textContent=`Preparing the island · ${Math.round(p*100)}%`);ready=true;
  // A leaping ichthyosaur throws a ring of spray where it breaks the surface.
  // Tests pin High (or ?quality=) so captures and timings stay comparable.
  quality=new CircuitQuality(renderer,{fixed:test?new URLSearchParams(location.search).get('quality')||'high':null});quality.apply();qualityLabel();
  ambience.world=renderer.world;renderer.actors.effects=renderer.effects;renderer.actors.onSplash=(at,strength)=>{field.splash('step',at,strength);renderer.world.spray.burst(at,strength);renderer.world.river.ring(at.x,at.z,strength);for(let i=0;i<8;i++){const r=i/8*Math.PI*2;renderer.effects.spume(at.clone().setY(at.y-.2),at.clone().set(Math.cos(r)*2.4*strength,3.4*strength+Math.random(),Math.sin(r)*2.4*strength),{size:1.1,opacity:.24,life:1.5});}};
  // A9: the wading brachiosaur's call and footfalls (brachio-crossing.js).
  renderer.actors.brachio.onCall=p=>field.brachio?.(p);renderer.actors.crossing.onStep=p=>{field.splash('step',p,1);renderer.shake=Math.max(renderer.shake,.55*Math.max(0,1-p.distanceTo(renderer.world.camera.position)/45));};
  $('start').disabled=false;$('start-label').textContent='START THE RIDE';$('load-status').textContent='';updateBest();void renderer.loadBosses();}
 catch{$('load-status').textContent='The island could not load. Check your connection and reload this page.';$('start-label').textContent='RELOAD TO RETRY';$('start').disabled=false;$('start').onclick=()=>location.reload();}
}void load();
window.lostCircuit={get ready(){return ready;},get mode(){return mode;},snapshot:()=>game?.snapshot(),get audioState(){return audio.context?.state||'uninitialized';},get art(){return Object.fromEntries(Object.entries(renderer.images).map(([key,im])=>[key,{width:im.width,height:im.height}]));}};
// Object.assign would copy a getter's current value; quality is created after loading.
if(test)Object.defineProperty(window.lostCircuit,'quality',{get:()=>quality});
if(test)Object.assign(window.lostCircuit,{getGame:()=>game,get renderer(){return renderer;},get ambience(){return ambience;},project:e=>renderer.project(e,innerWidth/innerHeight),bossesReady:()=>renderer.loadBosses().then(()=>renderer.bossRex.ready),diagnostics:()=>({trike:renderer.bossTrike?.diagnostics(),bosses:renderer.bossRex?.diagnostics(),weapon:renderer.weapon.diagnostics(),camera:renderer.world.camera.position.toArray(),actors:renderer.actors.diagnostics(),draws:renderer.world.renderer.info.render.calls,triangles:renderer.world.renderer.info.render.triangles}),freeze:v=>{frozen=v;},step:(seconds,autoplay=false,live=false)=>{
 // live: sync the scene every substep, as real frames do (modeled bosses integrate motion per frame).
 for(let t=0;t<seconds&&mode==='playing';t+=1/60){if(live&&!autoplay)renderer.sync(game,aim);if(autoplay){renderer.sync(game,aim);const target=game.entities.find(e=>!e.dead&&e.age>.2&&renderer.project(e)?.visible!==false);if(target){const p=renderer.project(target,innerWidth/innerHeight);aim.x=p.hx;aim.y=p.hy;game.shoot(aim.x,aim.y,innerWidth/innerHeight);}if(game.focus>=100)game.activateFocus();}step(1/60);}updateHud();renderer.render(game,aim,{time:game.time});},seek:(id,at=0)=>{const idx=game.path.findIndex(n=>STAGES[n].id===id);if(idx<0)throw Error('Stage is not on route');game.stageIndex=idx;game.stageTime=at;game.travel=at*(id==='manor'?14:id==='fault'?27:24);renderer.actors.reset();game.phase='ride';game.phaseTime=at;game.entities=[];game.spawnTimer=.2;game.bossSpawned=false;game.bridgeBroken=false;stageChanged();updateHud();},setAim:(x,y)=>{aim.x=x;aim.y=y;},render:()=>renderer.render(game,aim,{time:game?.time??0,menu:mode==='menu'})});
