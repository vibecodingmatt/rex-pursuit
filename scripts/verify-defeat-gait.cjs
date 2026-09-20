const {chromium}=require('playwright-core'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:800}});await page.goto('http://127.0.0.1:5188/');await page.waitForFunction(()=>window.rexChase?.rex,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  rexChase.freeze=true;const {rex}=rexChase,{defeatPose}=await import('./src/chase/defeat.js');rex.reset();
  const reports=[];
  for(const fps of [30,60,144]){
  rex.reset();
  for(let i=0;i<60;i++)rex.update(1/60,{phase:'pursuit',distance:19,result:null},i/60,10,{jaw:0,roar:0});
  const d={time:0,x:rex.actor.position.x,z:rex.actor.position.z,heading:rex.actor.rotation.y,speed:10},rows=[];window.motionReview={d,t:0};
  for(let i=0;i<8.9*fps;i++){d.time=i/fps;const pose=defeatPose(d.time,d);rex.update(1/fps,{phase:'bite',distance:19,result:'lost',defeat:d},1+d.time,pose.speed,{jaw:0,roar:0});
   const legs=rex.gait.legs.map(l=>({side:l.side,stance:l.stance,extension:l.extensionError,home:l.contactX,toe:rex.actor.worldToLocal(l.toe.getWorldPosition(rex.actor.position.clone())).toArray(),knee:rex.actor.worldToLocal(l.knee.getWorldPosition(rex.actor.position.clone())).toArray()}));
   if(d.time>=5)rows.push({t:d.time,root:[pose.x,pose.z],heading:pose.heading,speed:rex.gait.speed,legs});
  }
  reports.push({fps,minToeSeparation:Math.min(...rows.map(r=>r.legs[0].toe[0]-r.legs[1].toe[0])),minKneeSeparation:Math.min(...rows.map(r=>r.legs[0].knee[0]-r.legs[1].knee[0])),maxExtension:Math.max(...rows.flatMap(r=>r.legs.map(l=>l.extension)))});
  }return reports;
 });fs.writeFileSync('art/review/defeat-walk-verification.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 for(const r of report){assert.ok(r.minToeSeparation>.65,'Walking feet remain separated');assert.ok(r.minKneeSeparation>.65,'Knees do not cross through the body');assert.ok(r.maxExtension<.15,'Walking plants stay within the usable leg reach');}
 await page.evaluate(()=>{const r=rexChase;r.rex.reset();r.jeep.root.visible=false;document.querySelectorAll('body>*:not(canvas):not(script)').forEach(e=>e.style.display='none');r.camera.fov=48;r.camera.position.set(-1.45,3.1,-.4);r.camera.lookAt(-1,2.4,11);r.camera.updateProjectionMatrix();});
 for(const t of [5.5,6,6.5,7,7.5,8,8.6]){await page.evaluate(async t=>{const r=rexChase,{defeatPose}=await import('./src/chase/defeat.js'),m=window.motionReview;while(m.t<t){m.t+=1/60;m.d.time=m.t;const pose=defeatPose(m.t,m.d);r.rex.update(1/60,{phase:'bite',result:'lost',distance:19,defeat:m.d},m.t+1,pose.speed,{jaw:0,roar:0});}},t);await page.screenshot({path:`art/review/walk-refined-${t}.png`});}
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
