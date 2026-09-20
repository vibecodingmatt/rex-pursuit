const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],report={};
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(`${r.status()} ${r.url()}`);});};
 const load=async p=>{watch(p);await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');await p.evaluate(()=>rexChase.state.nextDebris=Infinity);};
 const clear=async(p,expected)=>{
  const shots=[];
  for(let i=0;i<20;i++){
   await p.waitForFunction(()=>rexChase.state.phase!=='challenge'||rexChase.state.shotTimer<=0);
   if(await p.evaluate(()=>rexChase.state.phase!=='challenge'))break;
   const shot=await p.evaluate(()=>{const r=rexChase,o=r.state.objective,t=r.targets.targets[o.order[o.current]];if(!t.visible)return{visible:false};r.aimAt(t.world);return{visible:true,hit:r.shoot(),id:t.id,current:o.current,hits:o.hits,ammo:r.state.ammo,heat:r.state.heat,phase:r.state.phase,remaining:o.remaining};});
   shots.push(shot);assert.equal(shot.visible,true,'Active target stays in the playfield');assert.equal(shot.hit,true,`A ray through the active ring must connect: ${JSON.stringify(shot)}`);await p.waitForTimeout(115);
  }
  assert.equal(await p.evaluate(()=>rexChase.state.phase),'stunned',JSON.stringify(shots));assert.equal(await p.evaluate(()=>rexChase.state.objectivesCleared),expected);
 };
 try{
  const p=await browser.newPage({viewport:{width:1600,height:1000}});await load(p);
  await p.evaluate(()=>{window.introSamples=[];const collect=()=>{const r=rexChase;if(r.state.phase!=='intro')return;introSamples.push({t:r.state.phaseTime,fight:r.state.fightTime,x:r.rex.actor.position.x,speed:r.rex.gait.groundVelocity.z,jaw:r.rex.vocal.jaw,energy:r.rex.vocal.energy,id:r.rex.vocal.id});requestAnimationFrame(collect);};collect();});
  assert.equal(await p.evaluate(()=>rexChase.shoot()),false);
  await p.waitForFunction(()=>rexChase.state.phaseTime>1.7);await p.screenshot({path:'art/review/arcade-breakout.png'});
  await p.waitForFunction(()=>rexChase.audio.voice?.id===1&&rexChase.rex.vocal.energy>.15);await p.screenshot({path:'art/review/arcade-opening-roar.png'});
  await p.keyboard.press('p');await p.waitForFunction(()=>rexChase.audio.context.state==='suspended');
  const paused=await p.evaluate(()=>({fight:rexChase.state.fightTime,t:rexChase.state.time,a:rexChase.audio.context.currentTime,jaw:rexChase.rex.vocal.jaw}));await p.waitForTimeout(350);
  assert.deepEqual(await p.evaluate(()=>({fight:rexChase.state.fightTime,t:rexChase.state.time,a:rexChase.audio.context.currentTime,jaw:rexChase.rex.vocal.jaw})),paused);
  await p.keyboard.press('p');await p.waitForFunction(()=>rexChase.state.phase==='pursuit');
  const intro=await p.evaluate(()=>introSamples);assert.ok(intro.length>100);assert.ok(intro.filter(s=>s.t<6.1).every(s=>s.speed===0&&s.fight===0));assert.ok(intro.some(s=>s.x<-5));assert.ok(intro.some(s=>s.t>9&&s.speed>9));
  const voiced=intro.filter(s=>s.id===1&&s.energy>.1);assert.ok(voiced.length>25);assert.ok(voiced.every(s=>s.jaw>.04),'Roar energy opens the jaw, including the first frame of its attack ramp');report.intro={samples:intro.length,voiced:voiced.length,minRoarJaw:Math.min(...voiced.map(s=>s.jaw)),fightStartsAfter:await p.evaluate(()=>rexChase.state.introDuration)};
  assert.deepEqual(await p.evaluate(()=>rexChase.audio.roles),{opening:1,charge:2,growl:9,pain:27});
  await p.evaluate(()=>{rexChase.state.phaseTime=7.1;});await p.waitForFunction(()=>rexChase.state.phase==='challenge');await p.waitForTimeout(900);
  const longRoar=await p.evaluate(()=>new Promise(resolve=>{const sample=()=>{const v=rexChase.rex.vocal;if(v.id===2&&v.energy>.15)resolve({phase:rexChase.state.phase,voice:{...v}});else requestAnimationFrame(sample);};sample();}));assert.equal(longRoar.phase,'challenge');assert.ok(longRoar.voice.jaw>.1);report.longRoar=longRoar;
  await p.screenshot({path:'art/review/arcade-targets-first.png'});
  const wrong=await p.evaluate(()=>{const r=rexChase,o=r.state.objective,t=r.targets.targets[o.order[1]];r.aimAt(t.world);r.shoot();return o.current;});assert.equal(wrong,0,'Future targets do not skip the order');await p.waitForTimeout(120);await clear(p,1);
  assert.equal(await p.evaluate(()=>rexChase.state.jeep),100);await p.waitForTimeout(150);assert.notEqual(await p.evaluate(()=>rexChase.audio.voice?.kind),'roar');await p.screenshot({path:'art/review/arcade-repelled.png'});
  // Higher pressure requires six two-hit targets, also in the external view.
  await p.evaluate(()=>{const r=rexChase;r.setView('third');r.state.ambushPlayed=true;r.state.fightTime=65;r.state.distance=12.5;r.state.beginChallenge();});await p.waitForTimeout(600);
  // Screenshot encoding must not spend the short attack window. The actual
  // target shots below still run against the normal, uninterrupted countdown.
  await p.evaluate(()=>rexChase.freeze=true);await p.screenshot({path:'art/review/arcade-targets-third.png'});await p.evaluate(()=>rexChase.freeze=false);await clear(p,2);
  // A missed objective is committed: normal headshot stagger cannot erase it.
  await p.evaluate(()=>{const r=rexChase;r.state.fightTime=0;r.state.beginChallenge();r.state.objective.remaining=.08;});await p.waitForFunction(()=>rexChase.state.phase==='charge');await p.evaluate(()=>{for(let i=0;i<11;i++)rexChase.state.hit(true);});assert.notEqual(await p.evaluate(()=>rexChase.state.phase),'stunned');await p.waitForFunction(()=>rexChase.state.jeep===73);report.failure=await p.evaluate(()=>rexChase.snapshot());
  await p.evaluate(()=>{rexChase.state.fightTime=89.98;});await p.waitForFunction(()=>rexChase.state.phase==='execution');const locked=await p.evaluate(()=>{const s=rexChase.state,before=s.health;s.hit(true,true);return{fire:rexChase.shoot(),grenade:rexChase.grenade(),before,after:s.health};});assert.equal(locked.fire,false);assert.equal(locked.grenade,false);assert.equal(locked.before,locked.after);
  await p.waitForFunction(()=>rexChase.mode==='ended');assert.equal(await p.locator('#end-title').textContent(),'Time ran out.');assert.equal(await p.evaluate(()=>rexChase.state.jeep),0);await p.screenshot({path:'art/review/arcade-timeout.png'});
  await p.locator('#restart').click();await p.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await p.evaluate(()=>rexChase.state.remaining),90);assert.equal(await p.evaluate(()=>rexChase.state.objective),null);assert.equal(await p.locator('.weakpoint:visible').count(),0);assert.equal(await p.evaluate(()=>rexChase.audio.voice),null);
  assert.equal(await p.evaluate(()=>rexChase.jeep.gunner.visible),false,'The opening uses its first-person framing after a third-person restart');await p.close();
  report.mobile=[];
  for(const [name,width,height]of [['portrait',390,844],['small-phone',390,680],['landscape',844,390]]){
   const mobile=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});await load(mobile);await mobile.evaluate(()=>{const r=rexChase;r.state.transition('pursuit');r.state.distance=12.5;r.state.beginChallenge();});await mobile.waitForTimeout(750);
   const layout=await mobile.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return{clock:rect('#mission-clock'),card:rect('#challenge-card'),fire:rect('#touch-fire'),targets:rexChase.targets.targets.filter(t=>t.visible).map(t=>t.screen),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.equal(layout.overflow,false);for(const box of [layout.clock,layout.card,layout.fire])assert.ok(box.x>=0&&box.y>=0&&box.right<=width&&box.bottom<=height);assert.ok(layout.card.bottom<layout.fire.y||layout.card.right<layout.fire.x);
   for(const t of layout.targets)for(const b of [layout.clock,layout.card])assert.ok(t.x+t.radius<b.x||t.x-t.radius>b.right||t.y+t.radius<b.y||t.y-t.radius>b.bottom,`${name}: HUD covers a target`);
   await mobile.screenshot({path:`art/review/arcade-${name}.png`});await clear(mobile,1);report.mobile.push({name,layout});await mobile.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('art/review/arcade-verification.json',JSON.stringify({errors,...report},null,2));console.log(JSON.stringify({errors,...report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
