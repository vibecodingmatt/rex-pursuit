const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('fs');

(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:5188/');
  await page.waitForFunction(()=>window.rexChase?.rex,null,{timeout:120000});
  await page.locator('#start').click();
  await page.waitForFunction(()=>rexChase.mode==='playing');
  const report=await page.evaluate(async()=>{
   const {rex}=rexChase;rexChase.freeze=true;
   const results=[];
   for(const fps of [30,60,144]){
    for(const phase of ['walk','intro','pursuit','warning','charge']){
     rex.reset();let previous=null,plants=0,maxSlip=0,maxExtension=0,maxStep=0,lowestToe=Infinity,highestToe=-Infinity;
     let leftMin=Infinity,leftMax=-Infinity,firstPhase=0,lastPhase=0,airborne=0,minSweep=Infinity,maxSweep=-Infinity;const footsteps=[];
     const roadSpeed=phase==='walk'?2.2:10,duration=phase==='walk'?6:2.8;
     for(let i=0;i<fps*duration;i++){
      const t=i/fps,distance=phase==='charge'?30-t*5.3:24;
      rex.update(1/fps,{phase,phaseTime:t,distance,result:null},t,roadSpeed);
      for(const e of rex.drainMotionEvents())if(e.type==='footstep')footsteps.push({side:e.side,time:t});
      if(rex.gait.legs.every(l=>!l.stance))airborne++;
      const relative=rex.actor.worldToLocal(rex.gait.legs[0].toe.getWorldPosition(rex.actor.position.clone()));minSweep=Math.min(minSweep,relative.z);maxSweep=Math.max(maxSweep,relative.z);
      if(i===0)firstPhase=rex.gait.phase;lastPhase=rex.gait.phase;
      const feet=rex.gait.legs.map(leg=>({position:leg.toe.getWorldPosition(rex.actor.position.clone()).toArray(),stance:leg.stance,extension:leg.extensionError,phase:leg.phase}));
      for(let j=0;j<feet.length;j++){
       const foot=feet[j];lowestToe=Math.min(lowestToe,foot.position[1]);highestToe=Math.max(highestToe,foot.position[1]);maxExtension=Math.max(maxExtension,foot.extension);
       if(previous){const delta=foot.position.map((v,k)=>v-previous[j].position[k]);maxStep=Math.max(maxStep,Math.hypot(...delta));if(foot.stance&&previous[j].stance){plants++;maxSlip=Math.max(maxSlip,Math.hypot(delta[0],delta[1],delta[2]-roadSpeed/fps));}}
      }
      leftMin=Math.min(leftMin,feet[0].position[1]);leftMax=Math.max(leftMax,feet[0].position[1]);previous=feet;
     }
     results.push({fps,phase,plants,maxSlip,maxExtension,maxStep,lowestToe,highestToe,leftTravel:leftMax-leftMin,firstPhase,lastPhase,frequency:rex.gait.frequency,strideLength:rex.gait.strideLength,footSweep:maxSweep-minSweep,stanceFraction:rex.gait.stanceFraction,airborne,footsteps});
    }
   }
   // The first second must already contain a full alternating step, before the roar peaks.
   rex.reset();const opening=[];for(let i=0;i<60;i++){rex.update(1/60,{phase:'intro',phaseTime:i/60,distance:24,result:null},i/60,10);opening.push(rex.gait.legs.map(l=>l.toe.getWorldPosition(rex.actor.position.clone()).y));}
   const {openingPose}=await import('../src/chase/opening.js'),{RULES}=await import('../src/chase/combat.js'),entrance=[];
   for(const fps of [30,60,144]){
    rex.reset();let maxExtension=0,lowestToe=Infinity,maxKneeSpeed=0,previous=null;
    for(let i=0;i<RULES.intro*fps;i++){
     const t=i/fps,p=openingPose(t,RULES.intro);
     rex.update(1/fps,{phase:'intro',phaseTime:t,introDuration:RULES.intro,distance:18,result:null},t,p.speed,{jaw:0,roar:0});
     const joints=rex.gait.legs.map(l=>{maxExtension=Math.max(maxExtension,l.extensionError);lowestToe=Math.min(lowestToe,l.toe.getWorldPosition(rex.actor.position.clone()).y);return l.knee.getWorldQuaternion(rex.actor.quaternion.clone());});
     if(previous)joints.forEach((q,j)=>maxKneeSpeed=Math.max(maxKneeSpeed,q.angleTo(previous[j])*fps));previous=joints;rex.drainMotionEvents();
    }
    entrance.push({fps,maxExtension,lowestToe,maxKneeSpeed});
   }
   return{results,opening,entrance};
  });
  fs.writeFileSync('art/review/gait-verification.json',JSON.stringify({errors,...report},null,2));
  console.log(JSON.stringify(report.results.map(r=>({...r,footsteps:r.footsteps.length})),null,2));
  // A three-quarter side view exposes the knees, hocks, toe-off and contact timing.
  await page.evaluate(()=>{
   document.querySelectorAll('.screen,.masthead,#boss,#hud-bottom,#warning,#reticle,#hit-marker,#hit-label').forEach(e=>e.style.display='none');
   rexChase.jeep.root.visible=false;
   rexChase.scene.traverse(o=>{if(o.isInstancedMesh)o.visible=false;});
   rexChase.camera.position.set(13,3.8,13);
   rexChase.camera.lookAt(0,2.3,24);
   rexChase.camera.fov=46;rexChase.camera.updateProjectionMatrix();
   rexChase.rex.reset();
  });
  for(let n=0;n<6;n++){
   await page.evaluate(n=>{for(let i=0;i<11;i++)rexChase.rex.update(1/60,{phase:'intro',phaseTime:(n*11+i)/60,distance:24,result:null},(n*11+i)/60,10);},n);
   await page.screenshot({path:`art/review/gait-step-${n}.png`});
  }
  await page.evaluate(()=>rexChase.rex.reset());
  for(let n=0;n<6;n++){
   await page.evaluate(n=>{for(let i=0;i<24;i++)rexChase.rex.update(1/60,{phase:'pursuit',phaseTime:(n*24+i)/60,distance:24,result:null},(n*24+i)/60,2.2);},n);
   await page.screenshot({path:`art/review/gait-walk-${n}.png`});
  }
  assert.deepEqual(errors,[]);
  for(const r of report.results){assert.ok(r.plants>15,`${r.phase} must plant its feet`);assert.ok(r.maxSlip<.025,`${r.phase} ${r.fps}fps: foot sliding ${r.maxSlip}m/frame`);assert.ok(r.leftTravel>(r.phase==='walk'?.14:.30)&&r.leftTravel<.8,`${r.phase}: low, active foot recovery`);assert.ok(r.lowestToe>-.04,`${r.phase}: toe below road`);assert.ok(r.maxExtension<.08,`${r.phase}: overextended leg ${r.maxExtension}m`);assert.ok(r.footSweep>2.7,'Feet must sweep through a broad stride');if(r.phase==='walk'){assert.equal(r.airborne,0,'Walking always has ground support');assert.ok(r.frequency<.6&&r.strideLength>4,'Walk must not use the running cadence');}else if(r.phase==='pursuit'){assert.ok(r.frequency<1.1&&r.strideLength>9,'Pursuit must cover ground with longer strides');}for(let i=1;i<r.footsteps.length;i++)assert.notEqual(r.footsteps[i].side,r.footsteps[i-1].side);}
  const separation=report.opening.map(p=>p[0]-p[1]);assert.ok(Math.min(...separation)<-.3&&Math.max(...separation)>.3,'Opening roar must run from the first second');
  for(const e of report.entrance){assert.ok(e.maxExtension<.08,'Entrance must not lock a knee');assert.ok(e.lowestToe>-.04,'Entrance feet stay above the road');assert.ok(e.maxKneeSpeed<15,`${e.fps}fps entrance knee snap: ${e.maxKneeSpeed}`);}
  console.log('Running entrance, braking turn, stationary settle and getaway:',report.entrance);
  console.log('Opening and pursuit/charge/warning gait verified at 30/60/144fps; planted feet match road movement.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
