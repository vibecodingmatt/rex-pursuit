// Shootable wildlife: fire is held only in the opening; in the detour the gun stays live,
// the hidden Rex takes no hits, and compies flushed from her side cross the road behind
// the Jeep and can be shot down; a shot brachiosaur rears up and stomps back down.
// Source server on 5188 (TEST_URL to override).
const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist']}),errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex&&rexChase.mode==='menu'&&rexChase.brachio.ready,{timeout:120000});
  await p.evaluate(()=>rexChase.setConditions('clear',true));
  await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
  // The opening still holds fire.
  assert.equal(await p.evaluate(()=>{rexChase.shoot();return rexChase.state.shots;}),0,'no shots in the opening');
  // Straight into the detour.
  await p.evaluate(()=>{const s=rexChase.state;s.transition('pursuit');s.phaseTime=1;s.nextDebris=Infinity;s.fightTime=45;});
  await p.waitForFunction(()=>rexChase.state.phase==='flank');
  const early=await p.evaluate(()=>{const s=rexChase.state,before=s.shots;rexChase.aimAt(rexChase.rex.headPosition());rexChase.shoot();return{locked:s.weaponsLocked,fired:s.shots-before};});
  assert.equal(early.locked,false);assert.equal(early.fired,1,'the gun fires as she breaks off');
  // Hidden in the trees she takes no hits, even with the reticle on her.
  await p.waitForFunction(()=>rexChase.state.concealed&&rexChase.state.phaseTime>3);
  const hidden=await p.evaluate(async()=>{const s=rexChase.state,health=s.health;for(let i=0;i<5;i++){rexChase.aimAt(rexChase.rex.headPosition());rexChase.shoot();await new Promise(r=>setTimeout(r,120));}return{health,after:s.health,shots:s.shots};});
  assert.equal(hidden.after,hidden.health,'no damage while concealed');
  // Compies flushed from her side cross behind the Jeep; pick them off.
  await p.waitForFunction(()=>rexChase.critters.live().some(c=>c.crossing&&Math.abs(c.x)<4),{timeout:5000});
  await p.screenshot({path:'art/review/wildlife-flank.png'});
  const hunt=await p.evaluate(async()=>{const r=rexChase,T=r.camera.position.constructor;let tries=0;
   while(tries<150&&r.critters.stats().kills<2&&r.state.phase==='flank'){const c=r.critters.live().filter(c=>c.crossing&&Math.abs(c.x)<6).sort((a,b)=>a.z-b.z)[0];
    if(c){r.aimAt(new T(c.x,c.y,c.z));r.shoot();tries++;}await new Promise(res=>requestAnimationFrame(res));}
   return{kills:r.critters.stats().kills,tries,phase:r.state.phase,crossers:r.critters.live().filter(c=>c.crossing).length};});
  assert.ok(hunt.kills>=2,`compies shot down in the detour (${hunt.kills} in ${hunt.tries} shots)`);
  await p.waitForTimeout(700);
  const dead=await p.evaluate(()=>rexChase.critters.stats());assert.ok(dead.dead>=1,'the dead lie on the road');
  await p.waitForFunction(()=>rexChase.state.phase!=='flank',{timeout:8000});
  // The brachiosaur: shot in the flank, she rears up, then stomps back down.
  const shot=await p.evaluate(async()=>{const r=rexChase,s=r.state,T=r.camera.position.constructor;s.transition('pursuit');s.phaseTime=-1000;s.nextDebris=Infinity;Object.assign(s,{heat:0,overheated:false,reload:0,shotTimer:0,ammo:80});
   window.stomps=0;const stomp=r.brachio.onStomp;r.brachio.onStomp=f=>{window.stomps++;stomp(f);};
   r.brachio.show(-12,14);await new Promise(res=>requestAnimationFrame(res));await new Promise(res=>requestAnimationFrame(res));
   const health=s.health;r.aimAt(r.brachio.mesh.localToWorld(new T(0,4.6,0)));const hit=r.shoot(),rearing=r.brachio.rearing;return{hit,rearing,again:r.brachio.startle(),health,after:s.health};});
  assert.ok(shot.hit&&shot.rearing,'a round into the brachiosaur makes her rear');assert.equal(shot.after,shot.health,'the Rex is not credited with the hit');assert.equal(shot.again,false,'no second rear while she is up');
  await p.waitForTimeout(2300);await p.screenshot({path:'art/review/wildlife-rear.png'});
  await p.waitForFunction(()=>window.stomps===1,{timeout:5000});
  // Restart clears the dead and the rear.
  await p.evaluate(()=>rexChase.start());await p.waitForFunction(()=>rexChase.mode==='playing');
  const reset=await p.evaluate(()=>({...rexChase.critters.stats(),rearing:rexChase.brachio.rearing}));
  assert.equal(reset.dead,0);assert.equal(reset.kills,0);assert.equal(reset.rearing,false);
  assert.deepEqual(errors,[]);
  console.log(`Wildlife passed: fire held in the opening, live through the detour, no hits on the hidden Rex, ${hunt.kills} crossing compies shot down, brachiosaur rear and stomp, restart cleared.`);
 }catch(e){console.error(e.message);if(errors.length)console.error(errors);process.exitCode=1;}finally{await browser.close();}
})();
