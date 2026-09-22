const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
const snapshot=()=>{
 const r=rexChase,canvas=document.querySelector('#scene'),style=getComputedStyle(canvas),rect=canvas.getBoundingClientRect();
 return{time:r.state.defeat?.time,filter:style.filter,blur:parseFloat(style.filter.slice(5))||0,transform:style.transform,view:r.view,audio:r.audio.context.state,
  covers:rect.left<=0&&rect.top<=0&&rect.right>=innerWidth&&rect.bottom>=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
};
async function lose(page){
 await page.evaluate(async()=>{await rexChase.start();const r=rexChase;r.setView('third');r.state.transition('pursuit');r.state.distance=19;r.state.nextDebris=Infinity;});
 await page.waitForTimeout(650);
 await page.evaluate(()=>{const s=rexChase.state;s.jeep=1;s.phase='bite';s.phaseTime=.77;});
}
async function freezeAt(page,t){
 await page.waitForFunction(t=>rexChase.state.defeat?.time>=t,t);await page.evaluate(()=>rexChase.freeze=true);return page.evaluate(snapshot);
}
(async()=>{
 fs.mkdirSync('art/review',{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[],report=[];
 try{
  for(const [width,height,reduced]of [[1600,1000,false],[390,844,false],[844,390,false],[390,844,true]]){
   const tag=`${width}${reduced?'-reduced':''}`,p=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,reducedMotion:reduced?'reduce':'no-preference'});
   p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await p.goto(base);await p.waitForFunction(()=>window.rexChase?.rex,null,{timeout:120000});await p.locator('#start').click();await lose(p);
   const frames=[];
   for(const t of [1.5,1.78,2.1,3.2,5.1,6.8,8.85,9.14,9.5,10.3]){
    const frame={at:t,...await freezeAt(p,t)};frames.push(frame);assert.equal(frame.view,'first');assert.ok(frame.covers,'Blur overscan covers the entire viewport');assert.equal(frame.overflow,false);
    if(t===1.5||t>=9.14){assert.equal(frame.filter,'none','Pre-impact view, lunge and interior stay clear');assert.equal(frame.transform,'none');}
    else assert.ok(frame.blur>0,'Blur begins at impact and carries through the spin and approach');
    if([1.5,1.78,2.1,3.2,5.1,6.8,8.85,9.14].includes(t))await p.screenshot({path:`art/review/vision-${tag}-${t}.png`});
    if(t===3.2||t===6.8){
     // Real pause, not just the diagnostic freeze: no CSS transition may
     // keep clearing vision while the game and AudioContext are suspended.
     await p.keyboard.press('p');await p.evaluate(()=>rexChase.freeze=false);
     const paused=await p.evaluate(snapshot);assert.equal(paused.audio,'suspended');
     await p.waitForTimeout(350);assert.deepEqual(await p.evaluate(snapshot),paused);
     assert.equal(await p.locator('#resume').evaluate(el=>getComputedStyle(el).filter),'none','Pause controls stay readable');
     await p.locator('#resume').click();
    }else await p.evaluate(()=>rexChase.freeze=false);
   }
   const blurAt=t=>frames.find(f=>f.at===t).blur;
   assert.ok(blurAt(1.78)>0&&blurAt(1.78)<blurAt(2.1),'Impact ramps quickly into the full blur');
   const peakLimit=(width===1600?12:6)*(reduced?.65:1);
   assert.ok(blurAt(2.1)>peakLimit*.9&&blurAt(2.1)<=peakLimit,'Initial shock is twice the previous blur strength');
   assert.ok(blurAt(2.1)>blurAt(3.2)&&blurAt(3.2)>blurAt(5.1)&&blurAt(5.1)>blurAt(6.8)&&blurAt(6.8)>blurAt(8.85),'Focus steadily returns through both the spin and approach');
   await p.waitForFunction(()=>rexChase.mode==='ended');assert.equal((await p.evaluate(snapshot)).filter,'none');
   await p.locator('#restart').click();assert.equal((await p.evaluate(snapshot)).filter,'none');
   if(width===1600){
    // Restart while the blur is actually present, then trigger a victory.
    await lose(p);await freezeAt(p,6.8);await p.evaluate(async()=>{await rexChase.start();rexChase.freeze=false;});
    const restarted=await p.evaluate(snapshot);assert.equal(restarted.filter,'none');assert.equal(restarted.transform,'none');
    await p.evaluate(()=>{const s=rexChase.state;s.transition('pursuit');s.health=1;s.hit(false,true);});
    await p.waitForFunction(()=>rexChase.state.result==='won');await p.waitForTimeout(300);
    assert.equal((await p.evaluate(snapshot)).filter,'none','Victory is never blurred');
   }
   report.push({width,height,reduced,frames});await p.close();console.log(`Vision verified: ${tag}x${height}`);
  }
  assert.ok(report[3].frames.find(f=>f.at===5.1).blur<report[1].frames.find(f=>f.at===5.1).blur,'Reduced motion uses a milder effect');
  assert.deepEqual(errors,[]);fs.writeFileSync('art/review/vision-verification.json',JSON.stringify({errors,report},null,2));
  console.log('Defeat vision passed: recovery, clear lunge/interior/results, real pause, restart, victory isolation, desktop and both phone orientations.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
