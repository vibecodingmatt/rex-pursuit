// River ford: it is laid out by itself a little way into the pursuit, the Jeep rides
// down and out of it, the Rex splashes through (and is rinsed and soaked), the ground
// behind is wet, and a restart clears it. Source server on 5188 (TEST_URL to override).
const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex&&rexChase.mode==='menu',{timeout:120000});
  assert.equal(await p.evaluate(()=>rexChase.jungle.ford.active),false,'no ford in the menu');
  await p.evaluate(()=>rexChase.setConditions('clear',true));
  await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
  // Skip the opening; hold a steady pursuit with no attacks, debris or detour.
  await p.evaluate(()=>{const s=rexChase.state;s.transition('pursuit');s.distance=17;s.nextDebris=Infinity;s.ambushPlayed=true;s.phaseTime=-1000;});
  await p.waitForFunction(()=>rexChase.jungle.ford.active,{timeout:15000});
  const placed=await p.evaluate(()=>rexChase.jungle.ford.z);assert.ok(placed<-96,`laid out beyond the fog (z ${placed.toFixed(1)})`);
  // The Jeep: down the bank, through, and back up to the road.
  await p.evaluate(()=>{window.fordSamples=[];const f=()=>{const j=rexChase.jeep.root;if(Math.abs(rexChase.jungle.ford.z??99)<20)fordSamples.push({y:j.position.y,pitch:j.rotation.x,inWater:rexChase.ford.jeep.inWater,cam:rexChase.camera.position.y});if(fordSamples.length<4000&&rexChase.jungle.ford.active)requestAnimationFrame(f);};f();});
  await p.waitForFunction(()=>rexChase.ford.jeep.exited,{timeout:30000});await p.waitForTimeout(1500);
  const jeep=await p.evaluate(()=>({minY:Math.min(...fordSamples.map(s=>s.y)),maxPitch:Math.max(...fordSamples.map(s=>Math.abs(s.pitch))),y:rexChase.jeep.root.position.y,wet:rexChase.ford.jeep.wet,drops:rexChase.ford.stats.drops,sheets:Object.values(rexChase.ford.sheets).some(s=>s.start>=0||s.mesh.visible)}));
  assert.ok(jeep.minY<-.4&&jeep.minY>-.7,`Jeep dips into the ford (${jeep.minY.toFixed(2)} m)`);
  assert.ok(jeep.maxPitch>.05&&jeep.maxPitch<.25,`Jeep pitches on the banks (${jeep.maxPitch.toFixed(3)} rad)`);
  assert.ok(Math.abs(jeep.y)<.01,'Jeep back on the road');assert.ok(jeep.drops>300,`spray thrown (${jeep.drops} drops)`);
  // The Rex: footfalls land in the water, she is rinsed and soaked, and she climbs out.
  await p.waitForFunction(()=>rexChase.ford.rexWet.entered,{timeout:15000});
  await p.waitForFunction(()=>rexChase.ford.rexWet.entered&&!rexChase.ford.rexWet.inWater,{timeout:15000});await p.waitForTimeout(800);
  const rex=await p.evaluate(()=>{const u=rexChase.rex.hide.uniforms;return{steps:rexChase.ford.stats.waterSteps,soak:u.uRexSoak.value.x,rinse:u.uRexCoat.value.z,wet:rexChase.ford.wetSum(),y:rexChase.rex.actor.position.y};});
  assert.ok(rex.steps>=2,`splashing footfalls (${rex.steps})`);assert.ok(rex.soak>.8,'soaked by the crossing');assert.ok(rex.rinse>1.5,'legs rinsed');
  assert.ok(rex.wet>20,`wet ground behind the crossing (${rex.wet.toFixed(0)})`);assert.ok(rex.y>-.35,'the Rex back up on the road');
  // Mud builds up with every footfall on the road.
  const coat0=await p.evaluate(()=>rexChase.rex.hide.uniforms.uRexCoat.value.x);await p.waitForTimeout(3000);
  assert.ok(await p.evaluate(()=>rexChase.rex.hide.uniforms.uRexCoat.value.x)>coat0,'mud builds up as she runs');
  // A restart clears the river, the wet ground and her coat.
  await p.evaluate(()=>{rexChase.state.health=10;rexChase.state.hit(true);});await p.waitForFunction(()=>rexChase.mode==='ended',{timeout:30000});
  await p.locator('#restart').click();await p.waitForFunction(()=>rexChase.mode==='playing');
  const after=await p.evaluate(()=>({active:rexChase.jungle.ford.active,wet:rexChase.ford.wetSum(),coat:rexChase.rex.hide.uniforms.uRexCoat.value.toArray(),soak:rexChase.rex.hide.uniforms.uRexSoak.value.x,jeepWet:rexChase.ford.jeep.wet}));
  assert.equal(after.active,false);assert.equal(after.wet,0);assert.deepEqual(after.coat.slice(0,3),[.35,0,0]);assert.ok(after.coat[3]<.05,"fresh mud");assert.equal(after.soak,0);
  assert.deepEqual(errors,[]);console.log('Ford verified:',JSON.stringify({jeep,rex}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
