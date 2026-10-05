// Lost Circuit advances on every displayed frame at 60-165 Hz. A fixed 1/60 s step used to leave most frames of a
// high-refresh laptop without a new state (167 of 287 at 144 Hz), which juddered unevenly (2026-10-05).
// A virtual clock (scripts/previews/vclock.js) supplies exact frame times.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[],res={};
 try{for(const hz of [60,120,144,165]){const p=await b.newPage({viewport:{width:640,height:360}});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript({path:path.join(__dirname,'previews','vclock.js')});
  await p.goto(new URL('arcade.html?test=1&quality=low',base).href);await p.waitForFunction(()=>window.lostCircuit?.ready,null,{timeout:180000});
  await p.evaluate(()=>document.getElementById('start').click());await p.evaluate(()=>__vclock.start());await p.waitForTimeout(200);
  res[hz]=await p.evaluate(hz=>{const d=[];let z=null;for(let i=0;i<hz*4;i++){__vclock.tick(1000/hz);const nz=lostCircuit.getGame().travel;if(z!==null&&i>hz*2)d.push(nz-z);z=nz;}
   const mean=d.reduce((a,b)=>a+b,0)/d.length,sd=Math.sqrt(d.reduce((a,b)=>a+(b-mean)**2,0)/d.length);return{mean,cv:sd/mean,stalled:d.filter(x=>Math.abs(x)<1e-6).length};},hz);
  await p.close();
  assert.equal(res[hz].stalled,0,`${hz} Hz: every frame advances`);assert.ok(res[hz].cv<.1,`${hz} Hz: even motion (cv ${res[hz].cv.toFixed(2)})`);}
  // The same speed whatever the rate.
  for(const hz of [120,144,165])assert.ok(Math.abs(res[hz].mean*hz-res[60].mean*60)/(res[60].mean*60)<.03,`${hz} Hz keeps the 60 Hz pace`);
  assert.deepEqual(errors,[]);console.log('Arcade pacing passed: every frame advances evenly at 60/120/144/165 Hz at the same speed.',JSON.stringify(Object.fromEntries(Object.entries(res).map(([k,v])=>[k,{cv:+v.cv.toFixed(3),stalled:v.stalled}]))));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
