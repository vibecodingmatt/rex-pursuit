const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
async function verifyPatrol(p){
 const before=await p.evaluate(()=>rexChase.breachPreview.patrol.actors.map(c=>c.p.toArray()));
 await p.waitForTimeout(450);
 assert.ok(await p.evaluate(before=>rexChase.breachPreview.patrol.actors.every((c,i)=>c.p.distanceTo({x:before[i][0],y:before[i][1],z:before[i][2]})>.15),before),'menu animals move in real time');
 const result=await p.evaluate(()=>{
  const {patrol,world}=rexChase.breachPreview;rexChase.freeze=true;
  const faults=[];let maxStep=0,maxTurn=0;
  for(const hz of [30,120]){
   patrol.reset();const scales=patrol.actors.map(c=>c.scale),old=patrol.actors.map(c=>({p:c.p.clone(),yaw:c.yaw}));
   for(let i=0;i<hz*44;i++){
    for(const [j,c]of patrol.actors.entries()){old[j].p.copy(c.p);old[j].yaw=c.yaw;}
    patrol.update(1/hz);
    for(const [j,c]of patrol.actors.entries()){
     maxStep=Math.max(maxStep,c.p.distanceTo(old[j].p)*hz);
     maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(c.yaw-old[j].yaw),Math.cos(c.yaw-old[j].yaw)))*hz);
     const obstacle=world.obstacles.contact(c);
     if(obstacle)faults.push(obstacle.name);
     if(c.fade!==1||c.scale!==scales[j]||!Number.isFinite(c.phase)||c.stride<=0)faults.push('invalid pose/scale');
    }
   }
  }
  const species=patrol.actors.map(c=>c.species);patrol.reset();rexChase.freeze=false;
  return {species,faults:[...new Set(faults)],maxStep,maxTurn};
 });
 assert.deepEqual(result.species,['raptor','raptor','pachycephalosaurus','raptor']);assert.deepEqual(result.faults,[],'patrol clears compound props throughout repeated laps');
 assert.ok(result.maxStep<2.8&&result.maxTurn<1.3,'continuous position and heading at the loop seam');
}
(async()=>{fs.mkdirSync('art/review/mode-menu',{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[],report=[];
try{for(const mobile of [false,true]){const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.addInitScript(low=>{localStorage.setItem('rex-pursuit-quality',low?'low':'high');localStorage.setItem('rex-pursuit-mode','safari');window.tasks=[];new PerformanceObserver(l=>tasks.push(...l.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});},mobile);
const started=Date.now();await p.goto(base);await p.waitForFunction(()=>window.rexChase?.mode==='menu',null,{timeout:120000});await p.locator('#boot').waitFor({state:'hidden'});await p.waitForTimeout(1200);const load=Date.now()-started;assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),'pursuit');await p.evaluate(()=>{window.originalRenderer=rexChase.renderer;window.menuDocument=document;window.savedConditions=rexChase.weather.kind;});
// Switching away while the lazy import is in flight must never take over later.
await p.route('**/breach-preview.js',async route=>{await new Promise(r=>setTimeout(r,350));await route.continue();});await p.locator('[data-game-mode=containment]').click();await p.locator('[data-game-mode=safari]').click();await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),'safari');await p.unroute('**/breach-preview.js');
for(const [i,mode]of ['containment','pursuit','safari','containment','safari','containment','pursuit'].entries()){const start=Date.now();await p.locator('[data-game-mode='+mode+']').click();await p.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:120000});assert.equal(await p.evaluate(()=>document===menuDocument&&rexChase.renderer===originalRenderer),true);assert.equal(await p.locator('[data-game-mode='+mode+']').getAttribute('aria-pressed'),'true');assert.equal(new URL(p.url()).pathname,new URL(base).pathname);assert.equal(await p.evaluate(()=>document.querySelectorAll('canvas#scene').length),1);
if(mode==='containment'){assert.equal(await p.evaluate(()=>rexChase.breachPreview.active&&rexChase.breachPreview.ready&&!rexChase.jungle.chunks[0].group.parent.visible),true);await p.evaluate(()=>{if(window.cachedCompound&&cachedCompound!==rexChase.breachPreview.world)throw Error('Preview rebuilt');window.cachedCompound=rexChase.breachPreview.world;});}else{assert.equal(await p.evaluate(()=>rexChase.weather.kind===savedConditions),true);assert.equal(await p.evaluate(()=>!!rexChase.breachPreview?.active),false);}
const switchMs=Date.now()-start;if(i===0)await verifyPatrol(p);const frame=await p.evaluate(async()=>{const values=[];let last=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();values.push(now-last);last=now;}values.sort((a,b)=>a-b);return{p50:values[45],p95:values[85],max:values[89],calls:rexChase.renderer.info.render.calls,triangles:rexChase.renderer.info.render.triangles,programs:rexChase.renderer.info.programs.length};});report.push({mobile,mode,switchMs,...frame});if(i<3){await p.waitForTimeout(1500);await p.screenshot({path:`art/review/mode-menu/${mobile?'phone':'desktop'}-${mode}.png`});}}
report.push({mobile,load,tasks:await p.evaluate(()=>tasks)});await p.locator('[data-game-mode=containment]').click();await p.waitForFunction(()=>!document.getElementById('start').disabled);await p.locator('#start').click();await p.waitForURL('**/breach.html');await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});await p.locator('#start').click();await p.waitForFunction(()=>breach.mode==='playing');await p.locator('#pause').click();await p.locator('.mode-return').click();await p.waitForFunction(()=>window.rexChase?.breachPreview?.ready,null,{timeout:120000});assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),'containment');await p.locator('[data-game-mode=pursuit]').click();await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');assert.equal(await p.evaluate(()=>rexChase.state.safari),null);await p.close();}
assert.deepEqual(errors,[]);fs.writeFileSync('art/review/mode-menu/report.json',JSON.stringify(report,null,2));console.log('Mode menu passed: three in-place selections, canceled loading, cached renderer/compound, restored weather, desktop/phone, Breach start and return to Pursuit.');console.log(JSON.stringify(report));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
