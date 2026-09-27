// Focused regression: naturally boarded raptors, actual aimed bullets/rockets,
// both cameras and landing slots, with desktop/phone lens captures.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/',baseline=process.env.SPLATTER_BASELINE==='1';
const dir=`art/review/breach-splatter/${baseline?'before':'after'}`;fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],report=[];
 try{
  for(const [name,width,height,quality]of [['desktop',1280,720,'high'],['phone',390,844,'low']]){
   const p=await browser.newPage({viewport:{width,height},isMobile:name==='phone',hasTouch:name==='phone'});
   p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   await p.goto(new URL('breach.html',base).href);await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});await p.locator('#quality').selectOption(quality);
   await p.locator('#start').click();await p.waitForFunction(()=>breach.mode==='playing');await p.evaluate(()=>breach.freeze=true);
   for(const view of ['first','third'])for(const lane of [0,2])for(const weapon of ['gun','rocket']){
    await p.evaluate(()=>breach.start());if(view==='third')await p.keyboard.press('v');
    const setup=await p.evaluate(lane=>{const b=breach,a=b.director.spawn(lane);window.splatterActor=a;for(let i=0;i<1500&&a.phase!=='board';i++)b.director.update(1/60,{spawnEnabled:false});b.step(0);b.scene.updateMatrixWorld(true);const at=a.c.p.clone();at.y+=a.c.kind.centre*a.c.scale;b.aimAt(at);return {phase:a.phase,distance:at.distanceTo(b.camera.position),view:b.view};},lane);
    assert.equal(setup.phase,'board');assert.equal(setup.view,view);
    if(weapon==='gun'){
     const hit=await p.evaluate(()=>{breach.shoot();breach.step(.13);return {hp:splatterActor.c.hp,splashes:breach.screenBlood.stats.splashes};});
     assert.equal(hit.hp,4,'actual bullet hits the live boarded raptor');if(!baseline)assert.equal(hit.splashes,1,'nonlethal boarded hit splatters');
     if(lane===0)await p.screenshot({path:`${dir}/${name}-${view}-hit.png`});
     await p.evaluate(()=>{const b=breach;for(let i=0;i<4;i++){const at=splatterActor.c.p.clone();at.y+=splatterActor.c.kind.centre*splatterActor.c.scale;b.aimAt(at);b.shoot();b.step(.13);}});
    }else await p.evaluate(()=>{const b=breach;b.grenade();for(let i=0;i<80&&b.combatFX.rocket.visible;i++)b.step(1/60);b.step(.12);});
    const result=await p.evaluate(()=>{const b=breach,canvas=b.screenBlood.canvas,data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;return {dead:splatterActor.c.state==='dead',kills:b.round.kills,splashes:b.screenBlood.stats.splashes,drops:b.screenBlood.drops.filter(d=>d.life>0).length,pixels,hidden:canvas.hidden,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(result.dead,true,`${name} ${view} ${lane} ${weapon} kills the raptor`);assert.equal(result.kills,1);assert.equal(result.overflow,false);
    if(!baseline){assert.equal(result.splashes,weapon==='gun'?5:1);assert.ok(result.drops>0&&result.drops<=48);assert.ok(result.pixels>0);assert.equal(result.hidden,false);}
    report.push({name,view,lane,weapon,...setup,...result});if(lane===0)await p.screenshot({path:`${dir}/${name}-${view}-${weapon}.png`});
   }
   if(!baseline){
    await p.keyboard.press('p');const paused=await p.evaluate(()=>breach.screenBlood.drops.map(d=>[d.life,d.y]));await p.evaluate(()=>breach.step(1));await p.waitForTimeout(120);assert.deepEqual(await p.evaluate(()=>breach.screenBlood.drops.map(d=>[d.life,d.y])),paused);await p.locator('#resume').click();
    await p.evaluate(()=>{for(let i=0;i<360;i++)breach.step(1/60);});assert.equal(await p.evaluate(()=>breach.screenBlood.drops.every(d=>d.life===0)&&breach.screenBlood.canvas.hidden),true,'droplets fade and hide');
    await p.evaluate(()=>breach.start());assert.equal(await p.evaluate(()=>breach.screenBlood.stats.splashes===0&&breach.screenBlood.drops.every(d=>d.life===0)),true,'restart clears lens');
    // Non-boarded bullets and remote explosive kills still leave the lens clean.
    for(const weapon of ['gun','rocket']){
     await p.evaluate(()=>breach.start());const result=await p.evaluate(weapon=>{const b=breach,a=b.director.spawn(0);a.path=null;a.phase='windup';a.c.p.set(-1.85,0,weapon==='gun'?8:20);a.from.copy(a.c.p);b.step(0);b.scene.updateMatrixWorld(true);const aim=()=>{const at=a.c.p.clone();at.y+=a.c.kind.centre*a.c.scale;b.aimAt(at);};aim();if(weapon==='gun'){for(let i=0;i<5;i++){aim();b.shoot();b.step(.13);}}else{b.grenade();for(let i=0;i<80&&b.combatFX.rocket.visible;i++)b.step(1/60);}return {dead:a.c.state==='dead',splashes:b.screenBlood.stats.splashes};},weapon);assert.equal(result.dead,true);assert.equal(result.splashes,0,`${weapon} in the yard leaves lens clear`);
    }
   }
   await p.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(`${baseline?'Baseline captured':'Breach splatter passed'}: ${report.length} boarded gun/rocket cases, first/third person, both sides, High desktop/Low phone, rendered droplets, pause/fade/reset and yard guards. No browser errors.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
