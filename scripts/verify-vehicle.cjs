const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:5188/');await page.waitForFunction(()=>window.rexChase?.rex,null,{timeout:120000});
  await page.screenshot({path:'art/review/vehicle-home-driver.png'});
  await page.locator('#start').click();await page.waitForFunction(()=>rexChase.mode==='playing');
  await page.evaluate(()=>{rexChase.state.phase='pursuit';rexChase.state.distance=18;});await page.waitForTimeout(800);
  await page.screenshot({path:'art/review/vehicle-first-person.png'});
  await page.keyboard.press('v');await page.waitForTimeout(900);await page.screenshot({path:'art/review/vehicle-third-person.png'});
  await page.evaluate(()=>{const r=rexChase;r.freeze=true;document.querySelectorAll('.screen,.masthead,#boss,#hud-bottom,#warning,#reticle,#hit-marker,#hit-label').forEach(e=>e.style.display='none');r.camera.position.set(-4.4,2.9,-5.5);r.camera.lookAt(0,1.25,.2);r.camera.fov=42;r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();});
  await page.screenshot({path:'art/review/vehicle-front-detail.png'});
  await page.evaluate(()=>{const r=rexChase;r.camera.position.set(3.9,2.8,4.9);r.camera.lookAt(0,1.5,.7);r.camera.updateMatrixWorld();});await page.screenshot({path:'art/review/vehicle-rear-detail.png'});
  await page.evaluate(()=>{const r=rexChase;r.camera.position.set(-.57,2.22,-2.8);r.camera.lookAt(-.43,1.76,-.30);r.camera.fov=29;r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();});await page.screenshot({path:'art/review/driver-detail.png'});
  const driverReport=await page.evaluate(()=>{const r=rexChase,d=r.jeep.driver,aim=r.camera.position.clone().set(0,3.2,18);let maxGap=0,minAngle=Infinity,maxAngle=-Infinity;
   for(let i=0;i<120;i++){r.jeep.update(1/60,i/60,10,aim,true,r.state);r.scene.updateMatrixWorld(true);minAngle=Math.min(minAngle,d.wheel.rotation.z);maxAngle=Math.max(maxAngle,d.wheel.rotation.z);for(const a of d.arms){const grip=a.grip.getWorldPosition(aim.clone()),hand=a.hand.getWorldPosition(aim.clone());maxGap=Math.max(maxGap,grip.distanceTo(hand));}}
   r.jeep.update(0,2,10,aim,false,r.state);const hiddenFirst=!d.root.visible;r.jeep.update(0,2,10,aim,true,r.state);return{driverX:d.root.position.x,wheelX:d.steering.position.x,maxGap,steeringRange:maxAngle-minAngle,hiddenFirst,visibleThird:d.root.visible};});
  assert.ok(driverReport.driverX<0&&driverReport.wheelX<0,'Wheel and driver belong in the vehicle left seat');assert.ok(driverReport.maxGap<1e-6,'Hands stay on the moving steering wheel');assert.ok(driverReport.steeringRange>.03);assert.ok(driverReport.hiddenFirst&&driverReport.visibleThird);
  const report=await page.evaluate(()=>{
   const r=rexChase,w=r.jeep.weapon,aim=r.camera.position.clone().set(0,3.2,18),samples=[];
   for(const fps of [30,60,144]){
    r.state.reset();r.state.phase='pursuit';r.jeep.reset();let elapsed=0;
    for(let i=0;i<12;i++){r.state.shotTimer=0;r.shoot();r.shoot();for(let j=0;j<Math.ceil(.10*fps);j++){const dt=1/fps;elapsed+=dt;r.state.tick(dt);r.jeep.update(dt,elapsed,10,aim,false,r.state);}}
    const fired={fps,ammo:r.state.ammo,...w.stats};
    const before=w.stats.feedDistance;for(let i=0;i<fps;i++)r.jeep.update(1/fps,elapsed+i/fps,10,aim,false,r.state);
    fired.idleFeedDelta=w.stats.feedDistance-before;
    r.state.startReload();r.jeep.update(0,elapsed,10,aim,false,r.state);const oldShots=w.stats.shots;r.shoot();fired.blockedDuringReload=w.stats.shots===oldShots;
    r.state.reload=2.6*(1-.4);r.jeep.update(1/fps,elapsed,10,aim,false,r.state);fired.coverOpen=w.cover.rotation.x;fired.canLowered=w.can.position.y;
    r.state.reload=.001;r.state.tick(.002);r.jeep.update(1/fps,elapsed,10,aim,false,r.state);fired.refilled=r.state.ammo;fired.coverClosed=w.cover.rotation.x;
    fired.finite=[...w.cases.items,...w.links.items].every(p=>[...p.p.toArray(),...p.q.toArray()].every(Number.isFinite));
    for(let i=0;i<fps*3;i++)r.jeep.update(1/fps,elapsed+i/fps,10,aim,false,r.state);
    fired.expired=[...w.cases.items,...w.links.items].every(p=>p.age<0);samples.push(fired);
   }
   r.jeep.reset();r.state.reset();r.state.phase='pursuit';r.state.ammo=0;r.jeep.update(1/60,1,10,aim,false,r.state);
   const countBelt=()=>{const arr=w.beltParts[0].instanceMatrix.array;let count=0;for(let i=0;i<arr.length;i+=16)if(Math.abs(arr[i])+Math.abs(arr[i+1])>.1)count++;return count;};
   const emptyBelt=countBelt();r.state.startReload();r.state.reload=2.6*(1-.76);r.jeep.update(1/60,1,10,aim,false,r.state);const newBeltDuringReload=countBelt();
   const arms={maxLengthError:0,maxContactGap:0,contacts:[],finite:true};
   for(const third of [false,true])for(let i=0;i<=100;i++){
    const p=i/100;r.state.reload=2.6*(1-p);r.jeep.update(1/60,1+p,10,aim,third,r.state);
    for(const a of w.armRig.arms){arms.maxLengthError=Math.max(arms.maxLengthError,Math.abs(a.shoulder.distanceTo(a.bend)-a.upperLength),Math.abs(a.bend.distanceTo(a.wrist)-a.foreLength));arms.finite&&=[...a.hand.position.toArray(),...a.hand.quaternion.toArray()].every(Number.isFinite);}
    if([17,40,80,92].includes(i)){const a=w.armRig.arms[i===92?1:0],expected=a.hand.position.clone();if(i===17||i===80){expected.set(.055,.075,-.53);w.cover.localToWorld(expected);w.gun.worldToLocal(expected);}else if(i===40)expected.set(0,.043,-.187).applyEuler(w.can.rotation).add(w.can.position);else expected.set(-.255,.015,w.charging.position.z-.025);arms.maxContactGap=Math.max(arms.maxContactGap,expected.distanceTo(a.hand.position));arms.contacts.push(a.contact);}
   }
   r.jeep.reset();r.state.reset();r.state.phase='pursuit';r.jeep.update(1/60,1,10,aim,false,r.state);
   return{samples,arms,emptyBelt,newBeltDuringReload,reset:{...w.stats},drawCalls:r.renderer.info.render.calls,triangles:r.renderer.info.render.triangles};
  });
  for(const s of report.samples){assert.equal(s.shots,12);assert.equal(s.ammo,68);assert.equal(s.cases,12);assert.equal(s.links,12);assert.ok(Math.abs(s.feedDistance-12*.034)<1e-6);assert.equal(s.idleFeedDelta,0);assert.ok(s.blockedDuringReload);assert.ok(s.coverOpen>1.2);assert.ok(s.canLowered<-.55);assert.equal(s.refilled,80);assert.equal(s.coverClosed,0);assert.ok(s.finite&&s.expired);}
  assert.equal(report.reset.shots,0);assert.equal(report.reset.cases,0);assert.equal(report.emptyBelt,0);assert.ok(report.newBeltDuringReload>10);
  assert.ok(report.arms.maxLengthError<1e-6,'Reloading must not stretch upper arms or forearms');assert.ok(report.arms.maxContactGap<.005,'Hands hold the actual moving cover, can and charging handle');assert.ok(report.arms.finite);assert.deepEqual(report.arms.contacts,['cover','can','cover','charging','cover','can','cover','charging']);
  await page.evaluate(()=>{const r=rexChase;r.camera.position.set(.06,2.40,-.45);r.camera.lookAt(0,3.16,18);r.camera.fov=56;r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();});
  for(const p of [.17,.4,.69,.90]){await page.evaluate(p=>{const r=rexChase;r.state.ammo=48;r.state.reload=2.6*(1-p);for(let i=0;i<20;i++)r.jeep.update(1/60,2,10,r.camera.position.clone().set(0,3.16,18),false,r.state);},p);await page.screenshot({path:`art/review/weapon-reload-${Math.round(p*100)}.png`});}
  await page.evaluate(()=>{const r=rexChase;r.jeep.reset();r.state.reload=0;r.state.ammo=80;r.state.shotTimer=0;const a=r.camera.position.clone().set(0,3.16,18);for(let i=0;i<20;i++)r.jeep.update(1/60,2,10,a,false,r.state);r.shoot();r.jeep.update(.025,2,10,a,false,r.state);});await page.screenshot({path:'art/review/weapon-firing.png'});
  // Freeze must leave the entire mechanical cycle untouched, just as pause does.
  const before=await page.evaluate(()=>JSON.stringify({stats:rexChase.jeep.weapon.stats,case:rexChase.jeep.weapon.cases.items[0].p.toArray()}));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.stringify({stats:rexChase.jeep.weapon.stats,case:rexChase.jeep.weapon.cases.items[0].p.toArray()})),before);
  assert.deepEqual(errors,[]);report.driver=driverReport;report.errors=errors;fs.writeFileSync('art/review/vehicle-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
