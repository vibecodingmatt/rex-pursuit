const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],report={};
try{
 const p=await browser.newPage({viewport:{width:1600,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
 await p.evaluate(()=>{const r=rexChase;r.setView('third');r.state.transition('pursuit');r.state.distance=19;r.state.nextDebris=Infinity;});await p.waitForTimeout(650);
 await p.evaluate(()=>{const s=rexChase.state;s.jeep=1;s.phase='bite';s.phaseTime=.77;});await p.waitForFunction(()=>rexChase.state.result==='lost');assert.equal(await p.evaluate(()=>rexChase.view),'first');
 report.frames=[];
 for(const t of [.9,1.6,1.85,3.2,4.7,6.8,8.6,8.85,9.05,9.2,9.35,9.48,9.6,10.55]){
  await p.waitForFunction(t=>rexChase.state.defeat?.time>=t,t);await p.evaluate(()=>rexChase.freeze=true);
  report.frames.push(await p.evaluate(()=>{const r=rexChase,m=r.rex.mouthPosition();return{t:r.state.defeat.time,root:r.rex.actor.position.toArray(),jeep:r.jeep.root.position.toArray(),jeepYaw:r.jeep.root.rotation.y,gunDetached:r.jeep.weapon.detached,gunPosition:r.jeep.yaw.position.toArray(),mouth:m.center.toArray(),upper:m.upper.toArray(),lower:m.lower.toArray(),camera:r.camera.position.toArray(),jaw:r.rex.vocal.jaw,blood:+document.querySelector('#fatal-blood').style.opacity,black:+document.querySelector('#fatal-black').style.opacity,mode:r.mode,view:r.view};}));
  await p.screenshot({path:`art/review/defeat-${String(t).replace('.','-')}.png`});await p.evaluate(()=>rexChase.freeze=false);
  if(t===3.2){await p.keyboard.press('p');const frozen=await p.evaluate(()=>({t:rexChase.state.defeat.time,gun:rexChase.jeep.yaw.position.toArray(),spin:rexChase.jeep.root.rotation.y,black:document.querySelector('#fatal-black').style.opacity}));await p.waitForTimeout(250);assert.deepEqual(await p.evaluate(()=>({t:rexChase.state.defeat.time,gun:rexChase.jeep.yaw.position.toArray(),spin:rexChase.jeep.root.rotation.y,black:document.querySelector('#fatal-black').style.opacity})),frozen);await p.keyboard.press('p');await p.keyboard.press('v');assert.equal(await p.evaluate(()=>rexChase.view),'first');assert.equal(await p.evaluate(()=>rexChase.shoot()),false);}
 }
 assert.ok(report.frames.filter(f=>f.t<1.65).every(f=>!f.gunDetached));assert.ok(report.frames.filter(f=>f.t>1.85).every(f=>f.gunDetached));assert.ok(report.frames.filter(f=>f.t>4.7).every(f=>Math.abs(f.jeepYaw-2*Math.PI)<1e-6),'Jeep completes exactly one revolution before the final approach');for(let i=1;i<report.frames.length;i++)assert.ok(report.frames[i].jeepYaw>=report.frames[i-1].jeepYaw,'The spin never reverses');
 const stare=report.frames.find(f=>f.t>=8.6),windup=report.frames.find(f=>f.t>=9.2),gulp=report.frames.find(f=>f.t>=9.48);
 assert.ok(stare.jaw<.05,'Jaw stays relaxed for the look at the player');assert.ok(windup.upper[1]>stare.upper[1]+.15,'The head visibly lifts back before the gulp');assert.ok(gulp.root[2]<windup.root[2]-2,'The final bite surges forward');assert.ok(Math.abs(stare.camera[1]-windup.camera[1])<.025,'The camera must not follow and cancel out the head-back motion');
 await p.waitForFunction(()=>rexChase.mode==='ended');assert.equal(await p.evaluate(()=>+document.querySelector('#fatal-black').style.opacity),1);assert.equal(await p.locator('#end-title').textContent(),'Too close.');await p.screenshot({path:'art/review/defeat-ended.png'});
 for(const reason of ['ram','debris','timeout']){
  await p.evaluate(()=>rexChase.start());await p.evaluate(reason=>{const r=rexChase,s=r.state;r.setView('third');s.transition('pursuit');s.phaseTime=0;s.distance=reason==='debris'?22:11;s.nextDebris=Infinity;
   if(reason==='timeout')s.fightTime=89.99;
   else if(reason==='ram'){s.jeep=1;s.attackNumber=1;s.phase='ram';s.phaseTime=.77;}
   else{s.jeep=1;s.spawnDebris();while(s.debris.status==='attached')s.tickDebris(1/60);s.debris.age=s.debris.duration-.01;}
  },reason);
  await p.waitForFunction(()=>rexChase.state.defeat?.time>.1);assert.equal(await p.evaluate(()=>rexChase.view),'first');assert.equal(await p.evaluate(()=>rexChase.jeep.gunner.visible),false);assert.equal(await p.evaluate(()=>+document.querySelector('#fatal-black').style.opacity),0);
  await p.waitForFunction(()=>rexChase.mode==='ended');assert.equal(await p.evaluate(()=>+document.querySelector('#fatal-black').style.opacity),1);
 }
 await p.evaluate(()=>rexChase.start());assert.equal(await p.evaluate(()=>rexChase.state.defeat),null);assert.equal(await p.evaluate(()=>+document.querySelector('#fatal-black').style.opacity),0);assert.ok(await p.evaluate(()=>!rexChase.jeep.weapon.detached&&rexChase.jeep.yaw.parent===rexChase.jeep.body&&rexChase.jeep.weapon.hands.visible&&rexChase.jeep.root.rotation.y===0));
 await p.close();report.mobile=[];
 for(const [width,height]of [[390,844],[844,390]]){
  const phone=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(e.message));phone.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await phone.goto(base);await phone.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});await phone.locator('#start').click();await phone.evaluate(()=>{const r=rexChase;r.setView('third');r.state.transition('pursuit');r.state.distance=19;r.state.nextDebris=Infinity;});await phone.waitForTimeout(500);
  await phone.evaluate(()=>{const s=rexChase.state;s.jeep=1;s.phase='bite';s.phaseTime=.77;});await phone.waitForFunction(()=>rexChase.state.defeat?.time>=9.50);await phone.evaluate(()=>rexChase.freeze=true);
  const frame=await phone.evaluate(()=>{const r=rexChase,c=r.rex.mouthPosition().center.project(r.camera);return{view:r.view,mouthNdc:c.toArray(),overflow:document.documentElement.scrollWidth>innerWidth};});assert.equal(frame.view,'first');assert.equal(frame.overflow,false);assert.ok(Math.abs(frame.mouthNdc[0])<.4&&Math.abs(frame.mouthNdc[1])<.6,'The mouth must enclose the mobile camera');report.mobile.push({width,height,...frame});await phone.screenshot({path:`art/review/defeat-mobile-${width}.png`});await phone.evaluate(()=>rexChase.freeze=false);
  await phone.waitForFunction(()=>rexChase.mode==='ended');const end=await phone.evaluate(()=>{const overlay=document.querySelector('#fatal-black'),b=document.querySelector('#restart').getBoundingClientRect();return{black:+overlay.style.opacity,overlay:[overlay.clientWidth,overlay.clientHeight],button:[b.left,b.top,b.right,b.bottom]};});assert.equal(end.black,1);assert.deepEqual(end.overlay,[width,height]);assert.ok(end.button[0]>=0&&end.button[1]>=0&&end.button[2]<=width&&end.button[3]<=height,'Retry remains accessible');await phone.screenshot({path:`art/review/defeat-mobile-${width}-ended.png`});await phone.locator('#restart').click();await phone.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await phone.evaluate(()=>rexChase.state.defeat),null);await phone.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('art/review/defeat-verification.json',JSON.stringify({errors,...report},null,2));console.log(JSON.stringify({errors,...report},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
