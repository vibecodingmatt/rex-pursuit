const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(new URL('ravine.html',base).href);await p.waitForFunction(()=>window.ravine?.ready,null,{timeout:120000});
  const inspect=()=>{const r=ravine,a=r.pack.pool.find(a=>a.id===900);r.freeze=true;return{phase:a.phase,root:a.root.position.toArray(),feet:a.legs.map(l=>l[2].getWorldPosition(a.head.clone()).toArray()),unbound:a.meshes.some(m=>m.skeleton?.bones.some(b=>b.name==='neutral_bone')),travel:r.world.travel};};
  const first=await p.evaluate(inspect);assert.equal(first.unbound,false,'no unbound mouth vertices');
  for(const seconds of [2,8,14]){await p.evaluate(seconds=>{for(let i=0;i<seconds*30;i++)ravine.step(1/30);},seconds);const next=await p.evaluate(inspect);assert.equal(next.phase,first.phase,'idle never advances a walking cycle');assert.deepEqual(next.root,first.root);assert.equal(next.travel,0);next.feet.forEach((foot,i)=>foot.forEach((v,j)=>assert.ok(Math.abs(v-first.feet[i][j])<.012,'idle feet remain planted')));await p.screenshot({path:`art/review/ravine/idle-${seconds}.png`});}
  for(const [width,height,name] of [[390,844,'portrait'],[320,568,'compact'],[844,390,'landscape']]){await p.setViewportSize({width,height});await p.evaluate(()=>{for(let i=0;i<60;i++)ravine.step(1/30);});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const head=await p.evaluate(()=>ravine.pack.get(900).head.clone().project(ravine.camera).toArray());assert.ok(Math.abs(head[0])<.7&&Math.abs(head[1])<.8,'menu head remains framed');await p.screenshot({path:`art/review/ravine/menu-${name}-revised.png`});}
  await p.setViewportSize({width:1440,height:900});await p.locator('#start').click();await p.waitForFunction(()=>ravine.mode==='playing');await p.evaluate(()=>{for(let i=0;i<650;i++)ravine.step(1/60);});
  for(const seconds of [0,35,70,89]){await p.evaluate(seconds=>{ravine.world.reset();ravine.world.update(seconds,{time:seconds,escapeTime:Math.max(0,seconds-86)},8.5);},seconds);await p.screenshot({path:`art/review/ravine/canyon-${seconds}-revised.png`});}
  assert.deepEqual(errors,[]);console.log('Ravine art passed: 24 seconds of planted idle, no gait loop or unbound mouth tissue, fresh access, responsive framing and no shader errors.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
