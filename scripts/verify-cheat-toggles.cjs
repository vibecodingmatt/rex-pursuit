const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 fs.mkdirSync('art/review/cheat-toggles',{recursive:true});
 try{for(const game of ['pursuit','safari','breach']){
  const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(game==='breach'?new URL('breach.html?menu=1',base).href:base);
  await p.waitForFunction(()=>window.breach?.ready||window.rexChase?.mode==='menu',null,{timeout:120000});
  await p.keyboard.type('idspispipdidkfa');assert.equal(await p.evaluate(()=>(window.breach?.round||rexChase.state).cheated),false);
  if(game==='safari')await p.locator('[data-game-mode=safari]').click();await p.locator('#start').click();await p.waitForFunction(()=>(window.breach||rexChase).mode==='playing');
  await p.evaluate(game=>{const r=window.breach||rexChase,s=r.round||r.state;r.freeze=true;
   if(game==='pursuit')s.transition('pursuit');if(s.safari)s.safari.ready=0;
   s.ammo=17;s.reload=1;s.heat=.2;s.grenade=8;window.acceptedLaunches=0;
   const method=r.round?'launchGrenade':'launch',launch=s[method].bind(s);s[method]=()=>{const accepted=launch();acceptedLaunches+=Number(accepted);return accepted;};document.activeElement.blur();
  },game);
  const state=()=>p.evaluate(()=>{const r=window.breach||rexChase,s=r.round||r.state;return {mode:r.mode,ammo:s.ammo,reload:s.reload,heat:s.heat,rockets:s.infiniteRockets,gun:s.infiniteAmmo,cheated:s.cheated,grenade:s.grenade,accepted:acceptedLaunches};});
  await p.keyboard.type('IDSPISPIPD');assert.deepEqual(await state(),{mode:'playing',ammo:17,reload:1,heat:.2,rockets:true,gun:false,cheated:true,grenade:0,accepted:0});
  for(let i=0;i<12;i++)await p.keyboard.press('Space');assert.equal((await state()).accepted,12);assert.equal((await state()).grenade,0);
  if(game==='breach'){
   assert.equal(await p.evaluate(()=>breach.combatFX.flights.filter(f=>f.on).length),12,'rockets coexist instead of replacing one another');
   await p.keyboard.press('p');const flight=await p.evaluate(()=>breach.combatFX.flights.filter(f=>f.on).map(f=>f.position.toArray()));await p.waitForTimeout(200);assert.deepEqual(await p.evaluate(()=>breach.combatFX.flights.filter(f=>f.on).map(f=>f.position.toArray())),flight);await p.locator('#resume').click();await p.evaluate(()=>document.activeElement.blur());
   const impact=await p.evaluate(()=>{const f=breach.combatFX;for(let i=0;i<100&&f.rocket.visible;i++)f.update(1/60);return {fired:f.stats.rockets,impacts:f.stats.detonations,active:f.rocket.visible};});assert.deepEqual(impact,{fired:12,impacts:12,active:false});
  }
  await p.keyboard.type('idkfa');assert.equal((await state()).gun,true);assert.equal((await state()).rockets,true);assert.equal((await state()).ammo,80);assert.equal((await state()).reload,0);assert.equal((await state()).heat,0);
  assert.match(await p.locator('#cheat-status').innerText(),/IDKFA \+ IDSPISPIPD/);
  await p.keyboard.type('idspispipd');assert.equal((await state()).rockets,false);assert.equal((await state()).gun,true);await p.keyboard.press('Space');await p.keyboard.press('Space');assert.equal((await state()).accepted,13);assert.equal((await state()).grenade,11);
  await p.keyboard.type('idkfa');assert.equal((await state()).gun,false);assert.equal((await state()).cheated,true);assert.match(await p.locator('#cheat-status').innerText(),/CODES OFF/);
  await p.keyboard.type('idspispipdidkfaidkfa');assert.equal((await state()).rockets,true);assert.equal((await state()).gun,false);await p.keyboard.press('Space');await p.keyboard.press('Space');assert.equal((await state()).accepted,15);
  await p.keyboard.press('p');await p.keyboard.type('idspispipdidkfa');assert.equal((await state()).mode,'paused','P inside the code must not unpause');assert.equal((await state()).rockets,true);assert.equal((await state()).gun,false);await p.locator('#resume').click();
  await p.evaluate(()=>{const field=document.createElement('input');field.id='cheat-editor';document.body.append(field);field.focus();});await p.keyboard.type('idspispipdidkfa');assert.equal((await state()).rockets,true);assert.equal((await state()).gun,false);await p.evaluate(()=>document.getElementById('cheat-editor').remove());
  await p.keyboard.type('idkfa');await p.evaluate(()=>{const r=window.breach||rexChase;r.freeze=false;});
  await p.waitForFunction(()=>document.getElementById('grenade-state').textContent==='∞');await p.screenshot({path:`art/review/cheat-toggles/${game}-both.png`});
  if(game==='breach'){
   const stress=await p.evaluate(()=>{const b=breach,f=b.combatFX;b.freeze=true;f.reset();const count=96,seen=Array(count).fill(0),ends=[];
    for(let i=0;i<count;i++){const from=b.camera.position.clone().set(i*.01,3,0),to=from.clone().setZ(70);f.launch(from,to,p=>{seen[i]++;ends[i]=p.toArray();});}
    const active=f.flights.filter(f=>f.on).length,draws=f.rocket.children.length;f.update(2);const after={seen,ends,active,capacity:f.flights.length,draws,launched:f.stats.rockets,detonated:f.stats.detonations,visible:f.rocket.visible};
    f.launch(b.camera.position,b.camera.position.clone().setZ(90),()=>{throw Error('Reset rocket detonated');});f.reset();f.update(2);return after;
   });assert.equal(stress.capacity,64);assert.equal(stress.active,64);assert.equal(stress.draws,3);assert.equal(stress.launched,96);assert.equal(stress.detonated,96);assert.equal(stress.visible,false);assert.ok(stress.seen.every(n=>n===1));stress.ends.forEach((p,i)=>{assert.ok(Math.abs(p[0]-i*.01)<1e-6);assert.equal(p[2],70);});
  }
  await p.evaluate(async()=>{const r=window.breach||rexChase;await r.start();r.freeze=false;});await p.waitForFunction(()=>(window.breach||rexChase).mode==='playing');
  const clean=await state();assert.equal(clean.gun,false);assert.equal(clean.rockets,false);assert.equal(clean.cheated,false);assert.equal(await p.locator('#cheat-status').isVisible(),false);await p.close();
 }
 assert.deepEqual(errors,[]);console.log('Cheat toggles passed in all modes: either/both/off, real code input and rapid Space launches, cooldown restoration, pause/editor guards, HUD/reset; concurrent rocket impacts, bounded overflow and canceled flights.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
