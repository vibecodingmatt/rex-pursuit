// Fast smoke test (~30 s): the game loads, compiles and plays without errors on
// desktop and phone. Run this for small changes; add focused checks only for the
// systems touched. See the skill's verification reference for the tiers.
const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}});watch(p);
  await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex&&rexChase.mode==='menu',{timeout:120000});
  await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
  await p.evaluate(()=>{const s=rexChase.state;s.transition('pursuit');s.distance=15;s.nextDebris=Infinity;});await p.waitForTimeout(600);
  const aim=await p.evaluate(()=>{const r=rexChase,h=r.rex.headPosition();h.y-=1;const v=h.project(r.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};});
  await p.mouse.move(aim.x,aim.y);await p.mouse.down();await p.waitForTimeout(500);await p.mouse.up();
  await p.keyboard.press('Space');await p.waitForTimeout(300);
  const s1=await p.evaluate(()=>rexChase.snapshot());assert.ok(s1.ammo<80,'fires');assert.ok(s1.health<5600,'hits register');
  await p.keyboard.press('v');await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>rexChase.view),'third');
  await p.keyboard.press('Escape');const t=await p.evaluate(()=>rexChase.state.time);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>rexChase.state.time),t,'pause freezes');await p.locator('#resume').click();
  await p.evaluate(()=>{rexChase.state.health=10;rexChase.state.hit(true);});await p.waitForFunction(()=>rexChase.state.victory?.time>1,{timeout:10000});
  await p.screenshot({path:'art/review/smoke-desktop.png'});await p.close();
  const m=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});watch(m);
  await m.goto(base);await m.waitForFunction(()=>window.rexChase?.rex&&rexChase.mode==='menu',{timeout:120000});await m.locator('#start').tap();await m.waitForFunction(()=>rexChase.mode==='playing');await m.waitForTimeout(800);
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no phone overflow');
  await m.screenshot({path:'art/review/smoke-phone.png'});
  assert.deepEqual(errors,[]);console.log(`Smoke passed: load, fire/hit, grenade, camera, pause, win transition, phone layout. ${JSON.stringify({drawCalls:s1.drawCalls,triangles:s1.triangles})}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
