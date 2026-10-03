const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const dir='art/review/lost-circuit/ride-audit';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],report=[];
 try{
  for(const [name,width,height]of [['desktop',1440,900],['phone',390,844]]){
   const page=await browser.newPage({viewport:{width,height}});
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   await page.goto(new URL('arcade.html?test=1',process.env.TEST_URL||'http://127.0.0.1:5188/').href);await page.waitForFunction(()=>lostCircuit.ready);await page.locator('#start').click();await page.evaluate(()=>{lostCircuit.freeze(true);lostCircuit.step(8.8);lostCircuit.render();});await page.waitForTimeout(400);
   const before=await page.evaluate(()=>lostCircuit.diagnostics());
   for(let i=0;i<5;i++){await page.evaluate(()=>{lostCircuit.step(.2);lostCircuit.render();});await page.screenshot({path:`${dir}/${name}-approach-${i}.png`});}
   const after=await page.evaluate(()=>lostCircuit.diagnostics());assert(after.camera[2]-before.camera[2]>22,`${name}: vehicle covers real ground`);assert(after.actors.some(a=>a.rigged),`${name}: weighted raptor skeletons are present`);
   const muzzles=[];
   for(const [label,x,y]of [['left',.03,.2],['center',.5,.5],['right',.97,.8],['low',.5,.85]]){
    await page.evaluate(({x,y})=>{lostCircuit.setAim(x,y);lostCircuit.render();},{x,y});
    const weapon=await page.evaluate(()=>lostCircuit.diagnostics().weapon);assert(weapon.alignment>.9999,`${name} ${label}: bore converges on aim`);assert(weapon.screen.x>0&&weapon.screen.x<1&&weapon.screen.y>0&&weapon.screen.y<1,`${name} ${label}: muzzle stays visible`);muzzles.push({label,...weapon});
    await page.mouse.move(x*width,y*height);await page.mouse.down();await page.evaluate(()=>lostCircuit.step(.11));await page.mouse.up();await page.screenshot({path:`${dir}/${name}-gun-${label}.png`});
   }
   assert(Math.abs(muzzles[0].screen.x-muzzles[2].screen.x)>.35,`${name}: muzzle follows the mount across the viewport`);
   for(const slowed of [false,true]){
    const bridge=await page.evaluate(slowed=>{
     lostCircuit.seek('fault',18.8);const g=lostCircuit.getGame();g.travel=400;g.focusTime=slowed?5:0;g.hp=100;
     while(!g.bridgeBroken)lostCircuit.step(1/60);
     const distanceAtTrigger=g.bridgeOrigin-g.travel;
     while(g.travel<g.bridgeOrigin)lostCircuit.step(1/60);
     const peak=lostCircuit.diagnostics().camera;g.bridgeBroken=false;lostCircuit.render();const road=lostCircuit.diagnostics().camera;g.bridgeBroken=true;lostCircuit.render();
     return{distanceAtTrigger,lift:peak[1]-road[1],travel:g.travel,origin:g.bridgeOrigin};
    },slowed);
    assert(Math.abs(bridge.distanceAtTrigger-30)<.001,`${name}: collapse is ahead of vehicle`);assert(bridge.lift>2.29,`${name}: leap apex clears gap during ${slowed?'Overdrive':'normal travel'}`);
    await page.screenshot({path:`${dir}/${name}-bridge-${slowed?'overdrive':'normal'}.png`});
   }
   const scenes=[];
   for(const [id,at]of [['gates',3],['river',17],['fault',3],['fault',19.5],['hybrid',8],['lagoon',8],['manor',8],['visitor',8]]){
    await page.evaluate(({id,at})=>{lostCircuit.seek(id,at);const g=lostCircuit.getGame();g.focusTime=0;g.hp=100;lostCircuit.setAim(.5,.48);lostCircuit.step(2.5);lostCircuit.render();},{id,at});await page.waitForTimeout(180);await page.screenshot({path:`${dir}/${name}-${id}-${at}.png`});scenes.push({id,at,...await page.evaluate(()=>lostCircuit.diagnostics())});
   }
   await page.evaluate(()=>{lostCircuit.seek('gates',3);lostCircuit.freeze(false);});
   const frameTimes=await page.evaluate(()=>new Promise(resolve=>{let previous=performance.now(),n=0;const values=[];function tick(now){values.push(now-previous);previous=now;if(++n<90)requestAnimationFrame(tick);else resolve(values);}requestAnimationFrame(tick);}));frameTimes.sort((a,b)=>a-b);report.push({name,muzzles,scenes,frameTimeMs:{median:frameTimes[45],p95:frameTimes[85]}});await page.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(r=>({name:r.name,frames:r.frameTimeMs,draws:r.scenes.map(s=>[s.id,s.draws,s.triangles])})),null,2));console.log('Ride audit passed: actual travel, rigged creatures, full-screen bore/muzzle alignment, normal/Overdrive bridge alignment, two viewports, all environments, clean shaders and assets.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
