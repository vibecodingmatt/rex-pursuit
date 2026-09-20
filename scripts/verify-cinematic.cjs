const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],report={};
 try{
  const p=await browser.newPage({viewport:{width:1600,height:1000}});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
  await p.evaluate(()=>{const s=rexChase.state;s.transition('pursuit');s.phaseTime=0;s.nextDebris=Infinity;s.distance=18;});await p.waitForTimeout(1000);
  // Observe an attached branch moving with the road before it becomes a target.
  await p.evaluate(()=>{const r=rexChase;r.freeze=true;r.state.spawnDebris();while(r.state.debris.branchZ<r.state.distance-8){r.state.tick(1/60);r.rex.update(1/60,r.state,r.state.time,10,{jaw:0});r.debris.update(1/60,r.state,10);}r.renderer.render(r.scene,r.camera);});
  const attached=await p.evaluate(()=>({status:rexChase.state.debris.status,source:rexChase.debris.source.visible,target:rexChase.debris.visible,position:rexChase.debris.root.position.toArray()}));assert.equal(attached.status,'attached');assert.equal(attached.source,true);assert.equal(attached.target,false);
  await p.screenshot({path:'art/review/cinematic-branch-intact.png'});
  await p.evaluate(()=>{const r=rexChase;while(r.state.debris.status==='attached'){r.state.tick(1/60);r.rex.update(1/60,r.state,r.state.time,10,{jaw:0});}r.debris.breakBranch(r.state.debris);for(let i=0;i<18;i++){r.state.tickDebris(1/60);r.debris.update(1/60,r.state,10);}r.renderer.render(r.scene,r.camera);});
  const branch=await p.evaluate(()=>({status:rexChase.state.debris.status,fromZ:rexChase.state.debris.fromZ,sourceZ:rexChase.state.debris.branchZ,projectile:rexChase.debris.root.position.toArray(),visible:rexChase.debris.visible}));assert.equal(branch.status,'active');assert.equal(branch.visible,true);assert.ok(branch.projectile[2]<branch.fromZ&&branch.sourceZ>branch.fromZ);report.branch={attached,...branch};
  await p.screenshot({path:'art/review/cinematic-branch-broken.png'});
  // Identical close-up framing makes health stages directly comparable.
  await p.evaluate(()=>{const r=rexChase;r.state.reset();r.state.transition('pursuit');r.state.ambushPlayed=true;r.state.distance=10.8;r.rex.reset();r.debris.reset();r.opening.root.visible=false;r.camera.position.set(.18,2.65,-.45);r.camera.lookAt(0,3.95,8);r.camera.fov=56;r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();for(let i=0;i<60;i++)r.rex.update(1/60,r.state,1,10,{jaw:.18});});
  report.damage=[];
  for(const health of [100,70,40,12]){
   report.damage.push(await p.evaluate(health=>{const r=rexChase;r.state.health=5600*health/100;r.rex.damage.setHealth(health/100,10);r.renderer.render(r.scene,r.camera);return{health,stage:r.rex.damage.stage,wear:r.rex.damage.wear.value};},health));
   await p.screenshot({path:`art/review/cinematic-face-${health}.png`});
  }
  report.history=await p.evaluate(async()=>{
   const T=await import('three'),r=rexChase,ray=new T.Raycaster();let added=0,firstPixel,initial;
   for(let i=0;i<160;i++){const t=r.targets.targets[i%12],v=t.world.clone();r.rex.skin.getVertexPosition(t.indices[i%5],v);r.rex.skin.localToWorld(v);v.x+=Math.sin(i*2.399)*.40;v.y+=Math.cos(i*1.731)*.35;ray.set(r.camera.position,v.sub(r.camera.position).normalize());const hit=ray.intersectObject(r.rex.skin,false)[0];if(hit){r.rex.damage.add(hit,i%13===0);added++;if(!firstPixel){firstPixel=[Math.min(1023,Math.floor(hit.uv.x*1024)),Math.min(1023,Math.floor((1-hit.uv.y)*1024))];initial=[...r.rex.damage.ctx.getImageData(...firstPixel,1,1).data].slice(0,3);}}}
   const image=r.rex.damage.ctx.getImageData(0,0,1024,1024).data;let bloodPixels=0;for(let i=0;i<image.length;i+=4)if(image[i]>30)bloodPixels++;
   return{added,total:r.rex.damage.totalImpacts,recent:r.rex.damage.count,wrapped:r.rex.damage.serial,bloodPixels,initial,retained:[...r.rex.damage.ctx.getImageData(...firstPixel,1,1).data].slice(0,3)};
  });assert.ok(report.history.added>40&&report.history.total>36&&report.history.wrapped>0&&report.history.bloodPixels>100,JSON.stringify(report.history));assert.ok(report.history.retained.every((v,i)=>v>=report.history.initial[i]));
  await p.evaluate(()=>{const r=rexChase;r.renderer.render(r.scene,r.camera);});await p.screenshot({path:'art/review/cinematic-face-impacts.png'});
  // Exercise the live sequence, including a real pause in the offscreen beat.
  await p.evaluate(()=>{const r=rexChase;r.freeze=false;const s=r.state;s.debris=null;s.nextDebris=Infinity;s.ambushPlayed=false;s.health=2700;s.distance=19;s.phaseTime=1;s.fightTime=38;s.remaining=52;s.ammo=30;s.startReload();window.ambushSamples=[];const collect=()=>{const s=r.state;if(s.phase==='flank')ambushSamples.push({t:s.phaseTime,visible:r.rex.actor.visible,x:r.rex.actor.position.x,z:r.rex.actor.position.z,clock:s.fightTime,jaw:r.rex.vocal.jaw,energy:r.rex.vocal.energy,voice:r.rex.vocal.id,speed:r.rex.gait.speed});if(s.phase==='flank'||!s.ambushPlayed)requestAnimationFrame(collect);};collect();});
  await p.waitForFunction(()=>rexChase.state.phase==='flank'&&rexChase.state.phaseTime>1.4);await p.screenshot({path:'art/review/cinematic-veer.png'});
  await p.waitForFunction(()=>rexChase.state.phaseTime>3&&rexChase.state.phase==='flank');await p.screenshot({path:'art/review/cinematic-contact-lost.png'});
  await p.keyboard.press('p');await p.waitForFunction(()=>rexChase.audio.context.state==='suspended');
  const paused=await p.evaluate(()=>({t:rexChase.state.time,fight:rexChase.state.fightTime,a:rexChase.audio.context.currentTime}));await p.waitForTimeout(250);assert.deepEqual(await p.evaluate(()=>({t:rexChase.state.time,fight:rexChase.state.fightTime,a:rexChase.audio.context.currentTime})),paused);await p.keyboard.press('p');
  await p.waitForFunction(()=>rexChase.state.phase==='flank'&&rexChase.state.phaseTime>7.3);await p.screenshot({path:'art/review/cinematic-return-first.png'});
  await p.waitForFunction(()=>rexChase.state.phase==='challenge');
  const samples=await p.evaluate(()=>ambushSamples),hidden=samples.filter(s=>s.t>2.5&&s.t<5.0),roaring=samples.filter(s=>s.voice===2&&s.energy>.1);
  assert.ok(hidden.length>20&&hidden.every(s=>s.visible));assert.ok(samples.every(s=>s.clock===samples[0].clock));assert.ok(samples.some(s=>s.t>7.5&&s.visible&&s.z<10.1));assert.ok(roaring.length>5&&roaring.every(s=>s.jaw>.05));report.ambush={samples:samples.length,hidden:hidden.length,roaring:roaring.length,minRoarJaw:Math.min(...roaring.map(s=>s.jaw)),end:await p.evaluate(()=>rexChase.snapshot())};
  // The same authored turn is stable across frame rates; no hidden teleport
  // should leak velocity into the next visible stride.
  report.motion=await p.evaluate(async()=>{
   const {ambushPose,AMBUSH}=await import('/src/chase/ambush.js'),r=rexChase;r.freeze=true;const out=[];
   for(const fps of [30,60,144]){
    r.rex.reset();const s={phase:'flank',phaseTime:0,distance:21,ambush:{distance:21,x:0},health:2800,time:0};let previous=null,maxKnee=0,maxHip=0,worst=null;
    for(let i=0;i<(AMBUSH.duration+.5)*fps;i++){const t=i/fps;s.phase=t<AMBUSH.duration?'flank':'warning';s.phaseTime=t<AMBUSH.duration?t:t-AMBUSH.duration;s.distance=9.8;s.time=t;r.rex.update(1/fps,s,t,10,{jaw:.5,roar:.5});const visible=t>=AMBUSH.duration||ambushPose(t).visible,j=r.rex.gait.legs.map(l=>({k:l.knee.getWorldQuaternion(r.rex.actor.quaternion.clone()).normalize(),h:l.hip.getWorldQuaternion(r.rex.actor.quaternion.clone()).normalize()}));if(visible&&previous&&t>.2)j.forEach((q,n)=>{const kSpeed=q.k.angleTo(previous[n].k)*fps;if(kSpeed>maxKnee)worst={t,leg:n,phase:r.rex.gait.phase,stance:r.rex.gait.legs[n].stance,extension:r.rex.gait.legs[n].extensionError,velocity:r.rex.gait.rootVelocity.toArray()};maxKnee=Math.max(maxKnee,kSpeed);maxHip=Math.max(maxHip,q.h.angleTo(previous[n].h)*fps);});previous=visible?j:null;r.rex.drainMotionEvents();}
    out.push({fps,maxKnee,maxHip,worst});
   }return out;
  });console.log(JSON.stringify({motion:report.motion,history:report.history}));for(const m of report.motion){assert.ok(m.maxKnee<16,`Turn knee spike: ${JSON.stringify(m)}`);assert.ok(m.maxHip<19);}
  for(const [view,width,height]of [['third',1600,1000],['first',390,844],['third',390,844]]){
   await p.setViewportSize({width,height});await p.evaluate(view=>{const r=rexChase;r.freeze=false;r.setView(view);r.state.result=null;r.state.transition('flank');r.state.ambush={distance:21,x:0,startedAt:r.state.time-7.1,cues:new Set(['contact-lost','ambush-rustle','ambush-crash'])};r.state.phaseTime=7.1;r.state.health=850;r.state.remaining=45;},view);await p.waitForTimeout(400);await p.evaluate(()=>rexChase.freeze=true);await p.screenshot({path:`art/review/cinematic-return-${view}-${width}.png`});
  }
  await p.evaluate(()=>rexChase.start());assert.deepEqual(await p.evaluate(()=>({played:rexChase.state.ambushPlayed,marks:rexChase.rex.damage.totalImpacts,stage:rexChase.rex.damage.stage,branch:rexChase.debris.source.visible,breakout:rexChase.ambushScenery.root.visible})),{played:false,marks:0,stage:0,branch:false,breakout:false});
  assert.deepEqual(errors,[]);fs.writeFileSync('art/review/cinematic-verification.json',JSON.stringify({errors,...report},null,2));console.log(JSON.stringify({errors,...report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
