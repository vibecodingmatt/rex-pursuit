const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:5188/');
  await page.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});
  // Footfall dust is the dry-ground path; the storm replaces it with splashes.
  await page.evaluate(()=>rexChase.setConditions?.('clear',true));
  await page.locator('#start').click();await page.waitForFunction(()=>rexChase.mode==='playing');
  const report=await page.evaluate(()=>{
   rexChase.freeze=true;const {rex,effects}=rexChase;
   const runs=[];
   for(const phase of ['intro','pursuit','charge']){
    rex.reset();effects.reset();let previous=null,maxKneeSpeed=0,maxHipSpeed=0,footfalls=[];
    for(let i=0;i<720;i++){
     const t=i/240;rex.update(1/240,{phase,phaseTime:t,distance:phase==='charge'?36-t*5.3:22,result:null},t,10);
     const joints=rex.gait.legs.map(l=>({hip:l.hip.getWorldQuaternion(rex.actor.quaternion.clone()).normalize(),knee:l.knee.getWorldQuaternion(rex.actor.quaternion.clone()).normalize()}));
     if(previous&&t>.8)joints.forEach((j,k)=>{maxKneeSpeed=Math.max(maxKneeSpeed,j.knee.angleTo(previous[k].knee)*240);maxHipSpeed=Math.max(maxHipSpeed,j.hip.angleTo(previous[k].hip)*240);});
     previous=joints;
     for(const e of rex.drainMotionEvents()){footfalls.push({side:e.side,time:t,height:e.position.y});effects.footstep(e.position,e.speed);}
     effects.update(1/240,10);
    }
    runs.push({phase,maxKneeSpeed,maxHipSpeed,footfalls,activePuffs:effects.dust.filter(d=>d.life>0).length});
   }
   // Dust must stay on the moving road rather than following the live ankle.
   effects.reset();effects.footstep(rex.actor.position.clone().set(0,.035,12),10);
   const d=effects.dust.find(d=>d.life>0),z=d.sprite.position.z,vz=d.velocity.z;
   effects.update(.1,10);const dustDisplacement=d.sprite.position.z-z;
   const deaths=[];
   for(const fps of [30,60,144])for(const phase of ['pursuit','charge','ram']){
    rex.reset();for(let i=0;i<fps;i++)rex.update(1/fps,{phase,phaseTime:i/fps,distance:phase==='charge'?20-i/fps*5.3:18,result:null},i/fps,10);
    rex.drainMotionEvents();const frozenPhase=rex.gait.phase,events=[],samples=[];
    let previousPose=null,settledMovement=0,maxPhaseChange=0,nextSample=.5;
    const bending=['back_02_','neck_03_','tail_07_','arm_01_L_','leg_03_L_'].map(prefix=>({prefix,bone:rex.bones.find(b=>b.name.startsWith(prefix)),first:null,range:0}));
    for(let i=0;i<Math.ceil(fps*5.4);i++){
     const t=(i+1)/fps,coast=Math.max(0,Math.min(1,(t-.8)/1.2)),speed=10-5*coast*coast*(3-2*coast);
     rex.update(1/fps,{phase,phaseTime:1,distance:18,result:'won'},1+t,speed);
     maxPhaseChange=Math.max(maxPhaseChange,Math.abs(frozenPhase-rex.gait.phase));
     for(const e of rex.drainMotionEvents())events.push({type:e.type,part:e.part,strength:e.strength,time:t,position:e.position.toArray()});
     if(t>=nextSample){
      let minY=Infinity;const p=rex.actor.position.clone();
      for(const mesh of rex.meshes)if(mesh.isSkinnedMesh)for(let v=0;v<mesh.geometry.attributes.position.count;v++){mesh.getVertexPosition(v,p);p.applyMatrix4(mesh.matrixWorld);minY=Math.min(minY,p.y);}
      samples.push({time:t,minY,position:rex.actor.position.toArray()});nextSample+=.5;
     }
     if(t>1.75&&t<3.45)for(const b of bending){const q=b.bone.quaternion.clone().normalize();if(!b.first)b.first=q;b.range=Math.max(b.range,q.angleTo(b.first));}
     if(t>4.8){if(previousPose)rex.bones.forEach((b,k)=>settledMovement=Math.max(settledMovement,b.quaternion.clone().normalize().angleTo(previousPose[k])));previousPose=rex.bones.map(b=>b.quaternion.clone().normalize());}
    }
    deaths.push({fps,phase,maxPhaseChange,settledMovement,bending:bending.map(b=>({bone:b.prefix,range:b.range})),complete:rex.death.complete,forwardSpeed:rex.death.forwardSpeed,headMinY:rex.death.headMinY,events,samples});
   }
   effects.reset();rex.reset();return{runs,dustDisplacement,expectedDustDisplacement:(10+vz)*.1,deaths,reset:{death:rex.death.active,dust:effects.dust.filter(d=>d.life>0).length,footsteps:effects.stats.footsteps}};
  });
  fs.writeFileSync('art/review/motion-verification.json',JSON.stringify({errors,...report},null,2));
  console.log(JSON.stringify({runs:report.runs.map(r=>({...r,footfalls:r.footfalls.length})),deaths:report.deaths.map(d=>({fps:d.fps,phase:d.phase,maxPhaseChange:d.maxPhaseChange,settledMovement:d.settledMovement,lowestSkin:Math.min(...d.samples.map(s=>s.minY)),impacts:d.events.filter(e=>e.type==='body-impact').length})),errors},null,2));
  // Review the fall from the playable camera and an unobstructed side angle.
  await page.evaluate(()=>{rexChase.rex.reset();rexChase.effects.reset();for(let i=0;i<90;i++){rexChase.rex.update(1/60,{phase:'pursuit',phaseTime:i/60,distance:18,result:null},i/60,10);for(const e of rexChase.rex.drainMotionEvents())rexChase.effects.footstep(e.position,e.speed);rexChase.effects.update(1/60,10);}rexChase.camera.position.set(.06,2.4,-.45);rexChase.camera.lookAt(0,3.16,18);rexChase.camera.updateMatrixWorld();});
  await page.screenshot({path:'art/review/motion-footstep-front.png'});
  for(const view of ['game','side']){
   await page.evaluate(view=>{const r=rexChase;r.effects.reset();r.rex.reset();r.rex.update(1/60,{phase:'pursuit',phaseTime:1,distance:18,result:null},1,10);r.rex.drainMotionEvents();if(view==='side'){document.querySelectorAll('.screen,.masthead,#boss,#hud-bottom,#warning,#reticle,#hit-marker,#hit-label').forEach(e=>e.style.display='none');r.jeep.root.visible=false;r.scene.traverse(o=>{if(o.isInstancedMesh)o.visible=false;});}},view);
   let previous=0;
   for(const seconds of [.25,.6,1,1.5,2,2.8,3.6,5.3]){
    await page.evaluate(({seconds,previous,view})=>{const r=rexChase;for(let t=previous;t<seconds-.001;t+=1/60){const u=Math.max(0,Math.min(1,(t-.8)/1.2)),speed=10-5*u*u*(3-2*u);r.rex.update(1/60,{phase:'pursuit',phaseTime:1,distance:18,result:'won'},1+t,speed);for(const e of r.rex.drainMotionEvents()){if(e.type==='body-impact')r.effects.bodyImpact(e.position,e.strength);if(e.type==='body-slide')r.effects.bodySlide(e.position,e.strength);}r.effects.update(1/60,speed);}if(view==='side'){const p=r.rex.actor.localToWorld(r.rex.actor.position.clone().set(0,2.5,1.4));r.camera.position.set(p.x+12,4.4,p.z-11);r.camera.lookAt(p.x,1.7,p.z);r.camera.fov=48;r.camera.updateProjectionMatrix();}r.renderer.render(r.scene,r.camera);},{seconds,previous,view});
    await page.screenshot({path:`art/review/death-${view}-${seconds}.png`});previous=seconds;
   }
  }
  assert.deepEqual(errors,[]);
  for(const r of report.runs){assert.ok(r.maxKneeSpeed<(r.phase==='charge'?13:10),`${r.phase}: knee speed ${r.maxKneeSpeed}`);assert.ok(r.maxHipSpeed<(r.phase==='charge'?11:8),`${r.phase}: hip snaps`);assert.ok(r.footfalls.length>=(r.phase==='charge'?7:5)&&r.footfalls.length<=(r.phase==='charge'?9:6),'Footstep count must follow the slower stride cadence');for(let i=1;i<r.footfalls.length;i++)assert.notEqual(r.footfalls[i].side,r.footfalls[i-1].side,'Dust follows alternating foot contacts');assert.ok(r.footfalls.every(f=>f.height<.1));assert.ok(r.activePuffs>0&&r.activePuffs<=96);}
  assert.ok(Math.abs(report.dustDisplacement-report.expectedDustDisplacement)<1e-6,'Dust must advect with road');
  for(const d of report.deaths){assert.equal(d.maxPhaseChange,0,'Running cycle stops immediately at death');assert.ok(d.settledMovement<1e-6,'Limbs must settle');assert.equal(d.forwardSpeed,0);assert.equal(d.complete,true);assert.equal(d.events.filter(e=>e.type==='footstep').length,0);const impacts=d.events.filter(e=>e.type==='body-impact');assert.ok(impacts.length>=3&&impacts.length<=4,`${d.phase} ${d.fps}fps: ${impacts.length} impacts`);assert.ok(['chin','chest','hips'].every(p=>impacts.some(e=>e.part===p)),'Chin, chest and hips each land once');const chin=impacts.find(e=>e.part==='chin'),hips=impacts.find(e=>e.part==='hips');assert.ok(chin.time<=hips.time+.05,'She goes down face first');assert.ok(d.samples.every(s=>s.minY>-.08),`${d.phase} ${d.fps}fps: body sinks below road`);assert.ok(d.headMinY<.2,'Head must settle beside the body');for(const b of d.bending)assert.ok(b.range>.025,`${b.bone}: independent movement through impact and slide`);}
  assert.deepEqual(report.reset,{death:false,dust:0,footsteps:0});
  console.log('Knee recovery, synchronized footsteps, road-relative dust, and grounded death fall verified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
