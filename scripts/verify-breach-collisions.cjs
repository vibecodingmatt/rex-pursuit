const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 fs.mkdirSync('art/review/breach-collisions',{recursive:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto('http://127.0.0.1:5188/breach.html');await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>breach.mode==='playing');await p.evaluate(()=>breach.freeze=true);
  const routes=await p.evaluate(()=>{const b=breach,rows=[];for(const hz of [30,60,120])for(const species of ['raptor','pachycephalosaurus'])for(const lane of [0,1,2]){
   b.director.reset();b.round.reset();b.round.time=20;const a=b.director.spawn(lane,species);a.c.scale=a.heavy?4.5:3.1;let contacts=0,cycles=0,lastPhase=a.phase,maxStep=0;const phases=new Set();
   for(let i=0;i<hz*24;i++){b.round.jeep=100;const previous=a.c.p.clone();b.director.update(1/hz,{spawnEnabled:false});maxStep=Math.max(maxStep,a.c.p.distanceTo(previous));phases.add(a.phase);if(b.world.obstacles.contact(a.c))contacts++;if(a.phase==='retreat'&&lastPhase!=='retreat')cycles++;lastPhase=a.phase;}
   rows.push({hz,species,lane,contacts,cycles,maxStep,phases:[...phases]});
  }return rows;});
  for(const row of routes){assert.equal(row.contacts,0,JSON.stringify(row));assert.ok(row.cycles>=2,'Attackers complete repeated attacks rather than getting stuck');assert.ok(row.maxStep<.6,'Collision corrections never teleport a creature');}
  fs.writeFileSync('art/review/breach-collisions/routes.json',JSON.stringify(routes,null,2));console.log('18 full approach/attack/retreat scenarios clear all registered props at 30/60/120 Hz.');
  for(const tier of ['high','low'])for(const species of ['raptor','pachycephalosaurus']){
   await p.setViewportSize(tier==='low'?{width:390,height:844}:{width:1440,height:900});
   await p.evaluate(()=>breach.start());
   await p.evaluate(species=>{const view=species==='pachycephalosaurus'?'third':'first';if(breach.view!==view)document.getElementById('view').click();},species);
   await p.evaluate(({tier,species})=>{const b=breach,q=document.getElementById('quality');q.value=tier;q.onchange();b.director.reset();b.round.reset();b.combatFX.reset();b.round.time=20;window.victim=b.director.spawn(0,species);while(victim.phase==='approach')b.director.update(1/60,{spawnEnabled:false});b.step(0);const at=victim.c.p.clone();at.y+=victim.c.kind.centre*victim.c.scale;b.aimAt(at);},{tier,species});
   await p.screenshot({path:`art/review/breach-collisions/${tier}-${species}-before.png`});
   const launch=await p.evaluate(()=>{breach.grenade();return breach.combatFX.rocket.visible;});assert.equal(launch,true);
   const result=await p.evaluate(()=>{const b=breach;for(let i=0;i<45&&b.combatFX.rocket.visible;i++)b.step(1/60);return {on:victim.c.on,state:victim.c.state,kills:b.round.kills,impact:b.combatFX.impact,...b.combatFX.breakup.stats};});console.log(tier,species,result);
   assert.equal(result.on,false,'A direct rocket removes the intact body');assert.equal(result.state,'dead');assert.equal(result.bursts,1);assert.ok(result.pieces>=6);assert.equal(result.kills,1);
   await p.evaluate(()=>{for(let i=0;i<8;i++)breach.step(1/60);});await p.screenshot({path:`art/review/breach-collisions/${tier}-${species}-burst.png`});
   const before=await p.evaluate(()=>[...breach.combatFX.breakup.cache.values()].flat().map(p=>p.entries.map(b=>[b.life,...b.p.toArray()])));await p.keyboard.press('p');await p.waitForTimeout(100);const after=await p.evaluate(()=>[...breach.combatFX.breakup.cache.values()].flat().map(p=>p.entries.map(b=>[b.life,...b.p.toArray()])));assert.deepEqual(after,before,'Pause freezes physical fragments');await p.locator('#resume').click();
   await p.evaluate(()=>{for(let i=0;i<30;i++)breach.step(1/60);});await p.screenshot({path:`art/review/breach-collisions/${tier}-${species}-fragments.png`});
   await p.evaluate(()=>breach.combatFX.reset());assert.equal(await p.evaluate(()=>[...breach.combatFX.breakup.cache.values()].flat().every(p=>p.mesh.count===0&&p.entries.every(b=>b.life===0))),true,'Reset clears every fragment');
  }
  // Splash retains the tumble, distinct from a real projectile contact.
  const splash=await p.evaluate(()=>{const b=breach;b.director.reset();b.round.reset();b.combatFX.reset();b.round.time=20;const a=b.director.spawn(0);a.c.p.set(0,0,16);b.director.blast(a.c.p.clone());return {on:a.c.on,state:a.c.state,bursts:b.combatFX.breakup.stats.bursts};});assert.deepEqual(splash,{on:true,state:'dead',bursts:0});
  const rex=await p.evaluate(()=>{const b=breach;b.director.reset();b.round.reset();b.combatFX.reset();b.round.time=100;b.round._broken=b.round._revealed=true;b.round.rexDistance=26;for(let i=0;i<40;i++)b.step(1/60);b.director.reset();b.aimAt(b.rex.headPosition());b.grenade();for(let i=0;i<100&&b.combatFX.rocket.visible;i++)b.step(1/60);return {visible:b.rex.actor.visible,hits:b.round.hits,bursts:b.combatFX.breakup.stats.bursts};});assert.equal(rex.visible,true);assert.equal(rex.bursts,0,'Rex is excluded from breakup');assert.ok(rex.hits>0,'Rocket still contributes Rex stagger');
  assert.deepEqual(errors,[]);console.log('Direct rockets break both species into posed sculpt fragments at High/Low; splash, pause and reset pass. No runtime/shader errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
