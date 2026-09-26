const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/',url=new URL('breach.html',base).href;
(async()=>{
 fs.mkdirSync('art/review/breach',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 const open=async p=>{watch(p);await p.goto(url);await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});};
 const play=async(p,restart=false)=>{await p.locator(restart?'#restart':'#start').click();await p.waitForFunction(()=>breach.mode==='playing');};
 const snap=async(p,name)=>{await p.waitForTimeout(150);await p.screenshot({path:`art/review/breach/${name}.png`});};
 let p;
 try{
  p=await browser.newPage({viewport:{width:1440,height:900}});await open(p);await snap(p,'menu');await play(p);await snap(p,'start');
  await p.keyboard.press('p');assert.equal(await p.evaluate(()=>breach.mode),'paused');const paused=await p.evaluate(()=>breach.round.time);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>breach.round.time),paused);await p.locator('#resume').click();
  const landed=await p.evaluate(()=>{const b=breach;b.freeze=true;while(!b.director.live.some(a=>a.phase==='board')&&b.round.time<25)b.step(1/60);const a=b.director.live.find(a=>a.phase==='board');return{phase:a?.phase,health:b.round.jeep,age:a?.age,position:a?.c.p.toArray()};});
  assert.equal(landed.phase,'board');assert.equal(landed.health,100,'The player gets time to react before the first bite');await snap(p,'raptor');
  await p.keyboard.press('v');await p.evaluate(()=>{const b=breach,c=b.director.warning.c,at=c.p.clone();at.y+=c.kind.centre*c.scale;b.step(0);for(let i=0;i<20;i++){b.aimAt(at);b.step(1/60);}});assert.equal(await p.evaluate(()=>breach.view),'third');
  const alignment=await p.evaluate(()=>{const b=breach,c=b.director.warning.c,at=c.p.clone();at.y+=c.kind.centre*c.scale;const muzzle=b.jeep.muzzle.getWorldPosition(at.clone()),forward=b.jeep.gun.getWorldDirection(at.clone());return forward.dot(at.sub(muzzle).normalize());});assert.ok(alignment>.94,'Third-person gun points at the close target');
  await snap(p,'third-raptor');await p.keyboard.press('v');await p.evaluate(()=>breach.step(0));
  const closeKill=await p.evaluate(()=>{const b=breach,a=b.director.live.find(a=>a.phase==='board'),c=a.c,target=c.p.clone();target.y+=c.kind.centre*c.scale;b.scene.updateMatrixWorld(true);b.aimAt(target);const hp=c.hp;for(let i=0;i<hp;i++){b.round.shotTimer=0;b.shoot();}return{dead:c.state==='dead',saves:b.round.saves,hits:b.round.hits};});
  assert.equal(closeKill.dead,true,'Camera ray hits the landed raptor');assert.equal(closeKill.saves,1);assert.equal(closeKill.hits,5);
  const trap=await p.evaluate(()=>{const b=breach;while(!b.director.live.some(a=>a.c.p.z<20)&&b.round.time<30)b.step(1/60);const sw=b.world.switches[0];b.scene.updateMatrixWorld(true);b.aimAt(sw.getWorldPosition(sw.position.clone()));b.round.shotTimer=0;b.shoot();b.step(1/60);return{cooldown:b.round.trap,kills:b.round.trapKills};});
  assert.ok(trap.cooldown>17);assert.ok(trap.kills>0,'Shooting the actual switch catches the pack');await snap(p,'grid');
  const grenade=await p.evaluate(()=>{const b=breach;while(!b.director.live.some(a=>a.c.fade===1&&a.c.p.z<24))b.step(1/60);const c=b.director.live.find(a=>a.c.fade===1&&a.c.p.z<24).c,at=c.p.clone();at.y+=c.kind.centre*c.scale;b.aimAt(at);b.grenade();const flight=b.combatFX.rocket.visible;for(let i=0;i<50;i++)b.step(1/60);return{dead:c.state==='dead',cooldown:b.round.grenade,flight,blood:b.combatFX.stats};});assert.equal(grenade.flight,true);assert.equal(grenade.dead,true);assert.ok(grenade.cooldown>10);assert.ok(grenade.blood.chunks>10&&grenade.blood.stains>0,'Rocket produces physical gore and splatter');
  // Simulate a whole run, aiming through the real hit proxies. No health or
  // cooldown edits here: this also establishes that the authored encounter wins.
  await p.evaluate(()=>{const b=breach;window.breachAutoplay=()=>{
   const live=b.director.live,a=b.director.warning||live.find(a=>a.entered),r=b.round;
   if(r.trap===0&&(live.filter(a=>a.c.p.z>=6&&a.c.p.z<=27).length>=3||(r.time>=99&&r.rexDistance<24))){const sw=b.world.switches[0];b.aimAt(sw.getWorldPosition(sw.position.clone()));b.shoot();}
   else if(r.time>=99&&r.rexDistance<27&&(!a||!['board','charge'].includes(a.phase))){b.aimAt(b.rex.headPosition());b.shoot();if(r.grenade===0)b.grenade();}
   else if(a){const at=a.c.p.clone();at.y+=a.c.kind.centre*a.c.scale;b.aimAt(at);b.shoot();if(r.grenade===0&&(a.heavy||live.length>=3||r.reload>0))b.grenade();}
   else if(r.ammo<60)r.startReload();b.step(1/60);
  };while(b.round.time<100&&!b.round.result)breachAutoplay();});
  assert.equal(await p.evaluate(()=>breach.round.result),null);await snap(p,'fence-breach');
  await p.evaluate(()=>{while(breach.round.time<114&&!breach.round.result)breachAutoplay();});await snap(p,'rex-finale');
  await p.evaluate(()=>{while(breach.round.phase!=='escape'&&!breach.round.result)breachAutoplay();for(let i=0;i<60;i++)breach.step(1/60);});await snap(p,'getaway');
  await p.evaluate(()=>{for(let i=0;i<900&&!breach.round.result;i++)breachAutoplay();});assert.equal(await p.evaluate(()=>breach.round.result),'won');assert.equal(await p.locator('#end-screen').isVisible(),true);assert.ok(await p.evaluate(()=>breach.round.staggers>0));assert.ok(await p.evaluate(()=>breach.director.stats.spawned>55&&breach.director.stats.rams>3),'Sustained mixed-species pressure');assert.ok(await p.evaluate(()=>Number(localStorage.getItem('rex-breach-best-v1'))>0));await snap(p,'escape-results');console.log('Winning run',await p.evaluate(()=>({...breach.snapshot(),pressure:breach.director.stats,blood:breach.combatFX.stats})));
  await play(p,true);const reset=await p.evaluate(()=>({health:breach.round.jeep,kills:breach.round.kills,gate:breach.world.root.position.z}));assert.deepEqual(reset,{health:100,kills:0,gate:0});
  await p.evaluate(()=>{for(let i=0;i<7200&&breach.mode!=='ended';i++)breach.step(1/60);});assert.equal(await p.evaluate(()=>breach.round.result),'lost');await snap(p,'defeat');
  await play(p,true);await p.evaluate(()=>{breach.freeze=false;dispatchEvent(new Event('blur'));});assert.equal(await p.evaluate(()=>breach.mode),'paused');await p.close();
  // Touch fire/aim together, rotation, controls, and a close attacker at Low.
  p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await open(p);await p.locator('#quality').selectOption('low');await snap(p,'phone-menu');await play(p);const session=await p.context().newCDPSession(p);
  for(const [width,height,name]of [[390,844,'phone'],[844,390,'landscape']]){
   await p.setViewportSize({width,height});await p.waitForTimeout(200);assert.equal(await p.locator('#fire').isVisible(),true);
   const fire=await p.locator('#fire').boundingBox();assert.ok(fire.x>=0&&fire.y>=0&&fire.x+fire.width<=width&&fire.y+fire.height<=height);
   const before=await p.evaluate(()=>breach.round.shots);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width*.4,y:height*.6,id:1},{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:2}]});await p.waitForTimeout(400);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await p.evaluate(()=>breach.round.shots)>before,`${name} fires while aiming`);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await snap(p,name);
  }
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{breach.freeze=true;while(!breach.director.live.some(a=>a.phase==='board')&&breach.round.time<25)breach.step(1/60);});await snap(p,'phone-raptor');
  assert.deepEqual(errors,[]);console.log('Breach browser passed: readable attack, real ray kills/trap/grenade, complete win/loss/restart, persistence, pause/blur, trusted touch aim/fire, Low, portrait and landscape. No runtime/asset/shader errors.');
 }catch(e){if(p&&!p.isClosed())await p.screenshot({path:'art/review/breach/failure.png'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
