const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const p=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],frames=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,{timeout:120000});
 await p.evaluate(()=>{const r=rexChase;r.freeze=true;r.jeep.root.visible=false;r.rex.update(0,{phase:'pursuit',phaseTime:0,distance:10,health:5600},0,0,{jaw:0,roar:0});});
 await p.addStyleTag({content:'body>*:not(canvas){display:none!important}'});
 for(const [name,x,y]of [['front',0,4.5],['left',-2,4.5],['right',2,4.5],['player',0,2.4]]){
  const frame=await p.evaluate(({name,x,y})=>{const r=rexChase;r.camera.position.set(x,y,.5);r.camera.lookAt(-.19,4.4,4.4);r.camera.fov=30;r.camera.updateProjectionMatrix();r.rex.gaze.update(1,r.camera.position);r.renderer.render(r.scene,r.camera);return{name,directions:r.rex.gaze.directions.map(v=>v.toArray())};},{name,x,y});frames.push(frame);
  await p.screenshot({path:`art/review/gaze-${name}.png`});
 }
 assert.ok(frames[1].directions[0][0]>frames[2].directions[0][0]+.35,'Both pupils turn toward the moving viewer');
 assert.ok(frames[3].directions.every(v=>v[1]<-.1),'Pupils look down toward the gunner');
 const [left,right]=frames[0].directions;assert.ok(Math.atan2(left[0],left[2])+.5>Math.atan2(right[0],right[2])-.5,'The eyes converge on one target after accounting for socket orientation');
 for(const f of frames)for(const d of f.directions){assert.ok(Math.abs(Math.hypot(...d)-1)<1e-6);assert.ok(d[2]>.5,'No extreme eye rolling');}
 const smooth=await p.evaluate(()=>{const r=rexChase;r.rex.gaze.reset();const before=r.rex.gaze.directions[0].clone();r.rex.gaze.update(1/60,r.camera.position);const short=r.rex.gaze.directions[0].clone();r.rex.gaze.update(1,r.camera.position);const full=r.rex.gaze.directions[0].clone();r.rex.reset();return{step:before.angleTo(short),total:before.angleTo(full),reset:r.rex.gaze.directions.map(d=>d.toArray())};});assert.ok(smooth.step>0&&smooth.step<smooth.total*.3);assert.deepEqual(smooth.reset,[[0,0,1],[0,0,1]]);assert.deepEqual(errors,[]);
 fs.writeFileSync('art/review/gaze-verification.json',JSON.stringify({errors,frames,smooth},null,2));console.log('Gaze passed: converging pupils, viewer movement, downward player focus, smooth response, bounded rotation and reset.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
