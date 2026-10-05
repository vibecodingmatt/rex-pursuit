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
report.push({mobile,load,tasks:await p.evaluate(()=>tasks)});
// Recorded previews: the loop covers the scene and the scene stops drawing; a live mode brings rendering back.
for(const game of ['arcade','ravine']){await p.locator('[data-game-mode='+game+']').click();await p.waitForFunction(()=>rexChase.hub.covered,null,{timeout:5000});
 const v=await p.evaluate(()=>({on:document.getElementById('hub-preview').classList.contains('on'),src:document.querySelector('#hub-preview video').src,frame:rexChase.renderer.info.render.frame}));
 assert.equal(v.on,true);assert.ok(v.src.endsWith(`previews/${game}-${mobile?'tall':'wide'}.mp4`),v.src);await p.waitForTimeout(400);
 assert.equal(await p.evaluate(()=>rexChase.renderer.info.render.frame),v.frame,`the 3D scene idles behind the ${game} loop`);
 assert.equal(await p.locator('#start').isDisabled(),false);}
await p.locator('[data-game-mode=pursuit]').click();await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>rexChase.hub.covered),false);
{const f0=await p.evaluate(()=>rexChase.renderer.info.render.frame);await p.waitForTimeout(300);assert.ok(await p.evaluate(()=>rexChase.renderer.info.render.frame)>f0,'a live mode renders again');}
// Launching Lost Circuit from the hub plays at once with the hub's route and intensity, and Back returns to the hub.
if(!mobile){await p.locator('[data-game-mode=arcade]').click();await p.locator('[data-arcade="route:classic"]').click();await p.locator('[data-arcade="difficulty:expert"]').click();await p.locator('#start').click();
 await p.waitForFunction(()=>window.lostCircuit?.mode==='playing',null,{timeout:180000});const u=new URL(p.url());assert.equal(u.pathname.endsWith('/arcade.html'),true);assert.equal(u.search,'','the hub launch parameters are consumed');
 assert.deepEqual(await p.evaluate(()=>({stops:document.getElementById('route-dots').children.length,difficulty:document.getElementById('difficulty').value})),{stops:4,difficulty:'expert'},'the ride uses the hub options');
 await p.goBack();await p.waitForFunction(()=>window.rexChase?.mode==='menu',null,{timeout:120000});await p.locator('[data-arcade="route:extended"]').click();await p.locator('[data-arcade="difficulty:arcade"]').click();}
await p.locator('[data-game-mode=containment]').click();await p.waitForFunction(()=>!document.getElementById('start').disabled);
await p.locator('#start')[mobile?'tap':'click']();
await p.waitForFunction(()=>window.breach?.mode==='playing',null,{timeout:120000});
assert.equal(new URL(p.url()).pathname.endsWith('/breach.html'),true);assert.equal(new URL(p.url()).searchParams.has('start'),false);
assert.equal(await p.locator('#start-screen').isVisible(),false,'one homepage CTA starts combat');
assert.equal(await p.locator('#scene').evaluate(e=>getComputedStyle(e).cursor),'none');
await p.locator('#pause').click();assert.notEqual(await p.locator('#scene').evaluate(e=>getComputedStyle(e).cursor),'none');
assert.equal(await p.locator('#resume').evaluate(e=>getComputedStyle(e).cursor),'pointer');
await p.locator('#resume').click();assert.equal(await p.locator('#scene').evaluate(e=>getComputedStyle(e).cursor),'none');
await p.locator('#pause').click();await p.locator('.mode-return').click();
await p.waitForFunction(()=>window.rexChase?.breachPreview?.ready,null,{timeout:120000});assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),'containment');
for(const game of ['pursuit','safari']){
 await p.locator('[data-game-mode='+game+']').click();await p.locator('#start').click();await p.waitForFunction(()=>rexChase.mode==='playing');
 assert.equal(await p.evaluate(()=>!!rexChase.state.safari),game==='safari');assert.equal(await p.locator('#scene').evaluate(e=>getComputedStyle(e).cursor),'none');
 await p.locator('#pause').click();assert.notEqual(await p.locator('#scene').evaluate(e=>getComputedStyle(e).cursor),'none');
 await p.locator('#pause-screen [data-menu]').click();assert.notEqual(await p.locator('#scene').evaluate(e=>getComputedStyle(e).cursor),'none');
}
// The hub is the only homepage: a direct visit (or a refresh after the start intent is consumed) lands on it with that mode selected.
for(const [page,game] of [['breach.html','containment'],['ravine.html','ravine'],['arcade.html','arcade']]){await p.goto(new URL(page,base).href);await p.waitForFunction(()=>window.rexChase?.mode==='menu',null,{timeout:120000});assert.equal(await p.evaluate(()=>rexChase.safariUI.selected),game,`a direct ${page} visit opens the hub on ${game}`);}
await p.goto(new URL('breach.html?menu=1',base).href);await p.waitForFunction(()=>window.breach?.ready,null,{timeout:120000});assert.equal(await p.evaluate(()=>breach.mode),'menu','?menu=1 keeps the briefing');
await p.close();}
assert.deepEqual(errors,[]);fs.writeFileSync('art/review/mode-menu/report.json',JSON.stringify(report,null,2));console.log('Mode menu passed: five-mode hub, in-place live selections, canceled loading, cached renderer/compound, restored weather, video previews idle the scene, Lost Circuit launch with hub options and Back, direct visits open the hub, desktop/phone.');console.log(JSON.stringify(report));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
