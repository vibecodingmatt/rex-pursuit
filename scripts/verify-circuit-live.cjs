const {chromium}=require('playwright-core'),fs=require('node:fs'),assert=require('node:assert/strict');
const dir='art/review/lost-circuit/live';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(new URL('arcade.html?test=1',process.env.TEST_URL||'http://127.0.0.1:5188/').href);await page.waitForFunction(()=>lostCircuit.ready);await page.locator('[data-route=classic]').click();await page.locator('#start').click();await page.mouse.move(720,450);await page.mouse.down();
  const start=Date.now(),captures=new Set(),progress=[];let stage='';
  while(Date.now()-start<300000){
   const state=await page.evaluate(()=>{const g=lostCircuit.getGame();const e=g.entities.filter(e=>!e.dead&&e.age>.2).sort((a,b)=>b.age/b.life-a.age/a.life).find(e=>{const p=lostCircuit.project(e);return p.visible!==false&&p.hx>.03&&p.hx<.97&&p.hy>.2&&p.hy<.8;});return{mode:lostCircuit.mode,stage:g.stage.id,time:g.time,stageTime:g.stageTime,phase:g.phase,phaseTime:g.phaseTime,hp:g.hp,focus:g.focus,shots:g.shots,hits:g.hits,target:e?lostCircuit.project(e):null};});
   if(state.stage!==stage){stage=state.stage;console.log(`Live ride: ${stage}, ${Math.round(state.time)} s, ${Math.ceil(state.hp)} integrity`);progress.push(state);}
   if(state.mode==='result')break;
   assert.equal(state.mode,'playing','Live run must remain active without forced stepping or continues');
   if(state.target)await page.mouse.move(state.target.hx*1440,state.target.hy*900);
   if(state.focus>=100)await page.keyboard.press('e');
   const label=state.phase==='boss'&&state.phaseTime>3?`${stage}-boss`:state.phase==='ride'&&state.stageTime>9?`${stage}-ride`:null;
   if(label&&!captures.has(label)){captures.add(label);await page.screenshot({path:`${dir}/${label}.png`});}
   await page.waitForTimeout(70);
  }
  await page.mouse.up();const result=await page.evaluate(()=>lostCircuit.snapshot());assert.equal(result.status,'won');assert.equal(result.continues,0);assert.deepEqual(errors,[]);fs.writeFileSync(`${dir}/report.json`,JSON.stringify({wallSeconds:(Date.now()-start)/1000,progress,result},null,2));await page.screenshot({path:`${dir}/result.png`});console.log(`Live classic completed: ${result.score} points, ${Math.ceil(result.hp)} integrity, ${result.continues} continues; no stepping/seeking or page/shader errors.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
