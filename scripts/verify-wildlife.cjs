// Shootable wildlife: fire is held only in the opening; in the detour the gun stays live,
// the hidden Rex takes no hits, and compies flushed from her side cross the road behind
// the Jeep and can be shot down; a shot brachiosaur rears up and stomps back down; every
// other species can be shot and is tallied, and the results screen lists the bag.
// Source server on 5188 (TEST_URL to override).
const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist']}),errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('page:',m.text().slice(0,400));}});
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
  // Every other species, each tallied: a Gallimimus from a herd (clear of the Rex), a Pteranodon
  // coming down the corridor, a Dimorphodon on a real roost, a bird, a lizard. Aim and fire in
  // the same frame, so a moving target is where the round goes.
  const shootAt=(kind,pick,setup='')=>p.evaluate(async([kind,pick,setup])=>{const r=rexChase,T=r.camera.position.constructor,f=eval(pick);eval(setup);
   for(const until=performance.now()+20000;performance.now()<until&&!r.state.bag[kind];){const c=f(r);if(c){Object.assign(r.state,{heat:0,overheated:false,reload:0,shotTimer:0,ammo:80});r.aimAt(new T(c.x,c.y,c.z));r.shoot();}await new Promise(res=>requestAnimationFrame(res));}
   if(!r.state.bag[kind])console.error(kind,'not bagged; live:',JSON.stringify(kind==='pteranodon'?r.flyers.live(kind):kind==='bird'?r.birds.live():r.critters.live(kind)));
   return r.state.bag[kind]||0;},[kind,pick,setup]);
  await p.evaluate(()=>{const s=rexChase.state;s.transition('pursuit');s.phaseTime=-1000;s.nextDebris=Infinity;});
  assert.ok(await shootAt('gallimimus',"r=>r.critters.live('gallimimus').filter(c=>Math.abs(c.x)>5&&Math.abs(c.x)<14)[0]","r.critters.herd(1,{count:6})"),'a Gallimimus shot down');
  assert.ok(await shootAt('pteranodon',"r=>r.flyers.live('pteranodon').filter(c=>c.z<45&&c.z>6)[0]","r.flyers.pass(1,2,true)"),'a Pteranodon shot down');
  const roost=await p.evaluate(()=>{const r=rexChase,q=r.jungle.chunks.flatMap(c=>(c.roosts||[]).map(t=>t.map(q=>({...q,z:q.z+c.group.position.z})))).filter(t=>t[0].z>10&&t[0].z<40).sort((a,b)=>Math.abs(a[0].z-18)-Math.abs(b[0].z-18))[0];
   if(!q)return null;r.freeze=true;const a=r.flyers.perch(q[0].x,q[0].y,q[0].z,q[0].nx,q[0].nz),b=r.flyers.perch(q[2].x,q[2].y,q[2].z,q[2].nx,q[2].nz);r.flyers.update(1e-4,{speed:0,spawn:false});
   Object.assign(r.state,{shotTimer:0,heat:0});r.aimAt(a.p);const hit=r.shoot();r.freeze=false;return{hit,bag:r.state.bag.dimorphodon||0,neighbour:b.state,flushAt:b.flushAt};});
  assert.ok(roost,'a roost in range');assert.ok(roost.hit&&roost.bag===1,'a Dimorphodon shot off its trunk');
  await p.waitForTimeout(600);assert.ok(await p.evaluate(()=>rexChase.flyers.stats().flying>0),'its roost-mate takes flight');
  assert.ok(await shootAt('bird',"r=>r.birds.live().filter(b=>Math.abs(b.x)>3)[0]","r.birds.scatter(new T(-6,9,20),{spread:5,count:8})"),'a bird shot down');
  assert.ok(await shootAt('lizard',"r=>r.critters.live('lizard').filter(c=>c.z>6&&c.z<30&&Math.abs(c.x)>4)[0]","for(const z of [12,16,20,24])r.critters.spawnLizardNear(6,z),r.critters.spawnLizardNear(-6,z)"),'a lizard shot off its rock');
  const bag=await p.evaluate(()=>({...rexChase.state.bag}));
  // The results screen lists the bag.
  await p.evaluate(()=>{const r=rexChase;r.state.health=1;Object.assign(r.state,{shotTimer:0,heat:0,overheated:false,reload:0});r.aimAt(r.rex.headPosition());r.shoot();});
  await p.waitForFunction(()=>rexChase.state.result==='won');await p.waitForFunction(()=>rexChase.mode==='ended',null,{timeout:60000});
  const line=await p.locator('#end-bag').textContent();await p.waitForTimeout(900);await p.screenshot({path:'art/review/wildlife-results.png'});
  for(const [k,n]of Object.entries(bag))assert.ok(line.includes(`${n} ${n===1?k:k==='compy'?'compies':k==='gallimimus'?k:k+'s'}`),`results list ${n} ${k}: ${line}`);
  assert.ok((await p.locator('#end-stats').textContent()).includes('attacks repelled'),'the chase stats are still there');
  // Restart clears the dead, the bag and the rear.
  await p.evaluate(()=>rexChase.start());await p.waitForFunction(()=>rexChase.mode==='playing');
  const reset=await p.evaluate(()=>({...rexChase.critters.stats(),rearing:rexChase.brachio.rearing,bag:Object.keys(rexChase.state.bag).length,flyersDead:rexChase.flyers.stats().dead}));
  assert.equal(reset.dead,0);assert.equal(reset.kills,0);assert.equal(reset.rearing,false);assert.equal(reset.bag,0);assert.equal(reset.flyersDead,0);
  assert.deepEqual(errors,[]);
  console.log(`Wildlife passed: fire held in the opening, live through the detour, no hits on the hidden Rex, ${hunt.kills} crossing compies shot down, brachiosaur rear and stomp, a Gallimimus, Pteranodon, Dimorphodon (roost-mate flushed), bird and lizard bagged and listed on the results (${JSON.stringify(bag)}), restart cleared.`);
 }catch(e){console.error(e.message);if(errors.length)console.error(errors);process.exitCode=1;}finally{await browser.close();}
})();
