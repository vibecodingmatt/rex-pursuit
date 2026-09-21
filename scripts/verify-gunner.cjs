const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],report={base};
 function monitor(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});}
 async function start(p){monitor(p);await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,null,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');await p.evaluate(()=>{const r=rexChase;r.state.transition('pursuit');r.state.distance=18;r.state.nextDebris=Infinity;r.setView('third');});await p.waitForTimeout(650);}
 try{
  fs.mkdirSync('art/review',{recursive:true});const p=await browser.newPage({viewport:{width:1440,height:900}});await start(p);await p.evaluate(()=>rexChase.freeze=true);
  await p.screenshot({path:'art/review/gunner-third.png'});
  report.clearance=await p.evaluate(()=>{
   const r=rexChase,j=r.jeep,c=j.character,s=r.state,headMeshes=[];c.head.traverse(m=>{if(m.isMesh)headMeshes.push(m);});
   const bars=[{a:[-.78,2.44,.70],b:[.78,2.44,.70],radius:.065},{a:[-.78,2.43,-.60],b:[.78,2.43,-.60],radius:.055}];
   for(const side of [-1,1])bars.push({a:[side*.78,2.44,.70],b:[side*.78,2.43,-.60],radius:.061});
   const V=r.camera.position.constructor,v=new V(),a=new V(),b=new V(),ab=new V(),q=new V();let minGap=Infinity,maxShoulderShift=0,maxIdleShift=0,samples=0,worst=null,current=null;
   const measure=()=>{j.body.updateWorldMatrix(true,true);const inverse=j.body.matrixWorld.clone().invert();for(const m of headMeshes){const matrix=inverse.clone().multiply(m.matrixWorld),positions=m.geometry.attributes.position;for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);for(const bar of bars){a.fromArray(bar.a);b.fromArray(bar.b);ab.subVectors(b,a);const t=Math.max(0,Math.min(1,q.subVectors(v,a).dot(ab)/ab.lengthSq()));q.copy(a).addScaledVector(ab,t);minGap=Math.min(minGap,v.distanceTo(q)-bar.radius);}}}for(const arm of j.weapon.armRig.arms){const anchor=c.shoulder(arm.s),solved=j.weapon.armRig.root.localToWorld(arm.shoulder.clone()),gap=anchor.distanceTo(solved);if(gap>maxShoulderShift){maxShoulderShift=gap;worst={...current,side:arm.s,anchor:anchor.toArray(),solved:solved.toArray(),wrist:j.weapon.armRig.root.localToWorld(arm.wrist.clone()).toArray()};}if(!s.reload)maxIdleShift=Math.max(maxIdleShift,gap);}samples++;};
   for(const fps of [30,60,144])for(const yaw of [-.68,0,.68])for(const pitch of [-.42,0,.32])for(const reload of [0,.04,.08,.17,.28,.40,.61,.69,.8,.92,.98]){
    current={fps,yaw,pitch,reload};s.reload=reload?2.6*(1-reload):0;const aim=new V(Math.sin(yaw)*20,1.93-Math.tan(pitch)*20,1.43+Math.cos(yaw)*20);
    for(let i=0;i<24;i++)j.update(1/fps,1+i/fps,10,aim,true,s);measure();
   }
   s.reload=0;j.reset();j.update(1/60,0,0,new V(0,3.2,18),false,s);const hiddenFirst=!j.gunner.visible;j.update(1/60,0,0,new V(0,3.2,18),true,s);measure();
   return{minGap,maxShoulderShift,maxIdleShift,worst,samples,hiddenFirst,visibleThird:j.gunner.visible,headMeshes:headMeshes.length};
  });
  console.log(JSON.stringify(report.clearance));assert.ok(report.clearance.minGap>.04,`Head/hat must clear the cage: ${JSON.stringify(report.clearance)}`);assert.ok(report.clearance.maxShoulderShift<.28,'Shoulder reach must stay within the shirt silhouette');assert.ok(report.clearance.hiddenFirst&&report.clearance.visibleThird);
  if(process.env.CLEARANCE_ONLY)return;
  const hidden=await p.addStyleTag({content:'body>:not(canvas){visibility:hidden!important}'});
  for(const [name,pos,target] of [['face',[1.15,2.45,2.60],[0,1.97,.38]],['side',[-2.5,2.5,.75],[0,1.85,.5]],['head',[.64,2.33,1.28],[0,2.22,.28]]]){await p.evaluate(({pos,target})=>{const c=rexChase.camera;c.position.set(...pos);c.lookAt(...target);c.fov=36;c.updateProjectionMatrix();c.updateMatrixWorld();},{pos,target});await p.waitForTimeout(100);await p.screenshot({path:`art/review/gunner-${name}.png`});}
  for(const progress of [.17,.4,.8]){await p.evaluate(progress=>{const r=rexChase;r.state.reload=2.6*(1-progress);const aim=r.camera.position.clone().set(0,3.2,18);for(let i=0;i<40;i++)r.jeep.update(1/60,2,10,aim,true,r.state);r.camera.position.set(1.5,2.6,2.7);r.camera.lookAt(0,1.8,.7);r.camera.fov=38;r.camera.updateProjectionMatrix();r.camera.updateMatrixWorld();},progress);await p.waitForTimeout(100);await p.screenshot({path:`art/review/gunner-reload-${Math.round(progress*100)}.png`});}
  await p.evaluate(()=>{rexChase.state.reload=0;rexChase.jeep.reset();});
  await hidden.evaluate(el=>el.remove());await p.evaluate(()=>rexChase.freeze=false);await p.waitForTimeout(350);await p.evaluate(()=>rexChase.state.damage(5600));
  await p.waitForFunction(()=>rexChase.state.victory?.time>=9.5,null,{timeout:60000});await p.evaluate(()=>rexChase.freeze=true);await p.screenshot({path:'art/review/gunner-arrival.png'});assert.ok(await p.evaluate(()=>rexChase.jeep.gunner.visible));await p.evaluate(()=>rexChase.freeze=false);await p.waitForFunction(()=>rexChase.mode==='ended',null,{timeout:60000});await p.locator('#restart').click();await p.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await p.evaluate(()=>rexChase.jeep.gunner.visible),false);await p.close();
  for(const [width,height] of [[390,844],[844,390]]){const phone=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});await start(phone);await phone.screenshot({path:`art/review/gunner-mobile-${width}.png`});await phone.evaluate(()=>rexChase.state.damage(5600));await phone.waitForFunction(()=>rexChase.state.victory?.time>=9.5,null,{timeout:60000});await phone.evaluate(()=>rexChase.freeze=true);await phone.screenshot({path:`art/review/gunner-arrival-${width}.png`});assert.ok(await phone.evaluate(()=>rexChase.jeep.gunner.visible));await phone.close();}
  assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync('art/review/gunner-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
